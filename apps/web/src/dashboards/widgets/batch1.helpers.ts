/**
 * Pure data-shaping helpers for widget batch 1 — kept split from the React
 * components so they can be unit-tested cheaply (same pattern as
 * programSnapshot.helpers.ts / availabilityHeatmap.helpers.ts).
 */

const MS_PER_DAY = 86_400_000;

// ── H1 Days since last incident ─────────────────────────────────────

export function daysSinceIncident(
  latestIncidentDate: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (!latestIncidentDate) return null;
  const d = latestIncidentDate instanceof Date ? latestIncidentDate : new Date(latestIncidentDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = now.getTime() - d.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

// ── W1/W2 Leave & unavailability window overlap ─────────────────────

export type LeaveRow = {
  id: string;
  status: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  workerProfile?: { id: string; firstName: string; lastName: string } | null;
};

export type UnavailabilityRow = {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  recurringDay?: number | null;
  workerProfile?: { id: string; firstName: string; lastName: string } | null;
};

export type AwayRow = {
  id: string;
  workerId: string;
  workerName: string;
  kind: "leave" | "unavailability";
  reason: string;
  startDate: string;
  endDate: string;
};

/** Returns true when [start,end] overlaps [windowStart, windowEnd]. */
export function overlapsWindow(
  start: string | Date,
  end: string | Date,
  windowStart: Date,
  windowEnd: Date
): boolean {
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return s.getTime() <= windowEnd.getTime() && e.getTime() >= windowStart.getTime();
}

export function whoIsAwayThisWeek(
  leaves: LeaveRow[],
  unavailability: UnavailabilityRow[],
  now: Date = new Date(),
  daysAhead = 7
): AwayRow[] {
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + daysAhead * MS_PER_DAY);

  const rows: AwayRow[] = [];
  for (const leave of leaves) {
    if (leave.status !== "APPROVED") continue;
    if (!leave.workerProfile) continue;
    if (!overlapsWindow(leave.startDate, leave.endDate, windowStart, windowEnd)) continue;
    rows.push({
      id: `leave:${leave.id}`,
      workerId: leave.workerProfile.id,
      workerName: `${leave.workerProfile.firstName} ${leave.workerProfile.lastName}`.trim(),
      kind: "leave",
      reason: humaniseLeaveType(leave.leaveType),
      startDate: leave.startDate,
      endDate: leave.endDate
    });
  }
  for (const u of unavailability) {
    if (!u.workerProfile) continue;
    if (u.recurringDay != null) {
      // Weekly-recurring — assume it hits the window if any of the next N days
      // matches the recurring weekday.
      const matches = [...Array(daysAhead).keys()].some((offset) => {
        const day = new Date(windowStart.getTime() + offset * MS_PER_DAY);
        return day.getUTCDay() === u.recurringDay;
      });
      if (!matches) continue;
    } else if (!overlapsWindow(u.startDate, u.endDate, windowStart, windowEnd)) {
      continue;
    }
    rows.push({
      id: `unavail:${u.id}`,
      workerId: u.workerProfile.id,
      workerName: `${u.workerProfile.firstName} ${u.workerProfile.lastName}`.trim(),
      kind: "unavailability",
      reason: u.reason,
      startDate: u.startDate,
      endDate: u.endDate
    });
  }
  return rows.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.workerName.localeCompare(b.workerName));
}

function humaniseLeaveType(type: string): string {
  const t = type.toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function countPendingLeave(leaves: LeaveRow[]): {
  count: number;
  oldestRequestDate: string | null;
} {
  const pending = leaves.filter((l) => l.status === "PENDING");
  if (pending.length === 0) return { count: 0, oldestRequestDate: null };
  const sorted = [...pending].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { count: pending.length, oldestRequestDate: sorted[0].startDate };
}

// ── W3 Hours by project this week ───────────────────────────────────

export type ProjectHoursRow = {
  projectId: string;
  projectNumber: string;
  projectName: string;
  totalHours: number;
  timesheetCount: number;
};

export function topProjectsByHours(
  rows: ProjectHoursRow[] | undefined | null,
  limit = 8
): Array<{ label: string; value: number }> {
  return (rows ?? [])
    .filter((r) => r.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, limit)
    .map((r) => ({ label: r.projectNumber || r.projectName, value: Number(r.totalHours.toFixed(1)) }));
}

/** Monday of the current ISO week (00:00 local time). */
export function currentWeekBounds(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const day = from.getDay(); // 0=Sun, 1=Mon…
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  from.setDate(from.getDate() - daysSinceMonday);
  const to = new Date(from.getTime() + 7 * MS_PER_DAY - 1);
  return { from, to };
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── W4 Assets by status donut ───────────────────────────────────────

export type AssetRow = { id: string; status: string; name?: string };

const ASSET_STATUS_COLOURS: Record<string, string> = {
  AVAILABLE: "#22C55E",
  IN_USE: "#005B61",
  DOWN: "#EF4444",
  MAINTENANCE: "#F59E0B",
  RETIRED: "#94A3B8"
};

export function assetsByStatus(assets: AssetRow[] | undefined | null): Array<{
  label: string;
  value: number;
  color: string;
}> {
  const counts = new Map<string, number>();
  for (const a of assets ?? []) {
    counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({
      label: humaniseStatus(status),
      value,
      color: ASSET_STATUS_COLOURS[status] ?? "#6B7280"
    }));
}

function humaniseStatus(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ── P1 Xero sync health ─────────────────────────────────────────────

export type XeroStatusResponse =
  | { connected: false }
  | {
      connected: true;
      tenantId: string;
      tenantName: string | null;
      expiresAt: string;
      scopes: string[];
      connectedAt: string;
    };

export type XeroSyncLogRow = {
  id: string;
  status: string;
  entityType: string;
  createdAt: string;
  errorText?: string | null;
};

export type XeroHealth = {
  tone: "ok" | "warning" | "danger" | "muted";
  headline: string;
  detail: string;
};

export function summariseXeroHealth(
  status: XeroStatusResponse | null | undefined,
  logs: XeroSyncLogRow[] | null | undefined,
  now: Date = new Date()
): XeroHealth {
  if (!status || status.connected === false) {
    return { tone: "muted", headline: "Not connected", detail: "Connect Xero from Platform → Xero." };
  }
  const latest = (logs ?? [])[0];
  const expiry = new Date(status.expiresAt);
  const hoursToExpiry = (expiry.getTime() - now.getTime()) / 3_600_000;

  if (latest?.status === "ERROR") {
    return {
      tone: "danger",
      headline: "Last sync failed",
      detail: latest.errorText?.slice(0, 60) ?? `${latest.entityType} · ${relativeTime(latest.createdAt, now)}`
    };
  }
  if (hoursToExpiry < 0) {
    return {
      tone: "danger",
      headline: "Token expired",
      detail: "Reconnect Xero to resume syncs."
    };
  }
  if (hoursToExpiry < 24) {
    return {
      tone: "warning",
      headline: "Token expiring soon",
      detail: `Expires ${relativeTime(status.expiresAt, now)}`
    };
  }
  if (latest) {
    return {
      tone: "ok",
      headline: "Connected · syncing",
      detail: `Last: ${latest.entityType} ${relativeTime(latest.createdAt, now)}`
    };
  }
  return {
    tone: "ok",
    headline: "Connected",
    detail: status.tenantName ?? "No sync activity yet."
  };
}

export function relativeTime(when: string | Date, now: Date = new Date()): string {
  const t = when instanceof Date ? when : new Date(when);
  const diffMs = t.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const past = diffMs < 0;
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return past ? `${minutes}m ago` : `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return past ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return past ? `${days}d ago` : `in ${days}d`;
}

// ── P2 Recent activity feed ─────────────────────────────────────────

export type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor?: { id: string; firstName: string; lastName: string; email: string } | null;
};

export type ActivityRow = {
  id: string;
  who: string;
  what: string;
  when: string;
  createdAt: string;
};

export function shapeActivity(rows: AuditRow[] | undefined | null, limit = 8): ActivityRow[] {
  return (rows ?? []).slice(0, limit).map((r) => ({
    id: r.id,
    who: r.actor ? `${r.actor.firstName} ${r.actor.lastName}`.trim() : "System",
    what: `${humaniseAction(r.action)} ${humaniseEntity(r.entityType)}`,
    when: relativeTime(r.createdAt),
    createdAt: r.createdAt
  }));
}

function humaniseAction(action: string): string {
  // e.g. "tender.updated" → "updated"
  const parts = action.split(".");
  return parts[parts.length - 1].replace(/_/g, " ");
}

function humaniseEntity(entityType: string): string {
  return entityType.replace(/_/g, " ").toLowerCase();
}
