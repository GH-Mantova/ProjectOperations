import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { GanttService } from "./gantt.service";

/**
 * Standalone controller for the cross-project timeline widget on the
 * dashboard.
 *
 * Exists separately from `GanttController` (which owns `projects/:projectId/
 * gantt/*` task CRUD) so the dashboard widget can hit a non-parameterised
 * path. Used by `ops_project_timeline`. Results are team-scoped: super-users
 * see all active projects, everyone else sees only the projects where they
 * are PM, supervisor, estimator, or WHS officer — the scoping is enforced
 * inside {@link GanttService.activeTimeline}.
 */
@ApiTags("Project Timeline")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects-timeline")
export class ProjectsTimelineController {
  constructor(private readonly gantt: GanttService) {}

  /**
   * Return one timeline row per active project the caller can see.
   *
   * Active = status in `MOBILISING / ACTIVE / PRACTICAL_COMPLETION / DEFECTS`
   * (CLOSED is excluded). Each row carries the planned start (falling back to
   * the actual start) and the planned end (falling back to the practical
   * completion date) for bar rendering.
   */
  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({
    summary: "Active projects with planned start/end for the timeline widget (team-scoped)."
  })
  @ApiResponse({ status: 200, description: "Active projects with planned start/end for the timeline widget (team-scoped)." })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.gantt.activeTimeline(user);
  }
}
