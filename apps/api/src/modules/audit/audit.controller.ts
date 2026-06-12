import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AuditService } from "./audit.service";

/**
 * Read-only HTTP endpoints for browsing the platform audit trail.
 *
 * All routes require a valid JWT and are gated by PermissionsGuard;
 * audit entries themselves are written by AuditService from other modules.
 */
@ApiTags("Audit")
@ApiBearerAuth()
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * List audit logs.
   *
   * Requires the `audit.view` permission. Returns a paginated envelope
   * of audit entries, newest first, with a lightweight actor summary.
   *
   * @param query - page / pageSize pagination options
   * @returns paginated `{ items, total, page, pageSize }` of audit log entries
   */
  @Get()
  @RequirePermissions("audit.view")
  @ApiOperation({ summary: "List audit logs" })
  @ApiResponse({ status: 200, description: "List audit logs." })
  list(@Query() query: PaginationQueryDto) {
    return this.auditService.list(query);
  }
}
