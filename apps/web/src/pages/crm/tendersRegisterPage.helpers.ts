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
export function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return null;
  return num;
}

export function formatMoneyAUD(value: string | number | null | undefined): string {
  const num = parseMoney(value);
  if (num === null) return EM_RULE;
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
  /** CRM_FOLLOWUPS_V2: the Type chip column — Follow-ups only. */
  | "type"
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

/**
 * CRM_FOLLOWUPS_V2: the Type chip column.
 *
 * Follow-ups deliberately spans submitted tenders, opportunities and leads
 * (decision 6: one list, toggleable filters), so a Lead row and a Tender row
 * are otherwise visually identical. The chip is derived from the SAME status
 * groups as the entity-type toggles — `ENTITY_TYPES` below — so "what kind of
 * thing is this row" has one definition, not two.
 *
 * It is a Follow-ups column only: `REGISTER_COLUMNS` is the settled slice-1
 * sequence and is unchanged.
 */
export const TYPE_COLUMN: RegisterColumnDef = {
  id: "type",
  label: "Type",
  sortKey: null,
  hideable: true,
  align: "left"
};

/**
 * The Follow-ups column sequence: the register's, with Type inserted directly
 * after Tender so the row says what it is before it says anything else.
 */
export const FOLLOWUPS_COLUMNS: readonly RegisterColumnDef[] = [
  REGISTER_COLUMNS[0],
  TYPE_COLUMN,
  ...REGISTER_COLUMNS.slice(1)
];

/**
 * Every column either tab can render. The visibility map is keyed over this
 * union so a Follow-ups column switched off is still a known id when the
 * register reads the same stored blob back.
 */
export const ALL_REGISTER_COLUMNS: readonly RegisterColumnDef[] = [
  ...REGISTER_COLUMNS,
  TYPE_COLUMN
];

/** The column sequence for a tab. Register keeps its own column set. */
export function columnsForTab(tab: "register" | "followups"): readonly RegisterColumnDef[] {
  return tab === "followups" ? FOLLOWUPS_COLUMNS : REGISTER_COLUMNS;
}

export type RegisterColumnVisibility = Record<RegisterColumnId, boolean>;

/** Every column on. */
export const DEFAULT_COLUMN_VISIBILITY: RegisterColumnVisibility =
  ALL_REGISTER_COLUMNS.reduce((acc, col) => {
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
    for (const col of ALL_REGISTER_COLUMNS) {
      const value = source[col.id];
      if (typeof value === "boolean") out[col.id] = value;
    }
  }
  for (const col of ALL_REGISTER_COLUMNS) {
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

/**
 * CRM_FOLLOWUPS_V2: the columns to render for a tab, in mock-up sequence.
 * `visibleRegisterColumns` keeps its exact register-only contract — this is a
 * sibling, not a replacement.
 */
export function visibleColumnsForTab(
  tab: "register" | "followups",
  visibility: RegisterColumnVisibility
): RegisterColumnDef[] {
  return columnsForTab(tab).filter((col) => visibility[col.id]);
}

// ---------------------------------------------------------------------------
// CRM_FOLLOWUPS_V2 — entity-type status groups
// ---------------------------------------------------------------------------

/**
 * The five status groups that back the Follow-ups entity-type control.
 *
 * These were declared in TendersRegisterPage.tsx with a comment each naming
 * the toggle they back, and — measured before this slice — every one of them
 * had exactly one reference in the repo: its own declaration line. The
 * vocabulary was written and the control never arrived. They keep their names
 * and their membership; they moved here so the toggle predicate and the Type
 * chip can be unit-tested without React, and so there is ONE definition of
 * "what kind of thing is this row" rather than one per consumer.
 */

/** "Won & lost" toggle. */
export const WON_LOST_STATUSES: ReadonlySet<string> = new Set<string>([
  "AWARDED",
  "CONTRACT_ISSUED",
  "LOST"
]);
/** "Submitted tenders" toggle. */
export const SUBMITTED_STATUSES: ReadonlySet<string> = new Set<string>(["SUBMITTED"]);
/** "Opportunities" toggle — the active pipeline. */
export const OPPORTUNITY_STATUSES: ReadonlySet<string> = new Set<string>(["IN_PROGRESS"]);
/** "Leads" toggle. */
export const LEAD_STATUSES: ReadonlySet<string> = new Set<string>(["DRAFT"]);
/**
 * Withdrawn. The approved mock-up has NO toggle for it, so it belongs to no
 * entity-type group: a withdrawn tender renders no Type chip, and it is
 * filtered out whenever any entity-type toggle is on. Left declared and
 * exported exactly as it was, so the vocabulary stays complete if a fifth
 * toggle is ever approved.
 */
export const WITHDRAWN_STATUSES: ReadonlySet<string> = new Set<string>(["WITHDRAWN"]);

export type EntityTypeId = "submitted" | "opportunity" | "lead" | "wonLost";

export type EntityTypeDef = {
  id: EntityTypeId;
  /** Toggle label, verbatim from the mock-up. */
  label: string;
  /** The Type column's chip text — shorter, it sits inside a table cell. */
  chipLabel: string;
  statuses: ReadonlySet<string>;
};

/** The four entity-type toggles, in the mock-up's order. */
export const ENTITY_TYPES: readonly EntityTypeDef[] = [
  {
    id: "submitted",
    label: "Submitted tenders",
    chipLabel: "Tender",
    statuses: SUBMITTED_STATUSES
  },
  {
    id: "opportunity",
    label: "Opportunities",
    chipLabel: "Opportunity",
    statuses: OPPORTUNITY_STATUSES
  },
  { id: "lead", label: "Leads", chipLabel: "Lead", statuses: LEAD_STATUSES },
  { id: "wonLost", label: "Won & lost", chipLabel: "Won / lost", statuses: WON_LOST_STATUSES }
];

export type EntityTypeToggles = Record<EntityTypeId, boolean>;

/**
 * All four off — which, by the same convention `nextActionPassesFilter` uses,
 * means "no entity-type filter applied". Follow-ups therefore opens showing
 * exactly the rows it showed before this slice; the control adds a way to
 * narrow, it does not silently narrow on arrival.
 */
export const DEFAULT_ENTITY_TYPE_TOGGLES: EntityTypeToggles = {
  submitted: false,
  opportunity: false,
  lead: false,
  wonLost: false
};

/** Which entity-type group a status belongs to, or null when none claims it. */
export function classifyEntityType(status: string): EntityTypeId | null {
  for (const def of ENTITY_TYPES) {
    if (def.statuses.has(status)) return def.id;
  }
  return null;
}

/** The Type column's chip text for a status, or null when no group claims it. */
export function entityTypeChipLabel(status: string): string | null {
  const id = classifyEntityType(status);
  if (!id) return null;
  return ENTITY_TYPES.find((def) => def.id === id)?.chipLabel ?? null;
}

/**
 * Returns true when the row's status matches the active entity-type toggles.
 * All four off → every row passes.
 *
 * This is a STATUS filter and composes with `nextActionPassesFilter`: a row
 * must satisfy both to render. The two groups never replace one another.
 */
export function entityTypePassesFilter(status: string, toggles: EntityTypeToggles): boolean {
  const anyOn = ENTITY_TYPES.some((def) => toggles[def.id]);
  if (!anyOn) return true;
  const id = classifyEntityType(status);
  if (!id) return false;
  return toggles[id];
}

// ---------------------------------------------------------------------------
// CRM_FOLLOWUPS_V2 — the four KPI cards
// ---------------------------------------------------------------------------

/**
 * The "Due this week" card's window: SEVEN days.
 *
 * Deliberately a separate constant from `DUE_SOON_MS` (three days), which
 * belongs to the "Due soon" toggle and is shared with AccountDetailPage
 * through `classifyNextAction`. The card and the toggle answer different
 * questions and must be pinnable independently — forking one into the other
 * is how the register and the account page start disagreeing.
 */
export const DUE_THIS_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True when a next action falls inside the coming seven days.
 *
 * Uses the same boundary as `classifyNextAction`: a task due exactly at `now`
 * is already overdue, so it is counted by the Overdue card and not here. The
 * two cards are disjoint by construction — a row is never in both.
 */
export function isDueThisWeek(dueAt: string | null | undefined, now: Date): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  if (isNaN(due)) return false;
  const nowMs = now.getTime();
  if (due <= nowMs) return false;
  return due <= nowMs + DUE_THIS_WEEK_MS;
}

/** The three row fields the KPI cards read. Every one is already loaded. */
export type RegisterKpiRow = {
  /** Decimal-as-string from the tender fetch. */
  estimatedValue?: string | null;
  /** From the last-interaction batch map — null means never logged. */
  lastInteractionAt?: string | null;
  /** From the open-CommTask map. */
  nextActionAt?: string | null;
};

export type RegisterKpis = {
  overdue: number;
  dueThisWeek: number;
  neverLogged: number;
  /**
   * Sum of `estimatedValue` over the overdue rows, or null when not one
   * overdue row carries a parseable estimate. Null renders as the em-rule:
   * "no overdue tender has an estimate" and "the overdue pile is worth
   * nothing" are different facts, and the register never prints $0 for the
   * first one.
   */
  valueAtRisk: number | null;
};

/**
 * Derive the four KPI figures from the rows CURRENTLY IN SCOPE.
 *
 * Every figure comes out of `enrichedRows` after the active filters have been
 * applied — no fetch, no endpoint — so the cards and the list beneath them can
 * never disagree. Pure and `now`-injected, pinned against a fixed instant in
 * the unit tests the way `classifyNextAction` is.
 */
export function computeRegisterKpis(rows: readonly RegisterKpiRow[], now: Date): RegisterKpis {
  let overdue = 0;
  let dueThisWeek = 0;
  let neverLogged = 0;
  let valueAtRisk = 0;
  let valuedOverdueRows = 0;

  for (const row of rows) {
    const nextActionAt = row.nextActionAt ?? null;
    if (classifyNextAction(nextActionAt, now) === "overdue") {
      overdue += 1;
      const value = parseMoney(row.estimatedValue);
      if (value !== null) {
        valueAtRisk += value;
        valuedOverdueRows += 1;
      }
    }
    if (isDueThisWeek(nextActionAt, now)) dueThisWeek += 1;
    if (!row.lastInteractionAt) neverLogged += 1;
  }

  return {
    overdue,
    dueThisWeek,
    neverLogged,
    valueAtRisk: valuedOverdueRows > 0 ? valueAtRisk : null
  };
}

/** The four card labels, in the mock-up's order. */
export const KPI_CARD_LABELS = [
  "Overdue",
  "Due this week",
  "Never logged",
  "Value at risk"
] as const;
