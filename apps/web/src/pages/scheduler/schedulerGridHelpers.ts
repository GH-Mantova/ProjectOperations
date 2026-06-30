// Pure helpers for the PR-453 scheduler day-grid UI. Split from the page so the
// date math, grouping and conflict-flag derivation can be unit-tested without
// dragging the React tree in.

export type GridOrientation = "project" | "resource";
export type GridView = "month" | "week";

export type GridCell = {
  id: string;
  date: string; // YYYY-MM-DD (server-emitted, UTC-truncated)
  projectId: string;
  targetType: "WORKER" | "ASSET";
  workerProfileId: string | null;
  assetId: string | null;
  jobRoleId: string | null;
  note: string | null;
  overrideReason: string | null;
  conflict: "none" | "red" | "amber";
  project: { id: string; projectNumber: string; name: string };
  workerProfile: { id: string; firstName: string; lastName: string; role: string | null } | null;
  asset: { id: string; name: string; assetCode: string } | null;
  jobRole: { id: string; name: string; colour: string | null } | null;
};

export type PublicHoliday = { id: string; date: string; name: string; region: string };

export function isoDay(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

// Monday-anchored week (matches the existing workspace page).
export function startOfWeekUtc(date: Date): Date {
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDaysUtc(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())), offset);
}

export function visibleRange(view: GridView, cursor: Date): { from: Date; to: Date; days: Date[] } {
  if (view === "week") {
    const from = startOfWeekUtc(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDaysUtc(from, i));
    return { from, to: addDaysUtc(from, 6), days };
  }
  // Month view: pad to whole weeks so cells line up Mon..Sun.
  const monthStart = startOfMonthUtc(cursor);
  const monthEnd = endOfMonthUtc(cursor);
  const from = startOfWeekUtc(monthStart);
  // Last week ending on Sunday after monthEnd.
  let to = monthEnd;
  while (to.getUTCDay() !== 0) to = addDaysUtc(to, 1);
  const days: Date[] = [];
  for (let d = from; d <= to; d = addDaysUtc(d, 1)) days.push(d);
  return { from, to, days };
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export type ResourceRow = {
  key: string;
  kind: "WORKER" | "ASSET";
  id: string;
  label: string;
  sub?: string;
};

export type GroupedRows = {
  groupId: string;
  groupLabel: string;
  groupSub?: string;
  rows: ResourceRow[];
};

/** Per (date, workerId) headcount across the visible cells. Drives the
 * amber-flag rendering on the resource view: an empty cell on project A for a
 * worker who is already on project B that day. */
export function workerDayMap(cells: GridCell[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const cell of cells) {
    if (!cell.workerProfileId) continue;
    const key = `${cell.workerProfileId}|${cell.date}`;
    const set = map.get(key) ?? new Set<string>();
    set.add(cell.projectId);
    map.set(key, set);
  }
  return map;
}

/** Compute the visual conflict for an empty cell on `projectId` for `workerId`
 * on a given date. Returns amber when the worker is allocated elsewhere that
 * day, none otherwise. Filled cells already carry their own `conflict`. */
export function emptyCellAmber(
  byWorkerDate: Map<string, Set<string>>,
  workerProfileId: string,
  projectId: string,
  date: string
): boolean {
  const set = byWorkerDate.get(`${workerProfileId}|${date}`);
  if (!set || set.size === 0) return false;
  // Already on another project → amber here.
  if (!set.has(projectId)) return true;
  return false;
}

/** Group cells by (projectId, workerProfileId+jobRoleId) — by-job orientation.
 * Each project row contains nested worker rows. Empty groups are dropped
 * when the input contains no cells, but page-level callers can still inject
 * stub rows for projects with no allocations (e.g. "hide empty"). */
export function groupByJob(cells: GridCell[]): GroupedRows[] {
  const byProject = new Map<string, GridCell[]>();
  for (const cell of cells) {
    const list = byProject.get(cell.projectId) ?? [];
    list.push(cell);
    byProject.set(cell.projectId, list);
  }
  const groups: GroupedRows[] = [];
  for (const [projectId, projectCells] of byProject) {
    const project = projectCells[0]!.project;
    const seen = new Map<string, ResourceRow>();
    for (const cell of projectCells) {
      if (cell.targetType === "WORKER" && cell.workerProfile) {
        const roleKey = cell.jobRoleId ?? "_";
        const key = `${cell.workerProfileId}|${roleKey}`;
        if (!seen.has(key)) {
          seen.set(key, {
            key,
            kind: "WORKER",
            id: cell.workerProfile.id,
            label: `${cell.workerProfile.firstName} ${cell.workerProfile.lastName}`,
            sub: cell.jobRole?.name ?? cell.workerProfile.role ?? undefined
          });
        }
      } else if (cell.targetType === "ASSET" && cell.asset) {
        const key = `A|${cell.asset.id}`;
        if (!seen.has(key)) {
          seen.set(key, {
            key,
            kind: "ASSET",
            id: cell.asset.id,
            label: cell.asset.name,
            sub: cell.asset.assetCode
          });
        }
      }
    }
    groups.push({
      groupId: projectId,
      groupLabel: project.projectNumber,
      groupSub: project.name,
      rows: Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
    });
  }
  return groups.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
}

/** By-resource: one row per worker/asset; cells reference whichever project
 * that resource is allocated to that day. Useful for spotting double-bookings
 * and gaps across all projects. */
export function groupByResource(cells: GridCell[]): GroupedRows[] {
  const workers = new Map<string, ResourceRow>();
  const assets = new Map<string, ResourceRow>();
  for (const cell of cells) {
    if (cell.targetType === "WORKER" && cell.workerProfile) {
      const w = cell.workerProfile;
      const key = `W|${w.id}`;
      if (!workers.has(key)) {
        workers.set(key, {
          key,
          kind: "WORKER",
          id: w.id,
          label: `${w.firstName} ${w.lastName}`,
          sub: w.role ?? undefined
        });
      }
    } else if (cell.targetType === "ASSET" && cell.asset) {
      const key = `A|${cell.asset.id}`;
      if (!assets.has(key)) {
        assets.set(key, {
          key,
          kind: "ASSET",
          id: cell.asset.id,
          label: cell.asset.name,
          sub: cell.asset.assetCode
        });
      }
    }
  }
  return [
    {
      groupId: "workers",
      groupLabel: "Workers",
      rows: Array.from(workers.values()).sort((a, b) => a.label.localeCompare(b.label))
    },
    {
      groupId: "assets",
      groupLabel: "Assets",
      rows: Array.from(assets.values()).sort((a, b) => a.label.localeCompare(b.label))
    }
  ].filter((g) => g.rows.length > 0);
}

/** Index by composite cell key for O(1) lookup from the grid renderer. */
export function indexCells(cells: GridCell[]): Map<string, GridCell> {
  const map = new Map<string, GridCell>();
  for (const cell of cells) {
    if (cell.targetType === "WORKER" && cell.workerProfileId) {
      const roleKey = cell.jobRoleId ?? "_";
      map.set(`P|${cell.projectId}|W|${cell.workerProfileId}|${roleKey}|${cell.date}`, cell);
      map.set(`R|W|${cell.workerProfileId}|${cell.date}`, cell);
    } else if (cell.targetType === "ASSET" && cell.assetId) {
      map.set(`P|${cell.projectId}|A|${cell.assetId}|${cell.date}`, cell);
      map.set(`R|A|${cell.assetId}|${cell.date}`, cell);
    }
  }
  return map;
}
