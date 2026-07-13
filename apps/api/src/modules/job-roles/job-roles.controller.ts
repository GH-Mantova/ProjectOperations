import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateJobRoleDto } from "./dto/create-job-role.dto";
import { UpdateJobRoleDto } from "./dto/update-job-role.dto";
import { JobRolesService } from "./job-roles.service";

/**
 * Catalogue of named job functions (Supervisor, Machine Operator, Asbestos
 * Labourer Class A, etc.). Each role bundles the competencies a worker must
 * hold to be eligible. Pure CRUD — eligibility evaluation lives in the
 * scheduler module (downstream PR).
 */
@ApiTags("Job Roles")
@ApiBearerAuth()
@Controller("job-roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobRolesController {
  constructor(private readonly service: JobRolesService) {}

  @Get()
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "List job roles with their competency requirements." })
  @ApiResponse({ status: 200, description: "JobRole[] with embedded requirements." })
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermissions("resources.view")
  @ApiOperation({ summary: "Fetch a single job role with its requirements." })
  @ApiResponse({ status: 200, description: "JobRole" })
  @ApiResponse({ status: 404, description: "Job role not found." })
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Create a job role and its competency requirements." })
  @ApiResponse({ status: 201, description: "Created JobRole." })
  @ApiResponse({ status: 400, description: "Duplicate competency in requirements or unknown competency id." })
  @ApiResponse({ status: 409, description: "A job role with this name already exists." })
  create(@Body() dto: CreateJobRoleDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update a job role. Supplying `requirements` replaces the full set." })
  @ApiResponse({ status: 200, description: "Updated JobRole." })
  @ApiResponse({ status: 404, description: "Job role not found." })
  @ApiResponse({ status: 409, description: "Name collision." })
  update(@Param("id") id: string, @Body() dto: UpdateJobRoleDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Delete a job role." })
  @ApiResponse({ status: 200, description: "{ deleted: true }" })
  @ApiResponse({ status: 404, description: "Job role not found." })
  @ApiResponse({
    status: 409,
    description: "Role is used by one or more ScheduleAllocation rows; deactivate instead."
  })
  remove(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.remove(id, actor.sub);
  }
}
