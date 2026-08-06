/**
 * DirectoryPage — tab shape + URL-state logic.
 *
 * The web workspace has no jsdom / @testing-library, so we cover the
 * pure pieces: (1) the tab manifest — three tabs, no "Workers" — and
 * (2) `resolveDirectoryTab`, the single source of truth used to derive
 * the active tab from the URL every render. The former guards against
 * the Workers button being re-added; the latter guards against the
 * pre-fix flicker where a selected tab would snap back to Clients.
 */
import { describe, expect, it } from "vitest";
import {
  DIRECTORY_TABS,
  resolveDirectoryTab,
  type DirectoryTab
} from "../DirectoryPage";

describe("DirectoryPage — tab manifest", () => {
  it("renders exactly three tabs", () => {
    expect(DIRECTORY_TABS).toHaveLength(3);
  });

  it("contains Clients, Subcontractors & Suppliers, and Contacts — in that order", () => {
    expect(DIRECTORY_TABS.map((t) => t.id)).toEqual([
      "clients",
      "subcontractors",
      "contacts"
    ]);
    expect(DIRECTORY_TABS.map((t) => t.label)).toEqual([
      "Clients",
      "Subcontractors & Suppliers",
      "Contacts"
    ]);
  });

  it("does NOT include a Workers tab (Workers lives in the HR/Workers workspace)", () => {
    const ids = DIRECTORY_TABS.map((t) => t.id.toLowerCase());
    const labels = DIRECTORY_TABS.map((t) => t.label.toLowerCase());
    expect(ids).not.toContain("workers");
    expect(labels.some((l) => l.includes("worker"))).toBe(false);
  });
});

describe("DirectoryPage — resolveDirectoryTab", () => {
  it("defaults to 'clients' for null / empty / unknown values", () => {
    expect(resolveDirectoryTab(null)).toBe("clients");
    expect(resolveDirectoryTab("")).toBe("clients");
    expect(resolveDirectoryTab("workers")).toBe("clients");
    expect(resolveDirectoryTab("bogus")).toBe("clients");
  });

  it("returns the requested tab when the URL param is valid", () => {
    expect(resolveDirectoryTab("clients")).toBe("clients");
    expect(resolveDirectoryTab("subcontractors")).toBe("subcontractors");
    expect(resolveDirectoryTab("contacts")).toBe("contacts");
  });

  it("is idempotent — a selected tab stays selected when derived from its own URL param", () => {
    // Guards against the pre-fix flicker: two competing effects could
    // race and snap a just-selected tab back to Clients. With a single
    // URL-derived source of truth, feeding the current tab back through
    // resolve() must always return the same tab.
    const cases: DirectoryTab[] = ["clients", "subcontractors", "contacts"];
    for (const t of cases) {
      expect(resolveDirectoryTab(t)).toBe(t);
    }
  });
});
