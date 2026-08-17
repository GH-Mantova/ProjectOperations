import {
  Body,
  Controller,
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
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AgreedRecordReviewService } from "./agreed-record-review.service";

// ── DTOs ─────────────────────────────────────────────────────────────────────

const SOR_CATEGORIES = ["LABOUR", "PLANT", "WASTE", "SUBCONTRACTOR"] as const;
const TIER_VALUES = ["ORDINARY", "ONE_AND_HALF", "DOUBLE"] as const;

class OfficeUpdateLineDto {
  @IsOptional()
  @IsIn(SOR_CATEGORIES)
  category?: "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";

  @IsOptional()
  @IsString()
  @MinLength(1)
  resourceName?: string;

  @IsOptional()
  @IsString()
  class?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsIn(TIER_VALUES)
  tier?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}

class PriceLineDto {
  @IsOptional()
  @IsString()
  snapshotRateId?: string | null;

  @IsIn(TIER_VALUES)
  tier!: string;

  /** Required when snapshotRateId is omitted (manual override). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rate?: number | null;
}

class SendBackDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

type RequestUser = { sub: string; permissions: string[] };

/**
 * SoR S8 — Agreed Record office review REST surface.
 *
 * Office staff (WHS&CC, Ops Manager) pick up SUBMITTED ARs, correct lines,
 * price from the frozen Job SoR snapshot, finalise pricing, and either approve
 * or send back to the worker.
 *
 * Permission: `rates.manage` (same as SoR rate-book management). No new
 * permission is introduced — this gate is intentionally aligned with the
 * existing SoR office audience.
 */
@ApiTags("Agreed Records")
@ApiBearerAuth()
@Controller("agreed-records")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AgreedRecordReviewController {
  constructor(private readonly service: AgreedRecordReviewService) {}

  // ── Review queue ──────────────────────────────────────────────────────────

  @Get("review-queue")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "List all ARs in office states (SUBMITTED, OFFICE_REVIEW, PRICED) for the reviewer's queue.",
  })
  @ApiResponse({ status: 200, description: "List of ARs awaiting or under office review." })
  getReviewQueue() {
    return this.service.getReviewQueue();
  }

  // ── Take into review ──────────────────────────────────────────────────────

  @Post(":id/take-review")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Take a SUBMITTED AR into OFFICE_REVIEW. Stamps reviewerId and fires WHS&CC notification.",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 201, description: "AR is now in OFFICE_REVIEW." })
  @ApiResponse({ status: 400, description: "AR is not in SUBMITTED status." })
  @ApiResponse({ status: 404, description: "AR not found." })
  takeReview(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.takeReview(id, user.sub);
  }

  // ── Office line correction ────────────────────────────────────────────────

  @Patch(":id/lines/:lineId")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Office correction to a captured line (resource / class / unit / quantity / tier). " +
      "Legal while AR is in OFFICE_REVIEW.",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiParam({ name: "lineId", description: "Agreed Record Line id" })
  @ApiResponse({ status: 200, description: "Updated line." })
  @ApiResponse({ status: 400, description: "AR not in OFFICE_REVIEW." })
  @ApiResponse({ status: 404, description: "Line not found." })
  updateLine(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: OfficeUpdateLineDto,
    @CurrentUser() _user: RequestUser,
  ) {
    return this.service.updateLine(id, lineId, dto);
  }

  // ── Price a line ──────────────────────────────────────────────────────────

  @Post(":id/lines/:lineId/price")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Price a line from the frozen snapshot rate (or manual override). " +
      "Creates/replaces the AgreedRecordPricingLine. AR must be in OFFICE_REVIEW.",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiParam({ name: "lineId", description: "Agreed Record Line id" })
  @ApiResponse({ status: 201, description: "Pricing line created/updated." })
  @ApiResponse({
    status: 400,
    description:
      "AR not in OFFICE_REVIEW, line not found, invalid tier, or manual override missing rate.",
  })
  priceLine(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: PriceLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.priceLine(id, lineId, dto, user.sub);
  }

  // ── Finalise pricing ──────────────────────────────────────────────────────

  @Post(":id/finalise-pricing")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Finalise pricing on an AR in OFFICE_REVIEW. Recomputes total, transitions to PRICED, " +
      "and fires the Ops Manager notification.",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 201, description: "AR is now PRICED." })
  @ApiResponse({
    status: 400,
    description:
      "AR not in OFFICE_REVIEW, no lines, or not all lines have been priced.",
  })
  finalisePricing(@Param("id") id: string) {
    return this.service.finalisePricing(id);
  }

  // ── Approve ───────────────────────────────────────────────────────────────

  @Post(":id/approve")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Ops sign-off: PRICED -> APPROVED. Rejects if the approver priced any line (separation of duties).",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 201, description: "AR is APPROVED." })
  @ApiResponse({ status: 400, description: "AR not in PRICED status." })
  @ApiResponse({ status: 403, description: "Approver also priced a line (separation of duties)." })
  @ApiResponse({ status: 404, description: "AR not found." })
  approve(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.approve(id, user.sub);
  }

  // ── Send back ─────────────────────────────────────────────────────────────

  @Post(":id/send-back")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Send an AR back to the worker from any office state (OFFICE_REVIEW, PRICED). " +
      "Stamps sentBackReason. Requires a mandatory reason.",
  })
  @ApiParam({ name: "id", description: "Agreed Record id" })
  @ApiResponse({ status: 201, description: "AR is SENT_BACK." })
  @ApiResponse({
    status: 400,
    description: "AR not in an office state, or reason is empty.",
  })
  @ApiResponse({ status: 404, description: "AR not found." })
  sendBack(@Param("id") id: string, @Body() dto: SendBackDto) {
    return this.service.sendBack(id, { reason: dto.reason });
  }
}
