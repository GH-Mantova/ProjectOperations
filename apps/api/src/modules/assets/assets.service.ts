import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AssetsQueryDto, CheckinAssetDto, CheckoutAssetDto, UpsertAssetCategoryDto, UpsertAssetDto } from "./dto/assets.dto";

const assetInclude = {
  category: true,
  resourceType: true,
  maintenancePlans: {
    orderBy: { createdAt: "desc" }
  },
  maintenanceEvents: {
    orderBy: { createdAt: "desc" }
  },
  inspections: {
    orderBy: { inspectedAt: "desc" }
  },
  breakdowns: {
    orderBy: { reportedAt: "desc" }
  },
  statusHistory: {
    orderBy: { changedAt: "desc" }
  },
  shiftAssignments: {
    include: {
      shift: {
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              name: true,
              status: true
            }
          }
        }
      }
    },
    orderBy: {
      assignedAt: "desc"
    }
  }
} as const;

/** Include shape for AssetCheckout records returned to callers. */
const checkoutInclude = {
  holderWorker: {
    select: { id: true, firstName: true, lastName: true }
  },
  holderUser: {
    select: { id: true, firstName: true, lastName: true, email: true }
  },
  site: {
    select: { id: true, name: true }
  },
  job: {
    select: { id: true, jobNumber: true, name: true }
  }
} as const;

/**
 * Business logic for assets and asset categories (Module 11).
 *
 * Enforces uniqueness of category names and asset codes/serial numbers,
 * writes an audit entry on every create/update, and derives a per-asset
 * maintenance summary (COMPLIANT / DUE_SOON / OVERDUE / IN_MAINTENANCE /
 * UNAVAILABLE) plus a scheduler impact (NONE / WARN / BLOCK) from active
 * maintenance plans, open breakdowns, failed inspections, and asset status.
 *
 * Also provides checkout/checkin custody tracking and barcode/QR scan lookup
 * (AssetTiger parity), retiring the Jotform "Grice Office Key Checkout" form.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * List all asset categories ordered by name ascending.
   *
   * @returns every AssetCategory record, active or not
   */
  async listCategories() {
    return this.prisma.assetCategory.findMany({
      orderBy: { name: "asc" }
    });
  }

  /**
   * Create (id undefined) or update (id given) an asset category.
   *
   * Writes an `assets.category.create` / `assets.category.update` audit
   * entry after the database write.
   *
   * @param id - existing category id, or undefined to create
   * @param dto - category fields; isActive defaults to true
   * @param actorId - acting user id recorded in the audit entry
   * @returns the created or updated category record
   * @throws ConflictException when another category already has the same name
   */
  async upsertCategory(id: string | undefined, dto: UpsertAssetCategoryDto, actorId?: string) {
    const existing = await this.prisma.assetCategory.findFirst({
      where: {
        name: dto.name,
        ...(id ? { NOT: { id } } : {})
      }
    });

    if (existing) {
      throw new ConflictException("Asset category with that name already exists.");
    }

    const categoryData = {
      name: dto.name,
      code: dto.code,
      description: dto.description,
      isActive: dto.isActive ?? true,
      defaultFuelConsumptionLPer100km: dto.defaultFuelConsumptionLPer100km ?? null,
      defaultNominalLoadTonnes: dto.defaultNominalLoadTonnes ?? null
    };
    const record = id
      ? await this.prisma.assetCategory.update({
          where: { id },
          data: categoryData
        })
      : await this.prisma.assetCategory.create({
          data: categoryData
        });

    await this.auditService.write({
      actorId,
      action: id ? "assets.category.update" : "assets.category.create",
      entityType: "AssetCategory",
      entityId: record.id
    });

    return record;
  }

  /**
   * List assets with full related data, filtered and paginated.
   *
   * Free-text `q` matches name, assetCode, serialNumber, homeBase, or
   * currentLocation (case-insensitive). Each item is enriched with a
   * derived maintenanceSummary.
   *
   * @param query - q / categoryId / status filters plus page and pageSize
   * @returns { items, total, page, pageSize }
   */
  async listAssets(query: AssetsQueryDto) {
    const where: Prisma.AssetWhereInput = {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { assetCode: { contains: query.q, mode: "insensitive" } },
              { serialNumber: { contains: query.q, mode: "insensitive" } },
              { homeBase: { contains: query.q, mode: "insensitive" } },
              { currentLocation: { contains: query.q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.categoryId ? { assetCategoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {})
    };

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        include: assetInclude,
        orderBy: [{ name: "asc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.asset.count({ where })
    ]);

    return {
      items: items.map((asset) => ({
        ...asset,
        maintenanceSummary: this.buildMaintenanceSummary(asset)
      })),
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  /**
   * Get a single asset with maintenance, inspection, breakdown, and shift
   * assignment history.
   *
   * Adds linkedJobs (deduplicated from shift assignments), a derived
   * maintenanceSummary, and DocumentLink records linked to the asset.
   *
   * @param id - asset id
   * @returns the asset with linkedJobs, maintenanceSummary, and documents
   * @throws NotFoundException when the asset does not exist
   */
  async getAsset(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: assetInclude
    });

    if (!asset) {
      throw new NotFoundException("Asset not found.");
    }

    const jobs = new Map<string, { id: string; jobNumber: string; name: string; status: string }>();
    asset.shiftAssignments.forEach((assignment) => {
      const job = assignment.shift.job;
      jobs.set(job.id, job);
    });

    const documents = await this.prisma.documentLink.findMany({
      where: {
        linkedEntityType: "Asset",
        linkedEntityId: id
      },
      include: {
        fileLink: true,
        tags: true
      },
      orderBy: { createdAt: "desc" }
    });

    return {
      ...asset,
      linkedJobs: [...jobs.values()],
      maintenanceSummary: this.buildMaintenanceSummary(asset),
      documents
    };
  }

  /**
   * Create (id undefined) or update (id given) an asset.
   *
   * Rejects duplicate assetCode, serialNumber, barcode, or qrValue across
   * other assets. Writes an `assets.create` / `assets.update` audit entry.
   * Status defaults to AVAILABLE when omitted.
   *
   * @param id - existing asset id, or undefined to create
   * @param dto - asset fields
   * @param actorId - acting user id recorded in the audit entry
   * @returns the full asset detail (same shape as getAsset)
   * @throws ConflictException when assetCode, serialNumber, barcode, or qrValue clashes
   */
  async upsertAsset(id: string | undefined, dto: UpsertAssetDto, actorId?: string) {
    const orClauses: Prisma.AssetWhereInput[] = [{ assetCode: dto.assetCode }];
    if (dto.serialNumber) orClauses.push({ serialNumber: dto.serialNumber });
    if (dto.barcode) orClauses.push({ barcode: dto.barcode });
    if (dto.qrValue) orClauses.push({ qrValue: dto.qrValue });

    const duplicate = await this.prisma.asset.findFirst({
      where: {
        OR: orClauses,
        ...(id ? { NOT: { id } } : {})
      }
    });

    if (duplicate) {
      throw new ConflictException("Asset code, serial number, barcode, or QR value already exists.");
    }

    const assetData = {
      assetCategoryId: dto.assetCategoryId ?? null,
      resourceTypeId: dto.resourceTypeId ?? null,
      name: dto.name,
      assetCode: dto.assetCode,
      serialNumber: dto.serialNumber ?? null,
      barcode: dto.barcode ?? null,
      qrValue: dto.qrValue ?? null,
      status: dto.status ?? "AVAILABLE",
      homeBase: dto.homeBase ?? null,
      currentLocation: dto.currentLocation ?? null,
      notes: dto.notes ?? null,
      fuelConsumptionLPer100km: dto.fuelConsumptionLPer100km ?? null,
      nominalLoadTonnes: dto.nominalLoadTonnes ?? null
    };
    const record = id
      ? await this.prisma.asset.update({
          where: { id },
          data: assetData
        })
      : await this.prisma.asset.create({
          data: assetData
        });

    await this.auditService.write({
      actorId,
      action: id ? "assets.update" : "assets.create",
      entityType: "Asset",
      entityId: record.id
    });

    return this.getAsset(record.id);
  }

  // ---------------------------------------------------------------------------
  // Checkout / check-in (custody chain)
  // ---------------------------------------------------------------------------

  /**
   * Check out an asset to a holder (worker, user, site, or job).
   *
   * Enforces the "at most one open checkout per asset" invariant: if any
   * AssetCheckout row for this asset has checkedInAt IS NULL, the request is
   * rejected with 409. Prisma cannot enforce partial uniqueness portably on
   * NULL columns, so the guard lives here.
   *
   * @param assetId - asset to check out
   * @param dto - holder identifiers and optional due-back date / notes
   * @param actorId - acting user for the audit log
   * @returns the created AssetCheckout record with holder details
   * @throws NotFoundException when the asset does not exist
   * @throws ConflictException when the asset already has an open checkout
   */
  async checkoutAsset(assetId: string, dto: CheckoutAssetDto, actorId?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
    if (!asset) throw new NotFoundException("Asset not found.");

    // Service-layer guard: at most one open checkout per asset.
    const openCheckout = await this.prisma.assetCheckout.findFirst({
      where: { assetId, checkedInAt: null }
    });
    if (openCheckout) {
      throw new ConflictException("Asset already has an open checkout — check it in first.");
    }

    const record = await this.prisma.assetCheckout.create({
      data: {
        assetId,
        holderWorkerId: dto.holderWorkerId ?? null,
        holderUserId: dto.holderUserId ?? null,
        siteId: dto.siteId ?? null,
        jobId: dto.jobId ?? null,
        dueBackAt: dto.dueBackAt ? new Date(dto.dueBackAt) : null,
        notes: dto.notes ?? null
      },
      include: checkoutInclude
    });

    await this.auditService.write({
      actorId,
      action: "assets.checkout",
      entityType: "AssetCheckout",
      entityId: record.id,
      metadata: { assetId }
    });

    return record;
  }

  /**
   * Check in an asset (close the open checkout for this asset).
   *
   * Sets checkedInAt to now on the most recent open checkout. Optionally
   * appends check-in notes (appended to any existing checkout notes with " | ").
   *
   * @param assetId - asset to check in
   * @param dto - optional notes recorded on return
   * @param actorId - acting user for the audit log
   * @returns the updated AssetCheckout record
   * @throws NotFoundException when the asset doesn't exist or has no open checkout
   */
  async checkinAsset(assetId: string, dto: CheckinAssetDto, actorId?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
    if (!asset) throw new NotFoundException("Asset not found.");

    const openCheckout = await this.prisma.assetCheckout.findFirst({
      where: { assetId, checkedInAt: null },
      orderBy: { checkedOutAt: "desc" }
    });
    if (!openCheckout) {
      throw new NotFoundException("No open checkout found for this asset.");
    }

    // Append check-in notes to existing notes if both are present.
    let notes = openCheckout.notes ?? null;
    if (dto.notes) {
      notes = notes ? `${notes} | ${dto.notes}` : dto.notes;
    }

    const record = await this.prisma.assetCheckout.update({
      where: { id: openCheckout.id },
      data: { checkedInAt: new Date(), notes },
      include: checkoutInclude
    });

    await this.auditService.write({
      actorId,
      action: "assets.checkin",
      entityType: "AssetCheckout",
      entityId: record.id,
      metadata: { assetId }
    });

    return record;
  }

  /**
   * List custody history for an asset, newest first.
   *
   * @param assetId - asset id
   * @returns all AssetCheckout records with holder details, newest first
   * @throws NotFoundException when the asset does not exist
   */
  async listCheckouts(assetId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
    if (!asset) throw new NotFoundException("Asset not found.");

    return this.prisma.assetCheckout.findMany({
      where: { assetId },
      include: checkoutInclude,
      orderBy: { checkedOutAt: "desc" }
    });
  }

  // ---------------------------------------------------------------------------
  // Barcode / QR scan lookup
  // ---------------------------------------------------------------------------

  /**
   * Look up an asset by barcode, QR value, or asset code.
   *
   * Matches Asset.barcode OR Asset.qrValue OR (fallback) Asset.assetCode.
   * Designed for scanner integrations — the caller does not need to know which
   * field the scanned value maps to.
   *
   * @param code - scanned value (barcode string, QR payload, or asset code)
   * @returns the matched asset with full detail (same shape as getAsset)
   * @throws NotFoundException when no asset matches the scanned code
   */
  async scanAsset(code: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        OR: [{ barcode: code }, { qrValue: code }, { assetCode: code }]
      },
      select: { id: true }
    });

    if (!asset) {
      throw new NotFoundException(`No asset found for scan code "${code}".`);
    }

    return this.getAsset(asset.id);
  }

  private buildMaintenanceSummary(asset: {
    status: string;
    maintenancePlans: Array<{ nextDueAt: Date | null; warningDays: number; blockWhenOverdue: boolean; status: string }>;
    inspections: Array<{ status: string }>;
    breakdowns: Array<{ status: string }>;
  }) {
    const now = new Date();
    const openBreakdown = asset.breakdowns.some((breakdown) => breakdown.status !== "RESOLVED");
    const failedInspection = asset.inspections.some((inspection) => inspection.status === "FAIL");

    let maintenanceState = "COMPLIANT";
    let schedulerImpact = "NONE";

    for (const plan of asset.maintenancePlans.filter((item) => item.status === "ACTIVE" && item.nextDueAt)) {
      if (!plan.nextDueAt) continue;

      if (plan.nextDueAt < now) {
        maintenanceState = "OVERDUE";
        schedulerImpact = plan.blockWhenOverdue ? "BLOCK" : "WARN";
        break;
      }

      const warningAt = new Date(plan.nextDueAt);
      warningAt.setDate(warningAt.getDate() - plan.warningDays);
      if (warningAt <= now && maintenanceState !== "OVERDUE") {
        maintenanceState = "DUE_SOON";
        schedulerImpact = "WARN";
      }
    }

    if (openBreakdown || failedInspection || asset.status === "OUT_OF_SERVICE") {
      maintenanceState = "UNAVAILABLE";
      schedulerImpact = "BLOCK";
    } else if (asset.status === "MAINTENANCE" && schedulerImpact !== "BLOCK") {
      maintenanceState = "IN_MAINTENANCE";
      schedulerImpact = "WARN";
    }

    return {
      maintenanceState,
      schedulerImpact,
      openBreakdown,
      failedInspection
    };
  }
}
