import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AgreedRecordStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service";
import { JobSorSnapshotService } from "../schedule-of-rates/job-sor-snapshot.service";
import { EmailService } from "../email/email.service";

// ── Input types ───────────────────────────────────────────────────────────────

export type PriceLineInput = {
  /** If provided, reads the frozen rate from the AR's snapshot at this row. */
  snapshotRateId?: string | null;
  tier: string;
  /** Required when snapshotRateId is null (manual override). */
  rate?: number | string | null;
};

export type SendBackInput = {
  reason: string;
};

export type OfficeUpdateLineInput = {
  category?: "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
  resourceName?: string;
  class?: string | null;
  unit?: string | null;
  quantity?: number | string;
  tier?: string;
  notes?: string | null;
  sortOrder?: number;
};

// ── Notification trigger keys (must match migration upsert rows) ──────────────

const TRIGGER_AR_SUBMITTED = "agreed_record.submitted";
const TRIGGER_AR_PRICED = "agreed_record.priced_awaiting_ops";

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * SoR S8 — Agreed Record office review lane.
 *
 * Implements the state machine for WHS&CC and Ops Manager to:
 *   - Take a SUBMITTED AR into OFFICE_REVIEW (fires WHS&CC notification).
 *   - Correct resource lines while in OFFICE_REVIEW.
 *   - Price each line from the frozen Job SoR snapshot (or manual override),
 *     creating an AgreedRecordPricingLine.
 *   - Finalise pricing (OFFICE_REVIEW -> PRICED, fires Ops notification).
 *   - Approve (PRICED -> APPROVED); enforces reviewer != approver.
 *   - Send back (any office state -> SENT_BACK) with a mandatory reason.
 *   - List the review queue (SUBMITTED + OFFICE_REVIEW + PRICED).
 *
 * Permission: `rates.manage` (same as SoR rate-book management; enforced at
 * the controller). No new permission is introduced.
 *
 * Notification: reuses the existing EmailService.sendNotificationEmail seam —
 * reads the NotificationTriggerConfig rows seeded by the S8 migration and
 * dispatches without inventing a new dispatch layer.
 */
@Injectable()
export class AgreedRecordReviewService {
  private readonly logger = new Logger(AgreedRecordReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: JobSorSnapshotService,
    private readonly email: EmailService,
  ) {}

  // ── Review queue ──────────────────────────────────────────────────────────

  /**
   * Returns all ARs in office states (SUBMITTED, OFFICE_REVIEW, PRICED).
   * Ordered newest-first. No dollar-filtering — office callers are authorised
   * to see pricing.
   */
  async getReviewQueue() {
    return this.prisma.agreedRecord.findMany({
      where: {
        status: {
          in: [
            AgreedRecordStatus.SUBMITTED,
            AgreedRecordStatus.OFFICE_REVIEW,
            AgreedRecordStatus.PRICED,
          ],
        },
      },
      orderBy: { submittedAt: "desc" },
      include: this.officeIncludeShape(),
    });
  }

  // ── Take into review ──────────────────────────────────────────────────────

  /**
   * SUBMITTED -> OFFICE_REVIEW.
   *
   * Stamps reviewerId + reviewStartedAt. Fires the WHS&CC notification
   * (agreed_record.submitted trigger) so the reviewer's colleagues know
   * someone has picked it up.
   *
   * Idempotent if already OFFICE_REVIEW by the same reviewer — returns the
   * record unchanged. Throws if already in any other non-SUBMITTED state.
   */
  async takeReview(id: string, actorId: string) {
    const ar = await this.requireAr(id);
    if (ar.status === AgreedRecordStatus.OFFICE_REVIEW) {
      return ar; // idempotent
    }
    if (ar.status !== AgreedRecordStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot take review on AR ${id}: expected SUBMITTED, got ${ar.status}.`,
      );
    }

    const updated = await this.prisma.agreedRecord.update({
      where: { id },
      data: {
        status: AgreedRecordStatus.OFFICE_REVIEW,
        reviewerId: actorId,
        reviewStartedAt: new Date(),
      },
      include: this.officeIncludeShape(),
    });

    // Fire notification — never throws (email is a side-effect).
    this.fireNotification(TRIGGER_AR_SUBMITTED, {
      subject: `AR ${ar.recordNumber} taken into office review`,
      body: `Agreed Record ${ar.recordNumber} has been taken into office review by a WHS & CC officer.`,
    });

    return updated;
  }

  // ── Office line correction ────────────────────────────────────────────────

  /**
   * PATCH agreed-records/:id/lines/:lineId — office correction to a captured
   * line (resource / class / unit / quantity / tier). Legal while OFFICE_REVIEW.
   */
  async updateLine(
    arId: string,
    lineId: string,
    input: OfficeUpdateLineInput,
  ) {
    const ar = await this.requireAr(arId);
    if (ar.status !== AgreedRecordStatus.OFFICE_REVIEW) {
      throw new BadRequestException(
        `Office line corrections are only allowed in OFFICE_REVIEW status (AR ${arId} is ${ar.status}).`,
      );
    }

    const existing = await this.prisma.agreedRecordLine.findUnique({
      where: { id: lineId },
    });
    if (!existing || existing.agreedRecordId !== arId) {
      throw new NotFoundException(`AgreedRecordLine ${lineId} not found on AR ${arId}.`);
    }

    const quantity =
      input.quantity !== undefined
        ? this.toDecimal(input.quantity, "quantity")
        : existing.quantity;

    return this.prisma.agreedRecordLine.update({
      where: { id: lineId },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.resourceName !== undefined && { resourceName: input.resourceName }),
        ...(input.class !== undefined && { class: input.class }),
        ...(input.unit !== undefined && { unit: input.unit }),
        quantity,
        ...(input.tier !== undefined && { tier: input.tier }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });
  }

  // ── Price a line ──────────────────────────────────────────────────────────

  /**
   * POST agreed-records/:id/lines/:lineId/price
   *
   * Reads the FROZEN rate from the AR's jobSorSnapshotId via S4's helper.
   * Creates (or replaces) the AgreedRecordPricingLine.
   *
   * Manual override (snapshotRateId == null) requires an explicit `rate` in
   * the body — stamps snapshotRateId = null.
   */
  async priceLine(
    arId: string,
    lineId: string,
    input: PriceLineInput,
    actorId: string,
  ) {
    const ar = await this.requireAr(arId);
    if (ar.status !== AgreedRecordStatus.OFFICE_REVIEW) {
      throw new BadRequestException(
        `Pricing is only allowed in OFFICE_REVIEW status (AR ${arId} is ${ar.status}).`,
      );
    }

    const line = await this.prisma.agreedRecordLine.findUnique({
      where: { id: lineId },
    });
    if (!line || line.agreedRecordId !== arId) {
      throw new NotFoundException(`AgreedRecordLine ${lineId} not found on AR ${arId}.`);
    }

    let rate: Decimal;

    if (input.snapshotRateId) {
      // Read from the frozen snapshot — never from live SorRate.
      if (!ar.jobSorSnapshotId) {
        throw new BadRequestException(
          `AR ${arId} has no job SoR snapshot; cannot price from snapshot.`,
        );
      }
      const snapshotRate = await this.snapshots.getLockedRate(
        ar.jobSorSnapshotId,
        input.snapshotRateId,
      );
      // Resolve the requested tier column.
      rate = this.resolveTierRate(snapshotRate, input.tier);
    } else {
      // Manual override — explicit rate required.
      if (input.rate == null) {
        throw new BadRequestException(
          "Manual override (no snapshotRateId) requires an explicit `rate` value.",
        );
      }
      rate = new Decimal(String(input.rate));
      if (rate.isNaN() || !rate.isFinite()) {
        throw new BadRequestException(`Invalid rate value: ${String(input.rate)}`);
      }
    }

    const lineAmount = rate.mul(line.quantity);

    // Upsert the pricing line (unique on agreedRecordLineId).
    return this.prisma.agreedRecordPricingLine.upsert({
      where: { agreedRecordLineId: lineId },
      create: {
        agreedRecordLineId: lineId,
        snapshotRateId: input.snapshotRateId ?? null,
        tier: input.tier,
        rate,
        lineAmount,
        pricedById: actorId,
        pricedAt: new Date(),
      },
      update: {
        snapshotRateId: input.snapshotRateId ?? null,
        tier: input.tier,
        rate,
        lineAmount,
        pricedById: actorId,
        pricedAt: new Date(),
      },
    });
  }

  // ── Finalise pricing ──────────────────────────────────────────────────────

  /**
   * POST agreed-records/:id/finalise-pricing
   *
   * Recomputes totalPricedAmount = SUM of all pricing line amounts.
   * Transitions OFFICE_REVIEW -> PRICED.
   * Fires the Ops notification (agreed_record.priced_awaiting_ops).
   *
   * Requires ALL lines to have a pricing record.
   */
  async finalisePricing(id: string) {
    const ar = await this.requireAr(id);
    if (ar.status !== AgreedRecordStatus.OFFICE_REVIEW) {
      throw new BadRequestException(
        `Cannot finalise pricing on AR ${id}: expected OFFICE_REVIEW, got ${ar.status}.`,
      );
    }

    // Verify every line has a pricing row.
    const lineCount = await this.prisma.agreedRecordLine.count({
      where: { agreedRecordId: id },
    });
    const pricedCount = await this.prisma.agreedRecordPricingLine.count({
      where: { agreedRecordLine: { agreedRecordId: id } },
    });
    if (lineCount === 0) {
      throw new BadRequestException(
        `AR ${id} has no lines; cannot finalise pricing.`,
      );
    }
    if (pricedCount < lineCount) {
      throw new BadRequestException(
        `AR ${id} has ${lineCount} lines but only ${pricedCount} are priced. Price all lines before finalising.`,
      );
    }

    // Sum all line amounts.
    const pricingLines = await this.prisma.agreedRecordPricingLine.findMany({
      where: { agreedRecordLine: { agreedRecordId: id } },
      select: { lineAmount: true },
    });
    const total = pricingLines.reduce(
      (acc, pl) => acc.add(pl.lineAmount),
      new Decimal(0),
    );

    const updated = await this.prisma.agreedRecord.update({
      where: { id },
      data: {
        status: AgreedRecordStatus.PRICED,
        totalPricedAmount: total,
      },
      include: this.officeIncludeShape(),
    });

    // Fire Ops notification — never throws.
    this.fireNotification(TRIGGER_AR_PRICED, {
      subject: `AR ${ar.recordNumber} priced — awaiting Ops sign-off`,
      body: `Agreed Record ${ar.recordNumber} has been priced at $${total.toFixed(2)} and is awaiting Operations Manager approval.`,
    });

    return updated;
  }

  // ── Approve ───────────────────────────────────────────────────────────────

  /**
   * POST agreed-records/:id/approve
   *
   * PRICED -> APPROVED. Records approvedById + approvedAt.
   *
   * Guard: approvedById must differ from every pricedById on the AR's pricing
   * lines — enforces the "whoever prices cannot approve" separation.
   */
  async approve(id: string, actorId: string) {
    const ar = await this.requireAr(id);
    if (ar.status !== AgreedRecordStatus.PRICED) {
      throw new BadRequestException(
        `Cannot approve AR ${id}: expected PRICED, got ${ar.status}.`,
      );
    }

    // Collect all unique pricedByIds across pricing lines.
    const pricingLines = await this.prisma.agreedRecordPricingLine.findMany({
      where: { agreedRecordLine: { agreedRecordId: id } },
      select: { pricedById: true },
    });
    const pricerIds = new Set(
      pricingLines.map((pl) => pl.pricedById).filter((v): v is string => v !== null),
    );

    if (pricerIds.has(actorId)) {
      throw new ForbiddenException(
        `User ${actorId} priced one or more lines on AR ${id} and cannot also approve it (separation of duties).`,
      );
    }

    return this.prisma.agreedRecord.update({
      where: { id },
      data: {
        status: AgreedRecordStatus.APPROVED,
        approvedById: actorId,
        approvedAt: new Date(),
      },
      include: this.officeIncludeShape(),
    });
  }

  // ── Send back ─────────────────────────────────────────────────────────────

  /**
   * POST agreed-records/:id/send-back
   *
   * Any office state (OFFICE_REVIEW, PRICED) -> SENT_BACK.
   * Stamps sentBackReason. The AR returns to the worker view (S7).
   */
  async sendBack(id: string, input: SendBackInput) {
    const ar = await this.requireAr(id);

    const officeStates: AgreedRecordStatus[] = [
      AgreedRecordStatus.OFFICE_REVIEW,
      AgreedRecordStatus.PRICED,
    ];
    if (!officeStates.includes(ar.status)) {
      throw new BadRequestException(
        `Cannot send back AR ${id}: must be in OFFICE_REVIEW or PRICED status (currently ${ar.status}).`,
      );
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new BadRequestException("A reason is required when sending back an Agreed Record.");
    }

    return this.prisma.agreedRecord.update({
      where: { id },
      data: {
        status: AgreedRecordStatus.SENT_BACK,
        sentBackReason: input.reason.trim(),
      },
      include: this.officeIncludeShape(),
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async requireAr(id: string) {
    const ar = await this.prisma.agreedRecord.findUnique({
      where: { id },
      include: this.officeIncludeShape(),
    });
    if (!ar) throw new NotFoundException(`Agreed Record ${id} not found.`);
    return ar;
  }

  private officeIncludeShape() {
    return {
      lines: {
        orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
        include: { pricing: true },
      },
      attachments: {
        orderBy: [{ uploadedAt: "asc" as const }],
      },
    };
  }

  /**
   * Resolve the monetary rate for a given tier from a frozen snapshot rate row.
   * Tier tokens: ORDINARY | ONE_AND_HALF | DOUBLE
   */
  private resolveTierRate(
    snapshotRate: {
      ordinary: Decimal | null;
      oneAndHalf: Decimal | null;
      double: Decimal | null;
    },
    tier: string,
  ): Decimal {
    let raw: Decimal | null;
    if (tier === "ONE_AND_HALF") {
      raw = snapshotRate.oneAndHalf;
    } else if (tier === "DOUBLE") {
      raw = snapshotRate.double;
    } else {
      raw = snapshotRate.ordinary;
    }
    if (raw == null) {
      throw new BadRequestException(
        `Snapshot rate has no value for tier "${tier}". Choose a different tier or use a manual override.`,
      );
    }
    return raw;
  }

  /**
   * Fire a notification via the existing email seam. Never throws — email
   * failures are side-effects that must not break the primary write path.
   */
  private fireNotification(trigger: string, opts: { subject: string; body: string }) {
    this.email
      .sendNotificationEmail({
        trigger,
        subject: opts.subject,
        html: `<p>${opts.body}</p>`,
        text: opts.body,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`notification ${trigger} failed: ${msg}`);
      });
  }

  private toDecimal(value: number | string, field: string) {
    try {
      const num = Number(value);
      if (isNaN(num)) throw new Error("not a number");
      return value;
    } catch {
      throw new BadRequestException(`Invalid ${field}: ${String(value)}`);
    }
  }
}
