import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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
  workspace(@Query() query: SchedulerQueryDto) {
    return this.service.workspace(query);
  }

  @Post("shifts")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Create shift" })
  createShift(@Body() dto: CreateShiftDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createShift(dto, actor.sub);
  }

  @Patch("shifts/:shiftId")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Update shift" })
  updateShift(@Param("shiftId") shiftId: string, @Body() dto: UpdateShiftDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateShift(shiftId, dto, actor.sub);
  }

  @Post("shifts/:shiftId/workers")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Assign worker to shift" })
  assignWorker(@Param("shiftId") shiftId: string, @Body() dto: AssignWorkerDto, @CurrentUser() actor: { sub: string }) {
    return this.service.assignWorker(shiftId, dto, actor.sub);
  }

  @Delete("shifts/:shiftId/workers/:workerId")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Remove worker from shift" })
  unassignWorker(@Param("shiftId") shiftId: string, @Param("workerId") workerId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.unassignWorker(shiftId, workerId, actor.sub);
  }

  @Post("shifts/:shiftId/assets")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Assign asset to shift" })
  assignAsset(@Param("shiftId") shiftId: string, @Body() dto: AssignAssetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.assignAsset(shiftId, dto, actor.sub);
  }

  @Delete("shifts/:shiftId/assets/:assetId")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Remove asset from shift" })
  unassignAsset(@Param("shiftId") shiftId: string, @Param("assetId") assetId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.unassignAsset(shiftId, assetId, actor.sub);
  }
}
