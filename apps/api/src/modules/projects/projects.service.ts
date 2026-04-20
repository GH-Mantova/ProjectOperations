import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, ProjectActivityAction, ProjectStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../platform/notifications.service";
import type { CreateProjectDto } from "./dto/create-project.dto";
import type { ListProjectsQueryDto, ProjectStatusDto, UpdateProjectDto } from "./dto/update-project.dto";

type ActorContext = { userId: string; permissions: ReadonlySet<string> };

const TEAM_FIELDS = ["projectManagerId", "supervisorId", "estimatorId", "whsOfficerId"] as const;
type TeamField = (typeof TEAM_FIELDS)[number];

const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  MOBILISING: ["ACTIVE"],
  ACTIVE: ["PRACTICAL_COMPLETION"],
  PRACTICAL_COMPLETION: ["DEFECTS"],
  DEFECTS: ["CLOSED"],
  CLOSED: []
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  // ── Numbering ─────────────────────────────────────────────────────────
  async previewNextNumber() {
    const row = await this.prisma.projectNumberSequence.findUnique({ where: { id: 1 } });
    const next = (row?.lastNumber ?? 0) + 1;
    return { nextNumber: this.formatProjectNumber(next) };
  }

  private formatProjectNumber(n: number): string {
    return `IS-P${String(n).padStart(3, "0")}`;
  }

  private async allocateProjectNumber(tx: Prisma.TransactionClient): Promise<string> {
    // Row-lock the singleton sequence row, then bump it.
    await tx.$executeRaw`SELECT "last_number" FROM "project_number_sequences" WHERE "id" = 1 FOR UPDATE`;
    const updated = await tx.projectNumberSequence.upsert({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } }
    });
    return this.formatProjectNumber(updated.lastNumber);
  }

  // ── Listing / fetching ────────────────────────────────────────────────
  async list(query: ListProjectsQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const skip = (page - 1) * limit;

    const statuses = (query.status ?? "").split(",").map((s) => s.trim()).filter(Boolean) as ProjectStatus[];
    const where: Prisma.ProjectWhereInput = {
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.pmId ? { projectManagerId: query.pmId } : {}),
      ...(query.search
        ? {
            OR: [
              { projectNumber: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          projectManager: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit
      }),
      this.prisma.project.count({ where })
    ]);

    return {
      items: rows.map((p) => ({
        id: p.id,
        projectNumber: p.projectNumber,
        name: p.name,
        client: p.client,
        status: p.status,
        contractValue: p.contractValue.toString(),
        proposedStartDate: p.proposedStartDate,
        projectManager: p.projectManager,
        sourceTenderId: p.sourceTenderId
      })),
      total,
      page,
      limit
    };
  }

  async getById(id: string) {
    const record = await this.prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        sourceTender: { select: { id: true, tenderNumber: true, title: true } },
        projectManager: { select: { id: true, firstName: true, lastName: true, email: true } },
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
        estimator: { select: { id: true, firstName: true, lastName: true, email: true } },
        whsOfficer: { select: { id: true, firstName: true, lastName: true, email: true } },
        scopeItems: { orderBy: [{ scopeCode: "asc" }] },
        milestones: { orderBy: [{ order: "asc" }] },
        activityLog: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { user: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });
    if (!record) throw new NotFoundException("Project not found.");

    const variance = Number(record.budget) - Number(record.actualCost);
    return {
      ...record,
      contractValue: record.contractValue.toString(),
      budget: record.budget.toString(),
      actualCost: record.actualCost.toString(),
      variance: variance.toFixed(2)
    };
  }

  // ── Manual create (projects.admin) ────────────────────────────────────
  async createManual(dto: CreateProjectDto, actor: ActorContext) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new BadRequestException("Client not found.");

    const project = await this.prisma.$transaction(async (tx) => {
      const projectNumber = await this.allocateProjectNumber(tx);
      const created = await tx.project.create({
        data: {
          projectNumber,
          name: dto.name,
          clientId: dto.clientId,
          siteAddressLine1: dto.siteAddressLine1,
          siteAddressLine2: dto.siteAddressLine2,
          siteAddressSuburb: dto.siteAddressSuburb,
          siteAddressState: dto.siteAddressState,
          siteAddressPostcode: dto.siteAddressPostcode,
          contractValue: new Prisma.Decimal(dto.contractValue ?? "0"),
          budget: new Prisma.Decimal(dto.budget ?? "0"),
          proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null,
          projectManagerId: dto.projectManagerId ?? null,
          supervisorId: dto.supervisorId ?? null,
          estimatorId: dto.estimatorId ?? null,
          whsOfficerId: dto.whsOfficerId ?? null,
          estimateSnapshot: {} as Prisma.InputJsonValue,
          createdById: actor.userId
        }
      });
      await tx.projectActivityLog.create({
        data: {
          projectId: created.id,
          userId: actor.userId,
          action: ProjectActivityAction.PROJECT_CREATED,
          details: { source: "manual" } as Prisma.InputJsonValue
        }
      });
      return created;
    });

    await this.audit.write({
      actorId: actor.userId,
      action: "projects.create",
      entityType: "Project",
      entityId: project.id,
      metadata: { source: "manual", projectNumber: project.projectNumber }
    });

    if (project.projectManagerId) {
      await this.notifyProjectManager(project.id, project.projectManagerId, project.projectNumber, project.name);
    }

    return this.getById(project.id);
  }

  // ── Update (projects.manage; contractValue requires projects.admin) ──
  async update(id: string, dto: UpdateProjectDto, actor: ActorContext) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Project not found.");

    if (dto.contractValue !== undefined && !actor.permissions.has("projects.admin")) {
      throw new ForbiddenException("Changing contract value requires projects.admin.");
    }

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.siteAddressLine1 !== undefined) data.siteAddressLine1 = dto.siteAddressLine1;
    if (dto.siteAddressLine2 !== undefined) data.siteAddressLine2 = dto.siteAddressLine2;
    if (dto.siteAddressSuburb !== undefined) data.siteAddressSuburb = dto.siteAddressSuburb;
    if (dto.siteAddressState !== undefined) data.siteAddressState = dto.siteAddressState;
    if (dto.siteAddressPostcode !== undefined) data.siteAddressPostcode = dto.siteAddressPostcode;
    if (dto.contractValue !== undefined) data.contractValue = new Prisma.Decimal(dto.contractValue);
    if (dto.budget !== undefined) data.budget = new Prisma.Decimal(dto.budget);
    if (dto.actualCost !== undefined) data.actualCost = new Prisma.Decimal(dto.actualCost);
    if (dto.proposedStartDate !== undefined) data.proposedStartDate = dto.proposedStartDate ? new Date(dto.proposedStartDate) : null;
    if (dto.actualStartDate !== undefined) data.actualStartDate = dto.actualStartDate ? new Date(dto.actualStartDate) : null;
    if (dto.practicalCompletionDate !== undefined) data.practicalCompletionDate = dto.practicalCompletionDate ? new Date(dto.practicalCompletionDate) : null;
    if (dto.closedDate !== undefined) data.closedDate = dto.closedDate ? new Date(dto.closedDate) : null;
    if (dto.projectManagerId !== undefined) data.projectManager = dto.projectManagerId ? { connect: { id: dto.projectManagerId } } : { disconnect: true };
    if (dto.supervisorId !== undefined) data.supervisor = dto.supervisorId ? { connect: { id: dto.supervisorId } } : { disconnect: true };
    if (dto.estimatorId !== undefined) data.estimator = dto.estimatorId ? { connect: { id: dto.estimatorId } } : { disconnect: true };
    if (dto.whsOfficerId !== undefined) data.whsOfficer = dto.whsOfficerId ? { connect: { id: dto.whsOfficerId } } : { disconnect: true };

    const updated = await this.prisma.project.update({ where: { id }, data });

    const activityRecords: Prisma.ProjectActivityLogCreateManyInput[] = [];

    if (dto.contractValue !== undefined && !existing.contractValue.equals(new Prisma.Decimal(dto.contractValue))) {
      activityRecords.push({
        projectId: id,
        userId: actor.userId,
        action: ProjectActivityAction.CONTRACT_VALUE_CHANGED,
        details: { from: existing.contractValue.toString(), to: dto.contractValue } as Prisma.InputJsonValue
      });
    }
    if (dto.budget !== undefined && !existing.budget.equals(new Prisma.Decimal(dto.budget))) {
      activityRecords.push({
        projectId: id,
        userId: actor.userId,
        action: ProjectActivityAction.BUDGET_CHANGED,
        details: { from: existing.budget.toString(), to: dto.budget } as Prisma.InputJsonValue
      });
    }
    for (const field of TEAM_FIELDS) {
      const next = dto[field];
      if (next !== undefined) {
        const prev = (existing as unknown as Record<TeamField, string | null>)[field];
        if (prev !== (next ?? null)) {
          activityRecords.push({
            projectId: id,
            userId: actor.userId,
            action: ProjectActivityAction.TEAM_CHANGED,
            details: { field, from: prev, to: next ?? null } as Prisma.InputJsonValue
          });
        }
      }
    }
    if (activityRecords.length > 0) {
      await this.prisma.projectActivityLog.createMany({ data: activityRecords });
    }

    await this.audit.write({
      actorId: actor.userId,
      action: "projects.update",
      entityType: "Project",
      entityId: id,
      metadata: { changes: activityRecords.length }
    });

    return this.getById(updated.id);
  }

  // ── Status transitions ────────────────────────────────────────────────
  async transitionStatus(id: string, dto: ProjectStatusDto, actor: ActorContext) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Project not found.");

    const nextStatus = dto.status as ProjectStatus;
    if (existing.status === nextStatus) {
      return this.getById(id);
    }

    const allowedNext = VALID_TRANSITIONS[existing.status] ?? [];
    const isReopen = nextStatus === ProjectStatus.MOBILISING;

    if (!allowedNext.includes(nextStatus) && !isReopen) {
      throw new BadRequestException(
        `Invalid transition from ${existing.status} to ${nextStatus}. Allowed next: ${allowedNext.join(", ") || "(terminal)"}.`
      );
    }
    if (isReopen && !actor.permissions.has("projects.admin")) {
      throw new ForbiddenException("Reopening a closed project requires projects.admin.");
    }

    // Date-field requirements for each transition.
    const data: Prisma.ProjectUpdateInput = { status: nextStatus };
    if (existing.status === ProjectStatus.MOBILISING && nextStatus === ProjectStatus.ACTIVE) {
      const date = dto.actualStartDate ? new Date(dto.actualStartDate) : existing.actualStartDate;
      if (!date) throw new BadRequestException("actualStartDate is required to move MOBILISING → ACTIVE.");
      data.actualStartDate = date;
    }
    if (existing.status === ProjectStatus.ACTIVE && nextStatus === ProjectStatus.PRACTICAL_COMPLETION) {
      if (!dto.practicalCompletionDate) {
        throw new BadRequestException("practicalCompletionDate is required to move ACTIVE → PRACTICAL_COMPLETION.");
      }
      data.practicalCompletionDate = new Date(dto.practicalCompletionDate);
    }
    if (existing.status === ProjectStatus.DEFECTS && nextStatus === ProjectStatus.CLOSED) {
      if (!dto.closedDate) {
        throw new BadRequestException("closedDate is required to move DEFECTS → CLOSED.");
      }
      data.closedDate = new Date(dto.closedDate);
    }

    const updated = await this.prisma.project.update({ where: { id }, data });
    await this.prisma.projectActivityLog.create({
      data: {
        projectId: id,
        userId: actor.userId,
        action: ProjectActivityAction.STATUS_CHANGED,
        details: {
          from: existing.status,
          to: nextStatus,
          userId: actor.userId,
          timestamp: new Date().toISOString()
        } as Prisma.InputJsonValue
      }
    });

    const recipients = new Set<string>();
    if (updated.projectManagerId) recipients.add(updated.projectManagerId);
    if (updated.supervisorId) recipients.add(updated.supervisorId);
    for (const userId of recipients) {
      await this.notifications.create(
        {
          userId,
          title: `${updated.projectNumber} status → ${nextStatus}`,
          body: `${updated.projectNumber} — ${updated.name} moved from ${existing.status} to ${nextStatus}.`,
          severity: "LOW",
          linkUrl: `/projects/${updated.id}`
        },
        actor.userId
      );
    }

    await this.audit.write({
      actorId: actor.userId,
      action: "projects.status",
      entityType: "Project",
      entityId: id,
      metadata: { from: existing.status, to: nextStatus }
    });

    return this.getById(id);
  }

  // ── Activity feed ────────────────────────────────────────────────────
  async activity(id: string, page: number, limit: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectActivityLog.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit
      }),
      this.prisma.projectActivityLog.count({ where: { projectId: id } })
    ]);

    return { items, total, page: safePage, limit: safeLimit };
  }

  // ── Tender → Project conversion ──────────────────────────────────────
  async convertFromTender(tenderId: string, actor: ActorContext) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        tenderClients: { orderBy: [{ isAwarded: "desc" }, { createdAt: "asc" }] },
        estimate: {
          include: {
            items: {
              include: {
                labourLines: true,
                equipLines: true,
                plantLines: true,
                wasteLines: true,
                cuttingLines: true,
                assumptions: true
              }
            }
          }
        }
      }
    });
    if (!tender) throw new NotFoundException("Tender not found.");
    if (tender.status !== "AWARDED") {
      throw new BadRequestException(`Tender status must be AWARDED to convert (currently ${tender.status}).`);
    }

    const existingProject = await this.prisma.project.findFirst({
      where: { sourceTenderId: tenderId },
      select: { id: true, projectNumber: true }
    });
    if (existingProject) {
      throw new ConflictException({
        message: "This tender has already been converted.",
        existingProjectId: existingProject.id,
        existingProjectNumber: existingProject.projectNumber
      });
    }

    const primaryLink = tender.tenderClients.find((tc) => tc.isAwarded) ?? tender.tenderClients[0];
    if (!primaryLink) {
      throw new BadRequestException("Tender has no linked client; cannot convert.");
    }

    const snapshotAt = new Date().toISOString();
    const estimateSnapshot = {
      snapshotAt,
      estimate: tender.estimate
        ? {
            id: tender.estimate.id,
            markup: tender.estimate.markup.toString(),
            notes: tender.estimate.notes,
            items: tender.estimate.items.map((item) => ({
              id: item.id,
              code: item.code,
              itemNumber: item.itemNumber,
              title: item.title,
              description: item.description,
              markup: item.markup.toString(),
              isProvisional: item.isProvisional,
              provisionalAmount: item.provisionalAmount?.toString() ?? null,
              labourLines: item.labourLines.map((l) => ({
                ...l,
                qty: l.qty.toString(),
                days: l.days.toString(),
                rate: l.rate.toString()
              })),
              equipLines: item.equipLines.map((l) => ({
                ...l,
                qty: l.qty.toString(),
                duration: l.duration.toString(),
                rate: l.rate.toString()
              })),
              plantLines: item.plantLines.map((l) => ({
                ...l,
                qty: l.qty.toString(),
                days: l.days.toString(),
                rate: l.rate.toString()
              })),
              wasteLines: item.wasteLines.map((l) => ({
                ...l,
                qtyTonnes: l.qtyTonnes.toString(),
                tonRate: l.tonRate.toString(),
                loadRate: l.loadRate.toString()
              })),
              cuttingLines: item.cuttingLines.map((l) => ({
                ...l,
                qty: l.qty.toString(),
                rate: l.rate.toString()
              })),
              assumptions: item.assumptions
            }))
          }
        : null
    };

    // Flatten lines into ProjectScopeItem payloads.
    const scopeItemPayloads: Array<{
      scopeCode: string;
      description: string;
      quantity: string;
      unit: string;
      sourceEstimateLineId: string;
    }> = [];
    let estimateTotal = 0;
    for (const item of tender.estimate?.items ?? []) {
      const scopeCode = item.code;
      for (const line of item.labourLines) {
        scopeItemPayloads.push({
          scopeCode,
          description: `${item.title} — ${line.role} (${line.shift})`,
          quantity: line.days.toString(),
          unit: "days",
          sourceEstimateLineId: line.id
        });
        estimateTotal += Number(line.qty) * Number(line.days) * Number(line.rate);
      }
      for (const line of item.equipLines) {
        scopeItemPayloads.push({
          scopeCode,
          description: `${item.title} — ${line.description}`,
          quantity: line.duration.toString(),
          unit: line.period,
          sourceEstimateLineId: line.id
        });
        estimateTotal += Number(line.qty) * Number(line.duration) * Number(line.rate);
      }
      for (const line of item.plantLines) {
        scopeItemPayloads.push({
          scopeCode,
          description: `${item.title} — ${line.plantItem}`,
          quantity: line.days.toString(),
          unit: "days",
          sourceEstimateLineId: line.id
        });
        estimateTotal += Number(line.qty) * Number(line.days) * Number(line.rate);
      }
      for (const line of item.wasteLines) {
        scopeItemPayloads.push({
          scopeCode,
          description: `${item.title} — ${line.wasteType} @ ${line.facility}`,
          quantity: line.qtyTonnes.toString(),
          unit: "tonnes",
          sourceEstimateLineId: line.id
        });
        estimateTotal += Number(line.qtyTonnes) * Number(line.tonRate) + Number(line.loads) * Number(line.loadRate);
      }
      for (const line of item.cuttingLines) {
        scopeItemPayloads.push({
          scopeCode,
          description: `${item.title} — ${line.cuttingType}${line.equipment ? ` (${line.equipment})` : ""}`,
          quantity: line.qty.toString(),
          unit: line.unit,
          sourceEstimateLineId: line.id
        });
        estimateTotal += Number(line.qty) * Number(line.rate);
      }
    }

    const contractValue = tender.estimatedValue
      ? new Prisma.Decimal(tender.estimatedValue)
      : new Prisma.Decimal(estimateTotal.toFixed(2));
    const budget = new Prisma.Decimal(estimateTotal.toFixed(2));

    const created = await this.prisma.$transaction(async (tx) => {
      const projectNumber = await this.allocateProjectNumber(tx);
      const project = await tx.project.create({
        data: {
          projectNumber,
          name: tender.title,
          status: ProjectStatus.MOBILISING,
          sourceTenderId: tender.id,
          clientId: primaryLink.clientId,
          siteAddressLine1: "TBC",
          siteAddressSuburb: "TBC",
          siteAddressState: "QLD",
          siteAddressPostcode: "0000",
          contractValue,
          budget,
          proposedStartDate: tender.proposedStartDate ?? tender.dueDate,
          projectManagerId: tender.estimatorUserId ?? null,
          estimatorId: tender.estimatorUserId ?? null,
          estimateSnapshot: estimateSnapshot as Prisma.InputJsonValue,
          createdById: actor.userId
        }
      });

      if (scopeItemPayloads.length > 0) {
        await tx.projectScopeItem.createMany({
          data: scopeItemPayloads.map((s) => ({ ...s, projectId: project.id, quantity: new Prisma.Decimal(s.quantity) }))
        });
      }

      await tx.tenderDocumentLink.updateMany({
        where: { tenderId: tender.id, projectId: null },
        data: { projectId: project.id }
      });

      await tx.projectActivityLog.create({
        data: {
          projectId: project.id,
          userId: actor.userId,
          action: ProjectActivityAction.PROJECT_CREATED,
          details: {
            source: "tender",
            tenderId: tender.id,
            tenderNumber: tender.tenderNumber
          } as Prisma.InputJsonValue
        }
      });

      return project;
    });

    if (created.projectManagerId) {
      await this.notifyProjectManager(created.id, created.projectManagerId, created.projectNumber, created.name);
    }

    await this.audit.write({
      actorId: actor.userId,
      action: "projects.convert",
      entityType: "Project",
      entityId: created.id,
      metadata: { tenderId: tender.id, tenderNumber: tender.tenderNumber, projectNumber: created.projectNumber }
    });

    return this.getById(created.id);
  }

  private async notifyProjectManager(projectId: string, userId: string, projectNumber: string, name: string) {
    await this.notifications.create(
      {
        userId,
        title: `You are the PM on ${projectNumber}`,
        body: `You have been assigned as Project Manager on ${projectNumber} — ${name}.`,
        severity: "LOW",
        linkUrl: `/projects/${projectId}`
      },
      userId
    );
  }
}
