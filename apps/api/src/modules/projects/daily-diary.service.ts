import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateDailyDiaryDto,
  ListDailyDiariesQueryDto,
  UpdateDailyDiaryDto
} from "./dto/daily-diary.dto";

type ActorContext = { userId: string; permissions: ReadonlySet<string> };

/**
 * Service layer for the Daily Site Diary (ERP gap A). One diary per Project
 * per calendar date; the unique index enforces this at the DB and the
 * service maps the Prisma P2002 violation to a 409. Reads are permitted with
 * `projects.view`, writes with `projects.manage`; only the diary author or
 * an actor with `projects.admin` can flip `submittedAt` back to null once
 * set (submitting a diary marks it as the evidentiary record for that day).
 *
 * The "auto-populate crew / plant from that day's Shift assignments"
 * affordance described in the PR prompt is intentionally deferred — Shift
 * hangs off `Job`, not `Project`, and joining across the tender→job→project
 * conversion boundary was out of scope for this migration. The site team
 * fills the free-text `crewSummary` / `plantOnSite` fields today; the
 * follow-up can pre-fill them once a suggestion endpoint lands.
 */
@Injectable()
export class DailyDiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private toDateOnly(iso: string): Date {
    // Coerce to a UTC midnight Date so Prisma's @db.Date column round-trips
    // without a timezone-driven off-by-one.
    const d = new Date(iso);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private serialize<T extends { temperatureC: Prisma.Decimal | null; date: Date }>(row: T) {
    return {
      ...row,
      temperatureC: row.temperatureC === null ? null : row.temperatureC.toString(),
      date: row.date.toISOString().slice(0, 10)
    };
  }

  async list(projectId: string, query: ListDailyDiariesQueryDto) {
    await this.assertProjectExists(projectId);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const skip = (page - 1) * limit;

    const where: Prisma.DailyDiaryWhereInput = {
      projectId,
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: this.toDateOnly(query.from) } : {}),
              ...(query.to ? { lte: this.toDateOnly(query.to) } : {})
            }
          }
        : {})
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dailyDiary.findMany({
        where,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          site: { select: { id: true, name: true } }
        },
        orderBy: [{ date: "desc" }],
        skip,
        take: limit
      }),
      this.prisma.dailyDiary.count({ where })
    ]);

    return { items: rows.map((r) => this.serialize(r)), total, page, limit };
  }

  async getById(projectId: string, diaryId: string) {
    const row = await this.prisma.dailyDiary.findFirst({
      where: { id: diaryId, projectId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        site: { select: { id: true, name: true } }
      }
    });
    if (!row) throw new NotFoundException("Daily diary not found.");
    return this.serialize(row);
  }

  async create(projectId: string, dto: CreateDailyDiaryDto, actor: ActorContext) {
    await this.assertProjectExists(projectId);
    try {
      const created = await this.prisma.dailyDiary.create({
        data: {
          projectId,
          siteId: dto.siteId ?? null,
          date: this.toDateOnly(dto.date),
          authorId: actor.userId,
          weather: dto.weather ?? null,
          temperatureC: dto.temperatureC ? new Prisma.Decimal(dto.temperatureC) : null,
          crewSummary: dto.crewSummary ?? null,
          plantOnSite: dto.plantOnSite ?? null,
          deliveries: dto.deliveries ?? null,
          visitors: dto.visitors ?? null,
          delays: dto.delays ?? null,
          notes: dto.notes ?? null,
          lineItems: (dto.lineItems ?? []) as Prisma.InputJsonValue,
          attachments: (dto.attachments ?? []) as Prisma.InputJsonValue
        },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          site: { select: { id: true, name: true } }
        }
      });

      await this.audit.write({
        actorId: actor.userId,
        action: "projects.dailyDiary.create",
        entityType: "DailyDiary",
        entityId: created.id,
        metadata: { projectId, date: dto.date }
      });

      return this.serialize(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A diary already exists for this project and date.");
      }
      throw err;
    }
  }

  async update(
    projectId: string,
    diaryId: string,
    dto: UpdateDailyDiaryDto,
    actor: ActorContext
  ) {
    const existing = await this.prisma.dailyDiary.findFirst({
      where: { id: diaryId, projectId },
      select: { id: true, authorId: true, submittedAt: true }
    });
    if (!existing) throw new NotFoundException("Daily diary not found.");

    // Un-submit gate: clearing submittedAt back to null is reserved for the
    // author or an admin, so a submitted diary can't be silently reopened
    // by another PM under `projects.manage`.
    if (
      dto.submittedAt === null &&
      existing.submittedAt !== null &&
      existing.authorId !== actor.userId &&
      !actor.permissions.has("projects.admin")
    ) {
      throw new ForbiddenException("Only the diary author or an admin can un-submit a diary.");
    }

    const data: Prisma.DailyDiaryUpdateInput = {};
    if (dto.siteId !== undefined) data.site = dto.siteId ? { connect: { id: dto.siteId } } : { disconnect: true };
    if (dto.weather !== undefined) data.weather = dto.weather;
    if (dto.temperatureC !== undefined) data.temperatureC = dto.temperatureC ? new Prisma.Decimal(dto.temperatureC) : null;
    if (dto.crewSummary !== undefined) data.crewSummary = dto.crewSummary;
    if (dto.plantOnSite !== undefined) data.plantOnSite = dto.plantOnSite;
    if (dto.deliveries !== undefined) data.deliveries = dto.deliveries;
    if (dto.visitors !== undefined) data.visitors = dto.visitors;
    if (dto.delays !== undefined) data.delays = dto.delays;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.lineItems !== undefined) data.lineItems = dto.lineItems as Prisma.InputJsonValue;
    if (dto.attachments !== undefined) data.attachments = dto.attachments as Prisma.InputJsonValue;
    if (dto.submittedAt !== undefined) {
      data.submittedAt = dto.submittedAt === null ? null : new Date(dto.submittedAt);
    }

    const updated = await this.prisma.dailyDiary.update({
      where: { id: diaryId },
      data,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        site: { select: { id: true, name: true } }
      }
    });

    await this.audit.write({
      actorId: actor.userId,
      action: "projects.dailyDiary.update",
      entityType: "DailyDiary",
      entityId: diaryId,
      metadata: { projectId, fields: Object.keys(dto) }
    });

    return this.serialize(updated);
  }

  async remove(projectId: string, diaryId: string, actor: ActorContext) {
    const existing = await this.prisma.dailyDiary.findFirst({
      where: { id: diaryId, projectId },
      select: { id: true, authorId: true, submittedAt: true }
    });
    if (!existing) throw new NotFoundException("Daily diary not found.");
    if (existing.submittedAt !== null && !actor.permissions.has("projects.admin")) {
      throw new ForbiddenException("Submitted diaries can only be deleted by an admin.");
    }
    await this.prisma.dailyDiary.delete({ where: { id: diaryId } });
    await this.audit.write({
      actorId: actor.userId,
      action: "projects.dailyDiary.delete",
      entityType: "DailyDiary",
      entityId: diaryId,
      metadata: { projectId }
    });
    return { ok: true };
  }

  private async assertProjectExists(projectId: string) {
    const p = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!p) throw new NotFoundException("Project not found.");
  }
}
