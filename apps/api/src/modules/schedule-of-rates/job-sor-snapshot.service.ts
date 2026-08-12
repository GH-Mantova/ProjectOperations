import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SorCategory } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// ─── Input types ─────────────────────────────────────────────────────────────

export type AttachSnapshotInput = {
  jobId?: string | null;
  tenderId?: string | null;
  sorPeriodId: string;
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * SoR S4 — Job SoR snapshot & per-record version lock.
 *
 * The snapshot freezes the merged (master + client rate card) rate view for a
 * job OR tender the first time a VC/AR is created against it. Downstream slices
 * (S6 VC pricing, S7 AR pricing) read locked rates from JobSorSnapshotRate,
 * never from the live SorRate table — so historical records survive rate
 * edits, period expiry, or client-card resets.
 *
 * Reissue: once the underlying SorPeriod has expired, `reissue()` creates a
 * NEW snapshot for the next period and points the old snapshot's
 * supersededById at the successor. The old snapshot's rates are never mutated.
 *
 * Permissions: `rates.manage` (enforced at the controller).
 */
@Injectable()
export class JobSorSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Attach (or return the existing) rate-book snapshot for a job OR tender.
   *
   * Idempotent per (jobId|tenderId, sorVersion): if an ACTIVE snapshot already
   * exists for the given target + period, it is returned as-is. This lets
   * S6/S7 call attach() blindly whenever a VC/AR is created.
   */
  async attach(input: AttachSnapshotInput, actorId?: string) {
    const { jobId, tenderId, sorPeriodId } = input;

    // XOR: exactly one target must be provided.
    if (!jobId === !tenderId) {
      throw new BadRequestException(
        "Provide exactly one of jobId or tenderId (one non-null, the other null).",
      );
    }

    const period = await this.prisma.sorPeriod.findUnique({
      where: { id: sorPeriodId },
    });
    if (!period) throw new NotFoundException(`SorPeriod ${sorPeriodId} not found`);

    // Resolve the target's clientId (denormalised on the snapshot so wizard
    // listings don't need a Job/Tender join).
    const { clientId } = await this.resolveClientId({ jobId, tenderId });

    // Fast idempotency: if an ACTIVE snapshot already exists for this target
    // + period, return it unchanged. Version stamp is monotonic per period,
    // so no need to compute it before checking.
    const existing = await this.prisma.jobSorSnapshot.findFirst({
      where: {
        status: "ACTIVE",
        sorPeriodId,
        ...(jobId ? { jobId } : { tenderId }),
      },
      include: { rates: true },
    });
    if (existing) return existing;

    const sorVersion = this.buildVersionStamp(period);
    const sorPeriodLabel = period.label;

    // Look up the client's rate card for this period (may be null).
    const clientCard = await this.prisma.sorClientRateCard.findUnique({
      where: { clientId_sorPeriodId: { clientId, sorPeriodId } },
    });

    // Merge master + client-card (mirror of SorClientRateCardService.listEntries).
    const mergedRows = await this.buildMergedRateRows(sorPeriodId, clientCard?.id ?? null);

    // Create the snapshot + all rate rows in one transaction.
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.jobSorSnapshot.create({
        data: {
          jobId: jobId ?? null,
          tenderId: tenderId ?? null,
          clientId,
          sorPeriodId,
          sorClientRateCardId: clientCard?.id ?? null,
          sorPeriodLabel,
          sorVersion,
          lockedById: actorId ?? null,
          status: "ACTIVE",
        },
      });

      if (mergedRows.length > 0) {
        await tx.jobSorSnapshotRate.createMany({
          data: mergedRows.map((row) => ({
            snapshotId: snapshot.id,
            sourceRateId: row.sourceRateId,
            category: row.category,
            name: row.name,
            class: row.class,
            unit: row.unit,
            ordinary: row.ordinary,
            oneAndHalf: row.oneAndHalf,
            double: row.double,
            isReference: row.isReference,
            comments: row.comments,
          })),
        });
      }

      return tx.jobSorSnapshot.findUniqueOrThrow({
        where: { id: snapshot.id },
        include: { rates: true },
      });
    });
  }

  /**
   * Return the ACTIVE snapshot for a job (with its locked rates), or null.
   * S6/S7 use this to render the locked rate book for a VC/AR line editor.
   */
  async getForJob(jobId: string) {
    return this.prisma.jobSorSnapshot.findFirst({
      where: { jobId, status: "ACTIVE" },
      include: { rates: true, sorPeriod: true },
      orderBy: { lockedAt: "desc" },
    });
  }

  /**
   * Return the ACTIVE snapshot for a tender (with its locked rates), or null.
   */
  async getForTender(tenderId: string) {
    return this.prisma.jobSorSnapshot.findFirst({
      where: { tenderId, status: "ACTIVE" },
      include: { rates: true, sorPeriod: true },
      orderBy: { lockedAt: "desc" },
    });
  }

  /**
   * Reissue a snapshot for the next active period once the current one has
   * expired. The old snapshot is marked ACTIVE=false and gets a
   * supersededById pointer at the successor; its rates are never mutated so
   * pre-existing VC/AR records keep their historical prices intact.
   */
  async reissue(snapshotId: string, nextSorPeriodId: string, actorId?: string) {
    const current = await this.prisma.jobSorSnapshot.findUnique({
      where: { id: snapshotId },
      include: { sorPeriod: true },
    });
    if (!current) throw new NotFoundException(`JobSorSnapshot ${snapshotId} not found`);
    if (current.status !== "ACTIVE") {
      throw new BadRequestException(
        `JobSorSnapshot ${snapshotId} is not ACTIVE (status=${current.status}); cannot reissue.`,
      );
    }
    const now = new Date();
    if (current.sorPeriod.expiryDate.getTime() > now.getTime()) {
      throw new BadRequestException(
        `SorPeriod ${current.sorPeriod.id} has not expired yet (expiry=${current.sorPeriod.expiryDate.toISOString()}).`,
      );
    }

    // Attach a NEW snapshot for the next period. attach() handles the merge
    // and version-stamping — we just wire the supersede pointer after.
    const successor = await this.attach(
      {
        jobId: current.jobId,
        tenderId: current.tenderId,
        sorPeriodId: nextSorPeriodId,
      },
      actorId,
    );

    // Mark the current snapshot superseded. Do this in a transaction so we
    // never leave a half-linked pair on failure.
    await this.prisma.$transaction(async (tx) => {
      await tx.jobSorSnapshot.update({
        where: { id: current.id },
        data: { status: "SUPERSEDED", supersededById: successor.id },
      });
    });

    return successor;
  }

  /**
   * Fetch a single locked rate row from a snapshot. S6/S7 call this to stamp
   * the locked rate onto a VC/AR line at the moment of creation — so even if
   * the snapshot is later reissued, the line already carries its own values.
   *
   * sortKey is the JobSorSnapshotRate id (the caller resolves the row from
   * the snapshot's merged rate list before invoking this).
   */
  async getLockedRate(snapshotId: string, snapshotRateId: string) {
    const row = await this.prisma.jobSorSnapshotRate.findFirst({
      where: { id: snapshotRateId, snapshotId },
    });
    if (!row) {
      throw new NotFoundException(
        `JobSorSnapshotRate ${snapshotRateId} not found in snapshot ${snapshotId}`,
      );
    }
    return row;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * Merge the master rate catalog with the client card overrides, additions,
   * and removals — the same rules as SorClientRateCardService.listEntries.
   * Returns the flat list of frozen rate rows to copy into the snapshot.
   */
  private async buildMergedRateRows(sorPeriodId: string, cardId: string | null) {
    const masterRates = await this.prisma.sorRate.findMany({
      where: { periodId: sorPeriodId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const clientEntries = cardId
      ? await this.prisma.sorClientRateEntry.findMany({
          where: { cardId },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const entryBySorRateId = new Map<string, (typeof clientEntries)[number]>();
    const freshAdditions: (typeof clientEntries)[number][] = [];
    for (const entry of clientEntries) {
      if (entry.sorRateId) entryBySorRateId.set(entry.sorRateId, entry);
      else freshAdditions.push(entry);
    }

    type FrozenRow = {
      sourceRateId: string | null;
      category: SorCategory;
      name: string;
      class: string | null;
      unit: string | null;
      ordinary: Prisma.Decimal | null;
      oneAndHalf: Prisma.Decimal | null;
      double: Prisma.Decimal | null;
      isReference: boolean;
      comments: string | null;
    };

    const rows: FrozenRow[] = [];

    for (const rate of masterRates) {
      const entry = entryBySorRateId.get(rate.id);
      if (entry?.isRemoved) continue;

      if (!entry) {
        rows.push({
          sourceRateId: rate.id,
          category: rate.category,
          name: rate.name,
          class: rate.class,
          unit: rate.unit,
          ordinary: rate.ordinary,
          oneAndHalf: rate.oneAndHalf,
          double: rate.double,
          isReference: rate.isReference,
          comments: rate.comments,
        });
      } else {
        rows.push({
          sourceRateId: rate.id,
          category: entry.category,
          name: entry.position,
          class: entry.class,
          unit: entry.unit,
          ordinary: entry.ordinary,
          oneAndHalf: entry.oneAndHalf,
          double: entry.double,
          // isReference / comments live on the master row only. Overrides
          // inherit them so a client override doesn't drop the cost-plus flag.
          isReference: rate.isReference,
          comments: rate.comments,
        });
      }
    }

    for (const entry of freshAdditions) {
      rows.push({
        sourceRateId: null,
        category: entry.category,
        name: entry.position,
        class: entry.class,
        unit: entry.unit,
        ordinary: entry.ordinary,
        oneAndHalf: entry.oneAndHalf,
        double: entry.double,
        isReference: false,
        comments: null,
      });
    }

    return rows;
  }

  private async resolveClientId(target: { jobId?: string | null; tenderId?: string | null }) {
    if (target.jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: target.jobId },
        select: { clientId: true },
      });
      if (!job) throw new NotFoundException(`Job ${target.jobId} not found`);
      return { clientId: job.clientId };
    }
    // tenderId branch — Tender clients live on TenderClient (1..n). Use the
    // first TenderClient as the canonical client; if none, the tender has no
    // client attached yet and the snapshot cannot be created.
    const tenderClient = await this.prisma.tenderClient.findFirst({
      where: { tenderId: target.tenderId ?? "" },
      select: { clientId: true },
      orderBy: { createdAt: "asc" },
    });
    if (!tenderClient) {
      throw new BadRequestException(
        `Tender ${target.tenderId} has no client — attach a TenderClient before snapshotting.`,
      );
    }
    return { clientId: tenderClient.clientId };
  }

  private buildVersionStamp(period: { year: number; half: string }) {
    // Append-only: two attaches at the same instant would collide on the
    // (target, sorVersion) unique. In practice attach() is idempotent per
    // period so this only fires once per (target, period) pair. Reissue
    // introduces the next period, so a fresh stamp naturally follows.
    return `${period.year}-${period.half}-${new Date().toISOString()}`;
  }
}
