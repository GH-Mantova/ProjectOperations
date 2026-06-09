import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  computeUtilisationRate,
  hoursForShiftInRange,
  workingHoursBetween
} from "./asset-utilisation.helpers";
import {
  AssetUtilisationQueryDto,
  MaintenanceQueryDto,
  UpdateAssetStatusDto,
  UpsertBreakdownDto,
  UpsertInspectionDto,
  UpsertMaintenanceEventDto,
  UpsertMaintenancePlanDto
} from "./dto/maintenance.dto";

/**
 * One row of the asset utilisation report — totals for a single asset over
 * the requested window. Returned by {@link MaintenanceService.assetUtilisation}.
 */
export interface AssetUtilisationRow {
  assetId: string;
  assetName: string;
  category: string;
  hoursAllocated: number;
  hoursAvailable: number;
  utilisationRate: number;
  allocationCount: number;
}

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

/**
 * Service layer for §12 Maintenance — assets and the records that hang off
 * them (plans, events, inspections, breakdowns, status history) plus the
 * asset utilisation report consumed by §7 plant/equipment reporting.
 *
 * Every write goes through {@link AuditService} and (for asset status
 * changes) through a single Prisma transaction so the asset row and its
 * status-history entry stay in lockstep. Read responses are enriched with a
 * derived `maintenanceSummary` produced by {@link buildMaintenanceSummary},
 * which drives the scheduler's WARN / BLOCK signalling.
 *
 * Asset utilisation pulls hours allocated from `ShiftAssetAssignment` —
 * the scheduler is the system of record for asset time, so
 * `ProjectAllocation` (calendar-day grain) is intentionally not used.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * List assets with derived maintenance summary, paginated. Filters by
   * asset id or status when supplied. Runs the page query and total count
   * in a single Prisma transaction.
   *
   * @param query - optional `assetId` / `status` plus pagination
   * @returns `{ items, total, page, pageSize }`
   */
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

  /**
   * List all maintenance plans (any status) ordered by `nextDueAt` then
   * `createdAt`, with a minimal asset summary. Used by the Operations
   * dashboard's "Upcoming maintenance" widget.
   *
   * @returns all plans, each carrying `{ id, assetCode, name }` for its asset
   */
  async listPlans() {
    return this.prisma.assetMaintenancePlan.findMany({
      orderBy: [{ nextDueAt: "asc" }, { createdAt: "desc" }],
      include: {
        asset: { select: { id: true, assetCode: true, name: true } }
      }
    });
  }

  /**
   * Create or update a maintenance plan for an asset. Pass `id` to update,
   * `undefined` to create. Defaults: `warningDays = 7`,
   * `blockWhenOverdue = true`, `status = "ACTIVE"`. Writes a
   * `maintenance.plan.create` or `maintenance.plan.update` audit entry.
   *
   * @param id - existing plan id, or `undefined` to create
   * @param dto - plan fields
   * @param actorId - audit actor (user id)
   * @returns the persisted plan
   * @throws NotFoundException — when `dto.assetId` does not match an asset
   */
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

  /**
   * Create or update a maintenance event. Pass `id` to update, `undefined`
   * to create. When the event is linked to a plan (`maintenancePlanId`) and
   * has a `completedAt`, the parent plan's `lastCompletedAt` is set to that
   * timestamp and `nextDueAt` is rolled forward by `intervalDays`. Writes a
   * `maintenance.event.create` or `maintenance.event.update` audit entry.
   *
   * @param id - existing event id, or `undefined` to create
   * @param dto - event fields
   * @param actorId - audit actor (user id)
   * @returns the persisted event
   * @throws NotFoundException — when `dto.assetId` does not match an asset
   */
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

  /**
   * Create or update an inspection record. Pass `id` to update, `undefined`
   * to create. Default `status` is `PASS`. A `FAIL` flips the derived
   * maintenance state to `UNAVAILABLE` and the scheduler impact to `BLOCK`.
   * Writes a `maintenance.inspection.create` or
   * `maintenance.inspection.update` audit entry.
   *
   * @param id - existing inspection id, or `undefined` to create
   * @param dto - inspection fields
   * @param actorId - audit actor (user id)
   * @returns the persisted inspection
   * @throws NotFoundException — when `dto.assetId` does not match an asset
   */
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

  /**
   * Create or update a breakdown record. Pass `id` to update, `undefined`
   * to create. Defaults: `severity = "MEDIUM"`, `status = "OPEN"`. Any
   * non-`RESOLVED` breakdown forces the derived maintenance state to
   * `UNAVAILABLE` and the scheduler impact to `BLOCK`. Writes a
   * `maintenance.breakdown.create` or `maintenance.breakdown.update` audit
   * entry.
   *
   * @param id - existing breakdown id, or `undefined` to create
   * @param dto - breakdown fields
   * @param actorId - audit actor (user id)
   * @returns the persisted breakdown
   * @throws NotFoundException — when `dto.assetId` does not match an asset
   */
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

  /**
   * Change an asset's status and append a row to its status history. The
   * asset update and history insert run in a single Prisma transaction, so
   * the two cannot diverge. The from/to statuses are captured in audit
   * metadata under `maintenance.asset-status.update`. After the write, the
   * full asset detail is re-read so the caller gets a refreshed
   * `maintenanceSummary`.
   *
   * @param assetId - asset id whose status is changing
   * @param dto - new status plus optional note
   * @param actorId - audit actor (user id)
   * @returns asset detail with updated summary
   * @throws NotFoundException — when the asset does not exist
   * @throws ConflictException — when the asset already has the requested status
   */
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

  /**
   * Load full maintenance detail for one asset — plans, events,
   * inspections, breakdowns, status history and computed
   * `maintenanceSummary`.
   *
   * @param assetId - asset id to load
   * @returns asset with related collections and derived summary
   * @throws NotFoundException — when the asset does not exist
   */
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

  /**
   * §7 plant/equipment utilisation report — per-asset hours allocated vs
   * hours available across an inclusive UTC date range.
   *
   * Hours allocated come from `ShiftAssetAssignment` (the scheduler model
   * that already tracks asset ↔ shift links with startAt / endAt
   * timestamps); each matching shift is clamped to the window before being
   * summed. Hours available is a pure calendar count of Mon-Fri × 8h
   * between `from` and `to` UTC. `ProjectAllocation` is intentionally not
   * used — its start/end are calendar days not hours, and the scheduler is
   * the system of record for actual asset time.
   *
   * The range is normalised to UTC day bounds (start at 00:00:00.000, end
   * at 23:59:59.999) so single-day queries (from == to) still include every
   * shift that lands on that day, matching the payroll-export pattern.
   *
   * Rows are sorted by `utilisationRate` DESC then `assetName` ASC.
   *
   * @param query - inclusive `from`/`to` ISO dates plus optional asset/category filter
   * @returns one row per matching asset
   * @throws BadRequestException — when from/to are invalid or `to` < `from`
   */
  async assetUtilisation(query: AssetUtilisationQueryDto): Promise<AssetUtilisationRow[]> {
    const rangeStart = new Date(query.from);
    const rangeEnd = new Date(query.to);

    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      throw new BadRequestException("Invalid from/to date.");
    }

    // Normalise to UTC day bounds so single-day queries (from == to) include
    // every shift that lands on that day. Matches the payroll-export pattern.
    rangeStart.setUTCHours(0, 0, 0, 0);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    if (rangeEnd < rangeStart) {
      throw new BadRequestException("`to` must be on or after `from`.");
    }

    const assetWhere = {
      ...(query.assetId ? { id: query.assetId } : {}),
      ...(query.category ? { category: { name: query.category } } : {})
    };

    const assets = await this.prisma.asset.findMany({
      where: assetWhere,
      include: {
        category: true,
        shiftAssignments: {
          where: {
            shift: {
              startAt: { lt: rangeEnd },
              endAt: { gt: rangeStart }
            }
          },
          include: {
            shift: { select: { id: true, startAt: true, endAt: true } }
          }
        }
      }
    });

    const hoursAvailable = workingHoursBetween(rangeStart, rangeEnd);

    const rows: AssetUtilisationRow[] = assets.map((asset) => {
      const hoursAllocated = asset.shiftAssignments.reduce(
        (sum, assignment) =>
          sum + hoursForShiftInRange(assignment.shift.startAt, assignment.shift.endAt, rangeStart, rangeEnd),
        0
      );

      return {
        assetId: asset.id,
        assetName: asset.name,
        category: asset.category?.name ?? "Uncategorised",
        hoursAllocated: Math.round(hoursAllocated * 100) / 100,
        hoursAvailable,
        utilisationRate: computeUtilisationRate(hoursAllocated, hoursAvailable),
        allocationCount: asset.shiftAssignments.length
      };
    });

    rows.sort((a, b) => {
      if (b.utilisationRate !== a.utilisationRate) return b.utilisationRate - a.utilisationRate;
      return a.assetName.localeCompare(b.assetName);
    });

    return rows;
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
