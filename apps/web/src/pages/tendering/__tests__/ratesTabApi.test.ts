import { describe, expect, it, vi } from "vitest";
import {
  getRateSet,
  lockRateSet,
  patchRateEntry,
  tabFromPath,
  unlockRateSet,
  type AuthFetch
} from "../ratesTabApi";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
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

  it("unlockRateSet: DELETE /tenders/:id/rate-set", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => jsonResponse({ unlocked: true }));
    const out = await unlockRateSet(authFetch, "t-1");
    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/tenders/t-1/rate-set");
    expect((init as RequestInit).method).toBe("DELETE");
    expect(out.unlocked).toBe(true);
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
        overridden: true
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
        overridden: false
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
