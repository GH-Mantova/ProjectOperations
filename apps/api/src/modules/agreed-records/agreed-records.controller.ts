import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { IsDecimal, IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AgreedRecordsService } from "./agreed-records.service";

// ── DTOs ─────────────────────────────────────────────────────────────────────

class CreateAgreedRecordDto {
  @IsString() jobId!: string;
  @IsString() @MinLength(1) description!: string;
  @IsString() workDate!: string; // ISO date string
}

class UpdateAgreedRecordDto {
  @IsOptional() @IsString() @MinLength(1) description?: string;
  @IsOptional() @IsString() workDate?: string;
}

const SOR_CATEGORIES = ["LABOUR", "PLANT", "WASTE", "SUBCONTRACTOR"] as const;

class CreateAgreedRecordLineDto {
  @IsIn(SOR_CATEGORIES) category!: "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
  @IsString() @MinLength(1) resourceName!: string;
  @IsOptional() @IsString() class?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @Type(() => Number) @IsNumber() quantity!: number;
  @IsOptional() @IsString() tier?: string;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
}

class UpdateAgreedRecordLineDto {
  @IsOptional() @IsIn(SOR_CATEGORIES) category?: "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
  @IsOptional() @IsString() @MinLength(1) resourceName?: string;
  @IsOptional() @IsString() class?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() quantity?: number;
  @IsOptional() @IsString() tier?: string;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
}

class CreateAgreedRecordAttachmentDto {
  @IsOptional() @IsString() kind?: string;
  @IsString() @MinLength(1) filePath!: string;
  @IsOptional() @IsString() uploadedById?: string | null;
}

class SubmitAgreedRecordDto {
  @IsString() @MinLength(1) workerSignaturePath!: string;
  @IsOptional() @IsString() workerSignedById?: string | null;
  @IsString() @MinLength(1) clientRepName!: string;
  @IsString() @MinLength(1) clientRepSignaturePath!: string;
  @IsOptional() @IsString() sorPeriodId?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

type RequestUser = { sub: string; permissions: string[] };

/**
 * SoR S7 — Agreed Record (AR / dayworks) REST surface.
 *
 * Field crews capture dayworks against a job's locked SoR snapshot.
 * No rate or dollar value is returned by ANY endpoint in this controller.
 * Pricing happens in S8 (office review).
 *
 * Permission: field.view (same as dockets, pre-starts, timesheets).
 */
@ApiTags("Agreed Records")
@ApiBearerAuth()
@Controller("agreed-records")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AgreedRecordsController {
  constructor(private readonly service: AgreedRecordsService) {}

  // ── List for job ──────────────────────────────────────────────────────────

  @Get("for-job/:jobId")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary: "List Agreed Records for a job (field crew view — no rates or dollar amounts).",
  })
  @ApiParam({ name: "jobId", description: "Job id" })
  @ApiResponse({ status: 200, description: "List of Agreed Records with lines and attachments." })
  @ApiResponse({ status: 404, description: "Job not found." })
  listForJob(@Param("jobId") jobId: string) {
    return this.service.listForJob(jobId);
  }

  // ── Create DRAFT ──────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Create a DRAFT Agreed Record for a job (worker)." })
  @ApiResponse({ status: 201, description: "DRAFT Agreed Record created with an AR-XXXXXX number." })
  @ApiResponse({ status: 404, description: "Job not found." })
  create(@Body() dto: CreateAgreedRecordDto, @CurrentUser() user: RequestUser) {
    return this.service.createDraft(
      { jobId: dto.jobId, description: dto.description, workDate: dto.workDate },
      user.sub,
    );
  }

  // ── Update DRAFT ──────────────────────────────────────────────────────────

  @Patch(":id")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Edit description or workDate on a DRAFT Agreed Record." })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 200, description: "Updated Agreed Record." })
  @ApiResponse({ status: 400, description: "Record is not in DRAFT status." })
  @ApiResponse({ status: 404, description: "Agreed Record not found." })
  update(@Param("id") id: string, @Body() dto: UpdateAgreedRecordDto) {
    return this.service.updateDraft(id, dto);
  }

  // ── Lines ─────────────────────────────────────────────────────────────────

  @Post(":id/lines")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary:
      "Add a resource line (category / resource / qty, tier for labour). No rate or dollar field accepted.",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 201, description: "Line added." })
  @ApiResponse({ status: 400, description: "Record not in DRAFT." })
  addLine(@Param("id") id: string, @Body() dto: CreateAgreedRecordLineDto) {
    return this.service.addLine(id, dto);
  }

  @Patch(":id/lines/:lineId")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary: "Update a resource line on a DRAFT Agreed Record. No rate or dollar field accepted.",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiParam({ name: "lineId", description: "Agreed Record Line id" })
  @ApiResponse({ status: 200, description: "Updated line." })
  @ApiResponse({ status: 400, description: "Record not in DRAFT." })
  @ApiResponse({ status: 404, description: "Line not found." })
  updateLine(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateAgreedRecordLineDto,
  ) {
    return this.service.updateLine(id, lineId, dto);
  }

  @Delete(":id/lines/:lineId")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Delete a resource line from a DRAFT Agreed Record." })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiParam({ name: "lineId", description: "Agreed Record Line id" })
  @ApiResponse({ status: 200, description: "Deleted." })
  @ApiResponse({ status: 400, description: "Record not in DRAFT." })
  @ApiResponse({ status: 404, description: "Line not found." })
  deleteLine(@Param("id") id: string, @Param("lineId") lineId: string) {
    return this.service.deleteLine(id, lineId);
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  @Post(":id/attachments")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary: "Attach a photo or signature file to an Agreed Record (mirrors the docket attachment path).",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 201, description: "Attachment created." })
  @ApiResponse({ status: 404, description: "Agreed Record not found." })
  addAttachment(
    @Param("id") id: string,
    @Body() dto: CreateAgreedRecordAttachmentDto,
  ) {
    return this.service.addAttachment(id, dto);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  @Post(":id/submit")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary:
      "Submit a DRAFT Agreed Record. Requires worker signature, client-rep name + signature, and at least one photo. " +
      "If the job has no SoR snapshot yet, provide sorPeriodId to lock one (first AR/VC locks it rule).",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 201, description: "Submitted Agreed Record with snapshot stamped." })
  @ApiResponse({
    status: 400,
    description:
      "Not DRAFT, missing worker/client-rep signature, missing photo, or no snapshot and no sorPeriodId.",
  })
  submit(
    @Param("id") id: string,
    @Body() dto: SubmitAgreedRecordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.submit(id, dto, user.sub);
  }
}
