import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { AuthenticatedUser } from "../../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { QuoteProposalsService } from "./quote-proposals.service";

// DTOs mirror the propose-quote-content tool schema. Validation is
// light — the AI tool schema is the primary gate; this controller is
// the operator's edit path where a value might be tweaked before
// accepting.
class QuoteCostLineDto {
  @IsString() label!: string;
  @IsString() description!: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
}

class QuoteExclusionDto {
  @IsString() text!: string;
}

class QuoteAssumptionDto {
  @IsString() text!: string;
}

class AcceptQuoteProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteCostLineDto)
  costLines?: QuoteCostLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteExclusionDto)
  exclusions?: QuoteExclusionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteAssumptionDto)
  assumptions?: QuoteAssumptionDto[];
}

class RejectQuoteProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;
}

/**
 * Accept/reject endpoints for AI-generated quote-content proposals
 * (cost lines / exclusions / assumptions) stored on tool_result
 * conversation messages.
 *
 * All routes are JWT-guarded and require the `ai.persona.tendering`
 * permission (class-level). Accepting writes rows into the target
 * DRAFT ClientQuote; rejecting only flips status in message metadata.
 */
@ApiTags("Quote Proposals")
@ApiBearerAuth()
@Controller("personas/tendering/quote-proposals")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("ai.persona.tendering")
export class QuoteProposalsController {
  constructor(private readonly proposals: QuoteProposalsService) {}

  /**
   * Accept a single AI quote-content proposal — writes one row per cost line / exclusion / assumption into the target ClientQuote. Optional edits override fields before commit.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param dto - proposalIndex plus optional costLines/exclusions/assumptions edits
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok, acceptedCostLineIds, acceptedExclusionIds, acceptedAssumptionIds }`
   * @throws NotFoundException when the message, proposal index, or target ClientQuote is not found
   * @throws BadRequestException when the proposal is already decided, the conversation has no tender context, the quote belongs to another tender, or the quote is not DRAFT
   */
  @Post(":messageId/accept")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Accept a single AI quote-content proposal — writes one row per cost line / exclusion / assumption into the target ClientQuote. Optional edits override fields before commit."
  })
  @ApiResponse({
    status: 200,
    description: "{ ok, acceptedCostLineIds, acceptedExclusionIds, acceptedAssumptionIds }."
  })
  async accept(
    @Param("messageId") messageId: string,
    @Body() dto: AcceptQuoteProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const { proposalIndex, ...edits } = dto;
    const result = await this.proposals.acceptQuoteProposal(
      actor.sub,
      messageId,
      proposalIndex,
      edits
    );
    return { ok: true, ...result };
  }

  /**
   * Reject a single AI quote-content proposal — updates status only, no DB write to the quote.
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
    summary: "Reject a single AI quote-content proposal — updates status only, no DB write to the quote."
  })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async reject(
    @Param("messageId") messageId: string,
    @Body() dto: RejectQuoteProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    await this.proposals.rejectQuoteProposal(actor.sub, messageId, dto.proposalIndex);
    return { ok: true };
  }

  /**
   * Accept all pending quote-content proposals in this message — iterates and reports counts.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, accepted, failed }` — per-proposal failures are counted, not thrown
   * @throws NotFoundException when the message is not found or not owned by the actor
   */
  @Post(":messageId/accept-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Accept all pending quote-content proposals in this message — iterates and reports counts."
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
   * Reject all pending quote-content proposals in this message — single update, no quote writes.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, rejected }`
   * @throws NotFoundException when the message is not found or not owned by the actor
   */
  @Post(":messageId/reject-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Reject all pending quote-content proposals in this message — single update, no quote writes."
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
