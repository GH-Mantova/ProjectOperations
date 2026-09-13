import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query for the maintenance dashboard list. Extends {@link PaginationQueryDto}
 * with optional asset and status filters; both filter to single values.
 */
export class MaintenanceQueryDto extends PaginationQueryDto {
  /** Filter to a single asset by id. */
  @IsOptional() @IsString() assetId?: string;
  /** Filter by asset status (e.g. `ACTIVE`, `MAINTENANCE`, `OUT_OF_SERVICE`). */
  @IsOptional() @IsString() status?: string;
}

/**
 * Query for the asset utilisation report — a `from` / `to` window plus
 * optional asset or category filter. Dates are inclusive and are normalised
 * to UTC day bounds inside the service.
 */
export class AssetUtilisationQueryDto {
  /** Inclusive start of the window — ISO date string (UTC). */
  @IsDateString() from!: string;
  /** Inclusive end of the window — ISO date string (UTC). Must be ≥ `from`. */
  @IsDateString() to!: string;
  /** Filter to a single asset by id. */
  @IsOptional() @IsString() assetId?: string;
  /** Filter by asset category name (matches `Asset.category.name`). */
  @IsOptional() @IsString() category?: string;
}

/**
 * Create or update payload for an `AssetMaintenancePlan`. Used by both
 * `POST /maintenance/plans` and `PATCH /maintenance/plans/:id`.
 */
export class UpsertMaintenancePlanDto {
  /** Asset the plan belongs to. */
  @IsString() assetId!: string;
  /** Short human-readable plan title (e.g. "500-hr service"). */
  @IsString() title!: string;
  /** Optional longer description / scope notes. */
  @IsOptional() @IsString() description?: string;
  /** Cadence in days — used to roll `nextDueAt` forward on completion. */
  @Type(() => Number) @IsInt() intervalDays!: number;
  /** Days before `nextDueAt` when the plan enters `DUE_SOON`. Defaults to 7. */
  @IsOptional() @Type(() => Number) @IsInt() warningDays?: number;
  /** When true, overdue plans force scheduler impact `BLOCK`. Defaults to true. */
  @IsOptional() @Type(() => Boolean) @IsBoolean() blockWhenOverdue?: boolean;
  /** Last completion timestamp — clears when omitted. */
  @IsOptional() @IsDateString() lastCompletedAt?: string;
  /** Next due timestamp — clears when omitted. */
  @IsOptional() @IsDateString() nextDueAt?: string;
  /** Plan lifecycle status (e.g. `ACTIVE`, `PAUSED`). Defaults to `ACTIVE`. */
  @IsOptional() @IsString() status?: string;

  // F-8: usage-based maintenance interval fields.

  /**
   * Usage interval — the plan becomes due when the asset has accumulated this
   * many units of usage since the last completion. Must be positive.
   */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.1) intervalUsage?: number;

  /**
   * Unit for the usage interval. Must be one of `"hours"` or `"km"`.
   * Required when `intervalUsage` is set.
   */
  @IsOptional() @IsString() @IsIn(["hours", "km"]) usageUnit?: string;

  /**
   * Reading at the time of the last completed maintenance event — used as the
   * baseline for the next usage interval.
   */
  @IsOptional() @Type(() => Number) @IsNumber() lastCompletedReading?: number;

  /**
   * Reading at which the next maintenance event is due. Computed from
   * `lastCompletedReading + intervalUsage` when not supplied explicitly.
   */
  @IsOptional() @Type(() => Number) @IsNumber() nextDueReading?: number;

  /**
   * Percentage of the usage interval at which a DUE_SOON warning is raised.
   * Must be between 1 and 100. Defaults to 90.
   */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) usageWarningPct?: number;
}

/**
 * Create or update payload for an `AssetMaintenanceEvent`. Used by both
 * `POST /maintenance/events` and `PATCH /maintenance/events/:id`. When the
 * event is linked to a plan and has a `completedAt`, the parent plan is
 * automatically rolled forward.
 */
export class UpsertMaintenanceEventDto {
  /** Asset the event was performed on. */
  @IsString() assetId!: string;
  /** Optional link to the maintenance plan this event satisfies. */
  @IsOptional() @IsString() maintenancePlanId?: string;
  /** Free-form event type (e.g. `SERVICE`, `REPAIR`, `INSPECTION`). */
  @IsString() eventType!: string;
  /** When the event was scheduled to occur. */
  @IsOptional() @IsDateString() scheduledAt?: string;
  /** When the event was actually completed — triggers plan roll-forward when set. */
  @IsOptional() @IsDateString() completedAt?: string;
  /** Event status (e.g. `SCHEDULED`, `COMPLETED`). Defaults to `SCHEDULED`. */
  @IsOptional() @IsString() status?: string;
  /** Free-form notes for the event. */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Create or update payload for an `AssetInspection`. Used by both
 * `POST /maintenance/inspections` and `PATCH /maintenance/inspections/:id`.
 */
export class UpsertInspectionDto {
  /** Asset that was inspected. */
  @IsString() assetId!: string;
  /** Free-form inspection type (e.g. `PRE_START`, `MONTHLY`). */
  @IsString() inspectionType!: string;
  /** When the inspection was performed. */
  @IsDateString() inspectedAt!: string;
  /** Inspection outcome (e.g. `PASS`, `FAIL`). A `FAIL` blocks the asset. Defaults to `PASS`. */
  @IsOptional() @IsString() status?: string;
  /** Free-form notes (findings, follow-up actions). */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Create or update payload for an `AssetBreakdown`. Used by both
 * `POST /maintenance/breakdowns` and `PATCH /maintenance/breakdowns/:id`.
 * Any non-`RESOLVED` breakdown forces scheduler impact `BLOCK`.
 */
export class UpsertBreakdownDto {
  /** Asset the breakdown was reported against. */
  @IsString() assetId!: string;
  /** When the breakdown was reported. */
  @IsDateString() reportedAt!: string;
  /** When the breakdown was resolved — leave unset while still open. */
  @IsOptional() @IsDateString() resolvedAt?: string;
  /** Severity tier (e.g. `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). Defaults to `MEDIUM`. */
  @IsOptional() @IsString() severity?: string;
  /** Lifecycle status (e.g. `OPEN`, `IN_PROGRESS`, `RESOLVED`). Defaults to `OPEN`. */
  @IsOptional() @IsString() status?: string;
  /** Short one-line summary of the breakdown. */
  @IsString() summary!: string;
  /** Free-form notes (diagnosis, parts ordered, etc.). */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for `PATCH /maintenance/assets/:assetId/status` — changes the
 * asset status and appends a row to its status history. The new status
 * must differ from the current one.
 */
export class UpdateAssetStatusDto {
  /** New asset status (e.g. `ACTIVE`, `MAINTENANCE`, `OUT_OF_SERVICE`). */
  @IsString() status!: string;
  /** Optional note recorded on the status history entry. */
  @IsOptional() @IsString() note?: string;
}
