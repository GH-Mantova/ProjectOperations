import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AssetsQueryDto, UpsertAssetCategoryDto, UpsertAssetDto } from "./dto/assets.dto";

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

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listCategories() {
    return this.prisma.assetCategory.findMany({
      orderBy: { name: "asc" }
    });
  }

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

    const record = id
      ? await this.prisma.assetCategory.update({
          where: { id },
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description,
            isActive: dto.isActive ?? true
          }
        })
      : await this.prisma.assetCategory.create({
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description,
            isActive: dto.isActive ?? true
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "assets.category.update" : "assets.category.create",
      entityType: "AssetCategory",
      entityId: record.id
    });

    return record;
  }

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

  async upsertAsset(id: string | undefined, dto: UpsertAssetDto, actorId?: string) {
    const duplicate = await this.prisma.asset.findFirst({
      where: {
        OR: [
          { assetCode: dto.assetCode },
          ...(dto.serialNumber ? [{ serialNumber: dto.serialNumber }] : [])
        ],
        ...(id ? { NOT: { id } } : {})
      }
    });

    if (duplicate) {
      throw new ConflictException("Asset code or serial number already exists.");
    }

    const record = id
      ? await this.prisma.asset.update({
          where: { id },
          data: {
            assetCategoryId: dto.assetCategoryId ?? null,
            resourceTypeId: dto.resourceTypeId ?? null,
            name: dto.name,
            assetCode: dto.assetCode,
            serialNumber: dto.serialNumber ?? null,
            status: dto.status ?? "AVAILABLE",
            homeBase: dto.homeBase ?? null,
            currentLocation: dto.currentLocation ?? null,
            notes: dto.notes ?? null
          }
        })
      : await this.prisma.asset.create({
          data: {
            assetCategoryId: dto.assetCategoryId ?? null,
            resourceTypeId: dto.resourceTypeId ?? null,
            name: dto.name,
            assetCode: dto.assetCode,
            serialNumber: dto.serialNumber ?? null,
            status: dto.status ?? "AVAILABLE",
            homeBase: dto.homeBase ?? null,
            currentLocation: dto.currentLocation ?? null,
            notes: dto.notes ?? null
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "assets.update" : "assets.create",
      entityType: "Asset",
      entityId: record.id
    });

    return this.getAsset(record.id);
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
