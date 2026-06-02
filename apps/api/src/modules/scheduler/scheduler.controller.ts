import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
import { SchedulerService } from "./scheduler.service";
import { AssignAssetDto, AssignWorkerDto, CreateShiftDto, SchedulerQueryDto, UpdateShiftDto } from "./dto/scheduler.dto";

@ApiTags("Scheduler")
@ApiBearerAuth()
@Controller("scheduler")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchedulerController {
  constructor(private readonly service: SchedulerService) {}

  @Get("workspace")
  @RequirePermissions("scheduler.view")
  @ApiOperation({ summary: "Get scheduler workspace data" })
  @ApiQuery({ name: "view", required: false, description: "Workspace view (e.g. board, calendar)" })
  @ApiQuery({ name: "mode", required: false, description: "Workspace mode (e.g. day, week)" })
  @ApiQuery({ name: "page", required: false, description: "Page number (1-based)" })
  @ApiQuery({ name: "pageSize", required: false, description: "Page size (max 100)" })
  @ApiQuery({ name: "limit", required: false, description: "Alias for pageSize (max 100)" })
  @ApiResponse({ status: 200, description: "Scheduler workspace payload with shifts, assignments and resources." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  workspace(@Query() query: SchedulerQueryDto) {
    return this.service.workspace(query);
  }

  @Post("shifts")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Create shift" })
  @ApiResponse({ status: 201, description: "Created shift." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Referenced job or job activity not found." })
  createShift(@Body() dto: CreateShiftDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createShift(dto, actor.sub);
  }

  @Patch("shifts/:shiftId")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Update shift" })
  @ApiParam({ name: "shiftId", description: "Shift id to update" })
  @ApiResponse({ status: 200, description: "Updated shift." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Shift or referenced job/activity not found." })
  updateShift(@Param("shiftId") shiftId: string, @Body() dto: UpdateShiftDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateShift(shiftId, dto, actor.sub);
  }

  @Post("shifts/:shiftId/workers")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Assign worker to shift" })
  @ApiParam({ name: "shiftId", description: "Shift id to assign the worker to" })
  @ApiResponse({ status: 201, description: "Worker assignment created." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Shift or worker not found." })
  @ApiResponse({ status: 409, description: "Worker already assigned to this shift." })
  assignWorker(@Param("shiftId") shiftId: string, @Body() dto: AssignWorkerDto, @CurrentUser() actor: { sub: string }) {
    return this.service.assignWorker(shiftId, dto, actor.sub);
  }

  @Delete("shifts/:shiftId/workers/:workerId")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Remove worker from shift" })
  @ApiParam({ name: "shiftId", description: "Shift id the worker is currently assigned to" })
  @ApiParam({ name: "workerId", description: "Worker id to unassign" })
  @ApiResponse({ status: 200, description: "Worker unassigned from shift." })
  @ApiResponse({ status: 404, description: "Shift, worker or assignment not found." })
  unassignWorker(@Param("shiftId") shiftId: string, @Param("workerId") workerId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.unassignWorker(shiftId, workerId, actor.sub);
  }

  @Post("shifts/:shiftId/assets")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Assign asset to shift" })
  @ApiParam({ name: "shiftId", description: "Shift id to assign the asset to" })
  @ApiResponse({ status: 201, description: "Asset assignment created." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Shift or asset not found." })
  @ApiResponse({ status: 409, description: "Asset already assigned to this shift." })
  assignAsset(@Param("shiftId") shiftId: string, @Body() dto: AssignAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.assignAsset(shiftId, dto, actor.sub);
  }

  @Delete("shifts/:shiftId/assets/:assetId")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Remove asset from shift" })
  @ApiParam({ name: "shiftId", description: "Shift id the asset is currently assigned to" })
  @ApiParam({ name: "assetId", description: "Asset id to unassign" })
  @ApiResponse({ status: 200, description: "Asset unassigned from shift." })
  @ApiResponse({ status: 404, description: "Shift, asset or assignment not found." })
  unassignAsset(@Param("shiftId") shiftId: string, @Param("assetId") assetId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.unassignAsset(shiftId, assetId, actor.sub);
  }
}
