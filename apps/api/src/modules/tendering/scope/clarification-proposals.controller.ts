import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import type { AuthenticatedUser } from "../../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { ClarificationProposalsService } from "./clarification-proposals.service";

// Edits are kind-aware on the frontend. The DTO accepts the superset
// of all per-kind fields as optional; the service's mergeByKind helper
// applies only the fields valid for the stored proposal's kind. Light
// validation here — the AI tool schema + frontend edit form are the
// primary gates.
class AcceptClarificationProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;

  // new_rfi fields
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() dueDate?: string;
  // new_note fields
  @IsOptional() @IsString() noteType?: "call" | "email" | "meeting" | "note" | "response";
  @IsOptional() @IsString() direction?: "sent" | "received";
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() occurredAt?: string;
  // rfi_response fields
  @IsOptional() @IsString() rfiId?: string;
  @IsOptional() @IsString() response?: string;
}

class RejectClarificationProposalDto {
  @IsInt()
  @Min(0)
  proposalIndex!: number;
}

/**
 * Accept/reject endpoints for AI-generated clarifications proposals
 * (new_rfi / new_note / rfi_response kinds) stored on tool_result
 * conversation messages.
 *
 * All routes are JWT-guarded and require the `ai.persona.tendering`
 * permission (class-level). Accept writes the matching clarification
 * record; reject only flips status in message metadata.
 */
@ApiTags("Clarification Proposals")
@ApiBearerAuth()
@Controller("personas/tendering/clarification-proposals")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("ai.persona.tendering")
export class ClarificationProposalsController {
  constructor(private readonly proposals: ClarificationProposalsService) {}

  /**
   * Accept a single AI clarifications proposal — writes a TenderClarification (new_rfi), TenderClarificationNote (new_note), or updates an existing RFI with a response + flips to CLOSED (rfi_response). Optional edits override fields before commit.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param dto - proposalIndex plus kind-aware optional edits (only the stored kind's fields apply)
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, acceptedRecord }` — the id + kind of the row created/updated
   * @throws NotFoundException when the message, proposal index, or target RFI is not found
   * @throws BadRequestException when the proposal is already decided, the conversation has no tender context, or the target RFI is invalid
   */
  @Post(":messageId/accept")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Accept a single AI clarifications proposal — writes a TenderClarification (new_rfi), TenderClarificationNote (new_note), or updates an existing RFI with a response + flips to CLOSED (rfi_response). Optional edits override fields before commit."
  })
  @ApiResponse({ status: 200, description: "{ ok, acceptedRecord }." })
  async accept(
    @Param("messageId") messageId: string,
    @Body() dto: AcceptClarificationProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const { proposalIndex, ...edits } = dto;
    const acceptedRecord = await this.proposals.acceptClarificationProposal(
      actor.sub,
      messageId,
      proposalIndex,
      edits
    );
    return { ok: true, acceptedRecord };
  }

  /**
   * Reject a single AI clarifications proposal — updates status only, no DB write to clarifications.
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
    summary: "Reject a single AI clarifications proposal — updates status only, no DB write to clarifications."
  })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async reject(
    @Param("messageId") messageId: string,
    @Body() dto: RejectClarificationProposalDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    await this.proposals.rejectClarificationProposal(actor.sub, messageId, dto.proposalIndex);
    return { ok: true };
  }

  /**
   * Accept all pending clarifications proposals in this message — iterates and reports counts.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, accepted, failed }` — per-proposal failures are counted, not thrown
   * @throws NotFoundException when the message is not found or not owned by the actor
   */
  @Post(":messageId/accept-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Accept all pending clarifications proposals in this message — iterates and reports counts."
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
   * Reject all pending clarifications proposals in this message — single update, no clarifications writes.
   *
   * @param messageId - tool_result conversation message holding the proposals
   * @param actor - JWT principal; must own the conversation
   * @returns `{ ok: true, rejected }`
   * @throws NotFoundException when the message is not found or not owned by the actor
   */
  @Post(":messageId/reject-all")
  @HttpCode(200)
  @ApiOperation({
    summary: "Reject all pending clarifications proposals in this message — single update, no clarifications writes."
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
