import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AllocationsService } from "./allocations.service";
import { CreateAllocationDto } from "./dto/create-allocation.dto";
import { UpdateAllocationDto } from "./dto/update-allocation.dto";

type RequestUser = { sub: string };

@ApiTags("Allocations")
@ApiBearerAuth()
@Controller("projects/:projectId/allocations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AllocationsController {
  constructor(private readonly service: AllocationsService) {}

  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List worker + asset allocations for a project, grouped." })
  @ApiResponse({ status: 200, description: "{ workers: [], assets: [] }" })
  @ApiResponse({ status: 404, description: "Project not found." })
  list(@Param("projectId") projectId: string) {
    return this.service.listForProject(projectId);
  }

  @Post()
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary:
      "Create a worker or asset allocation on a project. For WORKER allocations, overlapping allocations on other active/mobilising projects are surfaced as warnings (no hard block)."
  })
  @ApiResponse({
    status: 201,
    description: "{ allocation, warnings: [{ projectId, projectNumber, projectName, startDate, endDate }] }"
  })
  @ApiResponse({
    status: 400,
    description: "Type/target mismatch (WORKER requires workerProfileId, ASSET requires assetId)."
  })
  @ApiResponse({ status: 404, description: "Project not found." })
  create(
    @Param("projectId") projectId: string,
    @Body() dto: CreateAllocationDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.create(projectId, dto, { userId: actor.sub });
  }

  @Patch(":allocId")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update role/dates/notes. type, workerProfileId, and assetId are immutable." })
  @ApiResponse({ status: 200, description: "Updated allocation." })
  @ApiResponse({ status: 404, description: "Allocation not found for this project." })
  update(
    @Param("projectId") projectId: string,
    @Param("allocId") allocId: string,
    @Body() dto: UpdateAllocationDto
  ) {
    return this.service.update(projectId, allocId, dto);
  }

  @Delete(":allocId")
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary: "Hard delete an allocation — operational record, not audit-critical. No activity log entry."
  })
  @ApiResponse({ status: 200, description: "{ deleted: true }" })
  @ApiResponse({ status: 404, description: "Allocation not found for this project." })
  remove(@Param("projectId") projectId: string, @Param("allocId") allocId: string) {
    return this.service.remove(projectId, allocId);
  }
}
