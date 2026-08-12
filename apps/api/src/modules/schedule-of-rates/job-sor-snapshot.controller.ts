import {
  Body,
  Controller,
  Get,
  Param,
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
import { IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { JobSorSnapshotService } from "./job-sor-snapshot.service";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class AttachSnapshotDto {
  @IsOptional() @IsString() jobId?: string | null;
  @IsOptional() @IsString() tenderId?: string | null;
  @IsString() sorPeriodId!: string;
}

class ReissueDto {
  @IsString() nextSorPeriodId!: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * SoR S4 — Job SoR snapshot REST surface.
 *
 * Nested under /schedule-of-rates/job-sor-snapshot. Permissions: `rates.manage`.
 * S6/S7 will call `attach` (idempotent) on first VC/AR creation and read
 * locked rates through `for-job` / `for-tender` / `rate/:snapshotId/:sortKey`.
 */
@ApiTags("Schedule of Rates — Job SoR Snapshots")
@ApiBearerAuth()
@Controller("schedule-of-rates/job-sor-snapshot")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobSorSnapshotController {
  constructor(private readonly service: JobSorSnapshotService) {}

  /**
   * Attach (or return the existing) rate-book snapshot for a job OR tender.
   * Body: { jobId? | tenderId?, sorPeriodId }.
   */
  @Post("attach")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Lock a SoR snapshot to a job or tender (idempotent)." })
  @ApiResponse({ status: 201, description: "Snapshot created or existing snapshot returned." })
  @ApiResponse({ status: 400, description: "Bad target — provide exactly one of jobId or tenderId." })
  @ApiResponse({ status: 404, description: "Target or SorPeriod not found." })
  attach(
    @Body() dto: AttachSnapshotDto,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.attach(
      { jobId: dto.jobId ?? null, tenderId: dto.tenderId ?? null, sorPeriodId: dto.sorPeriodId },
      actor.sub,
    );
  }

  /** Return the ACTIVE snapshot for a job (locked rates included). */
  @Get("for-job/:jobId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Return the active JobSorSnapshot for a job." })
  @ApiParam({ name: "jobId", description: "Job id" })
  @ApiResponse({ status: 200, description: "Snapshot + locked rates, or null." })
  getForJob(@Param("jobId") jobId: string) {
    return this.service.getForJob(jobId);
  }

  /** Return the ACTIVE snapshot for a tender (locked rates included). */
  @Get("for-tender/:tenderId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Return the active JobSorSnapshot for a tender." })
  @ApiParam({ name: "tenderId", description: "Tender id" })
  @ApiResponse({ status: 200, description: "Snapshot + locked rates, or null." })
  getForTender(@Param("tenderId") tenderId: string) {
    return this.service.getForTender(tenderId);
  }

  /**
   * Reissue the snapshot for the next period once the current one has expired.
   * The previous snapshot is marked SUPERSEDED and its rates are left intact.
   */
  @Post(":snapshotId/reissue")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Reissue a JobSorSnapshot for the next SoR period." })
  @ApiParam({ name: "snapshotId", description: "JobSorSnapshot id (the expired one)" })
  @ApiResponse({ status: 201, description: "Successor snapshot created; predecessor superseded." })
  @ApiResponse({ status: 400, description: "Current period has not expired yet." })
  reissue(
    @Param("snapshotId") snapshotId: string,
    @Body() dto: ReissueDto,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.reissue(snapshotId, dto.nextSorPeriodId, actor.sub);
  }

  /**
   * Return one locked rate row from a snapshot. S6/S7 use this when stamping
   * the frozen rate onto a Variation / ProgressClaim line at record creation.
   */
  @Get("rate/:snapshotId/:snapshotRateId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Fetch a single locked rate from a snapshot." })
  @ApiParam({ name: "snapshotId", description: "JobSorSnapshot id" })
  @ApiParam({ name: "snapshotRateId", description: "JobSorSnapshotRate id" })
  @ApiResponse({ status: 200, description: "Locked rate row." })
  @ApiResponse({ status: 404, description: "Rate not found in this snapshot." })
  getLockedRate(
    @Param("snapshotId") snapshotId: string,
    @Param("snapshotRateId") snapshotRateId: string,
  ) {
    return this.service.getLockedRate(snapshotId, snapshotRateId);
  }
}
