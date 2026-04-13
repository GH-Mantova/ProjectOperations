import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { MaintenanceService } from "./maintenance.service";
import {
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

  @Get("assets/:assetId")
  @RequirePermissions("maintenance.view")
  @ApiOperation({ summary: "Get maintenance detail for asset" })
  getAsset(@Param("assetId") assetId: string) {
    return this.service.getAssetMaintenance(assetId);
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
