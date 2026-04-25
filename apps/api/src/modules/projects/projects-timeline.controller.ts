import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { GanttService } from "./gantt.service";

// Standalone controller so the dashboard widget can hit a non-:id path. The
// projects/:projectId routes already own the parameterised Gantt CRUD; this
// is the cross-project timeline summary used by ops_project_timeline.
@ApiTags("Project Timeline")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects-timeline")
export class ProjectsTimelineController {
  constructor(private readonly gantt: GanttService) {}

  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({
    summary: "Active projects with planned start/end for the timeline widget (team-scoped)."
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.gantt.activeTimeline(user);
  }
}
