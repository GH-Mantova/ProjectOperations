import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ClosePunchItemDto,
  CreatePunchItemDto,
  ListPunchItemsQueryDto,
  PunchStatus,
  UpdatePunchItemDto
} from "./dto/punch-item.dto";

const punchItemInclude = {
  raisedBy: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  submission: { select: { id: true, summary: true } }
} satisfies Prisma.PunchItemInclude;

/**
 * Job-scoped punch / snag / defect list (§8 close-out, Procore parity).
 *
 * OPEN → IN_PROGRESS → CLOSED. Closing stamps `closedAt` + `closedById`
 * inside the same write. Callers with `projects.view` can read; writes
 * require `projects.manage`. Items with a `submissionId` link back to a
 * `FormSubmission` (e.g. raised from an inspection checklist).
 */
@Injectable()
export class PunchItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByJob(jobId: string, query: ListPunchItemsQueryDto) {
    await this.assertJob(jobId);
    const where: Prisma.PunchItemWhereInput = { jobId };
    if (query.status) where.status = query.status;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    const items = await this.prisma.punchItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      include: punchItemInclude
    });
    return { items };
  }

  async getById(id: string) {
    const row = await this.prisma.punchItem.findUnique({
      where: { id },
      include: punchItemInclude
    });
    if (!row) throw new NotFoundException("Punch item not found");
    return row;
  }

  async create(jobId: string, dto: CreatePunchItemDto, actorUserId: string) {
    await this.assertJob(jobId);
    if (dto.submissionId) {
      const s = await this.prisma.formSubmission.findUnique({ where: { id: dto.submissionId } });
      if (!s) throw new BadRequestException("Linked submission not found");
    }
    return this.prisma.punchItem.create({
      data: {
        jobId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        assignedToId: dto.assignedToId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        photoUrl: dto.photoUrl,
        submissionId: dto.submissionId,
        raisedById: actorUserId
      },
      include: punchItemInclude
    });
  }

  async update(id: string, dto: UpdatePunchItemDto, actorUserId: string) {
    const current = await this.prisma.punchItem.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Punch item not found");

    const data: Prisma.PunchItemUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.dueAt !== undefined) {
      data.dueAt = dto.dueAt === null ? null : new Date(dto.dueAt);
    }
    if (dto.assignedToId !== undefined) {
      data.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) {
      this.assertTransition(current.status as PunchStatus, dto.status);
      data.status = dto.status;
      if (dto.status === "CLOSED" && !current.closedAt) {
        data.closedAt = new Date();
        data.closedBy = { connect: { id: actorUserId } };
      }
      if (dto.status !== "CLOSED" && current.closedAt) {
        data.closedAt = null;
        data.closedBy = { disconnect: true };
        data.closureNote = null;
      }
    }
    return this.prisma.punchItem.update({
      where: { id },
      data,
      include: punchItemInclude
    });
  }

  async close(id: string, dto: ClosePunchItemDto, actorUserId: string) {
    const current = await this.prisma.punchItem.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Punch item not found");
    if (current.status === "CLOSED") {
      throw new BadRequestException("Punch item already closed");
    }
    return this.prisma.punchItem.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedBy: { connect: { id: actorUserId } },
        closureNote: dto.closureNote,
        photoUrl: dto.photoUrl ?? current.photoUrl
      },
      include: punchItemInclude
    });
  }

  async delete(id: string) {
    const current = await this.prisma.punchItem.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Punch item not found");
    await this.prisma.punchItem.delete({ where: { id } });
    return { ok: true };
  }

  private async assertJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) throw new NotFoundException("Job not found");
  }

  private assertTransition(from: PunchStatus, to: PunchStatus) {
    if (from === to) return;
    const graph: Record<PunchStatus, PunchStatus[]> = {
      OPEN: ["IN_PROGRESS", "CLOSED"],
      IN_PROGRESS: ["OPEN", "CLOSED"],
      CLOSED: ["OPEN", "IN_PROGRESS"]
    };
    if (!graph[from]?.includes(to)) {
      throw new BadRequestException(`Invalid punch-item transition ${from} → ${to}`);
    }
  }
}
