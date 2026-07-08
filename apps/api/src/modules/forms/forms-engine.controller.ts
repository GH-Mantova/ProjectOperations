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
import {
  CreateDraftDto,
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
  constructor(private readonly engine: FormsEngineService) {}

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
    return this.engine.updateValues(id, user.sub, body.values);
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
    return this.engine.submitForm(id, user.sub, body.gpsLat, body.gpsLng);
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
}
