import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateWorkerDto } from "./dto/create-worker.dto";
import { ListWorkersQueryDto, UpdateWorkerDto } from "./dto/update-worker.dto";
import { WorkersService } from "./workers.service";

@ApiTags("Workers")
@ApiBearerAuth()
@Controller("workers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkersController {
  constructor(private readonly service: WorkersService) {}

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
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary: "Create a worker profile. Mobile login provisioning happens separately in the auth flow."
  })
  @ApiResponse({ status: 201, description: "Created worker profile." })
  create(@Body() dto: CreateWorkerDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update a worker profile. internalUserId is set by the auth flow only." })
  @ApiResponse({ status: 200, description: "Updated worker profile." })
  @ApiResponse({ status: 404, description: "Worker not found." })
  update(@Param("id") id: string, @Body() dto: UpdateWorkerDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Soft delete — marks the worker profile inactive. Existing allocations stay intact." })
  @ApiResponse({ status: 200, description: "Deactivated worker profile." })
  @ApiResponse({ status: 404, description: "Worker not found." })
  deactivate(@Param("id") id: string) {
    return this.service.deactivate(id);
  }

  @Get(":id/allocations")
  @RequirePermissions("resources.view")
  @ApiOperation({
    summary: "List all allocations for a worker across all projects, ordered by startDate desc."
  })
  @ApiResponse({ status: 200, description: "All allocations for this worker (no pagination)." })
  allocations(@Param("id") id: string) {
    return this.service.allocationsForWorker(id);
  }
}
