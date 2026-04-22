import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { TenderQueryDto } from "./dto/tender-query.dto";
import {
  CreateTenderActivityDto,
  CreateTenderClarificationDto,
  CreateTenderFollowUpDto,
  CreateTenderNoteDto,
  UpdateTenderActivityDto,
  UpsertTenderDto
} from "./dto/tender.dto";

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
    const where: Prisma.TenderWhereInput | undefined = query.q
      ? {
          OR: [
            { tenderNumber: { contains: query.q, mode: "insensitive" } },
            { title: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : undefined;

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tender.findMany({
        where,
        include: tenderInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
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
    if (status === "SUBMITTED" && !existing.submittedAt) data.submittedAt = now;
    if ((status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED") && !existing.wonAt) {
      data.wonAt = now;
      if (!existing.submittedAt) data.submittedAt = now;
    }
    if (status === "LOST" && !existing.lostAt) {
      data.lostAt = now;
      if (!existing.submittedAt) data.submittedAt = now;
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
