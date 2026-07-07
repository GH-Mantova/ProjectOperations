import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AvailabilityReportQueryDto } from "./dto/availability-report.dto";
import {
  buildMonthDays,
  formatIsoDate,
  monthBounds,
  normaliseName,
  renderReportCsv,
  type CsvGroup,
  type CsvReport,
  type DayMeta
} from "./availability-report.helpers";

export interface AvailabilityGroupRow {
  group: string;
  total: number;
  perDay: Array<{ date: string; available: number }>;
}

export interface AvailabilityWorkerRange {
  from: string;
  to: string;
  projects?: Array<{ id: string; projectNumber: string; name: string }>;
}

export type AvailabilityWorkerStatus = "ALWAYS_AVAILABLE" | "ALWAYS_COMMITTED" | "MIXED";

export interface AvailabilityWorkerRow {
  workerProfileId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: AvailabilityWorkerStatus;
  freeRanges: AvailabilityWorkerRange[];
  committedRanges: AvailabilityWorkerRange[];
}

export interface AvailabilityReport {
  month: string;
  skipNonWorkingDays: boolean;
  days: DayMeta[];
  groups: AvailabilityGroupRow[];
  totals: { uniqueAvailablePerDay: Array<{ date: string; count: number }> };
  workers: AvailabilityWorkerRow[];
}

/**
 * PR-454 §9/Reporting — month availability heatmap.
 *
 * Aggregates `WorkerProfile` (active only) against `WorkerLeave` (APPROVED),
 * `WorkerUnavailability` (range or recurringDay), and `ScheduleAllocation`
 * for each day of the requested month. Optionally skips weekends and
 * `PublicHoliday` entries.
 *
 * The TOTAL AVAILABLE row counts UNIQUE people by lowercased trimmed full
 * name — so a worker existing as two records is counted once. Archived
 * (`isActive=false`) workers are excluded.
 */
@Injectable()
export class AvailabilityReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(query: AvailabilityReportQueryDto): Promise<AvailabilityReport> {
    let bounds: { start: Date; endExclusive: Date };
    try {
      bounds = monthBounds(query.month);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const skipNonWorkingDays = query.skipNonWorkingDays === true;

    const [workers, leaves, unavailability, allocations, holidays] = await Promise.all([
      this.prisma.workerProfile.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true },
        orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
      }),
      this.prisma.workerLeave.findMany({
        where: {
          status: "APPROVED",
          startDate: { lt: bounds.endExclusive },
          endDate: { gte: bounds.start }
        },
        select: { workerProfileId: true, startDate: true, endDate: true }
      }),
      this.prisma.workerUnavailability.findMany({
        where: {
          OR: [
            { startDate: { lt: bounds.endExclusive }, endDate: { gte: bounds.start } },
            { recurringDay: { not: null } }
          ]
        },
        select: {
          workerProfileId: true,
          startDate: true,
          endDate: true,
          recurringDay: true
        }
      }),
      this.prisma.scheduleAllocation.findMany({
        where: {
          date: { gte: bounds.start, lt: bounds.endExclusive },
          targetType: "WORKER",
          workerProfileId: { not: null }
        },
        select: {
          workerProfileId: true,
          date: true,
          project: { select: { id: true, projectNumber: true, name: true } }
        }
      }),
      this.prisma.publicHoliday.findMany({
        where: { date: { gte: bounds.start, lt: bounds.endExclusive } },
        select: { date: true }
      })
    ]);

    const holidayDates = new Set(holidays.map((h) => formatIsoDate(h.date)));
    const days = buildMonthDays(query.month, holidayDates, skipNonWorkingDays);
    const activeDays = days.filter((d) => !d.skipped);

    // Index everything by workerProfileId for O(workers*days) walk.
    const leaveByWorker = new Map<string, Array<{ from: Date; to: Date }>>();
    for (const l of leaves) {
      const arr = leaveByWorker.get(l.workerProfileId) ?? [];
      arr.push({ from: l.startDate, to: l.endDate });
      leaveByWorker.set(l.workerProfileId, arr);
    }
    const unavailByWorker = new Map<
      string,
      Array<{ from: Date | null; to: Date | null; recurringDay: number | null }>
    >();
    for (const u of unavailability) {
      const arr = unavailByWorker.get(u.workerProfileId) ?? [];
      arr.push({ from: u.startDate, to: u.endDate, recurringDay: u.recurringDay });
      unavailByWorker.set(u.workerProfileId, arr);
    }
    const allocByWorker = new Map<
      string,
      Map<string, Array<{ id: string; projectNumber: string; name: string }>>
    >();
    for (const a of allocations) {
      if (!a.workerProfileId) continue;
      const iso = formatIsoDate(a.date);
      const byDay = allocByWorker.get(a.workerProfileId) ?? new Map();
      const projects = byDay.get(iso) ?? [];
      projects.push(a.project);
      byDay.set(iso, projects);
      allocByWorker.set(a.workerProfileId, byDay);
    }

    // Per-group aggregation + TOTAL AVAILABLE unique-by-name.
    const groupsMap = new Map<string, { total: number; perDay: Map<string, number> }>();
    const uniqueAvailNamesPerDay = new Map<string, Set<string>>();
    for (const d of activeDays) uniqueAvailNamesPerDay.set(d.date, new Set<string>());

    const workerRows: AvailabilityWorkerRow[] = [];

    for (const w of workers) {
      const group = w.role || "Unassigned";
      const g = groupsMap.get(group) ?? { total: 0, perDay: new Map<string, number>() };
      g.total += 1;
      groupsMap.set(group, g);

      const dayAvailability = new Map<string, { available: boolean; projects: Array<{ id: string; projectNumber: string; name: string }> }>();

      for (const d of activeDays) {
        const date = parseIsoUtc(d.date);
        const onLeave = (leaveByWorker.get(w.id) ?? []).some(
          (l) => l.from <= date && l.to >= date
        );
        const unavail = (unavailByWorker.get(w.id) ?? []).some((u) => {
          const inRange = u.from && u.to && u.from <= date && u.to >= date;
          const recurringMatch = u.recurringDay === d.weekday;
          return Boolean(inRange) || recurringMatch;
        });
        const committed = allocByWorker.get(w.id)?.get(d.date) ?? [];
        const available = !onLeave && !unavail && committed.length === 0;
        dayAvailability.set(d.date, { available, projects: committed });

        if (available) {
          g.perDay.set(d.date, (g.perDay.get(d.date) ?? 0) + 1);
          uniqueAvailNamesPerDay.get(d.date)!.add(normaliseName(w.firstName, w.lastName));
        }
      }

      const totalActive = activeDays.length;
      const availableDays = activeDays.filter((d) => dayAvailability.get(d.date)!.available).length;
      let status: AvailabilityWorkerStatus;
      if (totalActive === 0 || availableDays === totalActive) status = "ALWAYS_AVAILABLE";
      else if (availableDays === 0) status = "ALWAYS_COMMITTED";
      else status = "MIXED";

      const freeRanges = collapseRanges(
        activeDays.filter((d) => dayAvailability.get(d.date)!.available).map((d) => d.date)
      ).map((r) => ({ from: r.from, to: r.to }));
      const committedRanges = collapseCommittedRanges(
        activeDays
          .filter((d) => !dayAvailability.get(d.date)!.available)
          .map((d) => ({ date: d.date, projects: dayAvailability.get(d.date)!.projects }))
      );

      workerRows.push({
        workerProfileId: w.id,
        firstName: w.firstName,
        lastName: w.lastName,
        role: group,
        status,
        freeRanges,
        committedRanges
      });
    }

    const groups: AvailabilityGroupRow[] = Array.from(groupsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, g]) => ({
        group,
        total: g.total,
        perDay: days.map((d) => ({ date: d.date, available: g.perDay.get(d.date) ?? 0 }))
      }));

    const uniqueAvailablePerDay = days.map((d) => ({
      date: d.date,
      count: uniqueAvailNamesPerDay.get(d.date)?.size ?? 0
    }));

    return {
      month: query.month,
      skipNonWorkingDays,
      days,
      groups,
      totals: { uniqueAvailablePerDay },
      workers: workerRows
    };
  }

  /**
   * Rolling-window heatmap for the dashboard widget.
   *
   * For a `days`-wide window starting today, returns the top-N workers
   * (ranked by count of allocated cells) with a per-cell load bucket:
   *   - "free"    — 0 distinct projects allocated
   *   - "partial" — 1 distinct project
   *   - "full"    — 2+ distinct projects
   *
   * Multi-role rule: two ScheduleAllocation rows for the same
   * workerProfileId+date on the same project (differing only by jobRoleId)
   * count as ONE project — the load bucket is computed over the DISTINCT
   * project set for the (worker, day) key. This mirrors the "one worker-
   * day" locked invariant enforced elsewhere.
   *
   * Leave / unavailability suppress the cell to "free" — the widget is a
   * project-load view, not an availability view.
   */
  async heatmap(opts: {
    days: number;
    topN: number;
  }): Promise<{
    windowStart: string;
    windowEnd: string;
    days: Array<{ date: string; isWeekend: boolean }>;
    workers: Array<{
      workerProfileId: string;
      firstName: string;
      lastName: string;
      role: string;
      totalLoad: number;
      cells: Array<{
        date: string;
        load: "free" | "partial" | "full";
        projectCount: number;
      }>;
    }>;
  }> {
    const days = clampInt(opts.days, 7, 42, 14);
    const topN = clampInt(opts.topN, 1, 20, 8);
    const start = startOfUtcDay(new Date());
    const endExclusive = new Date(start.getTime() + days * 86_400_000);

    const [workers, allocations] = await Promise.all([
      this.prisma.workerProfile.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true },
        orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
      }),
      this.prisma.scheduleAllocation.findMany({
        where: {
          date: { gte: start, lt: endExclusive },
          targetType: "WORKER",
          workerProfileId: { not: null }
        },
        select: { workerProfileId: true, projectId: true, date: true }
      })
    ]);

    // Index: worker → (date → distinct project set). Multi-role dedupe is
    // free here because we accumulate into a Set of projectId.
    const projectsByWorkerDay = new Map<string, Map<string, Set<string>>>();
    for (const a of allocations) {
      if (!a.workerProfileId) continue;
      const iso = formatIsoDate(a.date);
      const byDay = projectsByWorkerDay.get(a.workerProfileId) ?? new Map<string, Set<string>>();
      const set = byDay.get(iso) ?? new Set<string>();
      set.add(a.projectId);
      byDay.set(iso, set);
      projectsByWorkerDay.set(a.workerProfileId, byDay);
    }

    const dayList: Array<{ date: string; isWeekend: boolean }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      const weekday = d.getUTCDay();
      dayList.push({ date: formatIsoDate(d), isWeekend: weekday === 0 || weekday === 6 });
    }

    const rows = workers.map((w) => {
      const byDay = projectsByWorkerDay.get(w.id) ?? new Map<string, Set<string>>();
      let totalLoad = 0;
      const cells = dayList.map((d) => {
        const projectCount = byDay.get(d.date)?.size ?? 0;
        const load: "free" | "partial" | "full" =
          projectCount === 0 ? "free" : projectCount === 1 ? "partial" : "full";
        if (projectCount > 0) totalLoad += 1;
        return { date: d.date, load, projectCount };
      });
      return {
        workerProfileId: w.id,
        firstName: w.firstName,
        lastName: w.lastName,
        role: w.role || "Unassigned",
        totalLoad,
        cells
      };
    });

    rows.sort((a, b) => b.totalLoad - a.totalLoad || a.lastName.localeCompare(b.lastName));
    const topRows = rows.slice(0, topN);

    return {
      windowStart: start.toISOString(),
      windowEnd: endExclusive.toISOString(),
      days: dayList,
      workers: topRows
    };
  }

  async reportCsv(query: AvailabilityReportQueryDto): Promise<string> {
    const r = await this.report(query);
    const csv: CsvReport = {
      month: r.month,
      days: r.days,
      groups: r.groups.map<CsvGroup>((g) => ({
        group: g.group,
        total: g.total,
        perDayAvailable: new Map(g.perDay.map((p) => [p.date, p.available]))
      })),
      uniqueAvailablePerDay: new Map(r.totals.uniqueAvailablePerDay.map((p) => [p.date, p.count]))
    };
    return renderReportCsv(csv);
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

function parseIsoUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function collapseRanges(dates: string[]): Array<{ from: string; to: string }> {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const out: Array<{ from: string; to: string }> = [];
  let from = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (parseIsoUtc(cur).getTime() - parseIsoUtc(prev).getTime() === 86_400_000) {
      prev = cur;
      continue;
    }
    out.push({ from, to: prev });
    from = cur;
    prev = cur;
  }
  out.push({ from, to: prev });
  return out;
}

function collapseCommittedRanges(
  entries: Array<{ date: string; projects: Array<{ id: string; projectNumber: string; name: string }> }>
): AvailabilityWorkerRange[] {
  if (entries.length === 0) return [];
  const ranges: AvailabilityWorkerRange[] = [];
  let runFrom = entries[0].date;
  let runTo = entries[0].date;
  let runKey = projectsKey(entries[0].projects);
  let runProjects = entries[0].projects;
  for (let i = 1; i < entries.length; i++) {
    const cur = entries[i];
    const curKey = projectsKey(cur.projects);
    const contiguous =
      parseIsoUtc(cur.date).getTime() - parseIsoUtc(runTo).getTime() === 86_400_000;
    if (contiguous && curKey === runKey) {
      runTo = cur.date;
      continue;
    }
    ranges.push({ from: runFrom, to: runTo, projects: runProjects });
    runFrom = cur.date;
    runTo = cur.date;
    runKey = curKey;
    runProjects = cur.projects;
  }
  ranges.push({ from: runFrom, to: runTo, projects: runProjects });
  return ranges;
}

function projectsKey(projects: Array<{ id: string }>): string {
  return projects
    .map((p) => p.id)
    .sort()
    .join("|");
}
