import { describe, expect, it } from "vitest";
import { resolveMasterDataTab } from "../master-data-tab-helpers";

describe("resolveMasterDataTab", () => {
  it("defaults to the clients tab when no tab param is present", () => {
    const result = resolveMasterDataTab(new URLSearchParams(""));
    expect(result).toEqual({ kind: "tab", tab: "clients" });
  });

  it("returns the sites tab when ?tab=sites", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=sites"));
    expect(result).toEqual({ kind: "tab", tab: "sites" });
  });

  it("falls back to the clients tab for an unknown tab value", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=mystery"));
    expect(result).toEqual({ kind: "tab", tab: "clients" });
  });

  it("redirects ?tab=workers to /resources rather than silently rewriting the URL", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=workers"));
    expect(result).toEqual({ kind: "redirect", to: "/resources" });
  });

  it("preserves other query params when redirecting workers", () => {
    const result = resolveMasterDataTab(new URLSearchParams("tab=workers&search=jane&status=ACTIVE"));
    expect(result.kind).toBe("redirect");
    if (result.kind !== "redirect") return;
    expect(result.to.startsWith("/resources?")).toBe(true);
    const query = new URLSearchParams(result.to.split("?")[1]);
    expect(query.get("search")).toBe("jane");
    expect(query.get("status")).toBe("ACTIVE");
    expect(query.get("tab")).toBeNull();
  });
});
