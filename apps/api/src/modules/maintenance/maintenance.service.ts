import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  MaintenanceQueryDto,
  UpdateAssetStatusDto,
  UpsertBreakdownDto,
  UpsertInspectionDto,
  UpsertMaintenanceEventDto,
  UpsertMaintenancePlanDto
} from "./dto/maintenance.dto";

const maintenanceAssetInclude = {
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
  }
} as const;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async dashboard(query: MaintenanceQueryDto) {
    const where = {
      ...(query.assetId ? { id: query.assetId } : {}),
      ...(query.status ? { status: query.status } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        include: maintenanceAssetInclude,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
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

  async listPlans() {
    return this.prisma.assetMaintenancePlan.findMany({
      orderBy: [{ nextDueAt: "asc" }, { createdAt: "desc" }],
      include: {
        asset: { select: { id: true, assetCode: true, name: true } }
      }
    });
  }

  async upsertPlan(id: string | undefined, dto: UpsertMaintenancePlanDto, actorId?: string) {
    await this.requireAsset(dto.assetId);

    const record = id
      ? await this.prisma.assetMaintenancePlan.update({
          where: { id },
          data: {
            title: dto.title,
            description: dto.description ?? null,
            intervalDays: dto.intervalDays,
            warningDays: dto.warningDays ?? 7,
            blockWhenOverdue: dto.blockWhenOverdue ?? true,
            lastCompletedAt: dto.lastCompletedAt ? new Date(dto.lastCompletedAt) : null,
            nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : null,
            status: dto.status ?? "ACTIVE"
          }
        })
      : await this.prisma.assetMaintenancePlan.create({
          data: {
            assetId: dto.assetId,
            title: dto.title,
            description: dto.description ?? null,
            intervalDays: dto.intervalDays,
            warningDays: dto.warningDays ?? 7,
            blockWhenOverdue: dto.blockWhenOverdue ?? true,
            lastCompletedAt: dto.lastCompletedAt ? new Date(dto.lastCompletedAt) : null,
            nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : null,
            status: dto.status ?? "ACTIVE"
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "maintenance.plan.update" : "maintenance.plan.create",
      entityType: "AssetMaintenancePlan",
      entityId: record.id
    });

    return record;
  }

  async upsertEvent(id: string | undefined, dto: UpsertMaintenanceEventDto, actorId?: string) {
    await this.requireAsset(dto.assetId);

    const record = id
      ? await this.prisma.assetMaintenanceEvent.update({
          where: { id },
          data: {
            maintenancePlanId: dto.maintenancePlanId ?? null,
            eventType: dto.eventType,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
            completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
            status: dto.status ?? "SCHEDULED",
            notes: dto.notes ?? null
          }
        })
      : await this.prisma.assetMaintenanceEvent.create({
          data: {
            assetId: dto.assetId,
            maintenancePlanId: dto.maintenancePlanId ?? null,
            eventType: dto.eventType,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
            completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
            status: dto.status ?? "SCHEDULED",
            notes: dto.notes ?? null
          }
        });

    if (record.maintenancePlanId && record.completedAt) {
      await this.prisma.assetMaintenancePlan.update({
        where: { id: record.maintenancePlanId },
        data: {
          lastCompletedAt: record.completedAt,
          nextDueAt: this.calculateNextDueAt(record.completedAt, await this.getPlanIntervalDays(record.maintenancePlanId))
        }
      });
    }

    await this.auditService.write({
      actorId,
      action: id ? "maintenance.event.update" : "maintenance.event.create",
      entityType: "AssetMaintenanceEvent",
      entityId: record.id
    });

    return record;
  }

  async upsertInspection(id: string | undefined, dto: UpsertInspectionDto, actorId?: string) {
    await this.requireAsset(dto.assetId);

    const record = id
      ? await this.prisma.assetInspection.update({
          where: { id },
          data: {
            inspectionType: dto.inspectionType,
            inspectedAt: new Date(dto.inspectedAt),
            status: dto.status ?? "PASS",
            notes: dto.notes ?? null
          }
        })
      : await this.prisma.assetInspection.create({
          data: {
            assetId: dto.assetId,
            inspectionType: dto.inspectionType,
            inspectedAt: new Date(dto.inspectedAt),
            status: dto.status ?? "PASS",
            notes: dto.notes ?? null
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "maintenance.inspection.update" : "maintenance.inspection.create",
      entityType: "AssetInspection",
      entityId: record.id
    });

    return record;
  }

  async upsertBreakdown(id: string | undefined, dto: UpsertBreakdownDto, actorId?: string) {
    await this.requireAsset(dto.assetId);

    const record = id
      ? await this.prisma.assetBreakdown.update({
          where: { id },
          data: {
            reportedAt: new Date(dto.reportedAt),
            resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
            severity: dto.severity ?? "MEDIUM",
            status: dto.status ?? "OPEN",
            summary: dto.summary,
            notes: dto.notes ?? null
          }
        })
      : await this.prisma.assetBreakdown.create({
          data: {
            assetId: dto.assetId,
            reportedAt: new Date(dto.reportedAt),
            resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
            severity: dto.severity ?? "MEDIUM",
            status: dto.status ?? "OPEN",
            summary: dto.summary,
            notes: dto.notes ?? null
          }
        });

    await this.auditService.write({
      actorId,
      action: id ? "maintenance.breakdown.update" : "maintenance.breakdown.create",
      entityType: "AssetBreakdown",
      entityId: record.id
    });

    return record;
  }

  async updateAssetStatus(assetId: string, dto: UpdateAssetStatusDto, actorId?: string) {
    const asset = await this.requireAsset(assetId);

    if (asset.status === dto.status) {
      throw new ConflictException("Asset already has that status.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id: assetId },
        data: {
          status: dto.status
        }
      });

      await tx.assetStatusHistory.create({
        data: {
          assetId,
          fromStatus: asset.status,
          toStatus: dto.status,
          note: dto.note ?? null
        }
      });
    });

    await this.auditService.write({
      actorId,
      action: "maintenance.asset-status.update",
      entityType: "Asset",
      entityId: assetId,
      metadata: {
        fromStatus: asset.status,
        toStatus: dto.status
      }
    });

    return this.getAssetMaintenance(assetId);
  }

  async getAssetMaintenance(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: maintenanceAssetInclude
    });

    if (!asset) {
      throw new NotFoundException("Asset not found.");
    }

    return {
      ...asset,
      maintenanceSummary: this.buildMaintenanceSummary(asset)
    };
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

  private async requireAsset(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      throw new NotFoundException("Asset not found.");
    }

    return asset;
  }

  private async getPlanIntervalDays(planId: string) {
    const plan = await this.prisma.assetMaintenancePlan.findUnique({
      where: { id: planId }
    });

    return plan?.intervalDays ?? 0;
  }

  private calculateNextDueAt(completedAt: Date, intervalDays: number) {
    const nextDueAt = new Date(completedAt);
    nextDueAt.setDate(nextDueAt.getDate() + intervalDays);
    return nextDueAt;
  }
}
