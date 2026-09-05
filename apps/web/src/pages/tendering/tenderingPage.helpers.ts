/**
 * Pure helpers for TenderingPage. Extracted to a separate module so they can
 * be unit-tested without React or the full component tree.
 */

// Pipeline board = the submission funnel. Four columns, in this order:
//   DRAFT · IN_PROGRESS (Estimating) · SUBMITTED · WITHDRAWN (pending review)
//
// Marco, 2026-08-20: Submitted is the finish line, not a disappearance. A
// submitted tender STAYS on the board as the terminal column so the board can
// answer "what did we get out the door". PR #1122 read "exit the Pipeline" as
// "vanish from the board" and cut the column; this restores it.
//
// SUBMITTED and WITHDRAWN are COUNT_ONLY: their header still shows the count
// and the currency total, but the cards themselves are not rendered — the
// tenders are worked from the CRM Tenders Register from there on. See
// boardColumnView below, which is the single seam that keeps the count and
// the rendered card list from ever disagreeing.
//
// A WITHDRAWN tender is only counted while withdrawalState = PENDING_REVIEW.
// Once a reviewer CONFIRMS it, it exits the board entirely (Marco 2026-08-20:
// *confirmed* withdrawal is what "archived" means) — see groupByPipelineStage.
export const PIPELINE_STAGES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "WITHDRAWN"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Stages whose column renders a header (label · count · total) but no cards.
// Both are one-way exits from the board: there is no card to drag back out.
// Recovery lives off-board — see the PR body for the un-submit paths.
export const COUNT_ONLY_STAGES = ["SUBMITTED", "WITHDRAWN"] as const;
export type CountOnlyStage = (typeof COUNT_ONLY_STAGES)[number];

/** True when `stage` renders as a count-only (card-less) board column. */
export function isCountOnlyStage(stage: string): boolean {
  return (COUNT_ONLY_STAGES as readonly string[]).includes(stage);
}

/**
 * The render model for one board column.
 *
 * `count` is ALWAYS `items.length` and `cards` is the subset actually drawn.
 * Both are derived from the same array in the same call, so a column can never
 * show a number that disagrees with the cards beneath it: for a count-only
 * stage `cards` is empty while `count` is unchanged. Every column in
 * TenderingPage goes through here — that is the point of the seam.
 */
export function boardColumnView<T>(
  stage: string,
  items: T[]
): { countOnly: boolean; count: number; cards: T[] } {
  const countOnly = isCountOnlyStage(stage);
  return { countOnly, count: items.length, cards: countOnly ? [] : items };
}

// ---------------------------------------------------------------------------
// TenderListItem — minimal shape required by buildRegisterCsv.
// The full type lives in TenderingPage.tsx; this subset covers every cell
// the CSV builder reads so it can be tested without the component tree.
// ---------------------------------------------------------------------------
export type TenderListItem = {
  tenderNumber: string;
  title: string;
  status: string;
  withdrawalState?: string | null;
  dueDate?: string | null;
  estimatedValue?: string | null;
  probability?: number | null;
  createdAt: string;
  estimator?: { firstName: string; lastName: string } | null;
  tenderClients: Array<{ client: { name: string } }>;
};

// ---------------------------------------------------------------------------
// daysUntil — exported so TenderingPage.tsx can import it rather than
// maintaining a duplicate. The em-dash is the sentinel for "no due date".
// buildRegisterCsv maps it to an empty cell so spreadsheet tools don't get
// a typographic character.
// ---------------------------------------------------------------------------
export function daysUntil(iso?: string | null): string {
  if (!iso) return "—"; // em-dash placeholder
  const then = new Date(iso).getTime();
  const diff = Math.ceil((then - Date.now()) / (24 * 60 * 60 * 1000));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "today";
  if (diff === 1) return "1 day";
  return `${diff} days`;
}

// ---------------------------------------------------------------------------
// buildRegisterCsv — write all ten columns, all loaded rows, CRLF endings.
// ---------------------------------------------------------------------------

/** Headers in ALL_COLUMNS order (screen order). */
const CSV_HEADERS = [
  "Tender #",
  "Name",
  "Client",
  "Estimator",
  "Status",
  "Probability",
  "Value",
  "Due date",
  "Days until due",
  "Created"
];

/**
 * Format a date string (ISO or date-only) as dd/mm/yyyy (AU locale).
 * Returns "" when the input is null/undefined/empty.
 */
function formatDateAU(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Escape a single cell value: double internal quotes, then wrap in quotes. */
function csvCell(raw: string | number | null | undefined): string {
  const s = raw === null || raw === undefined ? "" : String(raw);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from the supplied rows.
 *
 * Column contract (ALL_COLUMNS order):
 *   Tender # | Name | Client | Estimator | Status | Probability | Value |
 *   Due date | Days until due | Created
 *
 * - Value: bare number (no $ or thousands separator), empty when null.
 * - Dates:  dd/mm/yyyy, empty when null.
 * - Days until due: the display string (e.g. "14 days", "1019d overdue",
 *   "today") — empty cell where daysUntil() returns the em-dash.
 * - Probability: raw number, empty when null.
 * - Client: names joined with "; ".
 * - CRLF line endings throughout.
 */
export function buildRegisterCsv(rows: TenderListItem[]): string {
  const lines: string[] = [CSV_HEADERS.map(csvCell).join(",")];
  for (const t of rows) {
    const clientNames = t.tenderClients.map((tc) => tc.client.name).join("; ");
    const estimatorName = t.estimator
      ? `${t.estimator.firstName} ${t.estimator.lastName}`
      : "";
    const probabilityCell =
      t.probability !== null && t.probability !== undefined ? String(t.probability) : "";
    const valueCell =
      t.estimatedValue !== null && t.estimatedValue !== undefined && t.estimatedValue !== ""
        ? String(Number(t.estimatedValue))
        : "";
    const dueDateCell = formatDateAU(t.dueDate);
    const rawDaysUntil = daysUntil(t.dueDate);
    // Map the em-dash sentinel to an empty cell.
    const daysUntilCell = rawDaysUntil === "—" ? "" : rawDaysUntil;
    const createdCell = formatDateAU(t.createdAt);

    lines.push(
      [
        csvCell(t.tenderNumber),
        csvCell(t.title),
        csvCell(clientNames),
        csvCell(estimatorName),
        csvCell(t.status),
        csvCell(probabilityCell),
        csvCell(valueCell),
        csvCell(dueDateCell),
        csvCell(daysUntilCell),
        csvCell(createdCell)
      ].join(",")
    );
  }
  return lines.join("\r\n");
}

export const MAX_PAGES = 50; // safety ceiling — 50 × 100 = 5 000 rows

// Minimal shape required by the helpers below. Includes withdrawalState so
// the Pipeline filter can drop confirmed-WITHDRAWN rows (they belong on the
// Register, not the board).
export type StagedItem = { status: string; withdrawalState?: string | null };

/**
 * Group items by their pipeline stage. Items whose status is NOT one of the
 * four board stages (DRAFT / IN_PROGRESS / SUBMITTED / WITHDRAWN) are
 * intentionally excluded — outcome statuses (AWARDED / CONTRACT_ISSUED / LOST
 * / CONVERTED) are Register-only and the board ends at SUBMITTED.
 *
 * Confirmed-withdrawn tenders are dropped too. That matters more now that
 * WITHDRAWN is a count-only column: if a confirmed row were still bucketed it
 * would inflate a header count nobody can click through to inspect, and the
 * number would be a lie.
 */
export function groupByPipelineStage<T extends StagedItem>(
  items: T[]
): Record<PipelineStage, T[]> {
  const groups: Record<PipelineStage, T[]> = {
    DRAFT: [],
    IN_PROGRESS: [],
    SUBMITTED: [],
    WITHDRAWN: []
  };
  for (const item of items) {
    if (!(PIPELINE_STAGES as readonly string[]).includes(item.status)) continue;
    // Confirmed withdrawals have exited the Pipeline board.
    if (item.status === "WITHDRAWN" && item.withdrawalState === "CONFIRMED") continue;
    groups[item.status as PipelineStage].push(item);
  }
  return groups;
}

// Shape returned by the /tenders paginated endpoint.
export type TenderPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

// Minimal Filters shape required by buildQueryStringWithPage.
export type FiltersForQuery = {
  search: string;
  status: string[];
  estimatorId: string | null;
  clientId: string | null;
  probability: string[];
  valueMin: string;
  valueMax: string;
  dueDateFrom: string;
  dueDateTo: string;
  discipline: string[];
  sortBy: string | null;
  sortDir: "asc" | "desc";
};

export function buildQueryStringWithPage(
  filters: FiltersForQuery,
  pageSize: number,
  page: number
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status.length) params.set("status", filters.status.join(","));
  if (filters.estimatorId) params.set("estimatorId", filters.estimatorId);
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.probability.length === 1) params.set("probability", filters.probability[0]);
  if (filters.valueMin) params.set("valueMin", filters.valueMin);
  if (filters.valueMax) params.set("valueMax", filters.valueMax);
  if (filters.dueDateFrom) params.set("dueDateFrom", filters.dueDateFrom);
  if (filters.dueDateTo) params.set("dueDateTo", filters.dueDateTo);
  if (filters.discipline.length === 1) params.set("discipline", filters.discipline[0]);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortBy) params.set("sortDir", filters.sortDir);
  return params.toString();
}

/**
 * Loop-paginate /tenders at pageSize=100 until all rows are collected.
 * The same filters + sort are sent on every page so concatenation stays in
 * server-sort order. Caps at MAX_PAGES to guard against runaway loops;
 * callers surface the truncation when items.length < total.
 */
export async function fetchAllPages<T extends StagedItem>(
  authFetch: (url: string, init?: RequestInit) => Promise<Response>,
  filters: FiltersForQuery
): Promise<{ items: T[]; total: number; truncated: boolean }> {
  const PAGE_SIZE = 100;
  const accumulated: T[] = [];
  let serverTotal = 0;
  let page = 1;

  while (page <= MAX_PAGES) {
    const qs = buildQueryStringWithPage(filters, PAGE_SIZE, page);
    const response = await authFetch(`/tenders?${qs}`);
    if (!response.ok) throw new Error("Could not load tenders.");
    const data = (await response.json()) as TenderPage<T>;
    serverTotal = data.total;
    accumulated.push(...data.items);
    if (accumulated.length >= data.total || data.items.length < PAGE_SIZE) break;
    page += 1;
  }

  const truncated = accumulated.length < serverTotal;
  return { items: accumulated, total: serverTotal, truncated };
}
