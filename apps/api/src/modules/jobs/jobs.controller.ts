import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  CloseoutJobDto,
  CreateJobActivityDto,
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

@ApiTags("Jobs")
@ApiBearerAuth()
@Controller("jobs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobsController {
  constructor(private readonly service: JobsService) {}

  @Get()
  @RequirePermissions("jobs.view")
  @ApiOperation({ summary: "List jobs" })
  list(@Query() query: JobQueryDto) {
    return this.service.list(query);
  }

  @Get("archive")
  @RequirePermissions("jobs.view")
  @ApiOperation({ summary: "List archived jobs with read-only historical visibility" })
  listArchive(@Query() query: JobQueryDto) {
    return this.service.listArchive(query);
  }

  @Get(":id")
  @RequirePermissions("jobs.view")
  @ApiOperation({ summary: "Get job detail" })
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Patch(":id")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update a job" })
  update(@Param("id") id: string, @Body() dto: UpdateJobDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateJob(id, dto, actor.sub);
  }

  @Patch(":id/status")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateJobStatusDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateStatus(id, dto, actor.sub);
  }

  @Post(":id/stages")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job stage" })
  createStage(@Param("id") id: string, @Body() dto: CreateJobStageDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createStage(id, dto, actor.sub);
  }

  @Patch(":id/stages/:stageId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job stage" })
  updateStage(
    @Param("id") id: string,
    @Param("stageId") stageId: string,
    @Body() dto: UpdateJobStageDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateStage(id, stageId, dto, actor.sub);
  }

  @Post(":id/activities")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job activity" })
  createActivity(@Param("id") id: string, @Body() dto: CreateJobActivityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createActivity(id, dto, actor.sub);
  }

  @Patch(":id/activities/:activityId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job activity" })
  updateActivity(
    @Param("id") id: string,
    @Param("activityId") activityId: string,
    @Body() dto: UpdateJobActivityDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateActivity(id, activityId, dto, actor.sub);
  }

  @Post(":id/issues")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job issue" })
  createIssue(@Param("id") id: string, @Body() dto: CreateJobIssueDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createIssue(id, dto, actor.sub);
  }

  @Patch(":id/issues/:issueId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job issue" })
  updateIssue(
    @Param("id") id: string,
    @Param("issueId") issueId: string,
    @Body() dto: UpdateJobIssueDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateIssue(id, issueId, dto, actor.sub);
  }

  @Post(":id/variations")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job variation" })
  createVariation(@Param("id") id: string, @Body() dto: CreateJobVariationDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createVariation(id, dto, actor.sub);
  }

  @Patch(":id/variations/:variationId")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Update job variation" })
  updateVariation(
    @Param("id") id: string,
    @Param("variationId") variationId: string,
    @Body() dto: UpdateJobVariationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateVariation(id, variationId, dto, actor.sub);
  }

  @Post(":id/progress-entries")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create job progress or daily note entry" })
  createProgress(
    @Param("id") id: string,
    @Body() dto: CreateJobProgressEntryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createProgressEntry(id, dto, actor.sub);
  }

  @Patch(":id/closeout")
  @RequirePermissions("jobs.manage")
  @ApiOperation({ summary: "Create or update job closeout and archive state" })
  closeout(@Param("id") id: string, @Body() dto: CloseoutJobDto, @CurrentUser() actor: { sub: string }) {
    return this.service.closeoutJob(id, dto, actor.sub);
  }
}
