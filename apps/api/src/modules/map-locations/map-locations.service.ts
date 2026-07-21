import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service";

export type MapLocationKind = "TIP" | "POI";

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

  async create(dto: CreateMapLocationDto) {
    const loc = await this.prisma.mapLocation.create({
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
        facility: dto.facility?.trim() ?? null,
        notes: dto.notes?.trim() ?? null
      }
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

    const loc = await this.prisma.mapLocation.update({
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
