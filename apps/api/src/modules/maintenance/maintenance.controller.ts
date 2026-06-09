import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { MaintenanceService } from "./maintenance.service";
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
 * HTTP surface for §12 Maintenance — assets, maintenance plans, events,
 * inspections, breakdowns, asset utilisation, and asset status transitions.
 *
 * Read endpoints require `maintenance.view`; all write endpoints require
 * `maintenance.manage`. The `assets/utilisation` route is declared before
 * `assets/:assetId` so the literal segment is not captured as a path
 * parameter by Nest's pattern matcher.
 */
@ApiTags("Maintenance")
@ApiBearerAuth()
@Controller("maintenance")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  /**
   * List assets with a derived maintenance summary, optionally filtered by
   * asset id or status. Paginated; defaults come from {@link PaginationQueryDto}.
   *
   * @param query - asset/status filters and pagination
   * @returns paginated assets, each enriched with `maintenanceSummary`
   */
  @Get("assets")
  @RequirePermissions("maintenance.view")
  @ApiOperation({ summary: "List assets with maintenance summary" })
  @ApiQuery({ name: "assetId", required: false, description: "Filter to a single asset" })
  @ApiQuery({ name: "status", required: false, description: "Filter by asset status" })
  @ApiQuery({ name: "page", required: false, description: "Page number (1-based)" })
  @ApiQuery({ name: "pageSize", required: false, description: "Page size (max 100)" })
  @ApiQuery({ name: "limit", required: false, description: "Alias for pageSize (max 100)" })
  @ApiResponse({ status: 200, description: "Paginated assets with maintenance summary." })
  @ApiResponse({ status: 400, description: "Invalid pagination parameters." })
  dashboard(@Query() query: MaintenanceQueryDto) {
    return this.service.dashboard(query);
  }

  /**
   * Asset utilisation over a date range — per-asset hours allocated, hours
   * available (Mon-Fri × 8h), utilisation rate (capped at 1.0) and allocation
   * count for the requested window. Sorted by utilisation DESC, then asset
   * name ASC.
   *
   * Hours allocated are sourced from `ShiftAssetAssignment`; the date range
   * is normalised to UTC day bounds before clamping each shift to the window.
   *
   * @param query - inclusive `from`/`to` ISO dates plus optional asset/category
   * @returns one row per matching asset
   * @throws BadRequestException — when from/to are invalid or inverted
   */
  // Must be declared before `assets/:assetId` so Nest doesn't capture the
  // literal "utilisation" as an assetId path param.
  @Get("assets/utilisation")
  @RequirePermissions("maintenance.view")
  @ApiOperation({
    summary: "Asset utilisation over a date range",
    description:
      "Returns per-asset hours allocated, hours available (Mon-Fri × 8h), utilisation rate (capped at 1.0) and allocation count for the requested window. Sorted by utilisation DESC, then asset name ASC."
  })
  @ApiQuery({ name: "from", required: true, description: "ISO date (inclusive)" })
  @ApiQuery({ name: "to", required: true, description: "ISO date (inclusive)" })
  @ApiQuery({ name: "assetId", required: false, description: "Filter to a single asset" })
  @ApiQuery({ name: "category", required: false, description: "Filter by asset category name" })
  @ApiResponse({ status: 200, description: "Utilisation rows" })
  @ApiResponse({ status: 400, description: "Invalid or inverted from/to range" })
  utilisation(@Query() query: AssetUtilisationQueryDto) {
    return this.service.assetUtilisation(query);
  }

  /**
   * Get the full maintenance detail for a single asset — plans, events,
   * inspections, breakdowns, status history and derived summary.
   *
   * @param assetId - asset id to load
   * @returns asset with related collections and computed `maintenanceSummary`
   * @throws NotFoundException — when the asset does not exist
   */
  @Get("assets/:assetId")
  @RequirePermissions("maintenance.view")
  @ApiOperation({ summary: "Get maintenance detail for asset" })
  @ApiParam({ name: "assetId", description: "Asset id to load maintenance detail for" })
  @ApiResponse({ status: 200, description: "Asset with plans, events, inspections, breakdowns and summary." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  getAsset(@Param("assetId") assetId: string) {
    return this.service.getAssetMaintenance(assetId);
  }

  /**
   * List all maintenance plans with a minimal linked-asset summary, ordered
   * by `nextDueAt` ascending then `createdAt` descending. Powers the
   * Operations dashboard "Upcoming maintenance" widget.
   *
   * @returns all maintenance plans with `{ id, assetCode, name }` for the asset
   */
  @Get("plans")
  @RequirePermissions("maintenance.view")
  @ApiOperation({ summary: "List all maintenance plans (with asset summary) — used by the Operations dashboard 'Upcoming maintenance' widget." })
  @ApiResponse({ status: 200, description: "Maintenance plans with linked asset summary." })
  listPlans() {
    return this.service.listPlans();
  }

  /**
   * Create a maintenance plan for an asset. Writes an audit entry under
   * `maintenance.plan.create`.
   *
   * @param dto - plan fields (asset, title, interval, optional schedule)
   * @param actor - current user, used as audit actor
   * @returns the created plan
   * @throws NotFoundException — when `assetId` does not match an asset
   */
  @Post("plans")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Create a maintenance plan for an asset" })
  @ApiResponse({ status: 201, description: "Created maintenance plan." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createPlan(@Body() dto: UpsertMaintenancePlanDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlan(undefined, dto, actor.sub);
  }

  /**
   * Update an existing maintenance plan. Writes an audit entry under
   * `maintenance.plan.update`.
   *
   * @param id - plan id to update
   * @param dto - replacement plan fields
   * @param actor - current user, used as audit actor
   * @returns the updated plan
   * @throws NotFoundException — when the plan or referenced asset is missing
   */
  @Patch("plans/:id")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Update an existing maintenance plan" })
  @ApiParam({ name: "id", description: "Maintenance plan id to update" })
  @ApiResponse({ status: 200, description: "Updated maintenance plan." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Plan or referenced asset not found." })
  updatePlan(@Param("id") id: string, @Body() dto: UpsertMaintenancePlanDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlan(id, dto, actor.sub);
  }

  /**
   * Record a maintenance event against an asset. When the event is linked to
   * a plan and a `completedAt` is supplied, the parent plan's
   * `lastCompletedAt` and `nextDueAt` are rolled forward. Writes an audit
   * entry under `maintenance.event.create`.
   *
   * @param dto - event fields (asset, event type, optional plan/schedule/completion)
   * @param actor - current user, used as audit actor
   * @returns the created event
   * @throws NotFoundException — when `assetId` does not match an asset
   */
  @Post("events")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Record a maintenance event against an asset" })
  @ApiResponse({ status: 201, description: "Created maintenance event." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createEvent(@Body() dto: UpsertMaintenanceEventDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEvent(undefined, dto, actor.sub);
  }

  /**
   * Update a maintenance event. Updating a linked event with a
   * `completedAt` also rolls the parent plan's `lastCompletedAt` /
   * `nextDueAt` forward. Writes an audit entry under
   * `maintenance.event.update`.
   *
   * @param id - event id to update
   * @param dto - replacement event fields
   * @param actor - current user, used as audit actor
   * @returns the updated event
   * @throws NotFoundException — when the event or referenced asset is missing
   */
  @Patch("events/:id")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Update a maintenance event" })
  @ApiParam({ name: "id", description: "Maintenance event id to update" })
  @ApiResponse({ status: 200, description: "Updated maintenance event." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Event or referenced asset not found." })
  updateEvent(@Param("id") id: string, @Body() dto: UpsertMaintenanceEventDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEvent(id, dto, actor.sub);
  }

  /**
   * Record an inspection against an asset. A FAIL status feeds the
   * derived maintenance summary and can trigger scheduler `BLOCK` impact.
   * Writes an audit entry under `maintenance.inspection.create`.
   *
   * @param dto - inspection fields (asset, type, inspectedAt, status, notes)
   * @param actor - current user, used as audit actor
   * @returns the created inspection
   * @throws NotFoundException — when `assetId` does not match an asset
   */
  @Post("inspections")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Record an inspection against an asset" })
  @ApiResponse({ status: 201, description: "Created inspection." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createInspection(@Body() dto: UpsertInspectionDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertInspection(undefined, dto, actor.sub);
  }

  /**
   * Update an inspection record. Writes an audit entry under
   * `maintenance.inspection.update`.
   *
   * @param id - inspection id to update
   * @param dto - replacement inspection fields
   * @param actor - current user, used as audit actor
   * @returns the updated inspection
   * @throws NotFoundException — when the inspection or referenced asset is missing
   */
  @Patch("inspections/:id")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Update an inspection record" })
  @ApiParam({ name: "id", description: "Inspection id to update" })
  @ApiResponse({ status: 200, description: "Updated inspection." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Inspection or referenced asset not found." })
  updateInspection(@Param("id") id: string, @Body() dto: UpsertInspectionDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertInspection(id, dto, actor.sub);
  }

  /**
   * Report a breakdown against an asset. Any unresolved breakdown forces
   * the derived maintenance state to `UNAVAILABLE` and scheduler impact to
   * `BLOCK` until cleared. Writes an audit entry under
   * `maintenance.breakdown.create`.
   *
   * @param dto - breakdown fields (asset, reportedAt, severity, summary)
   * @param actor - current user, used as audit actor
   * @returns the created breakdown
   * @throws NotFoundException — when `assetId` does not match an asset
   */
  @Post("breakdowns")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Report a breakdown against an asset" })
  @ApiResponse({ status: 201, description: "Created breakdown record." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createBreakdown(@Body() dto: UpsertBreakdownDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertBreakdown(undefined, dto, actor.sub);
  }

  /**
   * Update a breakdown record — typically to mark it `RESOLVED` and clear
   * the scheduler block. Writes an audit entry under
   * `maintenance.breakdown.update`.
   *
   * @param id - breakdown id to update
   * @param dto - replacement breakdown fields
   * @param actor - current user, used as audit actor
   * @returns the updated breakdown
   * @throws NotFoundException — when the breakdown or referenced asset is missing
   */
  @Patch("breakdowns/:id")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Update a breakdown record" })
  @ApiParam({ name: "id", description: "Breakdown id to update" })
  @ApiResponse({ status: 200, description: "Updated breakdown record." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Breakdown or referenced asset not found." })
  updateBreakdown(@Param("id") id: string, @Body() dto: UpsertBreakdownDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertBreakdown(id, dto, actor.sub);
  }

  /**
   * Change an asset's status and append a row to its status history.
   * Performed in a single transaction so the asset row and history entry
   * stay in sync. Writes an audit entry under
   * `maintenance.asset-status.update`.
   *
   * @param assetId - asset id whose status is changing
   * @param dto - new status plus optional note
   * @param actor - current user, used as audit actor
   * @returns the asset with refreshed `maintenanceSummary`
   * @throws NotFoundException — when the asset does not exist
   * @throws ConflictException — when the asset already has the requested status
   */
  @Patch("assets/:assetId/status")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Change an asset's status and log the transition" })
  @ApiParam({ name: "assetId", description: "Asset id whose status is changing" })
  @ApiResponse({ status: 200, description: "Asset with updated status and refreshed maintenance summary." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid status)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  @ApiResponse({ status: 409, description: "Asset already has the requested status." })
  updateAssetStatus(
    @Param("assetId") assetId: string,
    @Body() dto: UpdateAssetStatusDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateAssetStatus(assetId, dto, actor.sub);
  }
}
