import { describe, expect, it } from "vitest";
import { deriveContextKey, isTenderScopedSubMode } from "../context-key-helpers";

describe("isTenderScopedSubMode", () => {
  it("returns true for tender-detail/scope/estimate/quote/clarifications", () => {
    expect(isTenderScopedSubMode("tender-detail")).toBe(true);
    expect(isTenderScopedSubMode("scope")).toBe(true);
    expect(isTenderScopedSubMode("estimate")).toBe(true);
    expect(isTenderScopedSubMode("quote")).toBe(true);
    expect(isTenderScopedSubMode("clarifications")).toBe(true);
  });
  it("returns false for global sub-modes (pipeline, register)", () => {
    expect(isTenderScopedSubMode("pipeline")).toBe(false);
    expect(isTenderScopedSubMode("register")).toBe(false);
  });
  it("returns false for nullish/unknown", () => {
    expect(isTenderScopedSubMode(null)).toBe(false);
    expect(isTenderScopedSubMode(undefined)).toBe(false);
    expect(isTenderScopedSubMode("")).toBe(false);
    expect(isTenderScopedSubMode("nonsense")).toBe(false);
  });
});

describe("deriveContextKey", () => {
  it("returns the tender id for tender-scoped sub-modes on /tenders/:id paths", () => {
    expect(deriveContextKey("/tenders/cmoo123", "tender-detail")).toBe("cmoo123");
    expect(deriveContextKey("/tenders/cmoo123/scope", "scope")).toBe("cmoo123");
    expect(deriveContextKey("/tenders/abc-456/estimate", "estimate")).toBe("abc-456");
    expect(deriveContextKey("/tenders/T-001/quote", "quote")).toBe("T-001");
    expect(deriveContextKey("/tenders/T-001/clarifications", "clarifications")).toBe("T-001");
  });

  it("returns null for global sub-modes regardless of path", () => {
    expect(deriveContextKey("/tenders/cmoo123/scope", "pipeline")).toBeNull();
    expect(deriveContextKey("/tenders/cmoo123", "register")).toBeNull();
  });

  it("rejects 'create', 'workspace', 'pipeline' as tender ids", () => {
    expect(deriveContextKey("/tenders/create", "tender-detail")).toBeNull();
    expect(deriveContextKey("/tenders/workspace", "tender-detail")).toBeNull();
    expect(deriveContextKey("/tenders/pipeline", "tender-detail")).toBeNull();
  });

  it("returns null when path doesn't match /tenders/:id", () => {
    expect(deriveContextKey("/jobs/123", "scope")).toBeNull();
    expect(deriveContextKey("/admin/ai-settings", "tender-detail")).toBeNull();
    expect(deriveContextKey("/", "scope")).toBeNull();
  });

  it("strips trailing query string and hash from the id segment", () => {
    expect(deriveContextKey("/tenders/cmoo123?detail=scope", "scope")).toBe("cmoo123");
  });
});
