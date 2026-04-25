import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const DISCIPLINE_COLOURS: Record<string, string> = {
  SO: "#005B61",
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

@Injectable()
export class GanttService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string, user: { sub: string; isSuperUser?: boolean }) {
    await this.requireProjectAccess(projectId, user);
    return this.prisma.ganttTask.findMany({
      where: { projectId },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }]
    });
  }

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

  // Auto-generate one task per discipline that has scope items.
  // Duration is the sum of "days" values in scope item measurements when
  // available; otherwise falls back to a 5-business-day default per discipline.
  // Tasks are stacked sequentially starting from project.plannedStartDate
  // (or today) so the timeline is non-overlapping out of the box — the user
  // is expected to drag bars after generation to reflect actual sequencing.
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
      select: { discipline: true, days: true }
    });
    if (items.length === 0) {
      throw new BadRequestException("Source tender has no scope items.");
    }

    const buckets = new Map<string, number>();
    for (const item of items) {
      if (!item.discipline) continue;
      const d = item.discipline;
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

  // Active-projects timeline used by the dashboard widget. Returns one bar per
  // active project the requesting user can see — super-users see all; others
  // see only projects where they're on the team (PM, supervisor, estimator,
  // WHS officer). This matches the team-scoping the rest of the app applies.
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

  // Project access check used before reading or writing Gantt tasks. Super-users
  // have global access; everyone else must be on the project team. Throws 404
  // (not 403) when the user can't see the project, to avoid leaking existence.
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
