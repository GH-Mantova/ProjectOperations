import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { JpmReconciliationReportDto } from "./dto/jpm-reconciliation.dto";
import { JpmService } from "./jpm.service";

/**
 * Read-only admin surface for the Job/Project merge migration (Phase A).
 *
 * Phase A adds nullable link columns (Job.survivingProjectId,
 * Project.sourceJobId) and backfills them for tender-matched pairs. This
 * endpoint lets an admin compare coverage (linked vs orphan) before Phase B
 * repoints any behaviour onto Project. Guarded by `projects.admin`.
 */
@ApiTags("Projects")
@ApiBearerAuth()
@Controller("admin/jpm")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JpmController {
  constructor(private readonly service: JpmService) {}

  @Get("reconciliation")
  @RequirePermissions("projects.admin")
  @ApiOperation({
    summary: "Job/Project merge Phase A reconciliation counts (linked / orphan-job / orphan-project)."
  })
  @ApiResponse({ status: 200, type: JpmReconciliationReportDto })
  async reconciliation(): Promise<JpmReconciliationReportDto> {
    return this.service.buildReconciliationReport();
  }
}
