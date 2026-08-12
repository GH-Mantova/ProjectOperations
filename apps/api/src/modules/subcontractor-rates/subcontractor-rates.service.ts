/**
 * APPEND-ONLY SUPERSEDE RULE (sot/01-charter-and-architecture.md, 2026-07-23)
 * ---------------------------------------------------------------------------
 * SubcontractorRate rows are NEVER mutated in place. The columns `rate`,
 * `unit`, and `discipline` are immutable once written. "Editing" a rate means:
 *
 *   1. Flipping the old row's `isActive` to `false` (and optionally closing its
 *      `validTo` to the day before the new rate starts).
 *   2. Creating a new row with the revised values.
 *
 * Both steps execute in a single Prisma `$transaction` so no intermediate
 * state is ever visible. There is NO raw update-in-place endpoint.
 */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IS_DISCIPLINE_CODES } from "../personas/definitions/disciplines";
import { CreateSubcontractorRateDto } from "./dto/create-subcontractor-rate.dto";
import { SupersedeSubcontractorRateDto } from "./dto/supersede-subcontractor-rate.dto";

@Injectable()
export class SubcontractorRatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private assertValidDiscipline(discipline: string): void {
    if (!(IS_DISCIPLINE_CODES as ReadonlyArray<string>).includes(discipline)) {
      throw new BadRequestException(
        `Invalid discipline "${discipline}". Must be one of: ${IS_DISCIPLINE_CODES.join(", ")}`
      );
    }
  }

  private async assertSupplierExists(subcontractorSupplierId: string): Promise<void> {
    const supplier = await this.prisma.subcontractorSupplier.findUnique({
      where: { id: subcontractorSupplierId },
      select: { id: true }
    });
    if (!supplier) {
      throw new NotFoundException(
        `SubcontractorSupplier with id "${subcontractorSupplierId}" not found.`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async list(subcontractorSupplierId: string) {
    await this.assertSupplierExists(subcontractorSupplierId);
    return this.prisma.subcontractorRate.findMany({
      where: { subcontractorSupplierId },
      orderBy: [{ discipline: "asc" }, { createdAt: "desc" }]
    });
  }

  // ---------------------------------------------------------------------------
  // Get one
  // ---------------------------------------------------------------------------

  async get(subcontractorSupplierId: string, id: string) {
    const rate = await this.prisma.subcontractorRate.findFirst({
      where: { id, subcontractorSupplierId }
    });
    if (!rate) {
      throw new NotFoundException(
        `SubcontractorRate "${id}" not found for supplier "${subcontractorSupplierId}".`
      );
    }
    return rate;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(
    subcontractorSupplierId: string,
    dto: CreateSubcontractorRateDto,
    actorId?: string
  ) {
    await this.assertSupplierExists(subcontractorSupplierId);
    this.assertValidDiscipline(dto.discipline);

    return this.prisma.subcontractorRate.create({
      data: {
        subcontractorSupplierId,
        discipline: dto.discipline,
        unit: dto.unit,
        rate: dto.rate,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        notes: dto.notes,
        isActive: dto.isActive ?? true,
        createdById: actorId,
        updatedById: actorId
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Supersede (append-only edit)
  // ---------------------------------------------------------------------------
  //
  // This is the ONLY mutation path for an existing rate. See file-header comment
  // for the rationale. Never add an in-place update endpoint.

  async supersede(
    subcontractorSupplierId: string,
    oldRateId: string,
    dto: SupersedeSubcontractorRateDto,
    actorId?: string
  ) {
    const oldRate = await this.get(subcontractorSupplierId, oldRateId);

    if (!dto.rate) {
      throw new BadRequestException("rate is required when superseding a SubcontractorRate.");
    }

    const newDiscipline = dto.discipline ?? oldRate.discipline;
    this.assertValidDiscipline(newDiscipline);

    return this.prisma.$transaction(async (tx) => {
      // Step 1: close the old row.
      await tx.subcontractorRate.update({
        where: { id: oldRateId },
        data: {
          isActive: false,
          validTo: dto.closeOldValidTo ? new Date(dto.closeOldValidTo) : oldRate.validTo,
          updatedById: actorId
        }
      });

      // Step 2: create the new row.
      return tx.subcontractorRate.create({
        data: {
          subcontractorSupplierId,
          discipline: newDiscipline,
          unit: dto.unit ?? oldRate.unit,
          rate: dto.rate,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
          validTo: dto.validTo ? new Date(dto.validTo) : undefined,
          notes: dto.notes ?? oldRate.notes,
          isActive: true,
          createdById: actorId,
          updatedById: actorId
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Deactivate (soft-delete)
  // ---------------------------------------------------------------------------

  async deactivate(subcontractorSupplierId: string, id: string, actorId?: string) {
    await this.get(subcontractorSupplierId, id);
    return this.prisma.subcontractorRate.update({
      where: { id },
      data: { isActive: false, updatedById: actorId }
    });
  }

  // ---------------------------------------------------------------------------
  // Hub view — all vendors grouped by vendor type (S1)
  // ---------------------------------------------------------------------------
  //
  // Returns an array of vendor-type groups, each containing their vendors and
  // each vendor's SubcontractorRate rows. Vendors with no vendorTypeId fall into
  // a trailing "Untyped" group.
  //
  // entityType filter: "subcontractor" | "supplier" | undefined (all).

  async hubView(entityType?: string) {
    const where =
      entityType ? { entityType, isActive: true } : { isActive: true };

    const vendors = await this.prisma.subcontractorSupplier.findMany({
      where,
      include: {
        vendorType: { select: { id: true, label: true } },
        subcontractorRates: {
          orderBy: [{ discipline: "asc" }, { createdAt: "desc" }]
        }
      },
      orderBy: { name: "asc" }
    });

    // Group by type, collecting typed vendors first, untyped last.
    const typeMap = new Map<
      string,
      { typeId: string; typeLabel: string; vendors: (typeof vendors) }
    >();
    const untyped: (typeof vendors) = [];

    for (const vendor of vendors) {
      if (vendor.vendorType) {
        const existing = typeMap.get(vendor.vendorType.id);
        if (existing) {
          existing.vendors.push(vendor);
        } else {
          typeMap.set(vendor.vendorType.id, {
            typeId: vendor.vendorType.id,
            typeLabel: vendor.vendorType.label,
            vendors: [vendor]
          });
        }
      } else {
        untyped.push(vendor);
      }
    }

    const mapVendor = (vendor: (typeof vendors)[number]) => ({
      id: vendor.id,
      name: vendor.name,
      entityType: vendor.entityType,
      rates: vendor.subcontractorRates.map((r) => ({
        id: r.id,
        discipline: r.discipline,
        unit: r.unit,
        rate: r.rate.toString(),
        validFrom: r.validFrom ? r.validFrom.toISOString().slice(0, 10) : null,
        validTo: r.validTo ? r.validTo.toISOString().slice(0, 10) : null,
        isActive: r.isActive
      }))
    });

    type HubGroup = {
      typeId: string | null;
      typeLabel: string;
      vendors: ReturnType<typeof mapVendor>[];
    };

    const groups: HubGroup[] = Array.from(typeMap.values()).map((group) => ({
      typeId: group.typeId,
      typeLabel: group.typeLabel,
      vendors: group.vendors.map(mapVendor)
    }));

    if (untyped.length > 0) {
      groups.push({
        typeId: null,
        typeLabel: "Untyped",
        vendors: untyped.map(mapVendor)
      });
    }

    return groups;
  }
}
