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
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../platform/notifications.service";
import type { CreateProjectDto } from "./dto/create-project.dto";
import type { ListProjectsQueryDto, ProjectStatusDto, UpdateProjectDto } from "./dto/update-project.dto";

type ActorContext = { userId: string; permissions: ReadonlySet<string> };

// Project.siteId is NOT NULL (see migration 20260716140000_site_id_not_null_backfill).
// Projects created before a Site is known point at the seeded "Unassigned" Site
// so the row stays valid; users can reassign later from the project page.
const UNASSIGNED_SITE_ID = "site-unassigned";

const TEAM_FIELDS = ["projectManagerId", "supervisorId", "estimatorId", "whsOfficerId"] as const;
type TeamField = (typeof TEAM_FIELDS)[number];

const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  MOBILISING: ["ACTIVE"],
  ACTIVE: ["PRACTICAL_COMPLETION"],
  PRACTICAL_COMPLETION: ["DEFECTS"],
  DEFECTS: ["CLOSED"],
  CLOSED: []
};

/**
 * Service layer for the projects module (§8 Jobs and Delivery).
 *
 * Owns the full project lifecycle: manual create, list + getById, partial
 * updates (with field-level perm gating on contractValue), the linear status
 * transition graph (MOBILISING → ACTIVE → PRACTICAL_COMPLETION → DEFECTS →
 * CLOSED) plus reopen, the activity feed, conversion from a source tender
 * (snapshot + scope-item flatten), and the revert-to-tender cascade that
 * undoes that conversion.
 *
 * Project numbers are allocated under a `FOR UPDATE` row lock on the
 * `project_number_sequences` singleton, then formatted as `IS-P{padded}`.
 *
 * Audit + activity invariants: every write path emits an `AuditLog` entry
 * via {@link AuditService} and a `ProjectActivityLog` row keyed to a
 * `ProjectActivityAction` enum value (PROJECT_CREATED, CONTRACT_VALUE_CHANGED,
 * BUDGET_CHANGED, TEAM_CHANGED, STATUS_CHANGED). Notifications fire to PM /
 * supervisor on team-assignment and status-change events; status changes
 * additionally send an email via the {@link EmailService} (fire-and-forget,
 * void-awaited, errors swallowed by the email service so the write path stays
 * fast).
 *
 * Revert-to-tender semantics (see `revert-to-tender.spec.ts`): the project
 * row is hard-deleted with Prisma cascading scopeItems, milestones,
 * activityLog, allocations, preStartChecklists, timesheets, contract, and
 * ganttTasks. Optional-FK rows (safetyIncidents, hazardObservations,
 * tenderDocumentLink) are explicitly nullified instead of deleted so they
 * survive the revert. The source tender's status is reset to
 * `CONTRACT_ISSUED` and the audit log entry is written inside the same
 * transaction so it rolls back on failure.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  // ── Numbering ─────────────────────────────────────────────────────────
  /**
   * Preview the next project number without consuming the sequence.
   *
   * Returns `{ nextNumber: "IS-P{padded}" }` based on `lastNumber + 1` from
   * the singleton sequence row. Does NOT bump the sequence — pure UI affordance.
   */
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
  /**
   * Paginated list of projects with optional filters.
   *
   * `query.status` accepts a comma-separated list of `ProjectStatus` values
   * (e.g. `"ACTIVE,DEFECTS"`); `query.search` is a case-insensitive
   * `projectNumber OR name` match. `page` defaults to 1, `limit` defaults to
   * 25 and is clamped to [1, 100]. `Decimal` fields (`contractValue`) are
   * returned stringified to preserve precision.
   */
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

  /**
   * Fetch a single project by id with the full delivery context.
   *
   * Loads client, source tender summary, the four team-role users (PM,
   * supervisor, estimator, WHS officer), all scope items ordered by
   * scopeCode, all milestones ordered by order, and the 10 most recent
   * activity entries with their author. `Decimal` fields are stringified and
   * `variance = budget - actualCost` is computed and returned alongside.
   * Throws `NotFoundException` when the project does not exist.
   */
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
  /**
   * Manually create a project (no source tender).
   *
   * Validates the client exists, then inside a single transaction allocates
   * the next project number under a row lock, creates the project, and
   * writes a `PROJECT_CREATED` activity entry with `source: "manual"`.
   * Post-commit: writes the audit log and (if a PM is assigned) fires a
   * notification to the PM. Returns the same shape as {@link getById}.
   * Throws `BadRequestException` if the client is not found.
   */
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
          siteId: UNASSIGNED_SITE_ID,
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
  /**
   * Apply a partial update to a project.
   *
   * Field-level permission: `dto.contractValue` requires `projects.admin` and
   * throws `ForbiddenException` otherwise. All other writable fields are
   * gated only by `projects.manage` (enforced at the controller). Team
   * disconnects are handled explicitly via Prisma `disconnect: true` when the
   * payload is `null`.
   *
   * Activity log emission: changes to contractValue, budget, or any of the
   * four team roles generate `CONTRACT_VALUE_CHANGED`, `BUDGET_CHANGED`, or
   * `TEAM_CHANGED` entries in a single `createMany` batch with before/after
   * details. An audit log is always written with the change count.
   *
   * Throws `NotFoundException` if the project does not exist.
   */
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
    if (dto.requiredQualifications !== undefined) {
      // Normalise: trim, drop empties, de-duplicate, preserve order. The
      // column is a String[] of qualType codes consumed by the competency
      // gate; whitespace/blank entries would silently break the gate.
      const seen = new Set<string>();
      data.requiredQualifications = dto.requiredQualifications
        .map((code) => (typeof code === "string" ? code.trim() : ""))
        .filter((code) => {
          if (code.length === 0 || seen.has(code)) return false;
          seen.add(code);
          return true;
        });
    }

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
  /**
   * Move a project to the next status (or reopen a closed one).
   *
   * Transition graph (see `VALID_TRANSITIONS`):
   *  - `MOBILISING → ACTIVE` — requires `actualStartDate` in payload or
   *    already set on the project.
   *  - `ACTIVE → PRACTICAL_COMPLETION` — requires `practicalCompletionDate`
   *    in payload.
   *  - `PRACTICAL_COMPLETION → DEFECTS` — no extra date required.
   *  - `DEFECTS → CLOSED` — requires `closedDate` in payload.
   *  - `CLOSED → MOBILISING` — reopen, ONLY allowed if the actor has
   *    `projects.admin` (else `ForbiddenException`).
   *
   * A no-op (same status) returns the current project unchanged. Any other
   * transition throws `BadRequestException`.
   *
   * Side effects: `STATUS_CHANGED` activity entry, audit log entry, fire-and-
   * forget email notification (errors swallowed by EmailService), and an
   * in-app notification to PM and supervisor (deduplicated by Set).
   */
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

    // Fire-and-forget email notification for the status transition. The
    // service swallows errors so no catch is needed here; void-awaiting
    // keeps the primary write path fast.
    void this.email.sendNotificationEmail({
      trigger: "project.status_changed",
      subject: `Project status updated — ${updated.projectNumber} ${updated.name}`,
      html: `<p>Project <strong>${updated.projectNumber} — ${updated.name}</strong> status changed from <strong>${existing.status}</strong> to <strong>${nextStatus}</strong>.</p>`,
      text: `Project ${updated.projectNumber} status: ${existing.status} → ${nextStatus}.`
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
  /**
   * Paginated reverse-chronological activity feed for a single project.
   *
   * Includes the author user (id + name) on each row. `page` is floored at 1,
   * `limit` is clamped to [1, 100]. Returns the standard
   * `{ items, total, page, limit }` envelope.
   */
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
  /**
   * Convert an AWARDED tender into a project (one-shot, idempotent guard).
   *
   * Preconditions: tender exists, is in `AWARDED` status, and has no existing
   * project pointing at it (else `ConflictException` with the existing
   * project id + number).
   *
   * Conversion steps inside a single transaction:
   *  1. Allocate the next project number under a row lock.
   *  2. Snapshot the entire estimate (markup, notes, every item with all
   *     line types and assumptions, decimals stringified) into
   *     `estimateSnapshot` JSON.
   *  3. Flatten each estimate line into a `ProjectScopeItem` row with a
   *     pointer back to the source line id.
   *  4. Compute `contractValue` (tender.estimatedValue if set, else summed
   *     estimate total) and `budget` (always summed estimate total).
   *  5. Re-parent the tender's document links to the new project.
   *  6. Write a `PROJECT_CREATED` activity entry with `source: "tender"`.
   *
   * Post-commit: PM notification (if assigned) and audit log entry.
   * Site address is seeded with `TBC` placeholders since tenders don't carry
   * a structured site address — operator is expected to fill these in.
   */
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
          siteId: UNASSIGNED_SITE_ID,
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

  // ── Revert to Tender ───────────────────────────────────────────────
  /**
   * Preflight summary for revert-to-tender (read-only).
   *
   * Returns project info, the source tender pointer, and a `cascadeCounts`
   * map containing the row count for every child relation that will be
   * cascaded or nullified by {@link revertToTender}: scopeItems, milestones,
   * activityLog, allocations, preStartChecklists, timesheets, ganttTasks,
   * safetyIncidents, hazardObservations, documents, and contracts. Intended
   * for a confirmation dialog before the operator triggers the destructive
   * revert.
   *
   * Throws `BadRequestException` if the project has no source tender,
   * `NotFoundException` if the project does not exist.
   */
  async revertToTenderPreflight(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        status: true,
        sourceTenderId: true,
        sourceTender: { select: { id: true, tenderNumber: true, title: true, status: true } },
        _count: {
          select: {
            scopeItems: true,
            milestones: true,
            activityLog: true,
            allocations: true,
            preStartChecklists: true,
            timesheets: true,
            ganttTasks: true,
            safetyIncidents: true,
            hazardObservations: true,
            documents: true
          }
        }
      }
    });
    if (!project) throw new NotFoundException("Project not found.");
    if (!project.sourceTenderId) {
      throw new BadRequestException("This project was not converted from a tender — cannot revert.");
    }

    const contractCount = await this.prisma.contract.count({ where: { projectId } });

    return {
      id: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      status: project.status,
      sourceTender: project.sourceTender,
      cascadeCounts: {
        ...project._count,
        contracts: contractCount
      }
    };
  }

  /**
   * Execute the revert-to-tender cascade (destructive, transactional).
   *
   * Covered by `revert-to-tender.spec.ts`. Inside a single transaction:
   *  1. Nullify `safetyIncident.projectId` and `hazardObservation.projectId`
   *     (these use optional FKs and would otherwise block delete).
   *  2. Unlink `tenderDocumentLink.projectId` so doc rows survive and revert
   *     to being tender-scoped.
   *  3. Hard-delete the project — Prisma cascades scopeItems, milestones,
   *     activityLog, allocations, preStartChecklists, timesheets, contract,
   *     and ganttTasks.
   *  4. Reset the source tender's status back to `CONTRACT_ISSUED`.
   *  5. Write the audit log entry inside the same transaction so it rolls
   *     back on failure (vs. the AuditService write paths used elsewhere).
   *
   * Returns `{ success, tenderId, revertedAt, cascadeCounts }`. The
   * `cascadeCounts` snapshot is captured BEFORE the transaction runs so it
   * reflects what was destroyed.
   *
   * Throws `BadRequestException` if the project has no source tender,
   * `NotFoundException` if the project does not exist.
   */
  async revertToTender(projectId: string, actorId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        status: true,
        sourceTenderId: true,
        _count: {
          select: {
            scopeItems: true,
            milestones: true,
            activityLog: true,
            allocations: true,
            preStartChecklists: true,
            timesheets: true,
            ganttTasks: true,
            safetyIncidents: true,
            hazardObservations: true,
            documents: true
          }
        }
      }
    });
    if (!project) throw new NotFoundException("Project not found.");
    if (!project.sourceTenderId) {
      throw new BadRequestException("This project was not converted from a tender — cannot revert.");
    }

    const contractCount = await this.prisma.contract.count({ where: { projectId } });
    const cascadeCounts = { ...project._count, contracts: contractCount };
    const tenderId = project.sourceTenderId;

    await this.prisma.$transaction(async (tx) => {
      // Nullify optional FK references that don't auto-cascade
      await tx.safetyIncident.updateMany({ where: { projectId }, data: { projectId: null } });
      await tx.hazardObservation.updateMany({ where: { projectId }, data: { projectId: null } });

      // Unlink tender documents (projectId is nullable, onDelete: SetNull — but we do it
      // explicitly so the doc rows survive and go back to the tender).
      await tx.tenderDocumentLink.updateMany({ where: { projectId }, data: { projectId: null } });

      // Delete the project — Prisma cascades scopeItems, milestones, activityLog,
      // allocations, preStartChecklists, timesheets, contract, ganttTasks.
      await tx.project.delete({ where: { id: projectId } });

      // Reset the source tender's status back to CONTRACT_ISSUED.
      await tx.tender.update({ where: { id: tenderId }, data: { status: "CONTRACT_ISSUED" } });

      // Audit log inside the transaction so it rolls back on failure.
      await tx.auditLog.create({
        data: {
          actorId,
          action: "project.reverted_to_tender",
          entityType: "Project",
          entityId: projectId,
          metadata: {
            tenderId,
            projectNumber: project.projectNumber,
            projectName: project.name,
            priorStatus: project.status,
            cascadeCounts
          } as Prisma.InputJsonValue
        }
      });
    });

    return {
      success: true,
      tenderId,
      revertedAt: new Date().toISOString(),
      cascadeCounts
    };
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
