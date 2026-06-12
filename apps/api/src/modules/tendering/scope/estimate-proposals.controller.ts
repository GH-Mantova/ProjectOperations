import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { AuthenticatedUser } from "../../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { EstimateProposalsService } from "./estimate-proposals.service";

// DTOs mirror the optional cost-line shapes from
// propose-estimate-items.tool.ts. Validation is intentionally light —
// the AI tool schema is the primary gate; this controller is the
// user-edit path where the operator might tweak a value before accept.
class EstimateLabourLineDto {
  @IsString() role!: string;
  @IsNumber() @Min(0) qty!: number;
  @IsNumber() @Min(0) days!: number;
  @IsString() shift!: "Day" | "Night" | "Weekend";
  @IsNumber() @Min(0) rate!: number;
}

class EstimatePlantLineDto {
  @IsString() plantItem!: string;
  @IsNumber() @Min(0) qty!: number;
  @IsNumber() @Min(0) days!: number;
  @IsOptional() @IsString() comment?: string;
  @IsNumber() @Min(0) rate!: number;
}

class EstimateCuttingLineDto {
  @IsString() cuttingType!: string;
  @IsOptional() @IsString() equipment?: string;
  @IsOptional() @IsString() elevation?: string;
  @IsOptional() @IsString() material?: string;
  @IsOptional() @IsInt() @Min(1) depthMm?: number;
  @IsOptional() @IsInt() @Min(1) diameterMm?: number;
  @IsNumber() @Min(0) qty!: number;
  @IsString() unit!: string;
  @IsOptional() @IsString() comment?: string;
  @IsNumber() @Min(0) rate!: number;
}

class EstimateWasteLineDto {
  @IsOptional() @IsString() wasteGroup?: string;
  @IsString() wasteType!: string;
  @IsString() facility!: string;
  @IsNumber() @Min(0) qtyTonnes!: number;
  @IsNumber() @Min(0) tonRate!: number;
  @IsInt() @Min(0) loads!: number;
  @IsNumber() @Min(0) loadRate!: number;
}

class AcceptEstimateProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;

  @IsOptional()
  @IsString()
  code?: "DEM" | "CIV" | "ASB" | "Other";

  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) markup?: number;
  @IsOptional() @IsBoolean() isProvisional?: boolean;
  @IsOptional() @IsNumber() @Min(0) provisionalAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateLabourLineDto)
  labourLines?: EstimateLabourLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimatePlantLineDto)
  plantLines?: EstimatePlantLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateCuttingLineDto)
  cuttingLines?: EstimateCuttingLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateWasteLineDto)
  wasteLines?: EstimateWasteLineDto[];
}

class RejectEstimateProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;
}

/**
 * Accept/reject endpoints for AI-generated estimate-item proposals
 * stored on tool_result conversation messages.
 *
 * All routes are JWT-guarded and require the `ai.persona.tendering`
 * permission (class-level). Accepting writes an estimate_items row plus
 * its cost lines; rejecting only flips status in message metadata.
 */
@ApiTags("Estimate Proposals")
@ApiBearerAuth()
@Controller("personas/tendering/estimate-proposals")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("ai.persona.tendering")
export class EstimateProposalsController {
  constructor(private readonly proposals: EstimateProposalsService) {}

  /**
   * Accept a single AI estimate proposal — writes one estimate_items row plus its labour/plant/cutting/waste lines. Optional edits override fields before commit.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param dto - proposalIndex plus optional field/line-array edits applied before commit
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, estimateItemId }`
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided, the conversation has no tender context, or the estimate is locked
   */
  @Post(":messageId/accept")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Accept a single AI estimate proposal — writes one estimate_items row plus its labour/plant/cutting/waste lines. Optional edits override fields before commit."
  })
  @ApiResponse({ status: 200, description: "{ ok: true, estimateItemId }." })
  async accept(
    @Param("messageId") messageId: string,
    @Body() dto: AcceptEstimateProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const { proposalIndex, ...edits } = dto;
    const result = await this.proposals.acceptEstimateProposal(
      actor.sub,
      messageId,
      proposalIndex,
      edits
    );
    return { ok: true, estimateItemId: result.estimateItemId };
  }

  /**
   * Reject a single AI estimate proposal — updates status only, no DB write to estimate_items.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param dto - proposalIndex to reject
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true }`
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided
   */
  @Post(":messageId/reject")
  @HttpCode(200)
  @ApiOperation({
    summary: "Reject a single AI estimate proposal — updates status only, no DB write to estimate_items."
  })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async reject(
    @Param("messageId") messageId: string,
    @Body() dto: RejectEstimateProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    await this.proposals.rejectEstimateProposal(actor.sub, messageId, dto.proposalIndex);
    return { ok: true };
  }

  /**
   * Accept all pending estimate proposals in this message — iterates and reports counts.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, accepted, failed }` — per-proposal failures are counted, not thrown
   * @throws NotFoundException when the message is not found or not owned by the actor
   */
  @Post(":messageId/accept-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Accept all pending estimate proposals in this message — iterates and reports counts."
  })
  @ApiResponse({ status: 200, description: "{ ok: true, accepted, failed }." })
  async acceptAll(
    @Param("messageId") messageId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const result = await this.proposals.acceptAllPending(actor.sub, messageId);
    return { ok: true, ...result };
  }

  /**
   * Reject all pending estimate proposals in this message — single update, no estimate items written.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, rejected }`
   * @throws NotFoundException when the message is not found or not owned by the actor
   */
  @Post(":messageId/reject-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Reject all pending estimate proposals in this message — single update, no estimate items written."
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
