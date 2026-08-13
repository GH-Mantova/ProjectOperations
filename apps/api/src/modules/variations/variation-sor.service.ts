import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SorCategory } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JobSorSnapshotService } from "../schedule-of-rates/job-sor-snapshot.service";

// -- Tiers ---------------------------------------------------------------
// The three tiers stored on a JobSorSnapshotRate. Sent from the client as
// strings; kept as-is on the line so the pricing screen can echo the label.
export const VARIATION_SOR_TIERS = ["ORDINARY", "ONE_AND_HALF", "DOUBLE"] as const;
export type VariationSorTier = (typeof VARIATION_SOR_TIERS)[number];

// -- Input types ---------------------------------------------------------

export type CreateVariationSorLineInput = {
  // Present -> catalog-backed. Absent -> manual line, caller supplies
  // name/category/rate directly.
  snapshotRateId?: string | null;
  tier: VariationSorTier;
  quantity: number | string;
  // Manual-line fields. Ignored when snapshotRateId is set (the catalog
  // row is authoritative).
  name?: string;
  class?: string | null;
  unit?: string | null;
  category?: SorCategory;
  rate?: number | string;
  notes?: string | null;
  sortOrder?: number;
  // Optional -- if the job has no snapshot yet, we lock one against this
  // period. If the job already has an ACTIVE snapshot, this is ignored.
  sorPeriodId?: string;
};

export type UpdateVariationSorLineInput = {
  tier?: VariationSorTier;
  quantity?: number | string;
  notes?: string | null;
  sortOrder?: number;
};

// -- Service -------------------------------------------------------------

/**
 * SoR S6 -- Variation Contract (VC) pricing service.
 *
 * VCs price the existing Variation model desktop-side from a locked Job
 * SoR snapshot (S4). Every VariationSorLine freezes its own rate at
 * create time so subsequent snapshot reissue, period expiry, or client
 * card resets never move historical pricing. Rate is NEVER re-read from
 * live SorRate -- edits keep the frozen value.
 *
 * The first line on a Variation whose Job has no snapshot yet triggers
 * the S4 attach flow using the caller-supplied sorPeriodId ("first VC/AR
 * locks it"). If the job already has an ACTIVE snapshot, it is reused.
 *
 * Permissions: finance.manage (existing Variations write permission).
 */
@Injectable()
export class VariationSorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: JobSorSnapshotService,
  ) {}

  // -- Public API --------------------------------------------------------

  async listLines(variationId: string) {
    await this.requireVariation(variationId);
    const lines = await this.prisma.variationSorLine.findMany({
      where: { variationId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const total = lines.reduce(
      (acc, line) => acc.add(line.lineAmount),
      new Prisma.Decimal(0),
    );
    return { lines, total };
  }

  async createLine(
    variationId: string,
    input: CreateVariationSorLineInput,
    actorId?: string,
  ) {
    await this.requireVariation(variationId);
    const jobId = await this.resolveJobIdForVariation(variationId);
    const snapshot = await this.ensureSnapshot(jobId, input.sorPeriodId, actorId);

    // Resolve the line body -- either freeze from the snapshot rate row or
    // accept the caller's manual values. In both cases `rate` is copied
    // onto the line so future edits do not re-read live data.
    const resolved = input.snapshotRateId
      ? await this.resolveCatalogLine(snapshot.id, input.snapshotRateId, input.tier)
      : this.resolveManualLine(input);

    const quantity = this.toDecimal(input.quantity, "quantity");
    const lineAmount = resolved.rate.mul(quantity);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.variationSorLine.create({
        data: {
          variationId,
          jobSorSnapshotId: snapshot.id,
          sorVersion: snapshot.sorVersion,
          snapshotRateId: input.snapshotRateId ?? null,
          category: resolved.category,
          name: resolved.name,
          class: resolved.class,
          unit: resolved.unit,
          tier: input.tier,
          rate: resolved.rate,
          quantity,
          lineAmount,
          notes: input.notes ?? null,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await this.recomputePricedAmount(tx, variationId);
      return created;
    });
  }

  async updateLine(
    variationId: string,
    lineId: string,
    input: UpdateVariationSorLineInput,
  ) {
    const existing = await this.prisma.variationSorLine.findUnique({
      where: { id: lineId },
    });
    if (!existing || existing.variationId !== variationId) {
      throw new NotFoundException("Variation SoR line not found.");
    }

    const tier = input.tier ?? (existing.tier as VariationSorTier);
    // Rate is FROZEN at creation. Even a tier change on an existing line
    // keeps the originally frozen rate -- tier is a label the caller can
    // update if they mis-labelled the line, but pricing does not move.
    const rate = existing.rate;
    const quantity =
      input.quantity !== undefined
        ? this.toDecimal(input.quantity, "quantity")
        : existing.quantity;
    const lineAmount = rate.mul(quantity);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.variationSorLine.update({
        where: { id: lineId },
        data: {
          tier,
          quantity,
          lineAmount,
          notes: input.notes === undefined ? existing.notes : input.notes,
          sortOrder: input.sortOrder ?? existing.sortOrder,
        },
      });
      await this.recomputePricedAmount(tx, variationId);
      return updated;
    });
  }

  async deleteLine(variationId: string, lineId: string) {
    const existing = await this.prisma.variationSorLine.findUnique({
      where: { id: lineId },
    });
    if (!existing || existing.variationId !== variationId) {
      throw new NotFoundException("Variation SoR line not found.");
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.variationSorLine.delete({ where: { id: lineId } });
      await this.recomputePricedAmount(tx, variationId);
      return { id: lineId, deleted: true };
    });
  }

  // -- Internals ---------------------------------------------------------

  private async requireVariation(variationId: string) {
    const variation = await this.prisma.variation.findUnique({
      where: { id: variationId },
      select: { id: true },
    });
    if (!variation) throw new NotFoundException(`Variation ${variationId} not found`);
  }

  /**
   * Walk Variation -> Contract -> Project -> sourceJob to reach the job.
   * VC pricing is scoped to a live job; if the contract's project has no
   * sourceJob, the caller cannot price from a snapshot and must attach
   * one via the S4 wizard first.
   */
  private async resolveJobIdForVariation(variationId: string) {
    const variation = await this.prisma.variation.findUnique({
      where: { id: variationId },
      select: {
        contract: {
          select: { project: { select: { sourceJobId: true } } },
        },
      },
    });
    const jobId = variation?.contract?.project?.sourceJobId ?? null;
    if (!jobId) {
      throw new BadRequestException(
        "Variation is not linked to a live Job (contract.project.sourceJob is null). Attach a Job SoR snapshot via the S4 wizard first.",
      );
    }
    return jobId;
  }

  /**
   * Return the active snapshot for the job, attaching one on first use if
   * the caller supplied a period. This implements the "first VC/AR locks
   * it" rule from S4.
   */
  private async ensureSnapshot(
    jobId: string,
    sorPeriodId: string | undefined,
    actorId?: string,
  ) {
    const active = await this.snapshots.getForJob(jobId);
    if (active) return active;
    if (!sorPeriodId) {
      throw new BadRequestException(
        "Job has no active SoR snapshot. Provide sorPeriodId on the first line to lock one, or attach via the S4 wizard.",
      );
    }
    return this.snapshots.attach({ jobId, sorPeriodId }, actorId);
  }

  private async resolveCatalogLine(
    snapshotId: string,
    snapshotRateId: string,
    tier: VariationSorTier,
  ) {
    const row = await this.snapshots.getLockedRate(snapshotId, snapshotRateId);
    const rate = this.pickTierRate(row, tier);
    if (rate === null) {
      throw new BadRequestException(
        `Snapshot rate ${snapshotRateId} has no value for tier ${tier}.`,
      );
    }
    return {
      category: row.category,
      name: row.name,
      class: row.class,
      unit: row.unit,
      rate,
    };
  }

  private resolveManualLine(input: CreateVariationSorLineInput) {
    if (!input.name || !input.category || input.rate === undefined || input.rate === null) {
      throw new BadRequestException(
        "Manual line requires name, category, and rate when snapshotRateId is not provided.",
      );
    }
    return {
      category: input.category,
      name: input.name,
      class: input.class ?? null,
      unit: input.unit ?? null,
      rate: this.toDecimal(input.rate, "rate"),
    };
  }

  private pickTierRate(
    row: {
      ordinary: Prisma.Decimal | null;
      oneAndHalf: Prisma.Decimal | null;
      double: Prisma.Decimal | null;
    },
    tier: VariationSorTier,
  ) {
    switch (tier) {
      case "ORDINARY":
        return row.ordinary;
      case "ONE_AND_HALF":
        return row.oneAndHalf;
      case "DOUBLE":
        return row.double;
      default:
        throw new BadRequestException(`Unknown tier ${tier as string}`);
    }
  }

  private toDecimal(value: number | string, field: string) {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`Invalid ${field}: ${String(value)}`);
    }
  }

  /**
   * Sum the current lines and stamp Variation.pricedAmount. First write
   * also stamps pricedDate. Uses the transaction client so callers see a
   * consistent snapshot within their own write.
   */
  private async recomputePricedAmount(
    tx: Prisma.TransactionClient,
    variationId: string,
  ) {
    const agg = await tx.variationSorLine.aggregate({
      where: { variationId },
      _sum: { lineAmount: true },
    });
    const total = agg._sum.lineAmount ?? new Prisma.Decimal(0);
    const current = await tx.variation.findUniqueOrThrow({
      where: { id: variationId },
      select: { pricedDate: true },
    });
    await tx.variation.update({
      where: { id: variationId },
      data: {
        pricedAmount: total,
        pricedDate: current.pricedDate ?? new Date(),
      },
    });
  }
}
