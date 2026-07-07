import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
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

  /**
   * Compact program snapshot for the dashboard Gantt widget: top N active
   * projects (ranked by count of tasks intersecting the window) with their
   * Gantt tasks clipped to a `windowDays` rolling window from today.
   */
  @Get("program-snapshot")
  @RequirePermissions("projects.view")
  @ApiOperation({
    summary: "Top-N active projects + their Gantt tasks within a rolling window (team-scoped)."
  })
  @ApiQuery({ name: "windowDays", required: false, description: "Rolling window in days (7–90, default 28)." })
  @ApiQuery({ name: "topN", required: false, description: "Max projects returned (1–20, default 8)." })
  @ApiResponse({ status: 200, description: "Program snapshot returned." })
  programSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Query("windowDays") windowDays?: string,
    @Query("topN") topN?: string
  ) {
    return this.gantt.programSnapshot(user, {
      windowDays: windowDays ? Number(windowDays) : 28,
      topN: topN ? Number(topN) : 8
    });
  }
}
