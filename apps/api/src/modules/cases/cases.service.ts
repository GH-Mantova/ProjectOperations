import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CasePriority, CaseStatus, CaseType } from "@prisma/client";

// Valid status transitions: each key can move to any of the listed values.
const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  open: ["in_progress", "waiting", "closed"],
  in_progress: ["waiting", "resolved", "closed"],
  waiting: ["open", "in_progress", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: []
};

export type CreateCaseInput = {
  type?: CaseType;
  title: string;
  description?: string | null;
  priority?: CasePriority;
  clientId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  assignedToId?: string | null;
  dueAt?: string | null;
};

export type UpdateCaseInput = {
  type?: CaseType;
  title?: string;
  description?: string | null;
  status?: CaseStatus;
  priority?: CasePriority;
  clientId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  assignedToId?: string | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  resolution?: string | null;
};

export type ListCasesQuery = {
  type?: CaseType;
  status?: CaseStatus;
  assignedToId?: string;
  clientId?: string;
  jobId?: string;
  projectId?: string;
  slaBreached?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};

/**
 * Service for Case management (slice 1) — defects, warranty items, RFIs and
 * complaints tracked through to resolution. Mirrors the D365 Customer Service
 * parity shape described in the architecture decision (2026-07-17).
 *
 * Case numbers are generated as CASE-YYYY-NNN using the CaseNumberSequence
 * singleton, incremented in a serialised transaction to avoid duplicates.
 */
@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Number generation ────────────────────────────────────────────────────

  private async nextCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.caseNumberSequence.upsert({
        where: { id: 1 },
        create: { id: 1, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return updated.lastNumber;
    });
    return `CASE-${year}-${String(seq).padStart(3, "0")}`;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  /**
   * Create a new case. Generates a unique CASE-YYYY-NNN number and records
   * the raising user. Optional links to client, job, or project are validated
   * for existence when supplied.
   */
  async create(input: CreateCaseInput, raisedById: string) {
    if (!input.title?.trim()) {
      throw new BadRequestException("title is required.");
    }
    if (input.clientId) await this.requireClient(input.clientId);
    if (input.jobId) await this.requireJob(input.jobId);
    if (input.projectId) await this.requireProject(input.projectId);
    if (input.assignedToId) await this.requireUser(input.assignedToId);

    const number = await this.nextCaseNumber();

    return this.prisma.case.create({
      data: {
        number,
        type: input.type ?? "other",
        title: input.title.trim(),
        description: input.description ?? null,
        priority: input.priority ?? "medium",
        status: "open",
        clientId: input.clientId ?? null,
        jobId: input.jobId ?? null,
        projectId: input.projectId ?? null,
        raisedById,
        assignedToId: input.assignedToId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null
      },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true, name: true } },
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });
  }

  /**
   * Paginated list of cases with filters. `slaBreached` returns only cases
   * whose `dueAt` is in the past and status is neither resolved nor closed.
   */
  async list(query: ListCasesQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Record<string, unknown> = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.clientId) where.clientId = query.clientId;
    if (query.jobId) where.jobId = query.jobId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.slaBreached === true) {
      where.dueAt = { lt: new Date() };
      where.status = { notIn: ["resolved", "closed"] };
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { number: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } }
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          raisedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, name: true } },
          job: { select: { id: true, jobNumber: true, name: true } },
          project: { select: { id: true, projectNumber: true, name: true } }
        }
      }),
      this.prisma.case.count({ where })
    ]);

    return { items, total, page, limit };
  }

  /**
   * Fetch a single case by id, including its comment thread.
   *
   * @throws NotFoundException When no case exists with `id`.
   */
  async get(id: string) {
    const row = await this.prisma.case.findUnique({
      where: { id },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true, name: true } },
        project: { select: { id: true, projectNumber: true, name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      }
    });
    if (!row) throw new NotFoundException(`Case ${id} not found.`);
    return row;
  }

  /**
   * PATCH update. Status transitions are validated against the allowed-transitions
   * map — illegal moves are rejected with 409.
   *
   * @throws NotFoundException When no case exists with `id`.
   * @throws ConflictException When a requested status transition is not permitted.
   */
  async update(id: string, input: UpdateCaseInput) {
    const existing = await this.prisma.case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Case ${id} not found.`);

    if (input.status && input.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status];
      if (!allowed.includes(input.status)) {
        throw new ConflictException(
          `Cannot transition case from '${existing.status}' to '${input.status}'. ` +
            `Allowed: ${allowed.join(", ") || "none"}.`
        );
      }
    }
    if (input.clientId) await this.requireClient(input.clientId);
    if (input.jobId) await this.requireJob(input.jobId);
    if (input.projectId) await this.requireProject(input.projectId);
    if (input.assignedToId) await this.requireUser(input.assignedToId);

    const data: Record<string, unknown> = {};
    const stringFields: Array<keyof UpdateCaseInput> = [
      "type",
      "title",
      "description",
      "status",
      "priority",
      "resolution"
    ];
    for (const key of stringFields) {
      if (input[key] !== undefined) data[key] = input[key] ?? null;
    }
    const idFields: Array<"clientId" | "jobId" | "projectId" | "assignedToId"> = [
      "clientId",
      "jobId",
      "projectId",
      "assignedToId"
    ];
    for (const key of idFields) {
      if (input[key] !== undefined) data[key] = input[key] ?? null;
    }
    if (input.dueAt !== undefined) {
      data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    }
    if (input.resolvedAt !== undefined) {
      data.resolvedAt = input.resolvedAt ? new Date(input.resolvedAt) : null;
    }

    return this.prisma.case.update({
      where: { id },
      data,
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true, name: true } },
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });
  }

  /**
   * Reassign a case to a different user (or null to unassign).
   *
   * @throws NotFoundException When no case or user exists.
   */
  async assign(id: string, assignedToId: string | null) {
    const existing = await this.prisma.case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Case ${id} not found.`);
    if (assignedToId) await this.requireUser(assignedToId);

    return this.prisma.case.update({
      where: { id },
      data: { assignedToId: assignedToId ?? null },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  // ── Comments ─────────────────────────────────────────────────────────────

  /**
   * Add a comment to a case.
   *
   * @throws NotFoundException When no case exists with `caseId`.
   * @throws BadRequestException When body is empty.
   */
  async addComment(caseId: string, authorId: string, body: string) {
    if (!body?.trim()) throw new BadRequestException("Comment body is required.");
    const exists = await this.prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Case ${caseId} not found.`);

    return this.prisma.caseComment.create({
      data: { caseId, authorId, body: body.trim() },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  /**
   * List all comments on a case in chronological order.
   *
   * @throws NotFoundException When no case exists with `caseId`.
   */
  async listComments(caseId: string) {
    const exists = await this.prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Case ${caseId} not found.`);

    return this.prisma.caseComment.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async requireClient(id: string) {
    const row = await this.prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Client ${id} not found.`);
  }

  private async requireJob(id: string) {
    const row = await this.prisma.job.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Job ${id} not found.`);
  }

  private async requireProject(id: string) {
    const row = await this.prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Project ${id} not found.`);
  }

  private async requireUser(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`User ${id} not found.`);
  }
}
