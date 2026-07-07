/**
 * Pure data-shaping helpers for the Program snapshot dashboard widget.
 *
 * Kept side-effect-free so the shape logic (window clipping, top-N ranking)
 * can be unit-tested without React or the network.
 */

export type SnapshotTask = {
  id: string;
  title: string;
  discipline: string | null;
  startDate: string;
  endDate: string;
  progress: number;
  colour: string | null;
};

export type SnapshotProject = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  tasks: SnapshotTask[];
};

export type ClippedTask = SnapshotTask & {
  offsetPct: number;
  widthPct: number;
};

/** Clip a single task to the visible window. Returns null when the task
 *  falls entirely outside — callers filter these out. */
export function clipTaskToWindow(
  task: SnapshotTask,
  windowStart: Date,
  windowEnd: Date
): ClippedTask | null {
  const s = new Date(task.startDate).getTime();
  const e = new Date(task.endDate).getTime();
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  const clampedStart = Math.max(s, ws);
  const clampedEnd = Math.min(e, we);
  if (clampedEnd < clampedStart) return null;
  const span = we - ws;
  if (span <= 0) return null;
  return {
    ...task,
    offsetPct: ((clampedStart - ws) / span) * 100,
    widthPct: Math.max(0.5, ((clampedEnd - clampedStart) / span) * 100)
  };
}

/** Clip an entire project's tasks and drop those that fall outside the window. */
export function clipProjectTasks(
  project: SnapshotProject,
  windowStart: Date,
  windowEnd: Date
): { project: SnapshotProject; clipped: ClippedTask[] } {
  const clipped: ClippedTask[] = [];
  for (const t of project.tasks) {
    const c = clipTaskToWindow(t, windowStart, windowEnd);
    if (c) clipped.push(c);
  }
  return { project, clipped };
}
