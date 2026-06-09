import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  CloseoutJobDto,
  CreateJobActivityDto,
  CreateJobDto,
  CreateJobIssueDto,
  CreateJobProgressEntryDto,
  CreateJobStageDto,
  CreateJobVariationDto,
  UpdateJobActivityDto,
  UpdateJobDto,
  UpdateJobIssueDto,
  UpdateJobStageDto,
  UpdateJobStatusDto,
  UpdateJobVariationDto
} from "./dto/job-delivery.dto";
import { JobQueryDto } from "./dto/job-query.dto";
import { JobsService } from "./jobs.service";

/**
 * HTTP surface for jobs and their nested resources — stages, activities,
 * issues, variations, progress entries, and the closeout transition. All
 * routes are protected by JWT + the {@link PermissionsGuard}. Read routes
 * require `jobs.view`; mutating routes require `jobs.manage`. The
 * tender-sourced creation path lives on {@link TenderConversionController}
 * instead.
 */
@ApiTags("Jobs")
@ApiBearerAuth()
@Controller("jobs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobsController {
  constructor(private readonly service: JobsService) {}

  /** Paginated list of active (non-archived) jobs; `q` filters by job number, name, or client. */
  @Get()
  @RequirePermissions("jobs.view")
  @ApiOperation({ summary: "List jobs" })
  @ApiQuery({ name: "q", required: false, description: "Free-text search across job name and reference" })
  @ApiQuery({ name: "page", required: false, description: "Page number (1-based)" })
  @ApiQuery({ name: "pageSize", required: false, description: "Page size (max 100)" })
  @ApiQuery({ name: "limit", required: false, description: "Alias for pageSize (max 100)" })
  @ApiResponse({ status: 200, description: "Paginated list of jobs." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  list(@Query() query: JobQueryDto) {
    return this.service.list(query);
  }

  /** Paginated list of archived jobs (closeout `archivedAt` is set). Same `q` filter as the main list. */
  @Get("archive")
  @RequirePermissions("jobs.view")
  @ApiOperation({ summary: "List archived jobs with read-only historical visibility" })
  @ApiQuery({ name: "q", required: false, description: "Free-text search across job name and reference" })
  @ApiQuery({ name: "page", required: false, description: "Page number (1-based)" })
  @ApiQuery({ name: "pageSize", required: false, description: "Page size (max 100)" })
  @ApiQuery({ name: "limit", required: false, description: "Alias for pageSize (max 100)" })
  @ApiResponse({ status: 200, description: "Paginated list of archived (closed-out) jobs." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  listArchive(@Query() query: JobQueryDto) {
    return this.service.listArchive(query);
  }

  /** Create a job without a tender source; canonical `jobNumber` generated server-side if omitted. */
  @Post()
  @RequirePermissions("jobs.manage")
  @ApiOperation({
    summary:
      "Create a job manually (without a tender source). The frontend NewJobSlideOver modal calls this. Tender-sourced jobs continue to flow through the convert-to-job endpoint."
  })
  @ApiResponse({ status: 201, description: "Created job." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Referenced client, site or contact not found." })
  create(@Body() dto: CreateJobDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createJob(dto, actor.sub);
  }

  /** Full job detail including stages, activities, issues, variations, progress entries, status history, closeout, and attached documents. */
  @Get(":id")
  @RequirePermissions("jobs.view")
  @ApiOperation({ summary: "Get job detail" })
  @ApiParam({ name: "id", description: "Job id" })
  @ApiResponse({ status: 200, description: "Job detail with stages, activities, issues and variations." })
  @ApiResponse({ status: 404, description: "Job not found." })
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  /** Patch a job's editable header fields; status changes go through the status route. Rejected on archived jobs. */
  @Patch(":id")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update a job" })
  @ApiParam({ name: "id", description: "Job id to update" })
  @ApiResponse({ status: 200, description: "Updated job." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job not found." })
  update(@Param("id") id: string, @Body() dto: UpdateJobDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateJob(id, dto, actor.sub);
  }

  /** Transition a job to a new status; writes a JobStatusHistory row alongside the update. Rejected on archived jobs. */
  @Patch(":id/status")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job status" })
  @ApiParam({ name: "id", description: "Job id whose status is being updated" })
  @ApiResponse({ status: 200, description: "Updated job status." })
  @ApiResponse({ status: 400, description: "Invalid status transition or payload." })
  @ApiResponse({ status: 404, description: "Job not found." })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateJobStatusDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateStatus(id, dto, actor.sub);
  }

  /** Append a new stage to a job. */
  @Post(":id/stages")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job stage" })
  @ApiParam({ name: "id", description: "Job id the stage belongs to" })
  @ApiResponse({ status: 201, description: "Created job stage." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job not found." })
  createStage(@Param("id") id: string, @Body() dto: CreateJobStageDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createStage(id, dto, actor.sub);
  }

  /** Patch a stage, scoped to its job parent. */
  @Patch(":id/stages/:stageId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job stage" })
  @ApiParam({ name: "id", description: "Job id the stage belongs to" })
  @ApiParam({ name: "stageId", description: "Stage id to update" })
  @ApiResponse({ status: 200, description: "Updated job stage." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job or stage not found." })
  updateStage(
    @Param("id") id: string,
    @Param("stageId") stageId: string,
    @Body() dto: UpdateJobStageDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateStage(id, stageId, dto, actor.sub);
  }

  /** Create an activity under a stage; the stage must belong to the same job. */
  @Post(":id/activities")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job activity" })
  @ApiParam({ name: "id", description: "Job id the activity belongs to" })
  @ApiResponse({ status: 201, description: "Created job activity." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job not found." })
  createActivity(@Param("id") id: string, @Body() dto: CreateJobActivityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createActivity(id, dto, actor.sub);
  }

  /** Patch an activity, scoped to its job parent; can move activities between stages within the same job. */
  @Patch(":id/activities/:activityId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job activity" })
  @ApiParam({ name: "id", description: "Job id the activity belongs to" })
  @ApiParam({ name: "activityId", description: "Activity id to update" })
  @ApiResponse({ status: 200, description: "Updated job activity." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job or activity not found." })
  updateActivity(
    @Param("id") id: string,
    @Param("activityId") activityId: string,
    @Body() dto: UpdateJobActivityDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateActivity(id, activityId, dto, actor.sub);
  }

  /** Raise a new issue against a job; the caller is stamped as `reportedById`. */
  @Post(":id/issues")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job issue" })
  @ApiParam({ name: "id", description: "Job id the issue belongs to" })
  @ApiResponse({ status: 201, description: "Created job issue." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job not found." })
  createIssue(@Param("id") id: string, @Body() dto: CreateJobIssueDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createIssue(id, dto, actor.sub);
  }

  /** Patch an issue, scoped to its job parent. */
  @Patch(":id/issues/:issueId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job issue" })
  @ApiParam({ name: "id", description: "Job id the issue belongs to" })
  @ApiParam({ name: "issueId", description: "Issue id to update" })
  @ApiResponse({ status: 200, description: "Updated job issue." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job or issue not found." })
  updateIssue(
    @Param("id") id: string,
    @Param("issueId") issueId: string,
    @Body() dto: UpdateJobIssueDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateIssue(id, issueId, dto, actor.sub);
  }

  /** Create a variation; `reference` must be unique within the job. */
  @Post(":id/variations")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job variation" })
  @ApiParam({ name: "id", description: "Job id the variation belongs to" })
  @ApiResponse({ status: 201, description: "Created job variation." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job not found." })
  createVariation(@Param("id") id: string, @Body() dto: CreateJobVariationDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createVariation(id, dto, actor.sub);
  }

  /** Patch a variation, scoped to its job parent; uniqueness on `reference` re-checked only if it changes. */
  @Patch(":id/variations/:variationId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job variation" })
  @ApiParam({ name: "id", description: "Job id the variation belongs to" })
  @ApiParam({ name: "variationId", description: "Variation id to update" })
  @ApiResponse({ status: 200, description: "Updated job variation." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job or variation not found." })
  updateVariation(
    @Param("id") id: string,
    @Param("variationId") variationId: string,
    @Body() dto: UpdateJobVariationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateVariation(id, variationId, dto, actor.sub);
  }

  /** Append a progress or daily-note entry; the caller is stamped as the author. */
  @Post(":id/progress-entries")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job progress or daily note entry" })
  @ApiParam({ name: "id", description: "Job id the progress entry belongs to" })
  @ApiResponse({ status: 201, description: "Created job progress entry." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job not found." })
  createProgress(
    @Param("id") id: string,
    @Body() dto: CreateJobProgressEntryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createProgressEntry(id, dto, actor.sub);
  }

  /** Upsert the job's closeout record; transitions the job into its final state and gates future writes via `readOnlyFrom`. */
  @Patch(":id/closeout")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create or update job closeout and archive state" })
  @ApiParam({ name: "id", description: "Job id to close out / archive" })
  @ApiResponse({ status: 200, description: "Job closeout payload after update." })
  @ApiResponse({ status: 400, description: "Validation failed (missing/invalid fields)." })
  @ApiResponse({ status: 404, description: "Job not found." })
  closeout(@Param("id") id: string, @Body() dto: CloseoutJobDto, @CurrentUser() actor: { sub: string }) {
    return this.service.closeoutJob(id, dto, actor.sub);
  }
}
