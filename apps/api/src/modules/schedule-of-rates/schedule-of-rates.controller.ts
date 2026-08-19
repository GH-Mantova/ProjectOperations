import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ScheduleOfRatesService } from "./schedule-of-rates.service";
import { CreateSorService } from "./create-sor.service";
import { SorCategory, SorPeriodHalf, SorRateSourceType } from "@prisma/client";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

// S4 — Create SoR wizard DTOs

class CreateSorLineDto {
  @IsString() name!: string;
  @IsEnum(SorCategory) category!: SorCategory;
  @IsOptional() @IsString() unit?: string | null;
  @Type(() => Number) @IsNumber() baseRate!: number;
  @IsEnum(SorRateSourceType) sourceType!: SorRateSourceType;
  @IsOptional() @IsString() sourceRateRowId?: string | null;
  @IsOptional() @IsString() sourceSubRateId?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() markupPct?: number | null;
}

class CreateSorWizardDto {
  @Type(() => Number) @IsNumber() year!: number;
  @IsEnum(SorPeriodHalf) half!: SorPeriodHalf;
  @IsString() startDate!: string;
  @IsString() expiryDate!: string;
  @IsString() label!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateSorLineDto) lines!: CreateSorLineDto[];
}

class CreatePeriodDto {
  @Type(() => Number) @IsNumber() year!: number;
  @IsEnum(SorPeriodHalf) half!: SorPeriodHalf;
  @IsString() startDate!: string;
  @IsString() expiryDate!: string;
  @IsString() label!: string;
  @IsOptional() @IsString() status?: string;
}

class CreateRateDto {
  @IsEnum(SorCategory) category!: SorCategory;
  @IsString() name!: string;
  @IsOptional() @IsString() class?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() ordinary?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() oneAndHalf?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() double?: number | null;
  @IsOptional() @IsBoolean() isReference?: boolean;
  @IsOptional() @IsString() comments?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
}

class UpdateRateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() class?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() ordinary?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() oneAndHalf?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() double?: number | null;
  @IsOptional() @IsBoolean() isReference?: boolean;
  @IsOptional() @IsString() comments?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class SorClientPdfHeaderDto {
  @IsString() docRef!: string;
  @IsOptional() @IsString() clientName?: string | null;
  @IsOptional() @IsString() contactName?: string | null;
  @IsOptional() @IsString() projectTitle?: string | null;
  @IsOptional() @IsString() siteAddress?: string | null;
  @IsOptional() @IsString() preparedBy?: string | null;
  @IsOptional() @IsString() preparedByEmail?: string | null;
}

class GenerateSorClientPdfDto {
  @IsArray() @IsString({ each: true }) lineIds!: string[];
  @ValidateNested() @Type(() => SorClientPdfHeaderDto) header!: SorClientPdfHeaderDto;
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * Schedule of Rates (SoR S1) — master rate-book REST surface.
 *
 * Read endpoints require `rates.manage` (same as the existing Rates R0 module).
 * All write endpoints also require `rates.manage`.
 *
 * This is the live-job rate catalog, separate from the tender estimate engine.
 */
@ApiTags("Schedule of Rates")
@ApiBearerAuth()
@Controller("schedule-of-rates")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScheduleOfRatesController {
  constructor(
    private readonly service: ScheduleOfRatesService,
    private readonly createSorService: CreateSorService,
  ) {}

  // ── Periods ───────────────────────────────────────────────────────────────

  /** List all SorPeriods. */
  @Get("periods")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "List all SoR periods." })
  @ApiResponse({ status: 200, description: "List of SoR periods." })
  listPeriods() {
    return this.service.listPeriods();
  }

  /** Get a period with its rates grouped by category. */
  @Get("periods/:id")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Get a SoR period with rates grouped by category." })
  @ApiParam({ name: "id", description: "SorPeriod id" })
  @ApiResponse({ status: 200, description: "Period found with rates by category." })
  @ApiResponse({ status: 404, description: "Period not found." })
  getPeriodWithRates(@Param("id") id: string) {
    return this.service.getPeriodWithRates(id);
  }

  /** Create a new SoR period. Year+half must be unique. */
  @Post("periods")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Create a new SoR period (year + H1/H2)." })
  @ApiResponse({ status: 201, description: "Period created." })
  createPeriod(@Body() dto: CreatePeriodDto) {
    return this.service.createPeriod(dto as never);
  }

  /**
   * S4 — Create SoR wizard endpoint.
   *
   * Creates the SorPeriod + all SorRate lines in a single transaction, with
   * source linkage (INTERNAL / SUBBIE / SUPPLIER / MANUAL) and per-line markup
   * pre-applied. Returns the full period including rates.
   *
   * POST body: CreateSorWizardDto
   */
  @Post("create-period")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "S4 wizard — create a SorPeriod with pre-linked rates." })
  @ApiResponse({ status: 201, description: "Period created with rates." })
  @ApiResponse({ status: 409, description: "Year+half combination already exists." })
  createSorPeriod(
    @Body() dto: CreateSorWizardDto,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.createSorService.createSorPeriod(dto as never, actor.sub);
  }

  // ── Rates ─────────────────────────────────────────────────────────────────

  /** Create a rate in a period. Appends a SorChangeLogEntry. */
  @Post("periods/:id/rates")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Add a rate to a SoR period." })
  @ApiParam({ name: "id", description: "SorPeriod id" })
  @ApiResponse({ status: 201, description: "Rate created." })
  @ApiResponse({ status: 404, description: "Period not found." })
  createRate(
    @Param("id") periodId: string,
    @Body() dto: CreateRateDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createRate(periodId, dto as never, actor.sub);
  }

  /** Update a rate. Appends SorChangeLogEntry entries for changed fields. */
  @Patch("rates/:id")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Update a SoR rate. Changed fields are logged." })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 200, description: "Rate updated." })
  @ApiResponse({ status: 404, description: "Rate not found." })
  updateRate(
    @Param("id") rateId: string,
    @Body() dto: UpdateRateDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateRate(rateId, dto as never, actor.sub);
  }

  /** Deactivate a rate (soft-delete). Logs the change. */
  @Delete("rates/:id")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Deactivate a SoR rate (soft-delete; active=false)." })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 200, description: "Rate deactivated." })
  @ApiResponse({ status: 404, description: "Rate not found." })
  deactivateRate(
    @Param("id") rateId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deactivateRate(rateId, actor.sub);
  }

  // ── Change log ────────────────────────────────────────────────────────────

  /** List the change log for a period in chronological order. */
  @Get("periods/:id/change-log")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "List the append-only change log for a SoR period." })
  @ApiParam({ name: "id", description: "SorPeriod id" })
  @ApiResponse({ status: 200, description: "Change log entries." })
  @ApiResponse({ status: 404, description: "Period not found." })
  listChangeLog(@Param("id") periodId: string) {
    return this.service.listChangeLog(periodId);
  }

  // ── Client PDF (S5) ────────────────────────────────────────────────────────

  /**
   * Generate a client-facing SoR PDF from a selection of applicable rate lines.
   *
   * POST body: { lineIds: string[], header: { docRef, clientName?, ... } }
   *
   * IMPORTANT: internal margin / BMI / cost-plus columns are NEVER included
   * in the generated PDF — this is enforced in the builder layer.
   */
  @Post("client-pdf")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Generate a client-facing SoR PDF (selected applicable lines)." })
  @ApiResponse({ status: 200, description: "PDF stream (application/pdf)." })
  async generateClientPdf(
    @Body() dto: GenerateSorClientPdfDto,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.generateClientPdf({
      lineIds: dto.lineIds,
      header: dto.header,
    });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }
}
