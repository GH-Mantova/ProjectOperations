import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CreateDropReasonDto } from "./dto/create-drop-reason.dto";
import { UpdateDropReasonDto } from "./dto/update-drop-reason.dto";
import { CreateEntryDto } from "./dto/create-entry.dto";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { DontPursueDto } from "./dto/dont-pursue.dto";
import { ArchiveEntryDto } from "./dto/archive-entry.dto";
import {
  OpportunitySource,
  OpportunityStage,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenderingService } from "../tendering/tendering.service";

// Terminal stages block further stage transitions (except via a fresh record).
const TERMINAL_STAGES: OpportunityStage[] = ["archived", "not_pursued", "won", "lost"];

// Weighted forecast pipeline stages (archived/not_pursued/won/lost are excluded
// from the open forecast — won records surface separately as booked; others as historical).
const OPEN_STAGES: OpportunityStage[] = ["open", "new", "qualified", "quoting"];

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

export type UpdateLeadInput = Partial<CreateLeadInput>;

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
  dropReasonId?: string | null;
  dropReasonDetail?: string | null;
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
 * Service for the unified CRM pipeline (Leads + Opportunities).
 *
 * After CRM S1, "Leads" are Opportunity rows with isLead=true and stage=open.
 * The Lead surface CRUD methods delegate to the same prisma.opportunity table.
 * An Opportunity is a pipeline record with stage/probability/estimated value;
 * when it firms up, `convertOpportunityToTender` calls TenderingService.create
 * so the resulting Tender inherits title, client, estimator, estimated value,
 * and probability without re-keying.
 *
 * The `generateDraftTender` business logic is preserved unchanged (CRM S1 constraint).
 */
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tendering: TenderingService
  ) {}

  // ── Leads (isLead=true Opportunity rows) ─────────────────────────────────

  async createLead(input: CreateLeadInput) {
    if (!input.title?.trim()) {
      throw new BadRequestException("title is required.");
    }
    if (!input.clientId) {
      throw new BadRequestException(
        "clientId is required to create a lead in the unified pipeline."
      );
    }
    await this.requireClient(input.clientId);
    if (input.contactId) await this.requireContact(input.contactId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    return this.prisma.opportunity.create({
      data: {
        title: input.title.trim(),
        source: input.source ?? "other",
        stage: "open",
        isLead: true,
        clientId: input.clientId,
        contactId: input.contactId ?? null,
        ownerId: input.ownerId ?? null,
        description: input.notes ?? null,
        nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
        nextActionNote: input.nextActionNote ?? null
      },
      include: this.opportunityInclude()
    });
  }

  async listLeads(query: {
    ownerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.OpportunityWhereInput = { isLead: true };
    if (query.ownerId) where.ownerId = query.ownerId;
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
        include: this.opportunityInclude()
      }),
      this.prisma.opportunity.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getLead(id: string) {
    const row = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        ...this.opportunityInclude(),
        convertedTender: { select: { id: true, tenderNumber: true, title: true, status: true } }
      }
    });
    if (!row) throw new NotFoundException(`Lead ${id} not found.`);
    return row;
  }

  async updateLead(id: string, input: UpdateLeadInput) {
    const existing = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Lead ${id} not found.`);

    if (input.clientId) await this.requireClient(input.clientId);
    if (input.contactId) await this.requireContact(input.contactId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    const data: Prisma.OpportunityUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.source !== undefined) data.source = input.source;
    if (input.notes !== undefined) data.description = input.notes ?? null;
    if (input.clientId !== undefined) {
      data.client = input.clientId ? { connect: { id: input.clientId } } : undefined;
    }
    if (input.contactId !== undefined) {
      data.contact = input.contactId ? { connect: { id: input.contactId } } : { disconnect: true };
    }
    if (input.ownerId !== undefined) {
      data.owner = input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true };
    }
    if (input.nextActionAt !== undefined) {
      data.nextActionAt = input.nextActionAt ? new Date(input.nextActionAt) : null;
    }
    if (input.nextActionNote !== undefined) data.nextActionNote = input.nextActionNote ?? null;

    return this.prisma.opportunity.update({
      where: { id },
      data,
      include: this.opportunityInclude()
    });
  }

  /**
   * "Convert" a lead to a qualified opportunity in the unified model.
   * Since both live in the same table, this updates the stage and clears
   * the isLead flag (the record becomes a standard opportunity).
   * Idempotent: if already converted (isLead=false) throws 409.
   */
  async convertLeadToOpportunity(
    leadId: string,
    input: { clientId?: string; estimatedValue?: string | number | null; probability?: number }
  ) {
    const lead = await this.prisma.opportunity.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found.`);
    if (!lead.isLead) {
      throw new ConflictException(`Lead ${leadId} has already been converted.`);
    }

    const clientId = input.clientId ?? lead.clientId;
    if (!clientId) {
      throw new BadRequestException(
        "A clientId is required to convert a lead. Link the lead to a Client first, or pass clientId in the body."
      );
    }
    await this.requireClient(clientId);

    return this.prisma.opportunity.update({
      where: { id: leadId },
      data: {
        isLead: false,
        stage: "open",
        clientId,
        probability: this.clampProbability(input.probability ?? 40),
        estimatedValue: this.toDecimalOrNull(input.estimatedValue ?? null)
      },
      include: this.opportunityInclude()
    });
  }

  /**
   * One-click "Generate draft tender" from a lead. Composes the conversion
   * steps (promote lead → convertOpportunityToTender) so a CRM lead lands
   * as a DRAFT Tender without the user round-tripping through the board.
   *
   * Idempotent: if the opportunity already has a `convertedTenderId`,
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

    const lead = await this.prisma.opportunity.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        clientId: true,
        isLead: true,
        convertedTenderId: true
      }
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found.`);

    if (lead.convertedTenderId) {
      throw new ConflictException(
        `Lead ${leadId} already has a draft tender ${lead.convertedTenderId}.`
      );
    }

    // If still flagged as a lead, promote it to a full opportunity first.
    if (lead.isLead) {
      await this.convertLeadToOpportunity(leadId, {
        clientId: input.clientId
      });
    }

    return this.convertOpportunityToTender(
      leadId,
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
      if (input.stage === "not_pursued" && !existing.lostAt) data.lostAt = new Date();
      if (input.stage === "archived" && !existing.wonAt) data.wonAt = new Date();
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
    if (input.dropReasonId !== undefined) {
      data.dropReason = input.dropReasonId
        ? { connect: { id: input.dropReasonId } }
        : { disconnect: true };
    }
    if (input.dropReasonDetail !== undefined) data.dropReasonDetail = input.dropReasonDetail ?? null;

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
    if (opp.stage === "lost" || opp.stage === "not_pursued") {
      throw new ConflictException("Cannot convert a lost/not-pursued opportunity to a tender.");
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
        tenderClients: opp.clientId
          ? [
              {
                clientId: opp.clientId,
                contactId: opp.contactId ?? undefined
              }
            ]
          : []
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

  // ── Unified entry CRUD (S3) ──────────────────────────────────────────────

  /**
   * The unified stage set for new entries (legacy stages are not valid for new
   * records or stage transitions via the unified API).
   */
  private static readonly VALID_ENTRY_STAGES: OpportunityStage[] = [
    "open",
    "not_pursued",
    "archived"
  ];

  /**
   * Create a unified CRM entry (lead or opportunity) in the new stage model.
   * Always sets stage to "open". Never writes legacy stages.
   */
  async createEntry(dto: CreateEntryDto, actorId: string) {
    if (!dto.title?.trim()) {
      throw new BadRequestException("title is required.");
    }
    if (dto.clientId) await this.requireClient(dto.clientId);
    if (dto.contactId) await this.requireContact(dto.contactId);
    if (dto.ownerId) await this.requireUser(dto.ownerId);

    return this.prisma.opportunity.create({
      data: {
        title: dto.title.trim(),
        stage: "open",
        isLead: dto.isLead,
        source: (dto.source as OpportunitySource | undefined) ?? "other",
        estimatedValue: this.toDecimalOrNull(dto.estimatedValue ?? null),
        clientId: dto.clientId ?? null,
        contactId: dto.contactId ?? null,
        ownerId: dto.ownerId ?? null,
        description: dto.notes ?? null,
        nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
        nextActionNote: dto.nextActionNote ?? null
      },
      include: this.opportunityInclude()
    });
  }

  /**
   * Update a unified CRM entry. If `stage` is provided it must be one of the
   * new stage values (open | not_pursued | archived). Passing a legacy stage
   * (new | qualified | quoting | won | lost) throws BadRequestException.
   */
  async updateEntry(id: string, dto: UpdateEntryDto, actorId: string) {
    const existing = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Entry ${id} not found.`);

    if (dto.stage !== undefined) {
      const validStages = CrmService.VALID_ENTRY_STAGES as string[];
      if (!validStages.includes(dto.stage)) {
        throw new BadRequestException(
          `Invalid stage "${dto.stage}". Allowed values: ${CrmService.VALID_ENTRY_STAGES.join(", ")}.`
        );
      }
    }

    if (dto.clientId) await this.requireClient(dto.clientId);
    if (dto.contactId) await this.requireContact(dto.contactId);
    if (dto.ownerId) await this.requireUser(dto.ownerId);

    const data: Prisma.OpportunityUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.isLead !== undefined) data.isLead = dto.isLead;
    if (dto.source !== undefined) data.source = dto.source as OpportunitySource;
    if (dto.stage !== undefined) data.stage = dto.stage as OpportunityStage;
    if (dto.estimatedValue !== undefined) {
      data.estimatedValue = this.toDecimalOrNull(dto.estimatedValue);
    }
    if (dto.clientId !== undefined) {
      data.client = dto.clientId ? { connect: { id: dto.clientId } } : undefined;
    }
    if (dto.contactId !== undefined) {
      data.contact = dto.contactId ? { connect: { id: dto.contactId } } : { disconnect: true };
    }
    if (dto.ownerId !== undefined) {
      data.owner = dto.ownerId ? { connect: { id: dto.ownerId } } : { disconnect: true };
    }
    if (dto.notes !== undefined) data.description = dto.notes ?? null;
    if (dto.nextActionAt !== undefined) {
      data.nextActionAt = dto.nextActionAt ? new Date(dto.nextActionAt) : null;
    }
    if (dto.nextActionNote !== undefined) data.nextActionNote = dto.nextActionNote ?? null;

    return this.prisma.opportunity.update({
      where: { id },
      data,
      include: this.opportunityInclude()
    });
  }

  /**
   * Mark a CRM entry as "don't pursue": sets stage to "not_pursued", links a
   * DropReason, and stores optional free-text detail.
   *
   * @throws NotFoundException  If the entry does not exist.
   * @throws BadRequestException If the entry is already "archived".
   */
  async dontPursue(id: string, dto: DontPursueDto, actorId: string) {
    const existing = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Entry ${id} not found.`);
    if (existing.stage === "archived") {
      throw new BadRequestException(
        `Entry ${id} is archived and cannot be marked as not-pursued.`
      );
    }

    return this.prisma.opportunity.update({
      where: { id },
      data: {
        stage: "not_pursued",
        dropReason: { connect: { id: dto.dropReasonId } },
        dropReasonDetail: dto.detail ?? null,
        lostAt: existing.lostAt ?? new Date()
      },
      include: this.opportunityInclude()
    });
  }

  /**
   * Archive a CRM entry with a mandatory governed reason (reuses DropReason).
   *
   * @throws NotFoundException  If the entry does not exist.
   * @throws BadRequestException If archiveReasonId is missing or the DropReason
   *   does not exist.
   */
  async archiveEntry(id: string, dto: ArchiveEntryDto, actorId: string) {
    const existing = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Entry ${id} not found.`);

    const reason = await this.prisma.dropReason.findUnique({
      where: { id: dto.archiveReasonId },
      select: { id: true }
    });
    if (!reason) {
      throw new BadRequestException(
        `DropReason ${dto.archiveReasonId} not found. Use a valid drop reason id.`
      );
    }

    return this.prisma.opportunity.update({
      where: { id },
      data: {
        stage: "archived",
        archiveReasonId: dto.archiveReasonId,
        archiveReasonDetail: dto.detail ?? null,
        archivedAt: new Date(),
        archivedById: actorId
      },
      include: this.opportunityInclude()
    });
  }

  /**
   * Restore a CRM entry from archived stage back to open.
   * Clears all archive fields. Unrestricted — no reason needed to un-archive.
   *
   * @throws NotFoundException  If the entry does not exist.
   * @throws BadRequestException If the entry is not archived.
   */
  async restoreEntry(id: string) {
    const existing = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Entry ${id} not found.`);
    if (existing.stage !== "archived") {
      throw new BadRequestException(
        `Entry ${id} is not archived (current stage: ${existing.stage}).`
      );
    }

    return this.prisma.opportunity.update({
      where: { id },
      data: {
        stage: "open",
        archiveReasonId: null,
        archiveReasonDetail: null,
        archivedAt: null,
        archivedById: null
      },
      include: this.opportunityInclude()
    });
  }

  /**
   * Delete a CRM entry — permitted only when the entry is genuinely empty:
   * no description, no contact, no account, no estimatedValue, no dropReason,
   * no convertedTender, and no CommThread anchored to it.
   *
   * The comms-thread check reads prisma.commThread directly using the shared
   * PrismaService rather than importing CommsService, preserving the module
   * boundary. CommThread is a Prisma model in the same database; CrmService
   * already owns PrismaService, so this requires no new NestJS dependency.
   *
   * Refuses with a 400 that names the blocking field(s).
   *
   * @throws NotFoundException    If the entry does not exist.
   * @throws BadRequestException  If any content field is non-empty.
   */
  async deleteEntry(id: string) {
    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      select: {
        description: true,
        contactId: true,
        accountId: true,
        estimatedValue: true,
        dropReasonId: true,
        convertedTenderId: true
      }
    });
    if (!existing) throw new NotFoundException(`Entry ${id} not found.`);

    const blockers: string[] = [];
    if (existing.description) blockers.push("description");
    if (existing.contactId) blockers.push("contact");
    if (existing.accountId) blockers.push("account");
    if (existing.estimatedValue !== null) blockers.push("estimatedValue");
    if (existing.dropReasonId) blockers.push("dropReason");
    if (existing.convertedTenderId) blockers.push("convertedTender");

    // Check for comms threads anchored to this opportunity.
    // We read CommThread directly via PrismaService to avoid importing
    // CommsService across the module boundary.
    //
    // CASE MATTERS. COMM_ENTITY_TYPES in comms.service.ts is UPPERCASE
    // ("ACCOUNT" | "TENDER" | "OPPORTUNITY" | "JOB" | "CONTRACT"), createThread
    // stores input.entityType verbatim, and nothing normalises case anywhere in
    // that module. A lowercase "opportunity" here matches zero rows in Postgres,
    // which would make this guard silently dead and let an entry with live comms
    // threads be deleted - the exact outcome "delete only when empty" exists to
    // prevent. The literal below MUST stay in sync with COMM_ENTITY_TYPES.
    const threadCount = await this.prisma.commThread.count({
      where: { entityType: "OPPORTUNITY", entityId: id }
    });
    if (threadCount > 0) blockers.push("commThread");

    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete entry ${id}: the following fields are not empty: ${blockers.join(", ")}. ` +
          `Archive the entry instead — archive is reversible, delete is not.`
      );
    }

    await this.prisma.opportunity.delete({ where: { id } });
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

  // ── DropReason CRUD ──────────────────────────────────────────────────────

  async listDropReasons() {
    return this.prisma.dropReason.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
  }

  async createDropReason(dto: CreateDropReasonDto) {
    const existing = await this.prisma.dropReason.findUnique({
      where: { label: dto.label },
      select: { id: true }
    });
    if (existing) {
      throw new ConflictException(`A drop reason with label "${dto.label}" already exists.`);
    }
    return this.prisma.dropReason.create({
      data: {
        label: dto.label,
        sortOrder: dto.sortOrder ?? 0
      }
    });
  }

  async updateDropReason(id: string, dto: UpdateDropReasonDto) {
    const existing = await this.prisma.dropReason.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`DropReason ${id} not found.`);

    const data: Record<string, unknown> = {};
    if (dto.label !== undefined) data["label"] = dto.label;
    if (dto.sortOrder !== undefined) data["sortOrder"] = dto.sortOrder;
    if (dto.isActive !== undefined) data["isActive"] = dto.isActive;

    return this.prisma.dropReason.update({ where: { id }, data });
  }

  async deleteDropReason(id: string) {
    const existing = await this.prisma.dropReason.findUnique({
      where: { id },
      include: { _count: { select: { opportunities: true, archivedOpportunities: true } } }
    });
    if (!existing) throw new NotFoundException(`DropReason ${id} not found.`);
    const totalUsage = existing._count.opportunities + existing._count.archivedOpportunities;
    if (totalUsage > 0) {
      throw new ConflictException(
        `DropReason ${id} is referenced by ${totalUsage} opportunity(s) and cannot be deleted.`
      );
    }
    await this.prisma.dropReason.delete({ where: { id } });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private opportunityInclude() {
    return {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      convertedTender: { select: { id: true, tenderNumber: true, status: true } },
      dropReason: { select: { id: true, label: true } },
      archiveReason: { select: { id: true, label: true } }
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
