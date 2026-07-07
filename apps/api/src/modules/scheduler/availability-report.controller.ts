import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AvailabilityReportService } from "./availability-report.service";
import { AvailabilityReportQueryDto } from "./dto/availability-report.dto";

/**
 * PR-454 — Availability heatmap endpoints.
 *
 *  - GET /scheduler/availability-report      — JSON heatmap + detailed worker list
 *  - GET /scheduler/availability-report.csv  — same data as RFC 4180 CSV
 *
 * Reads only — no mutations. Requires `scheduler.view`.
 */
@ApiTags("Scheduler — Availability report")
@ApiBearerAuth()
@Controller("scheduler")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AvailabilityReportController {
  constructor(private readonly service: AvailabilityReportService) {}

  @Get("availability-report")
  @RequirePermissions("scheduler.view")
  @ApiOperation({
    summary:
      "Month availability heatmap: per-group available/total per day + unique-by-name total + detailed per-worker breakdown."
  })
  @ApiQuery({ name: "month", required: true, description: "Month (YYYY-MM)." })
  @ApiQuery({
    name: "skipNonWorkingDays",
    required: false,
    type: Boolean,
    description: "When true, weekends and PublicHoliday rows are excluded from totals."
  })
  @ApiResponse({ status: 200, description: "Heatmap matrix." })
  @ApiResponse({ status: 400, description: "month missing or invalid." })
  report(@Query() query: AvailabilityReportQueryDto) {
    return this.service.report(query);
  }

  @Get("availability-report.csv")
  @RequirePermissions("scheduler.view")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    "attachment; filename=\"availability-report.csv\""
  )
  @ApiOperation({ summary: "Availability heatmap as RFC 4180 CSV (per-group + TOTAL AVAILABLE row)." })
  @ApiProduces("text/csv")
  @ApiQuery({ name: "month", required: true })
  @ApiQuery({ name: "skipNonWorkingDays", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "CSV payload." })
  @ApiResponse({ status: 400, description: "month missing or invalid." })
  reportCsv(@Query() query: AvailabilityReportQueryDto) {
    return this.service.reportCsv(query);
  }

  /**
   * Compact rolling-window heatmap for the dashboard widget: top-N workers
   * by allocation activity, with per-cell load bucket (free / partial /
   * full) derived from DISTINCT project count per (worker, day). Multi-role
   * rows on the same worker+day+project count as one project.
   */
  @Get("availability-heatmap")
  @RequirePermissions("scheduler.view")
  @ApiOperation({
    summary:
      "Rolling-window availability heatmap for the dashboard widget (top-N workers, load bucketed by distinct project count)."
  })
  @ApiQuery({ name: "days", required: false, description: "Rolling window in days (7–42, default 14)." })
  @ApiQuery({ name: "topN", required: false, description: "Max workers returned (1–20, default 8)." })
  @ApiResponse({ status: 200, description: "Heatmap payload." })
  heatmap(@Query("days") days?: string, @Query("topN") topN?: string) {
    return this.service.heatmap({
      days: days ? Number(days) : 14,
      topN: topN ? Number(topN) : 8
    });
  }
}
