import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EligibleWorkersQueryDto,
  RangeScheduleAllocationDto,
  ScheduleAllocationQueryDto,
  UpsertScheduleAllocationDto
} from "./dto/schedule-allocation.dto";

/**
 * Acting principal context — mirrors {@link AllocationsService}. `permissions`
 * carries the JWT-granted codes and `isSuperUser` is the root-tier bypass.
 */
type ActorContext = {
  userId: string;
  permissions?: ReadonlyArray<string>;
  isSuperUser?: boolean;
};

/**
 * Eligibility reasons returned per worker. Each is a stable machine code
 * the grid can render to the user (`expired:asbestos_a`, `on_leave`,
 * `double_booked:Buranda SS`). Empty `reasons` array ⇒ eligible.
 */
export type EligibilityReason = string;

export type EligibilityResult = {
  eligible: boolean;
  reasons: EligibilityReason[];
};

const OVERRIDE_PERMISSIONS = ["scheduler.manage"] as const;

function canOverride(actor: ActorContext): boolean {
  if (actor.isSuperUser) return true;
  const granted = actor.permissions ?? [];
  return OVERRIDE_PERMISSIONS.some((code) => granted.includes(code));
}

/** Truncate a Date to midnight UTC (day grain). */
function dayUtc(input: string | Date): Date {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function* daysInRange(from: Date, to: Date): Generator<Date> {
  const start = dayUtc(from);
  const end = dayUtc(to);
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    yield new Date(cursor);
  }
}

/**
 * §9 Scheduler day-grain allocation service (PR-452).
 *
 * Adds canonical day-grain ScheduleAllocation alongside the existing
 * range-based ProjectAllocation (which keeps owning timesheet / pre-start
 * / competency-gate paths). The grid UI consumes the read endpoints here.
 *
 * Eligibility and conflict flags are COMPUTED on read — never denormalised.
 * Eligibility composes three checks against a single date:
 *   1. Mandatory competencies for the JobRole (effective-dated against
 *      WorkerQualification.expiryDate).
 *   2. Availability: no overlapping approved WorkerLeave, no
 *      WorkerUnavailability covering the date (range or recurringDay).
 *   3. Capacity: not already allocated to a different project that day.
 *
 * The "showAll" upsert path lets a `scheduler.manage` actor override an
 * ineligible allocation with a mandatory `reason`; the reason is stored on
 * the row and an AuditLog entry of action `schedule.unqualified_override`
 * is emitted.
 */
@Injectable()
export class ScheduleAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Eligibility ────────────────────────────────────────────────────────

  /**
   * Compute the eligibility of `workerProfileId` for `jobRoleId` on `date`.
   *
   * `excludeProjectId` lets capacity checks ignore the current cell when
   * re-evaluating an existing allocation (so editing your own cell doesn't
   * report it as a double-book against itself).
   */
  async computeEligibility(
    workerProfileId: string,
    jobRoleId: string | null | undefined,
    date: Date,
    excludeProjectId?: string
  ): Promise<EligibilityResult> {
    const reasons: EligibilityReason[] = [];
    const day = dayUtc(date);

    // 1) Mandatory competencies for the role.
    if (jobRoleId) {
      const role = await this.prisma.jobRole.findUnique({
        where: { id: jobRoleId },
        include: {
          requirements: {
            where: { isMandatory: true },
            include: { competency: { select: { code: true, name: true } } }
          }
        }
      });
      if (role) {
        const requiredCodes = role.requirements
          .map((r) => r.competency.code)
          .filter((code): code is string => Boolean(code));

        if (requiredCodes.length > 0) {
          const quals = await this.prisma.workerQualification.findMany({
            where: { workerProfileId, qualType: { in: requiredCodes } }
          });
          const validByCode = new Map<string, boolean>();
          for (const q of quals) {
            const valid = q.expiryDate === null || q.expiryDate >= day;
            validByCode.set(q.qualType, (validByCode.get(q.qualType) ?? false) || valid);
          }
          for (const code of requiredCodes) {
            const valid = validByCode.get(code);
            if (valid === undefined) reasons.push(`missing:${code}`);
            else if (!valid) reasons.push(`expired:${code}`);
          }
        }
      }
    }

    // 2) Approved leave covering the day.
    const leave = await this.prisma.workerLeave.findFirst({
      where: {
        workerProfileId,
        status: "APPROVED",
        startDate: { lte: day },
        endDate: { gte: day }
      },
      select: { leaveType: true }
    });
    if (leave) reasons.push(`on_leave:${leave.leaveType}`);

    // 3) Unavailability — range or recurringDay (0=Sun..6=Sat).
    const dayOfWeek = day.getUTCDay();
    const unavail = await this.prisma.workerUnavailability.findFirst({
      where: {
        workerProfileId,
        OR: [
          { startDate: { lte: day }, endDate: { gte: day } },
          { recurringDay: dayOfWeek }
        ]
      },
      select: { reason: true }
    });
    if (unavail) reasons.push(`unavailable:${unavail.reason}`);

    // 4) Capacity — already allocated to another project that day.
    const otherCell = await this.prisma.scheduleAllocation.findFirst({
      where: {
        workerProfileId,
        date: day,
        ...(excludeProjectId ? { projectId: { not: excludeProjectId } } : {})
      },
      include: { project: { select: { projectNumber: true, name: true } } }
    });
    if (otherCell) {
      reasons.push(`double_booked:${otherCell.project.projectNumber}`);
    }

    return { eligible: reasons.length === 0, reasons };
  }

  // ─── Read (grid) ────────────────────────────────────────────────────────

  /**
   * Return the cells inside `[from, to]`, grouped per `orientation`, plus
   * per-cell conflict flags computed against the same window.
   *
   * `orientation === 'project'` rows are projects with worker/asset cells
   * by date. `orientation === 'resource'` rows are workers/assets with
   * project cells by date. The grid picks one or the other.
   */
  async list(query: ScheduleAllocationQueryDto) {
    const from = dayUtc(query.from);
    const to = dayUtc(query.to);
    if (to < from) throw new BadRequestException("`to` must be on or after `from`.");

    const cells = await this.prisma.scheduleAllocation.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(query.projectId ? { projectId: query.projectId } : {})
      },
      orderBy: [{ date: "asc" }, { projectId: "asc" }],
      include: {
        project: { select: { id: true, projectNumber: true, name: true } },
        workerProfile: { select: { id: true, firstName: true, lastName: true, role: true } },
        asset: { select: { id: true, name: true, assetCode: true } },
        jobRole: { select: { id: true, name: true, colour: true } }
      }
    });

    // Worker-day conflict map (any worker with 2+ different-project cells
    // on the same date is double-booked; the impacted cells get red flags;
    // a worker with a cell on this project but also another that day is
    // already covered by red; "amber" applies when this slot is empty but
    // the worker is allocated elsewhere — surfaced by the resource view).
    const byWorkerDate = new Map<string, Set<string>>();
    for (const cell of cells) {
      if (!cell.workerProfileId) continue;
      const key = `${cell.workerProfileId}|${cell.date.toISOString().slice(0, 10)}`;
      const set = byWorkerDate.get(key) ?? new Set<string>();
      set.add(cell.projectId);
      byWorkerDate.set(key, set);
    }
    const flagged = cells.map((cell) => {
      let conflict: "none" | "red" | "amber" = "none";
      if (cell.workerProfileId) {
        const key = `${cell.workerProfileId}|${cell.date.toISOString().slice(0, 10)}`;
        const projects = byWorkerDate.get(key);
        if (projects && projects.size > 1) conflict = "red";
      }
      return { ...cell, conflict };
    });

    const orientation = query.orientation ?? "project";
    return { orientation, from, to, cells: flagged };
  }

  // ─── Eligible workers list (fit the bill) ───────────────────────────────

  /**
   * Default: returns workers that pass eligibility AND availability for the
   * date+role+project. `showAll === true` returns every available worker
   * (eligibility relaxed) flagged with `eligible` and `reasons[]` so the UI
   * can render the disqualified ones with a warning.
   */
  async eligibleWorkers(query: EligibleWorkersQueryDto) {
    const day = dayUtc(query.date);
    const role = await this.prisma.jobRole.findUnique({
      where: { id: query.jobRoleId },
      select: { id: true }
    });
    if (!role) throw new NotFoundException("Job role not found.");

    const workers = await this.prisma.workerProfile.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, role: true }
    });

    const results = await Promise.all(
      workers.map(async (w) => {
        const verdict = await this.computeEligibility(w.id, query.jobRoleId, day, query.projectId);
        return { worker: w, ...verdict };
      })
    );

    if (query.showAll) return { workers: results };
    return { workers: results.filter((r) => r.eligible) };
  }

  // ─── Upsert one cell ────────────────────────────────────────────────────

  async upsert(dto: UpsertScheduleAllocationDto, actor: ActorContext) {
    this.assertTargetShape(dto.targetType, dto.workerProfileId, dto.assetId);
    const day = dayUtc(dto.date);

    // Project must exist.
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, projectNumber: true, name: true }
    });
    if (!project) throw new NotFoundException("Project not found.");

    let overrideReason: string | null = null;

    if (dto.targetType === "WORKER" && dto.workerProfileId) {
      // Re-evaluate eligibility on every write. excludeProjectId = this project
      // so editing an existing cell on the same project doesn't self-conflict.
      const verdict = await this.computeEligibility(
        dto.workerProfileId,
        dto.jobRoleId,
        day,
        dto.projectId
      );
      if (!verdict.eligible) {
        if (!dto.override) {
          throw new ConflictException({
            error: "SCHEDULE_ELIGIBILITY_BLOCKED",
            message:
              "Worker is not eligible for this slot. Provide an override with a reason via the showAll path.",
            reasons: verdict.reasons,
            projectId: project.id,
            projectNumber: project.projectNumber
          });
        }
        if (!canOverride(actor)) {
          throw new ForbiddenException(
            "Overriding scheduler eligibility requires scheduler.manage or super-user."
          );
        }
        const trimmed = dto.override.reason?.trim() ?? "";
        if (trimmed.length === 0) throw new BadRequestException("Override reason is required.");
        overrideReason = trimmed;
      }
    }

    // Manual upsert via findFirst + create/update. We can't use Prisma's
    // compound-unique upsert here because the unique key includes a
    // nullable column (jobRoleId for workers, no jobRoleId for assets),
    // and PostgreSQL's UNIQUE treats NULLs as distinct — Prisma's
    // generated where clause refuses `null` for the optional field.
    const existing = await this.prisma.scheduleAllocation.findFirst({
      where: {
        date: day,
        projectId: dto.projectId,
        targetType: dto.targetType,
        ...(dto.targetType === "WORKER"
          ? { workerProfileId: dto.workerProfileId!, jobRoleId: dto.jobRoleId ?? null }
          : { assetId: dto.assetId! })
      }
    });

    const allocation = existing
      ? await this.prisma.scheduleAllocation.update({
          where: { id: existing.id },
          data: {
            note: dto.note ?? null,
            ...(dto.targetType === "WORKER" ? { overrideReason } : {})
          }
        })
      : await this.prisma.scheduleAllocation.create({
          data: {
            date: day,
            projectId: dto.projectId,
            targetType: dto.targetType,
            ...(dto.targetType === "WORKER"
              ? {
                  workerProfileId: dto.workerProfileId!,
                  jobRoleId: dto.jobRoleId ?? null,
                  overrideReason
                }
              : { assetId: dto.assetId!, jobRoleId: dto.jobRoleId ?? null }),
            note: dto.note ?? null,
            createdById: actor.userId
          }
        });

    if (overrideReason) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "schedule.unqualified_override",
          entityType: "ScheduleAllocation",
          entityId: allocation.id,
          metadata: {
            projectId: project.id,
            projectNumber: project.projectNumber,
            workerProfileId: dto.workerProfileId ?? null,
            jobRoleId: dto.jobRoleId ?? null,
            date: day.toISOString().slice(0, 10),
            reason: overrideReason
          } satisfies Prisma.InputJsonValue
        }
      });
    }

    return { allocation };
  }

  // ─── Bulk fill / clear over a range ─────────────────────────────────────

  async range(dto: RangeScheduleAllocationDto, actor: ActorContext) {
    this.assertTargetShape(dto.targetType, dto.workerProfileId, dto.assetId);
    const from = dayUtc(dto.from);
    const to = dayUtc(dto.to);
    if (to < from) throw new BadRequestException("`to` must be on or after `from`.");

    if (dto.clear) {
      const result = await this.prisma.scheduleAllocation.deleteMany({
        where: {
          date: { gte: from, lte: to },
          projectId: dto.projectId,
          ...(dto.targetType === "WORKER"
            ? { workerProfileId: dto.workerProfileId!, jobRoleId: dto.jobRoleId ?? null }
            : { assetId: dto.assetId! })
        }
      });
      return { cleared: result.count };
    }

    const created: string[] = [];
    for (const day of daysInRange(from, to)) {
      const out = await this.upsert(
        {
          date: day.toISOString().slice(0, 10),
          projectId: dto.projectId,
          targetType: dto.targetType,
          workerProfileId: dto.workerProfileId,
          assetId: dto.assetId,
          jobRoleId: dto.jobRoleId,
          note: dto.note,
          override: dto.override
        },
        actor
      );
      created.push(out.allocation.id);
    }
    return { upserted: created.length, ids: created };
  }

  // ─── Delete one ─────────────────────────────────────────────────────────

  async remove(id: string) {
    const existing = await this.prisma.scheduleAllocation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Schedule allocation not found.");
    await this.prisma.scheduleAllocation.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private assertTargetShape(targetType: "WORKER" | "ASSET", workerProfileId?: string, assetId?: string) {
    if (targetType === "WORKER") {
      if (!workerProfileId || assetId) {
        throw new BadRequestException("WORKER cells require workerProfileId and must not set assetId.");
      }
    } else {
      if (!assetId || workerProfileId) {
        throw new BadRequestException("ASSET cells require assetId and must not set workerProfileId.");
      }
    }
  }
}
