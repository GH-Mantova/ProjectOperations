import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type RateSource = "legacy" | "ratetable";

export type ResolvedRate = {
  rowId: string;
  value: number;
  unit: string;
  source: RateSource;
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
