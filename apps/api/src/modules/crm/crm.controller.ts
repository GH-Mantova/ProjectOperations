import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CrmService } from "./crm.service";

const LEAD_STATUSES = ["new", "contacted", "qualified", "disqualified", "converted"] as const;
const OPPORTUNITY_STAGES = ["new", "qualified", "quoting", "won", "lost"] as const;
const OPPORTUNITY_SOURCES = [
  "referral",
  "direct",
  "tender_portal",
  "cold",
  "repeat_client",
  "other"
] as const;

class ListLeadsQueryDto {
  @IsOptional() @IsIn(LEAD_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

class CreateLeadDto {
  @IsString() title!: string;
  @IsOptional() @IsIn(OPPORTUNITY_SOURCES as unknown as string[]) source?: string;
  @IsOptional() @IsString() companyName?: string | null;
  @IsOptional() @IsString() contactName?: string | null;
  @IsOptional() @IsString() contactEmail?: string | null;
  @IsOptional() @IsString() contactPhone?: string | null;
  @IsOptional() @IsString() clientId?: string | null;
  @IsOptional() @IsString() contactId?: string | null;
  @IsOptional() @IsString() ownerId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() nextActionAt?: string | null;
  @IsOptional() @IsString() nextActionNote?: string | null;
}

class UpdateLeadDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsIn(LEAD_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(OPPORTUNITY_SOURCES as unknown as string[]) source?: string;
  @IsOptional() @IsString() companyName?: string | null;
  @IsOptional() @IsString() contactName?: string | null;
  @IsOptional() @IsString() contactEmail?: string | null;
  @IsOptional() @IsString() contactPhone?: string | null;
  @IsOptional() @IsString() clientId?: string | null;
  @IsOptional() @IsString() contactId?: string | null;
  @IsOptional() @IsString() ownerId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() nextActionAt?: string | null;
  @IsOptional() @IsString() nextActionNote?: string | null;
}

class ConvertLeadDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsNumberString() estimatedValue?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
}

class ListOpportunitiesQueryDto {
  @IsOptional() @IsIn(OPPORTUNITY_STAGES as unknown as string[]) stage?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

class CreateOpportunityDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(OPPORTUNITY_STAGES as unknown as string[]) stage?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsNumberString() estimatedValue?: string;
  @IsOptional() @IsIn(OPPORTUNITY_SOURCES as unknown as string[]) source?: string;
  @IsString() clientId!: string;
  @IsOptional() @IsString() contactId?: string | null;
  @IsOptional() @IsString() ownerId?: string | null;
  @IsOptional() @IsString() expectedCloseDate?: string | null;
  @IsOptional() @IsString() nextActionAt?: string | null;
  @IsOptional() @IsString() nextActionNote?: string | null;
}

class UpdateOpportunityDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(OPPORTUNITY_STAGES as unknown as string[]) stage?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsNumberString() estimatedValue?: string;
  @IsOptional() @IsIn(OPPORTUNITY_SOURCES as unknown as string[]) source?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() contactId?: string | null;
  @IsOptional() @IsString() ownerId?: string | null;
  @IsOptional() @IsString() expectedCloseDate?: string | null;
  @IsOptional() @IsString() nextActionAt?: string | null;
  @IsOptional() @IsString() nextActionNote?: string | null;
  @IsOptional() @IsString() lostReason?: string | null;
}

class ConvertOpportunityDto {
  @IsString() siteId!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() dueDate?: string | null;
  @IsOptional() @IsString() proposedStartDate?: string | null;
}

class GenerateDraftTenderDto {
  @IsString() siteId!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() clientId?: string;
}

class ForecastQueryDto {
  @IsOptional() @IsString() ownerId?: string;
}

/**
 * REST surface for CRM Leads + Opportunities (slice 1 — feat-crm-lead-opportunity).
 *
 * All read routes require `crm.view`; mutating routes (create, update,
 * convert) require `crm.manage`. Convert-to-tender is the marquee action:
 * an opportunity in any non-terminal stage may fire it, and the returned
 * opportunity is left in `won` with `convertedTenderId` populated.
 */
@ApiTags("CRM")
@ApiBearerAuth()
@Controller("crm")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  // ── Leads ────────────────────────────────────────────────────────────────

  @Get("leads")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List leads with filters (status, owner, search)." })
  @ApiQuery({ name: "status", required: false, enum: LEAD_STATUSES })
  @ApiQuery({ name: "ownerId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of leads." })
  listLeads(@Query() query: ListLeadsQueryDto) {
    return this.service.listLeads(query as never);
  }

  @Get("leads/:id")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Get a lead by id." })
  @ApiParam({ name: "id", description: "Lead id" })
  @ApiResponse({ status: 200, description: "Lead found." })
  @ApiResponse({ status: 404, description: "Lead not found." })
  getLead(@Param("id") id: string) {
    return this.service.getLead(id);
  }

  @Post("leads")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Create a new lead." })
  @ApiResponse({ status: 201, description: "Lead created." })
  createLead(@Body() dto: CreateLeadDto) {
    return this.service.createLead(dto as never);
  }

  @Patch("leads/:id")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Update a lead." })
  @ApiParam({ name: "id", description: "Lead id" })
  @ApiResponse({ status: 200, description: "Updated lead." })
  @ApiResponse({ status: 404, description: "Lead not found." })
  updateLead(@Param("id") id: string, @Body() dto: UpdateLeadDto) {
    return this.service.updateLead(id, dto as never);
  }

  @Post("leads/:id/convert")
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary: "Qualify a lead → create an Opportunity linked back to the lead."
  })
  @ApiParam({ name: "id", description: "Lead id" })
  @ApiResponse({ status: 201, description: "Opportunity created; lead marked converted." })
  @ApiResponse({ status: 400, description: "clientId missing — link the lead first." })
  @ApiResponse({ status: 409, description: "Lead already converted." })
  convertLead(@Param("id") id: string, @Body() dto: ConvertLeadDto) {
    return this.service.convertLeadToOpportunity(id, dto as never);
  }

  @Post("leads/:id/generate-draft-tender")
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary:
      "One-click: lead → opportunity → DRAFT Tender in a single call. siteId required."
  })
  @ApiParam({ name: "id", description: "Lead id" })
  @ApiResponse({
    status: 201,
    description: "Draft tender created; lead+opportunity linked to it."
  })
  @ApiResponse({ status: 400, description: "siteId missing, or lead has no client." })
  @ApiResponse({ status: 409, description: "Lead already has a draft tender." })
  generateDraftTender(
    @Param("id") id: string,
    @Body() dto: GenerateDraftTenderDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.generateDraftTender(id, dto as never, actor.sub);
  }

  // ── Opportunities ────────────────────────────────────────────────────────

  @Get("opportunities")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List opportunities with filters (stage, owner, client, search)." })
  @ApiQuery({ name: "stage", required: false, enum: OPPORTUNITY_STAGES })
  @ApiQuery({ name: "ownerId", required: false })
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of opportunities." })
  listOpportunities(@Query() query: ListOpportunitiesQueryDto) {
    return this.service.listOpportunities(query as never);
  }

  @Get("opportunities/:id")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Get an opportunity by id (with linked lead + tender if any)." })
  @ApiParam({ name: "id", description: "Opportunity id" })
  @ApiResponse({ status: 200, description: "Opportunity found." })
  @ApiResponse({ status: 404, description: "Opportunity not found." })
  getOpportunity(@Param("id") id: string) {
    return this.service.getOpportunity(id);
  }

  @Post("opportunities")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Create a new opportunity." })
  @ApiResponse({ status: 201, description: "Opportunity created." })
  createOpportunity(@Body() dto: CreateOpportunityDto) {
    return this.service.createOpportunity(dto as never);
  }

  @Patch("opportunities/:id")
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary:
      "Update an opportunity (stage, probability, value, next-action, etc). Terminal-stage moves are blocked (409)."
  })
  @ApiParam({ name: "id", description: "Opportunity id" })
  @ApiResponse({ status: 200, description: "Updated opportunity." })
  @ApiResponse({ status: 404, description: "Opportunity not found." })
  @ApiResponse({ status: 409, description: "Opportunity is in a terminal stage." })
  updateOpportunity(@Param("id") id: string, @Body() dto: UpdateOpportunityDto) {
    return this.service.updateOpportunity(id, dto as never);
  }

  @Post("opportunities/:id/convert-to-tender")
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary:
      "Convert an opportunity into a Tender (siteId required). Marks the opportunity won and links convertedTenderId."
  })
  @ApiParam({ name: "id", description: "Opportunity id" })
  @ApiResponse({ status: 201, description: "Tender created; opportunity linked and marked won." })
  @ApiResponse({ status: 400, description: "siteId missing." })
  @ApiResponse({ status: 409, description: "Opportunity already converted or lost." })
  convertOpportunity(
    @Param("id") id: string,
    @Body() dto: ConvertOpportunityDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.convertOpportunityToTender(id, dto as never, actor.sub);
  }

  // ── Forecast ─────────────────────────────────────────────────────────────

  @Get("forecast")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary:
      "Weighted forecast — open pipeline (new/qualified/quoting) bucketed by stage with gross + weighted value."
  })
  @ApiQuery({ name: "ownerId", required: false })
  @ApiResponse({ status: 200, description: "Forecast buckets + totals." })
  forecast(@Query() query: ForecastQueryDto) {
    return this.service.forecast(query as never);
  }
}
