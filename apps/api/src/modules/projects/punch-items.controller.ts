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
import {
  ClosePunchItemDto,
  CreatePunchItemDto,
  ListPunchItemsQueryDto,
  UpdatePunchItemDto
} from "./dto/punch-item.dto";
import { PunchItemsService } from "./punch-items.service";

type RequestUser = { sub: string };

/**
 * HTTP surface for the job-scoped punch / snag / defect list.
 *
 * List-by-job + create at `POST /jobs/:jobId/punch-items`; per-item
 * update / close / delete at `PATCH|POST|DELETE /punch-items/:id`. Reads
 * gated by `projects.view`, writes by `projects.manage`.
 */
@ApiTags("Projects")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PunchItemsController {
  constructor(private readonly service: PunchItemsService) {}

  @Get("jobs/:jobId/punch-items")
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List punch items for a job (filter by status / assignee)" })
  @ApiResponse({ status: 200, description: "Ordered by status → dueAt → createdAt DESC." })
  list(@Param("jobId") jobId: string, @Query() query: ListPunchItemsQueryDto) {
    return this.service.listByJob(jobId, query);
  }

  @Post("jobs/:jobId/punch-items")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Raise a new punch item on this job" })
  create(
    @Param("jobId") jobId: string,
    @Body() dto: CreatePunchItemDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.create(jobId, dto, actor.sub);
  }

  @Get("punch-items/:id")
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "Get a single punch item by id" })
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Patch("punch-items/:id")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Update fields, status, assignee, or due date" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePunchItemDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.update(id, dto, actor.sub);
  }

  @Post("punch-items/:id/close")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Close a punch item with an optional note + photo" })
  close(
    @Param("id") id: string,
    @Body() dto: ClosePunchItemDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.close(id, dto, actor.sub);
  }

  @Delete("punch-items/:id")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Delete a punch item (soft close is preferred — use for mistakes)" })
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
