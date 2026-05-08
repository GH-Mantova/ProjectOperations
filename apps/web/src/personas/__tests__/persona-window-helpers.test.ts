import { describe, expect, it } from "vitest";
import {
  activePersonaKey,
  buildActivePersonaUrl,
  buttonLabel,
  panelContent
} from "../persona-window-helpers";
import type { ActivePersona } from "../types";

const tendering: ActivePersona = {
  persona: { slug: "tendering", displayName: "Tendering Assistant", description: "desc" },
  subMode: { name: "scope", label: "Scope — propose and refine scope items" }
};

describe("activePersonaKey", () => {
  it("returns null when there is no active persona", () => {
    expect(activePersonaKey(null)).toBeNull();
  });

  it("includes both slug and sub-mode so panels reset on tab change", () => {
    const scopeKey = activePersonaKey(tendering);
    const quoteKey = activePersonaKey({
      ...tendering,
      subMode: { name: "quote", label: "Quote — cost line structure and exclusions" }
    });
    expect(scopeKey).toBe("tendering:scope");
    expect(quoteKey).toBe("tendering:quote");
    expect(scopeKey).not.toBe(quoteKey);
  });

  it("is stable across re-renders for the same persona+sub-mode", () => {
    const a = activePersonaKey(tendering);
    const b = activePersonaKey({ ...tendering });
    expect(a).toBe(b);
  });
});

describe("buttonLabel", () => {
  it("returns empty string when no active persona", () => {
    expect(buttonLabel(null)).toBe("");
  });

  it("returns the persona's display name", () => {
    expect(buttonLabel(tendering)).toBe("Tendering Assistant");
  });
});

describe("panelContent", () => {
  it("returns null when no active persona", () => {
    expect(panelContent(null)).toBeNull();
  });

  it("renders title from persona, subtitle from sub-mode label", () => {
    const c = panelContent(tendering)!;
    expect(c.title).toBe("Tendering Assistant");
    expect(c.subtitle).toBe("Scope — propose and refine scope items");
  });

  it("body contains a coming-soon placeholder", () => {
    const c = panelContent(tendering)!;
    expect(c.body).toContain("coming soon");
    expect(c.body).toContain("Tendering Assistant");
  });
});

describe("buildActivePersonaUrl", () => {
  it("concatenates pathname and search", () => {
    expect(buildActivePersonaUrl("/tenders/123", "?detail=scope")).toBe(
      "/tenders/123?detail=scope"
    );
  });

  it("handles empty search", () => {
    expect(buildActivePersonaUrl("/tenders", "")).toBe("/tenders");
  });

  it("handles undefined-like empty search safely", () => {
    expect(buildActivePersonaUrl("/tenders", "" as unknown as string)).toBe("/tenders");
  });
});
