import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export type WidgetPeriod = "7d" | "30d" | "90d" | "6m" | "12m";

export type UserDashboardWidgetConfig = {
  id: string;
  type: string;
  visible: boolean;
  order: number;
  config: {
    period?: WidgetPeriod | null;
    filters?: Record<string, unknown>;
  };
};

export type UserDashboardConfig = {
  period: WidgetPeriod;
  widgets: UserDashboardWidgetConfig[];
};

export type CreateUserDashboardDto = {
  name: string;
  slug: string;
  config: UserDashboardConfig;
};

export type UpdateUserDashboardDto = {
  name?: string;
  config?: UserDashboardConfig;
};

@Injectable()
export class UserDashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  list(userId: string, slug?: string) {
    return this.prisma.userDashboard.findMany({
      where: { userId, ...(slug ? { slug } : {}) },
      orderBy: [{ isSystem: "desc" }, { isDefault: "desc" }, { createdAt: "asc" }]
    });
  }

  async getById(userId: string, id: string) {
    const record = await this.prisma.userDashboard.findUnique({ where: { id } });
    if (!record || record.userId !== userId) {
      throw new NotFoundException("Dashboard not found.");
    }
    return record;
  }

  async create(userId: string, dto: CreateUserDashboardDto) {
    const record = await this.prisma.userDashboard.create({
      data: {
        userId,
        name: dto.name,
        slug: dto.slug,
        isSystem: false,
        isDefault: false,
        config: dto.config as unknown as Prisma.InputJsonValue
      }
    });
    await this.audit.write({
      actorId: userId,
      action: "userDashboards.create",
      entityType: "UserDashboard",
      entityId: record.id,
      metadata: { slug: dto.slug }
    });
    return record;
  }

  async update(userId: string, id: string, dto: UpdateUserDashboardDto) {
    const existing = await this.getById(userId, id);
    const data: Prisma.UserDashboardUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.config !== undefined) data.config = dto.config as unknown as Prisma.InputJsonValue;
    const record = await this.prisma.userDashboard.update({ where: { id: existing.id }, data });
    await this.audit.write({
      actorId: userId,
      action: "userDashboards.update",
      entityType: "UserDashboard",
      entityId: record.id
    });
    return record;
  }

  async remove(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    if (existing.isSystem) {
      throw new ForbiddenException("System dashboards cannot be deleted.");
    }
    await this.prisma.userDashboard.delete({ where: { id: existing.id } });
    await this.audit.write({
      actorId: userId,
      action: "userDashboards.delete",
      entityType: "UserDashboard",
      entityId: id
    });
    return { id };
  }

  async setDefault(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    await this.prisma.$transaction([
      this.prisma.userDashboard.updateMany({
        where: { userId, slug: existing.slug, id: { not: existing.id } },
        data: { isDefault: false }
      }),
      this.prisma.userDashboard.update({ where: { id: existing.id }, data: { isDefault: true } })
    ]);
    await this.audit.write({
      actorId: userId,
      action: "userDashboards.setDefault",
      entityType: "UserDashboard",
      entityId: id,
      metadata: { slug: existing.slug }
    });
    return this.getById(userId, id);
  }

  // ── Default config factories (used on seed + Reset-to-default in UI) ──

  static defaultOperationsConfig(): UserDashboardConfig {
    const widgetTypes = [
      "ops_active_jobs_kpi",
      "ops_tender_pipeline_kpi",
      "ops_open_issues_kpi",
      "ops_upcoming_maintenance_kpi",
      "ops_jobs_by_status_donut",
      "ops_tender_pipeline_donut",
      "ops_monthly_revenue_line",
      "ops_form_submissions_bar",
      "ops_maintenance_bar"
    ];
    return {
      period: "30d",
      widgets: widgetTypes.map((type, index) => ({
        id: `${type}-default`,
        type,
        visible: true,
        order: index,
        config: { period: null, filters: {} }
      }))
    };
  }

  static defaultTenderingConfig(): UserDashboardConfig {
    const widgetTypes = [
      "ten_active_pipeline_kpi",
      "ten_submitted_mtd_kpi",
      "ten_win_rate_kpi",
      "ten_avg_lead_time_kpi",
      "ten_due_this_week",
      "ten_follow_up_queue",
      "ten_win_rate_chart",
      "ten_pipeline_by_estimator",
      "ten_recent_wins"
    ];
    return {
      period: "30d",
      widgets: widgetTypes.map((type, index) => ({
        id: `${type}-default`,
        type,
        visible: true,
        order: index,
        config: { period: null, filters: {} }
      }))
    };
  }
}
