import { describe, expect, it, vi } from "vitest";
import {
  describeRateGroup,
  formatKeyColumnHeader,
  getRateSet,
  lockRateSet,
  patchRateEntry,
  rateGroupKey,
  selectDefaultRatesTableKey,
  tabFromPath,
  unlockRateSet,
  type AuthFetch
} from "../ratesTabApi";
import type { TenderRateGroup } from "../RatesTab";

function makeGroup(over: Partial<TenderRateGroup> = {}): TenderRateGroup {
  return {
    rateTableId: "rateTableId" in over ? (over.rateTableId ?? null) : "t-1",
    rateTableSlug: "rateTableSlug" in over ? (over.rateTableSlug ?? null) : "table-one",
    tableName: over.tableName ?? "Table one",
    keyColumns: over.keyColumns ?? [],
    valueColumnLabel: over.valueColumnLabel ?? null,
    entries: over.entries ?? []
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

describe("tabFromPath", () => {
  it("routes /tenders/:id → overview", () => {
    expect(tabFromPath("/tenders/abc")).toBe("overview");
  });
  it("routes /tenders/:id/scope → scope", () => {
    expect(tabFromPath("/tenders/abc/scope")).toBe("scope");
  });
  it("routes /tenders/:id/rates → rates", () => {
    expect(tabFromPath("/tenders/abc/rates")).toBe("rates");
  });
  it("routes /tenders/:id/quote → quote", () => {
    expect(tabFromPath("/tenders/abc/quote")).toBe("quote");
  });
});

describe("ratesTabApi", () => {
  it("getRateSet: GET /tenders/:id/rate-set", async () => {
    const authFetch = vi.fn<AuthFetch>(async () =>
      jsonResponse({ id: "set-1", tenderId: "t-1", lockedAt: "x", lockedBy: null, sourceLabel: null, groups: [] })
    );
    const out = await getRateSet(authFetch, "t-1");
    expect(authFetch).toHaveBeenCalledWith("/tenders/t-1/rate-set");
    expect(out?.id).toBe("set-1");
  });

  it("lockRateSet: POST /tenders/:id/rate-set/lock with JSON body", async () => {
    const authFetch = vi.fn<AuthFetch>(async () =>
      jsonResponse({ id: "set-1", tenderId: "t-1", lockedAt: "x", lockedBy: null, sourceLabel: null, groups: [] })
    );
    await lockRateSet(authFetch, "t-1");
    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/tenders/t-1/rate-set/lock");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({}));
  });

  it("lockRateSet: passes sourceLabel through as body when provided", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => jsonResponse({}));
    await lockRateSet(authFetch, "t-1", "Rates as of 09/07/2026");
    const [, init] = authFetch.mock.calls[0] ?? [];
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ sourceLabel: "Rates as of 09/07/2026" })
    );
  });

  it("lockRateSet: empty/204 response returns null instead of throwing", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => emptyResponse(204));
    // Reproduces the wizard bug: previously res.json() threw
    // "Unexpected end of JSON input" here.
    await expect(lockRateSet(authFetch, "t-1")).resolves.toBeNull();
  });

  it("getRateSet: empty response returns null instead of throwing", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => emptyResponse(200));
    await expect(getRateSet(authFetch, "t-1")).resolves.toBeNull();
  });

  it("unlockRateSet: DELETE /tenders/:id/rate-set", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => jsonResponse({ unlocked: true }));
    const out = await unlockRateSet(authFetch, "t-1");
    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/tenders/t-1/rate-set");
    expect((init as RequestInit).method).toBe("DELETE");
    expect(out.unlocked).toBe(true);
  });

  it("unlockRateSet: empty/204 response returns { unlocked: false } instead of throwing", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => emptyResponse(204));
    await expect(unlockRateSet(authFetch, "t-1")).resolves.toEqual({ unlocked: false });
  });

  it("patchRateEntry: PATCH the entry with { overrideValue: <number> }", async () => {
    const authFetch = vi.fn<AuthFetch>(async () =>
      jsonResponse({
        id: "e-1",
        key: "k",
        label: "L",
        unit: "hr",
        rateTableId: "t",
        rateTableSlug: "s",
        originalValue: "100",
        overrideValue: "175",
        effectiveValue: "175",
        overridden: true,
        keyValues: []
      })
    );
    const out = await patchRateEntry(authFetch, "t-1", "e-1", 175);
    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/tenders/t-1/rate-set/entries/e-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ overrideValue: 175 }));
    expect(out.overridden).toBe(true);
  });

  it("patchRateEntry: revert clears with { overrideValue: null }", async () => {
    const authFetch = vi.fn<AuthFetch>(async () =>
      jsonResponse({
        id: "e-1",
        key: "k",
        label: "L",
        unit: "hr",
        rateTableId: "t",
        rateTableSlug: "s",
        originalValue: "100",
        overrideValue: null,
        effectiveValue: "100",
        overridden: false,
        keyValues: []
      })
    );
    const out = await patchRateEntry(authFetch, "t-1", "e-1", null);
    const [, init] = authFetch.mock.calls[0] ?? [];
    expect((init as RequestInit).body).toBe(JSON.stringify({ overrideValue: null }));
    expect(out.overridden).toBe(false);
    expect(out.overrideValue).toBeNull();
  });

  it("throws with the server message when the API returns an error", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => textResponse("Not locked", 404));
    await expect(patchRateEntry(authFetch, "t-1", "e-1", 10)).rejects.toThrow("Not locked");
  });
});

describe("describeRateGroup", () => {
  it("renders one leading cell per key column (single-key table)", () => {
    const group: TenderRateGroup = {
      rateTableId: "t-core",
      rateTableSlug: "core-hole",
      tableName: "Core-hole rates",
      keyColumns: [{ name: "Size", unit: "mm" }],
      valueColumnLabel: "Rate per hole",
      entries: [
        {
          id: "e-1",
          key: "t-core:r-100:v",
          label: "Core-hole rates — 100 (Rate per hole)",
          unit: "hole",
          rateTableId: "t-core",
          rateTableSlug: "core-hole",
          originalValue: "2.55",
          overrideValue: null,
          effectiveValue: "2.55",
          overridden: false,
          keyValues: ["100"]
        },
        {
          id: "e-2",
          key: "t-core:r-125:v",
          label: "Core-hole rates — 125 (Rate per hole)",
          unit: "hole",
          rateTableId: "t-core",
          rateTableSlug: "core-hole",
          originalValue: "2.75",
          overrideValue: null,
          effectiveValue: "2.75",
          overridden: false,
          keyValues: ["125"]
        }
      ]
    };
    const { headers, rowKeyCells } = describeRateGroup(group);
    expect(headers).toEqual(["Size (mm)", "Original", "Override"]);
    expect(rowKeyCells).toEqual([["100"], ["125"]]);
  });

  it("renders N leading cells per key column (multi-key table)", () => {
    const group: TenderRateGroup = {
      rateTableId: "t-cut",
      rateTableSlug: "cutting",
      tableName: "Cutting rates",
      keyColumns: [
        { name: "Equipment", unit: null },
        { name: "Elevation", unit: null },
        { name: "Material", unit: null },
        { name: "Depth", unit: "mm" }
      ],
      valueColumnLabel: "Rate per m",
      entries: [
        {
          id: "e-1",
          key: "t-cut:r-1:v",
          label: "…",
          unit: "m",
          rateTableId: "t-cut",
          rateTableSlug: "cutting",
          originalValue: "50",
          overrideValue: null,
          effectiveValue: "50",
          overridden: false,
          keyValues: ["Concrete saw", "Ground", "Reinforced", "200"]
        }
      ]
    };
    const { headers, rowKeyCells } = describeRateGroup(group);
    expect(headers).toEqual([
      "Equipment",
      "Elevation",
      "Material",
      "Depth (mm)",
      "Original",
      "Override"
    ]);
    expect(rowKeyCells).toEqual([["Concrete saw", "Ground", "Reinforced", "200"]]);
  });

  it("does NOT re-append the unit when it is already present in the column name", () => {
    // Fix for the "Diameter (mm) (mm)" duplication: the projected column
    // name already carries its unit token, so the header must not double.
    const group: TenderRateGroup = {
      rateTableId: "t-core",
      rateTableSlug: "core-hole",
      tableName: "Core-hole rates",
      keyColumns: [
        { name: "Diameter (mm)", unit: "mm" },
        { name: "Depth (MM)", unit: "mm" }
      ],
      valueColumnLabel: "Rate per hole",
      entries: []
    };
    const { headers } = describeRateGroup(group);
    expect(headers.slice(0, 2)).toEqual(["Diameter (mm)", "Depth (MM)"]);
  });

  it("falls back to Rate | Unit columns when keyColumns is empty (legacy group)", () => {
    const group: TenderRateGroup = {
      rateTableId: null,
      rateTableSlug: null,
      tableName: "Legacy labour",
      keyColumns: [],
      valueColumnLabel: null,
      entries: [
        {
          id: "e-1",
          key: "legacy:x:y",
          label: "Labourer (day)",
          unit: "day",
          rateTableId: null,
          rateTableSlug: null,
          originalValue: "500",
          overrideValue: null,
          effectiveValue: "500",
          overridden: false,
          keyValues: []
        }
      ]
    };
    const { headers, rowKeyCells } = describeRateGroup(group);
    expect(headers).toEqual(["Rate", "Unit", "Original", "Override"]);
    expect(rowKeyCells).toEqual([["Labourer (day)", "day"]]);
  });
});

describe("formatKeyColumnHeader", () => {
  it("appends the unit when the name doesn't already contain it", () => {
    expect(formatKeyColumnHeader("Size", "mm")).toBe("Size (mm)");
  });

  it("returns the name as-is when unit is null", () => {
    expect(formatKeyColumnHeader("Equipment", null)).toBe("Equipment");
  });

  it("does not double the unit when the name already contains it", () => {
    // Prevents the "Diameter (mm) (mm)" regression Marco flagged.
    expect(formatKeyColumnHeader("Diameter (mm)", "mm")).toBe("Diameter (mm)");
    expect(formatKeyColumnHeader("Depth (MM)", "mm")).toBe("Depth (MM)");
  });
});

describe("rateGroupKey / selectDefaultRatesTableKey", () => {
  it("keys prefer rateTableId, fall back to slug, then 'other'", () => {
    expect(rateGroupKey(makeGroup({ rateTableId: "id-1", rateTableSlug: "s" }))).toBe("id-1");
    expect(rateGroupKey(makeGroup({ rateTableId: null, rateTableSlug: "s" }))).toBe("s");
    expect(rateGroupKey(makeGroup({ rateTableId: null, rateTableSlug: null }))).toBe("other");
  });

  it("returns null when there are no groups", () => {
    expect(selectDefaultRatesTableKey([], null)).toBeNull();
    expect(selectDefaultRatesTableKey([], "anything")).toBeNull();
  });

  it("defaults to the first group's key when nothing is selected", () => {
    const g1 = makeGroup({ rateTableId: "a", tableName: "A" });
    const g2 = makeGroup({ rateTableId: "b", tableName: "B" });
    expect(selectDefaultRatesTableKey([g1, g2], null)).toBe("a");
  });

  it("preserves the current selection when it still exists", () => {
    const g1 = makeGroup({ rateTableId: "a" });
    const g2 = makeGroup({ rateTableId: "b" });
    expect(selectDefaultRatesTableKey([g1, g2], "b")).toBe("b");
  });

  it("falls back to the first group when the current selection is gone", () => {
    const g1 = makeGroup({ rateTableId: "a" });
    const g2 = makeGroup({ rateTableId: "b" });
    expect(selectDefaultRatesTableKey([g1, g2], "z")).toBe("a");
  });
});
