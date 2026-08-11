import { describe, expect, it } from "vitest";
import {
  DIRECTORY_TABS,
  resolveDirectoryTab,
  withDirectoryTab
} from "../directory-tab-helpers";

describe("Directory tabs", () => {
  it("exposes exactly three tabs and does NOT include Workers", () => {
    expect(DIRECTORY_TABS.map((t) => t.id)).toEqual([
      "clients",
      "subcontractors",
      "contacts"
    ]);
    expect(DIRECTORY_TABS.some((t) => t.label.toLowerCase().includes("worker"))).toBe(false);
    expect(DIRECTORY_TABS.some((t) => t.id === ("workers" as string))).toBe(false);
  });
});

describe("resolveDirectoryTab", () => {
  it("defaults to clients when the param is missing", () => {
    expect(resolveDirectoryTab(null)).toBe("clients");
  });

  it("returns the requested tab when valid", () => {
    expect(resolveDirectoryTab("clients")).toBe("clients");
    expect(resolveDirectoryTab("subcontractors")).toBe("subcontractors");
    expect(resolveDirectoryTab("contacts")).toBe("contacts");
  });

  it("falls back to clients on unknown values (including the removed workers tab)", () => {
    expect(resolveDirectoryTab("workers")).toBe("clients");
    expect(resolveDirectoryTab("mystery")).toBe("clients");
    expect(resolveDirectoryTab("")).toBe("clients");
  });
});

describe("withDirectoryTab", () => {
  it("writes the tab param without dropping other query values", () => {
    const params = new URLSearchParams("search=jane&highlight=abc");
    const next = withDirectoryTab(params, "subcontractors");
    expect(next.get("tab")).toBe("subcontractors");
    expect(next.get("search")).toBe("jane");
    expect(next.get("highlight")).toBe("abc");
  });

  it("does not mutate the incoming params object", () => {
    const params = new URLSearchParams("tab=clients&search=x");
    withDirectoryTab(params, "contacts");
    expect(params.get("tab")).toBe("clients");
    expect(params.get("search")).toBe("x");
  });

  it("overwrites an existing tab param rather than appending", () => {
    const params = new URLSearchParams("tab=clients");
    const next = withDirectoryTab(params, "contacts");
    expect(next.getAll("tab")).toEqual(["contacts"]);
  });

  it("selecting Subcontractors then Contacts keeps the last selection (no snap-back)", () => {
    let current = new URLSearchParams("tab=clients");
    current = withDirectoryTab(current, "subcontractors");
    expect(resolveDirectoryTab(current.get("tab"))).toBe("subcontractors");
    current = withDirectoryTab(current, "contacts");
    expect(resolveDirectoryTab(current.get("tab"))).toBe("contacts");
  });
});
