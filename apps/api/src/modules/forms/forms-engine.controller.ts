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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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

@ApiTags("Forms Engine")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("forms")
export class FormsEngineController {
  constructor(private readonly engine: FormsEngineService) {}

  @Post("submissions")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Create a draft submission for a template. Auto-populates context from the user's active timesheet."
  })
  createDraft(@Body() body: CreateDraftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.engine.createDraft(body.templateId, user.sub);
  }

  @Patch("submissions/:id/values")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Save draft values. Returns live field visibility + required state so the client can re-render the form without a page reload."
  })
  updateValues(
    @Param("id") id: string,
    @Body() body: UpdateSubmissionValuesDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.updateValues(id, user.sub, body.values);
  }

  @Post("submissions/:id/submit")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary:
      "Submit a draft. Runs validation, compliance gates, on_submit actions (auto-record creation, notifications), and starts the approval chain if configured."
  })
  submit(
    @Param("id") id: string,
    @Body() body: SubmitSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.submitForm(id, user.sub, body.gpsLat, body.gpsLng);
  }

  @Post("submissions/:id/approve")
  @RequirePermissions("forms.approve")
  @ApiOperation({ summary: "Approve the next pending step in this submission's approval chain." })
  approve(
    @Param("id") id: string,
    @Body() body: ApproveSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.approveStep(id, user.sub, body.comment);
  }

  @Post("submissions/:id/reject")
  @RequirePermissions("forms.approve")
  @ApiOperation({
    summary: "Reject the next pending step. Comment is required and is sent to the submitter."
  })
  reject(
    @Param("id") id: string,
    @Body() body: RejectSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.rejectStep(id, user.sub, body.comment);
  }

  @Post("submissions/:id/resubmit")
  @RequirePermissions("forms.submit")
  @ApiOperation({
    summary: "Move a rejected submission back to draft so the worker can fix and resubmit."
  })
  resubmit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.engine.resubmit(id, user.sub);
  }

  @Get("my-submissions")
  @RequirePermissions("forms.submit")
  @ApiOperation({ summary: "List the current user's submissions." })
  mySubmissions(
    @Query("status") status: string | undefined,
    @Query("templateId") templateId: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.engine.getMySubmissions(user.sub, { status, templateId });
  }

  @Get("pending-approvals")
  @RequirePermissions("forms.approve")
  @ApiOperation({ summary: "List approval steps assigned to the current user that are pending." })
  pendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.engine.getPendingApprovalsFor(user.sub);
  }

  @Get("analytics")
  @RequirePermissions("forms.manage")
  @ApiOperation({
    summary: "Aggregated submission counts, status breakdown, and overdue approval count."
  })
  analytics(
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("templateId") templateId: string | undefined
  ) {
    return this.engine.getAnalytics({ from, to, templateId });
  }
}
