import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ComplianceService } from "./compliance.service";

class UpsertQualificationDto {
  @IsOptional() @IsString() qualType?: string;
  @IsOptional() @IsString() licenceNumber?: string | null;
  @IsOptional() @IsString() issuingAuthority?: string | null;
  @IsOptional() @IsString() issueDate?: string | null;
  @IsOptional() @IsString() expiryDate?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class BlockDto {
  @IsBoolean() blocked!: boolean;
  @IsOptional() @IsString() reason?: string | null;
}

class ExpiringQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days?: number;
}

class CompetencyCheckQuery {
  @IsString() requiredQuals!: string;
}

/**
 * HTTP surface for the compliance module — §13 Forms & Compliance.
 *
 * Three read-only dashboard endpoints for surfacing expiring licences,
 * insurances, and worker qualifications; a small CRUD for worker
 * qualifications keyed on the worker profile; a read-only competency-gate
 * lookup that callers (allocations, scheduler) use to decide whether a worker
 * meets a required qualification set; and two admin actions for triggering
 * the daily alert pass on demand and manually toggling a subcontractor's
 * compliance block.
 *
 * All routes are guarded by {@link JwtAuthGuard} + {@link PermissionsGuard};
 * each handler advertises its required permission via
 * {@link RequirePermissions} (`compliance.view`, `compliance.manage`, or
 * `compliance.admin`).
 */
@ApiTags("Compliance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  // ─── Dashboards / lists ─────────────────────────────────────────────────
  /**
   * Expiring licences, insurances, and qualifications within 30 days.
   *
   * Convenience wrapper over {@link expiring} using the default 30-day
   * window — the surface the WHS dashboard hits on load.
   *
   * @returns Buckets of `licences`, `insurances`, and `qualifications`, each
   *   row carrying a derived `status` and `daysUntilExpiry`.
   */
  @Get("dashboard")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Expiring licences, insurances, and qualifications within 30 days." })
  dashboard() {
    return this.service.getExpiringItems(30);
  }

  /**
   * Expiring items within `days` (default 30, max 90).
   *
   * The `days` query param is the *look-ahead window*: any item whose
   * `expiryDate` falls between now and `now + days` is returned, plus items
   * that are already expired. Items with no `expiryDate` are excluded.
   * Status thresholds are fixed inside the service (`expired` / `expiring_7`
   * / `expiring_30` / `active`) and do NOT shift with this window — only
   * which rows are returned changes.
   *
   * @param q.days Look-ahead window in days. Optional, defaults to 30, must
   *   be between 1 and 90 inclusive.
   * @returns Buckets of `licences`, `insurances`, and `qualifications`, each
   *   row carrying a derived `status` and `daysUntilExpiry`.
   */
  @Get("expiring")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Expiring items within `days` (default 30, max 90)." })
  @ApiQuery({ name: "days", required: false })
  expiring(@Query() q: ExpiringQuery) {
    return this.service.getExpiringItems(q.days ?? 30);
  }

  /**
   * Subcontractors currently blocked from engagement on compliance grounds.
   *
   * Returns every subcontractor with `complianceBlocked = true`, regardless
   * of whether the block was set automatically by the daily cron (expired
   * critical licence/insurance) or manually via {@link block}. Ordered most
   * recently blocked first.
   *
   * @returns Array of `SubcontractorSupplier` rows.
   */
  @Get("blocked-subcontractors")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Subcontractors currently blocked from engagement on compliance grounds." })
  blockedSubcontractors() {
    return this.service.listBlockedSubcontractors();
  }

  // ─── Worker qualifications ──────────────────────────────────────────────
  /**
   * List a worker's qualifications.
   *
   * Each row is decorated with the derived `status` field
   * (`not_set` / `active` / `expiring_30` / `expiring_7` / `expired`)
   * computed from `expiryDate` at read time. Ordered by `expiryDate` ascending
   * with `qualType` as the tiebreaker, so soonest-expiring surfaces first.
   *
   * @param workerProfileId The worker profile to list qualifications for.
   * @returns Array of `WorkerQualification` rows with derived `status`.
   * @throws NotFoundException When the worker profile does not exist.
   */
  @Get("workers/:workerProfileId/qualifications")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "List a worker's qualifications with derived status." })
  @ApiResponse({ status: 200, description: "Worker qualifications." })
  @ApiResponse({ status: 404, description: "Worker profile not found." })
  listQualifications(@Param("workerProfileId") workerProfileId: string) {
    return this.service.listQualifications(workerProfileId);
  }

  /**
   * Create a qualification on a worker.
   *
   * `qualType` is mandatory and must be one of the supported codes
   * (`white_card`, `asbestos_a`, `asbestos_b`, `forklift`, `ewp`, `rigger`,
   * `scaffolder`, `first_aid`, `warden`, `dogman`, `crane`, `electrical`,
   * `plumbing`, `other`). The JWT actor is recorded as `createdById`.
   *
   * @param workerProfileId The worker the qualification belongs to.
   * @param dto Qualification fields. `qualType` is required.
   * @param actor JWT actor — recorded as `createdById`.
   * @returns The created `WorkerQualification` row.
   * @throws NotFoundException When the worker profile does not exist.
   * @throws BadRequestException When `qualType` is missing or invalid.
   */
  @Post("workers/:workerProfileId/qualifications")
  @RequirePermissions("compliance.manage")
  @ApiOperation({ summary: "Create a qualification on a worker." })
  @ApiResponse({ status: 201, description: "Qualification created." })
  createQualification(
    @Param("workerProfileId") workerProfileId: string,
    @Body() dto: UpsertQualificationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createQualification(workerProfileId, dto as never, actor.sub);
  }

  /**
   * Patch a worker's qualification (partial update).
   *
   * Only fields present in the body are written; undefined fields are left
   * untouched. Explicit `null` clears the corresponding column. `qualType`,
   * if supplied, is validated against the supported set.
   *
   * @param workerProfileId The owning worker profile.
   * @param qualId The qualification row to patch.
   * @param dto Partial qualification fields.
   * @returns The updated `WorkerQualification` row.
   * @throws NotFoundException When the qualification does not exist on the
   *   given worker (404 covers cross-worker access attempts too).
   * @throws BadRequestException When `qualType` is supplied but invalid.
   */
  @Patch("workers/:workerProfileId/qualifications/:qualId")
  @RequirePermissions("compliance.manage")
  @ApiOperation({ summary: "Partially update a worker's qualification." })
  @ApiResponse({ status: 200, description: "Updated qualification." })
  @ApiResponse({ status: 404, description: "Qualification not found." })
  patchQualification(
    @Param("workerProfileId") workerProfileId: string,
    @Param("qualId") qualId: string,
    @Body() dto: UpsertQualificationDto
  ) {
    return this.service.updateQualification(workerProfileId, qualId, dto as never);
  }

  /**
   * Delete a worker's qualification.
   *
   * Hard delete — the row is removed, not soft-flagged. The worker-profile
   * scope on the lookup means callers cannot delete qualifications off
   * unrelated workers by guessing IDs.
   *
   * @param workerProfileId The owning worker profile.
   * @param qualId The qualification row to delete.
   * @returns `{ id }` echoing the deleted qualification ID.
   * @throws NotFoundException When the qualification does not exist on the
   *   given worker.
   */
  @Delete("workers/:workerProfileId/qualifications/:qualId")
  @RequirePermissions("compliance.manage")
  @ApiOperation({ summary: "Delete a worker's qualification." })
  @ApiResponse({ status: 200, description: "Deleted qualification ID." })
  @ApiResponse({ status: 404, description: "Qualification not found." })
  deleteQualification(
    @Param("workerProfileId") workerProfileId: string,
    @Param("qualId") qualId: string
  ) {
    return this.service.deleteQualification(workerProfileId, qualId);
  }

  // ─── Competency gate (read-only) ────────────────────────────────────────
  // Roadmap §7. Does NOT block any allocation today — wiring to follow.
  /**
   * Check whether a worker meets a required qualification set.
   *
   * Read-only — does NOT block allocations today; the verdict is informational
   * and the wiring into AllocationsService is a deliberate future PR
   * (roadmap §7). Required codes are de-duplicated before evaluation so
   * callers can pass raw query strings without skewing the result arrays.
   *
   * @param workerId The worker profile to evaluate.
   * @param q.requiredQuals Comma-separated `qualType` codes, e.g.
   *   `"asbestos_b,working_at_heights"`. At least one code is required.
   * @returns A {@link CompetencyGateResult} — `allowed` flag plus `missing`,
   *   `expired`, and `expiringSoon` arrays (`expiringSoon` is a warning only
   *   and does not affect `allowed`).
   * @throws BadRequestException When `requiredQuals` is empty after trimming.
   * @throws NotFoundException When the worker profile does not exist.
   */
  @Get("workers/:workerId/competency-check")
  @RequirePermissions("compliance.view")
  @ApiOperation({
    summary:
      "Check whether a worker meets a required qualification set. Read-only — does NOT block allocations."
  })
  @ApiQuery({
    name: "requiredQuals",
    required: true,
    description: "Comma-separated qualType codes, e.g. 'asbestos_b,working_at_heights'."
  })
  @ApiResponse({ status: 200, description: "CompetencyGateResult — allowed flag plus missing/expired/expiringSoon arrays." })
  competencyCheck(
    @Param("workerId") workerId: string,
    @Query() q: CompetencyCheckQuery
  ) {
    const requiredQualTypes = (q.requiredQuals ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (requiredQualTypes.length === 0) {
      throw new BadRequestException("requiredQuals must contain at least one qualType code.");
    }
    return this.service.checkWorkerCompetency(workerId, requiredQualTypes);
  }

  // ─── Alerts + manual block ──────────────────────────────────────────────
  /**
   * Manually trigger the daily expiry-alert pass right now.
   *
   * Same logic as the scheduled cron — runs the three-tier dedup against
   * `ComplianceAlert` rows so admins are not re-spammed for items they've
   * already been notified about. Useful after fixing recipient roles or
   * recovering from an email-outage backlog.
   *
   * @returns `{ sent }` — count of new alerts dispatched this run (existing
   *   alerts are deduped and not re-counted).
   */
  @Post("alerts/send-now")
  @RequirePermissions("compliance.admin")
  @ApiOperation({ summary: "Manually trigger the daily expiry-alert pass right now." })
  async sendNow() {
    const sent = await this.service.checkAndSendExpiryAlerts();
    return { sent };
  }

  /**
   * Manually toggle a subcontractor's compliance block.
   *
   * When blocking, `reason` is mandatory and gets stamped onto
   * `complianceBlockReason`; `complianceBlockedAt` is set to now. When
   * unblocking, both columns are cleared. Note: the daily cron's
   * auto-unblock only lifts blocks it set itself (reason starting with
   * `"Critical"`) — manual blocks survive until manually lifted.
   *
   * @param id The subcontractor ID.
   * @param dto.blocked Target block state.
   * @param dto.reason Required when blocking; ignored when unblocking.
   * @returns The updated `SubcontractorSupplier` row.
   * @throws BadRequestException When `blocked = true` without a `reason`.
   * @throws NotFoundException When the subcontractor does not exist.
   */
  @Patch("subcontractors/:id/block")
  @RequirePermissions("compliance.admin")
  @ApiOperation({ summary: "Manually toggle a subcontractor's compliance block." })
  block(@Param("id") id: string, @Body() dto: BlockDto) {
    if (dto.blocked && !dto.reason) {
      throw new BadRequestException("reason is required when blocking.");
    }
    return this.service.manualBlock(id, dto.blocked, dto.reason ?? null);
  }
}
