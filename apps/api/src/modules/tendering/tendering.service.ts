import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { QuickEditDto, TenderQueryDto, TenderSortField } from "./dto/tender-query.dto";
import {
  CreateTenderActivityDto,
  CreateTenderClarificationDto,
  CreateTenderFollowUpDto,
  CreateTenderNoteDto,
  UpdateTenderActivityDto,
  UpsertTenderDto
} from "./dto/tender.dto";
import {
  CreateTenderFilterPresetDto,
  UpdateTenderFilterPresetDto
} from "./dto/tender-filter-preset.dto";

const tenderInclude = {
  estimator: {
    select: {
      id: true,
      firstName: true,
      lastName: true
    }
  },
  tenderClients: {
    include: {
      client: true,
      contact: true,
      jobConversion: {
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              name: true,
              status: true
            }
          }
        }
      }
    }
  },
  tenderNotes: {
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  clarifications: true,
  pricingSnapshots: true,
  followUps: {
    include: {
      assignedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  outcomes: true
  ,
  tenderDocuments: {
    include: {
      folderLink: true,
      fileLink: true
    }
  },
  sourceJob: {
    select: {
      id: true,
      jobNumber: true,
      name: true,
      status: true
    }
  }
} as const;

@Injectable()
export class TenderingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly email: EmailService
  ) {}

  async list(query: TenderQueryDto) {
    const where = this.buildTenderWhere(query);
    const orderBy = this.buildTenderOrderBy(query.sortBy, query.sortDir);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tender.findMany({
        where,
        include: tenderInclude,
        orderBy,
        skip,
        take: query.pageSize
      }),
      this.prisma.tender.count({ where })
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  private buildTenderWhere(query: TenderQueryDto): Prisma.TenderWhereInput | undefined {
    const clauses: Prisma.TenderWhereInput[] = [];

    if (query.q) {
      clauses.push({
        OR: [
          { tenderNumber: { contains: query.q, mode: "insensitive" } },
          { title: { contains: query.q, mode: "insensitive" } },
          { tenderClients: { some: { client: { name: { contains: query.q, mode: "insensitive" } } } } }
        ]
      });
    }

    if (query.status?.length) {
      clauses.push({ status: { in: query.status } });
    }

    if (query.estimatorId) {
      clauses.push({ estimatorUserId: query.estimatorId });
    }

    if (query.clientId) {
      clauses.push({ tenderClients: { some: { clientId: query.clientId } } });
    }

    if (query.discipline) {
      clauses.push({ scopeItems: { some: { discipline: query.discipline } } });
    }

    if (query.valueMin || query.valueMax) {
      const valueFilter: Prisma.DecimalFilter = {};
      if (query.valueMin) valueFilter.gte = new Prisma.Decimal(query.valueMin);
      if (query.valueMax) valueFilter.lte = new Prisma.Decimal(query.valueMax);
      clauses.push({ estimatedValue: valueFilter });
    }

    if (query.dueDateFrom || query.dueDateTo) {
      const due: Prisma.DateTimeFilter = {};
      if (query.dueDateFrom) due.gte = new Date(query.dueDateFrom);
      if (query.dueDateTo) due.lte = new Date(query.dueDateTo);
      clauses.push({ dueDate: due });
    }

    if (query.probability) {
      const bucket = query.probability.toLowerCase();
      if (bucket === "hot") clauses.push({ probability: { gte: 70 } });
      else if (bucket === "warm") clauses.push({ probability: { gte: 30, lt: 70 } });
      else if (bucket === "cold") clauses.push({ probability: { lt: 30 } });
    }

    if (!clauses.length) return undefined;
    return clauses.length === 1 ? clauses[0] : { AND: clauses };
  }

  private buildTenderOrderBy(
    sortBy: TenderSortField | undefined,
    sortDir: "asc" | "desc" | undefined
  ): Prisma.TenderOrderByWithRelationInput | Prisma.TenderOrderByWithRelationInput[] {
    const dir = sortDir === "asc" ? "asc" : "desc";
    switch (sortBy) {
      case "tenderNumber":
        return { tenderNumber: dir };
      case "name":
      case "title":
        return { title: dir };
      case "value":
      case "estimatedValue":
        return { estimatedValue: dir };
      case "dueDate":
        return { dueDate: dir };
      case "createdAt":
        return { createdAt: dir };
      case "updatedAt":
        return { updatedAt: dir };
      case "status":
        return { status: dir };
      case "probability":
        return { probability: dir };
      default:
        return [{ dueDate: "asc" }, { createdAt: "desc" }];
    }
  }

  async bulkUpdateStatus(tenderIds: string[], status: string, actorId?: string) {
    if (!tenderIds.length) {
      throw new BadRequestException("tenderIds must not be empty.");
    }
    if (tenderIds.length > 50) {
      throw new BadRequestException("A maximum of 50 tenders can be updated in one batch.");
    }
    const uniqueIds = Array.from(new Set(tenderIds));

    const existing = await this.prisma.tender.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true, submittedAt: true, ratesSnapshotAt: true, wonAt: true, lostAt: true, tenderScoreCounted: true }
    });
    const missing = uniqueIds.filter((id) => !existing.some((tender) => tender.id === id));
    if (missing.length) {
      throw new NotFoundException(`Tenders not found: ${missing.join(", ")}`);
    }

    const now = new Date();
    const isWon = status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED";
    const isScorable = isWon || status === "SUBMITTED" || status === "LOST";

    const updated = await this.prisma.$transaction(
      existing.map((tender) => {
        const data: Prisma.TenderUpdateInput = { status };
        if (status === "SUBMITTED" && !tender.submittedAt) {
          data.submittedAt = now;
          if (!tender.ratesSnapshotAt) data.ratesSnapshotAt = now;
        }
        if (isWon && !tender.wonAt) {
          data.wonAt = now;
          if (!tender.submittedAt) {
            data.submittedAt = now;
            if (!tender.ratesSnapshotAt) data.ratesSnapshotAt = now;
          }
        }
        if (status === "LOST" && !tender.lostAt) {
          data.lostAt = now;
          if (!tender.submittedAt) {
            data.submittedAt = now;
            if (!tender.ratesSnapshotAt) data.ratesSnapshotAt = now;
          }
        }
        if (isScorable && !tender.tenderScoreCounted) {
          data.tenderScoreCounted = true;
        }
        return this.prisma.tender.update({
          where: { id: tender.id },
          data,
          select: { id: true, tenderNumber: true, status: true }
        });
      })
    );

    // Client scoring — update outside the main transaction (same pattern as updateStatus).
    for (const tender of existing) {
      if (isScorable && !tender.tenderScoreCounted) {
        await this.updateClientScores(tender.id, isWon);
      } else if (isWon && tender.tenderScoreCounted) {
        await this.bumpWinCount(tender.id);
      }
    }

    await this.auditService.write({
      actorId,
      action: "tenders.bulk-status.update",
      entityType: "Tender",
      entityId: uniqueIds.join(","),
      metadata: { count: updated.length, status }
    });

    return {
      updated: updated.length,
      tenders: updated
    };
  }

  async quickEdit(id: string, dto: QuickEditDto, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }

    const data: Prisma.TenderUpdateInput = {};
    const changed: string[] = [];

    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
      changed.push(`status: ${existing.status} → ${dto.status}`);
    }
    if (dto.probability !== undefined && dto.probability !== existing.probability) {
      data.probability = dto.probability;
      changed.push(`probability: ${existing.probability ?? "—"} → ${dto.probability ?? "—"}`);
    }
    if (dto.dueDate !== undefined) {
      const next = dto.dueDate ? new Date(dto.dueDate) : null;
      const existingIso = existing.dueDate?.toISOString() ?? null;
      const nextIso = next?.toISOString() ?? null;
      if (existingIso !== nextIso) {
        data.dueDate = next;
        changed.push(`dueDate: ${existingIso ?? "—"} → ${nextIso ?? "—"}`);
      }
    }
    if (dto.value !== undefined) {
      const next = dto.value ? new Prisma.Decimal(dto.value) : null;
      const existingNum = existing.estimatedValue ? existing.estimatedValue.toString() : null;
      const nextNum = next ? next.toString() : null;
      if (existingNum !== nextNum) {
        data.estimatedValue = next;
        changed.push(`value: ${existingNum ?? "—"} → ${nextNum ?? "—"}`);
      }
    }
    if (dto.assignedEstimatorId !== undefined) {
      if (dto.assignedEstimatorId && dto.assignedEstimatorId !== existing.estimatorUserId) {
        data.estimator = { connect: { id: dto.assignedEstimatorId } };
        changed.push(`estimator: ${existing.estimatorUserId ?? "—"} → ${dto.assignedEstimatorId}`);
      } else if (dto.assignedEstimatorId === null && existing.estimatorUserId) {
        data.estimator = { disconnect: true };
        changed.push(`estimator: ${existing.estimatorUserId} → —`);
      }
    }

    if (!changed.length) {
      return this.getById(id);
    }

    await this.prisma.tender.update({ where: { id }, data });

    let actorLabel = "Someone";
    if (actorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true }
      });
      if (actor) actorLabel = `${actor.firstName} ${actor.lastName}`;
    }

    await this.prisma.tenderNote.create({
      data: {
        tenderId: id,
        authorUserId: actorId,
        body: `Quick edit by ${actorLabel}: ${changed.join("; ")}`
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.quick-edit",
      entityType: "Tender",
      entityId: id,
      metadata: { changed }
    });

    return this.getById(id);
  }

  async listFilterPresets(userId: string) {
    return this.prisma.tenderFilterPreset.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    });
  }

  async createFilterPreset(userId: string, dto: CreateTenderFilterPresetDto) {
    if (dto.isDefault) {
      await this.prisma.tenderFilterPreset.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }
    try {
      return await this.prisma.tenderFilterPreset.create({
        data: {
          userId,
          name: dto.name,
          filters: dto.filters as Prisma.InputJsonValue,
          isDefault: dto.isDefault ?? false
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A preset with this name already exists.");
      }
      throw err;
    }
  }

  async updateFilterPreset(userId: string, id: string, dto: UpdateTenderFilterPresetDto) {
    const existing = await this.prisma.tenderFilterPreset.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException("Filter preset not found.");
    }
    if (dto.isDefault === true && !existing.isDefault) {
      await this.prisma.tenderFilterPreset.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false }
      });
    }
    try {
      return await this.prisma.tenderFilterPreset.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          filters: dto.filters !== undefined ? (dto.filters as Prisma.InputJsonValue) : undefined,
          isDefault: dto.isDefault !== undefined ? dto.isDefault : undefined
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A preset with this name already exists.");
      }
      throw err;
    }
  }

  async deleteFilterPreset(userId: string, id: string) {
    const existing = await this.prisma.tenderFilterPreset.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException("Filter preset not found.");
    }
    await this.prisma.tenderFilterPreset.delete({ where: { id } });
    return { id };
  }

  async getById(id: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      include: tenderInclude
    });

    if (!tender) {
      throw new NotFoundException("Tender not found.");
    }

    return tender;
  }

  async create(dto: UpsertTenderDto, actorId?: string) {
    await this.ensureUniqueTenderNumber(dto.tenderNumber);
    this.validateAwardedClients(dto.tenderClients ?? []);

    const tender = await this.prisma.tender.create({
      data: this.toTenderCreateInput(dto, actorId),
      include: tenderInclude
    });

    await this.auditService.write({
      actorId,
      action: "tenders.create",
      entityType: "Tender",
      entityId: tender.id,
      metadata: { tenderNumber: tender.tenderNumber }
    });

    return tender;
  }

  async duplicate(id: string, actorId?: string) {
    const source = await this.prisma.tender.findUnique({
      where: { id },
      include: {
        tenderClients: true
      }
    });
    if (!source) {
      throw new NotFoundException("Tender not found.");
    }

    const newNumber = await this.generateDuplicateNumber(source.tenderNumber);

    const tender = await this.prisma.tender.create({
      data: {
        tenderNumber: newNumber,
        title: `${source.title} (copy)`,
        description: source.description,
        status: "DRAFT",
        dueDate: source.dueDate ?? undefined,
        proposedStartDate: source.proposedStartDate ?? undefined,
        leadTimeDays: source.leadTimeDays ?? undefined,
        probability: source.probability ?? undefined,
        estimatedValue: source.estimatedValue ?? undefined,
        notes: source.notes,
        estimator: source.estimatorUserId ? { connect: { id: source.estimatorUserId } } : undefined,
        tenderClients: source.tenderClients.length
          ? {
              create: source.tenderClients.map((item) => ({
                client: { connect: { id: item.clientId } },
                contact: item.contactId ? { connect: { id: item.contactId } } : undefined,
                isAwarded: false,
                contractIssued: false,
                relationshipType: item.relationshipType,
                notes: item.notes
              }))
            }
          : undefined
      },
      include: tenderInclude
    });

    await this.auditService.write({
      actorId,
      action: "tenders.duplicate",
      entityType: "Tender",
      entityId: tender.id,
      metadata: { sourceTenderId: id, tenderNumber: tender.tenderNumber }
    });

    return tender;
  }

  private async generateDuplicateNumber(sourceNumber: string): Promise<string> {
    for (let suffix = 1; suffix <= 99; suffix += 1) {
      const candidate = `${sourceNumber}-COPY${suffix > 1 ? suffix : ""}`;
      const existing = await this.prisma.tender.findFirst({
        where: { tenderNumber: candidate },
        select: { id: true }
      });
      if (!existing) return candidate;
    }
    return `${sourceNumber}-COPY${Date.now()}`;
  }

  async updateStatus(id: string, status: string, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }
    const now = new Date();
    const data: Prisma.TenderUpdateInput = { status };
    // First transition to SUBMITTED pins submittedAt AND freezes the rate
    // snapshot timestamp — the Quote tab uses this to display "Rates as of
    // [date]" and rates admin can warn if the library moves afterwards.
    if (status === "SUBMITTED" && !existing.submittedAt) {
      data.submittedAt = now;
      if (!existing.ratesSnapshotAt) data.ratesSnapshotAt = now;
    }
    if ((status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED") && !existing.wonAt) {
      data.wonAt = now;
      if (!existing.submittedAt) {
        data.submittedAt = now;
        if (!existing.ratesSnapshotAt) data.ratesSnapshotAt = now;
      }
    }
    if (status === "LOST" && !existing.lostAt) {
      data.lostAt = now;
      if (!existing.submittedAt) {
        data.submittedAt = now;
        if (!existing.ratesSnapshotAt) data.ratesSnapshotAt = now;
      }
    }
    const tender = await this.prisma.tender.update({
      where: { id },
      data,
      include: tenderInclude
    });
    await this.auditService.write({
      actorId,
      action: "tenders.status.update",
      entityType: "Tender",
      entityId: id,
      metadata: { from: existing.status, to: status }
    });

    // Client scoring — SUBMITTED/AWARDED/LOST all count as a tender the
    // client considered. Each linked client is updated once (flag on the
    // Tender prevents double-counting when status flips back and forth).
    const isWon = status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED";
    const isScorable = isWon || status === "SUBMITTED" || status === "LOST";
    if (isScorable && !existing.tenderScoreCounted) {
      await this.updateClientScores(id, isWon);
      await this.prisma.tender.update({
        where: { id },
        data: { tenderScoreCounted: true }
      });
    } else if (isWon && existing.tenderScoreCounted) {
      // Tender was previously submitted/lost (tenderCount incremented) and
      // is now being won — bump winCount without double-counting tenderCount.
      await this.bumpWinCount(id);
    }

    // Fire-and-forget email for the SUBMITTED transition only. sendNotificationEmail
    // already swallows errors internally but the Promise is still detached here
    // so a slow SMTP never blocks the write path.
    if (status === "SUBMITTED" && existing.status !== "SUBMITTED") {
      const clientName = tender.tenderClients[0]?.client?.name ?? "(no client)";
      const value = tender.estimatedValue ? `$${Number(tender.estimatedValue).toLocaleString("en-AU")}` : "TBA";
      void this.email.sendNotificationEmail({
        trigger: "tender.submitted",
        subject: `Tender submitted — ${tender.tenderNumber} ${tender.title}`,
        html: `<p>Tender <strong>${tender.tenderNumber} — ${tender.title}</strong> has been submitted.</p><p>Client: ${clientName}</p><p>Estimated value: ${value}</p>`,
        text: `Tender ${tender.tenderNumber} — ${tender.title} submitted. Client: ${clientName}. Value: ${value}.`
      });
    }

    return tender;
  }

  async updateProbability(id: string, probability: number | null, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }
    const tender = await this.prisma.tender.update({
      where: { id },
      data: { probability },
      include: tenderInclude
    });
    await this.auditService.write({
      actorId,
      action: "tenders.probability.update",
      entityType: "Tender",
      entityId: id,
      metadata: { from: existing.probability, to: probability }
    });
    return tender;
  }

  async update(id: string, dto: UpsertTenderDto, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }

    if (dto.tenderNumber !== existing.tenderNumber) {
      await this.ensureUniqueTenderNumber(dto.tenderNumber, id);
    }

    this.validateAwardedClients(dto.tenderClients ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id },
        data: this.toTenderUpdateInput(dto)
      });

      await tx.tenderClient.deleteMany({ where: { tenderId: id } });
      await tx.tenderNote.deleteMany({ where: { tenderId: id } });
      await tx.tenderClarification.deleteMany({ where: { tenderId: id } });
      await tx.tenderPricingSnapshot.deleteMany({ where: { tenderId: id } });
      await tx.tenderFollowUp.deleteMany({ where: { tenderId: id } });
      await tx.tenderOutcome.deleteMany({ where: { tenderId: id } });

      if (dto.tenderClients?.length) {
        await tx.tenderClient.createMany({
          data: dto.tenderClients.map((item) => ({
            tenderId: id,
            clientId: item.clientId,
            contactId: item.contactId,
            isAwarded: item.isAwarded ?? false,
            relationshipType: item.relationshipType,
            notes: item.notes
          }))
        });
      }

      for (const note of dto.tenderNotes ?? []) {
        await tx.tenderNote.create({
          data: {
            tenderId: id,
            authorUserId: actorId,
            body: note.body
          }
        });
      }

      if (dto.clarifications?.length) {
        await tx.tenderClarification.createMany({
          data: dto.clarifications.map((item) => ({
            tenderId: id,
            subject: item.subject,
            response: item.response,
            status: item.status ?? "OPEN",
            dueDate: item.dueDate ? new Date(item.dueDate) : null
          }))
        });
      }

      if (dto.pricingSnapshots?.length) {
        await tx.tenderPricingSnapshot.createMany({
          data: dto.pricingSnapshots.map((item) => ({
            tenderId: id,
            versionLabel: item.versionLabel,
            estimatedValue: item.estimatedValue ? new Prisma.Decimal(item.estimatedValue) : null,
            marginPercent: item.marginPercent ? new Prisma.Decimal(item.marginPercent) : null,
            assumptions: item.assumptions
          }))
        });
      }

      if (dto.followUps?.length) {
        await tx.tenderFollowUp.createMany({
          data: dto.followUps.map((item) => ({
            tenderId: id,
            dueAt: new Date(item.dueAt),
            status: item.status ?? "OPEN",
            details: item.details,
            assignedUserId: item.assignedUserId
          }))
        });
      }

      if (dto.outcomes?.length) {
        await tx.tenderOutcome.createMany({
          data: dto.outcomes.map((item) => ({
            tenderId: id,
            outcomeType: item.outcomeType,
            notes: item.notes
          }))
        });
      }

    });

    const tender = await this.getById(id);

    await this.auditService.write({
      actorId,
      action: "tenders.update",
      entityType: "Tender",
      entityId: id,
      metadata: { tenderNumber: tender.tenderNumber }
    });

    return tender;
  }

  async addNote(tenderId: string, dto: CreateTenderNoteDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    await this.prisma.tenderNote.create({
      data: {
        tenderId,
        authorUserId: actorId,
        body: dto.body
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.note.create",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { bodyLength: dto.body.length }
    });

    return this.getById(tenderId);
  }

  async addClarification(tenderId: string, dto: CreateTenderClarificationDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    await this.prisma.tenderClarification.create({
      data: {
        tenderId,
        subject: dto.subject,
        response: dto.response,
        status: dto.status ?? "OPEN",
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.clarification.create",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { subject: dto.subject }
    });

    return this.getById(tenderId);
  }

  async addFollowUp(tenderId: string, dto: CreateTenderFollowUpDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    await this.prisma.tenderFollowUp.create({
      data: {
        tenderId,
        dueAt: new Date(dto.dueAt),
        details: dto.details,
        status: dto.status ?? "OPEN",
        assignedUserId: dto.assignedUserId
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.followup.create",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { details: dto.details }
    });

    return this.getById(tenderId);
  }

  async listActivities(tenderId: string) {
    const tender = await this.getById(tenderId);
    return this.mapTenderActivities(tender);
  }

  async addActivity(tenderId: string, dto: CreateTenderActivityDto, actorId?: string) {
    const normalizedType = dto.activityType.toUpperCase();

    if (normalizedType === "NOTE" || normalizedType === "INTERNAL_NOTE") {
      return this.addNote(
        tenderId,
        {
          body: dto.details?.trim() ? `${dto.title}\n\n${dto.details}` : dto.title
        },
        actorId
      );
    }

    if (normalizedType === "CLARIFICATION") {
      return this.addClarification(
        tenderId,
        {
          subject: dto.title,
          response: dto.details,
          status: dto.status ?? "OPEN",
          dueDate: dto.dueAt
        },
        actorId
      );
    }

    const followUpTypes = new Set(["FOLLOW_UP", "FOLLOW-UP", "CALL", "MEETING", "SUBMISSION_TASK", "TASK"]);
    if (followUpTypes.has(normalizedType)) {
      if (!dto.dueAt) {
        throw new BadRequestException("Tender activities of this type require a due date.");
      }

      return this.addFollowUp(
        tenderId,
        {
          dueAt: dto.dueAt,
          details: dto.details?.trim() ? `${dto.title}: ${dto.details}` : dto.title,
          status: dto.status ?? "OPEN",
          assignedUserId: dto.assignedUserId
        },
        actorId
      );
    }

    throw new BadRequestException("Unsupported tender activity type.");
  }

  async updateActivity(tenderId: string, activityId: string, dto: UpdateTenderActivityDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    const [activityType, sourceId] = activityId.split(":");
    if (!activityType || !sourceId) {
      throw new BadRequestException("Invalid tender activity identifier.");
    }

    if (activityType === "clarification") {
      await this.prisma.tenderClarification.update({
        where: { id: sourceId },
        data: {
          subject: dto.title,
          response: dto.details,
          status: dto.status,
          dueDate: dto.dueAt ? new Date(dto.dueAt) : dto.dueAt === "" ? null : undefined
        }
      });

      await this.auditService.write({
        actorId,
        action: "tenders.clarification.update",
        entityType: "Tender",
        entityId: tenderId,
        metadata: { activityId }
      });

      return this.getById(tenderId);
    }

    if (activityType === "follow-up") {
      await this.prisma.tenderFollowUp.update({
        where: { id: sourceId },
        data: {
          details: dto.details?.trim() ? dto.details : dto.title,
          status: dto.status,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          assignedUserId: dto.assignedUserId === "" ? null : dto.assignedUserId
        }
      });

      await this.auditService.write({
        actorId,
        action: "tenders.followup.update",
        entityType: "Tender",
        entityId: tenderId,
        metadata: { activityId }
      });

      return this.getById(tenderId);
    }

    throw new BadRequestException("This tender activity type cannot be updated yet.");
  }

  async previewImport(csvText: string) {
    const rows = this.parseImportCsv(csvText);
    const existingNumbers = await this.findExistingTenderNumbers(rows.map((row) => row.tenderNumber).filter(Boolean));

    return {
      totalRows: rows.length,
      rows: rows.map((row, index) => ({
        rowNumber: index + 1,
        tenderNumber: row.tenderNumber,
        title: row.title,
        clientNames: row.clientNames,
        status: row.status ?? "DRAFT",
        duplicate: existingNumbers.has((row.tenderNumber ?? "").toLowerCase()),
        valid: Boolean(row.tenderNumber && row.title) && !existingNumbers.has((row.tenderNumber ?? "").toLowerCase())
      }))
    };
  }

  async commitImport(csvText: string, actorId?: string) {
    const rows = this.parseImportCsv(csvText);
    const createdIds: string[] = [];
    const skipped: Array<{ tenderNumber: string; reason: string }> = [];
    const existingNumbers = await this.findExistingTenderNumbers(rows.map((row) => row.tenderNumber).filter(Boolean));

    for (const row of rows) {
      if (!row.tenderNumber || !row.title) {
        skipped.push({ tenderNumber: row.tenderNumber || "(missing)", reason: "Missing tender number or title" });
        continue;
      }

      if (existingNumbers.has(row.tenderNumber.toLowerCase())) {
        skipped.push({ tenderNumber: row.tenderNumber, reason: "Tender number already exists" });
        continue;
      }

      const clientIds = await this.lookupClientIds(row.clientNames);
      if (!clientIds.length) {
        skipped.push({ tenderNumber: row.tenderNumber, reason: "No matching linked clients found" });
        continue;
      }

      const tender = await this.create(
        {
          tenderNumber: row.tenderNumber,
          title: row.title,
          description: row.description,
          status: row.status ?? "DRAFT",
          probability: row.probability ? Number(row.probability) : undefined,
          estimatedValue: row.estimatedValue,
          dueDate: row.dueDate,
          proposedStartDate: row.proposedStartDate,
          leadTimeDays: row.leadTimeDays ? Number(row.leadTimeDays) : undefined,
          estimatorUserId: row.estimatorUserId,
          tenderClients: clientIds.map((clientId, index) => ({
            clientId,
            isAwarded: index === 0 && row.awardedClientName
              ? row.awardedClientName.toLowerCase() === row.clientNames[index]?.toLowerCase()
              : false
          })),
          tenderNotes: row.initialNote ? [{ body: row.initialNote }] : undefined,
          followUps: row.followUpDetails && row.followUpDueAt
            ? [{ details: row.followUpDetails, dueAt: row.followUpDueAt, status: "OPEN" }]
            : undefined
        },
        actorId
      );

      createdIds.push(tender.id);
      existingNumbers.add(row.tenderNumber.toLowerCase());
    }

    return {
      createdCount: createdIds.length,
      createdIds,
      skipped
    };
  }

  // Client scoring — increment winCount/tenderCount across every client
  // linked to the tender. Called exactly once per tender (Tender.tenderScoreCounted).
  private async updateClientScores(tenderId: string, isWin: boolean) {
    const links = await this.prisma.tenderClient.findMany({
      where: { tenderId },
      select: { clientId: true }
    });
    if (links.length === 0) return;
    const now = new Date();
    for (const link of links) {
      const client = await this.prisma.client.findUnique({
        where: { id: link.clientId },
        select: { winCount: true, tenderCount: true }
      });
      if (!client) continue;
      const nextTenderCount = client.tenderCount + 1;
      const nextWinCount = client.winCount + (isWin ? 1 : 0);
      const nextWinRate =
        nextTenderCount > 0 ? Number(((nextWinCount / nextTenderCount) * 100).toFixed(2)) : 0;
      await this.prisma.client.update({
        where: { id: link.clientId },
        data: {
          tenderCount: nextTenderCount,
          winCount: nextWinCount,
          winRate: nextWinRate,
          lastTenderAt: now,
          lastWonAt: isWin ? now : undefined
        }
      });
    }
  }

  // Tender previously counted as a loss/submission and is now being won —
  // tenderCount stays put but winCount goes up.
  private async bumpWinCount(tenderId: string) {
    const links = await this.prisma.tenderClient.findMany({
      where: { tenderId },
      select: { clientId: true }
    });
    const now = new Date();
    for (const link of links) {
      const client = await this.prisma.client.findUnique({
        where: { id: link.clientId },
        select: { winCount: true, tenderCount: true }
      });
      if (!client) continue;
      const nextWinCount = client.winCount + 1;
      const nextWinRate =
        client.tenderCount > 0 ? Number(((nextWinCount / client.tenderCount) * 100).toFixed(2)) : 0;
      await this.prisma.client.update({
        where: { id: link.clientId },
        data: { winCount: nextWinCount, winRate: nextWinRate, lastWonAt: now }
      });
    }
  }

  private async ensureUniqueTenderNumber(tenderNumber: string, ignoreId?: string) {
    const existing = await this.prisma.tender.findFirst({
      where: {
        tenderNumber,
        ...(ignoreId ? { NOT: { id: ignoreId } } : {})
      }
    });

    if (existing) {
      throw new ConflictException("Tender number already exists.");
    }
  }

  private validateAwardedClients(tenderClients: NonNullable<UpsertTenderDto["tenderClients"]>) {
    const awarded = tenderClients.filter((item) => item.isAwarded);
    if (awarded.length > 1) {
      throw new BadRequestException("Only one tender client can be marked as awarded.");
    }
  }

  private async ensureTenderExists(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!tender) {
      throw new NotFoundException("Tender not found.");
    }
  }

  private parseImportCsv(csvText: string) {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split(",").map((item) => item.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((item) => item.trim());
      const record = headers.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = values[index] ?? "";
        return accumulator;
      }, {});

      return {
        tenderNumber: record.tenderNumber,
        title: record.title,
        description: record.description,
        status: record.status,
        probability: record.probability,
        estimatedValue: record.estimatedValue,
        dueDate: record.dueDate,
        proposedStartDate: record.proposedStartDate,
        leadTimeDays: record.leadTimeDays,
        clientNames: record.clientNames ? record.clientNames.split("|").map((item) => item.trim()).filter(Boolean) : [],
        awardedClientName: record.awardedClientName,
        estimatorUserId: record.estimatorUserId,
        initialNote: record.initialNote,
        followUpDetails: record.followUpDetails,
        followUpDueAt: record.followUpDueAt
      };
    });
  }

  private async lookupClientIds(clientNames: string[]) {
    const clientIds: string[] = [];

    for (const clientName of clientNames) {
      const client = await this.prisma.client.findFirst({
        where: {
          name: {
            equals: clientName,
            mode: "insensitive"
          }
        },
        select: { id: true }
      });

      if (client) {
        clientIds.push(client.id);
      }
    }

    return clientIds;
  }

  private async findExistingTenderNumbers(tenderNumbers: string[]) {
    if (!tenderNumbers.length) {
      return new Set<string>();
    }

    const existing = await this.prisma.tender.findMany({
      where: {
        tenderNumber: {
          in: tenderNumbers
        }
      },
      select: {
        tenderNumber: true
      }
    });

    return new Set(existing.map((item) => item.tenderNumber.toLowerCase()));
  }

  private toTenderCreateInput(dto: UpsertTenderDto, actorId?: string): Prisma.TenderCreateInput {
    return {
      tenderNumber: dto.tenderNumber,
      title: dto.title,
      description: dto.description,
      status: dto.status ?? "DRAFT",
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : undefined,
      leadTimeDays: dto.leadTimeDays,
      probability: dto.probability,
      estimatedValue: dto.estimatedValue ? new Prisma.Decimal(dto.estimatedValue) : undefined,
      notes: dto.notes,
      estimator: dto.estimatorUserId ? { connect: { id: dto.estimatorUserId } } : undefined,
      tenderClients: dto.tenderClients?.length
        ? {
            create: dto.tenderClients.map((item) => ({
              client: { connect: { id: item.clientId } },
              contact: item.contactId ? { connect: { id: item.contactId } } : undefined,
              isAwarded: item.isAwarded ?? false,
              relationshipType: item.relationshipType,
              notes: item.notes
            }))
          }
        : undefined,
      tenderNotes: dto.tenderNotes?.length
        ? {
            create: dto.tenderNotes.map((item) => ({
              body: item.body,
              author: actorId ? { connect: { id: actorId } } : undefined
            }))
          }
        : undefined,
      clarifications: dto.clarifications?.length
        ? {
            create: dto.clarifications.map((item) => ({
              subject: item.subject,
              response: item.response,
              status: item.status ?? "OPEN",
              dueDate: item.dueDate ? new Date(item.dueDate) : undefined
            }))
          }
        : undefined,
      pricingSnapshots: dto.pricingSnapshots?.length
        ? {
            create: dto.pricingSnapshots.map((item) => ({
              versionLabel: item.versionLabel,
              estimatedValue: item.estimatedValue ? new Prisma.Decimal(item.estimatedValue) : undefined,
              marginPercent: item.marginPercent ? new Prisma.Decimal(item.marginPercent) : undefined,
              assumptions: item.assumptions
            }))
          }
        : undefined,
      followUps: dto.followUps?.length
        ? {
            create: dto.followUps.map((item) => ({
              dueAt: new Date(item.dueAt),
              status: item.status ?? "OPEN",
              details: item.details,
              assignedUser: item.assignedUserId ? { connect: { id: item.assignedUserId } } : undefined
            }))
          }
        : undefined,
      outcomes: dto.outcomes?.length
        ? {
            create: dto.outcomes.map((item) => ({
              outcomeType: item.outcomeType,
              notes: item.notes
            }))
          }
        : undefined,
    };
  }

  private toTenderUpdateInput(dto: UpsertTenderDto): Prisma.TenderUpdateInput {
    return {
      tenderNumber: dto.tenderNumber,
      title: dto.title,
      description: dto.description,
      status: dto.status ?? "DRAFT",
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null,
      leadTimeDays: dto.leadTimeDays ?? null,
      probability: dto.probability ?? null,
      estimatedValue: dto.estimatedValue ? new Prisma.Decimal(dto.estimatedValue) : null,
      notes: dto.notes ?? null,
      estimator: dto.estimatorUserId ? { connect: { id: dto.estimatorUserId } } : { disconnect: true }
    };
  }

  private mapTenderActivities(tender: Awaited<ReturnType<TenderingService["getById"]>>) {
    return [
      ...tender.tenderNotes.map((item) => ({
        id: `note:${item.id}`,
        sourceId: item.id,
        activityType: "NOTE",
        title: item.body.split("\n")[0] ?? item.body,
        details: item.body,
        status: "RECORDED",
        dueAt: null,
        completedAt: item.createdAt,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        assignedUser: item.author
          ? {
              id: item.author.id,
              firstName: item.author.firstName,
              lastName: item.author.lastName
            }
          : null
      })),
      ...tender.clarifications.map((item) => ({
        id: `clarification:${item.id}`,
        sourceId: item.id,
        activityType: "CLARIFICATION",
        title: item.subject,
        details: item.response ?? item.subject,
        status: item.status,
        dueAt: item.dueDate,
        completedAt: item.status === "CLOSED" ? item.updatedAt : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        assignedUser: null
      })),
      ...tender.followUps.map((item) => ({
        id: `follow-up:${item.id}`,
        sourceId: item.id,
        activityType: "FOLLOW_UP",
        title: item.details,
        details: item.details,
        status: item.status,
        dueAt: item.dueAt,
        completedAt: item.status === "DONE" ? item.updatedAt : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        assignedUser: item.assignedUser
          ? {
              id: item.assignedUser.id,
              firstName: item.assignedUser.firstName,
              lastName: item.assignedUser.lastName
            }
          : null
      }))
    ].sort((left, right) => {
      const leftTime = new Date(left.dueAt ?? left.updatedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.dueAt ?? right.updatedAt ?? right.createdAt).getTime();
      return rightTime - leftTime;
    });
  }
}
