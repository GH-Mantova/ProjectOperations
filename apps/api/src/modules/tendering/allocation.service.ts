import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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
}
