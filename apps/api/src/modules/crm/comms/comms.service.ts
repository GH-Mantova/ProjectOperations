import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CommTaskStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

// ── Entity types the comms hub can be anchored to ────────────────────────────

/**
 * The finite set of record kinds a thread/task can hang off. Stored as a
 * String on the row (see schema.prisma:`comm_threads`) so the sub-module
 * stays polymorphic and decoupled from the transactional owners, but the
 * DTO / service layer tightens it to this tuple so callers can't invent
 * arbitrary entity types at runtime.
 */
export const COMM_ENTITY_TYPES = ["ACCOUNT", "TENDER", "JOB", "CONTRACT"] as const;
export type CommEntityType = (typeof COMM_ENTITY_TYPES)[number];

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateThreadInput = {
  entityType: CommEntityType;
  entityId: string;
  subject?: string | null;
  createdById: string;
};

export type ListThreadsQuery = {
  entityType?: CommEntityType;
  entityId?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
};

export type PostMessageInput = {
  threadId: string;
  authorId: string;
  body: string;
  /** User ids @-mentioned in the body. Deduped + stored as JSON. */
  mentions?: string[];
};

export type CreateTaskInput = {
  entityType: CommEntityType;
  entityId: string;
  createdById: string;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  threadId?: string | null;
  dueAt?: Date | string | null;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  dueAt?: Date | string | null;
  status?: CommTaskStatus;
};

export type ListTasksQuery = {
  entityType?: CommEntityType;
  entityId?: string;
  assigneeId?: string;
  status?: CommTaskStatus;
  overdueOnly?: boolean;
  page?: number;
  limit?: number;
};

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * CRM-4: CommsService — internal threads + To-Do sub-module.
 *
 * Decoupled by design. Owns its own tables (comm_threads / comm_messages /
 * comm_tasks) and links to the rest of the app polymorphically via
 * (entityType, entityId). No foreign keys into Account/Tender/Job/Contract,
 * so the sub-module can later branch into its own product without a costly
 * schema divorce.
 *
 * This slice ships WITHOUT Azure. CRM-5 (email-log.service.ts) will layer
 * Outlook logging on top via the existing M365 seam without touching this
 * service.
 */
@Injectable()
export class CommsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Threads ────────────────────────────────────────────────────────────────

  async createThread(input: CreateThreadInput) {
    this.requireEntityType(input.entityType);
    if (!input.entityId?.trim()) {
      throw new BadRequestException("entityId is required.");
    }
    await this.requireUser(input.createdById);

    return this.prisma.commThread.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        subject: input.subject ?? null,
        createdById: input.createdById
      },
      include: this.threadInclude()
    });
  }

  async listThreads(query: ListThreadsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.CommThreadWhereInput = {};
    if (query.entityType) {
      this.requireEntityType(query.entityType);
      where.entityType = query.entityType;
    }
    if (query.entityId) where.entityId = query.entityId;
    if (!query.includeArchived) where.archivedAt = null;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.commThread.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: this.threadInclude()
      }),
      this.prisma.commThread.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getThread(id: string) {
    const row = await this.prisma.commThread.findUnique({
      where: { id },
      include: {
        ...this.threadInclude(),
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        tasks: {
          orderBy: [{ status: "asc" }, { dueAt: "asc" }],
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      }
    });
    if (!row) throw new NotFoundException(`CommThread ${id} not found.`);
    return row;
  }

  async archiveThread(id: string) {
    const existing = await this.prisma.commThread.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`CommThread ${id} not found.`);
    if (existing.archivedAt) {
      throw new BadRequestException(`CommThread ${id} is already archived.`);
    }
    return this.prisma.commThread.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: this.threadInclude()
    });
  }

  async unarchiveThread(id: string) {
    const existing = await this.prisma.commThread.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`CommThread ${id} not found.`);
    if (!existing.archivedAt) {
      throw new BadRequestException(`CommThread ${id} is not archived.`);
    }
    return this.prisma.commThread.update({
      where: { id },
      data: { archivedAt: null },
      include: this.threadInclude()
    });
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  async postMessage(input: PostMessageInput) {
    const body = input.body?.trim();
    if (!body) throw new BadRequestException("Message body is required.");

    const thread = await this.prisma.commThread.findUnique({
      where: { id: input.threadId }
    });
    if (!thread) throw new NotFoundException(`CommThread ${input.threadId} not found.`);
    if (thread.archivedAt) {
      throw new BadRequestException(`CommThread ${input.threadId} is archived.`);
    }
    await this.requireUser(input.authorId);

    // Extract @mentions from the body if none supplied. Callers can pass an
    // explicit list (e.g. from a picker) which takes precedence.
    const mentions = this.dedupe(
      input.mentions ?? extractMentions(body)
    );

    const message = await this.prisma.commMessage.create({
      data: {
        threadId: input.threadId,
        authorId: input.authorId,
        body,
        mentions: mentions.length ? mentions : Prisma.JsonNull
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Bump the thread's updatedAt so the list surface sorts recent activity
    // to the top without an explicit lastActivityAt column.
    await this.prisma.commThread.update({
      where: { id: input.threadId },
      data: { updatedAt: new Date() }
    });

    return message;
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async createTask(input: CreateTaskInput) {
    this.requireEntityType(input.entityType);
    if (!input.entityId?.trim()) {
      throw new BadRequestException("entityId is required.");
    }
    if (!input.title?.trim()) {
      throw new BadRequestException("Task title is required.");
    }
    await this.requireUser(input.createdById);
    if (input.assigneeId) await this.requireUser(input.assigneeId);
    if (input.threadId) {
      const thread = await this.prisma.commThread.findUnique({
        where: { id: input.threadId }
      });
      if (!thread) throw new NotFoundException(`CommThread ${input.threadId} not found.`);
    }

    return this.prisma.commTask.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title.trim(),
        description: input.description ?? null,
        assigneeId: input.assigneeId ?? null,
        threadId: input.threadId ?? null,
        createdById: input.createdById,
        dueAt: input.dueAt ? new Date(input.dueAt) : null
      },
      include: this.taskInclude()
    });
  }

  async updateTask(id: string, input: UpdateTaskInput) {
    const existing = await this.prisma.commTask.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`CommTask ${id} not found.`);
    if (input.assigneeId) await this.requireUser(input.assigneeId);

    const data: Prisma.CommTaskUpdateInput = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new BadRequestException("Task title cannot be empty.");
      data.title = title;
    }
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.assigneeId !== undefined) {
      data.assignee = input.assigneeId
        ? { connect: { id: input.assigneeId } }
        : { disconnect: true };
    }
    if (input.status !== undefined) {
      data.status = input.status;
      // Bookkeep completedAt so downstream reporting doesn't need to
      // reconstruct "when did this get done" from an audit log.
      data.completedAt = input.status === "DONE" ? new Date() : null;
    }

    return this.prisma.commTask.update({
      where: { id },
      data,
      include: this.taskInclude()
    });
  }

  async listTasks(query: ListTasksQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));

    const where: Prisma.CommTaskWhereInput = {};
    if (query.entityType) {
      this.requireEntityType(query.entityType);
      where.entityType = query.entityType;
    }
    if (query.entityId) where.entityId = query.entityId;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.status) where.status = query.status;
    if (query.overdueOnly) {
      where.dueAt = { lt: new Date() };
      where.status = where.status ?? { in: ["OPEN", "IN_PROGRESS"] };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.commTask.findMany({
        where,
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: this.taskInclude()
      }),
      this.prisma.commTask.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getTask(id: string) {
    const row = await this.prisma.commTask.findUnique({
      where: { id },
      include: this.taskInclude()
    });
    if (!row) throw new NotFoundException(`CommTask ${id} not found.`);
    return row;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private threadInclude() {
    return {
      createdBy: { select: { id: true, firstName: true, lastName: true } }
    } satisfies Prisma.CommThreadInclude;
  }

  private taskInclude() {
    return {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } }
    } satisfies Prisma.CommTaskInclude;
  }

  private requireEntityType(type: string): asserts type is CommEntityType {
    if (!COMM_ENTITY_TYPES.includes(type as CommEntityType)) {
      throw new BadRequestException(
        `Unsupported entityType "${type}". Expected one of ${COMM_ENTITY_TYPES.join(", ")}.`
      );
    }
  }

  private async requireUser(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`User ${id} not found.`);
  }

  private dedupe(ids: string[]): string[] {
    return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  }
}

// ── Pure helpers (exported for testing) ─────────────────────────────────────

/**
 * Extract @mentions from a message body. Matches `@word` where word is
 * alphanumeric + `._-`. Returns the mention text WITHOUT the leading `@`.
 * Callers resolve these to user ids; the service dedupes.
 */
export function extractMentions(body: string): string[] {
  const matches = body.matchAll(/(^|\s)@([\w.\-]+)/g);
  const out: string[] = [];
  for (const m of matches) out.push(m[2]);
  return out;
}
