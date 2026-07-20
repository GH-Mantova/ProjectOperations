import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ForecastService } from "./forecast.service";

/**
 * HTTP controller exposing the cost-to-complete forecast endpoint.
 *
 * GET /projects/jobs/:jobId/cost-to-complete
 * Returns budget, actual-to-date, committed, forecast-at-completion, and
 * variance for the given job. Requires `jobs.view` permission (same guard
 * pattern as the rest of the projects surface).
 */
@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects/jobs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  /**
   * Cost-to-complete / forecast-at-completion for a single job.
   *
   * Formula: FAC = actualToDate + max(0, committed − actualInvoiced).
   * Variance = budget − FAC (positive = under budget).
   */
  @Get(":jobId/cost-to-complete")
  @RequirePermissions("jobs.view")
  @ApiOperation({
    summary: "Cost-to-complete forecast per job — budget, actuals, committed, FAC, and variance"
  })
  @ApiResponse({
    status: 200,
    description: "Forecast at completion and variance for this job."
  })
  @ApiResponse({ status: 404, description: "Job not found." })
  getCostToComplete(@Param("jobId") jobId: string) {
    return this.forecastService.getJobCostToComplete(jobId);
  }
}
