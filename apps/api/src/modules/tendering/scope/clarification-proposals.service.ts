import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { ConversationMessage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ClarificationProposalInput,
  NewNoteProposal,
  NewRfiProposal,
  ProposeClarificationsArgs,
  RfiResponseProposal
} from "../../ai-providers/tools/propose-clarifications.tool";

// §5A.1 PR F — clarifications-content proposal store. Mirrors
// QuoteProposalsService (PR E) exactly. Each tool_call from the model
// becomes a tool_call + tool_result conversation-row pair; the
// tool_result.metadata.toolName="propose_clarifications" discriminator
// keeps these rows isolated from scope / estimate / quote proposals.
const TOOL_NAME = "propose_clarifications";

export type ClarificationProposalStatus = "pending" | "accepted" | "rejected";

// `acceptedRecord` captures the id + kind of the row created (or
// updated, for rfi_response) on accept. Used by the frontend to surface
// a "view in clarifications" deep link.
export type AcceptedClarificationRecord =
  | { kind: "new_rfi"; rfiId: string }
  | { kind: "new_note"; noteId: string }
  | { kind: "rfi_response"; rfiId: string };

export type StoredClarificationProposal = {
  index: number;
  proposal: ClarificationProposalInput;
  status: ClarificationProposalStatus;
  acceptedRecord?: AcceptedClarificationRecord;
  decidedAt?: string;
};

export type ClarificationProposalsMetadata = {
  toolUseId: string;
  toolName: typeof TOOL_NAME;
  proposals: StoredClarificationProposal[];
};

// Edits are kind-aware: the user can tweak only the fields that
// belong to the proposal's kind. The frontend constrains this; the
// service merges shallowly within the proposal-of-correct-kind shape.
export type ClarificationProposalEdits =
  | Partial<NewRfiProposal>
  | Partial<NewNoteProposal>
  | Partial<RfiResponseProposal>;

/**
 * Stores and decides AI-generated clarifications proposals (§5A.1 PR F),
 * mirroring QuoteProposalsService.
 *
 * Proposals live in tool_result message metadata under the
 * "propose_clarifications" toolName discriminator, keeping them isolated
 * from scope/estimate/quote proposal rows. Accepting writes a
 * TenderClarification (new_rfi), a TenderClarificationNote (new_note),
 * or closes an existing RFI with a response (rfi_response). Ownership
 * is enforced via the conversation's userId.
 */
@Injectable()
export class ClarificationProposalsService {
  private readonly logger = new Logger(ClarificationProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a propose_clarifications tool call as a tool_call +
   * tool_result conversation-message pair in one transaction, with all
   * proposals starting at "pending". Also bumps the conversation's
   * updatedAt.
   *
   * @param toolUseId - provider tool_use id stored for provenance
   * @param args - the tool arguments containing the kind-discriminated proposals
   * @returns the tool_result message and the stored proposal array
   */
  async storeClarificationProposals(
    conversationId: string,
    toolUseId: string,
    args: ProposeClarificationsArgs
  ): Promise<{
    message: ConversationMessage;
    proposals: StoredClarificationProposal[];
  }> {
    const proposals: StoredClarificationProposal[] = args.proposals.map((p, index) => ({
      index,
      proposal: p,
      status: "pending" as const
    }));
    const metadata: ClarificationProposalsMetadata = {
      toolUseId,
      toolName: TOOL_NAME,
      proposals
    };
    const kindCount = countByKind(proposals);
    const summary = formatKindCount(kindCount);
    const [, message] = await this.prisma.$transaction([
      this.prisma.conversationMessage.create({
        data: {
          conversationId,
          role: "tool_call",
          content: `Proposed clarifications activity (${summary}).`,
          metadata: {
            toolUseId,
            name: TOOL_NAME,
            arguments: args as unknown as Prisma.InputJsonValue
          } as Prisma.InputJsonValue
        }
      }),
      this.prisma.conversationMessage.create({
        data: {
          conversationId,
          role: "tool_result",
          content: `Clarifications activity pending review (${summary}).`,
          metadata: metadata as unknown as Prisma.InputJsonValue
        }
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      })
    ]);
    return { message, proposals };
  }

  /**
   * Accepts one pending proposal according to its kind: creates an OPEN
   * TenderClarification (new_rfi), creates a TenderClarificationNote
   * (new_note), or writes a response onto an existing un-answered RFI of
   * the same tender and flips it to CLOSED (rfi_response). The proposal
   * is then marked "accepted" with the created/updated record's id.
   *
   * @param edits - kind-aware field overrides merged over the stored proposal before commit
   * @returns the AcceptedClarificationRecord (kind + row id)
   * @throws NotFoundException when the message, proposal index, or target RFI is not found
   * @throws BadRequestException when the proposal is already decided, the conversation has no tender context, the RFI belongs to another tender, or the RFI already has a response
   */
  async acceptClarificationProposal(
    userId: string,
    messageId: string,
    proposalIndex: number,
    edits: ClarificationProposalEdits = {}
  ): Promise<AcceptedClarificationRecord> {
    const { conversation, message, metadata } = await this.loadProposalMessage(userId, messageId);
    const stored = metadata.proposals[proposalIndex];
    if (!stored) {
      throw new NotFoundException(`Proposal index ${proposalIndex} not found.`);
    }
    if (stored.status !== "pending") {
      throw new BadRequestException(`Proposal already ${stored.status}.`);
    }
    const tenderId = conversation.contextKey;
    if (!tenderId) {
      throw new BadRequestException(
        "Proposal cannot be accepted — conversation has no tender context."
      );
    }

    const merged = mergeByKind(stored.proposal, edits);
    let acceptedRecord: AcceptedClarificationRecord;

    if (merged.kind === "new_rfi") {
      const row = await this.prisma.tenderClarification.create({
        data: {
          tenderId,
          subject: merged.subject,
          status: "OPEN",
          dueDate: merged.dueDate ? new Date(merged.dueDate) : null
        },
        select: { id: true }
      });
      acceptedRecord = { kind: "new_rfi", rfiId: row.id };
    } else if (merged.kind === "new_note") {
      const row = await this.prisma.tenderClarificationNote.create({
        data: {
          tenderId,
          noteType: merged.noteType,
          direction: merged.direction,
          text: merged.text,
          occurredAt: merged.occurredAt ? new Date(merged.occurredAt) : new Date(),
          createdById: userId
        },
        select: { id: true }
      });
      acceptedRecord = { kind: "new_note", noteId: row.id };
    } else {
      // rfi_response — integrity checks: RFI must exist, belong to this
      // tender, and not already have a response.
      const rfi = await this.prisma.tenderClarification.findUnique({
        where: { id: merged.rfiId },
        select: { id: true, tenderId: true, response: true }
      });
      if (!rfi) {
        throw new NotFoundException(`RFI ${merged.rfiId} not found.`);
      }
      if (rfi.tenderId !== tenderId) {
        throw new BadRequestException(
          "Proposal cannot be accepted — the target RFI belongs to a different tender than this conversation."
        );
      }
      if (rfi.response && rfi.response.length > 0) {
        throw new BadRequestException(
          "Proposal cannot be accepted — the target RFI already has a response. Edit it on the clarifications page instead."
        );
      }
      // Mirror the existing RFI-update path's status handling
      // (tendering.service.ts:868): a response flips status to CLOSED.
      // The dedicated edit page can re-open later if needed.
      await this.prisma.tenderClarification.update({
        where: { id: rfi.id },
        data: {
          response: merged.response,
          status: "CLOSED"
        }
      });
      acceptedRecord = { kind: "rfi_response", rfiId: rfi.id };
    }

    const updatedProposals = metadata.proposals.map((p) =>
      p.index === proposalIndex
        ? {
            ...stored,
            proposal: merged,
            status: "accepted" as const,
            acceptedRecord,
            decidedAt: new Date().toISOString()
          }
        : p
    );
    await this.prisma.conversationMessage.update({
      where: { id: message.id },
      data: {
        metadata: {
          ...metadata,
          proposals: updatedProposals
        } as unknown as Prisma.InputJsonValue
      }
    });

    this.logger.log(
      `Clarification proposal accepted [conversation=${conversation.id}, message=${message.id}, index=${proposalIndex}, kind=${merged.kind}, tender=${tenderId}]`
    );

    return acceptedRecord;
  }

  /**
   * Rejects one pending proposal — metadata-only status flip with a
   * decidedAt timestamp; no clarification rows are written.
   *
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided
   */
  async rejectClarificationProposal(
    userId: string,
    messageId: string,
    proposalIndex: number
  ): Promise<void> {
    const { message, metadata } = await this.loadProposalMessage(userId, messageId);
    const stored = metadata.proposals[proposalIndex];
    if (!stored) {
      throw new NotFoundException(`Proposal index ${proposalIndex} not found.`);
    }
    if (stored.status !== "pending") {
      throw new BadRequestException(`Proposal already ${stored.status}.`);
    }
    const updatedProposals = metadata.proposals.map((p) =>
      p.index === proposalIndex
        ? { ...p, status: "rejected" as const, decidedAt: new Date().toISOString() }
        : p
    );
    await this.prisma.conversationMessage.update({
      where: { id: message.id },
      data: {
        metadata: { ...metadata, proposals: updatedProposals } as unknown as Prisma.InputJsonValue
      }
    });
  }

  /**
   * Accepts every pending proposal on the message by calling
   * acceptClarificationProposal per index. Individual failures are
   * logged and counted rather than aborting the batch.
   *
   * @returns `{ accepted, failed }` counts
   * @throws NotFoundException when the message is not found or not owned by the user
   */
  async acceptAllPending(
    userId: string,
    messageId: string
  ): Promise<{ accepted: number; failed: number }> {
    const { metadata } = await this.loadProposalMessage(userId, messageId);
    let accepted = 0;
    let failed = 0;
    for (const p of metadata.proposals) {
      if (p.status !== "pending") continue;
      try {
        await this.acceptClarificationProposal(userId, messageId, p.index);
        accepted += 1;
      } catch (err) {
        this.logger.warn(
          `Bulk accept failed for clarification proposal ${p.index} on message ${messageId}: ${(err as Error).message}`
        );
        failed += 1;
      }
    }
    return { accepted, failed };
  }

  /**
   * Rejects every pending proposal on the message in a single metadata
   * update (no write occurs when nothing is pending).
   *
   * @returns `{ rejected }` count
   * @throws NotFoundException when the message is not found or not owned by the user
   */
  async rejectAllPending(userId: string, messageId: string): Promise<{ rejected: number }> {
    const { message, metadata } = await this.loadProposalMessage(userId, messageId);
    let rejected = 0;
    const now = new Date().toISOString();
    const updatedProposals = metadata.proposals.map((p) => {
      if (p.status !== "pending") return p;
      rejected += 1;
      return { ...p, status: "rejected" as const, decidedAt: now };
    });
    if (rejected > 0) {
      await this.prisma.conversationMessage.update({
        where: { id: message.id },
        data: {
          metadata: { ...metadata, proposals: updatedProposals } as unknown as Prisma.InputJsonValue
        }
      });
    }
    return { rejected };
  }

  // ── Helpers ───────────────────────────────────────────────────────
  private async loadProposalMessage(userId: string, messageId: string) {
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true }
    });
    if (!message || message.role !== "tool_result") {
      throw new NotFoundException("Clarification proposal message not found.");
    }
    if (message.conversation.userId !== userId) {
      throw new NotFoundException("Clarification proposal message not found.");
    }
    const metadata = message.metadata as unknown as ClarificationProposalsMetadata | null;
    if (
      !metadata ||
      metadata.toolName !== TOOL_NAME ||
      !Array.isArray(metadata.proposals)
    ) {
      throw new BadRequestException(
        "Clarification proposal message has no proposals to act on."
      );
    }
    return { conversation: message.conversation, message, metadata };
  }
}

function countByKind(proposals: StoredClarificationProposal[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of proposals) {
    out[p.proposal.kind] = (out[p.proposal.kind] ?? 0) + 1;
  }
  return out;
}

function formatKindCount(count: Record<string, number>): string {
  const parts: string[] = [];
  if (count.new_rfi) {
    parts.push(`${count.new_rfi} RFI${count.new_rfi === 1 ? "" : "s"}`);
  }
  if (count.new_note) {
    parts.push(`${count.new_note} note${count.new_note === 1 ? "" : "s"}`);
  }
  if (count.rfi_response) {
    parts.push(`${count.rfi_response} RFI response${count.rfi_response === 1 ? "" : "s"}`);
  }
  return parts.length === 0 ? "no items" : parts.join(" + ");
}

// Merge edits into a stored proposal, preserving the original kind.
// The frontend constrains edit-form fields to the original kind, so
// the merge is naturally safe; we cast back to the original kind's
// type after merging.
function mergeByKind(
  stored: ClarificationProposalInput,
  edits: ClarificationProposalEdits
): ClarificationProposalInput {
  if (stored.kind === "new_rfi") {
    const e = edits as Partial<NewRfiProposal>;
    return { ...stored, ...e, kind: "new_rfi" } as NewRfiProposal;
  }
  if (stored.kind === "new_note") {
    const e = edits as Partial<NewNoteProposal>;
    return { ...stored, ...e, kind: "new_note" } as NewNoteProposal;
  }
  const e = edits as Partial<RfiResponseProposal>;
  return { ...stored, ...e, kind: "rfi_response" } as RfiResponseProposal;
}
