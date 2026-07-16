import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../platform/notifications.service";
import {
  CloseCorrectiveActionDto,
  CreateCorrectiveActionDto,
  ListCorrectiveActionsDto,
  UpdateCorrectiveActionDto
} from "./dto/corrective-actions.dto";

const DETAIL_INCLUDE = {
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  submission: {
    select: {
      id: true,
      submittedAt: true,
      templateVersion: { select: { template: { select: { id: true, name: true, code: true } } } }
    }
  }
} as const;

/**
 * CRUD + close-out for CorrectiveAction rows raised by the forms engine.
 *
 * Authority pattern mirrors the rest of the forms module:
 *   - `forms.manage` — list all, create manually, update any, close any
 *   - `forms.submit` — list actions assigned to self; the engine creates
 *     them automatically on submit so workers never call createManual directly
 *
 * Close-out requires a note and sets status → "closed" + closedAt + closedById.
 * Re-opening is not supported in this MVP slice; status flows are:
 *   open → in_progress → closed
 */
@Injectable()
export class CorrectiveActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * List corrective actions, optionally filtered by status / submissionId /
   * assignedToId. Returns all fields plus submission + assignee summaries.
   *
   * @param query - filter + pagination options
   * @returns paginated `{ items, total, page, pageSize }`
   */
  async list(query: ListCorrectiveActionsDto) {
    const where: Prisma.CorrectiveActionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.submissionId ? { submissionId: query.submissionId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.overdue
        ? { status: { notIn: ["closed"] }, dueAt: { lt: new Date() } }
        : {})
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.correctiveAction.findMany({
        where,
        include: DETAIL_INCLUDE,
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.correctiveAction.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Get a single corrective action by id.
   *
   * @throws NotFoundException when the action does not exist
   */
  async getOne(id: string) {
    const action = await this.prisma.correctiveAction.findUnique({
      where: { id },
      include: DETAIL_INCLUDE
    });
    if (!action) throw new NotFoundException("Corrective action not found.");
    return action;
  }

  /**
   * Manually create a corrective action (without a triggering submission).
   * Used by managers to raise an action against a submission after the fact.
   *
   * @param dto - action fields
   * @param actorId - user creating the record
   * @returns the created action with full includes
   */
  async create(dto: CreateCorrectiveActionDto, actorId: string) {
    const action = await this.prisma.correctiveAction.create({
      data: {
        submissionId: dto.submissionId ?? null,
        sourceFieldKey: dto.sourceFieldKey ?? null,
        title: dto.title,
        description: dto.description ?? null,
        assignedToId: dto.assignedToId ?? null,
        assignedToRole: dto.assignedToRole ?? null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        priority: dto.priority ?? "medium",
        status: "open"
      },
      include: DETAIL_INCLUDE
    });

    await this.audit.write({
      actorId,
      action: "forms.corrective_action.create",
      entityType: "CorrectiveAction",
      entityId: action.id
    });

    if (action.assignedToId) {
      void this.notifications
        .create(
          {
            userId: action.assignedToId,
            title: "Corrective action assigned",
            body: `You have been assigned a corrective action: ${action.title}`,
            severity: "warning",
            linkUrl: `/forms/corrective-actions/${action.id}`
          },
          actorId
        )
        .catch(() => undefined);
    }

    return action;
  }

  /**
   * Update title, description, assignee, due date or priority.
   * Status transitions (except close-out) are also accepted here;
   * use `close` for the close-out flow that records note + evidence.
   *
   * @throws NotFoundException when the action does not exist
   * @throws ForbiddenException when trying to reopen a closed action
   */
  async update(id: string, dto: UpdateCorrectiveActionDto, actorId: string) {
    const existing = await this.requireAction(id);
    if (existing.status === "closed" && dto.status && dto.status !== "closed") {
      throw new ForbiddenException("A closed corrective action cannot be reopened via this endpoint.");
    }

    const data: Prisma.CorrectiveActionUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.assignedToId !== undefined) {
      data.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }
    if (dto.assignedToRole !== undefined) data.assignedToRole = dto.assignedToRole;
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.correctiveAction.update({
      where: { id },
      data,
      include: DETAIL_INCLUDE
    });

    await this.audit.write({
      actorId,
      action: "forms.corrective_action.update",
      entityType: "CorrectiveAction",
      entityId: id,
      metadata: { changes: Object.keys(dto) }
    });

    return updated;
  }

  /**
   * Close out a corrective action.
   *
   * Requires a non-blank `closeOutNote`. Sets status to "closed",
   * records closedAt/closedById, optionally stores an evidence path.
   * Notifies the original assignee that the action was closed.
   *
   * @throws NotFoundException when the action does not exist
   * @throws BadRequestException when the note is blank or the action is already closed
   */
  async close(id: string, dto: CloseCorrectiveActionDto, actorId: string) {
    if (!dto.closeOutNote?.trim()) {
      throw new BadRequestException("A close-out note is required.");
    }
    const existing = await this.requireAction(id);
    if (existing.status === "closed") {
      throw new BadRequestException("This corrective action is already closed.");
    }

    const closed = await this.prisma.correctiveAction.update({
      where: { id },
      data: {
        status: "closed",
        closedAt: new Date(),
        closedById: actorId,
        closeOutNote: dto.closeOutNote.trim(),
        evidencePath: dto.evidencePath ?? null
      },
      include: DETAIL_INCLUDE
    });

    await this.audit.write({
      actorId,
      action: "forms.corrective_action.close",
      entityType: "CorrectiveAction",
      entityId: id
    });

    if (existing.assignedToId && existing.assignedToId !== actorId) {
      void this.notifications
        .create(
          {
            userId: existing.assignedToId,
            title: "Corrective action closed",
            body: `Action "${existing.title}" has been closed.`,
            severity: "info",
            linkUrl: `/forms/corrective-actions/${id}`
          },
          actorId
        )
        .catch(() => undefined);
    }

    return closed;
  }

  private async requireAction(id: string) {
    const action = await this.prisma.correctiveAction.findUnique({ where: { id } });
    if (!action) throw new NotFoundException("Corrective action not found.");
    return action;
  }
}
