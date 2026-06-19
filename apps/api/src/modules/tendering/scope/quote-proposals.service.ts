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
  ProposeQuoteContentArgs,
  QuoteAssumptionProposal,
  QuoteCostLineProposal,
  QuoteExclusionProposal
} from "../../ai-providers/tools/propose-quote-content.tool";

// §5A.1 PR E — quote-content proposal store. Mirrors
// EstimateProposalsService (PR D) exactly. Each model tool_call becomes
// a tool_call + tool_result conversation-row pair; the tool_result
// metadata carries the proposal payload that the frontend renders as
// cards.
//
// The tool_result metadata carries an explicit `toolName` discriminator
// so the frontend (and this service's load helper) can route the row
// to the right surface. Mismatched-toolName loads are rejected — the
// scope/estimate/quote proposal stores stay strictly isolated.
const TOOL_NAME = "propose_quote_content";

/** Lifecycle status of a stored quote-content proposal. */
export type QuoteProposalStatus = "pending" | "accepted" | "rejected";

/** One AI quote-content proposal as persisted on a tool_result message. */
export type StoredQuoteProposal = {
  index: number;
  quoteId: string;
  costLines?: QuoteCostLineProposal[];
  exclusions?: QuoteExclusionProposal[];
  assumptions?: QuoteAssumptionProposal[];
  status: QuoteProposalStatus;
  acceptedCostLineIds?: string[];
  acceptedExclusionIds?: string[];
  acceptedAssumptionIds?: string[];
  decidedAt?: string;
};

/** Shape of the tool_result message metadata for quote-content proposals. */
export type QuoteProposalsMetadata = {
  toolUseId: string;
  toolName: typeof TOOL_NAME;
  proposals: StoredQuoteProposal[];
};

/** Optional content-array edits applied to a quote proposal at accept time. */
export type QuoteProposalEdits = Partial<{
  costLines: QuoteCostLineProposal[];
  exclusions: QuoteExclusionProposal[];
  assumptions: QuoteAssumptionProposal[];
}>;

/**
 * Stores and decides AI-generated quote-content proposals (§5A.1 PR E),
 * mirroring EstimateProposalsService.
 *
 * Proposals live in tool_result message metadata under the
 * "propose_quote_content" toolName discriminator. Accepting appends
 * cost-line / exclusion / assumption rows to the target ClientQuote,
 * which must belong to the conversation's tender and be in DRAFT
 * status. Ownership is enforced via the conversation's userId.
 */
@Injectable()
export class QuoteProposalsService {
  private readonly logger = new Logger(QuoteProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // §5A.1 PR E — store proposals. propose_quote_content returns a SINGLE
  // proposal object (one quoteId per tool call) but we keep the array
  // shape to match the propose_scope_items / propose_estimate_items
  // store and frontend-card patterns. The array always has length 1
  // today — bulk-quoteId proposing isn't a workflow Marco needs.
  /**
   * Persists a propose_quote_content tool call as a tool_call +
   * tool_result conversation-message pair in one transaction. The tool
   * supplies a single proposal (one quoteId per call) but it is stored
   * as a length-1 array to match the other proposal stores. Also bumps
   * the conversation's updatedAt.
   *
   * @param toolUseId - provider tool_use id stored for provenance
   * @param args - the tool arguments (quoteId + optional content blocks)
   * @returns the tool_result message and the stored proposal array
   */
  async storeQuoteProposals(
    conversationId: string,
    toolUseId: string,
    args: ProposeQuoteContentArgs
  ): Promise<{ message: ConversationMessage; proposals: StoredQuoteProposal[] }> {
    const proposal: StoredQuoteProposal = {
      index: 0,
      quoteId: args.quoteId,
      costLines: args.costLines,
      exclusions: args.exclusions,
      assumptions: args.assumptions,
      status: "pending"
    };
    const proposals = [proposal];
    const metadata: QuoteProposalsMetadata = {
      toolUseId,
      toolName: TOOL_NAME,
      proposals
    };
    const noun = describeContent(proposal);
    const [, message] = await this.prisma.$transaction([
      this.prisma.conversationMessage.create({
        data: {
          conversationId,
          role: "tool_call",
          content: `Proposed quote content (${noun}).`,
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
          content: `Quote content pending review (${noun}).`,
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
   * Accepts one pending proposal: validates the target ClientQuote
   * (must exist, belong to the conversation's tender, and be DRAFT),
   * appends cost-line / exclusion / assumption rows after the current
   * max sortOrder per list (cost lines default price 0 when unset),
   * then flips the proposal to "accepted" with the created row ids.
   *
   * @param edits - optional content-array overrides merged over the stored proposal before commit
   * @returns the ids of every created cost line, exclusion, and assumption row
   * @throws NotFoundException when the message, proposal index, or ClientQuote is not found
   * @throws BadRequestException when the proposal is already decided, the conversation has no tender context, the quote belongs to another tender, or the quote is not DRAFT
   */
  async acceptQuoteProposal(
    userId: string,
    messageId: string,
    proposalIndex: number,
    edits: QuoteProposalEdits = {}
  ): Promise<{
    acceptedCostLineIds: string[];
    acceptedExclusionIds: string[];
    acceptedAssumptionIds: string[];
  }> {
    const { conversation, message, metadata } = await this.loadProposalMessage(userId, messageId);
    const proposal = metadata.proposals[proposalIndex];
    if (!proposal) {
      throw new NotFoundException(`Proposal index ${proposalIndex} not found.`);
    }
    if (proposal.status !== "pending") {
      throw new BadRequestException(`Proposal already ${proposal.status}.`);
    }
    const tenderId = conversation.contextKey;
    if (!tenderId) {
      throw new BadRequestException(
        "Proposal cannot be accepted — conversation has no tender context."
      );
    }

    const merged: StoredQuoteProposal = {
      ...proposal,
      ...edits,
      index: proposal.index,
      status: "pending"
    };

    // 1. Resolve the target ClientQuote. Two integrity checks:
    //    (a) it must EXIST and belong to the tender the conversation is
    //        scoped to (prevents cross-tender content leakage), and
    //    (b) its status MUST be DRAFT — SENT / SUPERSEDED quotes are
    //        immutable.
    const quote = await this.prisma.clientQuote.findUnique({
      where: { id: merged.quoteId },
      select: { id: true, tenderId: true, status: true }
    });
    if (!quote) {
      throw new NotFoundException(`ClientQuote ${merged.quoteId} not found.`);
    }
    if (quote.tenderId !== tenderId) {
      throw new BadRequestException(
        "Proposal cannot be accepted — the target ClientQuote belongs to a different tender than this conversation."
      );
    }
    if (quote.status !== "DRAFT") {
      throw new BadRequestException(
        `Proposal cannot be accepted — ClientQuote is in status ${quote.status}. Only DRAFT quotes accept new content.`
      );
    }

    // 2. Compute next sortOrder per row type so accepted proposals
    // append to the end of each list rather than collide with manual
    // entries.
    const [costMax, exclMax, assumeMax] = await Promise.all([
      this.prisma.quoteCostLine.aggregate({
        where: { quoteId: quote.id },
        _max: { sortOrder: true }
      }),
      this.prisma.quoteExclusion.aggregate({
        where: { quoteId: quote.id },
        _max: { sortOrder: true }
      }),
      this.prisma.quoteAssumption.aggregate({
        where: { quoteId: quote.id },
        _max: { sortOrder: true }
      })
    ]);
    let costSort = (costMax._max.sortOrder ?? -1) + 1;
    let exclSort = (exclMax._max.sortOrder ?? -1) + 1;
    let assumeSort = (assumeMax._max.sortOrder ?? -1) + 1;

    // 3. Create content rows. Each block is independent and may be
    // omitted; cost-lines default to 0 when the model didn't supply a
    // price.
    const acceptedCostLineIds: string[] = [];
    for (const line of merged.costLines ?? []) {
      const row = await this.prisma.quoteCostLine.create({
        data: {
          quoteId: quote.id,
          label: line.label,
          description: line.description,
          price: new Prisma.Decimal(line.price ?? 0),
          sortOrder: costSort
        },
        select: { id: true }
      });
      acceptedCostLineIds.push(row.id);
      costSort += 1;
    }
    const acceptedExclusionIds: string[] = [];
    for (const exclusion of merged.exclusions ?? []) {
      const row = await this.prisma.quoteExclusion.create({
        data: {
          quoteId: quote.id,
          text: exclusion.text,
          sortOrder: exclSort
        },
        select: { id: true }
      });
      acceptedExclusionIds.push(row.id);
      exclSort += 1;
    }
    const acceptedAssumptionIds: string[] = [];
    for (const assumption of merged.assumptions ?? []) {
      const row = await this.prisma.quoteAssumption.create({
        data: {
          quoteId: quote.id,
          text: assumption.text,
          sortOrder: assumeSort
        },
        select: { id: true }
      });
      acceptedAssumptionIds.push(row.id);
      assumeSort += 1;
    }

    // 4. Flip the proposal to accepted with the ids of every row we
    // created — frontend uses these to surface "view in quote" deep
    // links + reverse the accept if the user changes their mind.
    const updatedProposals = metadata.proposals.map((p) =>
      p.index === proposalIndex
        ? {
            ...merged,
            status: "accepted" as const,
            acceptedCostLineIds,
            acceptedExclusionIds,
            acceptedAssumptionIds,
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
      `Quote proposal accepted [conversation=${conversation.id}, message=${message.id}, quote=${quote.id}, costLines=${acceptedCostLineIds.length}, exclusions=${acceptedExclusionIds.length}, assumptions=${acceptedAssumptionIds.length}]`
    );

    return { acceptedCostLineIds, acceptedExclusionIds, acceptedAssumptionIds };
  }

  /**
   * Rejects one pending proposal — metadata-only status flip with a
   * decidedAt timestamp; no quote rows are written.
   *
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided
   */
  async rejectQuoteProposal(
    userId: string,
    messageId: string,
    proposalIndex: number
  ): Promise<void> {
    const { message, metadata } = await this.loadProposalMessage(userId, messageId);
    const proposal = metadata.proposals[proposalIndex];
    if (!proposal) {
      throw new NotFoundException(`Proposal index ${proposalIndex} not found.`);
    }
    if (proposal.status !== "pending") {
      throw new BadRequestException(`Proposal already ${proposal.status}.`);
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
   * acceptQuoteProposal per index. Individual failures are logged and
   * counted rather than aborting the batch.
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
        await this.acceptQuoteProposal(userId, messageId, p.index);
        accepted += 1;
      } catch (err) {
        this.logger.warn(
          `Bulk accept failed for quote proposal ${p.index} on message ${messageId}: ${(err as Error).message}`
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
      throw new NotFoundException("Quote proposal message not found.");
    }
    if (message.conversation.userId !== userId) {
      throw new NotFoundException("Quote proposal message not found.");
    }
    const metadata = message.metadata as unknown as QuoteProposalsMetadata | null;
    if (
      !metadata ||
      metadata.toolName !== TOOL_NAME ||
      !Array.isArray(metadata.proposals)
    ) {
      throw new BadRequestException("Quote proposal message has no proposals to act on.");
    }
    return { conversation: message.conversation, message, metadata };
  }
}

function describeContent(p: StoredQuoteProposal): string {
  const parts: string[] = [];
  if (p.costLines && p.costLines.length > 0) {
    parts.push(`${p.costLines.length} cost line${p.costLines.length === 1 ? "" : "s"}`);
  }
  if (p.exclusions && p.exclusions.length > 0) {
    parts.push(`${p.exclusions.length} exclusion${p.exclusions.length === 1 ? "" : "s"}`);
  }
  if (p.assumptions && p.assumptions.length > 0) {
    parts.push(`${p.assumptions.length} assumption${p.assumptions.length === 1 ? "" : "s"}`);
  }
  return parts.length === 0 ? "no content" : parts.join(" + ");
}
