import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { parseRatesCanonicalSource, RatesCanonicalSource } from "../../config/app.config";

export type RateSource = "legacy" | "ratetable";

export type ResolvedRate = {
  rowId: string;
  value: number;
  unit: string;
  source: RateSource;
};

export type RateSetEntry = {
  key: string;
  rateTableId: string;
  rateTableSlug: string;
  label: string;
  unit: string | null;
  value: number;
};

export type RateParityResult = {
  slug: string;
  keys: Record<string, unknown>;
  legacy: ResolvedRate | { error: string } | null;
  ratetable: ResolvedRate | { error: string } | null;
  matches: boolean;
  divergence?: string;
};

/**
 * Single seam every future consumer will call: `resolveRate(slug, keys)`.
 * R0 reads from the eight legacy rate tables via a slug→adapter map so
 * pricing behaviour is byte-identical. New `RateTable` rows are also
 * resolvable, but no consumer is routed here yet (R1+).
 *
 * The legacy adapter map covers only the slugs the pricing paths already
 * use; unknown slugs fall through to the flexible `RateTable` model.
 *
 * Canonical-source cutover (`RATES_CANONICAL_SOURCE`):
 *   - `legacy` (default) — legacy first, RateTable fallback for unknown
 *     slugs. Byte-identical to pre-cutover behaviour.
 *   - `ratetable` — RateTable first, legacy fallback for slugs not yet
 *     modelled there. Flip only after `assertRateParity` shows clean
 *     agreement on a full pricing cycle in prod.
 */
@Injectable()
export class RateResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRate(tableSlug: string, keys: Record<string, unknown>): Promise<ResolvedRate> {
    const source = this.getCanonicalSource();

    if (source === "ratetable") {
      const flexible = await this.tryRateTable(tableSlug, keys);
      if (flexible) return flexible;
      const legacy = await this.tryLegacy(tableSlug, keys);
      if (legacy) return legacy;
      throw new NotFoundException(
        `No rate table with slug "${tableSlug}" (canonical source: ratetable).`
      );
    }

    const legacy = await this.tryLegacy(tableSlug, keys);
    if (legacy) return legacy;
    const flexible = await this.tryRateTable(tableSlug, keys);
    if (flexible) return flexible;
    throw new NotFoundException(`No rate table with slug "${tableSlug}".`);
  }

  /**
   * Resolve the same key from BOTH sources and report whether they agree.
   * Used to prove — before flipping `RATES_CANONICAL_SOURCE` — that the
   * ratetable path answers identically to the legacy path. A divergence
   * here is a real bug in the seed or the ratetable model, not a test
   * failure to be "fixed".
   */
  async assertRateParity(
    tableSlug: string,
    keys: Record<string, unknown>
  ): Promise<RateParityResult> {
    const legacy = await safeResolve(() => this.tryLegacy(tableSlug, keys));
    const ratetable = await safeResolve(() => this.tryRateTable(tableSlug, keys));

    if (isResolved(legacy) && isResolved(ratetable)) {
      const valueMatches = legacy.value === ratetable.value;
      const unitMatches = (legacy.unit ?? "") === (ratetable.unit ?? "");
      if (valueMatches && unitMatches) {
        return { slug: tableSlug, keys, legacy, ratetable, matches: true };
      }
      const parts: string[] = [];
      if (!valueMatches) parts.push(`value ${legacy.value} !== ${ratetable.value}`);
      if (!unitMatches) parts.push(`unit "${legacy.unit}" !== "${ratetable.unit}"`);
      return {
        slug: tableSlug,
        keys,
        legacy,
        ratetable,
        matches: false,
        divergence: parts.join("; ")
      };
    }

    return {
      slug: tableSlug,
      keys,
      legacy,
      ratetable,
      matches: false,
      divergence: describeMissing(legacy, ratetable)
    };
  }

  /**
   * Enumerate every active RateTable row × VALUE column as a flat list
   * of rate entries. The `key` — `{rateTableId}:{rowId}:{columnId}` — is
   * stable across snapshots so re-locking preserves overrides. Legacy
   * rate tables are not included; they lack a uniform enumerable shape.
   *
   * Reference tables (isReference=true) are factor / production data, not
   * priced rates — they are excluded here so they never appear as `$`
   * override rows in a locked tender snapshot.
   */
  async enumerateRateSet(): Promise<RateSetEntry[]> {
    const tables = await this.prisma.rateTable.findMany({
      where: { isReference: false },
      include: { columns: { orderBy: { sortOrder: "asc" } } }
    });
    const entries: RateSetEntry[] = [];
    for (const table of tables) {
      const keyCols = table.columns.filter((c) => c.role === "KEY");
      const valueCols = table.columns.filter((c) => c.role === "VALUE");
      if (valueCols.length === 0) continue;
      const rows = await this.prisma.rateRow.findMany({
        where: { rateTableId: table.id, isActive: true },
        orderBy: { sortOrder: "asc" }
      });
      for (const row of rows) {
        const cells = (row.cells as Record<string, unknown> | null) ?? {};
        const keyLabel = keyCols
          .map((c) => {
            const v = cells[c.id] ?? cells[c.name];
            return v === undefined || v === null ? "" : String(v);
          })
          .filter((s) => s.length > 0)
          .join(" · ");
        for (const col of valueCols) {
          const raw = cells[col.id];
          const value = Number(raw);
          if (raw === undefined || raw === null || Number.isNaN(value)) continue;
          const key = `${table.id}:${row.id}:${col.id}`;
          const label =
            keyLabel.length > 0 ? `${table.name} — ${keyLabel} (${col.name})` : `${table.name} (${col.name})`;
          entries.push({
            key,
            rateTableId: table.id,
            rateTableSlug: table.slug,
            label,
            unit: col.unit ?? null,
            value
          });
        }
      }
    }
    return entries;
  }

  /**
   * Read a named numeric metric from a reference RateTable. Unlike
   * `resolveRate` (which returns the first VALUE column and is used by
   * priced consumers) this lets calculators pull a specific factor out of a
   * multi-metric factor row — e.g. the "Excavating" metric from the
   * excavator-production table. Returns `null` on any miss so callers can
   * choose a fallback without wrapping in try/catch.
   */
  async resolveReferenceValue(
    tableSlug: string,
    keys: Record<string, unknown>,
    columnName: string
  ): Promise<number | null> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: true }
    });
    if (!table || !table.isReference) return null;

    const wanted = columnName.trim().toLowerCase();
    const col = table.columns.find((c) => c.name.trim().toLowerCase() === wanted);
    if (!col) return null;

    const keyCols = table.columns.filter((c) => c.role === "KEY");
    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      return keyCols.every((c) => norm(cells[c.id]) === norm(keys[c.name] ?? keys[c.id]));
    });
    if (!match) return null;
    const raw = ((match.cells as Record<string, unknown>) ?? {})[col.id];
    if (raw === undefined || raw === null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  /**
   * List every material density row, ordered as the estimating UI
   * expects (active first, then category, then material name).
   *
   * Reads from `EstimateMaterialDensity` — the legacy model is still
   * write-authoritative for THIS PR (deprecate-in-place). Callers
   * that previously hit prisma directly should route here so that when
   * the storage flips to `RateTable` in the follow-up PR they need no
   * further change.
   *
   * Byte-identical to a direct `prisma.estimateMaterialDensity.findMany`
   * with the same ordering.
   */
  async listMaterialDensities() {
    return this.prisma.estimateMaterialDensity.findMany({
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { materialName: "asc" }]
    });
  }

  /**
   * Single-material density lookup for pricing / waste-weight paths.
   * Returns `null` on any miss so callers can pick a fallback without
   * wrapping in try/catch.
   *
   * Legacy-first — the `estimate_material_density` row is the source of
   * truth for this PR. If the legacy row is missing we fall through to
   * the RateTable projection (seeded by the migration + seed) so a
   * caller written against the new seam still gets an answer during
   * the deprecate-in-place window.
   *
   * Density is returned as `Number(row.density)` — the same conversion
   * every existing consumer uses — so numbers are byte-identical to
   * the pre-cutover lookup.
   */
  async resolveMaterialDensity(
    materialName: string
  ): Promise<{ density: number; unit: string; kind: string; category: string | null } | null> {
    const legacy = await this.prisma.estimateMaterialDensity.findUnique({
      where: { materialName }
    });
    if (legacy) {
      return {
        density: Number(legacy.density),
        unit: legacy.unit,
        kind: String(legacy.kind),
        category: legacy.category
      };
    }

    const table = await this.prisma.rateTable.findUnique({
      where: { slug: "material-densities" },
      include: { columns: true }
    });
    if (!table) return null;
    const byKey = new Map(table.columns.map((c) => [c.name.toLowerCase(), c] as const));
    const materialCol = byKey.get("material");
    const densityCol = byKey.get("density");
    const unitCol = byKey.get("unit");
    const kindCol = byKey.get("kind");
    const categoryCol = byKey.get("category");
    if (!materialCol || !densityCol) return null;

    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const wanted = materialName.trim().toLowerCase();
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      const v = cells[materialCol.id] ?? cells[materialCol.name];
      return String(v ?? "").trim().toLowerCase() === wanted;
    });
    if (!match) return null;
    const cells = (match.cells as Record<string, unknown> | null) ?? {};
    const density = Number(cells[densityCol.id]);
    if (!Number.isFinite(density)) return null;
    return {
      density,
      unit: unitCol ? String(cells[unitCol.id] ?? "") : "",
      kind: kindCol ? String(cells[kindCol.id] ?? "") : "VOLUME",
      category: categoryCol
        ? (String(cells[categoryCol.id] ?? "") || null)
        : null
    };
  }

  private getCanonicalSource(): RatesCanonicalSource {
    return parseRatesCanonicalSource(process.env.RATES_CANONICAL_SOURCE);
  }

  private async tryRateTable(
    tableSlug: string,
    keys: Record<string, unknown>
  ): Promise<ResolvedRate | null> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: true }
    });
    if (!table) return null;
    const keyCols = table.columns.filter((c) => c.role === "KEY");
    const valueCols = table.columns.filter((c) => c.role === "VALUE");
    if (valueCols.length === 0) return null;
    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      return keyCols.every((c) => norm(cells[c.id]) === norm(keys[c.name] ?? keys[c.id]));
    });
    if (!match) return null;
    const value = Number(((match.cells as Record<string, unknown>) ?? {})[valueCols[0].id]);
    return {
      rowId: match.id,
      value,
      unit: valueCols[0].unit ?? "",
      source: "ratetable"
    };
  }

  private async tryLegacy(slug: string, keys: Record<string, unknown>): Promise<ResolvedRate | null> {
    switch (slug) {
      case "labour": {
        const role = String(keys.role ?? "");
        const shift = String(keys.shift ?? "day");
        const row = await this.prisma.estimateLabourRate.findUnique({ where: { role } });
        if (!row) return null;
        const rate =
          shift === "night" ? row.nightRate : shift === "weekend" ? row.weekendRate : row.dayRate;
        return { rowId: row.id, value: Number(rate), unit: "day", source: "legacy" };
      }
      case "plant": {
        const item = String(keys.item ?? "");
        const row = await this.prisma.estimatePlantRate.findUnique({ where: { item } });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
      }
      case "waste": {
        const wasteType = String(keys.wasteType ?? "");
        const facility = String(keys.facility ?? "");
        const row = await this.prisma.estimateWasteRate.findUnique({
          where: { wasteType_facility: { wasteType, facility } }
        });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.tonRate), unit: row.unit, source: "legacy" };
      }
      case "cutting": {
        const equipment = String(keys.equipment ?? "");
        const elevation = String(keys.elevation ?? "");
        const material = String(keys.material ?? "");
        const depthMm = Number(keys.depthMm ?? 0);
        const row = await this.prisma.estimateCuttingRate.findUnique({
          where: {
            equipment_elevation_material_depthMm: { equipment, elevation, material, depthMm }
          }
        });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.ratePerM), unit: "m", source: "legacy" };
      }
      case "core-hole": {
        const diameterMm = Number(keys.diameterMm ?? 0);
        const row = await this.prisma.estimateCoreHoleRate.findUnique({ where: { diameterMm } });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.ratePerHole), unit: "hole", source: "legacy" };
      }
      case "fuel": {
        const item = String(keys.item ?? "");
        const row = await this.prisma.estimateFuelRate.findUnique({ where: { item } });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
      }
      default:
        return null;
    }
  }
}

function norm(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim().toLowerCase();
}

async function safeResolve(
  fn: () => Promise<ResolvedRate | null>
): Promise<ResolvedRate | { error: string } | null> {
  try {
    return await fn();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function isResolved(
  x: ResolvedRate | { error: string } | null
): x is ResolvedRate {
  return x !== null && !(typeof x === "object" && "error" in x);
}

function describeMissing(
  legacy: ResolvedRate | { error: string } | null,
  ratetable: ResolvedRate | { error: string } | null
): string {
  const legDesc = legacy === null ? "missing" : "error" in legacy ? `error(${legacy.error})` : "ok";
  const rtDesc =
    ratetable === null ? "missing" : "error" in ratetable ? `error(${ratetable.error})` : "ok";
  return `legacy=${legDesc}, ratetable=${rtDesc}`;
}
