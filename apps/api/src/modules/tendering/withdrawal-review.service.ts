import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

// The three decision codes appended to tender_withdrawal_reviews.
// - WITHDRAWN: initial action from DRAFT/IN_PROGRESS. Tender.status becomes
//   WITHDRAWN and withdrawalState becomes PENDING_REVIEW.
// - REOPENED:  reviewer rejects the withdrawal. Tender goes back to
//   IN_PROGRESS (Estimating). withdrawalState clears (null).
// - CONFIRMED: reviewer accepts the withdrawal. Tender.status stays
//   WITHDRAWN; withdrawalState flips to CONFIRMED — tender exits the Pipeline
//   board and appears only on the CRM Tenders register.
export type WithdrawalDecision = "WITHDRAWN" | "REOPENED" | "CONFIRMED";

// Withdraw is allowed only from the two pre-submission stages. Any other
// starting status is a user error (e.g. asking to withdraw an AWARDED
// tender — that's Lost/Won territory, not withdraw).
const WITHDRAWABLE_FROM = new Set<string>(["DRAFT", "IN_PROGRESS"]);

export type Actor = { sub: string; permissions?: string[]; isSuperUser?: boolean };

/**
 * Withdrawn-review workflow for tenders.
 *
 * Three actions:
 *  - withdraw:  DRAFT/ESTIMATING → WITHDRAWN + PENDING_REVIEW (any tenders.manage user)
 *  - reopen:    PENDING_REVIEW  → IN_PROGRESS (tenders.review required)
 *  - confirm:   PENDING_REVIEW  → WITHDRAWN + CONFIRMED (tenders.review required)
 *
 * Every action appends a TenderWithdrawalReview row (append-only ledger) and
 * writes an AuditService entry. Reviewer permission is checked in the service
 * (single seam) so both HTTP and any future scripted callers stay consistent.
 */
@Injectable()
export class WithdrawalReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Withdraw a DRAFT or ESTIMATING tender to WITHDRAWN (pending review).
   *
   * Idempotent: a tender already sitting at WITHDRAWN + PENDING_REVIEW returns
   * as-is without appending a duplicate ledger row.
   */
  async withdraw(tenderId: string, reason: string | undefined, actor: Actor) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, status: true, withdrawalState: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    if (tender.status === "WITHDRAWN" && tender.withdrawalState === "PENDING_REVIEW") {
      return this.detail(tenderId);
    }

    if (!WITHDRAWABLE_FROM.has(tender.status)) {
      throw new BadRequestException(
        `Withdraw is only available from Draft or Estimating (current: ${tender.status}).`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id: tenderId },
        data: { status: "WITHDRAWN", withdrawalState: "PENDING_REVIEW" }
      });
      await tx.tenderWithdrawalReview.create({
        data: {
          tenderId,
          decision: "WITHDRAWN",
          reviewerId: actor.sub,
          reason: reason ?? null
        }
      });
    });

    await this.audit.write({
      actorId: actor.sub,
      action: "tenders.withdraw",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { from: tender.status, reason: reason ?? null }
    });

    return this.detail(tenderId);
  }

  /**
   * Reviewer action — reopen a WITHDRAWN (pending review) tender back to
   * Estimating. Clears the withdrawalState. Requires tenders.review.
   */
  async reopen(tenderId: string, reason: string | undefined, actor: Actor) {
    this.assertReviewer(actor);

    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, status: true, withdrawalState: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    if (tender.status !== "WITHDRAWN" || tender.withdrawalState !== "PENDING_REVIEW") {
      throw new BadRequestException(
        "Only tenders in Withdrawn (pending review) can be reopened."
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id: tenderId },
        data: { status: "IN_PROGRESS", withdrawalState: null }
      });
      await tx.tenderWithdrawalReview.create({
        data: {
          tenderId,
          decision: "REOPENED",
          reviewerId: actor.sub,
          reason: reason ?? null
        }
      });
    });

    await this.audit.write({
      actorId: actor.sub,
      action: "tenders.withdrawal.reopen",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { reason: reason ?? null }
    });

    return this.detail(tenderId);
  }

  /**
   * Reviewer action — confirm a WITHDRAWN (pending review) tender.
   * Tender leaves the Pipeline board and shows only on the CRM Register.
   * Requires tenders.review.
   */
  async confirm(tenderId: string, reason: string | undefined, actor: Actor) {
    this.assertReviewer(actor);

    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, status: true, withdrawalState: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    if (tender.status !== "WITHDRAWN" || tender.withdrawalState !== "PENDING_REVIEW") {
      throw new BadRequestException(
        "Only tenders in Withdrawn (pending review) can be confirmed."
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id: tenderId },
        data: { withdrawalState: "CONFIRMED" }
      });
      await tx.tenderWithdrawalReview.create({
        data: {
          tenderId,
          decision: "CONFIRMED",
          reviewerId: actor.sub,
          reason: reason ?? null
        }
      });
    });

    await this.audit.write({
      actorId: actor.sub,
      action: "tenders.withdrawal.confirm",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { reason: reason ?? null }
    });

    return this.detail(tenderId);
  }

  /**
   * List the review history for one tender (newest-first) — surfaces the
   * ledger to the UI so a reviewer can see prior decisions before acting.
   */
  async listReviews(tenderId: string) {
    return this.prisma.tenderWithdrawalReview.findMany({
      where: { tenderId },
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  private assertReviewer(actor: Actor): void {
    if (actor.isSuperUser) return;
    if (actor.permissions?.includes("tenders.review")) return;
    throw new ForbiddenException(
      "You need the tenders.review permission to act on a withdrawn tender."
    );
  }

  private async detail(tenderId: string) {
    return this.prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: {
        id: true,
        tenderNumber: true,
        status: true,
        withdrawalState: true,
        updatedAt: true
      }
    });
  }
}
