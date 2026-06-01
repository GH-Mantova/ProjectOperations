import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
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
  getAsset(@Param("assetId") assetId: string) {
    return this.service.getAssetMaintenance(assetId);
  }

  @Get("plans")
  @RequirePermissions("maintenance.view")
  @ApiOperation({ summary: "List all maintenance plans (with asset summary) — used by the Operations dashboard 'Upcoming maintenance' widget." })
  listPlans() {
    return this.service.listPlans();
  }

  @Post("plans")
  @RequirePermissions("maintenance.manage")
  createPlan(@Body() dto: UpsertMaintenancePlanDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlan(undefined, dto, actor.sub);
  }

  @Patch("plans/:id")
  @RequirePermissions("maintenance.manage")
  updatePlan(@Param("id") id: string, @Body() dto: UpsertMaintenancePlanDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlan(id, dto, actor.sub);
  }

  @Post("events")
  @RequirePermissions("maintenance.manage")
  createEvent(@Body() dto: UpsertMaintenanceEventDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEvent(undefined, dto, actor.sub);
  }

  @Patch("events/:id")
  @RequirePermissions("maintenance.manage")
  updateEvent(@Param("id") id: string, @Body() dto: UpsertMaintenanceEventDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEvent(id, dto, actor.sub);
  }

  @Post("inspections")
  @RequirePermissions("maintenance.manage")
  createInspection(@Body() dto: UpsertInspectionDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertInspection(undefined, dto, actor.sub);
  }

  @Patch("inspections/:id")
  @RequirePermissions("maintenance.manage")
  updateInspection(@Param("id") id: string, @Body() dto: UpsertInspectionDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertInspection(id, dto, actor.sub);
  }

  @Post("breakdowns")
  @RequirePermissions("maintenance.manage")
  createBreakdown(@Body() dto: UpsertBreakdownDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertBreakdown(undefined, dto, actor.sub);
  }

  @Patch("breakdowns/:id")
  @RequirePermissions("maintenance.manage")
  updateBreakdown(@Param("id") id: string, @Body() dto: UpsertBreakdownDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertBreakdown(id, dto, actor.sub);
  }

  @Patch("assets/:assetId/status")
  @RequirePermissions("maintenance.manage")
  updateAssetStatus(
    @Param("assetId") assetId: string,
    @Body() dto: UpdateAssetStatusDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateAssetStatus(assetId, dto, actor.sub);
  }
}
