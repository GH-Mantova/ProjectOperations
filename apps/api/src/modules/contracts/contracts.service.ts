import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClaimStatus, ContractStatus, PaymentScheduleStatus, Prisma, VariationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../platform/notifications.service";
import { adjustToPrecedingWorkday, isAustralianPublicHoliday } from "./public-holidays";

const CONTRACT_SEQ_ID = 1;
// PR A1 (2026-05-16) — 4-code discipline system (DEM/CIV/ASB/Other).
const DISCIPLINE_ORDER = ["DEM", "CIV", "ASB", "Other"] as const;
// AU Security of Payment Act — fallback statutory response window in
// BUSINESS days. Used only when OperationsSettings.sopaResponseDays is
// NULL. QLD BIF Act = 15 business days; NSW/VIC SOPA = 10. Admin sets
// the tenant's value via the Operations Settings singleton.
const SOPA_DEFAULT_RESPONSE_DAYS = 15;

type Actor = { id: string; permissions: ReadonlySet<string> };

const VARIATION_TRANSITIONS: Record<VariationStatus, VariationStatus[]> = {
  RECEIVED: ["PRICED"],
  PRICED: ["SUBMITTED"],
  SUBMITTED: ["APPROVED"],
  APPROVED: []
};

/**
 * Business logic for contracts, variations, and progress claims (Module 7).
 *
 * Auto-assigns sequential IS-C### / IS-V### / IS-PC### numbers from
 * dedicated sequence tables, enforces variation status transitions
 * (RECEIVED→PRICED→SUBMITTED→APPROVED) and claim transitions
 * (DRAFT→SUBMITTED→APPROVED→PAID), and runs a daily cron that sends claim
 * cut-off reminders (in-app notification + email) one week before each
 * client's cut-off date, rolled back to the preceding QLD work day.
 */
@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  // ── Contracts ────────────────────────────────────────────────────────
  /**
   * List contracts with project + client info, filterable by status and
   * projectId.
   *
   * `limit` takes precedence over `pageSize`; the effective page size is
   * clamped to 1–100 and defaults to 20.
   *
   * @param filter - status / projectId filters plus page, pageSize, limit
   * @returns { items, total, page, pageSize, limit } newest first
   */
  async listContracts(filter: {
    status?: ContractStatus;
    projectId?: string;
    page?: number;
    pageSize?: number;
    limit?: number;
  }) {
    const where = {
      status: filter.status,
      projectId: filter.projectId
    };
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.limit ?? filter.pageSize ?? 20));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        include: {
          project: { select: { id: true, projectNumber: true, name: true, client: { select: { id: true, name: true } } } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.contract.count({ where })
    ]);
    return { items, total, page, pageSize, limit: pageSize };
  }

  /**
   * Get a contract with project/client, variations (by variation number),
   * and progress-claim headers (most recent claim month first).
   *
   * @param id - contract id
   * @returns the full contract aggregate
   * @throws NotFoundException when the contract does not exist
   */
  async getContract(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        project: { include: { client: true } },
        variations: { orderBy: { variationNumber: "asc" } },
        progressClaims: {
          orderBy: { claimMonth: "desc" },
          select: {
            id: true,
            claimNumber: true,
            claimMonth: true,
            status: true,
            totalClaimed: true,
            totalApproved: true,
            totalPaid: true,
            submissionDate: true,
            retentionHeld: true,
            paymentSchedule: {
              select: { id: true, status: true, dueBy: true, scheduledAmount: true, respondedAt: true }
            }
          }
        }
      }
    });
    if (!contract) throw new NotFoundException("Contract not found.");
    return contract;
  }

  /**
   * Create the single contract for a project with an auto-assigned
   * sequential IS-C### contract number.
   *
   * retentionPct defaults to 0 when omitted.
   *
   * @param actorId - user id stored as createdById
   * @param dto - projectId, contractValue, optional retentionPct / dates / notes
   * @returns the created contract with project and client included
   * @throws NotFoundException when the project does not exist
   * @throws ConflictException when the project already has a contract
   */
  async createContract(
    actorId: string,
    dto: { projectId: string; contractValue: number; retentionPct?: number; startDate?: string; endDate?: string; notes?: string }
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId }, select: { id: true, contract: { select: { id: true } } } });
    if (!project) throw new NotFoundException("Project not found.");
    if (project.contract) throw new ConflictException("This project already has a contract.");
    const contractNumber = await this.nextContractNumber();
    // Pin the currently-active T&C version at contract creation. Editing
    // T&Cs later creates a new version; this FK still points at the old
    // one so the executed contract forever renders the terms in force
    // when it was signed. See ADR: legal-doc-versioning.
    const activeTerms = await this.prisma.companyLegalDocument.findFirst({
      where: { type: "TERMS_AND_CONDITIONS", isActive: true },
      orderBy: { version: "desc" },
      select: { id: true }
    });
    return this.prisma.contract.create({
      data: {
        projectId: dto.projectId,
        contractNumber,
        contractValue: new Prisma.Decimal(dto.contractValue),
        retentionPct: dto.retentionPct !== undefined ? new Prisma.Decimal(dto.retentionPct) : new Prisma.Decimal(0),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: dto.notes ?? null,
        createdById: actorId,
        issuedTermsDocumentId: activeTerms?.id ?? null
      },
      include: { project: { include: { client: true } } }
    });
  }

  /**
   * Update a contract; only actors holding `finance.admin` may change
   * contractValue after creation.
   *
   * Passing null for startDate / endDate clears the field; undefined
   * leaves it unchanged.
   *
   * @param id - contract id
   * @param actor - acting user id + permission set used for the finance.admin check
   * @param dto - partial contract fields
   * @returns the updated contract
   * @throws NotFoundException when the contract does not exist
   * @throws BadRequestException when contractValue is changed without finance.admin
   */
  async updateContract(
    id: string,
    actor: Actor,
    dto: { contractValue?: number; retentionPct?: number; startDate?: string | null; endDate?: string | null; status?: ContractStatus; notes?: string | null }
  ) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contract not found.");
    if (dto.contractValue !== undefined && !actor.permissions.has("finance.admin")) {
      throw new BadRequestException("Only finance.admin can change contractValue after creation.");
    }
    return this.prisma.contract.update({
      where: { id },
      data: {
        contractValue: dto.contractValue !== undefined ? new Prisma.Decimal(dto.contractValue) : undefined,
        retentionPct: dto.retentionPct !== undefined ? new Prisma.Decimal(dto.retentionPct) : undefined,
        startDate: dto.startDate === null ? null : dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate === null ? null : dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
        notes: dto.notes
      }
    });
  }

  // ── Variations ───────────────────────────────────────────────────────
  /**
   * List variations for a contract ordered by variation number.
   *
   * @param contractId - contract id (must exist)
   * @returns the contract's variations
   * @throws NotFoundException when the contract does not exist
   */
  async listVariations(contractId: string) {
    await this.requireContract(contractId);
    return this.prisma.variation.findMany({
      where: { contractId },
      orderBy: { variationNumber: "asc" }
    });
  }

  /**
   * Create a variation on a contract with an auto-assigned sequential
   * IS-V### number; status starts at RECEIVED.
   *
   * receivedDate defaults to now when omitted.
   *
   * @param contractId - contract id (must exist)
   * @param actorId - user id stored as createdById
   * @param dto - description plus optional requestedBy / pricedAmount / receivedDate / notes
   * @returns the created variation
   * @throws NotFoundException when the contract does not exist
   */
  async createVariation(
    contractId: string,
    actorId: string,
    dto: { description: string; requestedBy?: string; pricedAmount?: number; receivedDate?: string; notes?: string }
  ) {
    await this.requireContract(contractId);
    const variationNumber = await this.nextVariationNumber();
    return this.prisma.variation.create({
      data: {
        contractId,
        variationNumber,
        description: dto.description,
        requestedBy: dto.requestedBy ?? null,
        pricedAmount: dto.pricedAmount !== undefined ? new Prisma.Decimal(dto.pricedAmount) : null,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
        notes: dto.notes ?? null,
        createdById: actorId
      }
    });
  }

  /**
   * Update a variation, enforcing the one-way status flow
   * RECEIVED→PRICED→SUBMITTED→APPROVED.
   *
   * Side effect: when transitioning to APPROVED and an active DRAFT claim
   * exists for the contract, a new "Variation" line item is appended to
   * that claim — but only if approvedAmount is set on the variation.
   *
   * @param contractId - contract the variation must belong to
   * @param variationId - variation id to update
   * @param dto - partial variation fields including optional status change
   * @returns the updated variation
   * @throws NotFoundException when the variation is missing or on another contract
   * @throws BadRequestException when the status transition is not allowed
   */
  async updateVariation(
    contractId: string,
    variationId: string,
    dto: {
      description?: string;
      status?: VariationStatus;
      pricedAmount?: number;
      approvedAmount?: number;
      pricedDate?: string;
      submittedDate?: string;
      approvedDate?: string;
      notes?: string | null;
    }
  ) {
    const existing = await this.prisma.variation.findUnique({ where: { id: variationId } });
    if (!existing || existing.contractId !== contractId) throw new NotFoundException("Variation not found.");
    if (dto.status && dto.status !== existing.status) {
      const allowed = VARIATION_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Variation status ${existing.status} can only transition to ${allowed.join(", ") || "(none)"}.`
        );
      }
    }
    const patch: Prisma.VariationUpdateInput = {
      description: dto.description,
      status: dto.status,
      pricedAmount: dto.pricedAmount !== undefined ? new Prisma.Decimal(dto.pricedAmount) : undefined,
      approvedAmount: dto.approvedAmount !== undefined ? new Prisma.Decimal(dto.approvedAmount) : undefined,
      pricedDate: dto.pricedDate ? new Date(dto.pricedDate) : undefined,
      submittedDate: dto.submittedDate ? new Date(dto.submittedDate) : undefined,
      approvedDate: dto.approvedDate ? new Date(dto.approvedDate) : undefined,
      notes: dto.notes
    };
    const updated = await this.prisma.variation.update({ where: { id: variationId }, data: patch });

    // On APPROVED: if there's an active DRAFT claim for this contract, add
    // the variation as a new line item so it flows into the next claim run.
    if (dto.status === VariationStatus.APPROVED && existing.status !== VariationStatus.APPROVED) {
      const draft = await this.prisma.progressClaim.findFirst({
        where: { contractId, status: ClaimStatus.DRAFT },
        orderBy: { claimMonth: "desc" }
      });
      if (draft && updated.approvedAmount) {
        await this.prisma.claimLineItem.create({
          data: {
            claimId: draft.id,
            discipline: "Variation",
            description: `VAR ${updated.variationNumber} — ${updated.description}`.slice(0, 500),
            contractValue: updated.approvedAmount,
            previouslyClaimed: new Prisma.Decimal(0),
            thisClaimAmount: new Prisma.Decimal(0),
            variationId: updated.id,
            sortOrder: 1000 + (await this.prisma.claimLineItem.count({ where: { claimId: draft.id } }))
          }
        });
      }
    }
    return updated;
  }

  // ── Progress claims ──────────────────────────────────────────────────
  /**
   * List progress claims for a contract, most recent claim month first.
   *
   * @param contractId - contract id (must exist)
   * @returns progress-claim records without line items
   * @throws NotFoundException when the contract does not exist
   */
  async listClaims(contractId: string) {
    await this.requireContract(contractId);
    return this.prisma.progressClaim.findMany({
      where: { contractId },
      orderBy: { claimMonth: "desc" }
    });
  }

  /**
   * Get a progress claim with line items (by sortOrder) and its contract.
   *
   * @param contractId - contract the claim must belong to
   * @param claimId - progress-claim id
   * @returns the claim with lineItems and contract included
   * @throws NotFoundException when the claim is missing or on another contract
   */
  async getClaim(contractId: string, claimId: string) {
    const claim = await this.prisma.progressClaim.findUnique({
      where: { id: claimId },
      include: {
        lineItems: { orderBy: [{ sortOrder: "asc" }] },
        contract: true,
        paymentSchedule: true
      }
    });
    if (!claim || claim.contractId !== contractId) throw new NotFoundException("Claim not found.");
    return this.decoratePaymentScheduleStatus(claim);
  }

  // ── Payment schedule (AU Security of Payment) ────────────────────────
  /**
   * Create or update the AU Security of Payment payment-schedule response
   * for a progress claim.
   *
   * Statutory intent: if the respondent does not issue a schedule within
   * the state-defined window (OperationsSettings.sopaResponseDays, or
   * SOPA_DEFAULT_RESPONSE_DAYS when unset — 15 QLD business days) the
   * FULL claimed amount is payable. `dueBy` is computed at record
   * creation from the claim's submissionDate (or claimMonth) plus that
   * many BUSINESS days, then rolled BACK to the preceding QLD workday
   * per the existing holiday helper, and STORED so a later settings
   * change does not retro-mutate an already-issued schedule.
   *
   * @param contractId - contract the claim must belong to
   * @param claimId    - progress-claim id
   * @param actorId    - user id stored as createdById on first insert
   * @param dto        - scheduledAmount + optional reasons; passing
   *                     `respondedAt` (or omitting when scheduledAmount
   *                     is set) marks the schedule ISSUED.
   * @throws NotFoundException when the claim is missing or on another contract
   * @throws BadRequestException when scheduledAmount is negative
   */
  async upsertPaymentSchedule(
    contractId: string,
    claimId: string,
    actorId: string,
    dto: { scheduledAmount: number; reasons?: string | null; respondedAt?: string | null }
  ) {
    if (dto.scheduledAmount < 0) {
      throw new BadRequestException("scheduledAmount must be >= 0.");
    }
    const claim = await this.prisma.progressClaim.findUnique({
      where: { id: claimId },
      include: { paymentSchedule: true }
    });
    if (!claim || claim.contractId !== contractId) throw new NotFoundException("Claim not found.");

    const existing = claim.paymentSchedule;
    const respondedAt = dto.respondedAt === null
      ? null
      : dto.respondedAt
        ? new Date(dto.respondedAt)
        : existing?.respondedAt ?? new Date();
    const status: PaymentScheduleStatus = respondedAt ? PaymentScheduleStatus.ISSUED : PaymentScheduleStatus.PENDING;
    const scheduledAmount = new Prisma.Decimal(dto.scheduledAmount);
    const reasons = dto.reasons === undefined ? existing?.reasons ?? null : dto.reasons;

    if (existing) {
      // Preserve the originally-computed dueBy — later setting changes
      // must not retro-mutate the statutory window on an already-issued
      // schedule (see model comment).
      return this.prisma.paymentSchedule.update({
        where: { id: existing.id },
        data: { scheduledAmount, reasons, status, respondedAt }
      });
    }
    const responseDays = await this.getSopaResponseDays();
    const anchor = claim.submissionDate ?? claim.claimMonth;
    const dueBy = adjustToPrecedingWorkday(addBusinessDays(anchor, responseDays));
    return this.prisma.paymentSchedule.create({
      data: {
        progressClaimId: claimId,
        scheduledAmount,
        reasons,
        status,
        dueBy,
        respondedAt,
        createdById: actorId
      }
    });
  }

  /**
   * Compute the effective SOPA response window (business days). Reads
   * `OperationsSettings.sopaResponseDays` (singleton) and falls back to
   * `SOPA_DEFAULT_RESPONSE_DAYS` when unset — the singleton row is
   * created on first read by the admin-settings service.
   */
  async getSopaResponseDays(): Promise<number> {
    const settings = await this.prisma.operationsSettings.findUnique({
      where: { id: "singleton" },
      select: { sopaResponseDays: true }
    });
    return settings?.sopaResponseDays ?? SOPA_DEFAULT_RESPONSE_DAYS;
  }

  /**
   * Return the claim with paymentSchedule.status flipped to OVERDUE for
   * read-side rendering when the stored dueBy has passed and no response
   * has been recorded. The DB value stays PENDING so an admin still sees
   * that no schedule has been issued; a nightly job can persist OVERDUE
   * separately once the alerting requirement lands.
   */
  private decoratePaymentScheduleStatus<T extends { paymentSchedule: { status: PaymentScheduleStatus; dueBy: Date; respondedAt: Date | null } | null }>(
    claim: T
  ): T {
    const ps = claim.paymentSchedule;
    if (ps && !ps.respondedAt && ps.status === PaymentScheduleStatus.PENDING && ps.dueBy.getTime() < Date.now()) {
      return { ...claim, paymentSchedule: { ...ps, status: PaymentScheduleStatus.OVERDUE } };
    }
    return claim;
  }

  /**
   * Create a DRAFT progress claim for a month with an auto-assigned
   * sequential IS-PC### number.
   *
   * claimMonth is normalised to the first of the month (UTC). Line items
   * are auto-populated from the linked tender's scope-discipline subtotals
   * (DEM/CIV/ASB at marked-up estimate prices, Other at provisional sums),
   * with previouslyClaimed rolled up from APPROVED/PAID claims, plus one
   * line per APPROVED variation not already on a prior claim.
   *
   * @param contractId - contract id (must exist)
   * @param actorId - user id stored as createdById
   * @param dto - claimMonth as an ISO date string
   * @returns the created DRAFT claim with line items
   * @throws NotFoundException when the contract does not exist
   * @throws ConflictException when a claim already exists for this contract + month
   */
  async createClaim(contractId: string, actorId: string, dto: { claimMonth: string }) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { project: true }
    });
    if (!contract) throw new NotFoundException("Contract not found.");

    const claimMonth = startOfMonth(new Date(dto.claimMonth));
    const clash = await this.prisma.progressClaim.findFirst({
      where: { contractId, claimMonth }
    });
    if (clash) throw new ConflictException("A claim already exists for this contract + month.");

    const claimNumber = await this.nextClaimNumber();

    // Build line items from scope summary of the linked tender (project.sourceTenderId)
    // plus all APPROVED variations not yet on a previous claim.
    const tenderId = contract.project.sourceTenderId;
    const disciplineSubtotals = tenderId ? await this.scopeDisciplineSubtotals(tenderId) : {};
    // Previously-claimed by discipline across APPROVED claims for this contract.
    const priorClaims = await this.prisma.progressClaim.findMany({
      where: { contractId, status: { in: [ClaimStatus.APPROVED, ClaimStatus.PAID] } },
      include: { lineItems: true }
    });
    const priorByDiscipline: Record<string, number> = {};
    for (const c of priorClaims) {
      for (const li of c.lineItems) {
        if (!li.discipline) continue;
        priorByDiscipline[li.discipline] = (priorByDiscipline[li.discipline] ?? 0) + Number(li.thisClaimAmount);
      }
    }

    // Approved variations not already on any prior claim line.
    const priorVariationIds = new Set(
      priorClaims.flatMap((c) => c.lineItems.map((li) => li.variationId).filter((v): v is string => !!v))
    );
    const approvedVariations = await this.prisma.variation.findMany({
      where: {
        contractId,
        status: VariationStatus.APPROVED,
        id: { notIn: Array.from(priorVariationIds) }
      }
    });

    const lineItemCreates: Prisma.ClaimLineItemCreateWithoutClaimInput[] = [];
    DISCIPLINE_ORDER.forEach((d, i) => {
      const subtotal = disciplineSubtotals[d] ?? 0;
      if (subtotal === 0) return;
      lineItemCreates.push({
        discipline: d,
        description: describeDiscipline(d),
        contractValue: new Prisma.Decimal(subtotal),
        previouslyClaimed: new Prisma.Decimal(priorByDiscipline[d] ?? 0),
        thisClaimAmount: new Prisma.Decimal(0),
        sortOrder: i
      });
    });
    approvedVariations.forEach((v, i) => {
      lineItemCreates.push({
        discipline: "Variation",
        description: `VAR ${v.variationNumber} — ${v.description}`.slice(0, 500),
        contractValue: v.approvedAmount ?? new Prisma.Decimal(0),
        previouslyClaimed: new Prisma.Decimal(0),
        thisClaimAmount: new Prisma.Decimal(0),
        variation: { connect: { id: v.id } },
        sortOrder: 1000 + i
      });
    });

    return this.prisma.progressClaim.create({
      data: {
        contractId,
        claimNumber,
        claimMonth,
        status: ClaimStatus.DRAFT,
        createdById: actorId,
        lineItems: { create: lineItemCreates }
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } }
    });
  }

  /**
   * Update a claim line item and recompute the claim's totalClaimed.
   *
   * thisClaimPct triggers a server-side amount calculation
   * (contractValue × pct / 100, 2 d.p.); thisClaimAmount overrides the
   * amount and clears the pct. If both are sent, the amount wins.
   *
   * @param contractId - contract the claim must belong to
   * @param claimId - progress-claim id
   * @param itemId - line item id
   * @param dto - thisClaimPct, thisClaimAmount, and/or description
   * @returns the full claim after totals are recomputed
   * @throws NotFoundException when the line item is missing or not on this claim/contract
   */
  async updateClaimItem(
    contractId: string,
    claimId: string,
    itemId: string,
    dto: { thisClaimPct?: number; thisClaimAmount?: number; description?: string }
  ) {
    const item = await this.prisma.claimLineItem.findUnique({ where: { id: itemId }, include: { claim: true } });
    if (!item || item.claim.contractId !== contractId || item.claim.id !== claimId) {
      throw new NotFoundException("Line item not found.");
    }
    // If pct provided, calculate amount server-side. Direct amount override wins if both are sent.
    let nextAmount = item.thisClaimAmount;
    let nextPct = item.thisClaimPct;
    if (dto.thisClaimPct !== undefined) {
      nextPct = new Prisma.Decimal(dto.thisClaimPct);
      nextAmount = new Prisma.Decimal(
        ((Number(item.contractValue) * dto.thisClaimPct) / 100).toFixed(2)
      );
    }
    if (dto.thisClaimAmount !== undefined) {
      nextAmount = new Prisma.Decimal(dto.thisClaimAmount);
      nextPct = null; // manual override clears the pct
    }
    await this.prisma.claimLineItem.update({
      where: { id: itemId },
      data: {
        thisClaimPct: nextPct ?? null,
        thisClaimAmount: nextAmount,
        description: dto.description
      }
    });
    // Recompute claim total.
    const allItems = await this.prisma.claimLineItem.findMany({ where: { claimId } });
    const total = allItems.reduce((s, li) => s + Number(li.thisClaimAmount), 0);
    await this.prisma.progressClaim.update({
      where: { id: claimId },
      data: { totalClaimed: new Prisma.Decimal(total.toFixed(2)) }
    });
    return this.getClaim(contractId, claimId);
  }

  /**
   * Submit a DRAFT claim: sets status=SUBMITTED with submissionDate=now.
   *
   * Side effect: fires a claim.submitted notification email
   * (fire-and-forget — failures do not roll back the status change).
   *
   * @param contractId - contract the claim must belong to
   * @param claimId - progress-claim id
   * @returns the claim transitioned to SUBMITTED
   * @throws NotFoundException when the claim is missing or on another contract
   * @throws BadRequestException when the claim is not in DRAFT status
   */
  async submitClaim(contractId: string, claimId: string) {
    const claim = await this.getClaim(contractId, claimId);
    if (claim.status !== ClaimStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT claims can be submitted.");
    }
    const updated = await this.prisma.progressClaim.update({
      where: { id: claimId },
      data: { status: ClaimStatus.SUBMITTED, submissionDate: new Date() }
    });
    void this.email.sendNotificationEmail({
      trigger: "claim.submitted",
      subject: `Progress claim submitted — ${updated.claimNumber}`,
      html: `<p>Progress claim <strong>${updated.claimNumber}</strong> for contract ${claim.contract.contractNumber} has been submitted.</p>`,
      text: `Claim ${updated.claimNumber} submitted.`
    });
    return updated;
  }

  /**
   * Approve a SUBMITTED claim, computing
   * retentionHeld = totalApproved × contract.retentionPct / 100 (2 d.p.).
   *
   * @param contractId - contract the claim must belong to
   * @param claimId - progress-claim id
   * @param dto - totalApproved amount
   * @returns the claim transitioned to APPROVED
   * @throws NotFoundException when the claim is missing or on another contract
   * @throws BadRequestException when the claim is not in SUBMITTED status
   */
  async approveClaim(contractId: string, claimId: string, dto: { totalApproved: number }) {
    const claim = await this.getClaim(contractId, claimId);
    if (claim.status !== ClaimStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED claims can be approved.");
    }
    const retentionPct = Number(claim.contract.retentionPct);
    const retentionHeld = Number((dto.totalApproved * retentionPct / 100).toFixed(2));
    return this.prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.APPROVED,
        totalApproved: new Prisma.Decimal(dto.totalApproved),
        retentionHeld: new Prisma.Decimal(retentionHeld)
      }
    });
  }

  /**
   * Record payment on an APPROVED claim: sets status=PAID with totalPaid
   * and paidDate.
   *
   * @param contractId - contract the claim must belong to
   * @param claimId - progress-claim id
   * @param dto - totalPaid amount and paidDate ISO string
   * @returns the claim transitioned to PAID
   * @throws NotFoundException when the claim is missing or on another contract
   * @throws BadRequestException when the claim is not in APPROVED status
   */
  async payClaim(contractId: string, claimId: string, dto: { totalPaid: number; paidDate: string }) {
    const claim = await this.getClaim(contractId, claimId);
    if (claim.status !== ClaimStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED claims can be paid.");
    }
    return this.prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: ClaimStatus.PAID,
        totalPaid: new Prisma.Decimal(dto.totalPaid),
        paidDate: new Date(dto.paidDate)
      }
    });
  }

  // ── Claim cut-off cron ───────────────────────────────────────────────
  /** Run daily at 7am AEST (UTC+10, cron in UTC = 21:00). */
  @Cron("0 21 * * *", { name: "claim-cutoff-reminders", timeZone: "UTC" })
  async runClaimCutoffReminders() {
    try {
      await this.checkClaimCutoffs(new Date());
    } catch (err) {
      this.logger.warn(`claim-cutoff-reminders failed: ${(err as Error).message}`);
    }
  }

  /**
   * Send claim cut-off reminders for ACTIVE contracts whose client has a
   * configured claimCutoffDay.
   *
   * The next cut-off date is rolled back to the preceding QLD work day
   * (weekends/public holidays) and a reminder fires only when that adjusted
   * date is exactly 7 days from `today`. Creates an in-app notification for
   * the client's claimReminderUser (falling back to the seeded Accounts
   * owner `user-supervisor-002`) and, when the reminder user has an email,
   * sends a fire-and-forget claim.cutoff_reminder email.
   *
   * @param today - reference date used for the 7-day-out check (injected for testability)
   */
  async checkClaimCutoffs(today: Date) {
    // Find contracts with active projects whose client has a configured cut-off.
    const contracts = await this.prisma.contract.findMany({
      where: { status: ContractStatus.ACTIVE },
      include: {
        project: {
          include: {
            client: {
              include: {
                claimReminderUser: { select: { id: true, email: true, firstName: true, lastName: true } }
              }
            }
          }
        }
      }
    });

    const amy = await this.prisma.user.findUnique({ where: { id: "user-supervisor-002" }, select: { id: true } });

    for (const c of contracts) {
      const day = c.project.client.claimCutoffDay;
      if (!day) continue;
      const target = nextCutoffDate(today, day);
      const adjusted = adjustToPrecedingWorkday(target);
      const daysAway = Math.round((adjusted.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAway !== 7) continue;

      // Reminder goes to the assigned IS staff member; falls back to Amy (the
      // default Accounts owner) when no per-client override is set.
      const reminderUserId = c.project.client.claimReminderUserId ?? amy?.id ?? null;
      const recipients: string[] = reminderUserId ? [reminderUserId] : [];
      const cutoffContactEmail = c.project.client.claimReminderUser?.email ?? null;
      for (const userId of recipients) {
        await this.notifications.create({
          userId,
          title: `Claim due — ${c.project.projectNumber}`,
          body: `Progress claim for ${c.project.projectNumber} — ${c.project.name} is due by ${formatDate(adjusted)}. Client: ${c.project.client.name}.`,
          severity: "LOW"
        });
      }
      if (cutoffContactEmail) {
        void this.email.sendNotificationEmail({
          trigger: "claim.cutoff_reminder",
          subject: `Progress claim due — ${c.project.projectNumber}`,
          html: `<p>Your progress claim for <strong>${c.project.projectNumber} — ${c.project.name}</strong> is due by <strong>${formatDate(adjusted)}</strong>.</p>`,
          text: `Progress claim for ${c.project.projectNumber} due ${formatDate(adjusted)}.`
        });
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────
  private async requireContract(contractId: string) {
    const c = await this.prisma.contract.findUnique({ where: { id: contractId }, select: { id: true } });
    if (!c) throw new NotFoundException("Contract not found.");
    return c;
  }

  private async nextContractNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.contractNumberSequence.upsert({
        where: { id: CONTRACT_SEQ_ID },
        create: { id: CONTRACT_SEQ_ID, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return `IS-C${String(row.lastNumber).padStart(3, "0")}`;
    });
  }

  private async nextVariationNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.variationNumberSequence.upsert({
        where: { id: 1 },
        create: { id: 1, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return `IS-V${String(row.lastNumber).padStart(3, "0")}`;
    });
  }

  private async nextClaimNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.claimNumberSequence.upsert({
        where: { id: 1 },
        create: { id: 1, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return `IS-PC${String(row.lastNumber).padStart(3, "0")}`;
    });
  }

  private async scopeDisciplineSubtotals(tenderId: string): Promise<Record<string, number>> {
    // Mirror of the summary calc in ScopeRedesignService but without the cutting
    // roll-up — line items track disciplines only.
    // PR A2.5 — discipline read via card relation.
    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId, status: { not: "excluded" } },
      select: {
        card: { select: { discipline: true } },
        estimateItemId: true,
        provisionalAmount: true
      }
    });
    const estimateItemIds = items
      .filter((i) => i.card?.discipline !== "Other")
      .map((i) => i.estimateItemId)
      .filter((id): id is string => !!id);
    const estimateItems = await this.prisma.estimateItem.findMany({
      where: { id: { in: estimateItemIds } },
      include: {
        labourLines: true,
        plantLines: true,
        equipLines: true,
        wasteLines: true,
        cuttingLines: true
      }
    });
    const priceByItem = new Map<string, number>();
    for (const item of estimateItems) {
      const labour = item.labourLines.reduce((s, l) => s + Number(l.qty) * Number(l.days) * Number(l.rate), 0);
      const plant = item.plantLines.reduce((s, l) => s + Number(l.qty) * Number(l.days) * Number(l.rate), 0);
      const equip = item.equipLines.reduce((s, l) => s + Number(l.qty) * Number(l.duration) * Number(l.rate), 0);
      const waste = item.wasteLines.reduce((s, l) => s + Number(l.qtyTonnes) * Number(l.tonRate) + Number(l.loads) * Number(l.loadRate), 0);
      const cutting = item.cuttingLines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
      priceByItem.set(item.id, labour + plant + equip + waste + cutting);
    }
    const markup = await this.prisma.tenderEstimate
      .findUnique({ where: { tenderId }, select: { markup: true } })
      .then((e) => (e ? Number(e.markup) : 30));
    const out: Record<string, number> = {};
    for (const i of items) {
      const itemDiscipline = i.card?.discipline ?? "Other";
      if (itemDiscipline === "Other") {
        out.Other = (out.Other ?? 0) + (i.provisionalAmount ? Number(i.provisionalAmount) : 0);
      } else if (i.estimateItemId) {
        out[itemDiscipline] = (out[itemDiscipline] ?? 0) + (priceByItem.get(i.estimateItemId) ?? 0);
      }
    }
    for (const d of Object.keys(out)) {
      if (d !== "Other") out[d] = out[d] * (1 + markup / 100);
    }
    return out;
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Add N BUSINESS days (skipping Sat/Sun + QLD public holidays). Used by
// the SOPA payment-schedule dueBy calc, then paired with
// adjustToPrecedingWorkday so the anchor-day math never lands on a
// weekend/holiday.
function addBusinessDays(from: Date, businessDays: number): Date {
  const d = new Date(from);
  let remaining = businessDays;
  // Safety cap at 4× the requested days — with weekends + a handful of
  // holidays this covers even a 30-day request in ~50 iterations.
  const cap = Math.max(1, businessDays) * 4 + 14;
  let iter = 0;
  while (remaining > 0 && iter < cap) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !isAustralianPublicHoliday(d)) remaining -= 1;
    iter += 1;
  }
  return d;
}

function nextCutoffDate(today: Date, day: number): Date {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  let target = new Date(Date.UTC(y, m, day));
  if (target <= today) target = new Date(Date.UTC(y, m + 1, day));
  return target;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function describeDiscipline(code: string): string {
  switch (code) {
    case "DEM":
      return "Demolition";
    case "CIV":
      return "Civil works";
    case "ASB":
      return "Asbestos removal";
    case "Other":
      return "Other (provisional sums, options, adjustments)";
    default:
      return code;
  }
}
