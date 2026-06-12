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
  EstimateCuttingLineProposal,
  EstimateItemProposal,
  EstimateLabourLineProposal,
  EstimatePlantLineProposal,
  EstimateWasteLineProposal,
  ProposeEstimateItemsArgs
} from "../../ai-providers/tools/propose-estimate-items.tool";
import { type IsDisciplineCode } from "../../personas/definitions/disciplines";

// §5A.1 PR D — estimate-item proposal store, mirroring ProposalsService
// (scope items). Each tool_call from the model becomes a tool_call +
// tool_result pair on the conversation row; the tool_result.metadata
// carries the proposals array which the frontend renders as cards.
//
// The tool_result metadata carries an explicit `toolName` discriminator
// so the frontend's history rebuild can distinguish estimate-proposals
// rows from the legacy scope-proposals rows (which lack toolName).
const TOOL_NAME = "propose_estimate_items";

export type EstimateProposalStatus = "pending" | "accepted" | "rejected";

export type StoredEstimateProposal = {
  index: number;
  code: IsDisciplineCode;
  title: string;
  description?: string;
  markup?: number;
  isProvisional?: boolean;
  provisionalAmount?: number;
  labourLines?: EstimateLabourLineProposal[];
  plantLines?: EstimatePlantLineProposal[];
  cuttingLines?: EstimateCuttingLineProposal[];
  wasteLines?: EstimateWasteLineProposal[];
  status: EstimateProposalStatus;
  acceptedEstimateItemId?: string;
  decidedAt?: string;
};

export type EstimateProposalsMetadata = {
  toolUseId: string;
  toolName: typeof TOOL_NAME;
  proposals: StoredEstimateProposal[];
};

export type EstimateProposalEdits = Partial<{
  code: IsDisciplineCode;
  title: string;
  description: string;
  markup: number;
  isProvisional: boolean;
  provisionalAmount: number;
  labourLines: EstimateLabourLineProposal[];
  plantLines: EstimatePlantLineProposal[];
  cuttingLines: EstimateCuttingLineProposal[];
  wasteLines: EstimateWasteLineProposal[];
}>;

/**
 * Stores and decides AI-generated estimate-item proposals (§5A.1 PR D),
 * mirroring ProposalsService for scope items.
 *
 * Proposals live in tool_result message metadata under the
 * "propose_estimate_items" toolName discriminator. Accepting writes an
 * EstimateItem plus its labour/plant/cutting/waste lines onto the
 * tender's TenderEstimate (created with 30% markup if absent); locked
 * estimates refuse accepts. Ownership is enforced via the
 * conversation's userId.
 */
@Injectable()
export class EstimateProposalsService {
  private readonly logger = new Logger(EstimateProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a propose_estimate_items tool call as a tool_call +
   * tool_result conversation-message pair in one transaction, with all
   * proposals starting at "pending". Also bumps the conversation's
   * updatedAt.
   *
   * @param toolUseId - provider tool_use id stored for provenance
   * @param args - the tool arguments containing the proposed estimate items
   * @returns the tool_result message and the stored proposal array
   */
  async storeEstimateProposals(
    conversationId: string,
    toolUseId: string,
    args: ProposeEstimateItemsArgs
  ): Promise<{ message: ConversationMessage; proposals: StoredEstimateProposal[] }> {
    const proposals: StoredEstimateProposal[] = args.proposals.map((p, index) => ({
      index,
      code: p.code,
      title: p.title,
      description: p.description,
      markup: p.markup,
      isProvisional: p.isProvisional,
      provisionalAmount: p.provisionalAmount,
      labourLines: p.labourLines,
      plantLines: p.plantLines,
      cuttingLines: p.cuttingLines,
      wasteLines: p.wasteLines,
      status: "pending" as const
    }));
    const metadata: EstimateProposalsMetadata = {
      toolUseId,
      toolName: TOOL_NAME,
      proposals
    };
    const [, message] = await this.prisma.$transaction([
      this.prisma.conversationMessage.create({
        data: {
          conversationId,
          role: "tool_call",
          content: `Proposed ${proposals.length} estimate item${proposals.length === 1 ? "" : "s"}.`,
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
          content: `${proposals.length} estimate item${proposals.length === 1 ? "" : "s"} pending review.`,
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
   * Accepts one pending proposal: finds or creates the tender's
   * TenderEstimate (default 30% markup), creates the EstimateItem with
   * the next contiguous itemNumber within (estimate, code), creates its
   * labour/plant/cutting/waste lines (sortOrder = array index), then
   * flips the proposal to "accepted" in the message metadata. Titles
   * longer than 200 characters are truncated.
   *
   * @param edits - optional field/line-array overrides merged over the stored proposal before commit
   * @returns `{ estimateItemId }` of the created item
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided, the conversation has no tender context, or the estimate is locked
   */
  async acceptEstimateProposal(
    userId: string,
    messageId: string,
    proposalIndex: number,
    edits: EstimateProposalEdits = {}
  ): Promise<{ estimateItemId: string }> {
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

    const merged: StoredEstimateProposal = {
      ...proposal,
      ...edits,
      index: proposal.index,
      status: "pending"
    };

    // 1. Find or create the TenderEstimate for this tender — same shape
    // as scope-of-works.service.createEstimateItemFromScope so an estimate
    // created via a scope-confirmation lands on the same row as one
    // created via this proposal accept.
    let estimate = await this.prisma.tenderEstimate.findUnique({ where: { tenderId } });
    if (!estimate) {
      estimate = await this.prisma.tenderEstimate.create({
        data: { tenderId, markup: new Prisma.Decimal("30") }
      });
    }
    if (estimate.lockedAt) {
      throw new BadRequestException(
        "Estimate is locked — unlock it from the Estimate tab before accepting proposals."
      );
    }

    // 2. Next itemNumber within (estimate, code) — mirrors the existing
    // auto-create path so item numbers stay contiguous across both entry
    // points.
    const itemNumber =
      (await this.prisma.estimateItem.count({
        where: { estimateId: estimate.id, code: merged.code }
      })) + 1;

    const markup = merged.markup ?? 30;
    const isProvisional = merged.isProvisional ?? false;

    const item = await this.prisma.estimateItem.create({
      data: {
        estimateId: estimate.id,
        code: merged.code,
        itemNumber,
        title: merged.title.length > 200 ? merged.title.slice(0, 200) : merged.title,
        description: merged.description ?? null,
        markup: new Prisma.Decimal(markup),
        isProvisional,
        provisionalAmount:
          merged.provisionalAmount != null
            ? new Prisma.Decimal(merged.provisionalAmount)
            : null
      }
    });

    // 3. Cost lines — each group is independent and order-stable via
    // sortOrder = array index. Skip the group entirely when the model
    // didn't supply one.
    const labourLines = merged.labourLines ?? [];
    for (let i = 0; i < labourLines.length; i++) {
      const l = labourLines[i]!;
      await this.prisma.estimateLabourLine.create({
        data: {
          itemId: item.id,
          role: l.role,
          qty: new Prisma.Decimal(l.qty),
          days: new Prisma.Decimal(l.days),
          shift: l.shift,
          rate: new Prisma.Decimal(l.rate),
          sortOrder: i
        }
      });
    }

    const plantLines = merged.plantLines ?? [];
    for (let i = 0; i < plantLines.length; i++) {
      const p = plantLines[i]!;
      await this.prisma.estimatePlantLine.create({
        data: {
          itemId: item.id,
          plantItem: p.plantItem,
          qty: new Prisma.Decimal(p.qty),
          days: new Prisma.Decimal(p.days),
          comment: p.comment ?? null,
          rate: new Prisma.Decimal(p.rate),
          sortOrder: i
        }
      });
    }

    const cuttingLines = merged.cuttingLines ?? [];
    for (let i = 0; i < cuttingLines.length; i++) {
      const c = cuttingLines[i]!;
      await this.prisma.estimateCuttingLine.create({
        data: {
          itemId: item.id,
          cuttingType: c.cuttingType,
          equipment: c.equipment ?? null,
          elevation: c.elevation ?? null,
          material: c.material ?? null,
          depthMm: c.depthMm ?? null,
          diameterMm: c.diameterMm ?? null,
          qty: new Prisma.Decimal(c.qty),
          unit: c.unit,
          comment: c.comment ?? null,
          rate: new Prisma.Decimal(c.rate),
          sortOrder: i
        }
      });
    }

    const wasteLines = merged.wasteLines ?? [];
    for (let i = 0; i < wasteLines.length; i++) {
      const w = wasteLines[i]!;
      await this.prisma.estimateWasteLine.create({
        data: {
          itemId: item.id,
          wasteGroup: w.wasteGroup ?? null,
          wasteType: w.wasteType,
          facility: w.facility,
          qtyTonnes: new Prisma.Decimal(w.qtyTonnes),
          tonRate: new Prisma.Decimal(w.tonRate),
          loads: w.loads,
          loadRate: new Prisma.Decimal(w.loadRate),
          sortOrder: i
        }
      });
    }

    const updatedProposals = metadata.proposals.map((p) =>
      p.index === proposalIndex
        ? {
            ...merged,
            status: "accepted" as const,
            acceptedEstimateItemId: item.id,
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
      `Estimate proposal accepted [conversation=${conversation.id}, message=${message.id}, index=${proposalIndex}, estimateItem=${item.id}, tender=${tenderId}]`
    );

    return { estimateItemId: item.id };
  }

  /**
   * Rejects one pending proposal — metadata-only status flip with a
   * decidedAt timestamp; nothing is written to estimate_items.
   *
   * @throws NotFoundException when the message or proposal index is not found
   * @throws BadRequestException when the proposal is already decided
   */
  async rejectEstimateProposal(
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
   * acceptEstimateProposal per index. Individual failures are logged
   * and counted rather than aborting the batch.
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
        await this.acceptEstimateProposal(userId, messageId, p.index);
        accepted += 1;
      } catch (err) {
        this.logger.warn(
          `Bulk accept failed for estimate proposal ${p.index} on message ${messageId}: ${(err as Error).message}`
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
      throw new NotFoundException("Estimate proposal message not found.");
    }
    if (message.conversation.userId !== userId) {
      throw new NotFoundException("Estimate proposal message not found.");
    }
    const metadata = message.metadata as unknown as EstimateProposalsMetadata | null;
    if (
      !metadata ||
      metadata.toolName !== TOOL_NAME ||
      !Array.isArray(metadata.proposals)
    ) {
      throw new BadRequestException("Estimate proposal message has no proposals to act on.");
    }
    return { conversation: message.conversation, message, metadata };
  }
}
