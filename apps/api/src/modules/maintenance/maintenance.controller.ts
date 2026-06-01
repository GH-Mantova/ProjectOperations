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

@ApiTags("Maintenance")
@ApiBearerAuth()
@Controller("maintenance")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

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

  @Get("assets/:assetId")
  @RequirePermissions("maintenance.view")
  @ApiOperation({ summary: "Get maintenance detail for asset" })
  @ApiParam({ name: "assetId", description: "Asset id to load maintenance detail for" })
  @ApiResponse({ status: 200, description: "Asset with plans, events, inspections, breakdowns and summary." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  getAsset(@Param("assetId") assetId: string) {
    return this.service.getAssetMaintenance(assetId);
  }

  @Get("plans")
  @RequirePermissions("maintenance.view")
  @ApiOperation({ summary: "List all maintenance plans (with asset summary) — used by the Operations dashboard 'Upcoming maintenance' widget." })
  @ApiResponse({ status: 200, description: "Maintenance plans with linked asset summary." })
  listPlans() {
    return this.service.listPlans();
  }

  @Post("plans")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Create a maintenance plan for an asset" })
  @ApiResponse({ status: 201, description: "Created maintenance plan." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createPlan(@Body() dto: UpsertMaintenancePlanDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlan(undefined, dto, actor.sub);
  }

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

  @Post("events")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Record a maintenance event against an asset" })
  @ApiResponse({ status: 201, description: "Created maintenance event." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createEvent(@Body() dto: UpsertMaintenanceEventDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEvent(undefined, dto, actor.sub);
  }

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

  @Post("inspections")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Record an inspection against an asset" })
  @ApiResponse({ status: 201, description: "Created inspection." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createInspection(@Body() dto: UpsertInspectionDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertInspection(undefined, dto, actor.sub);
  }

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

  @Post("breakdowns")
  @RequirePermissions("maintenance.manage")
  @ApiOperation({ summary: "Report a breakdown against an asset" })
  @ApiResponse({ status: 201, description: "Created breakdown record." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Asset not found." })
  createBreakdown(@Body() dto: UpsertBreakdownDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertBreakdown(undefined, dto, actor.sub);
  }

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
