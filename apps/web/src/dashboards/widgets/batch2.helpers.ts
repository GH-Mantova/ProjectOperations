/**
 * Pure data-shaping helpers for widget batch 2 — kept split from the
 * React components so they can be unit-tested cheaply (same pattern as
 * batch1.helpers.ts / programSnapshot.helpers.ts).
 */

// ── C1 Form approvals waiting ───────────────────────────────────────

export type ApprovalRow = {
  id: string;
  submissionId: string;
  stepNumber: number;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToRole: string | null;
  dueAt: string | null;
  overdue: boolean;
  submittedAt: string;
  submittedByName: string | null;
  templateId: string;
  templateName: string;
  templateCode: string;
};

export type ApprovalsWaitingResponse = {
  total: number;
  overdue: number;
  items: ApprovalRow[];
};

export function relativeDue(when: string | null, now: Date = new Date()): string {
  if (!when) return "No due date";
  const t = new Date(when);
  if (Number.isNaN(t.getTime())) return "No due date";
  const diffMs = t.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const past = diffMs < 0;
  const hours = Math.round(abs / 3_600_000);
  if (hours < 24) return past ? `Overdue ${hours}h` : `Due in ${hours}h`;
  const days = Math.round(hours / 24);
  return past ? `Overdue ${days}d` : `Due in ${days}d`;
}

// ── C2 Quotes drafted, not sent ─────────────────────────────────────

export type DraftQuoteRow = {
  id: string;
  quoteRef: string;
  revision: number;
  updatedAt: string;
  clientId: string;
  clientName: string;
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  value: number;
};

export type DraftsSummaryResponse = {
  count: number;
  totalValue: number;
  items: DraftQuoteRow[];
};

// ── C3 Pre-starts submitted today ───────────────────────────────────

export type PreStartsTodayResponse = {
  count: number;
  latestSubmittedAt: string | null;
};

export function preStartsSubtitle(res: PreStartsTodayResponse | null | undefined): string {
  if (!res || res.count === 0) return "No prestarts today yet";
  if (res.latestSubmittedAt) {
    const t = new Date(res.latestSubmittedAt);
    return `Latest ${t.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`;
  }
  return "Logged today";
}

// ── C4 Recent site photos ───────────────────────────────────────────

export type PhotoRow = {
  id: string;
  title: string;
  linkedEntityType: string;
  linkedEntityId: string;
  category: string;
  module: string;
  updatedAt: string;
  createdAt: string;
  fileName: string | null;
  webUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type RecentPhotosResponse = { items: PhotoRow[] };

export function isImagePhoto(row: Pick<PhotoRow, "mimeType">): boolean {
  return typeof row.mimeType === "string" && row.mimeType.startsWith("image/");
}

// ── C5 My day ───────────────────────────────────────────────────────

export type MyDayAllocation = {
  id: string;
  date: string;
  note: string | null;
  projectId: string;
  projectName: string;
  projectNumber: string;
  jobRoleId: string | null;
  jobRoleName: string | null;
};

export type MyDayApproval = {
  id: string;
  submissionId: string;
  stepNumber: number;
  dueAt: string | null;
  overdue: boolean;
  submittedAt: string;
  submittedByName: string | null;
  templateName: string;
  templateCode: string;
};

export type MyDayFormDue = {
  id: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  scheduleType: string;
  nextRunAt: string | null;
  overdue: boolean;
};

export type MyDayResponse = {
  workerProfileId: string | null;
  allocations: MyDayAllocation[];
  approvals: MyDayApproval[];
  formsDue: MyDayFormDue[];
};

export type MyDayCounts = {
  allocations: number;
  approvals: number;
  formsDue: number;
  overdueApprovals: number;
};

export function countMyDay(res: MyDayResponse | null | undefined): MyDayCounts {
  if (!res) return { allocations: 0, approvals: 0, formsDue: 0, overdueApprovals: 0 };
  return {
    allocations: res.allocations.length,
    approvals: res.approvals.length,
    formsDue: res.formsDue.length,
    overdueApprovals: res.approvals.filter((a) => a.overdue).length
  };
}

export function myDayHeadline(counts: MyDayCounts): string {
  const parts: string[] = [];
  if (counts.allocations > 0)
    parts.push(`${counts.allocations} allocation${counts.allocations === 1 ? "" : "s"}`);
  if (counts.approvals > 0)
    parts.push(`${counts.approvals} approval${counts.approvals === 1 ? "" : "s"}`);
  if (counts.formsDue > 0)
    parts.push(`${counts.formsDue} form${counts.formsDue === 1 ? "" : "s"}`);
  if (parts.length === 0) return "Clear day";
  return parts.join(" · ");
}
