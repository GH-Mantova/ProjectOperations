/**
 * Pure helpers for TenderingPage. Extracted to a separate module so they can
 * be unit-tested without React or the full component tree.
 */

// S1 — four submission stages shown on the kanban board.
export const PIPELINE_STAGES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "WITHDRAWN"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const MAX_PAGES = 50; // safety ceiling — 50 × 100 = 5 000 rows

// Minimal shape required by the helpers below — enough for testing without
// importing the full TenderListItem type.
export type StagedItem = { status: string };

/**
 * Group items by their pipeline stage. Items whose status is NOT one of the
 * four submission stages (DRAFT / IN_PROGRESS / SUBMITTED / WITHDRAWN) are
 * intentionally excluded — outcome statuses live outside the board.
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
    if ((PIPELINE_STAGES as readonly string[]).includes(item.status)) {
      groups[item.status as PipelineStage].push(item);
    }
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
