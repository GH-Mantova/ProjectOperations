import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ArchiveService } from "./archive.service";
import { ArchiveQueryDto } from "./dto/archive-query.dto";

/**
 * HTTP surface for the §16 closeout/archive module. Exposes a paginated list
 * of closed and archived jobs plus a full read-only export of any single
 * archived job. The archive is intentionally **read-only** — there are no
 * POST/PATCH/DELETE routes here. Mutation of closeout state happens via the
 * jobs module; this controller only surfaces the resulting snapshot for
 * search, compliance review, and download.
 *
 * All routes require `jobs.view` and a valid JWT.
 */
@ApiTags("Archive")
@ApiBearerAuth()
@Controller("archive")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArchiveController {
  constructor(private readonly service: ArchiveService) {}

  /**
   * List archived and closed jobs with filters and pagination.
   *
   * Default status semantics return both CLOSED and ARCHIVED jobs — set
   * `status=ARCHIVED` to restrict to jobs that have been formally archived
   * (i.e. have a non-null `closeout.archivedAt`).
   *
   * @param query - search, client, year, status, page, and pageSize filters
   * @returns paginated `{ items, total, page, pageSize }` envelope of summary rows
   */
  @Get()
  @RequirePermissions("jobs.view")
  @ApiOperation({ summary: "List archived and closed jobs with filters and pagination" })
  @ApiQuery({ name: "search", required: false, description: "Match against job number, name, or client name" })
  @ApiQuery({ name: "clientId", required: false, description: "Filter to jobs for a specific client" })
  @ApiQuery({ name: "year", required: false, description: "Filter to jobs archived in the given calendar year" })
  @ApiQuery({ name: "status", required: false, enum: ["ALL", "CLOSED", "ARCHIVED"], description: "Filter by closeout status" })
  @ApiQuery({ name: "page", required: false, description: "1-indexed page number" })
  @ApiQuery({ name: "pageSize", required: false, description: "Items per page (max 100)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of archived jobs.",
    schema: {
      example: {
        items: [
          {
            id: "job-001",
            jobNumber: "J-2025-001",
            name: "Ipswich Motorway Stage 4 — Earthworks",
            clientName: "Queensland Transport Infrastructure",
            closedAt: "2026-03-01T00:00:00.000Z",
            archivedAt: "2026-03-25T00:00:00.000Z",
            status: "ARCHIVED"
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20
      }
    }
  })
  list(@Query() query: ArchiveQueryDto) {
    return this.service.list(query);
  }

  /**
   * Export a full read-only archive record for a job, including closeout,
   * stages, activities, issues, variations, status history, linked documents,
   * and form submissions.
   *
   * The returned payload is a point-in-time snapshot intended for compliance
   * download, audit, and offline review. No related rows are modified by this
   * call; if the underlying job is later edited via other modules, a fresh
   * export will reflect those changes.
   *
   * @param jobId - id of the job to export (any status — not restricted to archived)
   * @returns full nested job record with related entities and document/form-submission projections
   * @throws NotFoundException — when no job exists with the given id
   */
  @Get(":jobId/export")
  @RequirePermissions("jobs.view")
  @ApiOperation({
    summary: "Export a full read-only archive record for a job, including closeout, stages, activities, issues, variations, status history, linked documents, and form submissions."
  })
  @ApiResponse({ status: 200, description: "Full archived job record (read-only snapshot)." })
  @ApiResponse({ status: 404, description: "Archived job not found." })
  export(@Param("jobId") jobId: string) {
    return this.service.export(jobId);
  }
}
