import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AgreedRecordRegisterService } from "./agreed-record-register.service";

type RequestUser = { sub: string; permissions: string[] };

// ── DTOs ─────────────────────────────────────────────────────────────────────

class RaiseClaimDto {
  /** Any date inside the claim month; normalised to UTC start-of-month. */
  @IsString() claimMonth!: string;

  @IsOptional() @IsArray() @IsString({ each: true }) variationIds?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) agreedRecordIds?: string[];
}

/**
 * SoR S9a — per-job VC + AR register and the approved-item claim feed.
 *
 * Three routes, all scoped to one job:
 *   GET  register/for-job/:jobId                     — the whole register
 *   GET  register/for-job/:jobId/eligible-for-claim  — the APPROVED-only subset
 *   POST register/for-job/:jobId/raise-claim         — write the claim
 *
 * NOTE: the literal segment `eligible-for-claim` is a contract with S9b (its
 * chain gate points at this exact string) — do not rename it.
 *
 * Permissions are the EXISTING progress-claim codes used by
 * ContractsController — `finance.view` to read, `finance.manage` to write.
 * No new permission is introduced by this slice.
 */
@ApiTags("Agreed Records")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("agreed-records/register")
export class AgreedRecordRegisterController {
  constructor(private readonly service: AgreedRecordRegisterService) {}

  // ── Full register ─────────────────────────────────────────────────────────

  @Get("for-job/:jobId")
  @RequirePermissions("finance.view")
  @ApiOperation({
    summary:
      "Per-job register of Variation Contracts and Agreed Records, with SoR version, status and priced amount.",
  })
  @ApiParam({ name: "jobId", description: "Job id" })
  @ApiResponse({
    status: 200,
    description:
      "VC + AR rows sorted createdAt desc. `contractId` is null when the job has no linked contract — the AR half is still returned.",
  })
  @ApiResponse({ status: 404, description: "Job not found." })
  getRegister(@Param("jobId") jobId: string) {
    return this.service.getRegisterForJob(jobId);
  }

  // ── Approved-only subset ──────────────────────────────────────────────────

  @Get("for-job/:jobId/eligible-for-claim")
  @RequirePermissions("finance.view")
  @ApiOperation({
    summary:
      "The APPROVED-only subset of the register: variations with an approved amount, and APPROVED agreed records signed by both worker and client rep.",
  })
  @ApiParam({ name: "jobId", description: "Job id" })
  @ApiResponse({ status: 200, description: "Claimable VC + AR rows." })
  @ApiResponse({ status: 404, description: "Job not found." })
  getEligibleForClaim(@Param("jobId") jobId: string) {
    return this.service.getEligibleForClaim(jobId);
  }

  // ── Raise / append a claim ────────────────────────────────────────────────

  @Post("for-job/:jobId/raise-claim")
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Feed the selected approved VCs and ARs into the progress claim for the job's contract + month, then notify the Director.",
  })
  @ApiParam({ name: "jobId", description: "Job id" })
  @ApiResponse({
    status: 201,
    description:
      "Claim id plus what was written. Ids that fail the approval filter are skipped and listed in `skipped`.",
  })
  @ApiResponse({
    status: 400,
    description:
      "No linked contract, nothing selected, nothing claimable, or the month's claim is no longer a draft.",
  })
  @ApiResponse({ status: 404, description: "Job not found." })
  raiseClaim(
    @Param("jobId") jobId: string,
    @Body() dto: RaiseClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.raiseClaim(jobId, user.sub, {
      claimMonth: dto.claimMonth,
      variationIds: dto.variationIds ?? [],
      agreedRecordIds: dto.agreedRecordIds ?? [],
    });
  }
}
