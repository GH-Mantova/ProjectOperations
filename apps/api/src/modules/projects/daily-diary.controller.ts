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
import { DailyDiaryService } from "./daily-diary.service";
import {
  CreateDailyDiaryDto,
  ListDailyDiariesQueryDto,
  UpdateDailyDiaryDto
} from "./dto/daily-diary.dto";

type RequestUser = { sub: string; permissions: string[] };

/**
 * HTTP surface for the Daily Site Diary (ERP gap A). Routes are nested
 * under a project (`/projects/:projectId/daily-diary[/…]`) so that project
 * scoping is enforced at the URL level rather than trusted from the payload.
 *
 * Permission model mirrors {@link ProjectsController}:
 *  - `projects.view`   — list + getById.
 *  - `projects.manage` — create + update + delete a draft.
 *  - `projects.admin`  — un-submit a submitted diary, delete a submitted diary.
 */
@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects/:projectId/daily-diary")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DailyDiaryController {
  constructor(private readonly service: DailyDiaryService) {}

  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List daily diaries for a project, reverse-chronological, optional date window + pagination" })
  @ApiResponse({ status: 200, description: "Paginated list envelope." })
  list(@Param("projectId") projectId: string, @Query() query: ListDailyDiariesQueryDto) {
    return this.service.list(projectId, query);
  }

  @Get(":id")
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "Fetch a single daily diary by id (must belong to the given project)" })
  @ApiResponse({ status: 200, description: "Diary row with author + site joins." })
  @ApiResponse({ status: 404, description: "Diary not found for this project." })
  getById(@Param("projectId") projectId: string, @Param("id") id: string) {
    return this.service.getById(projectId, id);
  }

  @Post()
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Create a new daily diary. Unique per (project, date) — duplicate returns 409." })
  @ApiResponse({ status: 201, description: "Created." })
  @ApiResponse({ status: 409, description: "A diary already exists for this project and date." })
  create(
    @Param("projectId") projectId: string,
    @Body() dto: CreateDailyDiaryDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.create(projectId, dto, {
      userId: actor.sub,
      permissions: new Set(actor.permissions ?? [])
    });
  }

  @Patch(":id")
  @RequirePermissions("projects.manage")
  @ApiOperation({
    summary:
      "Update a daily diary's narrative fields, line items, attachments, or submitted state. Un-submitting requires author or admin."
  })
  @ApiResponse({ status: 200, description: "Updated." })
  @ApiResponse({ status: 403, description: "Only the author or an admin can un-submit a submitted diary." })
  update(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDailyDiaryDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.update(projectId, id, dto, {
      userId: actor.sub,
      permissions: new Set(actor.permissions ?? [])
    });
  }

  @Delete(":id")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Delete a draft diary. Submitted diaries require projects.admin." })
  @ApiResponse({ status: 200, description: "Deleted." })
  @ApiResponse({ status: 403, description: "Submitted diaries can only be deleted by an admin." })
  remove(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.remove(projectId, id, {
      userId: actor.sub,
      permissions: new Set(actor.permissions ?? [])
    });
  }
}
