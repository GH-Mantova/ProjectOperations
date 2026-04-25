import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClaimStatus, ContractStatus, Prisma, VariationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../platform/notifications.service";
import { adjustToPrecedingWorkday } from "./public-holidays";

const CONTRACT_SEQ_ID = 1;
const DISCIPLINE_ORDER = ["SO", "Str", "Asb", "Civ", "Prv"] as const;

type Actor = { id: string; permissions: ReadonlySet<string> };

const VARIATION_TRANSITIONS: Record<VariationStatus, VariationStatus[]> = {
  RECEIVED: ["PRICED"],
  PRICED: ["SUBMITTED"],
  SUBMITTED: ["APPROVED"],
  APPROVED: []
};

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  // ── Contracts ────────────────────────────────────────────────────────
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

  async getContract(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        project: { include: { client: true } },
        variations: { orderBy: { variationNumber: "asc" } },
        progressClaims: { orderBy: { claimMonth: "desc" }, select: { id: true, claimNumber: true, claimMonth: true, status: true, totalClaimed: true, totalApproved: true, totalPaid: true, submissionDate: true } }
      }
    });
    if (!contract) throw new NotFoundException("Contract not found.");
    return contract;
  }

  async createContract(
    actorId: string,
    dto: { projectId: string; contractValue: number; retentionPct?: number; startDate?: string; endDate?: string; notes?: string }
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId }, select: { id: true, contract: { select: { id: true } } } });
    if (!project) throw new NotFoundException("Project not found.");
    if (project.contract) throw new ConflictException("This project already has a contract.");
    const contractNumber = await this.nextContractNumber();
    return this.prisma.contract.create({
      data: {
        projectId: dto.projectId,
        contractNumber,
        contractValue: new Prisma.Decimal(dto.contractValue),
        retentionPct: dto.retentionPct !== undefined ? new Prisma.Decimal(dto.retentionPct) : new Prisma.Decimal(0),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: dto.notes ?? null,
        createdById: actorId
      },
      include: { project: { include: { client: true } } }
    });
  }

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
  async listVariations(contractId: string) {
    await this.requireContract(contractId);
    return this.prisma.variation.findMany({
      where: { contractId },
      orderBy: { variationNumber: "asc" }
    });
  }

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
  async listClaims(contractId: string) {
    await this.requireContract(contractId);
    return this.prisma.progressClaim.findMany({
      where: { contractId },
      orderBy: { claimMonth: "desc" }
    });
  }

  async getClaim(contractId: string, claimId: string) {
    const claim = await this.prisma.progressClaim.findUnique({
      where: { id: claimId },
      include: { lineItems: { orderBy: [{ sortOrder: "asc" }] }, contract: true }
    });
    if (!claim || claim.contractId !== contractId) throw new NotFoundException("Claim not found.");
    return claim;
  }

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
    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId, status: { not: "excluded" } },
      select: { discipline: true, estimateItemId: true, provisionalAmount: true }
    });
    const estimateItemIds = items
      .filter((i) => i.discipline !== "Prv")
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
      if (i.discipline === "Prv") {
        out.Prv = (out.Prv ?? 0) + (i.provisionalAmount ? Number(i.provisionalAmount) : 0);
      } else if (i.estimateItemId) {
        out[i.discipline] = (out[i.discipline] ?? 0) + (priceByItem.get(i.estimateItemId) ?? 0);
      }
    }
    for (const d of Object.keys(out)) {
      if (d !== "Prv") out[d] = out[d] * (1 + markup / 100);
    }
    return out;
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
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
    case "SO":
      return "Strip-outs";
    case "Str":
      return "Structural demolition";
    case "Asb":
      return "Asbestos removal";
    case "Civ":
      return "Civil works";
    case "Prv":
      return "Provisional sums";
    default:
      return code;
  }
}
