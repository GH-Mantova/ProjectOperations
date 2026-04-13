import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateDashboardDto, UpdateDashboardDto } from "./dto/create-dashboard.dto";

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(actorId?: string) {
    const roleIds = actorId ? await this.getRoleIds(actorId) : [];

    const dashboards = await this.prisma.dashboard.findMany({
      where: actorId
        ? {
            OR: [
              { scope: "GLOBAL" },
              { ownerUserId: actorId },
              { ownerRoleId: { in: roleIds } }
            ]
          }
        : undefined,
      include: {
        ownerRole: true,
        widgets: {
          orderBy: { position: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });

    return Promise.all(
      dashboards.map(async (dashboard) => ({
        ...dashboard,
        render: await this.renderDashboardSummary(dashboard.widgets)
      }))
    );
  }

  async create(input: CreateDashboardDto, actorId?: string) {
    const dashboard = await this.prisma.$transaction((tx) =>
      this.upsertDashboard(tx, undefined, input, actorId)
    );

    await this.auditService.write({
      actorId,
      action: "dashboards.create",
      entityType: "Dashboard",
      entityId: dashboard.id,
      metadata: { scope: dashboard.scope }
    });

    return dashboard;
  }

  async update(id: string, input: UpdateDashboardDto, actorId?: string) {
    await this.requireDashboard(id);

    const dashboard = await this.prisma.$transaction((tx) =>
      this.upsertDashboard(tx, id, input, actorId)
    );

    await this.auditService.write({
      actorId,
      action: "dashboards.update",
      entityType: "Dashboard",
      entityId: dashboard.id,
      metadata: { scope: dashboard.scope }
    });

    return dashboard;
  }

  async render(id: string, actorId?: string) {
    const dashboard = await this.requireDashboard(id);
    const roleIds = actorId ? await this.getRoleIds(actorId) : [];

    if (
      actorId &&
      dashboard.scope !== "GLOBAL" &&
      dashboard.ownerUserId !== actorId &&
      (!dashboard.ownerRoleId || !roleIds.includes(dashboard.ownerRoleId))
    ) {
      throw new NotFoundException("Dashboard not found.");
    }

    return {
      ...dashboard,
      widgets: await Promise.all(
        dashboard.widgets.map(async (widget) => ({
          ...widget,
          data: await this.renderWidget(widget)
        }))
      )
    };
  }

  private async upsertDashboard(
    tx: Prisma.TransactionClient | PrismaClient,
    id: string | undefined,
    input: CreateDashboardDto,
    actorId?: string
  ) {
    const dashboard = id
      ? await tx.dashboard.update({
          where: { id },
          data: {
            name: input.name,
            description: input.description,
            scope: input.scope,
            ownerRoleId: input.scope === "ROLE" ? input.ownerRoleId ?? null : null,
            ownerUserId: input.scope === "USER" ? actorId ?? null : null,
            isDefault: input.isDefault ?? false
          }
        })
      : await tx.dashboard.create({
          data: {
            name: input.name,
            description: input.description,
            scope: input.scope,
            ownerRoleId: input.scope === "ROLE" ? input.ownerRoleId ?? null : null,
            ownerUserId: input.scope === "USER" ? actorId ?? null : null,
            isDefault: input.isDefault ?? false
          }
        });

    await tx.dashboardWidget.deleteMany({
      where: { dashboardId: dashboard.id }
    });

    if (input.widgets?.length) {
      await tx.dashboardWidget.createMany({
        data: input.widgets.map((widget, index) => ({
          dashboardId: dashboard.id,
          type: widget.type,
          title: widget.title,
          description: widget.description,
          position: widget.position ?? index,
          width: widget.width ?? 1,
          height: widget.height ?? 1,
          config: widget.config as Prisma.InputJsonValue | undefined
        }))
      });
    }

    return tx.dashboard.findUniqueOrThrow({
      where: { id: dashboard.id },
      include: {
        ownerRole: true,
        widgets: {
          orderBy: { position: "asc" }
        }
      }
    });
  }

  private async requireDashboard(id: string) {
    const dashboard = await this.prisma.dashboard.findUnique({
      where: { id },
      include: {
        ownerRole: true,
        widgets: {
          orderBy: { position: "asc" }
        }
      }
    });

    if (!dashboard) {
      throw new NotFoundException("Dashboard not found.");
    }

    return dashboard;
  }

  private async getRoleIds(userId: string) {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true }
    });

    return roles.map((role) => role.roleId);
  }

  private async renderDashboardSummary(
    widgets: Array<{ type: string; config: Prisma.JsonValue | null }>
  ) {
    return Promise.all(
      widgets.map(async (widget) => ({
        type: widget.type,
        data: await this.renderWidget(widget)
      }))
    );
  }

  private async renderWidget(widget: { type: string; config: Prisma.JsonValue | null }) {
    const config = (widget.config ?? {}) as Record<string, unknown>;
    const metricKey = String(config.metricKey ?? "");

    switch (widget.type) {
      case "kpi":
        return this.renderKpi(metricKey);
      case "chart":
        return this.renderChart(metricKey);
      case "table":
        return this.renderTable(metricKey);
      default:
        return { kind: "unsupported", metricKey };
    }
  }

  private async renderKpi(metricKey: string) {
    switch (metricKey) {
      case "tender.pipeline":
        return {
          kind: "kpi",
          metricKey,
          value: await this.prisma.tender.count({
            where: { status: { in: ["DRAFT", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"] } }
          })
        };
      case "jobs.active":
        return {
          kind: "kpi",
          metricKey,
          value: await this.prisma.job.count({
            where: { status: "ACTIVE" }
          })
        };
      case "resources.utilization":
        return {
          kind: "kpi",
          metricKey,
          value: await this.prisma.shiftWorkerAssignment.count()
        };
      case "maintenance.due":
        return {
          kind: "kpi",
          metricKey,
          value: await this.prisma.assetMaintenancePlan.count({
            where: {
              status: "ACTIVE",
              nextDueAt: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
            }
          })
        };
      case "forms.overdue":
        return {
          kind: "kpi",
          metricKey,
          value: await this.prisma.formSubmission.count({
            where: {
              status: { in: ["SUBMITTED", "PENDING_REVIEW"] }
            }
          })
        };
      case "scheduler.conflicts":
      default:
        return {
          kind: "kpi",
          metricKey: metricKey || "scheduler.conflicts",
          value: await this.prisma.schedulingConflict.count({
            where: { severity: { in: ["RED", "AMBER"] } }
          })
        };
    }
  }

  private async renderChart(metricKey: string) {
    switch (metricKey) {
      case "jobs.byStatus": {
        const rows = await this.prisma.job.groupBy({
          by: ["status"],
          _count: { _all: true }
        });
        return {
          kind: "chart",
          metricKey,
          points: rows.map((row) => ({ label: row.status, value: row._count._all }))
        };
      }
      case "tenders.byStatus":
      default: {
        const rows = await this.prisma.tender.groupBy({
          by: ["status"],
          _count: { _all: true }
        });
        return {
          kind: "chart",
          metricKey: metricKey || "tenders.byStatus",
          points: rows.map((row) => ({ label: row.status, value: row._count._all }))
        };
      }
    }
  }

  private async renderTable(metricKey: string) {
    switch (metricKey) {
      case "maintenance.dueList": {
        const rows = await this.prisma.assetMaintenancePlan.findMany({
          where: {
            status: "ACTIVE",
            nextDueAt: { not: null }
          },
          include: {
            asset: true
          },
          orderBy: { nextDueAt: "asc" },
          take: 5
        });
        return {
          kind: "table",
          metricKey,
          columns: ["Asset", "Plan", "Due"],
          rows: rows.map((row) => [
            `${row.asset.assetCode} - ${row.asset.name}`,
            row.title,
            row.nextDueAt?.toISOString() ?? ""
          ])
        };
      }
      case "scheduler.summary":
      default: {
        const rows = await this.prisma.shift.findMany({
          include: {
            job: true,
            conflicts: true,
            workerAssignments: true,
            assetAssignments: true
          },
          orderBy: { startAt: "asc" },
          take: 5
        });
        return {
          kind: "table",
          metricKey: metricKey || "scheduler.summary",
          columns: ["Shift", "Job", "Workers", "Assets", "Conflicts"],
          rows: rows.map((row) => [
            row.title,
            row.job.jobNumber,
            String(row.workerAssignments.length),
            String(row.assetAssignments.length),
            String(row.conflicts.length)
          ])
        };
      }
    }
  }
}
