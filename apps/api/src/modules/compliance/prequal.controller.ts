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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PrequalService } from "./prequal.service";

class CreatePrequalDto {
  @IsString() subcontractorId!: string;
  @IsOptional() @IsString() notes?: string | null;
}

class UpdateDraftDto {
  @IsOptional() @IsString() notes?: string | null;
}

class VerifyPrequalDto {
  @IsIn(["low", "medium", "high"]) riskRating!: "low" | "medium" | "high";
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() expiresAt?: string | null;
}

class RejectPrequalDto {
  @IsString() @MinLength(1) reason!: string;
}

class ListPrequalQuery {
  @IsOptional() @IsString() subcontractorId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() riskRating?: string;
}

/**
 * HTTP surface for the structured subcontractor prequalification workflow —
 * §13 Forms & Compliance extension. Namespaced under `/compliance/prequal`
 * to sit alongside the existing compliance dashboards and share the same
 * permission vocabulary.
 *
 * `compliance.view` reads the ledger + dashboard; `compliance.manage`
 * creates + edits drafts; `compliance.admin` performs the verify / reject
 * transitions (both write to `SubcontractorSupplier.prequalStatus` and are
 * therefore held to the same gate that guards manual block/unblock).
 */
@ApiTags("Compliance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("compliance/prequal")
export class PrequalController {
  constructor(private readonly service: PrequalService) {}

  /**
   * Cross-subcontractor rollup — status counts, risk mix across current
   * approvals, prequals expiring within 30 days, and active subs that
   * have never had a request. Powers the compliance dashboard tile.
   */
  @Get("dashboard")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Cross-subcontractor prequal rollup for the compliance dashboard." })
  @ApiResponse({ status: 200, description: "Counts + expiring soon + missing subs." })
  dashboard() {
    return this.service.dashboard();
  }

  /**
   * List prequalification requests, optionally filtered by subcontractor,
   * status, or risk rating. Ordered newest first.
   */
  @Get()
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "List prequalification requests (optionally filtered)." })
  @ApiQuery({ name: "subcontractorId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "riskRating", required: false })
  @ApiResponse({ status: 200, description: "PrequalificationRequest rows with subcontractor + verifier." })
  list(@Query() q: ListPrequalQuery) {
    return this.service.list({
      subcontractorId: q.subcontractorId,
      status: q.status,
      riskRating: q.riskRating
    });
  }

  @Get(":id")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Read a single prequalification request with its verification snapshot." })
  @ApiResponse({ status: 200, description: "PrequalificationRequest with subcontractor detail." })
  @ApiResponse({ status: 404, description: "Not found." })
  get(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions("compliance.manage")
  @ApiOperation({ summary: "Open a new prequalification request in draft." })
  @ApiResponse({ status: 201, description: "Draft PrequalificationRequest." })
  @ApiResponse({ status: 400, description: "Sub already has an open request." })
  create(@Body() dto: CreatePrequalDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("compliance.manage")
  @ApiOperation({ summary: "Update a draft request's notes." })
  @ApiResponse({ status: 200, description: "Updated request." })
  update(@Param("id") id: string, @Body() dto: UpdateDraftDto) {
    return this.service.updateDraft(id, dto);
  }

  @Post(":id/submit")
  @RequirePermissions("compliance.manage")
  @ApiOperation({ summary: "Move a draft request to submitted." })
  @ApiResponse({ status: 201, description: "Submitted request." })
  submit(@Param("id") id: string) {
    return this.service.submit(id);
  }

  @Patch(":id/verify")
  @RequirePermissions("compliance.admin")
  @ApiOperation({
    summary:
      "Approve a prequalification with a risk rating. Captures a snapshot of the sub's insurances/licences/documents and updates the sub's summary status to approved."
  })
  @ApiResponse({ status: 200, description: "Approved request." })
  verify(
    @Param("id") id: string,
    @Body() dto: VerifyPrequalDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.verify(id, actor.sub, dto);
  }

  @Patch(":id/reject")
  @RequirePermissions("compliance.admin")
  @ApiOperation({ summary: "Reject a prequalification with a reason." })
  @ApiResponse({ status: 200, description: "Rejected request." })
  reject(
    @Param("id") id: string,
    @Body() dto: RejectPrequalDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.reject(id, actor.sub, dto.reason);
  }
}
