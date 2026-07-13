import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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

/**
 * Single seam every future consumer will call: `resolveRate(slug, keys)`.
 * R0 reads from the eight legacy rate tables via a slug→adapter map so
 * pricing behaviour is byte-identical. New `RateTable` rows are also
 * resolvable, but no consumer is routed here yet (R1+).
 *
 * The legacy adapter map covers only the slugs the pricing paths already
 * use; unknown slugs fall through to the flexible `RateTable` model.
 */
@Injectable()
export class RateResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRate(tableSlug: string, keys: Record<string, unknown>): Promise<ResolvedRate> {
    const legacy = await this.tryLegacy(tableSlug, keys);
    if (legacy) return legacy;

    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: true }
    });
    if (!table) {
      throw new NotFoundException(`No rate table with slug "${tableSlug}".`);
    }
    const keyCols = table.columns.filter((c) => c.role === "KEY");
    const valueCols = table.columns.filter((c) => c.role === "VALUE");
    if (valueCols.length === 0) {
      throw new NotFoundException(`Rate table "${tableSlug}" has no VALUE column.`);
    }
    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      return keyCols.every((c) => norm(cells[c.id]) === norm(keys[c.name] ?? keys[c.id]));
    });
    if (!match) {
      throw new NotFoundException(
        `No row in "${tableSlug}" matches keys ${JSON.stringify(keys)}.`
      );
    }
    const value = Number(((match.cells as Record<string, unknown>) ?? {})[valueCols[0].id]);
    return {
      rowId: match.id,
      value,
      unit: valueCols[0].unit ?? "",
      source: "ratetable"
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
