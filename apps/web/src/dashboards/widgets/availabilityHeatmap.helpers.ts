/**
 * Pure data-shaping helpers for the Availability heatmap dashboard widget.
 *
 * The API returns already-bucketed cells, but two shape rules are worth
 * testing at the pure-logic layer:
 *   1. `bucketLoad` — the 0/1/≥2 distinct-project → free/partial/full mapping
 *      that both this widget and the API endpoint agree on.
 *   2. `distinctProjectsPerDay` — the multi-role dedupe rule (two allocation
 *      rows for the same worker+date+project count as ONE project). This
 *      backs the locked "one worker-day" invariant on scheduler.
 */

export type LoadBucket = "free" | "partial" | "full";

export type HeatmapDay = { date: string; isWeekend: boolean };

export type HeatmapCell = {
  date: string;
  load: LoadBucket;
  projectCount: number;
};

export type HeatmapWorker = {
  workerProfileId: string;
  firstName: string;
  lastName: string;
  role: string;
  totalLoad: number;
  cells: HeatmapCell[];
};

/** Bucket a distinct-project count into a load band. Same rule as the API. */
export function bucketLoad(projectCount: number): LoadBucket {
  if (projectCount <= 0) return "free";
  if (projectCount === 1) return "partial";
  return "full";
}

/** Given a flat list of (workerId, date, projectId) allocation rows (which may
 *  contain duplicates for the same worker+date+project from multi-role rows),
 *  compute distinct project count keyed by `${workerId}::${date}`. */
export function distinctProjectsPerDay(
  rows: Array<{ workerProfileId: string; date: string; projectId: string }>
): Map<string, number> {
  const perKey = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.workerProfileId}::${r.date}`;
    const set = perKey.get(key) ?? new Set<string>();
    set.add(r.projectId);
    perKey.set(key, set);
  }
  const out = new Map<string, number>();
  for (const [k, v] of perKey) out.set(k, v.size);
  return out;
}

export function loadColour(load: LoadBucket, isWeekend = false): string {
  if (isWeekend) return "var(--surface-muted, #f3f4f6)";
  switch (load) {
    case "free":
      return "var(--status-success-soft, #dcfce7)";
    case "partial":
      return "var(--status-warning-soft, #fef3c7)";
    case "full":
      return "var(--status-danger-soft, #fee2e2)";
  }
}
