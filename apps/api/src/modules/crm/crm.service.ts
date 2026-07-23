import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  LeadStatus,
  OpportunitySource,
  OpportunityStage,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenderingService } from "../tendering/tendering.service";

// Terminal stages block further stage transitions (except via a fresh record).
const TERMINAL_STAGES: OpportunityStage[] = ["won", "lost"];

// Weighted forecast pipeline stages (won/lost are excluded from the open
// forecast — won records surface separately as booked; lost as historical).
const OPEN_STAGES: OpportunityStage[] = ["new", "qualified", "quoting"];

export type CreateLeadInput = {
  title: string;
  source?: OpportunitySource;
  companyName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  clientId?: string | null;
  contactId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
};

export type UpdateLeadInput = Partial<CreateLeadInput> & {
  status?: LeadStatus;
};

export type CreateOpportunityInput = {
  title: string;
  description?: string | null;
  stage?: OpportunityStage;
  probability?: number;
  estimatedValue?: string | number | null;
  source?: OpportunitySource;
  clientId: string;
  contactId?: string | null;
  ownerId?: string | null;
  expectedCloseDate?: string | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
};

export type UpdateOpportunityInput = Partial<Omit<CreateOpportunityInput, "clientId">> & {
  clientId?: string;
  lostReason?: string | null;
};

export type ConvertToTenderInput = {
  siteId: string;
  title?: string;
  dueDate?: string | null;
  proposedStartDate?: string | null;
};

export type GenerateDraftTenderInput = {
  siteId: string;
  title?: string;
  clientId?: string;
};

/**
 * Service for CRM Lead + Opportunity pipeline.
 *
 * A Lead is early, untriaged interest. Once qualified it converts to an
 * Opportunity (via `convertLeadToOpportunity`). An Opportunity is a
 * qualified pipeline record with stage/probability/estimated value; when
 * it firms up, `convertOpportunityToTender` calls TenderingService.create
 * so the resulting Tender inherits title, client, estimator, estimated
 * value, and probability without re-keying.
 */
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tendering: TenderingService
  ) {}

  // ── Leads ────────────────────────────────────────────────────────────────

  async createLead(input: CreateLeadInput) {
    if (!input.title?.trim()) {
      throw new BadRequestException("title is required.");
    }
    if (input.clientId) await this.requireClient(input.clientId);
    if (input.contactId) await this.requireContact(input.contactId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    return this.prisma.lead.create({
      data: {
        title: input.title.trim(),
        source: input.source ?? "other",
        status: "new",
        companyName: input.companyName ?? null,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        clientId: input.clientId ?? null,
        contactId: input.contactId ?? null,
        ownerId: input.ownerId ?? null,
        notes: input.notes ?? null,
        nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
        nextActionNote: input.nextActionNote ?? null
      },
      include: this.leadInclude()
    });
  }

  async listLeads(query: {
    status?: LeadStatus;
    ownerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.LeadWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { companyName: { contains: term, mode: "insensitive" } },
        { contactName: { contains: term, mode: "insensitive" } },
        { contactEmail: { contains: term, mode: "insensitive" } }
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: this.leadInclude()
      }),
      this.prisma.lead.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getLead(id: string) {
    const row = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        ...this.leadInclude(),
        convertedOpportunity: { select: { id: true, title: true, stage: true } }
      }
    });
    if (!row) throw new NotFoundException(`Lead ${id} not found.`);
    return row;
  }

  async updateLead(id: string, input: UpdateLeadInput) {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Lead ${id} not found.`);

    if (input.clientId) await this.requireClient(input.clientId);
    if (input.contactId) await this.requireContact(input.contactId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    const data: Prisma.LeadUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.status !== undefined) data.status = input.status;
    if (input.source !== undefined) data.source = input.source;
    if (input.companyName !== undefined) data.companyName = input.companyName ?? null;
    if (input.contactName !== undefined) data.contactName = input.contactName ?? null;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail ?? null;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone ?? null;
    if (input.clientId !== undefined) {
      data.client = input.clientId ? { connect: { id: input.clientId } } : { disconnect: true };
    }
    if (input.contactId !== undefined) {
      data.contact = input.contactId ? { connect: { id: input.contactId } } : { disconnect: true };
    }
    if (input.ownerId !== undefined) {
      data.owner = input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true };
    }
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.nextActionAt !== undefined) {
      data.nextActionAt = input.nextActionAt ? new Date(input.nextActionAt) : null;
    }
    if (input.nextActionNote !== undefined) data.nextActionNote = input.nextActionNote ?? null;

    return this.prisma.lead.update({
      where: { id },
      data,
      include: this.leadInclude()
    });
  }

  /**
   * Qualify a lead → create an Opportunity linked back to the lead.
   * The lead's status becomes `converted`. Idempotent-ish: throws 409 if
   * this lead has already been converted.
   */
  async convertLeadToOpportunity(
    leadId: string,
    input: { clientId?: string; estimatedValue?: string | number | null; probability?: number }
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found.`);
    if (lead.convertedOpportunityId) {
      throw new ConflictException(`Lead ${leadId} has already been converted.`);
    }

    const clientId = input.clientId ?? lead.clientId;
    if (!clientId) {
      throw new BadRequestException(
        "A clientId is required to convert a lead. Link the lead to a Client first, or pass clientId in the body."
      );
    }
    await this.requireClient(clientId);

    return this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.create({
        data: {
          title: lead.title,
          clientId,
          contactId: lead.contactId ?? null,
          ownerId: lead.ownerId ?? null,
          source: lead.source,
          stage: "qualified",
          probability: this.clampProbability(input.probability ?? 40),
          estimatedValue: this.toDecimalOrNull(input.estimatedValue ?? null),
          description: lead.notes ?? null
        },
        include: this.opportunityInclude()
      });
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: "converted",
          convertedOpportunityId: opp.id
        }
      });
      return opp;
    });
  }

  /**
   * One-click "Generate draft tender" from a lead. Composes the two existing
   * conversion steps (`convertLeadToOpportunity` → `convertOpportunityToTender`)
   * so a CRM lead lands as a DRAFT Tender without the user round-tripping
   * through the opportunity board.
   *
   * Idempotent: if the lead's opportunity already has a `convertedTenderId`,
   * returns 409 with that tender id.
   *
   * @throws BadRequestException When siteId is missing, or the lead has no
   *   linked client and no clientId is supplied.
   * @throws ConflictException When a draft tender has already been generated
   *   for this lead.
   */
  async generateDraftTender(
    leadId: string,
    input: GenerateDraftTenderInput,
    actorId?: string
  ) {
    if (!input.siteId?.trim()) {
      throw new BadRequestException(
        "siteId is required to generate a draft tender."
      );
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        convertedOpportunity: {
          select: { id: true, convertedTenderId: true }
        }
      }
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found.`);

    if (lead.convertedOpportunity?.convertedTenderId) {
      throw new ConflictException(
        `Lead ${leadId} already has a draft tender ${lead.convertedOpportunity.convertedTenderId}.`
      );
    }

    let opportunityId = lead.convertedOpportunityId;
    if (!opportunityId) {
      const opp = await this.convertLeadToOpportunity(leadId, {
        clientId: input.clientId
      });
      opportunityId = opp.id;
    }

    return this.convertOpportunityToTender(
      opportunityId,
      { siteId: input.siteId, title: input.title },
      actorId
    );
  }

  // ── Opportunities ────────────────────────────────────────────────────────

  async createOpportunity(input: CreateOpportunityInput) {
    if (!input.title?.trim()) {
      throw new BadRequestException("title is required.");
    }
    if (!input.clientId) {
      throw new BadRequestException("clientId is required.");
    }
    await this.requireClient(input.clientId);
    if (input.contactId) await this.requireContact(input.contactId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    return this.prisma.opportunity.create({
      data: {
        title: input.title.trim(),
        description: input.description ?? null,
        stage: input.stage ?? "new",
        probability: this.clampProbability(input.probability ?? 20),
        estimatedValue: this.toDecimalOrNull(input.estimatedValue ?? null),
        source: input.source ?? "other",
        clientId: input.clientId,
        contactId: input.contactId ?? null,
        ownerId: input.ownerId ?? null,
        expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
        nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
        nextActionNote: input.nextActionNote ?? null
      },
      include: this.opportunityInclude()
    });
  }

  async listOpportunities(query: {
    stage?: OpportunityStage;
    ownerId?: string;
    clientId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(200, Math.max(1, query.limit ?? 50));

    const where: Prisma.OpportunityWhereInput = {};
    if (query.stage) where.stage = query.stage;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.clientId) where.clientId = query.clientId;
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
        orderBy: [
          { expectedCloseDate: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" }
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: this.opportunityInclude()
      }),
      this.prisma.opportunity.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getOpportunity(id: string) {
    const row = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        ...this.opportunityInclude(),
        sourceLead: { select: { id: true, title: true, status: true } },
        convertedTender: { select: { id: true, tenderNumber: true, title: true, status: true } }
      }
    });
    if (!row) throw new NotFoundException(`Opportunity ${id} not found.`);
    return row;
  }

  async updateOpportunity(id: string, input: UpdateOpportunityInput) {
    const existing = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Opportunity ${id} not found.`);

    if (
      input.stage &&
      input.stage !== existing.stage &&
      TERMINAL_STAGES.includes(existing.stage)
    ) {
      throw new ConflictException(
        `Opportunity is already ${existing.stage} and cannot be moved. Create a new opportunity instead.`
      );
    }
    if (input.clientId) await this.requireClient(input.clientId);
    if (input.contactId) await this.requireContact(input.contactId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    const data: Prisma.OpportunityUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.stage !== undefined) {
      data.stage = input.stage;
      if (input.stage === "won" && !existing.wonAt) data.wonAt = new Date();
      if (input.stage === "lost" && !existing.lostAt) data.lostAt = new Date();
    }
    if (input.probability !== undefined) {
      data.probability = this.clampProbability(input.probability);
    }
    if (input.estimatedValue !== undefined) {
      data.estimatedValue = this.toDecimalOrNull(input.estimatedValue);
    }
    if (input.source !== undefined) data.source = input.source;
    if (input.clientId) data.client = { connect: { id: input.clientId } };
    if (input.contactId !== undefined) {
      data.contact = input.contactId ? { connect: { id: input.contactId } } : { disconnect: true };
    }
    if (input.ownerId !== undefined) {
      data.owner = input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true };
    }
    if (input.expectedCloseDate !== undefined) {
      data.expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : null;
    }
    if (input.nextActionAt !== undefined) {
      data.nextActionAt = input.nextActionAt ? new Date(input.nextActionAt) : null;
    }
    if (input.nextActionNote !== undefined) data.nextActionNote = input.nextActionNote ?? null;
    if (input.lostReason !== undefined) data.lostReason = input.lostReason ?? null;

    return this.prisma.opportunity.update({
      where: { id },
      data,
      include: this.opportunityInclude()
    });
  }

  /**
   * Convert an opportunity to a Tender. Creates the tender via
   * TenderingService.create (so numbering / SharePoint folders / audit
   * fire), then marks the opportunity as won and links the two records.
   *
   * @throws BadRequestException When siteId is missing (Tender.siteId is
   *   required and the opportunity doesn't carry a site).
   * @throws ConflictException When this opportunity has already been converted
   *   or is in a terminal stage.
   */
  async convertOpportunityToTender(
    opportunityId: string,
    input: ConvertToTenderInput,
    actorId?: string
  ) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: { select: { id: true, name: true } } }
    });
    if (!opp) throw new NotFoundException(`Opportunity ${opportunityId} not found.`);
    if (opp.convertedTenderId) {
      throw new ConflictException(
        `Opportunity ${opportunityId} has already been converted to tender ${opp.convertedTenderId}.`
      );
    }
    if (opp.stage === "lost") {
      throw new ConflictException("Cannot convert a lost opportunity to a tender.");
    }
    if (!input.siteId?.trim()) {
      throw new BadRequestException(
        "siteId is required to convert an opportunity to a tender."
      );
    }
    const site = await this.prisma.site.findUnique({
      where: { id: input.siteId },
      select: { id: true }
    });
    if (!site) throw new NotFoundException(`Site ${input.siteId} not found.`);

    const estimatedValue =
      opp.estimatedValue !== null && opp.estimatedValue !== undefined
        ? String(opp.estimatedValue)
        : undefined;

    const tender = await this.tendering.create(
      {
        title: input.title?.trim() ?? opp.title,
        description: opp.description ?? undefined,
        siteId: input.siteId,
        estimatorUserId: opp.ownerId ?? undefined,
        status: "DRAFT",
        dueDate: input.dueDate ?? undefined,
        proposedStartDate: input.proposedStartDate ?? undefined,
        probability: opp.probability,
        estimatedValue,
        notes: opp.description ?? undefined,
        tenderClients: [
          {
            clientId: opp.clientId,
            contactId: opp.contactId ?? undefined
          }
        ]
      },
      actorId
    );

    const updated = await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        stage: "won",
        wonAt: opp.wonAt ?? new Date(),
        convertedTenderId: tender.id
      },
      include: {
        ...this.opportunityInclude(),
        convertedTender: { select: { id: true, tenderNumber: true, title: true, status: true } }
      }
    });

    return updated;
  }

  // ── Forecast ─────────────────────────────────────────────────────────────

  /**
   * Weighted forecast — open pipeline grouped by stage. Reuses the same
   * shape the dashboard widgets consume; the web forecast card just charts
   * `weightedValue` per stage.
   */
  async forecast(query: { ownerId?: string }) {
    const where: Prisma.OpportunityWhereInput = { stage: { in: OPEN_STAGES } };
    if (query.ownerId) where.ownerId = query.ownerId;

    const rows = await this.prisma.opportunity.findMany({
      where,
      select: {
        stage: true,
        probability: true,
        estimatedValue: true
      }
    });

    type Bucket = { stage: OpportunityStage; count: number; grossValue: number; weightedValue: number };
    const bucketMap = new Map<OpportunityStage, Bucket>();
    for (const stage of OPEN_STAGES) {
      bucketMap.set(stage, { stage, count: 0, grossValue: 0, weightedValue: 0 });
    }

    let totalGross = 0;
    let totalWeighted = 0;
    for (const row of rows) {
      const value = row.estimatedValue ? Number(row.estimatedValue) : 0;
      const weighted = (value * row.probability) / 100;
      const bucket = bucketMap.get(row.stage);
      if (!bucket) continue;
      bucket.count += 1;
      bucket.grossValue += value;
      bucket.weightedValue += weighted;
      totalGross += value;
      totalWeighted += weighted;
    }

    return {
      buckets: Array.from(bucketMap.values()),
      totals: {
        count: rows.length,
        grossValue: totalGross,
        weightedValue: totalWeighted
      }
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private leadInclude() {
    return {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } }
    } satisfies Prisma.LeadInclude;
  }

  private opportunityInclude() {
    return {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      convertedTender: { select: { id: true, tenderNumber: true, status: true } }
    } satisfies Prisma.OpportunityInclude;
  }

  private clampProbability(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private toDecimalOrNull(value: string | number | null | undefined): Prisma.Decimal | null {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(num)) {
      throw new BadRequestException(`estimatedValue must be a finite number.`);
    }
    return new Prisma.Decimal(num);
  }

  private async requireClient(id: string) {
    const row = await this.prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Client ${id} not found.`);
  }

  private async requireContact(id: string) {
    const row = await this.prisma.contact.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Contact ${id} not found.`);
  }

  private async requireUser(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`User ${id} not found.`);
  }
}
