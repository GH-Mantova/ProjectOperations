/**
 * CRM-S8: Pure helpers for TendersRegisterPage.
 * Extracted to a separate module so they can be unit-tested without React or
 * the full component tree — same pattern as tenderingPage.helpers.ts.
 */

// ---------------------------------------------------------------------------
// Next-action classification
// ---------------------------------------------------------------------------

/** Number of milliseconds in 3 days — the "due soon" threshold. */
export const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export type NextActionClass = "overdue" | "due_soon" | "on_track" | "none";

/**
 * Classify a next-action due date relative to `now`.
 *
 * Rules (decision 5 of Marco's 2026-08-27 ruling):
 *   null                       → "none"
 *   dueAt < now                → "overdue"
 *   dueAt ≤ now + DUE_SOON_MS  → "due_soon"
 *   otherwise                  → "on_track"
 *
 * The boundary: a task due EXACTLY at `now` is "overdue" (not "due_soon").
 * This matches the pipeline-dashboard service behaviour (lt: now).
 */
export function classifyNextAction(dueAt: string | null, now: Date): NextActionClass {
  if (!dueAt) return "none";
  const due = new Date(dueAt).getTime();
  const nowMs = now.getTime();
  if (due <= nowMs) return "overdue";
  if (due <= nowMs + DUE_SOON_MS) return "due_soon";
  return "on_track";
}

// ---------------------------------------------------------------------------
// Follow-ups toggle predicate
// ---------------------------------------------------------------------------

export type FollowUpToggles = {
  overdue: boolean;
  dueSoon: boolean;
  noNextAction: boolean;
  onTrack: boolean;
};

export const DEFAULT_FOLLOWUP_TOGGLES: FollowUpToggles = {
  overdue: false,
  dueSoon: false,
  noNextAction: false,
  onTrack: false
};

export const ALL_FOLLOWUP_TOGGLES: FollowUpToggles = {
  overdue: true,
  dueSoon: true,
  noNextAction: true,
  onTrack: true
};

/** The amber toggles that constitute "follow-ups mode" — all on, on_track off. */
export const FOLLOWUPS_DEFAULT_TOGGLES: FollowUpToggles = {
  overdue: true,
  dueSoon: true,
  noNextAction: true,
  onTrack: false
};

/**
 * Returns true when the row's next-action class matches the active toggles.
 * When ALL four toggles are OFF, every row passes (no filter applied).
 * Decision 6: "Follow-ups is the same list, with the amber toggles on and
 * 'On track' off." Turning "Won & lost" on returns the full register —
 * but that is a status toggle handled separately; this function only
 * evaluates the next-action classification.
 */
export function nextActionPassesFilter(
  cls: NextActionClass,
  toggles: FollowUpToggles
): boolean {
  const anyOn = toggles.overdue || toggles.dueSoon || toggles.noNextAction || toggles.onTrack;
  if (!anyOn) return true;
  if (cls === "overdue") return toggles.overdue;
  if (cls === "due_soon") return toggles.dueSoon;
  if (cls === "none") return toggles.noNextAction;
  return toggles.onTrack;
}

// ---------------------------------------------------------------------------
// Stable sort — reuses localeCompare so the collation matches the DB collation
// the export relies on (same rule as rates-export.service.ts which uses
// String.prototype.localeCompare for lexicographic comparisons).
// ---------------------------------------------------------------------------

export type CrmColumnKey =
  | "tenderNumber"
  | "title"
  | "client"
  | "status"
  | "updatedAt"
  | "lastInteraction"
  | "nextAction";

export type SortableRow = {
  tenderNumber: string;
  title: string;
  status: string;
  updatedAt: string;
  tenderClients: Array<{ client: { name: string } }>;
  /** ISO string or null — last interaction timestamp */
  lastInteractionAt?: string | null;
  /** ISO string or null — next-action due date */
  nextActionAt?: string | null;
};

/**
 * Compare two rows for a given column key.
 * Returns a negative / zero / positive number for ascending sort.
 * Null values sort LAST (i.e. treated as +Infinity for date columns,
 * or "" for string columns, which sorts after any non-empty string only
 * when the locale collation places "" at the end — we explicitly push nulls
 * last via the logic below).
 */
export function sortCrmRow(a: SortableRow, b: SortableRow, key: CrmColumnKey): number {
  switch (key) {
    case "tenderNumber":
      return a.tenderNumber.localeCompare(b.tenderNumber);
    case "title":
      return a.title.localeCompare(b.title);
    case "client": {
      const aClient = a.tenderClients[0]?.client.name ?? "";
      const bClient = b.tenderClients[0]?.client.name ?? "";
      return aClient.localeCompare(bClient);
    }
    case "status":
      return a.status.localeCompare(b.status);
    case "updatedAt":
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    case "lastInteraction": {
      const aMs = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : Infinity;
      const bMs = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : Infinity;
      return aMs - bMs;
    }
    case "nextAction": {
      const aMs = a.nextActionAt ? new Date(a.nextActionAt).getTime() : Infinity;
      const bMs = b.nextActionAt ? new Date(b.nextActionAt).getTime() : Infinity;
      return aMs - bMs;
    }
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/** Escape a single cell value: double internal quotes, then wrap in quotes. */
function csvCell(raw: string | null | undefined): string {
  const s = raw === null || raw === undefined ? "" : String(raw);
  return `"${s.replace(/"/g, '""')}"`;
}

function formatDateAU(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const CRM_CSV_HEADERS = [
  "Tender #",
  "Title",
  "Client",
  "Status",
  "Updated",
  "Last interaction",
  "Logged by",
  "Next action",
  "Next action note"
];

export type CrmExportRow = {
  tenderNumber: string;
  title: string;
  tenderClients: Array<{ client: { name: string } }>;
  status: string;
  updatedAt: string;
  lastInteractionAt?: string | null;
  loggedByName?: string | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
};

/**
 * Build a CRM-register CSV string from the supplied rows.
 * Uses CRLF line endings and double-quoted cells.
 */
export function buildCrmRegisterCsv(rows: CrmExportRow[]): string {
  const lines: string[] = [CRM_CSV_HEADERS.map(csvCell).join(",")];
  for (const row of rows) {
    const client = row.tenderClients[0]?.client.name ?? "";
    lines.push(
      [
        csvCell(row.tenderNumber),
        csvCell(row.title),
        csvCell(client),
        csvCell(row.status),
        csvCell(formatDateAU(row.updatedAt)),
        csvCell(row.lastInteractionAt ? formatDateAU(row.lastInteractionAt) : null),
        csvCell(row.loggedByName ?? null),
        csvCell(row.nextActionAt ? formatDateAU(row.nextActionAt) : null),
        csvCell(row.nextActionNote ?? null)
      ].join(",")
    );
  }
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Log-contact payload validation
// ---------------------------------------------------------------------------

export type LogPayload = {
  subject: string;
  body: string;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
};

/**
 * Validate the log-contact form. Returns null when valid, or an error string.
 * The spec (test 4): assert both `subject` and `body` keys are present.
 */
export function validateLogPayload(payload: LogPayload): string | null {
  if (!payload.subject?.trim()) return "Subject is required.";
  if (!payload.body?.trim()) return "Interaction notes are required.";
  return null;
}
