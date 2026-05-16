import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import type { AuthenticatedUser } from "../../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { ProposalsService } from "./proposals.service";

class AcceptProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;

  @IsOptional()
  @IsString()
  discipline?: "DEM" | "CIV" | "ASB" | "Other";

  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() notes?: string;
}

class RejectProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;
}

@ApiTags("Scope Proposals")
@ApiBearerAuth()
@Controller("personas/tendering/proposals")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("ai.persona.tendering")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Post(":messageId/accept")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Accept a single AI scope proposal — writes to scope_of_works_items, updates proposal status. Optional edits override fields before commit."
  })
  @ApiResponse({ status: 200, description: "{ ok: true, scopeItemId }." })
  async accept(
    @Param("messageId") messageId: string,
    @Body() dto: AcceptProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const { proposalIndex, ...edits } = dto;
    const result = await this.proposals.acceptProposal(actor.sub, messageId, proposalIndex, edits);
    return { ok: true, scopeItemId: result.scopeItemId };
  }

  @Post(":messageId/reject")
  @HttpCode(200)
  @ApiOperation({
    summary: "Reject a single AI scope proposal — updates status only, no DB write to scope_of_works_items."
  })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async reject(
    @Param("messageId") messageId: string,
    @Body() dto: RejectProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    await this.proposals.rejectProposal(actor.sub, messageId, dto.proposalIndex);
    return { ok: true };
  }

  @Post(":messageId/accept-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Accept all pending proposals in this message — iterates and reports counts."
  })
  @ApiResponse({ status: 200, description: "{ ok: true, accepted, failed }." })
  async acceptAll(
    @Param("messageId") messageId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const result = await this.proposals.acceptAllPending(actor.sub, messageId);
    return { ok: true, ...result };
  }

  @Post(":messageId/reject-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Reject all pending proposals in this message — single update, no scope items written."
  })
  @ApiResponse({ status: 200, description: "{ ok: true, rejected }." })
  async rejectAll(
    @Param("messageId") messageId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const result = await this.proposals.rejectAllPending(actor.sub, messageId);
    return { ok: true, ...result };
  }
}
