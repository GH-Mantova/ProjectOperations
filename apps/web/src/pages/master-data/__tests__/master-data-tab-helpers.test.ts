import { describe, expect, it } from "vitest";
import { resolveMasterDataTab } from "../master-data-tab-helpers";

describe("resolveMasterDataTab", () => {
  it("redirects the naked route into /directory?tab=clients", () => {
    const result = resolveMasterDataTab(new URLSearchParams(""));
    expect(result).toEqual({ kind: "redirect", to: "/directory?tab=clients" });
  });

  it("redirects ?tab=clients into /directory?tab=clients", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=clients"));
    expect(result).toEqual({ kind: "redirect", to: "/directory?tab=clients" });
  });

  it("returns the sites tab when ?tab=sites", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=sites"));
    expect(result).toEqual({ kind: "tab", tab: "sites" });
  });

  it("redirects an unknown tab value into /directory?tab=clients", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=mystery"));
    expect(result).toEqual({ kind: "redirect", to: "/directory?tab=clients" });
  });

  it("redirects ?tab=workers to /workers rather than silently rewriting the URL", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=workers"));
    expect(result).toEqual({ kind: "redirect", to: "/workers" });
  });

  it("preserves other query params when redirecting workers", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=workers&search=jane&status=ACTIVE"));
    expect(result.kind).toBe("redirect");
    if (result.kind !== "redirect") return;
    expect(result.to.startsWith("/workers?")).toBe(true);
    const query = new URLSearchParams(result.to.split("?")[1]);
    expect(query.get("search")).toBe("jane");
    expect(query.get("status")).toBe("ACTIVE");
    expect(query.get("tab")).toBeNull();
  });

  it("preserves other query params when redirecting the clients default", () => {
    const result = resolveMasterDataTab(new URLSearchParams("highlight=abc&search=foo"));
    expect(result.kind).toBe("redirect");
    if (result.kind !== "redirect") return;
    expect(result.to.startsWith("/directory?")).toBe(true);
    const query = new URLSearchParams(result.to.split("?")[1]);
    expect(query.get("tab")).toBe("clients");
    expect(query.get("highlight")).toBe("abc");
    expect(query.get("search")).toBe("foo");
  });
});
