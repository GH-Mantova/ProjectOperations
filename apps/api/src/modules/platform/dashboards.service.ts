import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateDashboardDto, UpdateDashboardDto } from "./dto/create-dashboard.dto";

type WidgetInput = {
  type: string;
  title: string;
  config: Prisma.JsonValue | null;
};

type DataPoint = { label: string; value: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  private async renderDashboardSummary(widgets: WidgetInput[]) {
    return Promise.all(
      widgets.map(async (widget) => ({
        type: widget.type,
        data: await this.renderWidget(widget)
      }))
    );
  }

  private async renderWidget(widget: WidgetInput) {
    const config = (widget.config ?? {}) as Record<string, unknown>;
    const metricKey = String(config.metric ?? config.metricKey ?? "");
    const chartKey = String(config.chart ?? "");

    switch (widget.type) {
      case "kpi":
        return this.renderKpi(widget.title, metricKey, config);
      case "bar_chart":
        return this.renderBarChart(widget.title, chartKey || metricKey, config);
      case "line_chart":
        return this.renderLineChart(widget.title, chartKey || metricKey, config);
      case "donut_chart":
        return this.renderDonutChart(widget.title, chartKey || metricKey, config);
      case "chart":
        return this.renderLegacyChart(widget.title, metricKey);
      case "table":
        return this.renderTable(widget.title, metricKey);
      default:
        return { type: "unsupported", title: widget.title, metricKey };
    }
  }

  private async renderKpi(title: string, metricKey: string, config: Record<string, unknown>) {
    const trend = typeof config.trend === "string" ? config.trend : undefined;
    const trendValue = typeof config.trendValue === "string" ? config.trendValue : undefined;

    switch (metricKey) {
      case "tender.pipeline":
      case "tenders.pipeline":
        return this.kpiResult(title, metricKey, await this.prisma.tender.count({
          where: { status: { in: ["DRAFT", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"] } }
        }), trend, trendValue);
      case "tenders.pipelineValue": {
        const tenders = await this.prisma.tender.findMany({
          where: { status: { in: ["IN_PROGRESS", "SUBMITTED"] } },
          select: { estimatedValue: true }
        });
        const total = tenders.reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0), 0);
        return this.kpiResult(title, metricKey, this.formatCurrency(total), trend, trendValue);
      }
      case "jobs.active":
        return this.kpiResult(title, metricKey, await this.prisma.job.count({
          where: { status: "ACTIVE" }
        }), trend, trendValue);
      case "jobs.issuesOpen":
        return this.kpiResult(title, metricKey, await this.prisma.jobIssue.count({
          where: { status: "OPEN" }
        }), trend, trendValue);
      case "resources.utilization":
        return this.kpiResult(title, metricKey, await this.prisma.shiftWorkerAssignment.count(), trend, trendValue);
      case "maintenance.due":
        return this.kpiResult(title, metricKey, await this.prisma.assetMaintenancePlan.count({
          where: {
            status: "ACTIVE",
            nextDueAt: { lte: new Date(Date.now() + 7 * MS_PER_DAY) }
          }
        }), trend, trendValue);
      case "maintenance.dueSoon":
        return this.kpiResult(title, metricKey, await this.prisma.assetMaintenancePlan.count({
          where: {
            status: "ACTIVE",
            nextDueAt: { lte: new Date(Date.now() + 30 * MS_PER_DAY) }
          }
        }), trend, trendValue);
      case "forms.overdue":
        return this.kpiResult(title, metricKey, await this.prisma.formSubmission.count({
          where: { status: { in: ["SUBMITTED", "PENDING_REVIEW"] } }
        }), trend, trendValue);
      case "scheduler.conflicts":
      default: {
        if (config.value !== undefined) {
          const raw = config.value;
          const value = typeof raw === "number" || typeof raw === "string" ? raw : String(raw);
          return this.kpiResult(title, metricKey || "static", value, trend, trendValue);
        }
        return this.kpiResult(title, metricKey || "scheduler.conflicts", await this.prisma.schedulingConflict.count({
          where: { severity: { in: ["RED", "AMBER"] } }
        }), trend, trendValue);
      }
    }
  }

  private kpiResult(
    title: string,
    metricKey: string,
    value: number | string,
    trend?: string,
    trendValue?: string
  ) {
    return {
      type: "kpi" as const,
      title,
      metricKey,
      value,
      trend: trend ?? null,
      trendValue: trendValue ?? null
    };
  }

  private async renderBarChart(title: string, metricKey: string, config: Record<string, unknown>) {
    const data = await this.resolveChartData(metricKey, config);
    return { type: "bar_chart" as const, title, metricKey, data };
  }

  private async renderLineChart(title: string, metricKey: string, config: Record<string, unknown>) {
    const data = await this.resolveChartData(metricKey, config);
    return { type: "line_chart" as const, title, metricKey, data };
  }

  private async renderDonutChart(title: string, metricKey: string, config: Record<string, unknown>) {
    const data = await this.resolveChartData(metricKey, config);
    return { type: "donut_chart" as const, title, metricKey, data };
  }

  private async resolveChartData(metricKey: string, config: Record<string, unknown>): Promise<DataPoint[]> {
    switch (metricKey) {
      case "jobs.byStatus": {
        const rows = await this.prisma.job.groupBy({
          by: ["status"],
          _count: { _all: true }
        });
        return rows.map((row) => ({ label: row.status, value: row._count._all }));
      }
      case "tenders.byStatus":
      case "tenders.byStage": {
        const rows = await this.prisma.tender.groupBy({
          by: ["status"],
          _count: { _all: true }
        });
        return rows.map((row) => ({ label: row.status, value: row._count._all }));
      }
      case "revenue.monthly": {
        const sixMonthsAgo = new Date(Date.now() - 6 * 30 * MS_PER_DAY);
        const tenders = await this.prisma.tender.findMany({
          where: { status: { in: ["AWARDED", "CONTRACT_ISSUED", "CONVERTED"] }, updatedAt: { gte: sixMonthsAgo } },
          select: { updatedAt: true, estimatedValue: true },
          orderBy: { updatedAt: "asc" }
        });
        const byMonth = new Map<string, number>();
        for (const tender of tenders) {
          const label = tender.updatedAt.toISOString().slice(0, 7);
          const amount = Number(tender.estimatedValue ?? 0);
          byMonth.set(label, (byMonth.get(label) ?? 0) + amount);
        }
        return Array.from(byMonth.entries()).map(([label, value]) => ({ label, value: Math.round(value) }));
      }
      case "forms.byWeek": {
        const sixWeeksAgo = new Date(Date.now() - 6 * 7 * MS_PER_DAY);
        const submissions = await this.prisma.formSubmission.findMany({
          where: { submittedAt: { gte: sixWeeksAgo } },
          select: { submittedAt: true },
          orderBy: { submittedAt: "asc" }
        });
        const byWeek = new Map<string, number>();
        for (const submission of submissions) {
          const weekStart = new Date(submission.submittedAt);
          const day = weekStart.getUTCDay();
          weekStart.setUTCDate(weekStart.getUTCDate() - day + (day === 0 ? -6 : 1));
          const label = weekStart.toISOString().slice(0, 10);
          byWeek.set(label, (byWeek.get(label) ?? 0) + 1);
        }
        return Array.from(byWeek.entries()).map(([label, value]) => ({ label, value }));
      }
      case "maintenance.upcoming": {
        const windowEnd = new Date(Date.now() + 30 * MS_PER_DAY);
        const plans = await this.prisma.assetMaintenancePlan.findMany({
          where: { status: "ACTIVE", nextDueAt: { lte: windowEnd } },
          include: { asset: true },
          orderBy: { nextDueAt: "asc" }
        });
        return plans.map((plan) => ({
          label: plan.asset.assetCode,
          value: plan.nextDueAt
            ? Math.max(0, Math.round((plan.nextDueAt.getTime() - Date.now()) / MS_PER_DAY))
            : 0
        }));
      }
      default: {
        if (Array.isArray(config.data)) {
          return (config.data as Array<Record<string, unknown>>).map((point) => ({
            label: String(point.label ?? ""),
            value: Number(point.value ?? 0)
          }));
        }
        return [];
      }
    }
  }

  private async renderLegacyChart(title: string, metricKey: string) {
    const data = await this.resolveChartData(metricKey, {});
    return { type: "bar_chart" as const, title, metricKey, data };
  }

  private async renderTable(title: string, metricKey: string) {
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
          type: "table" as const,
          title,
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
          type: "table" as const,
          title,
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

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0
    }).format(amount);
  }
}
