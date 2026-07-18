import { Controller, ForbiddenException, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AuditService } from "./audit.service";

// D365-parity per-record history: map an entityType to the permission(s)
// that gate viewing that record. If a caller can already see the record
// in its owning module, they can also see its change history. Any of the
// listed permissions is sufficient; unmapped types fall back to the
// blanket `audit.view`.
const ENTITY_VIEW_PERMISSIONS: Record<string, readonly string[]> = {
  Tender: ["tenders.view"],
  Contract: ["finance.view"],
  Variation: ["finance.view"],
  ProgressClaim: ["finance.view"],
  Project: ["projects.view"],
  Job: ["jobs.view"],
  Client: ["directory.view"],
  Contact: ["directory.view"],
  User: ["users.view", "audit.view"],
  Role: ["roles.view", "audit.view"]
};

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

  /**
   * Per-record change history — the D365-style "who changed what, when"
   * feed surfaced on detail-page History tabs.
   *
   * Permission model: rather than a single blanket `audit.view` gate, the
   * caller must hold one of the permissions that would let them see the
   * underlying record (see ENTITY_VIEW_PERMISSIONS). Super users and
   * anyone with `audit.view` bypass the mapping. Unmapped entityTypes
   * require `audit.view`.
   */
  @Get("entity/:entityType/:entityId")
  @ApiOperation({ summary: "List audit-log entries for a single record" })
  @ApiParam({ name: "entityType", description: "Prisma model name (e.g. Tender, Contract)" })
  @ApiParam({ name: "entityId", description: "Record id" })
  @ApiResponse({ status: 200, description: "Entries for the record, newest first." })
  async listForRecord(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const granted = new Set(user?.permissions ?? []);
    const isSuper = !!user?.isSuperUser;
    const required = ENTITY_VIEW_PERMISSIONS[entityType];
    const allowed =
      isSuper ||
      granted.has("audit.view") ||
      (required ? required.some((p) => granted.has(p)) : false);
    if (!allowed) {
      throw new ForbiddenException("You do not have permission to view this record's history.");
    }
    const items = await this.auditService.listByEntity(entityType, entityId);
    return { items };
  }
}
