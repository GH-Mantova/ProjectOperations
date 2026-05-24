import { describe, expect, it } from "vitest";
import {
  activePersonaKey,
  buildActivePersonaUrl,
  buttonLabel,
  clampWindowPosition,
  PERSONA_WINDOW_MARGIN,
  panelContent,
  personaWindowStorageKeys
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

  it("does not include a body field", () => {
    const c = panelContent(tendering)!;
    expect(c).not.toHaveProperty("body");
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

describe("clampWindowPosition (PR B1.8)", () => {
  const bubble = { width: 400, height: 600 };
  const viewport = { width: 1280, height: 800 };

  it("returns the candidate unchanged when fully in-bounds", () => {
    const result = clampWindowPosition({ x: 200, y: 100 }, bubble, viewport);
    expect(result).toEqual({ x: 200, y: 100 });
  });

  it("clamps x to the left margin when the candidate is off-screen left", () => {
    const result = clampWindowPosition({ x: -100, y: 100 }, bubble, viewport);
    expect(result.x).toBe(PERSONA_WINDOW_MARGIN);
  });

  it("clamps x to the right margin when the candidate overflows right", () => {
    const result = clampWindowPosition({ x: 2000, y: 100 }, bubble, viewport);
    // 1280 - 400 - 8 = 872
    expect(result.x).toBe(viewport.width - bubble.width - PERSONA_WINDOW_MARGIN);
  });

  it("clamps y to the top margin when the candidate is off-screen up", () => {
    const result = clampWindowPosition({ x: 100, y: -50 }, bubble, viewport);
    expect(result.y).toBe(PERSONA_WINDOW_MARGIN);
  });

  it("clamps y to the bottom margin when the candidate overflows down", () => {
    const result = clampWindowPosition({ x: 100, y: 1500 }, bubble, viewport);
    expect(result.y).toBe(viewport.height - bubble.height - PERSONA_WINDOW_MARGIN);
  });

  it("falls back to margin when bubble is larger than viewport", () => {
    // Tiny mobile viewport, full-size bubble — clamp can't fit so it
    // pins to the margin in both axes rather than going negative.
    const result = clampWindowPosition(
      { x: 999, y: 999 },
      { width: 1000, height: 1000 },
      { width: 320, height: 568 }
    );
    expect(result).toEqual({ x: PERSONA_WINDOW_MARGIN, y: PERSONA_WINDOW_MARGIN });
  });

  it("respects a custom margin override", () => {
    const result = clampWindowPosition({ x: -100, y: -100 }, bubble, viewport, 32);
    expect(result).toEqual({ x: 32, y: 32 });
  });
});

describe("personaWindowStorageKeys (PR B1.8)", () => {
  it("returns null when no persona is active", () => {
    expect(personaWindowStorageKeys(null)).toBeNull();
  });

  it("produces stable per-persona keys", () => {
    expect(personaWindowStorageKeys("tendering:scope")).toEqual({
      position: "persona-window:tendering:scope:position",
      minimised: "persona-window:tendering:scope:minimised"
    });
  });

  it("scopes keys per sub-mode", () => {
    const scope = personaWindowStorageKeys("tendering:scope");
    const quote = personaWindowStorageKeys("tendering:quote");
    expect(scope?.position).not.toBe(quote?.position);
    expect(scope?.minimised).not.toBe(quote?.minimised);
  });
});
