import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { WorkerAvailabilityService } from "./availability.service";
import {
  AvailabilityRangeQueryDto,
  CreateWorkerLeaveDto,
  CreateWorkerUnavailabilityDto,
  UpdateWorkerLeaveStatusDto
} from "./dto/availability.dto";

@ApiTags("Worker Availability")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("workers")
export class WorkerAvailabilityController {
  constructor(private readonly service: WorkerAvailabilityService) {}

  @Get("availability/overlay")
  @RequirePermissions("scheduler.view")
  @ApiOperation({
    summary:
      "Calendar overlay: approved leave + unavailability (recurring expanded) within a date window."
  })
  overlay(@Query() query: AvailabilityRangeQueryDto) {
    return this.service.overlay(query);
  }

  // ── Leaves ───────────────────────────────────────────────────────────────
  @Get("leaves")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List worker leave requests." })
  listLeaves(@Query("workerProfileId") workerProfileId?: string) {
    return this.service.listLeaves(workerProfileId);
  }

  @Post("leaves")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create a worker leave request (status defaults to PENDING)." })
  createLeave(@Body() dto: CreateWorkerLeaveDto) {
    return this.service.createLeave(dto);
  }

  @Patch("leaves/:id/status")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Approve, decline, or cancel a leave request." })
  setLeaveStatus(
    @Param("id") id: string,
    @Body() dto: UpdateWorkerLeaveStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.setLeaveStatus(id, dto, user.sub);
  }

  @Delete("leaves/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Delete a leave request." })
  deleteLeave(@Param("id") id: string) {
    return this.service.deleteLeave(id);
  }

  // ── Unavailability ───────────────────────────────────────────────────────
  @Get("unavailability")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List worker unavailability blocks (RDOs, training, holds)." })
  listUnavailability(@Query("workerProfileId") workerProfileId?: string) {
    return this.service.listUnavailability(workerProfileId);
  }

  @Post("unavailability")
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary: "Create a worker unavailability block. recurringDay (0–6) for weekly recurrence."
  })
  createUnavailability(@Body() dto: CreateWorkerUnavailabilityDto) {
    return this.service.createUnavailability(dto);
  }

  @Delete("unavailability/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Delete a worker unavailability block." })
  deleteUnavailability(@Param("id") id: string) {
    return this.service.deleteUnavailability(id);
  }
}
