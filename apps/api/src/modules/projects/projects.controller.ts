import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto, ProjectStatusDto, UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

type RequestUser = { sub: string; permissions: string[] };

/**
 * HTTP controller for the projects module — §8 Jobs and Delivery. Exposes the
 * project CRUD surface, status transitions, activity feed, and revert-to-tender
 * cascade endpoints. All routes are guarded by JWT + permissions; specific
 * routes layer additional `@RequirePermissions` decorators on top.
 *
 * Permission model:
 *  - `projects.view` — list, getById, activity, next-number (next-number is
 *    public to authenticated users for UI convenience).
 *  - `projects.manage` — update, status transition.
 *  - `projects.admin` — manual create, contractValue updates, reopen from CLOSED.
 *  - `tenders.manage` — revert-to-tender preflight and execution.
 *
 * Revert-to-tender semantics (covered by `revert-to-tender.spec.ts`) destroy
 * the project plus all cascaded children and reset the source tender back to
 * CONTRACT_ISSUED inside a single transaction.
 */
@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  /**
   * Preview the next project number without consuming it.
   *
   * Reads the singleton `project_number_sequences` row and returns
   * `lastNumber + 1` formatted as `IS-P{padded}`. Does NOT increment the
   * sequence — purely for UI affordance on the "create project" form.
   */
  @Get("next-number")
  @ApiOperation({ summary: "Preview the next project number without consuming it (UI convenience)" })
  @ApiResponse({ status: 200, description: "Next project number, e.g. IS-P042." })
  nextNumber() {
    return this.service.previewNextNumber();
  }

  /**
   * List projects with optional filters and pagination.
   *
   * Supports comma-separated `status`, plus `clientId`, `pmId`, and free-text
   * `search` against projectNumber / name. Returns the standard
   * `{ items, total, page, limit }` envelope with `Decimal` fields stringified.
   */
  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List projects with status / client / PM / search filters + pagination" })
  @ApiResponse({ status: 200, description: "List projects with status / client / PM / search filters + pagination." })
  list(@Query() query: ListProjectsQueryDto) {
    return this.service.list(query);
  }

  /**
   * Fetch a single project by id with the full delivery context.
   *
   * Includes client, source tender summary, the four team-role users, scope
   * items (ordered by scopeCode), milestones (ordered by order), the 10 most
   * recent activity entries, and a derived `variance = budget - actualCost`.
   * Throws 404 when the project does not exist.
   */
  @Get(":id")
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "Get a single project with team, scope items, milestones, last 10 activity entries, and variance" })
  @ApiResponse({ status: 200, description: "Get a single project with team, scope items, milestones, last 10 activity entries, and variance." })
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  /**
   * Manually create a project with no source tender.
   *
   * Allocates the next project number under a row lock, creates the project
   * row, writes a `PROJECT_CREATED` activity entry with `source: "manual"`,
   * fires a notification to the PM (if assigned), and writes an audit log.
   * Requires `projects.admin`.
   */
  @Post()
  @RequirePermissions("projects.admin")
  @ApiOperation({ summary: "Manually create a project (no source tender)" })
  @ApiResponse({ status: 201, description: "Manually create a project (no source tender)." })
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: RequestUser) {
    return this.service.createManual(dto, { userId: actor.sub, permissions: new Set(actor.permissions ?? []) });
  }

  /**
   * Update project fields, team assignments, budget, and actuals.
   *
   * Field-level permission: `contractValue` additionally requires
   * `projects.admin` (throws 403 if missing). All other writable fields are
   * gated only by `projects.manage`. Changes to contractValue, budget, or any
   * team role generate `CONTRACT_VALUE_CHANGED` / `BUDGET_CHANGED` /
   * `TEAM_CHANGED` activity entries inside the same write batch.
   */
  @Patch(":id")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Update project fields, team, budget, and actuals. contractValue additionally requires projects.admin." })
  @ApiResponse({ status: 200, description: "Update project fields, team, budget, and actuals. contractValue additionally requires projects.admin." })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.update(id, dto, { userId: actor.sub, permissions: new Set(actor.permissions ?? []) });
  }

  /**
   * Advance (or reopen) the project status.
   *
   * Transition graph: `MOBILISING → ACTIVE → PRACTICAL_COMPLETION → DEFECTS →
   * CLOSED`. Each forward transition enforces a required date payload field
   * (`actualStartDate`, `practicalCompletionDate`, or `closedDate`). Reopening
   * a CLOSED project back to MOBILISING is the only non-linear move and
   * requires `projects.admin`. Successful transitions write an audit log, a
   * `STATUS_CHANGED` activity entry, and fire notifications + an email to PM
   * and supervisor.
   */
  @Post(":id/status")
  @RequirePermissions("projects.manage")
  @ApiOperation({
    summary:
      "Advance project status. Transitions enforce date-field requirements (actualStartDate / practicalCompletionDate / closedDate). Reopening a CLOSED project requires projects.admin."
  })
  @ApiResponse({ status: 400, description: "Invalid transition or missing required date field." })
  @ApiResponse({ status: 403, description: "Reopen requires projects.admin." })
  status(
    @Param("id") id: string,
    @Body() dto: ProjectStatusDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.transitionStatus(id, dto, { userId: actor.sub, permissions: new Set(actor.permissions ?? []) });
  }

  /**
   * Paginated reverse-chronological activity feed for a single project.
   *
   * Includes user join for display. Returns `{ items, total, page, limit }`.
   * `page` defaults to 1, `limit` defaults to 25 and is clamped to [1, 100].
   */
  @Get(":id/activity")
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "Paginated reverse-chronological activity log for this project" })
  @ApiResponse({ status: 200, description: "Paginated reverse-chronological activity log for this project." })
  @ApiQuery({ name: "page", required: false, type: String, description: "Page number (default 1)" })
  @ApiQuery({ name: "limit", required: false, type: String, description: "Page size (default 25, clamped to [1, 100])" })
  activity(
    @Param("id") id: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "25"
  ) {
    return this.service.activity(id, Number(page) || 1, Number(limit) || 25);
  }

  /**
   * Preflight summary for revert-to-tender.
   *
   * Returns project info, source tender pointer, and a `cascadeCounts` map of
   * every related row count (scopeItems, milestones, activityLog, allocations,
   * preStartChecklists, timesheets, ganttTasks, safetyIncidents,
   * hazardObservations, documents, contracts) so the UI can show what would
   * be destroyed. Throws 400 if the project was not converted from a tender,
   * 404 if not found. Read-only — does not modify state.
   */
  @Get(":id/revert-to-tender/preflight")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary:
      "Returns cascade counts so the UI can show what will be destroyed when reverting this project back to its source tender"
  })
  @ApiResponse({ status: 200, description: "Preflight summary with project info, source tender, and cascade counts." })
  @ApiResponse({ status: 400, description: "Project was not converted from a tender." })
  @ApiResponse({ status: 404, description: "Project not found." })
  revertPreflight(@Param("id") id: string) {
    return this.service.revertToTenderPreflight(id);
  }

  /**
   * Execute the revert-to-tender cascade.
   *
   * Inside a single transaction: nullifies the FK on safety incidents and
   * hazard observations (which use optional projectId), unlinks tender
   * document links, hard-deletes the project (Prisma cascades scopeItems,
   * milestones, activityLog, allocations, preStartChecklists, timesheets,
   * contract, ganttTasks), and resets the source tender's status to
   * `CONTRACT_ISSUED`. An audit log entry with the prior status and
   * `cascadeCounts` snapshot is written inside the same transaction so it
   * rolls back on failure. Throws 400 if not from a tender, 404 if not found.
   */
  @Delete(":id/revert-to-tender")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary:
      "Hard-delete the project and all related records, reset the source tender status to CONTRACT_ISSUED, and write an audit log entry. Wrapped in a single transaction."
  })
  @ApiResponse({ status: 200, description: "Revert succeeded — returns tenderId, timestamp, and cascade counts." })
  @ApiResponse({ status: 400, description: "Project was not converted from a tender." })
  @ApiResponse({ status: 404, description: "Project not found." })
  revertToTender(@Param("id") id: string, @CurrentUser() actor: RequestUser) {
    return this.service.revertToTender(id, actor.sub);
  }
}
