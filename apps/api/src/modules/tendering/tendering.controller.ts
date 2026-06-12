import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { BulkStatusDto, QuickEditDto, TenderQueryDto } from "./dto/tender-query.dto";
import {
  CreateTenderFilterPresetDto,
  UpdateTenderFilterPresetDto
} from "./dto/tender-filter-preset.dto";
import {
  CreateTenderActivityDto,
  CreateTenderClarificationDto,
  CreateTenderFollowUpDto,
  CreateTenderNoteDto,
  PreviewTenderImportDto,
  UpdateTenderActivityDto,
  UpsertTenderDto
} from "./dto/tender.dto";

class UpdateTenderStatusDto {
  @IsString()
  status!: string;
}

class UpdateTenderProbabilityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number | null;
}

class SetAssignedEstimatorDto {
  @IsOptional()
  @IsString()
  userId!: string | null;
}

class BumpTenderRevisionDto {
  /** Optional reason recorded in the audit log entry. */
  @IsOptional()
  @IsString()
  reason?: string;
}
import { TenderingService } from "./tendering.service";

/**
 * REST controller for the core tender CRUD + lifecycle surface under /tenders.
 *
 * All routes require a JWT and are permission-gated: reads need
 * `tenders.view`, writes need `tenders.manage` (filter presets are
 * per-user, so preset writes only need `tenders.view`). All mutations
 * delegate to TenderingService, which writes audit entries.
 */
@ApiTags("Tendering")
@ApiBearerAuth()
@Controller("tenders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderingController {
  constructor(private readonly service: TenderingService) {}

  /**
   * List tenders with filters, search, and sort.
   *
   * @param query - paging, free-text search, status/estimator/client/discipline/value/due-date/probability filters, and sort options
   * @returns paged result: { items, total, page, pageSize }
   */
  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List tenders with filters, search, and sort" })
  @ApiResponse({ status: 200, description: "List tenders with filters, search, and sort." })
  @ApiQuery({ name: "q", required: false, description: "Search across tender number, title, and client names" })
  @ApiQuery({ name: "status", required: false, description: "Comma-separated list of statuses" })
  @ApiQuery({ name: "estimatorId", required: false })
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "discipline", required: false, description: "SO|Str|Asb|Civ|Prv — filters tenders that have scope items in this discipline" })
  @ApiQuery({ name: "valueMin", required: false })
  @ApiQuery({ name: "valueMax", required: false })
  @ApiQuery({ name: "dueDateFrom", required: false, description: "ISO date" })
  @ApiQuery({ name: "dueDateTo", required: false, description: "ISO date" })
  @ApiQuery({ name: "probability", required: false, description: "Hot|Warm|Cold" })
  @ApiQuery({ name: "sortBy", required: false })
  @ApiQuery({ name: "sortDir", required: false, enum: ["asc", "desc"] })
  list(@Query() query: TenderQueryDto) {
    return this.service.list(query);
  }

  /**
   * Bulk update the status of up to 50 tenders in a single transaction.
   *
   * @param dto - tenderIds (max 50) and the target status
   * @returns { updated: count, tenders: affected rows (id, tenderNumber, status) }
   */
  @Post("bulk-status")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Bulk update the status of up to 50 tenders in a single transaction" })
  @ApiResponse({ status: 200, description: "Updated summary with count and the affected tender rows." })
  bulkStatus(@Body() dto: BulkStatusDto, @CurrentUser() actor: { sub: string }) {
    return this.service.bulkUpdateStatus(dto.tenderIds, dto.status, actor.sub);
  }

  /**
   * List saved filter presets for the current user.
   *
   * @returns presets ordered default-first, then by name
   */
  @Get("filter-presets")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List saved filter presets for the current user" })
  @ApiResponse({ status: 200, description: "List saved filter presets for the current user." })
  listPresets(@CurrentUser() actor: { sub: string }) {
    return this.service.listFilterPresets(actor.sub);
  }

  /**
   * Save a filter preset for the current user.
   *
   * @param dto - preset name, filters JSON, and optional isDefault flag
   * @returns the created preset
   */
  @Post("filter-presets")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Save a filter preset for the current user" })
  @ApiResponse({ status: 201, description: "Save a filter preset for the current user." })
  createPreset(@Body() dto: CreateTenderFilterPresetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createFilterPreset(actor.sub, dto);
  }

  /**
   * Update a saved filter preset.
   *
   * @param id - preset id (must belong to the current user)
   * @param dto - partial preset fields to change
   * @returns the updated preset
   */
  @Patch("filter-presets/:id")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Update a saved filter preset" })
  @ApiResponse({ status: 200, description: "Update a saved filter preset." })
  updatePreset(
    @Param("id") id: string,
    @Body() dto: UpdateTenderFilterPresetDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateFilterPreset(actor.sub, id, dto);
  }

  /**
   * Delete a saved filter preset.
   *
   * @param id - preset id (must belong to the current user)
   * @returns { id } of the deleted preset
   */
  @Delete("filter-presets/:id")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Delete a saved filter preset" })
  @ApiResponse({ status: 200, description: "Delete a saved filter preset." })
  deletePreset(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteFilterPreset(actor.sub, id);
  }

  /**
   * Create a tender.
   *
   * Also provisions the per-tender SharePoint folder structure
   * (best-effort) and writes an audit entry.
   *
   * @param dto - full tender payload including optional nested clients, notes, clarifications, snapshots, follow-ups, and outcomes
   * @returns the created tender with all relations included
   */
  @Post()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a tender" })
  @ApiResponse({ status: 201, description: "Create a tender." })
  create(@Body() dto: UpsertTenderDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(dto, actor.sub);
  }

  /**
   * @deprecated Use POST /api/v1/tenders/:tenderId/entries instead.
   * The legacy note write path is preserved for one release cycle.
   * Will be removed after PR-18 backfill bake-in.
   */
  @Post(":id/notes")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "[DEPRECATED] Add a tender note", deprecated: true })
  @ApiResponse({ status: 201, description: "[DEPRECATED] Add a tender note." })
  addNote(@Param("id") id: string, @Body() dto: CreateTenderNoteDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addNote(id, dto, actor.sub);
  }

  /**
   * @deprecated Use POST /api/v1/tenders/:tenderId/entries instead.
   * The legacy clarification write path is preserved for one release cycle.
   * Will be removed after PR-18 backfill bake-in.
   */
  @Post(":id/clarifications")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "[DEPRECATED] Add a tender clarification", deprecated: true })
  @ApiResponse({ status: 201, description: "[DEPRECATED] Add a tender clarification." })
  addClarification(@Param("id") id: string, @Body() dto: CreateTenderClarificationDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addClarification(id, dto, actor.sub);
  }

  /**
   * @deprecated Use POST /api/v1/tenders/:tenderId/entries instead.
   * The legacy follow-up write path is preserved for one release cycle.
   * Will be removed after PR-18 backfill bake-in.
   */
  @Post(":id/follow-ups")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "[DEPRECATED] Add a tender follow-up", deprecated: true })
  @ApiResponse({ status: 201, description: "[DEPRECATED] Add a tender follow-up." })
  addFollowUp(@Param("id") id: string, @Body() dto: CreateTenderFollowUpDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addFollowUp(id, dto, actor.sub);
  }

  /**
   * List unified tender activities.
   *
   * Merges notes, clarifications, and follow-ups into one normalised
   * activity feed sorted newest-first.
   *
   * @param id - tender id
   * @returns array of activity rows with composite ids like "note:{id}"
   */
  @Get(":id/activities")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List unified tender activities" })
  @ApiResponse({ status: 200, description: "List unified tender activities." })
  listActivities(@Param("id") id: string) {
    return this.service.listActivities(id);
  }

  /**
   * Create a unified tender activity.
   *
   * Routes to the underlying note / clarification / follow-up table
   * based on activityType; follow-up-like types require a due date.
   *
   * @param dto - activityType, title, optional details/status/dueAt/assignee
   * @returns the full tender detail after the write
   */
  @Post(":id/activities")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a unified tender activity" })
  @ApiResponse({ status: 201, description: "Create a unified tender activity." })
  addActivity(@Param("id") id: string, @Body() dto: CreateTenderActivityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addActivity(id, dto, actor.sub);
  }

  /**
   * Update a unified tender activity.
   *
   * Only clarification and follow-up activities can be updated; the
   * activityId encodes the source table ("clarification:{id}" / "follow-up:{id}").
   *
   * @param activityId - composite "{type}:{sourceId}" identifier
   * @returns the full tender detail after the write
   */
  @Patch(":id/activities/:activityId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a unified tender activity" })
  @ApiResponse({ status: 200, description: "Update a unified tender activity." })
  updateActivity(
    @Param("id") id: string,
    @Param("activityId") activityId: string,
    @Body() dto: UpdateTenderActivityDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateActivity(id, activityId, dto, actor.sub);
  }

  /**
   * Preview tender import rows from CSV text.
   *
   * @param dto - { csvText } in the documented import column format
   * @returns per-row validity, including duplicate tender-number flags
   */
  @Post("import/preview")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Preview tender import rows from CSV text" })
  @ApiResponse({ status: 201, description: "Preview tender import rows from CSV text." })
  previewImport(@Body() dto: PreviewTenderImportDto) {
    return this.service.previewImport(dto.csvText);
  }

  /**
   * Create tenders from CSV text.
   *
   * Invalid rows (missing number/title, duplicate number, no matching
   * clients) are skipped with a reason rather than failing the batch.
   *
   * @param dto - { csvText } in the documented import column format
   * @returns { createdCount, createdIds, skipped: [{ tenderNumber, reason }] }
   */
  @Post("import/commit")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create tenders from CSV text" })
  @ApiResponse({ status: 201, description: "Create tenders from CSV text." })
  commitImport(@Body() dto: PreviewTenderImportDto, @CurrentUser() actor: { sub: string }) {
    return this.service.commitImport(dto.csvText, actor.sub);
  }

  /**
   * Get tender detail.
   *
   * @param id - tender id
   * @returns the tender with all relations (clients, notes, clarifications, snapshots, follow-ups, outcomes, documents, source job)
   */
  @Get(":id")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Get tender detail" })
  @ApiResponse({ status: 200, description: "Get tender detail." })
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  /**
   * Update a tender.
   *
   * Full upsert semantics: nested collections (clients, notes,
   * clarifications, snapshots, follow-ups, outcomes) are deleted and
   * re-created from the payload, not merged.
   *
   * @param dto - full tender payload (same shape as create)
   * @returns the updated tender with all relations
   */
  @Patch(":id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a tender" })
  @ApiResponse({ status: 200, description: "Update a tender." })
  update(@Param("id") id: string, @Body() dto: UpsertTenderDto, @CurrentUser() actor: { sub: string }) {
    return this.service.update(id, dto, actor.sub);
  }

  /**
   * Returns cascade counts so the UI can show what will be deleted.
   *
   * @param id - tender id
   * @returns tender summary plus _count of related quotes, scope, documents, exports, and clients
   */
  @Get(":id/delete-preflight")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Returns cascade counts so the UI can show what will be deleted" })
  @ApiResponse({ status: 200, description: "Preflight summary with counts of related records." })
  deletePreflight(@Param("id") id: string) {
    return this.service.deletePreflight(id);
  }

  /**
   * Hard-delete a tender and all related records (quotes, scope, documents, exports).
   *
   * The audit entry is written BEFORE the delete so the cascade counts
   * survive even though the rows are gone.
   *
   * @param id - tender id
   * @returns { id, tenderNumber, cascadedCounts }
   */
  @Delete(":id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Hard-delete a tender and all related records (quotes, scope, documents, exports)" })
  @ApiResponse({ status: 200, description: "Deletion summary with cascade counts." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  delete(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.delete(id, actor.sub);
  }

  /**
   * Mark a tender as a new revision — bumps Rev{N} on the canonical tender number.
   *
   * The tender number becomes T{YYMMDD}-{SLUG}-Rev{N+1}; the row id is
   * unchanged.
   *
   * @param id - tender id
   * @param dto - optional { reason } recorded in the audit trail
   * @returns the updated tender with the bumped revision number
   */
  @Post(":id/bump-revision")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary:
      "Mark a tender as a new revision — bumps Rev{N} on the canonical tender number (T{YYMMDD}-{SLUG}-Rev{N}); the row id is unchanged"
  })
  @ApiResponse({ status: 201, description: "Updated tender with the bumped revision number." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  bumpRevision(
    @Param("id") id: string,
    @Body() dto: BumpTenderRevisionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.bumpRevision(id, dto.reason, actor.sub);
  }

  /**
   * Duplicate a tender (copies fields and clients, resets lifecycle dates and outcomes).
   *
   * The copy gets status DRAFT, a fresh canonical tender number
   * (T{YYMMDD}-{SLUG}-Rev1 stamped with today's date), a "(copy)" title
   * suffix, and a fresh SharePoint folder structure.
   *
   * @param id - source tender id
   * @returns the newly created tender copy
   */
  @Post(":id/duplicate")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Duplicate a tender (copies fields and clients, resets lifecycle dates and outcomes)" })
  @ApiResponse({ status: 201, description: "Newly created tender copy." })
  duplicate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.duplicate(id, actor.sub);
  }

  /**
   * Update only the stage/status of a tender (used by the Kanban drag-drop flow).
   *
   * Side effects: pins submittedAt/wonAt/lostAt and the rates snapshot
   * on first transition, updates client win/tender scoring, and sends a
   * fire-and-forget email on the first SUBMITTED transition.
   *
   * @param dto - { status } target value
   * @returns the updated tender with relations
   */
  @Patch(":id/status")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update only the stage/status of a tender (used by the Kanban drag-drop flow)" })
  @ApiResponse({ status: 200, description: "Updated tender record with the new status and all existing relations preserved." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTenderStatusDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateStatus(id, dto.status, actor.sub);
  }

  /**
   * Update only the probability of a tender (preserves all related records).
   *
   * @param dto - probability 0-100, or null to clear
   * @returns the updated tender with relations
   */
  @Patch(":id/probability")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update only the probability of a tender (preserves all related records)" })
  @ApiResponse({ status: 200, description: "Update only the probability of a tender (preserves all related records)." })
  updateProbability(
    @Param("id") id: string,
    @Body() dto: UpdateTenderProbabilityDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateProbability(id, dto.probability ?? null, actor.sub);
  }

  /**
   * Assign (or clear) the team-level estimator on a tender — used by the Team panel.
   *
   * Distinct from the legacy estimator-of-record (estimatorUserId).
   *
   * @param dto - { userId } to assign, or null to clear
   * @returns the updated tender
   */
  @Patch(":id/assigned-estimator")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary: "Assign (or clear) the team-level estimator on a tender — used by the Team panel"
  })
  @ApiResponse({ status: 200, description: "Updated tender with the new assigned estimator." })
  @ApiResponse({ status: 404, description: "Tender or assignee not found." })
  setAssignedEstimator(
    @Param("id") id: string,
    @Body() dto: SetAssignedEstimatorDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.setAssignedEstimator(id, dto.userId ?? null, actor.sub);
  }

  /**
   * Patch a limited set of tender fields in one call and log a single activity entry.
   *
   * Only changed fields are written; the change summary is recorded as
   * a tender note and an audit entry.
   *
   * @param dto - any of status, probability, dueDate, value, assignedEstimatorId, description, notes
   * @returns the full tender detail after the write
   */
  @Patch(":id/quick-edit")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Patch a limited set of tender fields in one call and log a single activity entry" })
  @ApiResponse({ status: 200, description: "Updated tender." })
  quickEdit(
    @Param("id") id: string,
    @Body() dto: QuickEditDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.quickEdit(id, dto, actor.sub);
  }
}
