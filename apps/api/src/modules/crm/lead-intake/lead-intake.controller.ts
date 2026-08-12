import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { LeadIntakeService } from "./lead-intake.service";

const CAPTURE_CHANNELS = [
  "email",
  "phone",
  "portal",
  "referral",
  "cold_outreach",
  "other"
] as const;

const OPPORTUNITY_SOURCES = [
  "referral",
  "direct",
  "tender_portal",
  "cold",
  "repeat_client",
  "other"
] as const;

// ── DTOs ─────────────────────────────────────────────────────────────────────

class CaptureLeadDto {
  @IsString() title!: string;
  @IsOptional()
  @IsIn(CAPTURE_CHANNELS as unknown as string[])
  captureChannel?: string;
  @IsOptional() @IsString() captureDetail?: string | null;
  @IsOptional()
  @IsIn(OPPORTUNITY_SOURCES as unknown as string[])
  source?: string;
  @IsString() clientId!: string;
  @IsOptional() @IsString() contactId?: string | null;
  @IsOptional() @IsString() ownerId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() nextActionAt?: string | null;
  @IsOptional() @IsString() nextActionNote?: string | null;
}

class TriageLeadDto {
  @IsIn(["tender", "dont_pursue"]) action!: "tender" | "dont_pursue";
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() tenderTitle?: string;
  @IsOptional() @IsString() dropReasonId?: string;
  @IsOptional() @IsString() dropReasonDetail?: string | null;
}

class ListOpenLeadsQueryDto {
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional()
  @IsIn(CAPTURE_CHANNELS as unknown as string[])
  captureChannel?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * CRM-3: Lead front door — multi-source capture + triage.
 *
 * Mounted at /crm/intake (separate from /crm/leads) to make the CRM-3
 * capture surface discoverable independently of the existing lead CRUD
 * routes on CrmController. The underlying Opportunity rows are the same —
 * these routes are additive aliases that add captureChannel, captureDetail,
 * and account-auto-creation semantics.
 *
 * Permissions: crm.view (reads) / crm.manage (mutations).
 */
@ApiTags("CRM — Lead Intake")
@ApiBearerAuth()
@Controller("crm/intake")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadIntakeController {
  constructor(private readonly service: LeadIntakeService) {}

  @Get("open")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List open leads (stage=open/new/qualified/quoting, isLead=true) with intake enrichment." })
  @ApiQuery({ name: "ownerId", required: false })
  @ApiQuery({ name: "accountId", required: false })
  @ApiQuery({ name: "captureChannel", required: false, enum: CAPTURE_CHANNELS })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Paginated open leads with account + dropReason." })
  listOpenLeads(@Query() query: ListOpenLeadsQueryDto) {
    return this.service.listOpenLeads(query as never);
  }

  @Post()
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary:
      "Capture a new lead from any channel (email/phone/portal/referral). " +
      "Auto-creates a PROSPECT Account if the client has none."
  })
  @ApiResponse({ status: 201, description: "Lead captured and linked to Account." })
  @ApiResponse({ status: 400, description: "Missing title or clientId." })
  @ApiResponse({ status: 404, description: "clientId or contactId not found." })
  captureLead(
    @Body() dto: CaptureLeadDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.captureLead(dto as never, actor.sub);
  }

  @Post(":id/triage")
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary:
      'Triage an open lead: action="tender" → Draft Tender; action="dont_pursue" → structured close.'
  })
  @ApiParam({ name: "id", description: "Lead (Opportunity) id" })
  @ApiResponse({ status: 201, description: 'Lead triaged. "tender" returns the updated opportunity (convertedTenderId set); "dont_pursue" returns not_pursued opportunity.' })
  @ApiResponse({ status: 400, description: "Missing required field for the chosen action." })
  @ApiResponse({ status: 404, description: "Lead, dropReason, or site not found." })
  @ApiResponse({ status: 409, description: "Lead is already in a terminal stage." })
  triageLead(
    @Param("id") id: string,
    @Body() dto: TriageLeadDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.triageLead(id, dto as never, actor.sub);
  }
}
