import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  LeadCaptureChannel,
  OpportunitySource,
  OpportunityStage,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { CrmService } from "../crm.service";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Input for capturing a new lead through any front-door channel.
 * On capture the service will:
 *   1. Resolve or auto-create a PROSPECT Account for the company.
 *   2. Create an Opportunity row (isLead=true, stage=open) linked to the Account.
 */
export type CaptureLeadInput = {
  title: string;
  /** How the lead arrived (email | phone | portal | referral | cold_outreach | other). */
  captureChannel?: LeadCaptureChannel;
  /** Free-text detail for the capture event (e.g. email subject, referrer name). */
  captureDetail?: string | null;
  source?: OpportunitySource;
  clientId: string;
  contactId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
};

export type TriageLeadInput = {
  /**
   * "tender" — promote the lead and generate a Draft Tender (calls generateDraftTender).
   * "dont_pursue" — mark as not_pursued with a structured reason.
   */
  action: "tender" | "dont_pursue";
  /** Required when action === "tender". */
  siteId?: string;
  tenderTitle?: string;
  /** Required when action === "dont_pursue". */
  dropReasonId?: string;
  dropReasonDetail?: string | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * CRM-3: LeadIntakeService — multi-source capture + triage + lead↔Account link.
 *
 * EXTENDS the leads-collapse (CrmService). Does NOT rework or replace it.
 * The service owns two responsibilities:
 *   A. Capture: receive a lead from any channel, resolve/create a PROSPECT Account,
 *      and create an Opportunity row via CrmService.createLead.
 *   B. Triage: drive the open lead to either a Tender Draft (via
 *      CrmService.generateDraftTender) or a "don't pursue" close
 *      (writes stage=not_pursued + dropReasonId).
 *
 * No new transactional data is created here — triage actions delegate
 * entirely to CrmService, which is the single source of truth for the
 * Opportunity model.
 */
@Injectable()
export class LeadIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly crm: CrmService
  ) {}

  // ── Capture ───────────────────────────────────────────────────────────────

  /**
   * Capture a new lead from any channel.
   *
   * 1. Validates the clientId is real.
   * 2. Resolves an Account for the client — if one already exists (the Client
   *    was backfilled into accounts by CRM-1) reuses it; otherwise creates a
   *    new PROSPECT Account.
   * 3. Creates the Opportunity row (isLead=true, stage=open) with
   *    captureChannel, captureDetail, and accountId set.
   *
   * @throws BadRequestException  When title or clientId is missing.
   * @throws NotFoundException    When the clientId or contactId does not exist.
   */
  async captureLead(input: CaptureLeadInput, actorId?: string) {
    if (!input.title?.trim()) {
      throw new BadRequestException("title is required.");
    }
    if (!input.clientId) {
      throw new BadRequestException("clientId is required to capture a lead.");
    }

    // Verify client exists (CrmService.createLead will also guard this, but we
    // need the clientId to resolve/create an Account first).
    const client = await this.prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true }
    });
    if (!client) throw new NotFoundException(`Client ${input.clientId} not found.`);

    // Resolve or auto-create a PROSPECT Account for this client.
    const accountId = await this.resolveOrCreateAccount(input.clientId, actorId);

    // Create the Opportunity (lead) via CrmService — single source of truth.
    const opportunity = await this.crm.createLead({
      title: input.title.trim(),
      source: input.source,
      clientId: input.clientId,
      contactId: input.contactId ?? null,
      ownerId: input.ownerId ?? null,
      notes: input.notes ?? null,
      nextActionAt: input.nextActionAt ?? null,
      nextActionNote: input.nextActionNote ?? null
    });

    // Patch the capture-specific fields that CrmService.createLead doesn't handle.
    const updated = await this.prisma.opportunity.update({
      where: { id: opportunity.id },
      data: {
        captureChannel: input.captureChannel ?? null,
        captureDetail: input.captureDetail ?? null,
        accountId
      },
      include: this.leadInclude()
    });

    return updated;
  }

  /**
   * List open leads (isLead=true, stage in [open, new, qualified, quoting]).
   * Enriched with captureChannel and account.
   */
  async listOpenLeads(query: {
    ownerId?: string;
    accountId?: string;
    captureChannel?: LeadCaptureChannel;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const OPEN_INTAKE_STAGES: OpportunityStage[] = ["open", "new", "qualified", "quoting"];

    const where: Prisma.OpportunityWhereInput = {
      isLead: true,
      stage: { in: OPEN_INTAKE_STAGES }
    };
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.accountId) where.accountId = query.accountId;
    if (query.captureChannel) where.captureChannel = query.captureChannel;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } }
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunity.findMany({
        where,
        orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: this.leadInclude()
      }),
      this.prisma.opportunity.count({ where })
    ]);

    return { items, total, page, limit };
  }

  // ── Triage ────────────────────────────────────────────────────────────────

  /**
   * Triage an open lead: either promote it to a Tender Draft or mark it as
   * "don't pursue" with a structured reason.
   *
   * @param leadId The Opportunity id (isLead=true row).
   * @param input  Triage instruction (action, siteId, dropReasonId, etc.).
   * @param actorId The user driving the action (for tender audit trail).
   *
   * @throws BadRequestException  For missing required fields per action.
   * @throws ConflictException    If the lead is already in a terminal stage.
   * @throws NotFoundException    If the lead or dropReason does not exist.
   */
  async triageLead(leadId: string, input: TriageLeadInput, actorId?: string) {
    const lead = await this.prisma.opportunity.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        stage: true,
        isLead: true,
        convertedTenderId: true,
        dropReasonId: true
      }
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found.`);

    const TERMINAL: OpportunityStage[] = ["archived", "not_pursued", "won", "lost"];
    if (TERMINAL.includes(lead.stage)) {
      throw new ConflictException(
        `Lead ${leadId} is already ${lead.stage} and cannot be triaged again.`
      );
    }

    if (input.action === "tender") {
      if (!input.siteId?.trim()) {
        throw new BadRequestException("siteId is required to generate a draft tender.");
      }
      // Delegate entirely to the existing generateDraftTender path.
      return this.crm.generateDraftTender(
        leadId,
        { siteId: input.siteId, title: input.tenderTitle },
        actorId
      );
    }

    if (input.action === "dont_pursue") {
      if (!input.dropReasonId) {
        throw new BadRequestException("dropReasonId is required to mark a lead as don't-pursue.");
      }
      // Validate the drop reason exists.
      const reason = await this.prisma.dropReason.findUnique({
        where: { id: input.dropReasonId },
        select: { id: true, isActive: true }
      });
      if (!reason) throw new NotFoundException(`DropReason ${input.dropReasonId} not found.`);
      if (!reason.isActive) {
        throw new BadRequestException(
          `DropReason ${input.dropReasonId} is inactive and cannot be used.`
        );
      }

      return this.prisma.opportunity.update({
        where: { id: leadId },
        data: {
          stage: "not_pursued",
          lostAt: new Date(),
          dropReason: { connect: { id: input.dropReasonId } },
          dropReasonDetail: input.dropReasonDetail ?? null
        },
        include: this.leadInclude()
      });
    }

    throw new BadRequestException(`Unknown triage action: ${(input as { action: string }).action}`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns the id of the Account linked to this client.
   * If no Account exists yet, auto-creates a PROSPECT Account via AccountsService.
   */
  private async resolveOrCreateAccount(clientId: string, actorId?: string): Promise<string> {
    const existing = await this.prisma.account.findFirst({
      where: { clientId },
      select: { id: true }
    });
    if (existing) return existing.id;

    const created = await this.accounts.createAccount({
      clientId,
      lifecycleStatus: "PROSPECT",
      ownerId: actorId ?? null
    });
    return created.id;
  }

  private leadInclude() {
    return {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      account: { select: { id: true, lifecycleStatus: true } },
      dropReason: { select: { id: true, label: true } }
    } satisfies Prisma.OpportunityInclude;
  }
}
