import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { ConversationMessage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ProposeScopeItemsArgs } from "../../ai-providers/tools/propose-scope-items.tool";
import { type IsDisciplineCode } from "../../personas/definitions/disciplines";
import { getScopeCardDefault } from "./card-defaults";

// PR A1 (2026-05-16) — the AI-facing discipline vocabulary now matches the
// internal scope-of-works discipline column (4-code system: DEM/CIV/ASB/Other).
// The propose_scope_items tool enforces the codes via its enum, so no
// translation is required at this layer. Default row-type mapping kept
// per-discipline below.
const DEFAULT_ROW_TYPE_BY_DISCIPLINE: Record<IsDisciplineCode, string> = {
  DEM: "demolition",
  CIV: "general-labour",
  ASB: "asbestos-removal",
  Other: "general-labour"
};

/** Lifecycle status of a stored scope-item proposal. */
export type ProposalStatus = "pending" | "accepted" | "rejected";

/** One AI scope-item proposal as persisted on a tool_result message. */
export type StoredProposal = {
  index: number;
  discipline: IsDisciplineCode;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  notes?: string;
  status: ProposalStatus;
  acceptedScopeItemId?: string;
  decidedAt?: string;
};

/** Shape of the tool_result message metadata for scope-item proposals. */
export type ProposalsMetadata = {
  toolUseId: string;
  proposals: StoredProposal[];
};

/** Optional field edits applied to a scope-item proposal at accept time. */
export type ProposalEdits = Partial<{
  discipline: IsDisciplineCode;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  notes: string;
}>;

/**
 * Stores and decides AI-generated scope-item proposals.
 *
 * Proposals live in the metadata of a tool_result ConversationMessage
 * (status pending/accepted/rejected). Accepting a proposal writes a
 * confirmed ScopeOfWorksItem (creating the discipline's scope card from
 * defaults if none exists) and stamps the accepted scope-item id back
 * into the message metadata. Ownership is enforced by matching the
 * conversation's userId against the caller.
 */
@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Persist an AI tool_use invocation as a tool_result conversation message.
  // The AI's tool call (with arguments) becomes a tool_call row; this method
  // creates the matching tool_result row that the UI renders as proposal
  // cards. Status starts at "pending" for every proposal.
  /**
   * Persists an AI propose_scope_items tool call as a tool_call +
   * tool_result conversation-message pair in one transaction, with every
   * proposal starting at status "pending". Also bumps the conversation's
   * updatedAt.
   *
   * @param toolUseId - provider tool_use id stored for provenance
   * @param args - the tool arguments containing the proposed items
   * @returns the tool_result message and the stored proposal array
   */
  async storeProposals(
    conversationId: string,
    toolUseId: string,
    args: ProposeScopeItemsArgs
  ): Promise<{ message: ConversationMessage; proposals: StoredProposal[] }> {
    const proposals: StoredProposal[] = args.proposals.map((p, index) => ({
      index,
      discipline: p.discipline,
      title: p.title,
      description: p.description,
      quantity: p.quantity,
      unit: p.unit,
      notes: p.notes,
      status: "pending" as const
    }));
    const metadata: ProposalsMetadata = { toolUseId, proposals };
    // Two writes in a transaction: the assistant tool_call row (provenance)
    // and the tool_result row (renderable). Storing both lets a future
    // re-render show the AI's reasoning if needed.
    const [, message] = await this.prisma.$transaction([
      this.prisma.conversationMessage.create({
        data: {
          conversationId,
          role: "tool_call",
          content: `Proposed ${proposals.length} scope item${proposals.length === 1 ? "" : "s"}.`,
          metadata: {
            toolUseId,
            name: "propose_scope_items",
            arguments: args as unknown as Prisma.InputJsonValue
          } as Prisma.InputJsonValue
        }
      }),
      this.prisma.conversationMessage.create({
        data: {
          conversationId,
          role: "tool_result",
          content: `${proposals.length} scope item${proposals.length === 1 ? "" : "s"} pending review.`,
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
   * Accepts one pending proposal: creates a confirmed, aiProposed
   * ScopeOfWorksItem on the conversation's tender (looking up or
   * creating the discipline's first scope card from defaults), then
   * flips the proposal to "accepted" in the message metadata.
   *
   * The wbsCode is `{discipline}{itemNumber}` where itemNumber is the
   * current count of items on that discipline's cards + 1.
   *
   * @param edits - optional field overrides merged over the stored proposal before commit
   * @returns `{ scopeItemId }` of the created scope item
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided or the conversation has no tender context
   */
  async acceptProposal(
    userId: string,
    messageId: string,
    proposalIndex: number,
    edits: ProposalEdits = {}
  ): Promise<{ scopeItemId: string }> {
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

    const merged: StoredProposal = {
      ...proposal,
      ...edits,
      index: proposal.index,
      status: "pending"
    };
    const discipline = merged.discipline;

    const itemNumber = await this.nextItemNumber(tenderId, discipline);
    const wbsCode = `${discipline}${itemNumber}`;
    const description = merged.title === merged.description
      ? merged.description
      : `${merged.title} — ${merged.description}`;
    // PR A2.5 — every scope item must link to a card. Look up or create.
    // PR B1 — populate cardNumber on creation (first card per discipline = 1).
    const card = await this.prisma.scopeCard.findFirst({
      where: { tenderId, discipline },
      orderBy: { cardNumber: "asc" },
      select: { id: true }
    });
    let cardId = card?.id;
    if (!cardId) {
      const defaults = getScopeCardDefault(discipline);
      const created = await this.prisma.scopeCard.create({
        data: {
          tenderId,
          name: defaults.name,
          discipline,
          cardNumber: defaults.cardNumber,
          sortOrder: defaults.sortOrder,
          createdById: userId
        },
        select: { id: true }
      });
      cardId = created.id;
    }
    const scopeItem = await this.prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId,
        wbsCode,
        itemNumber,
        rowType: DEFAULT_ROW_TYPE_BY_DISCIPLINE[discipline],
        description,
        notes: merged.notes ?? null,
        measurementQty: new Prisma.Decimal(merged.quantity),
        measurementUnit: merged.unit,
        status: "confirmed",
        aiProposed: true,
        createdById: userId
      }
    });

    const updatedProposals = metadata.proposals.map((p) =>
      p.index === proposalIndex
        ? {
            ...merged,
            status: "accepted" as const,
            acceptedScopeItemId: scopeItem.id,
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
      `Proposal accepted [conversation=${conversation.id}, message=${message.id}, index=${proposalIndex}, scopeItem=${scopeItem.id}, tender=${tenderId}]`
    );

    return { scopeItemId: scopeItem.id };
  }

  /**
   * Rejects one pending proposal — metadata-only status flip with a
   * decidedAt timestamp; nothing is written to scope_of_works_items.
   *
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided
   */
  async rejectProposal(
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
   * acceptProposal per index. Individual failures are logged and
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
        await this.acceptProposal(userId, messageId, p.index);
        accepted += 1;
      } catch (err) {
        this.logger.warn(
          `Bulk accept failed for proposal ${p.index} on message ${messageId}: ${(err as Error).message}`
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
      throw new NotFoundException("Proposal message not found.");
    }
    if (message.conversation.userId !== userId) {
      throw new NotFoundException("Proposal message not found.");
    }
    const metadata = message.metadata as unknown as ProposalsMetadata | null;
    if (!metadata || !Array.isArray(metadata.proposals)) {
      throw new BadRequestException("Proposal message has no proposals to act on.");
    }
    return { conversation: message.conversation, message, metadata };
  }

  private async nextItemNumber(
    tenderId: string,
    discipline: IsDisciplineCode
  ): Promise<number> {
    const count = await this.prisma.scopeOfWorksItem.count({
      where: { tenderId, card: { discipline } }
    });
    return count + 1;
  }
}
