import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// PR A1 (2026-05-16) — 4-code discipline system (DEM/CIV/ASB/Other).
// Legacy codes kept as aliases so historical Gantt tasks created before
// the data migration still resolve to a colour.
const DISCIPLINE_COLOURS: Record<string, string> = {
  DEM: "#4A90A4",
  CIV: "#27AE60",
  ASB: "#E67E22",
  Other: "#8E44AD",
  // Legacy aliases — kept until next prune.
  SO: "#4A90A4",
  Str: "#4A90A4",
  Asb: "#E67E22",
  Civ: "#27AE60",
  Prv: "#8E44AD"
};

type UpsertTaskInput = {
  title?: string;
  discipline?: string | null;
  startDate?: string;
  endDate?: string;
  progress?: number;
  colour?: string | null;
  dependencies?: string[];
  assignedToId?: string | null;
  sortOrder?: number;
};

/**
 * Service layer for the project Gantt surface plus the cross-project
 * dashboard timeline widget.
 *
 * Owns:
 *  - Task CRUD scoped to a single project (`list`, `create`, `update`,
 *    `remove`) with team-level access enforcement (`requireProjectAccess`).
 *  - One-shot scope-driven task generation (`generateFromScope`) that
 *    produces one task per discipline from the source tender's scope items,
 *    stacked sequentially from the project's planned start date.
 *  - The dashboard timeline summary (`activeTimeline`) listing one row per
 *    active project the requesting user can see, scoped by team membership.
 *
 * Access policy is `requireProjectAccess`: super-users see all projects;
 * everyone else only sees projects where they are on the team (PM,
 * supervisor, estimator, WHS officer, or creator). Missing access surfaces
 * as `NotFoundException` rather than `ForbiddenException` to avoid leaking
 * project existence.
 *
 * Date invariants on task writes:
 *  - Create requires both `startDate` and `endDate`, and `endDate` must be
 *    on or after `startDate`.
 *  - Update re-validates the EFFECTIVE start/end pair (incoming where
 *    provided, existing otherwise) so a partial PATCH cannot invert the bar.
 *  - `progress` is clamped to [0, 100] on update.
 *
 * Dependencies are stored as a string array of upstream task ids on the
 * task row. Critical-path computation is not currently implemented in the
 * service — the array drives dependency arrows in the UI only.
 */
@Injectable()
export class GanttService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List Gantt tasks for the project, ordered by `sortOrder` then
   * `startDate`. Includes the assigned user join (id + name).
   *
   * @throws NotFoundException when the user has no team access to the project.
   */
  async list(projectId: string, user: { sub: string; isSuperUser?: boolean }) {
    await this.requireProjectAccess(projectId, user);
    return this.prisma.ganttTask.findMany({
      where: { projectId },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }]
    });
  }

  /**
   * Create a Gantt task on the project.
   *
   * Validates: `title` is required and trimmed; `startDate` and `endDate`
   * are required, parseable, and ordered (`endDate >= startDate`). When
   * `colour` is omitted, falls back to {@link DISCIPLINE_COLOURS}[discipline]
   * if a discipline is provided, otherwise `null`. `dependencies` defaults
   * to an empty array, `progress` to 0, `sortOrder` to 0.
   *
   * @throws BadRequestException on missing/invalid fields.
   * @throws NotFoundException when the user has no team access to the project.
   */
  async create(
    projectId: string,
    input: UpsertTaskInput,
    user: { sub: string; isSuperUser?: boolean }
  ) {
    await this.requireProjectAccess(projectId, user);
    if (!input.title?.trim()) throw new BadRequestException("title is required.");
    if (!input.startDate || !input.endDate) {
      throw new BadRequestException("startDate and endDate are required.");
    }
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Invalid date format.");
    }
    if (end < start) throw new BadRequestException("endDate must be on or after startDate.");

    return this.prisma.ganttTask.create({
      data: {
        projectId,
        title: input.title.trim(),
        discipline: input.discipline ?? null,
        startDate: start,
        endDate: end,
        progress: input.progress ?? 0,
        colour: input.colour ?? (input.discipline ? DISCIPLINE_COLOURS[input.discipline] ?? null : null),
        dependencies: input.dependencies ?? [],
        assignedToId: input.assignedToId ?? null,
        sortOrder: input.sortOrder ?? 0
      }
    });
  }

  /**
   * Partially update a Gantt task.
   *
   * The (projectId, taskId) pair is scoped so updates cannot cross project
   * boundaries. `progress` is clamped to [0, 100]. Effective start/end are
   * computed from incoming-or-existing values and re-validated so a partial
   * PATCH cannot invert the bar.
   *
   * @throws NotFoundException if the task does not belong to the project, or
   *         if the user has no team access.
   * @throws BadRequestException on invalid date or inverted bar.
   */
  async update(
    projectId: string,
    taskId: string,
    input: UpsertTaskInput,
    user: { sub: string; isSuperUser?: boolean }
  ) {
    await this.requireProjectAccess(projectId, user);
    const existing = await this.prisma.ganttTask.findFirst({ where: { id: taskId, projectId } });
    if (!existing) throw new NotFoundException("Task not found on this project.");
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.discipline !== undefined) data.discipline = input.discipline;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) data.endDate = new Date(input.endDate);
    if (input.progress !== undefined) {
      const p = Math.max(0, Math.min(100, input.progress));
      data.progress = p;
    }
    if (input.colour !== undefined) data.colour = input.colour;
    if (input.dependencies !== undefined) data.dependencies = input.dependencies;
    if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    // Resolve effective start/end for ordering check — incoming if set, else the
    // existing values — so a partial update can't invert the bar.
    const effectiveStart = (data.startDate as Date | undefined) ?? existing.startDate;
    const effectiveEnd = (data.endDate as Date | undefined) ?? existing.endDate;
    if (Number.isNaN(effectiveStart.getTime()) || Number.isNaN(effectiveEnd.getTime())) {
      throw new BadRequestException("Invalid date format.");
    }
    if (effectiveEnd < effectiveStart) {
      throw new BadRequestException("endDate must be on or after startDate.");
    }

    return this.prisma.ganttTask.update({ where: { id: taskId }, data });
  }

  /**
   * Delete a Gantt task by (projectId, taskId).
   *
   * Returns `{ id }` of the deleted task. Does NOT cascade to other tasks
   * that list this task as a dependency — the dependencies array is left
   * dangling and the UI is responsible for treating missing ids as broken
   * links.
   *
   * @throws NotFoundException if the task does not belong to the project, or
   *         if the user has no team access.
   */
  async remove(
    projectId: string,
    taskId: string,
    user: { sub: string; isSuperUser?: boolean }
  ) {
    await this.requireProjectAccess(projectId, user);
    const existing = await this.prisma.ganttTask.findFirst({ where: { id: taskId, projectId } });
    if (!existing) throw new NotFoundException("Task not found on this project.");
    await this.prisma.ganttTask.delete({ where: { id: taskId } });
    return { id: taskId };
  }

  /**
   * Auto-generate one Gantt task per discipline from the source-tender scope.
   *
   * Duration per discipline is the SUM of `days` values across scope items
   * tagged with that discipline; scope items missing a `days` value
   * contribute the 5-day default. Tasks are stacked sequentially starting
   * from `project.plannedStartDate` (or today if unset) so the timeline is
   * non-overlapping out of the box. Operators are expected to drag bars
   * after generation to reflect actual sequencing.
   *
   * @throws NotFoundException when the project does not exist (or the user
   *         has no team access).
   * @throws BadRequestException when the project has no source tender, the
   *         source tender has no scope items, or no scope items carry a
   *         discipline tag.
   */
  async generateFromScope(projectId: string, user: { sub: string; isSuperUser?: boolean }) {
    await this.requireProjectAccess(projectId, user);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, plannedStartDate: true, sourceTenderId: true }
    });
    if (!project) throw new NotFoundException("Project not found.");
    if (!project.sourceTenderId) {
      throw new BadRequestException("Project has no source tender — cannot generate from scope.");
    }

    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId: project.sourceTenderId },
      select: { card: { select: { discipline: true } }, days: true }
    });
    if (items.length === 0) {
      throw new BadRequestException("Source tender has no scope items.");
    }

    const buckets = new Map<string, number>();
    for (const item of items) {
      const d = item.card?.discipline;
      if (!d) continue;
      const existing = buckets.get(d) ?? 0;
      const itemDays = item.days ? Number(item.days) : 5;
      buckets.set(d, existing + (Number.isFinite(itemDays) ? itemDays : 5));
    }
    if (buckets.size === 0) {
      throw new BadRequestException("Source tender scope items have no discipline tags.");
    }

    let cursor = project.plannedStartDate ? new Date(project.plannedStartDate) : new Date();
    cursor.setHours(0, 0, 0, 0);
    let sortOrder = 0;
    const created: Array<Record<string, unknown>> = [];

    for (const [discipline, days] of buckets) {
      const start = new Date(cursor);
      const durationMs = Math.max(1, Math.ceil(days)) * 24 * 60 * 60 * 1000;
      const end = new Date(start.getTime() + durationMs);
      const row = await this.prisma.ganttTask.create({
        data: {
          projectId,
          title: `${discipline} works`,
          discipline,
          startDate: start,
          endDate: end,
          progress: 0,
          colour: DISCIPLINE_COLOURS[discipline] ?? null,
          dependencies: [],
          sortOrder: sortOrder++
        }
      });
      created.push(row);
      cursor = new Date(end.getTime());
    }

    return { created };
  }

  /**
   * One-row-per-active-project summary for the dashboard timeline widget.
   *
   * Active = status in `MOBILISING / ACTIVE / PRACTICAL_COMPLETION / DEFECTS`
   * (CLOSED is excluded). Team-scoped: super-users see all; others see only
   * projects where they are PM, supervisor, estimator, or WHS officer. Each
   * row uses `plannedStartDate` falling back to `actualStartDate` for the
   * bar start, and `plannedEndDate` falling back to `practicalCompletionDate`
   * for the bar end. Sorted ascending by `plannedStartDate`.
   */
  async activeTimeline(
    requestingUser: { sub: string; isSuperUser?: boolean }
  ): Promise<
    Array<{
      id: string;
      name: string;
      projectNumber: string;
      status: string;
      startDate: Date | null;
      endDate: Date | null;
    }>
  > {
    const teamFilter = requestingUser.isSuperUser
      ? {}
      : {
          OR: [
            { projectManagerId: requestingUser.sub },
            { supervisorId: requestingUser.sub },
            { estimatorId: requestingUser.sub },
            { whsOfficerId: requestingUser.sub }
          ]
        };

    const rows = await this.prisma.project.findMany({
      where: {
        status: { in: ["MOBILISING", "ACTIVE", "PRACTICAL_COMPLETION", "DEFECTS"] },
        ...teamFilter
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true,
        plannedStartDate: true,
        plannedEndDate: true,
        actualStartDate: true,
        practicalCompletionDate: true
      },
      orderBy: { plannedStartDate: "asc" }
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      projectNumber: r.projectNumber,
      status: r.status,
      startDate: r.plannedStartDate ?? r.actualStartDate,
      // Planned end is authoritative when set; otherwise fall back to the
      // practical completion date (which the project records on PC sign-off).
      endDate: r.plannedEndDate ?? r.practicalCompletionDate
    }));
  }

  /**
   * Compact program-snapshot payload for the dashboard widget: top N active
   * projects (ranked by task count intersecting the window) each with their
   * Gantt tasks clipped to a rolling `windowDays` window starting today.
   *
   * Justification for a dedicated endpoint: `activeTimeline` returns
   * project-level bars only (no tasks); the per-project `GET /projects/:id/
   * gantt` endpoint requires N round-trips and returns full task detail. This
   * one aggregates the minimum shape a dashboard widget needs.
   *
   * Team-scoped via the same rules as `activeTimeline`. Only tasks that
   * intersect the window are returned; the widget clips the visible edges.
   */
  async programSnapshot(
    requestingUser: { sub: string; isSuperUser?: boolean },
    opts: { windowDays: number; topN: number }
  ): Promise<{
    windowStart: string;
    windowEnd: string;
    projects: Array<{
      id: string;
      projectNumber: string;
      name: string;
      status: string;
      tasks: Array<{
        id: string;
        title: string;
        discipline: string | null;
        startDate: string;
        endDate: string;
        progress: number;
        colour: string | null;
      }>;
    }>;
  }> {
    const windowDays = clampInt(opts.windowDays, 7, 90, 28);
    const topN = clampInt(opts.topN, 1, 20, 8);
    const start = startOfUtcDay(new Date());
    const end = new Date(start.getTime() + windowDays * 86_400_000);

    const teamFilter = requestingUser.isSuperUser
      ? {}
      : {
          OR: [
            { projectManagerId: requestingUser.sub },
            { supervisorId: requestingUser.sub },
            { estimatorId: requestingUser.sub },
            { whsOfficerId: requestingUser.sub }
          ]
        };

    const projects = await this.prisma.project.findMany({
      where: {
        status: { in: ["MOBILISING", "ACTIVE", "PRACTICAL_COMPLETION", "DEFECTS"] },
        ...teamFilter
      },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        status: true,
        ganttTasks: {
          where: { startDate: { lt: end }, endDate: { gte: start } },
          select: {
            id: true,
            title: true,
            discipline: true,
            startDate: true,
            endDate: true,
            progress: true,
            colour: true,
            sortOrder: true
          },
          orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }]
        }
      }
    });

    const ranked = projects
      .filter((p) => p.ganttTasks.length > 0)
      .sort((a, b) => b.ganttTasks.length - a.ganttTasks.length)
      .slice(0, topN);

    return {
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      projects: ranked.map((p) => ({
        id: p.id,
        projectNumber: p.projectNumber,
        name: p.name,
        status: p.status,
        tasks: p.ganttTasks.map((t) => ({
          id: t.id,
          title: t.title,
          discipline: t.discipline,
          startDate: t.startDate.toISOString(),
          endDate: t.endDate.toISOString(),
          progress: t.progress,
          colour: t.colour
        }))
      }))
    };
  }

  /**
   * Verify the user can access this project, used as a guard before any
   * Gantt task read or write.
   *
   * Super-users have global access. Everyone else must be on the project
   * team — defined as PM, supervisor, estimator, WHS officer, or the user
   * who created the project. Missing access surfaces as
   * `NotFoundException` (not 403) to avoid leaking existence of projects
   * the caller can't see.
   */
  async requireProjectAccess(
    projectId: string,
    requestingUser: { sub: string; isSuperUser?: boolean }
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectManagerId: true,
        supervisorId: true,
        estimatorId: true,
        whsOfficerId: true,
        createdById: true
      }
    });
    if (!project) throw new NotFoundException("Project not found.");
    if (requestingUser.isSuperUser) return project;

    const onTeam =
      project.projectManagerId === requestingUser.sub ||
      project.supervisorId === requestingUser.sub ||
      project.estimatorId === requestingUser.sub ||
      project.whsOfficerId === requestingUser.sub ||
      project.createdById === requestingUser.sub;

    if (!onTeam) throw new NotFoundException("Project not found.");
    return project;
  }

  private async requireProject(id: string) {
    const p = await this.prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundException("Project not found.");
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
