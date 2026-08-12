import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { FormsEngineService } from "./forms-engine.service";
import { SystemContextResolverService } from "./system-context-resolver.service";
import { PushExecutorService } from "./push-executor.service";
import { AiFormFillAssistService } from "./ai-form-fill-assist.service";
import {
  CreateDraftDto,
  FillAssistDto,
  RejectSubmissionDto,
  SubmitSubmissionDto,
  UpdateSubmissionValuesDto,
  ApproveSubmissionDto
} from "./dto/forms-engine.dto";

/**
 * REST endpoints for the worker-facing forms engine: draft lifecycle,
 * submit pipeline, approval chain decisions, and submission analytics.
 *
 * Routes are gated per-method: `forms.submit` for worker draft/submit
 * actions, `forms.approve` for approval decisions, `forms.manage` for
 * analytics. Thin pass-through to FormsEngineService.
 */
@ApiTags("Forms Engine")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("forms")
export class FormsEngineController {
  constructor(
    private readonly engine: FormsEngineService,
    private readonly systemContext: SystemContextResolverService,
    private readonly pushExecutor: PushExecutorService,
    private readonly fillAssist: AiFormFillAssistService
  ) {}

  /**
   * Create a draft submission for a template. Auto-populates context from the user's active timesheet.
   *
   * @param body - templateId to draft against (latest version is used)
   * @returns the created draft submission with full detail includes
   * @throws NotFoundException when the template does not exist
   * @throws BadRequestException when the template has no versions yet
   */
  @Post("submissions")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Create a draft submission for a template. Auto-populates context from the user's active timesheet."
  })
  @ApiResponse({ status: 201, description: "Create a draft submission for a template. Auto-populates context from the user's active timesheet." })
  createDraft(@Body() body: CreateDraftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.engine.createDraft(body.templateId, user.sub);
  }

  /**
   * Save draft values. Returns live field visibility + required state so the client can re-render the form without a page reload.
   *
   * @param id - draft submission id (must be owned by the caller)
   * @param body - partial map of fieldKey to value; omitted fields are kept
   * @returns `{ fieldVisibility, fieldRequired }` keyed by fieldKey
   * @throws NotFoundException when the submission does not exist
   * @throws ForbiddenException when the draft belongs to another user
   * @throws BadRequestException when the submission is not in draft status
   */
  @Patch("submissions/:id/values")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Save draft values. Returns live field visibility + required state so the client can re-render the form without a page reload."
  })
  @ApiResponse({ status: 200, description: "Save draft values. Returns live field visibility + required state so the client can re-render the form without a page reload." })
  updateValues(
    @Param("id") id: string,
    @Body() body: UpdateSubmissionValuesDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.updateValues(id, user.sub, body.values, body.sectionEntries);
  }

  /**
   * Submit a draft. Runs validation, compliance gates, on_submit actions (auto-record creation, notifications), and starts the approval chain if configured.
   *
   * @param id - draft submission id (must be owned by the caller)
   * @param body - optional gpsLat/gpsLng captured at submit time
   * @returns the submission with full detail includes after the pipeline runs
   * @throws UnprocessableEntityException when validation or a compliance gate fails
   * @throws NotFoundException when the submission does not exist
   * @throws ForbiddenException when the draft belongs to another user
   * @throws BadRequestException when the submission is not in draft status
   */
  @Post("submissions/:id/submit")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Submit a draft. Runs validation, compliance gates, on_submit actions (auto-record creation, notifications), and starts the approval chain if configured."
  })
  @ApiResponse({ status: 201, description: "Submit a draft. Runs validation, compliance gates, on_submit actions (auto-record creation, notifications), and starts the approval chain if configured." })
  submit(
    @Param("id") id: string,
    @Body() body: SubmitSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.submitForm(
      id,
      user.sub,
      body.gpsLat,
      body.gpsLng,
      body.acknowledgedWarnings
    );
  }

  /**
   * Approve the next pending step in this submission's approval chain.
   *
   * @param id - submission id
   * @param body - optional approval comment
   * @returns the submission with updated approvals
   * @throws BadRequestException when no pending approval step exists
   * @throws ForbiddenException when the pending step is assigned to another user
   */
  @Post("submissions/:id/approve")
  @RequirePermissions("forms.approve")
  @ApiOperation({ summary: "Approve the next pending step in this submission's approval chain." })
  @ApiResponse({ status: 201, description: "Approve the next pending step in this submission's approval chain." })
  approve(
    @Param("id") id: string,
    @Body() body: ApproveSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.approveStep(id, user.sub, body.comment);
  }

  /**
   * Reject the next pending step. Comment is required and is sent to the submitter.
   *
   * @param id - submission id
   * @param body - mandatory rejection comment relayed to the submitter
   * @returns the submission, now in `rejected` status
   * @throws BadRequestException when the comment is blank or no pending step exists
   * @throws ForbiddenException when the pending step is assigned to another user
   */
  @Post("submissions/:id/reject")
  @RequirePermissions("forms.approve")
  @ApiOperation({
    summary: "Reject the next pending step. Comment is required and is sent to the submitter."
  })
  @ApiResponse({ status: 201, description: "Reject the next pending step. Comment is required and is sent to the submitter." })
  reject(
    @Param("id") id: string,
    @Body() body: RejectSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.rejectStep(id, user.sub, body.comment);
  }

  /**
   * Move a rejected submission back to draft so the worker can fix and resubmit.
   *
   * @param id - submission id (must belong to the caller and be rejected)
   * @returns the submission back in `draft` status with approvals cleared
   * @throws NotFoundException when the submission does not exist
   * @throws ForbiddenException when the submission belongs to another user
   * @throws BadRequestException when the submission is not in rejected status
   */
  @Post("submissions/:id/resubmit")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary: "Move a rejected submission back to draft so the worker can fix and resubmit."
  })
  @ApiResponse({ status: 201, description: "Move a rejected submission back to draft so the worker can fix and resubmit." })
  resubmit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.engine.resubmit(id, user.sub);
  }

  /**
   * F-9b — retry failed push bindings for a submission. Deletes any
   * FormTriggeredRecord rows with `status="failed"` scoped to a
   * bindingId, then re-runs the executor for the given applyOn stage
   * (defaults to "submit"). Fire-and-forget; the caller polls the
   * submission detail to observe outcomes.
   *
   * Gated on `forms.approve` — same audience that can drive the
   * submission's approval chain.
   */
  @Post("submissions/:id/retry-pushes")
  @RequirePermissions("forms.approve")
  @ApiOperation({ summary: "Re-run failed push bindings for a submission." })
  @ApiResponse({ status: 202, description: "Retry accepted; poll submission for results." })
  @ApiQuery({ name: "applyOn", required: false, enum: ["submit", "approval"] })
  async retryPushes(
    @Param("id") id: string,
    @Query("applyOn") applyOn?: string
  ) {
    const stage: "submit" | "approval" = applyOn === "approval" ? "approval" : "submit";
    await this.pushExecutor.retryFailedPushes(id, stage);
    return { ok: true };
  }

  /**
   * List the current user's submissions.
   *
   * @param status - optional exact status filter
   * @param templateId - optional template filter
   * @returns the caller's submissions, most recently updated first
   */
  @Get("my-submissions")
  @RequirePermissions("forms.submit")
  @ApiOperation({ summary: "List the current user's submissions." })
  @ApiResponse({ status: 200, description: "List the current user's submissions." })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "templateId", required: false, type: String })
  mySubmissions(
    @Query("status") status: string | undefined,
    @Query("templateId") templateId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.getMySubmissions(user.sub, { status, templateId });
  }

  /**
   * List approval steps assigned to the current user that are pending.
   *
   * @returns pending FormApproval rows with submission detail, earliest due first
   */
  @Get("pending-approvals")
  @RequirePermissions("forms.approve")
  @ApiOperation({ summary: "List approval steps assigned to the current user that are pending." })
  @ApiResponse({ status: 200, description: "List approval steps assigned to the current user that are pending." })
  pendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.engine.getPendingApprovalsFor(user.sub);
  }

  /**
   * Aggregated submission counts, status breakdown, and overdue approval count.
   *
   * @param from - optional ISO date lower bound on submittedAt
   * @param to - optional ISO date upper bound on submittedAt
   * @param templateId - optional template filter
   * @returns `{ totalSubmissions, byStatus, overdueApprovals }`
   */
  @Get("analytics")
  @RequirePermissions("forms.manage")
  @ApiOperation({
    summary: "Aggregated submission counts, status breakdown, and overdue approval count."
  })
  @ApiResponse({ status: 200, description: "Aggregated submission counts, status breakdown, and overdue approval count." })
  @ApiQuery({ name: "from", required: false, type: String, description: "ISO date lower bound on submittedAt" })
  @ApiQuery({ name: "to", required: false, type: String, description: "ISO date upper bound on submittedAt" })
  @ApiQuery({ name: "templateId", required: false, type: String })
  analytics(
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("templateId") templateId: string | undefined
  ) {
    return this.engine.getAnalytics({ from, to, templateId });
  }

  /**
   * Dashboard widget aggregate — every pending FormApproval across the
   * system, with an overdue count and the top N due-soonest items. Spans
   * all assignees; use `pending-approvals` for the per-user list.
   */
  @Get("approvals-waiting")
  @RequirePermissions("forms.approve")
  @ApiOperation({
    summary: "System-wide pending approval count, overdue count, and top-N due-soonest items."
  })
  @ApiResponse({
    status: 200,
    description: "{ total, overdue, items: [{ id, dueAt, overdue, templateName, submittedByName, ... }] }"
  })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Top-N items (default 5, max 20)" })
  approvalsWaiting(@Query("limit") limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return this.engine.getApprovalsWaiting(Number.isFinite(parsed) ? parsed : undefined);
  }

  /**
   * Lightweight site directory for the "existing_site" form field type —
   * `{ id, name }[]` ordered by name. Gated on `forms.submit` so form
   * fillers can populate the picker without holding `masterdata.view`.
   */
  @Get("site-options")
  @RequirePermissions("forms.submit")
  @ApiOperation({ summary: "List sites (id, name) for the existing_site form field picker." })
  @ApiResponse({ status: 200, description: "Array of { id, name } ordered by name." })
  siteOptions() {
    return this.engine.getSiteOptions();
  }

  /**
   * F-5 — light worker list for the `worker_picker` field. Optional
   * `requiredQuals` (comma-separated qualType codes) attaches a
   * per-worker competency verdict so the picker can badge missing quals.
   */
  @Get("worker-options")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "List active workers for the worker_picker form field. Optionally score against required qualifications."
  })
  @ApiQuery({
    name: "requiredQuals",
    required: false,
    description: "Comma-separated qualType codes, e.g. 'asbestos_b,working_at_heights'."
  })
  @ApiResponse({ status: 200, description: "Array of { id, name, role, competency }." })
  workerOptions(@Query("requiredQuals") requiredQuals?: string) {
    const quals = (requiredQuals ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return this.engine.getWorkerOptions(quals);
  }

  /**
   * F-5 — light asset list for the `asset_picker` field. Optional
   * `siteId` narrows to assets checked out at that site (open checkouts).
   * Each row carries a per-asset maintenanceSummary so the picker can
   * surface service warnings without a second call.
   */
  @Get("asset-options")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary: "List assets for the asset_picker form field, optionally filtered to a site."
  })
  @ApiQuery({ name: "siteId", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Array of { id, name, assetCode, status, maintenanceSummary }."
  })
  assetOptions(@Query("siteId") siteId?: string) {
    return this.engine.getAssetOptions(siteId);
  }

  /**
   * Dashboard widget aggregate — number of pre-start submissions logged
   * today (server-local calendar day). "Expected" denominator is DEFERRED
   * to B-P0c; this returns count-only by design.
   */
  @Get("pre-starts-today")
  @RequirePermissions("forms.view")
  @ApiOperation({
    summary: "Count of pre-start form submissions logged today. Denominator deferred to B-P0c."
  })
  @ApiResponse({ status: 200, description: "{ count, latestSubmittedAt }" })
  preStartsToday() {
    return this.engine.getPreStartsToday();
  }

  /**
   * Resolve a one-shot system-context snapshot for a template + caller.
   *
   * Returns asset readings, caller's competency expiries, site attributes,
   * site weather, 7-day timesheet hours, and the caller's role — all in one
   * batched call (§5.3 "one batched call, not N"). The client caches this
   * snapshot for local rule evaluation; the server re-resolves fresh at
   * submit time for any BLOCK decision.
   *
   * Optional `siteId` query param narrows the site/weather section.
   *
   * @param templateId - the template the filler is about to fill
   * @param siteId - optional site id for site/weather context
   * @returns SystemContextSnapshot
   */
  @Get("templates/:templateId/system-context")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Resolve system context (asset readings, competencies, site, weather, timesheet hours, role) for a template fill session."
  })
  @ApiQuery({ name: "siteId", required: false, type: String })
  @ApiResponse({
    status: 200,
    description:
      "SystemContextSnapshot: { resolvedAt, assetReadings, competencies, site, weather, timesheetHours7d, fillerRole }"
  })
  resolveSystemContext(
    @Param("templateId") templateId: string,
    @Query("siteId") siteId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.systemContext.resolveContext(templateId, user.sub, siteId);
  }

  /**
   * Fill-time AI assist — suggest-never-decide (AI order 3, LOCKED).
   *
   * Accepts in-progress hazard/incident field answers and returns hazard
   * control suggestions plus a notifiable-incident flag. All output is
   * advisory: nothing here triggers a BLOCK, WARN, push action, or
   * approval-chain change. Those remain exclusively rules-engine-driven.
   *
   * The client is responsible for:
   *  1. Gating the panel on a hazard/incident signal (category = "safety" /
   *     "environmental" / "plant", or field keys matching hazard/incident).
   *  2. Filtering the submission values to relevant fields before calling.
   *  3. Labelling every returned item as "AI suggestion" with accept/dismiss
   *     controls — nothing auto-applies.
   *
   * @param id - the in-progress submission id (used in logging only; the
   *   service does not read or write the submission)
   * @param body - `{ answers: { fieldLabel: value } }` map of relevant fields
   * @returns FillAssistSuggestion payload (advisory only)
   * @throws BadRequestException when `answers` is empty
   * @throws ServiceUnavailableException when the AI provider is unreachable
   */
  @Post("submissions/:id/fill-assist")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Fill-time AI assist (suggest-never-decide): given in-progress hazard/incident answers, returns control suggestions and a notifiable-incident flag. Advisory only — no BLOCK, WARN, or push actions."
  })
  @ApiResponse({
    status: 201,
    description:
      "FillAssistSuggestion: { controlSuggestions, notifiableIncidentFlag, summary, provider }. All fields advisory only."
  })
  fillAssistSuggest(
    @Param("id") id: string,
    @Body() body: FillAssistDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.fillAssist.suggest(user.sub, id, body.answers);
  }
}
