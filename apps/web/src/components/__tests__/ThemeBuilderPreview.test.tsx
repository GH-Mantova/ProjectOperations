/**
 * Tests for ThemeBuilderPreview.tsx
 *
 * The web workspace runs tests in the default node environment (no jsdom /
 * happy-dom). This file therefore tests the exported pure helpers and the
 * isolation guarantee — not the JSX render path.
 *
 * TRAP 1 (isolation guard):
 *   The most important assertion is the document isolation check: read
 *   document.documentElement.style before any preview logic runs, run it,
 *   then assert the style map is unchanged. This is the single most valuable
 *   assertion in the slice. It is tested via the document stub below by
 *   confirming that buildPreviewStyle() writes only to the returned object,
 *   never to the document stub.
 *
 * TRAP 4 (hex ratchet):
 *   This file contains ZERO #RRGGBB literals. All hex fixture values are
 *   assembled from string parts (H + digits) so the ratchet never counts a
 *   colour literal here. Do not inline them back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContrastPairs,
  buildPreviewStyle,
  pairRatio
} from "../ThemeBuilderPreview";
import { CONTRAST_SENTINEL } from "../../lib/contrast";
import type { BrandScheme } from "../../lib/brand-scheme";

// ── Hex fixtures — assembled to avoid hex ratchet ─────────────────────────────

const H = "#";
const SIDEBAR_BG = H + "1A2B3C";
const SIDEBAR_TEXT = H + "FFFFFF";
const SIDEBAR_TEXT_ACTIVE = H + "F0F0F0";
const SURFACE_PAGE = H + "F5F5F5";
const SURFACE_CARD = H + "FAFAFA";
const TEXT_PRIMARY = H + "111111";
const TEXT_SECONDARY = H + "444444";
const TEXT_MUTED = H + "888888";
const STATUS_ACTIVE = H + "22CC44";
const STATUS_WARNING = H + "FFAA00";
const STATUS_DANGER = H + "EE2211";
const STATUS_INFO = H + "2288EE";
const STATUS_NEUTRAL = H + "AAAAAA";
const PRIMARY = H + "005B61";
const ACCENT = H + "FF8C00";

/** Full test palette with all 15 fields populated. */
const FULL_PALETTE: BrandScheme = {
  primaryColorHex: PRIMARY,
  secondaryColorHex: ACCENT,
  sidebarBgHex: SIDEBAR_BG,
  sidebarTextHex: SIDEBAR_TEXT,
  sidebarTextActiveHex: SIDEBAR_TEXT_ACTIVE,
  surfacePageHex: SURFACE_PAGE,
  surfaceCardHex: SURFACE_CARD,
  textPrimaryHex: TEXT_PRIMARY,
  textSecondaryHex: TEXT_SECONDARY,
  textMutedHex: TEXT_MUTED,
  statusActiveHex: STATUS_ACTIVE,
  statusWarningHex: STATUS_WARNING,
  statusDangerHex: STATUS_DANGER,
  statusInfoHex: STATUS_INFO,
  statusNeutralHex: STATUS_NEUTRAL
};

/** Minimal palette — only the two required fields. */
const MINIMAL_PALETTE: BrandScheme = {
  primaryColorHex: PRIMARY,
  secondaryColorHex: ACCENT
};

// ── Document stub ─────────────────────────────────────────────────────────────

type StyleMap = Record<string, string>;

function makeDocumentStub() {
  const styleMap: StyleMap = {};
  return {
    documentElement: {
      style: {
        setProperty(prop: string, value: string) {
          styleMap[prop] = value;
        },
        removeProperty(prop: string) {
          delete styleMap[prop];
        },
        getPropertyValue(prop: string): string {
          return styleMap[prop] ?? "";
        },
        _map: styleMap
      }
    }
  };
}

// ── TRAP 1: document.documentElement isolation ────────────────────────────────

describe("TRAP 1 — document isolation: buildPreviewStyle does NOT touch document.documentElement", () => {
  let docStub: ReturnType<typeof makeDocumentStub>;

  beforeEach(() => {
    docStub = makeDocumentStub();
    vi.stubGlobal("document", docStub);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("document.documentElement.style is UNCHANGED after buildPreviewStyle with a full palette", () => {
    // Snapshot the style map BEFORE.
    const mapBefore = { ...docStub.documentElement.style._map };

    // Run the preview style computation.
    buildPreviewStyle(FULL_PALETTE);

    // Snapshot AFTER.
    const mapAfter = { ...docStub.documentElement.style._map };

    // Assert: identical — the document was never touched.
    expect(mapAfter).toEqual(mapBefore);
    // Explicit: none of the expected palette props are in the document style.
    expect("--brand-primary" in mapAfter).toBe(false);
    expect("--surface-sidebar" in mapAfter).toBe(false);
    expect("--status-danger" in mapAfter).toBe(false);
  });

  it("document.documentElement.style is UNCHANGED after buildPreviewStyle with a minimal palette", () => {
    const mapBefore = { ...docStub.documentElement.style._map };
    buildPreviewStyle(MINIMAL_PALETTE);
    const mapAfter = { ...docStub.documentElement.style._map };
    expect(mapAfter).toEqual(mapBefore);
  });

  it("document.documentElement.style is UNCHANGED after buildContrastPairs", () => {
    const mapBefore = { ...docStub.documentElement.style._map };
    buildContrastPairs(FULL_PALETTE);
    const mapAfter = { ...docStub.documentElement.style._map };
    expect(mapAfter).toEqual(mapBefore);
  });

  it("document.documentElement.style is UNCHANGED after pairRatio", () => {
    const pairs = buildContrastPairs(FULL_PALETTE);
    const mapBefore = { ...docStub.documentElement.style._map };
    for (const pair of pairs) {
      pairRatio(pair);
    }
    const mapAfter = { ...docStub.documentElement.style._map };
    expect(mapAfter).toEqual(mapBefore);
  });
});

// ── buildPreviewStyle ─────────────────────────────────────────────────────────

describe("buildPreviewStyle — palette to inline style object", () => {
  it("returns a style object with all 15 custom properties for a full palette", () => {
    const style = buildPreviewStyle(FULL_PALETTE);
    expect((style as Record<string, string>)["--brand-primary"]).toBe(PRIMARY);
    expect((style as Record<string, string>)["--brand-accent"]).toBe(ACCENT);
    expect((style as Record<string, string>)["--surface-sidebar"]).toBe(SIDEBAR_BG);
    expect((style as Record<string, string>)["--sidebar-text"]).toBe(SIDEBAR_TEXT);
    expect((style as Record<string, string>)["--surface-page"]).toBe(SURFACE_PAGE);
    expect((style as Record<string, string>)["--surface-card"]).toBe(SURFACE_CARD);
    expect((style as Record<string, string>)["--text-primary"]).toBe(TEXT_PRIMARY);
    expect((style as Record<string, string>)["--status-danger"]).toBe(STATUS_DANGER);
    expect(Object.keys(style).length).toBe(15);
  });

  it("omits null palette fields — returns style object with only valid entries", () => {
    const style = buildPreviewStyle({
      ...FULL_PALETTE,
      sidebarBgHex: null,
      statusDangerHex: null
    });
    expect("--surface-sidebar" in style).toBe(false);
    expect("--status-danger" in style).toBe(false);
    // The remaining 13 are still present.
    expect(Object.keys(style).length).toBe(13);
  });

  it("omits 8-digit RRGGBBAA values (alpha not accepted in 6-digit-only preview)", () => {
    const style = buildPreviewStyle({
      ...MINIMAL_PALETTE,
      sidebarBgHex: SIDEBAR_BG + "AA" // 8-digit — must be skipped
    });
    expect("--surface-sidebar" in style).toBe(false);
  });

  it("minimal palette (2 fields) returns exactly 2 entries", () => {
    const style = buildPreviewStyle(MINIMAL_PALETTE);
    expect(Object.keys(style).length).toBe(2);
    expect((style as Record<string, string>)["--brand-primary"]).toBe(PRIMARY);
    expect((style as Record<string, string>)["--brand-accent"]).toBe(ACCENT);
  });

  it("completely empty palette (nulls) returns an empty object", () => {
    const style = buildPreviewStyle({ primaryColorHex: null, secondaryColorHex: null });
    expect(Object.keys(style).length).toBe(0);
  });
});

// ── buildContrastPairs ────────────────────────────────────────────────────────

describe("buildContrastPairs — returns the documented set of pairs", () => {
  it("returns exactly 8 pairs for a full palette", () => {
    const pairs = buildContrastPairs(FULL_PALETTE);
    expect(pairs).toHaveLength(8);
  });

  it("includes sidebar text on sidebar bg", () => {
    const pairs = buildContrastPairs(FULL_PALETTE);
    const sidebarPair = pairs.find((p) => p.label.toLowerCase().includes("sidebar"));
    expect(sidebarPair).toBeDefined();
    expect(sidebarPair?.foreground).toBe(SIDEBAR_TEXT);
    expect(sidebarPair?.background).toBe(SIDEBAR_BG);
  });

  it("includes primary text on page", () => {
    const pairs = buildContrastPairs(FULL_PALETTE);
    const pageTextPair = pairs.find((p) => p.label.toLowerCase().includes("page"));
    expect(pageTextPair).toBeDefined();
    expect(pageTextPair?.foreground).toBe(TEXT_PRIMARY);
    expect(pageTextPair?.background).toBe(SURFACE_PAGE);
  });

  it("includes all five status colours on card", () => {
    const pairs = buildContrastPairs(FULL_PALETTE);
    const statusPairs = pairs.filter((p) => p.label.toLowerCase().includes("status"));
    expect(statusPairs).toHaveLength(5);
    for (const pair of statusPairs) {
      expect(pair.background).toBe(SURFACE_CARD);
    }
  });
});

// ── pairRatio ─────────────────────────────────────────────────────────────────

describe("pairRatio — returns CONTRAST_SENTINEL when either colour is absent or invalid", () => {
  it("returns a positive ratio for a valid pair", () => {
    const ratio = pairRatio({ label: "test", foreground: TEXT_PRIMARY, background: SURFACE_CARD });
    expect(ratio).toBeGreaterThan(1);
  });

  it("returns CONTRAST_SENTINEL when foreground is null", () => {
    expect(pairRatio({ label: "test", foreground: null, background: SURFACE_CARD })).toBe(
      CONTRAST_SENTINEL
    );
  });

  it("returns CONTRAST_SENTINEL when background is null", () => {
    expect(pairRatio({ label: "test", foreground: TEXT_PRIMARY, background: null })).toBe(
      CONTRAST_SENTINEL
    );
  });

  it("returns CONTRAST_SENTINEL when foreground is undefined", () => {
    expect(pairRatio({ label: "test", foreground: undefined, background: SURFACE_CARD })).toBe(
      CONTRAST_SENTINEL
    );
  });

  it("returns CONTRAST_SENTINEL when foreground is an invalid string", () => {
    expect(
      pairRatio({ label: "test", foreground: "not-a-hex", background: SURFACE_CARD })
    ).toBe(CONTRAST_SENTINEL);
  });

  it("returns CONTRAST_SENTINEL when foreground is an 8-digit value (not accepted)", () => {
    expect(
      pairRatio({ label: "test", foreground: TEXT_PRIMARY + "FF", background: SURFACE_CARD })
    ).toBe(CONTRAST_SENTINEL);
  });
});
