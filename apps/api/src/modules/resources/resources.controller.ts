import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ResourcesService } from "./resources.service";
import {
  ResourcesQueryDto,
  UpsertAvailabilityWindowDto,
  UpsertShiftRoleRequirementDto,
  UpsertWorkerRoleSuitabilityDto
} from "./dto/resources.dto";

@ApiTags("Resources")
@ApiBearerAuth()
@Controller("resources")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}

  @Get("workers")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List workers with competencies, availability, and role suitability" })
  listWorkers(@Query() query: ResourcesQueryDto) {
    return this.service.listWorkers(query);
  }

  @Get("workers/:id")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "Get a single worker with full competencies, availability, suitability, and assigned-shift detail" })
  getWorker(@Param("id") id: string) {
    return this.service.getWorker(id);
  }

  @Post("availability-windows")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create availability window" })
  createAvailability(@Body() dto: UpsertAvailabilityWindowDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAvailabilityWindow(undefined, dto, actor.sub);
  }

  @Patch("availability-windows/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update availability window" })
  updateAvailability(@Param("id") id: string, @Body() dto: UpsertAvailabilityWindowDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAvailabilityWindow(id, dto, actor.sub);
  }

  @Post("role-suitabilities")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create role suitability" })
  createSuitability(@Body() dto: UpsertWorkerRoleSuitabilityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWorkerRoleSuitability(undefined, dto, actor.sub);
  }

  @Patch("role-suitabilities/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update role suitability" })
  updateSuitability(@Param("id") id: string, @Body() dto: UpsertWorkerRoleSuitabilityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWorkerRoleSuitability(id, dto, actor.sub);
  }

  @Get("shifts/:shiftId/requirements")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List shift role requirements" })
  listShiftRequirements(@Param("shiftId") shiftId: string) {
    return this.service.listShiftRequirements(shiftId);
  }

  @Post("shifts/:shiftId/requirements")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create shift role requirement" })
  createShiftRequirement(
    @Param("shiftId") shiftId: string,
    @Body() dto: UpsertShiftRoleRequirementDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.upsertShiftRequirement(shiftId, undefined, dto, actor.sub);
  }

  @Patch("shifts/:shiftId/requirements/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update shift role requirement" })
  updateShiftRequirement(
    @Param("shiftId") shiftId: string,
    @Param("id") id: string,
    @Body() dto: UpsertShiftRoleRequirementDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.upsertShiftRequirement(shiftId, id, dto, actor.sub);
  }
}
