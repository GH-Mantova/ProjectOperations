import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { GanttService } from "./gantt.service";

/**
 * Request DTO for creating or updating a Gantt task.
 *
 * All fields are optional so the same shape can drive both POST (create) and
 * PATCH (partial update). Validation invariants enforced by
 * {@link GanttService}: `title` is required on create, `startDate` and
 * `endDate` must both be present on create, and `endDate` must be on or
 * after `startDate` (re-checked on partial updates against the effective
 * values so a PATCH can't invert the bar).
 */
class UpsertGanttTaskDto {
  /** Free-text task title. Required on create; trimmed before persisting. */
  @IsOptional() @IsString() title?: string;
  /** Discipline tag (`DEM` / `CIV` / `ASB` / `Other`, plus legacy aliases). Pass `null` to clear. */
  @IsOptional() @IsString() discipline?: string | null;
  /** ISO date string for the bar start. Required on create. */
  @IsOptional() @IsString() startDate?: string;
  /** ISO date string for the bar end. Required on create; must be ≥ startDate. */
  @IsOptional() @IsString() endDate?: string;
  /** Completion percent 0–100; clamped on update. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress?: number;
  /** Hex bar colour. Defaults to the discipline colour when omitted on create. */
  @IsOptional() @IsString() colour?: string | null;
  /** Array of upstream task ids (string FKs) — drives the dependency arrows on the Gantt chart. */
  @IsOptional() @IsArray() @IsString({ each: true }) dependencies?: string[];
  /** Assigned user id, or `null` to unassign. */
  @IsOptional() @IsString() assignedToId?: string | null;
  /** Render order within the Gantt — lower sorts first. */
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
}

/**
 * HTTP controller for project-scoped Gantt task CRUD plus scope-driven task
 * generation.
 *
 * All routes are parameterised by `:projectId` and access is team-scoped via
 * {@link GanttService.requireProjectAccess}: super-users see all projects,
 * others only see projects where they are on the team (PM, supervisor,
 * estimator, WHS officer, or creator). Missing-access surfaces as 404 (not
 * 403) so existence is not leaked.
 *
 * Permissions:
 *  - `projects.view` — list.
 *  - `projects.manage` — create, patch, delete, generate.
 */
@ApiTags("Project Gantt")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects/:projectId/gantt")
export class GanttController {
  constructor(private readonly service: GanttService) {}

  /**
   * List Gantt tasks for the project ordered by `sortOrder` then `startDate`.
   * Includes the assigned user (id + name). Throws 404 if the caller cannot
   * see the project.
   */
  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List Gantt tasks for the project (team-scoped)." })
  @ApiResponse({ status: 200, description: "Tasks listed." })
  list(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(projectId, user);
  }

  /**
   * Create a Gantt task. Validates that title, startDate, and endDate are
   * present and that endDate ≥ startDate. When `colour` is omitted, falls
   * back to the discipline colour map.
   */
  @Post()
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Create a Gantt task on the project." })
  @ApiResponse({ status: 201, description: "Task created." })
  create(
    @Param("projectId") projectId: string,
    @Body() dto: UpsertGanttTaskDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.create(projectId, dto as never, user);
  }

  /**
   * Partially update a Gantt task. Re-validates the effective (incoming or
   * existing) start/end pair so a PATCH that updates only one date cannot
   * invert the bar. `progress` is clamped to [0, 100].
   */
  @Patch(":taskId")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Update a Gantt task." })
  @ApiResponse({ status: 200, description: "Task updated." })
  patch(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpsertGanttTaskDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.update(projectId, taskId, dto as never, user);
  }

  /**
   * Delete a Gantt task. Throws 404 if the task does not belong to the
   * project (the projectId/taskId pair is enforced as the scope).
   */
  @Delete(":taskId")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Delete a Gantt task." })
  @ApiResponse({ status: 200, description: "Task deleted." })
  remove(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.remove(projectId, taskId, user);
  }

  /**
   * Auto-generate one task per discipline from the project's source-tender
   * scope. Sums each discipline's days (falling back to 5 days per item when
   * unset) and stacks the bars sequentially from the project's planned start
   * date (or today) so the timeline is non-overlapping out of the box —
   * operators are expected to drag bars after generation.
   *
   * Throws 400 if the project has no source tender, 400 if the source has no
   * scope items, 400 if no scope items carry a discipline tag.
   */
  @Post("generate")
  @RequirePermissions("projects.manage")
  @ApiOperation({
    summary: "Generate Gantt tasks from the project's source-tender scope. One task per discipline."
  })
  @ApiResponse({ status: 201, description: "Generate Gantt tasks from the project's source-tender scope. One task per discipline." })
  generate(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generateFromScope(projectId, user);
  }
}
