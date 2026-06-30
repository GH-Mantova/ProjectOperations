import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
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
import { ScheduleAllocationService } from "./schedule-allocation.service";
import {
  EligibleWorkersQueryDto,
  RangeScheduleAllocationDto,
  ScheduleAllocationQueryDto,
  UpsertScheduleAllocationDto
} from "./dto/schedule-allocation.dto";

type AuthedUser = {
  sub: string;
  permissions?: ReadonlyArray<string>;
  isSuperUser?: boolean;
};

/**
 * REST endpoints for the §9 Scheduler day-grain allocation grid (PR-452).
 *
 * Anchors:
 *  - GET /scheduler/allocations         — read window of cells (grid orientation)
 *  - POST /scheduler/allocations        — upsert one cell
 *  - POST /scheduler/allocations/range  — fill/clear a date range for one resource
 *  - DELETE /scheduler/allocations/:id  — remove one cell
 *  - GET /scheduler/eligible-workers    — "fit the bill" list
 *
 * Requires `scheduler.view` for reads, `scheduler.manage` for mutations.
 */
@ApiTags("Scheduler — Allocations")
@ApiBearerAuth()
@Controller("scheduler")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScheduleAllocationController {
  constructor(private readonly service: ScheduleAllocationService) {}

  @Get("allocations")
  @RequirePermissions("scheduler.view")
  @ApiOperation({ summary: "List day-grain schedule allocations for a date window" })
  @ApiQuery({ name: "from", required: true, description: "Window start (inclusive) ISO date" })
  @ApiQuery({ name: "to", required: true, description: "Window end (inclusive) ISO date" })
  @ApiQuery({ name: "orientation", required: false, description: "project | resource" })
  @ApiQuery({ name: "projectId", required: false })
  @ApiResponse({ status: 200, description: "Cells in the window with computed conflict flags." })
  @ApiResponse({ status: 400, description: "Invalid date window." })
  list(@Query() query: ScheduleAllocationQueryDto) {
    return this.service.list(query);
  }

  @Post("allocations")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Upsert a single day-grain cell" })
  @ApiResponse({ status: 201, description: "Allocation upserted." })
  @ApiResponse({ status: 400, description: "Validation or target-shape mismatch." })
  @ApiResponse({ status: 403, description: "Override attempted without scheduler.manage." })
  @ApiResponse({ status: 404, description: "Project not found." })
  @ApiResponse({ status: 409, description: "Worker is not eligible — submit an override with a reason." })
  upsert(@Body() dto: UpsertScheduleAllocationDto, @CurrentUser() actor: AuthedUser) {
    return this.service.upsert(dto, {
      userId: actor.sub,
      permissions: actor.permissions,
      isSuperUser: actor.isSuperUser
    });
  }

  @Post("allocations/range")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Fill or clear a date range for one resource on one project" })
  @ApiResponse({ status: 201, description: "Range processed." })
  @ApiResponse({ status: 400, description: "Validation or target-shape mismatch." })
  @ApiResponse({ status: 404, description: "Project not found." })
  range(@Body() dto: RangeScheduleAllocationDto, @CurrentUser() actor: AuthedUser) {
    return this.service.range(dto, {
      userId: actor.sub,
      permissions: actor.permissions,
      isSuperUser: actor.isSuperUser
    });
  }

  @Delete("allocations/:id")
  @RequirePermissions("scheduler.manage")
  @ApiOperation({ summary: "Delete a single day-grain cell" })
  @ApiParam({ name: "id", description: "Schedule allocation id" })
  @ApiResponse({ status: 200, description: "Deleted." })
  @ApiResponse({ status: 404, description: "Not found." })
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Get("eligible-workers")
  @RequirePermissions("scheduler.view")
  @ApiOperation({ summary: "List workers that fit the bill for jobRole+date+project" })
  @ApiQuery({ name: "jobRoleId", required: true })
  @ApiQuery({ name: "date", required: true })
  @ApiQuery({ name: "projectId", required: true })
  @ApiQuery({ name: "showAll", required: false, description: "When true, returns all workers with eligibility flags." })
  @ApiResponse({ status: 200, description: "Workers with eligibility flag + reasons." })
  @ApiResponse({ status: 404, description: "Job role not found." })
  eligibleWorkers(@Query() query: EligibleWorkersQueryDto) {
    return this.service.eligibleWorkers(query);
  }
}
