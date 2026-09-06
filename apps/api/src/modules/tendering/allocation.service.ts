import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CapacityService } from "./capacity.service";

/**
 * AllocationService — EW-2b allocation engine core.
 *
 * Wraps the allocation lifecycle (UNALLOCATED → ALLOCATED / POOL → CLAIMED)
 * around the `assignedEstimatorId` field on Tender. `estimatorUserId` is the
 * historical estimator-of-record and is NOT touched by this service.
 *
 * All methods are async. AuditService is injected via the global AuditModule;
 * CapacityService is registered in TenderingModule alongside this provider.
 */
@Injectable()
export class AllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacity: CapacityService,
    private readonly audit: AuditService
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // allocateSingle
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Directly assign a single estimator to a tender.
   *
   * - Verifies tender and estimator exist.
   * - Sets `assignedEstimatorId = estimatorId` and `allocationState = ALLOCATED`.
   * - Clears all TenderAllocationCandidate rows for the tender.
   * - Writes an audit entry.
   *
   * @param tenderId    - the tender to allocate
   * @param estimatorId - the estimator to assign
   * @param actorId     - the user performing the action (for audit)
   */
  async allocateSingle(
    tenderId: string,
    estimatorId: string,
    actorId: string
  ): Promise<void> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, tenderNumber: true, allocationState: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    const estimator = await this.prisma.user.findUnique({
      where: { id: estimatorId },
      select: { id: true }
    });
    if (!estimator) throw new NotFoundException("Estimator not found.");

    await this.prisma.tender.update({
      where: { id: tenderId },
      data: {
        assignedEstimatorId: estimatorId,
        allocationState: "ALLOCATED"
      }
    });

    // Clear pool candidates for this tender
    await this.prisma.tenderAllocationCandidate.deleteMany({
      where: { tenderId }
    });

    await this.audit.write({
      actorId,
      action: "tenders.allocation.allocate-single",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        estimatorId,
        previousState: tender.allocationState,
        newState: "ALLOCATED"
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // allocatePool
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Offer a tender to a pool of estimators.
   *
   * - Upserts TenderAllocationCandidate rows (duplicates are silently ignored
   *   via the @@unique constraint).
   * - Sets `allocationState = POOL` and clears `assignedEstimatorId`.
   * - Runs hybrid resolution: if any candidate has free capacity, calls
   *   `allocateSingle()` and state becomes ALLOCATED. Otherwise leaves as POOL.
   * - Writes an audit entry (after potential auto-assignment).
   *
   * @param tenderId     - the tender to pool
   * @param estimatorIds - the estimators to offer the tender to
   * @param actorId      - the user performing the action (for audit)
   */
  async allocatePool(
    tenderId: string,
    estimatorIds: string[],
    actorId: string
  ): Promise<void> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, allocationState: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    // Upsert candidate rows — @@unique([tenderId, estimatorId]) absorbs dupes
    for (const estimatorId of estimatorIds) {
      await this.prisma.tenderAllocationCandidate.upsert({
        where: { tenderId_estimatorId: { tenderId, estimatorId } },
        create: { tenderId, estimatorId },
        update: {}
      });
    }

    // Transition tender to POOL, clear any previous direct assignment
    await this.prisma.tender.update({
      where: { id: tenderId },
      data: {
        allocationState: "POOL",
        assignedEstimatorId: null
      }
    });

    // Hybrid resolution: auto-assign if any candidate has capacity
    const leastLoaded = await this.capacity.getLeastLoaded(estimatorIds);

    if (leastLoaded !== null) {
      // Auto-assign via allocateSingle — that method transitions to ALLOCATED,
      // clears candidates, and writes its own audit entry.
      await this.allocateSingle(tenderId, leastLoaded, actorId);
      return;
    }

    // No capacity available — leave as POOL and write audit
    await this.audit.write({
      actorId,
      action: "tenders.allocation.allocate-pool",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        estimatorIds,
        previousState: tender.allocationState,
        newState: "POOL",
        autoAssigned: false
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // selfClaim
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Allow an estimator to self-claim an UNALLOCATED or POOL tender.
   *
   * Race-guarded via Prisma `updateMany` with a state-conditional `where`
   * clause. If another claim wins concurrently, `count === 0` and a
   * ConflictException is thrown.
   *
   * - Sets `assignedEstimatorId = estimatorId`, `allocationState = CLAIMED`.
   * - If a TenderAllocationCandidate row exists for this estimator, stamps
   *   `claimedAt = now()`.
   * - Writes an audit entry.
   *
   * @param tenderId    - the tender to claim
   * @param estimatorId - the estimator claiming the tender
   */
  async selfClaim(tenderId: string, estimatorId: string): Promise<void> {
    // Race-guard: only update if state is still UNALLOCATED or POOL
    const result = await this.prisma.tender.updateMany({
      where: {
        id: tenderId,
        allocationState: { in: ["UNALLOCATED", "POOL"] }
      },
      data: {
        assignedEstimatorId: estimatorId,
        allocationState: "CLAIMED"
      }
    });

    if (result.count === 0) {
      throw new ConflictException("Tender already claimed.");
    }

    // Stamp claimedAt on the candidate row if it exists
    await this.prisma.tenderAllocationCandidate.updateMany({
      where: { tenderId, estimatorId },
      data: { claimedAt: new Date() }
    });

    await this.audit.write({
      actorId: estimatorId,
      action: "tenders.allocation.self-claim",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        estimatorId,
        newState: "CLAIMED"
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // reject — EW-2c
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * The assigned estimator declines a tender, with a required reason.
   *
   * - Rejects a blank / whitespace-only reason (BadRequestException).
   * - Only the estimator currently named in `assignedEstimatorId` may reject
   *   (ForbiddenException otherwise) — an allocator moving work off someone
   *   uses `override` or `pushBack`, not this method.
   * - Creates a TenderAllocationRejection row and transitions the tender to
   *   REJECTED with `assignedEstimatorId` cleared, in one transaction so a
   *   rejection row can never survive without the state change.
   * - Writes an audit entry.
   *
   * Alert dispatch (TENDER_REJECTED) is EW-3's job and is deliberately NOT
   * called from here.
   *
   * @param tenderId    - the tender being rejected
   * @param estimatorId - the estimator rejecting; must be the assigned one
   * @param reason      - required, non-blank justification
   * @param actorId     - the user performing the action (for audit)
   */
  async reject(
    tenderId: string,
    estimatorId: string,
    reason: string,
    actorId: string
  ): Promise<void> {
    if (reason.trim().length === 0) {
      throw new BadRequestException("A rejection reason is required.");
    }

    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, allocationState: true, assignedEstimatorId: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    if (tender.assignedEstimatorId !== estimatorId) {
      throw new ForbiddenException(
        "Only the assigned estimator can reject this tender."
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenderAllocationRejection.create({
        data: { tenderId, rejectedBy: estimatorId, reason: reason.trim() }
      });
      await tx.tender.update({
        where: { id: tenderId },
        data: {
          allocationState: "REJECTED",
          assignedEstimatorId: null
        }
      });
    });

    await this.audit.write({
      actorId,
      action: "tenders.allocation.reject",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        estimatorId,
        reason: reason.trim(),
        previousState: tender.allocationState,
        newState: "REJECTED"
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // override — EW-2c
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Allocator re-assigns a tender to a different estimator from any state.
   *
   * Distinct from `allocateSingle` only in that the audit entry names the
   * estimator who was displaced — the allocator's override is the action the
   * board has to be able to explain after the fact.
   *
   * - Sets `assignedEstimatorId = newEstimatorId`, `allocationState = ALLOCATED`.
   * - Clears pool candidate rows (the pool offer is moot once assigned), the
   *   same way `allocateSingle` does.
   * - Writes an audit entry carrying `previousEstimatorId`.
   *
   * @param tenderId       - the tender to re-assign
   * @param newEstimatorId - the estimator taking it over
   * @param actorId        - the allocator performing the action (for audit)
   */
  async override(
    tenderId: string,
    newEstimatorId: string,
    actorId: string
  ): Promise<void> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, allocationState: true, assignedEstimatorId: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    const estimator = await this.prisma.user.findUnique({
      where: { id: newEstimatorId },
      select: { id: true }
    });
    if (!estimator) throw new NotFoundException("Estimator not found.");

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id: tenderId },
        data: {
          assignedEstimatorId: newEstimatorId,
          allocationState: "ALLOCATED"
        }
      });
      await tx.tenderAllocationCandidate.deleteMany({ where: { tenderId } });
    });

    await this.audit.write({
      actorId,
      action: "tenders.allocation.override",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        newEstimatorId,
        previousEstimatorId: tender.assignedEstimatorId,
        previousState: tender.allocationState,
        newState: "ALLOCATED"
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // transfer — EW-2c
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Post-rejection reassignment: hand a REJECTED tender to a new estimator.
   *
   * Only valid out of REJECTED — re-pointing a live ALLOCATED/CLAIMED tender is
   * `override`, which records the displaced estimator. The assignment itself is
   * delegated to 2b's `allocateSingle`, which owns the write, the candidate
   * clear-down and its own audit entry.
   *
   * @param tenderId       - the rejected tender
   * @param newEstimatorId - the estimator receiving it
   * @param actorId        - the allocator performing the action (for audit)
   */
  async transfer(
    tenderId: string,
    newEstimatorId: string,
    actorId: string
  ): Promise<void> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, allocationState: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    if (tender.allocationState !== "REJECTED") {
      throw new BadRequestException(
        `Transfer is only available for a rejected tender (current: ${tender.allocationState}).`
      );
    }

    await this.allocateSingle(tenderId, newEstimatorId, actorId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // pushBack — EW-2c
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Return a tender to the unallocated pool.
   *
   * - Sets `allocationState = UNALLOCATED`, clears `assignedEstimatorId` and
   *   deletes the pool candidate rows, in one transaction.
   * - Writes an audit entry recording the state and estimator left behind.
   *
   * Deliberately NOT state-guarded, unlike `transfer`: plan §3 decision 3 gives
   * the allocator the right to override any state at any time, so un-assigning
   * an ALLOCATED or POOL tender back to the pool is a legitimate action, not
   * only a post-rejection one.
   *
   * Alert dispatch (UNALLOCATED_TENDER) is EW-3's job and is not called here.
   *
   * @param tenderId - the tender to return to the pool
   * @param actorId  - the allocator performing the action (for audit)
   */
  async pushBack(tenderId: string, actorId: string): Promise<void> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, allocationState: true, assignedEstimatorId: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id: tenderId },
        data: {
          allocationState: "UNALLOCATED",
          assignedEstimatorId: null
        }
      });
      await tx.tenderAllocationCandidate.deleteMany({ where: { tenderId } });
    });

    await this.audit.write({
      actorId,
      action: "tenders.allocation.push-back",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        previousEstimatorId: tender.assignedEstimatorId,
        previousState: tender.allocationState,
        newState: "UNALLOCATED"
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // detectUnallocated — EW-2c
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Tenders that have sat UNALLOCATED for longer than `thresholdMinutes`,
   * oldest first. Read-only — it exists so EW-3 has something to poll; this
   * service never dispatches the alert itself.
   *
   * CAVEAT — `updatedAt` is Tender's global `@updatedAt` column, so ANY edit to
   * the tender (due date, client, scope) resets the clock this query reads. A
   * tender left unallocated for a week but touched five minutes ago will not be
   * returned. Measuring time-in-state properly needs a dedicated
   * `allocationStateChangedAt` column on Tender, which is a schema change and
   * therefore outside this slice. Flagged for EW-3 to pick up.
   *
   * @param thresholdMinutes - staleness cut-off in minutes; EW-3 passes the
   *                           configured value, the default is a fallback only
   * @returns tender IDs, oldest `updatedAt` first
   */
  async detectUnallocated(thresholdMinutes = 60): Promise<string[]> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);

    const rows = await this.prisma.tender.findMany({
      where: {
        allocationState: "UNALLOCATED",
        updatedAt: { lt: cutoff }
      },
      select: { id: true },
      orderBy: { updatedAt: "asc" }
    });

    return rows.map((row) => row.id);
  }
}
