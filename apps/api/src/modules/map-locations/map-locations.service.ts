import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service";

export type MapLocationKind = "TIP" | "POI";

// ---------------------------------------------------------------------------
// TIP-ID-S2 — keeping the waste rate rows' mapLocationId true
// ---------------------------------------------------------------------------
// TIP-ID-S1 gave the waste rate rows a mapLocationId cell; the one-off
// backfill (scripts/rates/backfill-waste-map-location-ids.mjs) fills the rows
// that already exist. These constants are the second half: when a TIP's
// facility is set through this admin path, the matching rate rows are linked
// in the same transaction, so the backfill does not rot the first time
// somebody adds a facility.
//
// RateRow.cells is keyed by RateColumn id — see the baseline migration
// 20260713140000_seed_baseline_rate_tables, which writes
// {"rt-wst-t-c-facility":"BMI Acacia Ridge", ...}, and upsertTable in
// seed-initial-services.ts, which rewrites every key to `${tableId}-c-${key}`.
// The bare `facility` / `mapLocationId` spellings are only a fallback for rows
// written by something else; the bare alias is also what S1's
// resolveWasteFacility() reads, so it is written alongside the canonical key.
const WASTE_TABLE_SLUGS = ["waste-per-tonne", "waste-per-m3"];
const FACILITY_COLUMN_NAME = "Facility";
const MAP_LOCATION_COLUMN_NAME = "Map location";
const MAP_LOCATION_ALIAS_KEY = "mapLocationId";

export type CreateMapLocationDto = {
  name: string;
  kind: MapLocationKind;
  categoryId?: string | null;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude?: number | null;
  longitude?: number | null;
  facility?: string | null;
  notes?: string | null;
};

export type UpdateMapLocationDto = Partial<CreateMapLocationDto> & {
  isActive?: boolean;
};

type RawLocation = {
  id: string;
  name: string;
  kind: MapLocationKind;
  categoryId: string | null;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: Decimal | null;
  longitude: Decimal | null;
  facility: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(loc: RawLocation, ratesStatus?: "set" | "needed") {
  return {
    id: loc.id,
    name: loc.name,
    kind: loc.kind,
    categoryId: loc.categoryId,
    addressLine1: loc.addressLine1,
    suburb: loc.suburb,
    state: loc.state,
    postcode: loc.postcode,
    latitude: loc.latitude !== null ? Number(loc.latitude) : null,
    longitude: loc.longitude !== null ? Number(loc.longitude) : null,
    facility: loc.facility,
    notes: loc.notes,
    isActive: loc.isActive,
    createdAt: loc.createdAt,
    updatedAt: loc.updatedAt,
    ...(ratesStatus !== undefined ? { ratesStatus } : {})
  };
}

@Injectable()
export class MapLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kind?: MapLocationKind) {
    const where = kind ? { kind, isActive: true } : { isActive: true };
    const locs = await this.prisma.mapLocation.findMany({
      where,
      orderBy: [{ kind: "asc" }, { name: "asc" }]
    });

    // For TIPs we derive ratesStatus from EstimateWasteRate count
    const tipFacilities = locs
      .filter((l) => l.kind === "TIP" && l.facility)
      .map((l) => l.facility as string);

    const facilitiesWithRates = new Set<string>();
    if (tipFacilities.length > 0) {
      const rates = await this.prisma.estimateWasteRate.findMany({
        where: { facility: { in: tipFacilities } },
        select: { facility: true },
        distinct: ["facility"]
      });
      for (const r of rates) {
        facilitiesWithRates.add(r.facility);
      }
    }

    return locs.map((loc) => {
      if (loc.kind === "TIP") {
        const status: "set" | "needed" =
          loc.facility && facilitiesWithRates.has(loc.facility) ? "set" : "needed";
        return toDto(loc as RawLocation, status);
      }
      return toDto(loc as RawLocation);
    });
  }

  async findOne(id: string) {
    const loc = await this.prisma.mapLocation.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException(`MapLocation ${id} not found.`);

    if (loc.kind === "TIP" && loc.facility) {
      const count = await this.prisma.estimateWasteRate.count({
        where: { facility: loc.facility }
      });
      return toDto(loc as RawLocation, count > 0 ? "set" : "needed");
    }
    return toDto(loc as RawLocation);
  }

  /**
   * TIP-ID-S2 — write `mapLocationId` onto every waste rate row whose facility
   * cell equals `facility` exactly (both trimmed).
   *
   * The rules are deliberately the same as the backfill script's
   * (scripts/rates/backfill-waste-map-location-ids.mjs), so the one-off and the
   * ongoing path can never disagree about what a link means:
   *
   *   - Exact, trimmed match only. No case folding, no punctuation stripping,
   *     no fuzzy matching. A near miss is left unlinked, never guessed at.
   *   - A row already carrying a DIFFERENT non-null id is left exactly as it
   *     is. A stale link is evidence (S1's resolveWasteFacility surfaces it as
   *     `dangling`); silently re-pointing it would destroy that evidence. The
   *     backfill script's `--force` is the deliberate instrument for a
   *     re-decision.
   *   - Every other cell is copied through untouched and no cell key is ever
   *     removed; no row is created or deleted; EstimateWasteRate — which still
   *     prices every job — is not touched at all.
   *
   * @returns the number of rate rows actually updated.
   */
  private async linkWasteRatesToTip(
    tx: Prisma.TransactionClient,
    mapLocationId: string,
    facility: string
  ): Promise<number> {
    const wanted = facility.trim();
    if (wanted === "") return 0;

    const tables = await tx.rateTable.findMany({
      where: { slug: { in: WASTE_TABLE_SLUGS } },
      include: { columns: true, rows: true }
    });

    let written = 0;
    for (const table of tables) {
      const facilityCol = table.columns.find((c) => c.name === FACILITY_COLUMN_NAME);
      const mapCol = table.columns.find((c) => c.name === MAP_LOCATION_COLUMN_NAME);

      const facilityKeys = [
        facilityCol?.id,
        `${table.id}-c-facility`,
        "facility",
        "Facility"
      ].filter((k): k is string => typeof k === "string");

      const primaryKey = mapCol ? mapCol.id : `${table.id}-c-mapLocationId`;
      const targetKeys =
        primaryKey === MAP_LOCATION_ALIAS_KEY ? [primaryKey] : [primaryKey, MAP_LOCATION_ALIAS_KEY];

      for (const row of table.rows) {
        const cells = { ...((row.cells ?? {}) as Record<string, unknown>) };
        const key = facilityKeys.find((k) =>
          Object.prototype.hasOwnProperty.call(cells, k)
        );
        if (key === undefined) continue;

        const value = cells[key];
        if (typeof value !== "string" || value.trim() !== wanted) continue;

        const existing = targetKeys.map((k) => {
          const v = cells[k];
          return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
        });
        // Stale link to some other location — leave it alone and report nothing
        // silently changed. Already correct — nothing to do.
        if (existing.some((v) => v !== null && v !== mapLocationId)) continue;
        if (existing.every((v) => v === mapLocationId)) continue;

        for (const k of targetKeys) cells[k] = mapLocationId;
        await tx.rateRow.update({
          where: { id: row.id },
          data: { cells: cells as Prisma.InputJsonValue }
        });
        written += 1;
      }
    }

    return written;
  }

  async create(dto: CreateMapLocationDto) {
    const facility = dto.facility?.trim() ?? null;
    const loc = await this.prisma.$transaction(async (tx) => {
      const created = await tx.mapLocation.create({
        data: {
          name: dto.name.trim(),
          kind: dto.kind,
          categoryId: dto.categoryId ?? null,
          addressLine1: dto.addressLine1.trim(),
          suburb: dto.suburb.trim(),
          state: dto.state.trim(),
          postcode: dto.postcode.trim(),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          facility,
          notes: dto.notes?.trim() ?? null
        }
      });
      // A new TIP that names a facility adopts the rate rows that already use
      // that exact string, in the same transaction as the create.
      if (created.kind === "TIP" && facility) {
        await this.linkWasteRatesToTip(tx, created.id, facility);
      }
      return created;
    });
    return toDto(loc as RawLocation);
  }

  async update(id: string, dto: UpdateMapLocationDto) {
    const existing = await this.prisma.mapLocation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`MapLocation ${id} not found.`);

    // Rename guard: if a TIP's facility is being changed AND rate rows exist
    // for the old facility string, block with 409. The join is by string so
    // renaming breaks the link silently — we refuse the change instead.
    const newFacility = dto.facility !== undefined ? dto.facility?.trim() ?? null : undefined;
    if (
      existing.kind === "TIP" &&
      newFacility !== undefined &&
      newFacility !== existing.facility
    ) {
      const oldFacility = existing.facility;
      if (oldFacility) {
        const rateCount = await this.prisma.estimateWasteRate.count({
          where: { facility: oldFacility }
        });
        if (rateCount > 0) {
          throw new ConflictException(
            `Cannot rename facility from "${oldFacility}": ${rateCount} waste rate row(s) reference it by string. ` +
              `Update those rates first or create a new TIP location.`
          );
        }
      }
    }

    // TIP-ID-S2: the update and the rate-row link happen in ONE transaction, so
    // a MapLocation can never be saved with a facility the rate rows do not
    // know about (or vice versa).
    const loc = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mapLocation.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          kind: dto.kind,
          categoryId: dto.categoryId !== undefined ? (dto.categoryId ?? null) : undefined,
          addressLine1:
            dto.addressLine1 !== undefined ? dto.addressLine1.trim() : undefined,
          suburb: dto.suburb !== undefined ? dto.suburb.trim() : undefined,
          state: dto.state !== undefined ? dto.state.trim() : undefined,
          postcode: dto.postcode !== undefined ? dto.postcode.trim() : undefined,
          latitude: dto.latitude !== undefined ? (dto.latitude ?? null) : undefined,
          longitude: dto.longitude !== undefined ? (dto.longitude ?? null) : undefined,
          facility: newFacility !== undefined ? newFacility : undefined,
          notes: dto.notes !== undefined ? (dto.notes?.trim() ?? null) : undefined,
          isActive: dto.isActive
        }
      });

      // Only when a TIP's facility was actually supplied on this request, and
      // resolved to a non-empty string. A POI links nothing; clearing a
      // facility (null) links nothing and unlinks nothing — an existing id on a
      // rate row is data, and removing it is not this path's decision.
      const effectiveKind = dto.kind ?? existing.kind;
      if (effectiveKind === "TIP" && newFacility) {
        await this.linkWasteRatesToTip(tx, updated.id, newFacility);
      }
      return updated;
    });
    return toDto(loc as RawLocation);
  }

  async remove(id: string) {
    const existing = await this.prisma.mapLocation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`MapLocation ${id} not found.`);
    // Soft delete via isActive flag
    await this.prisma.mapLocation.update({ where: { id }, data: { isActive: false } });
    return { deleted: id };
  }

  async orphanFacilities(): Promise<string[]> {
    // Returns DISTINCT EstimateWasteRate.facility values that do NOT yet have
    // a MapLocation with matching facility field.
    const allRateFacilities = await this.prisma.estimateWasteRate.findMany({
      select: { facility: true },
      distinct: ["facility"],
      orderBy: { facility: "asc" }
    });

    const existingFacilities = await this.prisma.mapLocation.findMany({
      where: { facility: { not: null }, kind: "TIP" },
      select: { facility: true },
      distinct: ["facility"]
    });

    const covered = new Set(existingFacilities.map((l) => l.facility as string));
    return allRateFacilities
      .map((r) => r.facility)
      .filter((f) => !covered.has(f))
      .sort();
  }
}
