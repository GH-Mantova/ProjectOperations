import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ArchiveService } from "./archive.service";
import { ArchiveQueryDto } from "./dto/archive-query.dto";

@ApiTags("Archive")
@ApiBearerAuth()
@Controller("archive")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArchiveController {
  constructor(private readonly service: ArchiveService) {}

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
