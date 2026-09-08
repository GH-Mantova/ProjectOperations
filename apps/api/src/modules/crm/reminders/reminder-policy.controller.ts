import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  Min
} from "class-validator";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { ReminderPolicyService } from "./reminder-policy.service";

/**
 * PERMISSION CHOICE (recorded per TR-1 §5).
 *
 * `apps/api/src/common/permissions/permission-registry.ts` was grepped for a
 * CRM-admin key. There is NO `crm.admin` in the registry. The registry's CRM
 * module owns exactly two codes:
 *
 *   crm.view    — View CRM leads, opportunities and forecast
 *   crm.manage  — Manage CRM leads and opportunities
 *
 * `crm.manage` is therefore the most specific existing key for a CRM-side
 * admin write, and it is what every other CRM write route already requires
 * (crm.controller.ts, relationships.controller.ts). Both routes below use it —
 * the GET included, because the endpoint lazily CREATES the policy row on
 * first read, which is a write in everything but name.
 *
 * The `tenders.manage` fallback named in the prompt is deliberately NOT used:
 * it exists, but it is a Tendering-module key and TR_SCOPE_CRM moved this
 * cluster to the CRM surface. No new permission was invented.
 *
 * OPEN FOR REVIEW: the binding plan (§4 TR-1) says "super-user gated". There
 * is a `SuperUserGuard` in `common/auth/`, but the prompt specifies
 * JwtAuthGuard + PermissionsGuard only, so that is what is implemented. If
 * Marco wants the stricter gate, adding `SuperUserGuard` here is a one-line
 * change that touches no data path.
 */

// ── DTOs ─────────────────────────────────────────────────────────────────────

/**
 * Every field is optional: a PUT patches only what it carries, so a caller
 * that knows about four settings cannot blank the two it has never heard of.
 * The service re-validates all of this — these decorators reject obvious
 * garbage at the edge, they are not the authority.
 */
export class UpdateReminderPolicyDto {
  @IsOptional() @IsInt() @Min(1) daysBefore?: number;
  @IsOptional() @IsBoolean() dueDayOf?: boolean;
  @IsOptional() @IsInt() @Min(1) postSubmissionChaseDays?: number;
  @IsOptional() @IsInt() @Min(1) postSubmissionCadenceDays?: number;
  @IsOptional() @IsInt() @Min(1) escalationWindowDays?: number;
  @IsOptional() @IsObject() watchIdleThresholds?: Record<string, unknown>;
  @IsOptional() @IsObject() rottingIdleThresholds?: Record<string, unknown>;
}

// ── Controller ───────────────────────────────────────────────────────────────

/**
 * TR-1: admin CRUD for the singleton CRM reminder policy.
 *
 * There is intentionally no POST/DELETE — the row is a singleton created by
 * the seed (or lazily on first GET), never by an API caller.
 */
@ApiTags("CRM Reminder Policy")
@ApiBearerAuth()
@Controller("crm/admin/reminder-policy")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReminderPolicyController {
  constructor(private readonly service: ReminderPolicyService) {}

  @Get()
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary:
      "Get the CRM reminder policy. Creates the default row on first read if none exists."
  })
  @ApiResponse({ status: 200, description: "The current reminder policy." })
  getPolicy() {
    return this.service.getPolicy();
  }

  @Put()
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary: "Update the CRM reminder policy. Partial — omitted fields keep their stored value."
  })
  @ApiResponse({ status: 200, description: "The updated reminder policy." })
  @ApiResponse({ status: 400, description: "Validation error." })
  updatePolicy(@Body() dto: UpdateReminderPolicyDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updatePolicy(dto, actor.sub);
  }
}
