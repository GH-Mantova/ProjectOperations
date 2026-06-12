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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
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

/**
 * REST endpoints for worker leave and unavailability under /workers
 * (leaves, unavailability, and the scheduler's availability overlay).
 *
 * Routes require a JWT; create routes only need `resources.view` so
 * workers can self-serve, with ownership enforced in the service (a
 * non-super-user may only lodge records for their own linked worker
 * profile). Status changes and deletes need `resources.manage`, and the
 * overlay needs `scheduler.view`.
 */
@ApiTags("Worker Availability")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("workers")
export class WorkerAvailabilityController {
  constructor(private readonly service: WorkerAvailabilityService) {}

  /**
   * Calendar overlay: approved leave + unavailability (recurring expanded)
   * within a date window.
   *
   * @param query - from/to ISO dates and optional workerProfileId filter
   * @returns flat list of leave and unavailability bars for the scheduler
   * @throws BadRequestException when to is before from
   */
  @Get("availability/overlay")
  @RequirePermissions("scheduler.view")
  @ApiOperation({
    summary:
      "Calendar overlay: approved leave + unavailability (recurring expanded) within a date window."
  })
  @ApiResponse({ status: 200, description: "Calendar overlay: approved leave + unavailability (recurring expanded) within a date window." })
  overlay(@Query() query: AvailabilityRangeQueryDto) {
    return this.service.overlay(query);
  }

  // ── Leaves ───────────────────────────────────────────────────────────────
  @Get("leaves")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List worker leave requests." })
  @ApiResponse({ status: 200, description: "List worker leave requests." })
  @ApiQuery({ name: "workerProfileId", required: false, type: String, description: "Filter to a single worker" })
  /**
   * List worker leave requests.
   *
   * @param workerProfileId - optional filter to a single worker
   * @returns leave requests, newest startDate first, with worker/approver/requester names
   */
  listLeaves(@Query("workerProfileId") workerProfileId?: string) {
    return this.service.listLeaves(workerProfileId);
  }

  @Post("leaves")
  @RequirePermissions("resources.view")
  @ApiOperation({
    summary:
      "Create a worker leave request (status defaults to PENDING). Workers self-serve for their own profile; super-users may lodge for any worker."
  })
  @ApiResponse({ status: 201, description: "Create a worker leave request (status defaults to PENDING). Workers self-serve for their own profile; super-users may lodge for any worker." })
  /**
   * Create a worker leave request (status defaults to PENDING). Workers
   * self-serve for their own profile; super-users may lodge for any worker.
   *
   * @param dto - workerProfileId, leaveType, startDate/endDate, optional notes
   * @returns the created leave request
   * @throws BadRequestException when endDate is before startDate
   * @throws NotFoundException when the worker does not exist
   * @throws ForbiddenException when lodging for another worker without super-user
   */
  createLeave(@Body() dto: CreateWorkerLeaveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createLeave(dto, user);
  }

  @Patch("leaves/:id/status")
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary: "Approve, decline, or cancel a leave request. Self-approval is rejected."
  })
  @ApiResponse({ status: 200, description: "Approve, decline, or cancel a leave request. Self-approval is rejected." })
  /**
   * Approve, decline, or cancel a leave request. Self-approval is rejected.
   *
   * @param id - leave request id
   * @param dto - new status and optional notes
   * @returns the updated leave request
   * @throws NotFoundException when the leave request does not exist
   * @throws ForbiddenException when approving one's own leave request
   */
  setLeaveStatus(
    @Param("id") id: string,
    @Body() dto: UpdateWorkerLeaveStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.setLeaveStatus(id, dto, user);
  }

  @Delete("leaves/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Delete a leave request." })
  @ApiResponse({ status: 200, description: "Delete a leave request." })
  /**
   * Delete a leave request.
   *
   * @param id - leave request id
   * @returns { id } of the deleted record
   * @throws NotFoundException when the leave request does not exist
   */
  deleteLeave(@Param("id") id: string) {
    return this.service.deleteLeave(id);
  }

  // ── Unavailability ───────────────────────────────────────────────────────
  @Get("unavailability")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List worker unavailability blocks (RDOs, training, holds)." })
  @ApiResponse({ status: 200, description: "List worker unavailability blocks (RDOs, training, holds)." })
  @ApiQuery({ name: "workerProfileId", required: false, type: String, description: "Filter to a single worker" })
  /**
   * List worker unavailability blocks (RDOs, training, holds).
   *
   * @param workerProfileId - optional filter to a single worker
   * @returns unavailability blocks, newest startDate first
   */
  listUnavailability(@Query("workerProfileId") workerProfileId?: string) {
    return this.service.listUnavailability(workerProfileId);
  }

  @Post("unavailability")
  @RequirePermissions("resources.view")
  @ApiOperation({
    summary:
      "Create a worker unavailability block. recurringDay (0–6) for weekly recurrence. Workers self-serve; super-users may lodge for any worker."
  })
  @ApiResponse({ status: 201, description: "Create a worker unavailability block. recurringDay (0–6) for weekly recurrence. Workers self-serve; super-users may lodge for any worker." })
  /**
   * Create a worker unavailability block. recurringDay (0–6) for weekly
   * recurrence. Workers self-serve; super-users may lodge for any worker.
   *
   * @param dto - workerProfileId, reason, startDate/endDate, optional recurringDay
   * @returns the created unavailability block
   * @throws BadRequestException when endDate is before startDate
   * @throws NotFoundException when the worker does not exist
   * @throws ForbiddenException when lodging for another worker without super-user
   */
  createUnavailability(
    @Body() dto: CreateWorkerUnavailabilityDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.createUnavailability(dto, user);
  }

  @Delete("unavailability/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Delete a worker unavailability block." })
  @ApiResponse({ status: 200, description: "Delete a worker unavailability block." })
  /**
   * Delete a worker unavailability block.
   *
   * @param id - unavailability block id
   * @returns { id } of the deleted record
   * @throws NotFoundException when the block does not exist
   */
  deleteUnavailability(@Param("id") id: string) {
    return this.service.deleteUnavailability(id);
  }
}
