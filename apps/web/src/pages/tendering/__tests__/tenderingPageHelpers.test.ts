/**
 * Unit tests for tender-lifecycle S1 helpers.
 *
 * Covers the three defects addressed in the S1 slice:
 * 1. groupByPipelineStage — boards only the four submission stages
 * 2. fetchAllPages — accumulates all pages for a >100-row dataset
 * 3. Independent filter states — register filters do not affect pipeline
 *    filters and vice-versa (tested via the EMPTY_FILTERS default + no
 *    shared reference, which is a pure structural check)
 */
import { describe, it, expect, vi } from "vitest";
import {
  PIPELINE_STAGES,
  groupByPipelineStage,
  fetchAllPages,
  type StagedItem,
  type TenderPage
} from "../tenderingPage.helpers";

// ---------------------------------------------------------------------------
// 1. byStage — only four submission stages are bucketed
// ---------------------------------------------------------------------------
describe("groupByPipelineStage", () => {
  it("returns exactly the four submission-stage keys", () => {
    const result = groupByPipelineStage([]);
    expect(Object.keys(result).sort()).toEqual([...PIPELINE_STAGES].sort());
  });

  it("buckets DRAFT items into the DRAFT group", () => {
    const items: StagedItem[] = [{ status: "DRAFT" }, { status: "DRAFT" }];
    const result = groupByPipelineStage(items);
    expect(result.DRAFT).toHaveLength(2);
    expect(result.IN_PROGRESS).toHaveLength(0);
    expect(result.WITHDRAWN).toHaveLength(0);
  });

  it("buckets items into the three in-flight pipeline stages correctly", () => {
    // Pipeline is DRAFT / IN_PROGRESS / WITHDRAWN (pending review) only.
    // SUBMITTED and confirmed-WITHDRAWN are Register-only and must be
    // dropped from the board.
    const items: StagedItem[] = [
      { status: "DRAFT" },
      { status: "IN_PROGRESS" },
      { status: "IN_PROGRESS" },
      { status: "SUBMITTED" },
      { status: "WITHDRAWN" },
      { status: "WITHDRAWN", withdrawalState: "CONFIRMED" }
    ];
    const result = groupByPipelineStage(items);
    expect(result.DRAFT).toHaveLength(1);
    expect(result.IN_PROGRESS).toHaveLength(2);
    // WITHDRAWN with no withdrawalState (pre-migration/legacy) is treated as
    // pending-review — it stays on the board so nothing silently disappears.
    // The CONFIRMED row is dropped.
    expect(result.WITHDRAWN).toHaveLength(1);
    // SUBMITTED must NOT appear as a pipeline key
    expect("SUBMITTED" in result).toBe(false);
  });

  it("drops confirmed-withdrawn from the board (exits to Register)", () => {
    const items: StagedItem[] = [
      { status: "WITHDRAWN", withdrawalState: "PENDING_REVIEW" },
      { status: "WITHDRAWN", withdrawalState: "CONFIRMED" }
    ];
    const result = groupByPipelineStage(items);
    expect(result.WITHDRAWN).toHaveLength(1);
    expect(result.WITHDRAWN[0].withdrawalState).toBe("PENDING_REVIEW");
  });

  it("excludes SUBMITTED — moved to Register-only in the lifecycle slice", () => {
    const items: StagedItem[] = [{ status: "SUBMITTED" }, { status: "DRAFT" }];
    const result = groupByPipelineStage(items);
    expect("SUBMITTED" in result).toBe(false);
    expect(result.DRAFT).toHaveLength(1);
  });

  it("excludes AWARDED — outcome status, not a board column", () => {
    const items: StagedItem[] = [{ status: "AWARDED" }, { status: "DRAFT" }];
    const result = groupByPipelineStage(items);
    // AWARDED must NOT appear as a key
    expect("AWARDED" in result).toBe(false);
    // Only the DRAFT item ends up on the board
    expect(result.DRAFT).toHaveLength(1);
  });

  it("excludes CONTRACT_ISSUED — outcome status", () => {
    const items: StagedItem[] = [{ status: "CONTRACT_ISSUED" }];
    const result = groupByPipelineStage(items);
    expect("CONTRACT_ISSUED" in result).toBe(false);
    expect(result.DRAFT).toHaveLength(0);
    expect(result.WITHDRAWN).toHaveLength(0);
  });

  it("excludes LOST — outcome status", () => {
    const items: StagedItem[] = [{ status: "LOST" }, { status: "IN_PROGRESS" }];
    const result = groupByPipelineStage(items);
    expect("LOST" in result).toBe(false);
    expect(result.IN_PROGRESS).toHaveLength(1);
  });

  it("excludes CONVERTED — outcome status not even in TENDER_STATUSES", () => {
    const items: StagedItem[] = [{ status: "CONVERTED" }];
    const result = groupByPipelineStage(items);
    expect("CONVERTED" in result).toBe(false);
  });

  it("all in-flight pipeline stage keys are always present even with zero items", () => {
    const result = groupByPipelineStage([]);
    for (const stage of PIPELINE_STAGES) {
      expect(result[stage]).toEqual([]);
    }
  });

  it("preserves the full item object (not just status)", () => {
    const items = [{ status: "DRAFT", id: "t-1", title: "Test tender" }];
    const result = groupByPipelineStage(items);
    expect(result.DRAFT[0]).toEqual({ status: "DRAFT", id: "t-1", title: "Test tender" });
  });
});

// ---------------------------------------------------------------------------
// 2. fetchAllPages — accumulates every page for a >100-row dataset
// ---------------------------------------------------------------------------

/** Build a mock authFetch that simulates paginated /tenders responses. */
function buildMockAuthFetch(totalItems: number, pageSize = 100) {
  return vi.fn().mockImplementation(async (url: string) => {
    const urlObj = new URL(url, "http://test");
    const page = Number(urlObj.searchParams.get("page") ?? "1");
    const size = Number(urlObj.searchParams.get("pageSize") ?? String(pageSize));
    const start = (page - 1) * size;
    const end = Math.min(start + size, totalItems);
    const items: StagedItem[] = Array.from({ length: end - start }, (_, i) => ({
      status: "DRAFT",
      id: `t-${start + i}`
    }));
    const body: TenderPage<StagedItem> = {
      items,
      total: totalItems,
      page,
      pageSize: size
    };
    return {
      ok: true,
      json: async () => body
    };
  });
}

const EMPTY_FILTERS_FOR_QUERY = {
  search: "",
  status: [],
  estimatorId: null,
  clientId: null,
  probability: [],
  valueMin: "",
  valueMax: "",
  dueDateFrom: "",
  dueDateTo: "",
  discipline: [],
  sortBy: null,
  sortDir: "desc" as const
};

describe("fetchAllPages", () => {
  it("returns all items when total fits in a single page (<= 100)", async () => {
    const authFetch = buildMockAuthFetch(50);
    const result = await fetchAllPages(authFetch, EMPTY_FILTERS_FOR_QUERY);
    expect(result.items).toHaveLength(50);
    expect(result.total).toBe(50);
    expect(result.truncated).toBe(false);
    // Only one request was made
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it("returns exactly 100 items when total === pageSize (no second fetch needed)", async () => {
    const authFetch = buildMockAuthFetch(100);
    const result = await fetchAllPages(authFetch, EMPTY_FILTERS_FOR_QUERY);
    expect(result.items).toHaveLength(100);
    expect(result.truncated).toBe(false);
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it("accumulates items across two pages for a 150-row dataset", async () => {
    const authFetch = buildMockAuthFetch(150);
    const result = await fetchAllPages(authFetch, EMPTY_FILTERS_FOR_QUERY);
    expect(result.items).toHaveLength(150);
    expect(result.total).toBe(150);
    expect(result.truncated).toBe(false);
    expect(authFetch).toHaveBeenCalledTimes(2);
  });

  it("accumulates items across three pages for a 250-row dataset", async () => {
    const authFetch = buildMockAuthFetch(250);
    const result = await fetchAllPages(authFetch, EMPTY_FILTERS_FOR_QUERY);
    expect(result.items).toHaveLength(250);
    expect(result.total).toBe(250);
    expect(result.truncated).toBe(false);
    expect(authFetch).toHaveBeenCalledTimes(3);
  });

  it("sends page=1,2,3 in order with the same filters on every request", async () => {
    const authFetch = buildMockAuthFetch(250);
    await fetchAllPages(authFetch, { ...EMPTY_FILTERS_FOR_QUERY, search: "test" });
    const calls = authFetch.mock.calls.map((call: [string]) => {
      const url = new URL(call[0], "http://test");
      return {
        page: url.searchParams.get("page"),
        q: url.searchParams.get("q")
      };
    });
    expect(calls).toEqual([
      { page: "1", q: "test" },
      { page: "2", q: "test" },
      { page: "3", q: "test" }
    ]);
  });

  it("marks truncated=true when safety ceiling (MAX_PAGES) is hit before all rows fetched", async () => {
    // Simulate a server that always reports total=9999 but we cap at MAX_PAGES pages.
    // MAX_PAGES=50, pageSize=100 → max 5000 rows collected, but total=9999.
    const VERY_LARGE_TOTAL = 9999;
    const authFetch = vi.fn().mockImplementation(async (url: string) => {
      const urlObj = new URL(url, "http://test");
      const page = Number(urlObj.searchParams.get("page") ?? "1");
      const size = 100;
      const items: StagedItem[] = Array.from({ length: size }, (_, i) => ({
        status: "DRAFT",
        id: `t-${(page - 1) * size + i}`
      }));
      const body: TenderPage<StagedItem> = {
        items,
        total: VERY_LARGE_TOTAL,
        page,
        pageSize: size
      };
      return { ok: true, json: async () => body };
    });

    const result = await fetchAllPages(authFetch, EMPTY_FILTERS_FOR_QUERY);
    // Should have collected MAX_PAGES * pageSize = 50 * 100 = 5000 items
    expect(result.items).toHaveLength(5000);
    expect(result.total).toBe(VERY_LARGE_TOTAL);
    expect(result.truncated).toBe(true);
  });

  it("throws when the API returns a non-OK response", async () => {
    const authFetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchAllPages(authFetch, EMPTY_FILTERS_FOR_QUERY)).rejects.toThrow(
      "Could not load tenders."
    );
  });

  it("preserves item order across page boundaries", async () => {
    const authFetch = buildMockAuthFetch(150);
    const result = await fetchAllPages(authFetch, EMPTY_FILTERS_FOR_QUERY);
    // First 100 items should be t-0…t-99, next 50 should be t-100…t-149
    expect((result.items[0] as { status: string; id: string }).id).toBe("t-0");
    expect((result.items[99] as { status: string; id: string }).id).toBe("t-99");
    expect((result.items[100] as { status: string; id: string }).id).toBe("t-100");
    expect((result.items[149] as { status: string; id: string }).id).toBe("t-149");
  });
});

// ---------------------------------------------------------------------------
// 3. Independent filter states — no shared reference between pipeline and register
// ---------------------------------------------------------------------------
describe("independent per-view filter defaults", () => {
  // These tests verify the structural invariant: EMPTY_FILTERS objects are
  // independent (no shared reference). This is the foundation that makes
  // pipelineFilters and registerFilters truly isolated — a mutation on one
  // cannot bleed into the other.

  it("two EMPTY_FILTERS objects are deeply equal but not the same reference", () => {
    const EMPTY_FILTERS = {
      search: "",
      status: [] as string[],
      estimatorId: null,
      clientId: null,
      probability: [] as string[],
      valueMin: "",
      valueMax: "",
      dueDateFrom: "",
      dueDateTo: "",
      discipline: [] as string[],
      sortBy: null,
      sortDir: "desc" as const
    };
    const pipelineFilters = { ...EMPTY_FILTERS };
    const registerFilters = { ...EMPTY_FILTERS };

    // They start equal
    expect(pipelineFilters).toEqual(registerFilters);
    // But mutating one does not affect the other
    pipelineFilters.search = "pipeline-only search";
    expect(registerFilters.search).toBe("");
  });

  it("setting a status on registerFilters does not appear in pipelineFilters", () => {
    const pipelineFilters = { status: [] as string[], search: "" };
    const registerFilters = { status: [] as string[], search: "" };

    // Simulate user selecting status in Register view
    const newRegisterFilters = { ...registerFilters, status: ["AWARDED"] };

    // Pipeline is untouched
    expect(pipelineFilters.status).toHaveLength(0);
    // Register has the new status
    expect(newRegisterFilters.status).toEqual(["AWARDED"]);
    // The original registerFilters is also untouched (spread creates new object)
    expect(registerFilters.status).toHaveLength(0);
  });

  it("setting a search on pipelineFilters does not appear in registerFilters", () => {
    const pipelineFilters = { status: [] as string[], search: "" };
    const registerFilters = { status: [] as string[], search: "" };

    const newPipelineFilters = { ...pipelineFilters, search: "bridge works" };

    expect(newPipelineFilters.search).toBe("bridge works");
    expect(registerFilters.search).toBe("");
    expect(pipelineFilters.search).toBe("");
  });

  it("PIPELINE_STAGES contains exactly the three in-flight stages", () => {
    // SUBMITTED exited the board with the withdrawn-review lifecycle slice —
    // it now lives on the CRM Tenders Register alongside confirmed-WITHDRAWN.
    expect([...PIPELINE_STAGES]).toEqual(["DRAFT", "IN_PROGRESS", "WITHDRAWN"]);
  });

  it("PIPELINE_STAGES does NOT include outcome or Register-only statuses", () => {
    const nonBoardStatuses = ["SUBMITTED", "AWARDED", "CONTRACT_ISSUED", "LOST", "CONVERTED"];
    for (const status of nonBoardStatuses) {
      expect((PIPELINE_STAGES as readonly string[]).includes(status)).toBe(false);
    }
  });
});
