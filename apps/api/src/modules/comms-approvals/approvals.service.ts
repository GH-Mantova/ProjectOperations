import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { ApprovalDecision } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthorityService } from "../authorization/authority.service";
import type { RecordApprovalDecisionDto } from "./dto/record-approval-decision.dto";
import type { OverruleApprovalDecisionDto } from "./dto/overrule-approval-decision.dto";

/**
 * Records approval decisions and overrules for record-anchored actions.
 *
 * Every decision is routed through the AuthorityService seam (empty store =
 * open ceiling — matches the seam's default posture). A decision that the
 * seam refuses is stored as REJECTED with the matched rule captured for
 * audit, so the trail is coherent whether the decider approved, was
 * refused by the seam, or was later overruled.
 *
 * Overrules walk the `managerId` chain from the prior decider upward. The
 * overruler must appear in that chain; otherwise the request is refused.
 * A prior OVERRULED decision cannot be overruled again — overrule chains
 * are linear (one prior ↔ one override), so the model itself enforces
 * uniqueness on `overrulesId`.
 *
 * Fan-out is internal only in this slice: an in-app Notification is
 * created for the counter-party on decide, and for the whole traversed
 * chain plus the overruled decider on overrule. Outlook mirroring is a
 * later slice.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: AuthorityService
  ) {}

  async recordDecision(
    input: RecordApprovalDecisionDto,
    actorId: string
  ): Promise<ApprovalDecision> {
    const seam = await this.authority.check({
      userId: actorId,
      action: input.action,
      amount: input.amount
    });

    // If the seam refuses (bounded rule + amount over cap), the caller
    // cannot record an APPROVED decision — they must reject or escalate.
    let effectiveDecision: "APPROVED" | "REJECTED" = input.decision;
    if (input.decision === "APPROVED" && !seam.allowed) {
      throw new ForbiddenException(
        "Authority seam refused this action at the requested amount — escalate or reject."
      );
    }

    const created = await this.prisma.approvalDecision.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        amount: input.amount ?? null,
        decision: effectiveDecision,
        reason: input.reason ?? null,
        decidedById: actorId,
        authorityRuleId: seam.matchedRuleId ?? null
      }
    });

    // Fan out: notify the escalation target (if the seam surfaced one) so
    // they see the decision on their inbox. If no escalation target is
    // configured we skip fan-out — the record view is enough.
    if (seam.escalateToUserId && seam.escalateToUserId !== actorId) {
      await this.notify(seam.escalateToUserId, {
        title: `Approval decision recorded on ${input.entityType}`,
        body: `${effectiveDecision} — ${input.action}${
          input.amount !== undefined ? ` (${input.amount})` : ""
        }`,
        severity: effectiveDecision === "APPROVED" ? "info" : "warning",
        metadata: {
          kind: "APPROVAL_DECISION",
          decisionId: created.id,
          entityType: input.entityType,
          entityId: input.entityId
        }
      });
    }

    return created;
  }

  async overrule(
    decisionId: string,
    input: OverruleApprovalDecisionDto,
    actorId: string
  ): Promise<ApprovalDecision> {
    const prior = await this.prisma.approvalDecision.findUnique({
      where: { id: decisionId }
    });
    if (!prior) {
      throw new NotFoundException("Approval decision not found.");
    }
    if (prior.decision === "OVERRULED") {
      throw new BadRequestException("This decision has already been overruled.");
    }
    if (prior.decidedById === actorId) {
      throw new BadRequestException("You cannot overrule your own decision.");
    }

    const seniors = await this.collectSeniorChain(prior.decidedById);
    if (!seniors.includes(actorId)) {
      throw new ForbiddenException(
        "Only a senior in the reporting chain of the prior decider may overrule."
      );
    }

    const [, override] = await this.prisma.$transaction([
      this.prisma.approvalDecision.update({
        where: { id: prior.id },
        data: { decision: "OVERRULED" }
      }),
      this.prisma.approvalDecision.create({
        data: {
          entityType: prior.entityType,
          entityId: prior.entityId,
          action: prior.action,
          amount: prior.amount,
          decision: "APPROVED",
          reason: input.reason,
          decidedById: actorId,
          overrulesId: prior.id,
          authorityRuleId: prior.authorityRuleId
        }
      })
    ]);

    // Fan out to the whole chain we walked, plus the prior decider —
    // everyone in the hierarchy sees when an overrule cuts across them.
    const recipients = new Set<string>(seniors);
    recipients.add(prior.decidedById);
    recipients.delete(actorId);
    for (const recipientId of recipients) {
      await this.notify(recipientId, {
        title: `Approval overruled on ${prior.entityType}`,
        body: `Prior decision on "${prior.action}" was overruled. Reason: ${input.reason}`,
        severity: "warning",
        metadata: {
          kind: "APPROVAL_OVERRULE",
          decisionId: override.id,
          overrulesId: prior.id,
          entityType: prior.entityType,
          entityId: prior.entityId
        }
      });
    }

    return override;
  }

  listForRecord(entityType: string, entityId: string): Promise<ApprovalDecision[]> {
    return this.prisma.approvalDecision.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "asc" }
    });
  }

  /**
   * Walks the reporting chain from `startUserId` upward via `managerId`
   * and returns every senior user id encountered. Stops on the first
   * cycle or when a user has no manager. `startUserId` is not included.
   */
  private async collectSeniorChain(startUserId: string): Promise<string[]> {
    const seen = new Set<string>([startUserId]);
    const seniors: string[] = [];
    let cursor: string | null = startUserId;
    // Bounded walk — no reporting chain in a construction org is deeper
    // than a handful of levels, and the loop guards against cycles.
    for (let hop = 0; hop < 25 && cursor; hop++) {
      const row: { managerId: string | null } | null = await this.prisma.user.findUnique({
        where: { id: cursor },
        select: { managerId: true }
      });
      const nextId: string | null = row?.managerId ?? null;
      if (!nextId || seen.has(nextId)) break;
      seen.add(nextId);
      seniors.push(nextId);
      cursor = nextId;
    }
    return seniors;
  }

  private async notify(
    userId: string,
    payload: {
      title: string;
      body: string;
      severity: string;
      metadata: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        body: payload.body,
        severity: payload.severity,
        metadata: payload.metadata as Prisma.InputJsonValue
      }
    });
  }
}
