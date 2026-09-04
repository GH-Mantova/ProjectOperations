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
  /** CRM_REGISTER_V3: the estimated-value (money) column. */
  | "value"
  /**
   * CRM_REGISTER_V3: `updatedAt` no longer has a column header — the mock-up
   * dropped it because it was indistinguishable from Last interaction — but it
   * stays on the row type and stays sortable, so a saved sort or a future
   * caller keeps working.
   */
  | "updatedAt"
  | "lastInteraction"
  | "nextAction";

export type SortableRow = {
  tenderNumber: string;
  title: string;
  status: string;
  updatedAt: string;
  tenderClients: Array<{ client: { name: string } }>;
  /** Decimal serialised as a string, or null — the Value column. */
  estimatedValue?: string | null;
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
    case "value": {
      // Nulls sort last ascending, same convention as the date columns.
      const aNum = a.estimatedValue === null || a.estimatedValue === undefined
        ? Infinity
        : parseFloat(a.estimatedValue);
      const bNum = b.estimatedValue === null || b.estimatedValue === undefined
        ? Infinity
        : parseFloat(b.estimatedValue);
      const aSafe = Number.isFinite(aNum) ? aNum : Infinity;
      const bSafe = Number.isFinite(bNum) ? bNum : Infinity;
      // Both absent → equal. Subtracting two Infinities would yield NaN, which
      // is not a legal comparator result.
      if (aSafe === bSafe) return 0;
      return aSafe - bSafe;
    }
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

// ---------------------------------------------------------------------------
// CRM_REGISTER_V3 — money, relative time, submitted sub-line, column model
// ---------------------------------------------------------------------------

/** The em-rule the register renders for every absent value. Never "$0", never "". */
export const EM_RULE = "—";

/**
 * CRM_REGISTER_V3: format a tender's `estimatedValue` for the Value column.
 *
 * `estimatedValue` arrives as a Prisma Decimal serialised to a string (e.g.
 * "1250000.00"). The house money format is the one already used by
 * AccountDetailPage — en-AU / AUD / no cents — so the two screens agree.
 *
 * A null, undefined, empty or unparseable value renders as the em-rule the
 * other columns use for absent data. It is NEVER rendered as "$0": a tender
 * with no estimate and a tender worth nothing are different facts.
 */
export function formatMoneyAUD(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EM_RULE;
  if (typeof value === "string" && value.trim() === "") return EM_RULE;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return EM_RULE;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(num);
}

const MS_MINUTE = 60 * 1000;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

/** Pluralise without pulling in a formatting library. */
function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/**
 * CRM_REGISTER_V3: relative age of an interaction — the "4 days ago" half of
 * the mock-up's Last interaction cell.
 *
 * Pure and `now`-injected so it can be pinned against a fixed instant in the
 * unit tests, exactly the way `classifyNextAction` is.
 *
 * Absent input renders as the em-rule. A timestamp in the future (clock skew
 * between the API host and the browser) clamps to "just now" rather than
 * printing a negative age.
 */
export function formatRelativeTime(iso: string | null | undefined, now: Date): string {
  if (!iso) return EM_RULE;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return EM_RULE;
  const diff = now.getTime() - then;
  if (diff < MS_MINUTE) return "just now";
  if (diff < MS_HOUR) return plural(Math.floor(diff / MS_MINUTE), "minute");
  if (diff < MS_DAY) return plural(Math.floor(diff / MS_HOUR), "hour");
  const days = Math.floor(diff / MS_DAY);
  if (days < 30) return plural(days, "day");
  if (days < 365) return plural(Math.floor(days / 30), "month");
  return plural(Math.floor(days / 365), "year");
}

/**
 * CRM_REGISTER_V3: the "Submitted 12 Aug" sub-line under the tender number and
 * title. Returns null when the tender has not been submitted, so the caller
 * renders no sub-line at all rather than an empty one.
 *
 * Formatted in UTC so the string is stable regardless of the runner's TZ.
 */
export function formatSubmittedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const label = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(d);
  return `Submitted ${label}`;
}

// ---------------------------------------------------------------------------
// CRM_REGISTER_V3 — column model (sequence, visibility, persistence)
// ---------------------------------------------------------------------------

export type RegisterColumnId =
  | "tender"
  | "client"
  | "status"
  | "value"
  | "lastInteraction"
  | "loggedBy"
  | "nextAction"
  | "actions";

export type RegisterColumnDef = {
  id: RegisterColumnId;
  label: string;
  /** Sort key, or null for a column that cannot be sorted. */
  sortKey: CrmColumnKey | null;
  /** False for the two columns that anchor the row and can never be hidden. */
  hideable: boolean;
  align: "left" | "right";
};

/**
 * The register's column sequence, as the approved mock-up specifies it:
 *
 *   Tender | Client | Status | Value | Last interaction | Logged by | Next action | Actions
 *
 * The old `Title` column is folded into the Tender cell (number + title +
 * "Submitted …" sub-line) and the old `Updated` column is gone — it sat beside
 * Last interaction printing an indistinguishable bare date. `updatedAt` stays
 * on the row type and stays sortable through `sortCrmRow`; only the column
 * went.
 */
export const REGISTER_COLUMNS: readonly RegisterColumnDef[] = [
  { id: "tender", label: "Tender", sortKey: "tenderNumber", hideable: false, align: "left" },
  { id: "client", label: "Client", sortKey: "client", hideable: true, align: "left" },
  { id: "status", label: "Status", sortKey: "status", hideable: true, align: "left" },
  { id: "value", label: "Value", sortKey: "value", hideable: true, align: "right" },
  {
    id: "lastInteraction",
    label: "Last interaction",
    sortKey: "lastInteraction",
    hideable: true,
    align: "left"
  },
  { id: "loggedBy", label: "Logged by", sortKey: null, hideable: true, align: "left" },
  { id: "nextAction", label: "Next action", sortKey: "nextAction", hideable: true, align: "left" },
  { id: "actions", label: "Actions", sortKey: null, hideable: false, align: "left" }
];

export type RegisterColumnVisibility = Record<RegisterColumnId, boolean>;

/** Every column on. */
export const DEFAULT_COLUMN_VISIBILITY: RegisterColumnVisibility =
  REGISTER_COLUMNS.reduce((acc, col) => {
    acc[col.id] = true;
    return acc;
  }, {} as RegisterColumnVisibility);

/**
 * localStorage key for the Columns picker. A SIBLING of the saved-views key —
 * deliberately not the same key, so a user's saved views are never rewritten
 * by toggling a column.
 */
export const REGISTER_COLUMNS_STORAGE_KEY = "crm-register-columns:v1";

/**
 * Coerce whatever came back out of localStorage into a complete visibility
 * map. Unknown ids are dropped, missing ids default to visible, and the two
 * non-hideable columns are forced on however the stored blob was tampered
 * with — the register must never render a row with no identity and no action.
 */
export function normalizeColumnVisibility(raw: unknown): RegisterColumnVisibility {
  const out: RegisterColumnVisibility = { ...DEFAULT_COLUMN_VISIBILITY };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const source = raw as Record<string, unknown>;
    for (const col of REGISTER_COLUMNS) {
      const value = source[col.id];
      if (typeof value === "boolean") out[col.id] = value;
    }
  }
  for (const col of REGISTER_COLUMNS) {
    if (!col.hideable) out[col.id] = true;
  }
  return out;
}

/** The columns to render, in mock-up sequence, for a given visibility map. */
export function visibleRegisterColumns(
  visibility: RegisterColumnVisibility
): RegisterColumnDef[] {
  return REGISTER_COLUMNS.filter((col) => visibility[col.id]);
}
