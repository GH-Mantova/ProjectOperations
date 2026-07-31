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

export type DashboardActor = {
  sub: string;
  permissions?: string[];
  isSuperUser?: boolean;
};

function isPlatformAdmin(actor: DashboardActor): boolean {
  return Boolean(actor.isSuperUser) || (actor.permissions ?? []).includes("platform.admin");
}

// Prisma P2002 = unique-constraint violation. Checked structurally (not via
// instanceof) so it holds for PrismaClientKnownRequestError in production and
// for plain { code: "P2002" } errors in unit tests.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

@Injectable()
export class UserDashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(userId: string, slug?: string) {
    if (slug === "operations") {
      return this.ensureOperationsSystemDefault(userId);
    }
    return this.prisma.userDashboard.findMany({
      where: { userId, ...(slug ? { slug } : {}) },
      orderBy: [{ isSystem: "desc" }, { isDefault: "desc" }, { createdAt: "asc" }]
    });
  }

  /**
   * Idempotent ensure for the "operations" dashboard.
   *
   * Rules (in priority order):
   *  1. If a system row already exists → return all rows as-is (no write).
   *  2. If one or more non-system rows exist → promote the best candidate
   *     (prefer isDefault:true, else oldest createdAt) to isSystem:true.
   *     The promoted row disappears from the sidebar lazily; no migration needed.
   *  3. If no rows exist → create a fresh system row with the default config.
   *
   * Race safety: both the promote and the create are guarded by the
   * @@unique([userId, slug, isSystem]) constraint.  On P2002 we re-read and
   * return, following the same idempotency pattern as create().
   */
  private async ensureOperationsSystemDefault(userId: string) {
    const fetchAll = () =>
      this.prisma.userDashboard.findMany({
        where: { userId, slug: "operations" },
        orderBy: [{ isSystem: "desc" }, { isDefault: "desc" }, { createdAt: "asc" }]
      });

    const rows = await fetchAll();

    // Case 1: system row already present — nothing to do, unless it still carries
    // the old default name "Operations Overview" (lazy rename to "Home").
    if (rows.some((r) => r.isSystem)) {
      const sys = rows.find((r) => r.isSystem)!;
      if (sys.name === "Operations Overview") {
        await this.prisma.userDashboard.update({
          where: { id: sys.id },
          data: { name: "Home" }
        });
        await this.audit.write({
          actorId: userId,
          action: "userDashboards.ensureSystemDefault",
          entityType: "UserDashboard",
          entityId: sys.id,
          metadata: { slug: "operations", reason: "renamed" }
        });
        return fetchAll();
      }
      return rows;
    }

    // Case 2: one or more non-system rows — promote the best candidate.
    if (rows.length > 0) {
      const candidate =
        rows.find((r) => r.isDefault) ?? rows[0];
      try {
        await this.prisma.userDashboard.update({
          where: { id: candidate.id },
          data: { isSystem: true }
        });
        await this.audit.write({
          actorId: userId,
          action: "userDashboards.ensureSystemDefault",
          entityType: "UserDashboard",
          entityId: candidate.id,
          metadata: { slug: "operations", reason: "promoted" }
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Another concurrent request already promoted a row — fall through to re-read.
      }
      return fetchAll();
    }

    // Case 3: no rows at all — create the system default.
    let newId: string | undefined;
    try {
      const created = await this.prisma.userDashboard.create({
        data: {
          userId,
          name: "Home",
          slug: "operations",
          isSystem: true,
          isDefault: false,
          config: UserDashboardsService.defaultOperationsConfig() as unknown as import("@prisma/client").Prisma.InputJsonValue
        }
      });
      newId = created.id;
      await this.audit.write({
        actorId: userId,
        action: "userDashboards.ensureSystemDefault",
        entityType: "UserDashboard",
        entityId: created.id,
        metadata: { slug: "operations", reason: "created" }
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another concurrent request already created the row — fall through to re-read.
    }
    void newId; // suppress lint: may or may not be set; we re-read either way.
    return fetchAll();
  }

  async getById(userId: string, id: string) {
    // Resolve by primary id first; if nothing matches, fall back to slug
    // scoped to the current user so slug-style URLs (/dashboards/operations)
    // work alongside UUID-style URLs (/dashboards/<uuid>).
    let record = await this.prisma.userDashboard.findUnique({ where: { id } });
    if (!record) {
      record = await this.prisma.userDashboard.findFirst({ where: { userId, slug: id } });
    }
    if (!record || record.userId !== userId) {
      throw new NotFoundException("Dashboard not found.");
    }
    return record;
  }

  async create(userId: string, dto: CreateUserDashboardDto) {
    let record;
    try {
      record = await this.prisma.userDashboard.create({
        data: {
          userId,
          name: dto.name,
          slug: dto.slug,
          isSystem: false,
          isDefault: false,
          config: dto.config as unknown as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      // Concurrent create race: two clients (e.g. parallel e2e workers, two open
      // tabs) both see the dashboard absent and both POST. The DB's
      // @@unique([userId, slug, isSystem]) is the arbiter — on P2002, return the
      // row the winner created instead of throwing (idempotency-pattern Case A:
      // create first, let the unique constraint arbitrate; never check-then-create).
      if (isUniqueViolation(error)) {
        const existing = await this.prisma.userDashboard.findFirst({
          where: { userId, slug: dto.slug, isSystem: false }
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
    await this.audit.write({
      actorId: userId,
      action: "userDashboards.create",
      entityType: "UserDashboard",
      entityId: record.id,
      metadata: { slug: dto.slug }
    });
    return record;
  }

  async update(actor: DashboardActor, id: string, dto: UpdateUserDashboardDto) {
    const userId = actor.sub;
    const existing = await this.getById(userId, id);
    // System dashboards are shared fixtures: renaming them is admin-only.
    // Per-user config changes (widget layout, filters, periods) stay open to
    // the owner, and delete remains blocked for everyone (see remove()).
    if (
      existing.isSystem &&
      dto.name !== undefined &&
      dto.name !== existing.name &&
      !isPlatformAdmin(actor)
    ) {
      throw new ForbiddenException("Only administrators can rename system dashboards.");
    }
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
