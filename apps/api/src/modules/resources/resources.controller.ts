import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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

/**
 * REST endpoints for scheduler-facing resource data under /resources:
 * workers, availability windows, role suitabilities, and shift role
 * requirements.
 *
 * All routes require a JWT plus either `resources.view` (reads) or
 * `resources.manage` (writes). Mutations pass the acting user's id to the
 * service so every change is audit-logged.
 */
@ApiTags("Resources")
@ApiBearerAuth()
@Controller("resources")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}

  /**
   * List workers with competencies, availability, and role suitability.
   *
   * @param query - free-text q, competencyId filter, page and pageSize
   * @returns paginated workers with eager-loaded related records
   */
  @Get("workers")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List workers with competencies, availability, and role suitability" })
  @ApiResponse({ status: 200, description: "List workers with competencies, availability, and role suitability." })
  listWorkers(@Query() query: ResourcesQueryDto) {
    return this.service.listWorkers(query);
  }

  @Get("workers/:id")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "Get a single worker with full competencies, availability, suitability, and assigned-shift detail" })
  @ApiResponse({ status: 200, description: "Worker detail record with eager-loaded competencies, availability windows, role suitabilities, and assigned shifts (each including job, activity, and conflicts)." })
  @ApiResponse({ status: 404, description: "Worker not found." })
  /**
   * Get a single worker with full competencies, availability, suitability,
   * and assigned-shift detail.
   *
   * @param id - worker id
   * @returns the worker with shift assignments including job, activity, and conflicts
   * @throws NotFoundException when the worker does not exist
   */
  getWorker(@Param("id") id: string) {
    return this.service.getWorker(id);
  }

  /**
   * Create availability window.
   *
   * @param dto - workerId, startAt/endAt, optional status (defaults AVAILABLE) and notes
   * @returns the created availability window
   */
  @Post("availability-windows")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create availability window" })
  @ApiResponse({ status: 201, description: "Create availability window." })
  createAvailability(@Body() dto: UpsertAvailabilityWindowDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAvailabilityWindow(undefined, dto, actor.sub);
  }

  /**
   * Update availability window.
   *
   * @param id - availability window id
   * @param dto - replacement window fields
   * @returns the updated availability window
   */
  @Patch("availability-windows/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update availability window" })
  @ApiResponse({ status: 200, description: "Update availability window." })
  updateAvailability(@Param("id") id: string, @Body() dto: UpsertAvailabilityWindowDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertAvailabilityWindow(id, dto, actor.sub);
  }

  /**
   * Create role suitability.
   *
   * @param dto - workerId, roleLabel, optional suitability (defaults SUITABLE) and notes
   * @returns the created role suitability record
   * @throws ConflictException when the worker already has suitability for that role
   */
  @Post("role-suitabilities")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create role suitability" })
  @ApiResponse({ status: 201, description: "Create role suitability." })
  createSuitability(@Body() dto: UpsertWorkerRoleSuitabilityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWorkerRoleSuitability(undefined, dto, actor.sub);
  }

  /**
   * Update role suitability.
   *
   * @param id - role suitability id
   * @param dto - replacement suitability fields
   * @returns the updated role suitability record
   */
  @Patch("role-suitabilities/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update role suitability" })
  @ApiResponse({ status: 200, description: "Update role suitability." })
  updateSuitability(@Param("id") id: string, @Body() dto: UpsertWorkerRoleSuitabilityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWorkerRoleSuitability(id, dto, actor.sub);
  }

  /**
   * List shift role requirements.
   *
   * @param shiftId - shift id whose requirements to list
   * @returns requirements with competency included, oldest first
   */
  @Get("shifts/:shiftId/requirements")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List shift role requirements" })
  @ApiResponse({ status: 200, description: "List shift role requirements." })
  listShiftRequirements(@Param("shiftId") shiftId: string) {
    return this.service.listShiftRequirements(shiftId);
  }

  /**
   * Create shift role requirement.
   *
   * @param shiftId - shift the requirement belongs to
   * @param dto - roleLabel, optional competencyId, requiredCount (defaults 1)
   * @returns the full requirement list for the shift after the create
   * @throws NotFoundException when the shift does not exist
   */
  @Post("shifts/:shiftId/requirements")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create shift role requirement" })
  @ApiResponse({ status: 201, description: "Create shift role requirement." })
  createShiftRequirement(
    @Param("shiftId") shiftId: string,
    @Body() dto: UpsertShiftRoleRequirementDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.upsertShiftRequirement(shiftId, undefined, dto, actor.sub);
  }

  /**
   * Update shift role requirement.
   *
   * @param shiftId - shift the requirement belongs to
   * @param id - requirement id to update
   * @param dto - replacement requirement fields
   * @returns the full requirement list for the shift after the update
   * @throws NotFoundException when the shift does not exist
   */
  @Patch("shifts/:shiftId/requirements/:id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update shift role requirement" })
  @ApiResponse({ status: 200, description: "Update shift role requirement." })
  updateShiftRequirement(
    @Param("shiftId") shiftId: string,
    @Param("id") id: string,
    @Body() dto: UpsertShiftRoleRequirementDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.upsertShiftRequirement(shiftId, id, dto, actor.sub);
  }
}
