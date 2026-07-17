import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { SchedulerSuggestionService } from "./suggestion.service";
import { SchedulerSuggestQueryDto } from "./dto/suggestion.dto";

/**
 * §9 Scheduler — Suggest engine endpoint (D365 Field Service RSO parity, phase 1).
 *
 *   GET /scheduler/suggestions — assistive shortlist for one open slot.
 *
 * Read-only. Requires `scheduler.view`. No allocation is created; the
 * planner picks and calls the existing POST /scheduler/allocations path.
 */
@ApiTags("Scheduler — Suggestions")
@ApiBearerAuth()
@Controller("scheduler")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchedulerSuggestionController {
  constructor(private readonly service: SchedulerSuggestionService) {}

  @Get("suggestions")
  @RequirePermissions("scheduler.view")
  @ApiOperation({ summary: "Ranked, explainable shortlist for an open slot (assistive; no auto-assign)" })
  @ApiQuery({ name: "date", required: true })
  @ApiQuery({ name: "projectId", required: true })
  @ApiQuery({ name: "jobRoleId", required: false })
  @ApiQuery({ name: "targetType", required: false, description: "WORKER (default) | ASSET" })
  @ApiQuery({ name: "limit", required: false, description: "1..25 (default 5)" })
  @ApiQuery({ name: "includeIneligible", required: false })
  @ApiResponse({ status: 200, description: "Ranked shortlist with explainable reasons." })
  @ApiResponse({ status: 404, description: "Project or job role not found." })
  suggestions(@Query() query: SchedulerSuggestQueryDto) {
    return this.service.suggestAllocation(query);
  }
}
