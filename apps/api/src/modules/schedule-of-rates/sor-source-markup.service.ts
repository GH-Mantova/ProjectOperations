import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  SorCategory,
  SorRateSourceType,
  type SorRate,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

/**
 * SoR S3 (rate-hub) — resolves the source of every SoR line and applies the
 * period's category-default markup or the per-line override.
 *
 * "Source" is one of:
 *   - INTERNAL  : linked to a RateRow in our own rate hub.
 *   - SUBBIE    : linked to a SubcontractorRate (vendor hub).
 *   - SUPPLIER  : linked to a SubcontractorRate (vendor hub, supplier flavour).
 *   - MANUAL    : typed directly on the SoR admin page — can later be
 *                 promoted into the hub (creates a matching RateRow and
 *                 flips the SoR line to INTERNAL).
 *
 * Markup rule (per-line wins):
 *   effectiveRate = base * (1 + resolvedMarkupPct / 100)
 *   resolvedMarkupPct = sorRate.markupPct
 *                     ?? periodMarkups[category]
 *                     ?? 0
 */

/** Serialised shape of {@link SorPeriod.categoryMarkups}. Values are percentages. */
export type PeriodCategoryMarkups = Partial<Record<SorCategory, number>>;

/**
 * SorCategory → target RateTable.slug for the "promote MANUAL → hub" action.
 * SUBCONTRACTOR is intentionally excluded here — those lines should be linked
 * to a SubcontractorRate via {@link SorSourceMarkupService.linkVendorRate}
 * rather than promoted into the internal rate hub.
 */
const PROMOTE_TARGET_SLUG_BY_CATEGORY: Partial<Record<SorCategory, string>> = {
  [SorCategory.LABOUR]: "labour",
  [SorCategory.PLANT]: "plant",
  [SorCategory.WASTE]: "waste-per-tonne",
};

@Injectable()
export class SorSourceMarkupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Effective-rate resolution ─────────────────────────────────────────────

  /**
   * Compute the client-facing rate for a SoR line by applying the effective
   * markup to its base `ordinary` rate.
   *
   * Returns `0` when the line has no base rate — the SoR line is not usable
   * yet, but this keeps calling code numeric-safe (no NaN).
   */
  resolveEffectiveRate(
    sorRate: Pick<SorRate, "category" | "ordinary" | "markupPct">,
    periodMarkups: PeriodCategoryMarkups,
  ): number {
    const base = sorRate.ordinary != null ? Number(sorRate.ordinary) : 0;
    if (!Number.isFinite(base) || base === 0) return 0;
    const pct = this.resolveMarkupPct(sorRate, periodMarkups);
    return round2(base * (1 + pct / 100));
  }

  /** Per-line override wins; else category default; else 0. */
  resolveMarkupPct(
    sorRate: Pick<SorRate, "category" | "markupPct">,
    periodMarkups: PeriodCategoryMarkups,
  ): number {
    if (sorRate.markupPct != null) return Number(sorRate.markupPct);
    const fromPeriod = periodMarkups[sorRate.category];
    return typeof fromPeriod === "number" && Number.isFinite(fromPeriod)
      ? fromPeriod
      : 0;
  }

  /**
   * Read the `SorPeriod.categoryMarkups` JSON into a typed map. Silently
   * coerces malformed values to an empty map — the SoR admin form is the
   * single writer, so bad shapes should never appear in practice.
   */
  parsePeriodMarkups(raw: Prisma.JsonValue | null | undefined): PeriodCategoryMarkups {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: PeriodCategoryMarkups = {};
    const validCategories = new Set<string>(Object.values(SorCategory));
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!validCategories.has(key)) continue;
      const num = Number(value);
      if (Number.isFinite(num)) {
        out[key as SorCategory] = num;
      }
    }
    return out;
  }

  // ── Link actions ──────────────────────────────────────────────────────────

  /**
   * Link a SoR line to an internal RateRow. Sets `sourceType = INTERNAL`
   * and clears any vendor-source FK so the line has exactly one source.
   */
  async linkInternalRate(sorRateId: string, rateRowId: string, actorId?: string) {
    const [existing, rateRow] = await Promise.all([
      this.prisma.sorRate.findUnique({ where: { id: sorRateId } }),
      this.prisma.rateRow.findUnique({ where: { id: rateRowId } }),
    ]);
    if (!existing) throw new NotFoundException(`SorRate ${sorRateId} not found`);
    if (!rateRow) throw new NotFoundException(`RateRow ${rateRowId} not found`);

    const updated = await this.prisma.sorRate.update({
      where: { id: sorRateId },
      data: {
        sourceType: SorRateSourceType.INTERNAL,
        sourceRateRowId: rateRowId,
        sourceSubRateId: null,
      },
    });

    await this.audit.write({
      actorId: actorId ?? null,
      action: "sor.rate.link-internal",
      entityType: "SorRate",
      entityId: sorRateId,
      metadata: {
        rateRowId,
        previousSourceType: existing.sourceType,
        previousRateRowId: existing.sourceRateRowId,
        previousSubRateId: existing.sourceSubRateId,
      },
    });

    return updated;
  }

  /**
   * Link a SoR line to a vendor SubcontractorRate. `sourceType` must be
   * SUBBIE or SUPPLIER; the caller decides which flavour based on the
   * SubcontractorSupplier.vendorType of the target vendor.
   */
  async linkVendorRate(
    sorRateId: string,
    subRateId: string,
    sourceType: "SUBBIE" | "SUPPLIER",
    actorId?: string,
  ) {
    if (
      sourceType !== SorRateSourceType.SUBBIE &&
      sourceType !== SorRateSourceType.SUPPLIER
    ) {
      throw new BadRequestException(
        "linkVendorRate: sourceType must be SUBBIE or SUPPLIER",
      );
    }
    const [existing, subRate] = await Promise.all([
      this.prisma.sorRate.findUnique({ where: { id: sorRateId } }),
      this.prisma.subcontractorRate.findUnique({ where: { id: subRateId } }),
    ]);
    if (!existing) throw new NotFoundException(`SorRate ${sorRateId} not found`);
    if (!subRate) {
      throw new NotFoundException(`SubcontractorRate ${subRateId} not found`);
    }

    const updated = await this.prisma.sorRate.update({
      where: { id: sorRateId },
      data: {
        sourceType,
        sourceSubRateId: subRateId,
        sourceRateRowId: null,
      },
    });

    await this.audit.write({
      actorId: actorId ?? null,
      action: "sor.rate.link-vendor",
      entityType: "SorRate",
      entityId: sorRateId,
      metadata: {
        subRateId,
        sourceType,
        previousSourceType: existing.sourceType,
        previousRateRowId: existing.sourceRateRowId,
        previousSubRateId: existing.sourceSubRateId,
      },
    });

    return updated;
  }

  // ── Promote MANUAL → hub ─────────────────────────────────────────────────

  /**
   * Promote a MANUAL SoR line into the internal rate hub by creating a
   * matching RateRow in the category-mapped RateTable, then re-linking the
   * SoR line via {@link linkInternalRate}. Rejects lines that are not
   * MANUAL (already linked to a hub or vendor source).
   *
   * SUBCONTRACTOR-category lines cannot be promoted here — they belong on
   * the vendor hub and should be linked with {@link linkVendorRate}.
   */
  async promoteToHub(sorRateId: string, actorId?: string) {
    const rate = await this.prisma.sorRate.findUnique({ where: { id: sorRateId } });
    if (!rate) throw new NotFoundException(`SorRate ${sorRateId} not found`);
    if (rate.sourceType !== SorRateSourceType.MANUAL) {
      throw new BadRequestException(
        `SorRate ${sorRateId} is not MANUAL (sourceType=${rate.sourceType}); nothing to promote.`,
      );
    }

    const slug = PROMOTE_TARGET_SLUG_BY_CATEGORY[rate.category];
    if (!slug) {
      throw new BadRequestException(
        `SorRate category ${rate.category} cannot be promoted to the internal hub — link it to a vendor rate instead.`,
      );
    }

    const table = await this.prisma.rateTable.findUnique({
      where: { slug },
      include: { columns: { orderBy: { sortOrder: "asc" } } },
    });
    if (!table) {
      throw new NotFoundException(
        `RateTable "${slug}" not found — cannot promote ${sorRateId} into the hub.`,
      );
    }

    // Best-effort mapping of the MANUAL SoR line onto the target table's
    // columns. We fill by column name (case-insensitive) with the SoR line's
    // corresponding field. Unmatched columns are left absent — the row is
    // still valid because RateRow.cells is loosely typed JSON.
    const keyByName: Record<string, string> = {};
    for (const col of table.columns) {
      keyByName[col.name.toLowerCase()] = col.id;
    }
    const cells: Record<string, unknown> = {};
    const put = (name: string, value: unknown) => {
      const cid = keyByName[name.toLowerCase()];
      if (cid != null && value != null && value !== "") cells[cid] = value;
    };
    // Common: name, unit, class → KEY / INFO columns
    put("role", rate.name);
    put("item", rate.name);
    put("facility", rate.name);
    put("category", rate.class);
    put("class", rate.class);
    put("unit", rate.unit);
    // Values
    const ord = rate.ordinary != null ? Number(rate.ordinary) : null;
    const oneHalf = rate.oneAndHalf != null ? Number(rate.oneAndHalf) : null;
    const dbl = rate.double != null ? Number(rate.double) : null;
    put("rate", ord);
    put("day rate", ord);
    put("night rate", oneHalf);
    put("weekend rate", dbl);
    put("rate per tonne", ord);

    const newRow = await this.prisma.rateRow.create({
      data: {
        rateTableId: table.id,
        cells: cells as Prisma.InputJsonValue,
        isActive: true,
        sortOrder: 0,
        createdById: actorId ?? null,
        updatedById: actorId ?? null,
      },
    });

    await this.audit.write({
      actorId: actorId ?? null,
      action: "sor.rate.promote-to-hub",
      entityType: "SorRate",
      entityId: sorRateId,
      metadata: {
        rateTableId: table.id,
        rateTableSlug: table.slug,
        rateRowId: newRow.id,
      },
    });

    return this.linkInternalRate(sorRateId, newRow.id, actorId);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
