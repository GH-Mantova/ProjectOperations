import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma, SorCategory, SorPeriodHalf } from "@prisma/client";

// ─── Input types ─────────────────────────────────────────────────────────────

export type CreatePeriodInput = {
  year: number;
  half: SorPeriodHalf;
  startDate: string; // ISO date string
  expiryDate: string; // ISO date string
  label: string;
  status?: string;
};

export type CreateRateInput = {
  category: SorCategory;
  name: string;
  class?: string | null;
  unit?: string | null;
  ordinary?: number | null;
  oneAndHalf?: number | null;
  double?: number | null;
  isReference?: boolean;
  comments?: string | null;
  sortOrder?: number;
};

export type UpdateRateInput = {
  name?: string;
  class?: string | null;
  unit?: string | null;
  ordinary?: number | null;
  oneAndHalf?: number | null;
  double?: number | null;
  isReference?: boolean;
  comments?: string | null;
  sortOrder?: number;
  active?: boolean;
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Schedule of Rates (SoR S1) — master rate-book for live jobs.
 *
 * Rates are grouped within a SorPeriod (H1/H2 of a calendar year).
 * Every create/update of a rate appends an immutable SorChangeLogEntry so
 * that the full history of rate changes is auditable.
 *
 * This is explicitly SEPARATE from the tender/estimate rate engine
 * (TenderRateSet, EstimatePlantRate, EstimateWasteRate).
 */
@Injectable()
export class ScheduleOfRatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Periods ───────────────────────────────────────────────────────────────

  /** List all SorPeriods, ordered by year and half descending. */
  async listPeriods() {
    return this.prisma.sorPeriod.findMany({
      orderBy: [{ year: "desc" }, { half: "asc" }],
      include: { _count: { select: { rates: true } } }
    });
  }

  /**
   * Get a single period with its rates grouped by category.
   * Returns { period, ratesByCategory: Record<SorCategory, SorRate[]> }.
   */
  async getPeriodWithRates(periodId: string) {
    const period = await this.prisma.sorPeriod.findUnique({
      where: { id: periodId },
      include: {
        rates: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      }
    });
    if (!period) throw new NotFoundException(`SorPeriod ${periodId} not found`);

    // Group by category
    const ratesByCategory: Partial<Record<SorCategory, typeof period.rates>> = {};
    for (const rate of period.rates) {
      if (!ratesByCategory[rate.category]) {
        ratesByCategory[rate.category] = [];
      }
      ratesByCategory[rate.category]!.push(rate);
    }

    return { period: { ...period, rates: undefined }, ratesByCategory };
  }

  /** Create a new period. Year+half must be unique. */
  async createPeriod(input: CreatePeriodInput) {
    return this.prisma.sorPeriod.create({
      data: {
        year: input.year,
        half: input.half,
        startDate: new Date(input.startDate),
        expiryDate: new Date(input.expiryDate),
        label: input.label,
        status: input.status ?? "ACTIVE"
      }
    });
  }

  // ── Rates ─────────────────────────────────────────────────────────────────

  /**
   * Create a new rate in a period and append a change-log entry.
   * actorId may be null for system/seed operations.
   */
  async createRate(periodId: string, input: CreateRateInput, actorId?: string) {
    // Verify period exists
    const period = await this.prisma.sorPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException(`SorPeriod ${periodId} not found`);

    const rate = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sorRate.create({
        data: {
          periodId,
          category: input.category,
          name: input.name,
          class: input.class ?? null,
          unit: input.unit ?? null,
          ordinary: input.ordinary != null ? new Prisma.Decimal(input.ordinary) : null,
          oneAndHalf: input.oneAndHalf != null ? new Prisma.Decimal(input.oneAndHalf) : null,
          double: input.double != null ? new Prisma.Decimal(input.double) : null,
          isReference: input.isReference ?? false,
          comments: input.comments ?? null,
          sortOrder: input.sortOrder ?? 0
        }
      });

      await tx.sorChangeLogEntry.create({
        data: {
          periodId,
          rateId: created.id,
          field: "created",
          oldValue: null,
          newValue: JSON.stringify({
            name: created.name,
            category: created.category,
            ordinary: created.ordinary?.toString() ?? null
          }),
          changedById: actorId ?? null
        }
      });

      return created;
    });

    return rate;
  }

  /**
   * Update a rate and append a change-log entry for each changed field.
   * actorId may be null for system operations.
   */
  async updateRate(rateId: string, input: UpdateRateInput, actorId?: string) {
    const existing = await this.prisma.sorRate.findUnique({ where: { id: rateId } });
    if (!existing) throw new NotFoundException(`SorRate ${rateId} not found`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      const changedFields: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      const track = (
        field: string,
        oldVal: unknown,
        newVal: unknown,
        dataKey: string,
        transform?: (v: unknown) => unknown
      ) => {
        if (newVal === undefined) return;
        const oldStr = oldVal != null ? String(oldVal) : null;
        const newStr = newVal != null ? String(newVal) : null;
        if (oldStr !== newStr) {
          changedFields.push({ field, oldValue: oldStr, newValue: newStr });
          updateData[dataKey] = transform ? transform(newVal) : newVal;
        }
      };

      track("name", existing.name, input.name, "name");
      track("class", existing.class, input.class, "class");
      track("unit", existing.unit, input.unit, "unit");
      track("ordinary", existing.ordinary, input.ordinary, "ordinary", (v) =>
        v != null ? new Prisma.Decimal(v as number) : null
      );
      track("oneAndHalf", existing.oneAndHalf, input.oneAndHalf, "oneAndHalf", (v) =>
        v != null ? new Prisma.Decimal(v as number) : null
      );
      track("double", existing.double, input.double, "double", (v) =>
        v != null ? new Prisma.Decimal(v as number) : null
      );
      track("isReference", existing.isReference, input.isReference, "isReference");
      track("comments", existing.comments, input.comments, "comments");
      track("sortOrder", existing.sortOrder, input.sortOrder, "sortOrder");
      track("active", existing.active, input.active, "active");

      const result = await tx.sorRate.update({
        where: { id: rateId },
        data: updateData
      });

      // Append one change-log entry per changed field (append-only)
      for (const change of changedFields) {
        await tx.sorChangeLogEntry.create({
          data: {
            periodId: existing.periodId,
            rateId,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            changedById: actorId ?? null
          }
        });
      }

      return result;
    });

    return updated;
  }

  /**
   * Deactivate a rate (soft-delete) and log the change.
   */
  async deactivateRate(rateId: string, actorId?: string) {
    return this.updateRate(rateId, { active: false }, actorId);
  }

  // ── Change log ────────────────────────────────────────────────────────────

  /** List all change-log entries for a period, chronological order. */
  async listChangeLog(periodId: string) {
    const period = await this.prisma.sorPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException(`SorPeriod ${periodId} not found`);

    return this.prisma.sorChangeLogEntry.findMany({
      where: { periodId },
      orderBy: { changedAt: "asc" }
    });
  }
}
