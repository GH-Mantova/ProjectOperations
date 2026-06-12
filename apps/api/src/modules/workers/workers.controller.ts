import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateWorkerDto } from "./dto/create-worker.dto";
import { ProvisionMobileAccessDto } from "./dto/provision-mobile-access.dto";
import { ListWorkersQueryDto, UpdateWorkerDto } from "./dto/update-worker.dto";
import { WorkersService } from "./workers.service";

/**
 * REST endpoints for the HR/compliance worker roster under /workers.
 *
 * All routes require a JWT plus `resources.view` (reads) or
 * `resources.manage` (writes). Deletion is a soft delete (isActive=false),
 * and provision-mobile-access creates a linked Field Worker user account.
 */
@ApiTags("Workers")
@ApiBearerAuth()
@Controller("workers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkersController {
  constructor(private readonly service: WorkersService) {}

  /**
   * List worker profiles (HR/compliance roster). Defaults to active workers.
   *
   * @param query - search / role / isActive filters plus page and limit
   * @returns paginated list of worker profile summaries
   */
  @Get()
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List worker profiles (HR/compliance roster). Defaults to active workers." })
  @ApiResponse({ status: 200, description: "Paginated list of worker profiles." })
  list(@Query() query: ListWorkersQueryDto) {
    return this.service.list(query);
  }

  @Get(":id")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "Get a single worker profile with current + upcoming project allocations." })
  @ApiResponse({ status: 200, description: "Worker profile with allocations." })
  @ApiResponse({ status: 404, description: "Worker not found." })
  /**
   * Get a single worker profile with current + upcoming project allocations.
   *
   * @param id - worker profile id
   * @returns the profile with non-ended allocations and their projects
   * @throws NotFoundException when the worker does not exist
   */
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary: "Create a worker profile. Mobile login provisioning happens separately in the auth flow."
  })
  @ApiResponse({ status: 201, description: "Created worker profile." })
  /**
   * Create a worker profile. Mobile login provisioning happens separately
   * in the auth flow.
   *
   * @param dto - worker profile fields (names, role, contact, licences, tickets)
   * @returns the created worker profile
   */
  create(@Body() dto: CreateWorkerDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update a worker profile. internalUserId is set by the auth flow only." })
  @ApiResponse({ status: 200, description: "Updated worker profile." })
  @ApiResponse({ status: 404, description: "Worker not found." })
  /**
   * Update a worker profile. internalUserId is set by the auth flow only.
   *
   * @param id - worker profile id
   * @param dto - partial worker profile fields
   * @returns the updated worker profile
   * @throws NotFoundException when the worker does not exist
   */
  update(@Param("id") id: string, @Body() dto: UpdateWorkerDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Soft delete — marks the worker profile inactive. Existing allocations stay intact." })
  @ApiResponse({ status: 200, description: "Deactivated worker profile." })
  @ApiResponse({ status: 404, description: "Worker not found." })
  /**
   * Soft delete — marks the worker profile inactive. Existing allocations
   * stay intact.
   *
   * @param id - worker profile id
   * @returns the deactivated worker profile
   * @throws NotFoundException when the worker does not exist
   */
  deactivate(@Param("id") id: string) {
    return this.service.deactivate(id);
  }

  @Get(":id/allocations")
  @RequirePermissions("resources.view")
  @ApiOperation({
    summary: "List all allocations for a worker across all projects, ordered by startDate desc."
  })
  @ApiResponse({ status: 200, description: "All allocations for this worker (no pagination)." })
  /**
   * List all allocations for a worker across all projects, ordered by
   * startDate desc.
   *
   * @param id - worker profile id
   * @returns all allocations for this worker (no pagination)
   */
  allocations(@Param("id") id: string) {
    return this.service.allocationsForWorker(id);
  }

  @Post(":id/provision-mobile-access")
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary:
      "Provision a field-worker login for this worker. Creates a User with the Field Worker role and forcePasswordReset=true, links it to the worker profile, and flips hasMobileAccess to true."
  })
  @ApiResponse({
    status: 201,
    description: "{ message, userId } — caller must show the temp password to the office user once; it is not stored in plain text."
  })
  @ApiResponse({
    status: 400,
    description: "Mobile access already provisioned, email missing/duplicated, or Field Worker role not seeded."
  })
  @ApiResponse({ status: 404, description: "Worker not found." })
  /**
   * Provision a field-worker login for this worker. Creates a User with
   * the Field Worker role and forcePasswordReset=true, links it to the
   * worker profile, and flips hasMobileAccess to true.
   *
   * @param id - worker profile id
   * @param dto - tempPassword the caller must show to the office user once
   * @returns { message, userId } — the temp password is never stored in plain text
   * @throws NotFoundException when the worker does not exist
   * @throws BadRequestException when already provisioned, email missing/duplicated, or Field Worker role not seeded
   */
  provisionMobileAccess(@Param("id") id: string, @Body() dto: ProvisionMobileAccessDto) {
    return this.service.provisionMobileAccess(id, dto.tempPassword);
  }
}
