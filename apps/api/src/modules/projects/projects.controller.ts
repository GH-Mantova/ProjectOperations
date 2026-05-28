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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto, ProjectStatusDto, UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

type RequestUser = { sub: string; permissions: string[] };

@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get("next-number")
  @ApiOperation({ summary: "Preview the next project number without consuming it (UI convenience)" })
  @ApiResponse({ status: 200, description: "Next project number, e.g. IS-P042." })
  nextNumber() {
    return this.service.previewNextNumber();
  }

  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List projects with status / client / PM / search filters + pagination" })
  list(@Query() query: ListProjectsQueryDto) {
    return this.service.list(query);
  }

  @Get(":id")
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "Get a single project with team, scope items, milestones, last 10 activity entries, and variance" })
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions("projects.admin")
  @ApiOperation({ summary: "Manually create a project (no source tender)" })
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: RequestUser) {
    return this.service.createManual(dto, { userId: actor.sub, permissions: new Set(actor.permissions ?? []) });
  }

  @Patch(":id")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Update project fields, team, budget, and actuals. contractValue additionally requires projects.admin." })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.update(id, dto, { userId: actor.sub, permissions: new Set(actor.permissions ?? []) });
  }

  @Post(":id/status")
  @RequirePermissions("projects.manage")
  @ApiOperation({
    summary:
      "Advance project status. Transitions enforce date-field requirements (actualStartDate / practicalCompletionDate / closedDate). Reopening a CLOSED project requires projects.admin."
  })
  @ApiResponse({ status: 400, description: "Invalid transition or missing required date field." })
  @ApiResponse({ status: 403, description: "Reopen requires projects.admin." })
  status(
    @Param("id") id: string,
    @Body() dto: ProjectStatusDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.transitionStatus(id, dto, { userId: actor.sub, permissions: new Set(actor.permissions ?? []) });
  }

  @Get(":id/activity")
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "Paginated reverse-chronological activity log for this project" })
  activity(
    @Param("id") id: string,
    @Query("page") page = "1",
    @Query("limit") limit = "25"
  ) {
    return this.service.activity(id, Number(page) || 1, Number(limit) || 25);
  }

  @Get(":id/revert-to-tender/preflight")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary:
      "Returns cascade counts so the UI can show what will be destroyed when reverting this project back to its source tender"
  })
  @ApiResponse({ status: 200, description: "Preflight summary with project info, source tender, and cascade counts." })
  @ApiResponse({ status: 400, description: "Project was not converted from a tender." })
  @ApiResponse({ status: 404, description: "Project not found." })
  revertPreflight(@Param("id") id: string) {
    return this.service.revertToTenderPreflight(id);
  }

  @Delete(":id/revert-to-tender")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary:
      "Hard-delete the project and all related records, reset the source tender status to CONTRACT_ISSUED, and write an audit log entry. Wrapped in a single transaction."
  })
  @ApiResponse({ status: 200, description: "Revert succeeded — returns tenderId, timestamp, and cascade counts." })
  @ApiResponse({ status: 400, description: "Project was not converted from a tender." })
  @ApiResponse({ status: 404, description: "Project not found." })
  revertToTender(@Param("id") id: string, @CurrentUser() actor: RequestUser) {
    return this.service.revertToTender(id, actor.sub);
  }
}
