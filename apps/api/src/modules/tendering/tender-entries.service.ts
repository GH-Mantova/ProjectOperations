import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../platform/notifications.service";

/**
 * Allowed entry types for the unified tender communication log.
 * follow_up / self_reminder / task require a due date; task also
 * requires an assignee.
 */
export const TENDER_ENTRY_TYPES = [
  "note",
  "rfi",
  "email",
  "call",
  "meeting",
  "follow_up",
  "self_reminder",
  "task"
] as const;
/** Union of accepted tender entry types. */
export type TenderEntryType = (typeof TENDER_ENTRY_TYPES)[number];

/** Allowed entry statuses; 'cancelled' doubles as the soft-delete marker. */
export const TENDER_ENTRY_STATUSES = ["open", "done", "cancelled"] as const;
/** Union of accepted tender entry statuses. */
export type TenderEntryStatus = (typeof TENDER_ENTRY_STATUSES)[number];

const TYPES_REQUIRING_DUE_DATE: ReadonlySet<TenderEntryType> = new Set([
  "follow_up",
  "self_reminder",
  "task"
]);

/** Optional filters for the tender entries list endpoint. */
export type ListTenderEntriesQuery = {
  type?: string;
  assigneeId?: string;
  status?: string;
  from?: string;
  to?: string;
};

/** Service-level input shape for creating a tender entry. */
export type CreateTenderEntryInput = {
  type: string;
  subject?: string | null;
  body: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  status?: string | null;
};

/** Service-level partial-update shape for a tender entry. */
export type UpdateTenderEntryInput = {
  type?: string;
  subject?: string | null;
  body?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  status?: string | null;
};

/**
 * Service for the unified tender communication log (TenderEntry rows).
 *
 * Every mutation writes an audit entry. Creating a 'task' entry
 * assigned to someone other than the author dispatches an in-app
 * notification and an email best-effort (failures are logged, never
 * thrown). Removal is a soft-delete via status='cancelled'.
 */
@Injectable()
export class TenderEntriesService {
  private readonly logger = new Logger(TenderEntriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  /**
   * List entries for a tender, newest first, with optional filters.
   *
   * @param query - optional type / assigneeId / status / createdAt range filters
   * @returns entries including author + assignee (id, firstName, lastName)
   * @throws NotFoundException when the tender does not exist
   * @throws BadRequestException when type or status filter value is invalid
   */
  async list(tenderId: string, query: ListTenderEntriesQuery) {
    await this.ensureTenderExists(tenderId);

    const where: Record<string, unknown> = { tenderId };
    if (query.type) {
      const type = this.assertType(query.type);
      where.type = type;
    }
    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }
    if (query.status) {
      where.status = this.assertStatus(query.status);
    }
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) {
        createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        createdAt.lte = new Date(query.to);
      }
      where.createdAt = createdAt;
    }

    return this.prisma.tenderEntry.findMany({
      where,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Create an entry on a tender; status defaults to 'open'.
   *
   * follow_up / self_reminder / task types require a due date; task
   * also requires an assignee. A task assigned to another user fires a
   * best-effort notification + email after the write.
   *
   * @param dto - type, body (required, trimmed), optional subject/dueDate/assigneeId/status
   * @returns the created entry with author + assignee metadata
   * @throws NotFoundException when the tender does not exist
   * @throws BadRequestException on invalid type/status, empty body, missing conditional fields, or unknown/inactive assignee
   */
  async create(tenderId: string, dto: CreateTenderEntryInput, actorId: string) {
    await this.ensureTenderExists(tenderId);
    const type = this.assertType(dto.type);
    const body = (dto.body ?? "").trim();
    if (!body) {
      throw new BadRequestException("Entry body is required.");
    }
    const status = dto.status ? this.assertStatus(dto.status) : "open";
    this.validateConditionalFields(type, dto.dueDate, dto.assigneeId);

    if (dto.assigneeId) {
      await this.ensureUserExists(dto.assigneeId);
    }

    const record = await this.prisma.tenderEntry.create({
      data: {
        tenderId,
        type,
        subject: dto.subject?.trim() || null,
        body,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId ?? null,
        status,
        authorId: actorId
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    await this.audit.write({
      actorId,
      action: "tenders.entries.create",
      entityType: "TenderEntry",
      entityId: record.id,
      metadata: { tenderId, type, hasAssignee: !!record.assigneeId }
    });

    if (type === "task" && record.assigneeId && record.assigneeId !== actorId) {
      await this.dispatchTaskAssignmentNotice(record, actorId);
    }

    return record;
  }

  private async dispatchTaskAssignmentNotice(
    record: {
      id: string;
      tenderId: string;
      subject: string | null;
      body: string;
      dueDate: Date | null;
      assigneeId: string | null;
    },
    actorId: string
  ) {
    if (!record.assigneeId) return;
    try {
      const [tender, assignee] = await Promise.all([
        this.prisma.tender.findUnique({
          where: { id: record.tenderId },
          select: { id: true, tenderNumber: true, title: true }
        }),
        this.prisma.user.findUnique({
          where: { id: record.assigneeId },
          select: { id: true, email: true, firstName: true, lastName: true, isActive: true }
        })
      ]);
      if (!tender || !assignee || !assignee.isActive) return;

      const subjectLabel = record.subject?.trim() || "New task assigned";
      const dueLabel = record.dueDate ? ` (due ${record.dueDate.toISOString().slice(0, 10)})` : "";
      const linkUrl = `/tenders/${tender.id}`;
      const notificationTitle = `New task on tender ${tender.tenderNumber}`;
      const notificationBody = `${subjectLabel}${dueLabel} — ${record.body}`;

      await this.notifications.create(
        {
          userId: assignee.id,
          title: notificationTitle,
          body: notificationBody,
          severity: "MEDIUM",
          linkUrl
        },
        actorId
      );

      const emailSubject = `[Project Ops] New task on tender ${tender.tenderNumber} — ${subjectLabel}`;
      const emailText = [
        `You have been assigned a task on tender ${tender.tenderNumber} (${tender.title}).`,
        "",
        `Subject: ${subjectLabel}`,
        record.dueDate ? `Due: ${record.dueDate.toISOString().slice(0, 10)}` : "Due: (none)",
        "",
        record.body
      ].join("\n");
      const emailHtml = `
        <p>You have been assigned a task on tender <strong>${tender.tenderNumber}</strong> — ${tender.title}.</p>
        <p><strong>Subject:</strong> ${subjectLabel}<br/>
        <strong>Due:</strong> ${record.dueDate ? record.dueDate.toISOString().slice(0, 10) : "(none)"}</p>
        <p>${record.body.replace(/\n/g, "<br/>")}</p>
      `;

      const provider = await this.email.resolveProvider();
      await provider.sendMail({
        to: [assignee.email],
        subject: emailSubject,
        text: emailText,
        html: emailHtml
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Task assignment notification failed for entry ${record.id}: ${message}`);
    }
  }

  /**
   * Partially update an entry; conditional-field rules are re-validated
   * against the merged (existing + patch) state.
   *
   * Null dueDate/assigneeId clears the field; the body can be changed
   * but never cleared.
   *
   * @param dto - partial entry fields
   * @returns the updated entry with author + assignee metadata
   * @throws NotFoundException when the entry is not on this tender
   * @throws BadRequestException on invalid type/status, empty body, missing conditional fields, or unknown/inactive assignee
   */
  async update(tenderId: string, entryId: string, dto: UpdateTenderEntryInput, actorId: string) {
    const existing = await this.requireEntry(tenderId, entryId);

    const nextType = dto.type ? this.assertType(dto.type) : (existing.type as TenderEntryType);
    const nextStatus = dto.status ? this.assertStatus(dto.status) : (existing.status as TenderEntryStatus);
    const nextDueDate =
      dto.dueDate === undefined ? existing.dueDate : dto.dueDate ? new Date(dto.dueDate) : null;
    const nextAssigneeId =
      dto.assigneeId === undefined ? existing.assigneeId : dto.assigneeId ?? null;

    this.validateConditionalFields(
      nextType,
      nextDueDate ? nextDueDate.toISOString() : null,
      nextAssigneeId
    );

    if (dto.assigneeId) {
      await this.ensureUserExists(dto.assigneeId);
    }

    if (dto.body !== undefined && !dto.body.trim()) {
      throw new BadRequestException("Entry body cannot be cleared.");
    }

    const record = await this.prisma.tenderEntry.update({
      where: { id: entryId },
      data: {
        type: nextType,
        subject: dto.subject !== undefined ? dto.subject?.trim() || null : undefined,
        body: dto.body !== undefined ? dto.body.trim() : undefined,
        dueDate: nextDueDate,
        assigneeId: nextAssigneeId,
        status: nextStatus
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    await this.audit.write({
      actorId,
      action: "tenders.entries.update",
      entityType: "TenderEntry",
      entityId: entryId,
      metadata: { tenderId, type: record.type, status: record.status }
    });

    return record;
  }

  /**
   * Soft-delete an entry by setting status='cancelled'; writes an audit
   * entry. Idempotent — already-cancelled entries return without writing.
   *
   * @returns { id, status }
   * @throws NotFoundException when the entry is not on this tender
   */
  async remove(tenderId: string, entryId: string, actorId: string) {
    const existing = await this.requireEntry(tenderId, entryId);
    if (existing.status === "cancelled") {
      return { id: entryId, status: existing.status };
    }
    const record = await this.prisma.tenderEntry.update({
      where: { id: entryId },
      data: { status: "cancelled" }
    });
    await this.audit.write({
      actorId,
      action: "tenders.entries.cancel",
      entityType: "TenderEntry",
      entityId: entryId,
      metadata: { tenderId }
    });
    return { id: record.id, status: record.status };
  }

  private validateConditionalFields(
    type: TenderEntryType,
    dueDate: string | Date | null | undefined,
    assigneeId: string | null | undefined
  ) {
    if (TYPES_REQUIRING_DUE_DATE.has(type) && !dueDate) {
      throw new BadRequestException(`Entry of type '${type}' requires a due date.`);
    }
    if (type === "task" && !assigneeId) {
      throw new BadRequestException("Task entries require an assignee.");
    }
  }

  private assertType(value: string): TenderEntryType {
    if (!(TENDER_ENTRY_TYPES as readonly string[]).includes(value)) {
      throw new BadRequestException(
        `Invalid entry type '${value}'. Allowed: ${TENDER_ENTRY_TYPES.join(", ")}.`
      );
    }
    return value as TenderEntryType;
  }

  private assertStatus(value: string): TenderEntryStatus {
    if (!(TENDER_ENTRY_STATUSES as readonly string[]).includes(value)) {
      throw new BadRequestException(
        `Invalid entry status '${value}'. Allowed: ${TENDER_ENTRY_STATUSES.join(", ")}.`
      );
    }
    return value as TenderEntryStatus;
  }

  private async ensureTenderExists(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true }
    });
    if (!tender) {
      throw new NotFoundException("Tender not found.");
    }
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true }
    });
    if (!user) {
      throw new BadRequestException(`Assignee user '${userId}' not found.`);
    }
    if (!user.isActive) {
      throw new BadRequestException(`Assignee user '${userId}' is inactive.`);
    }
  }

  private async requireEntry(tenderId: string, entryId: string) {
    const entry = await this.prisma.tenderEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.tenderId !== tenderId) {
      throw new NotFoundException("Entry not found on this tender.");
    }
    return entry;
  }
}
