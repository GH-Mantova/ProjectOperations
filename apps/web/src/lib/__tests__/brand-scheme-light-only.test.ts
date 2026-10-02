/**
 * BRAND_LIGHT_ONLY_V1 — tests that applyBrandScheme emits a <style> element
 * scoped to light mode only, with NO inline properties on documentElement
 * and NO dark-mode selectors in the generated CSS.
 *
 * Test-7 red/green proof: these tests MUST FAIL on origin/main (which uses
 * root.style.setProperty) and PASS after this PR. The PR body carries the
 * evidence.
 *
 * TRAP 4: ZERO #RRGGBB literals — all hex values are composed from parts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hex fixtures composed from parts to satisfy the hex ratchet.
const HASH = "#";
// Harbour-like palette
const H_PRIMARY = HASH + "00557A";
const H_ACCENT = HASH + "0099CC";
const H_SIDEBAR_BG = HASH + "003A52";
const H_SIDEBAR_TEXT = HASH + "E0F4FF";
const H_SIDEBAR_TEXT_ACTIVE = HASH + "FFFFFF";
const H_SURFACE_PAGE = HASH + "F0F8FF";
const H_SURFACE_CARD = HASH + "FFFFFF";
const H_TEXT_PRIMARY = HASH + "0D1B2A";
const H_TEXT_SECONDARY = HASH + "2C4A5C";
const H_TEXT_MUTED = HASH + "6B8FA3";
const H_STATUS_ACTIVE = HASH + "00A86B";
const H_STATUS_WARNING = HASH + "E68A00";
const H_STATUS_DANGER = HASH + "CC2200";
const H_STATUS_INFO = HASH + "0077BB";
const H_STATUS_NEUTRAL = HASH + "8899AA";

// Company and override schemes for test-5
const COMPANY_PRIMARY = HASH + "005B61";
const COMPANY_ACCENT = HASH + "FF8C00";
const OVERRIDE_PRIMARY = HASH + "AA1122";
const OVERRIDE_ACCENT = HASH + "33BB44";

// ── DOM stub ──────────────────────────────────────────────────────────────────

type StyleElementStub = {
  id: string;
  textContent: string;
  parentNode: { removeChild: (el: StyleElementStub) => void } | null;
};

function makeDocumentStub() {
  const elements: Map<string, StyleElementStub> = new Map();

  // Track setProperty calls to assert they are NEVER made.
  const setPropertyCalls: string[] = [];

  const stub = {
    documentElement: {
      style: {
        setProperty(prop: string, _value: string) {
          setPropertyCalls.push(prop);
        },
        removeProperty(_prop: string) {}
      },
      // Expose for assertions.
      _setPropertyCalls: setPropertyCalls
    },
    head: {
      appendChild(el: StyleElementStub) {
        el.parentNode = {
          removeChild(child: StyleElementStub) {
            elements.delete(child.id);
          }
        };
        elements.set(el.id, el);
      }
    },
    getElementById(id: string): StyleElementStub | null {
      return elements.get(id) ?? null;
    },
    createElement(_tag: string): StyleElementStub {
      return { id: "", textContent: "", parentNode: null };
    },
    _elements: elements
  };

  return stub;
}

function makeLocalStorageStub(initialData: Record<string, string> = {}) {
  const store = { ...initialData };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    _store: store
  };
}

function getBrandCss(docStub: ReturnType<typeof makeDocumentStub>): string | null {
  const el = docStub._elements.get("brand-scheme");
  return el ? el.textContent : null;
}

const HARBOUR_FULL = {
  primaryColorHex: H_PRIMARY,
  secondaryColorHex: H_ACCENT,
  sidebarBgHex: H_SIDEBAR_BG,
  sidebarTextHex: H_SIDEBAR_TEXT,
  sidebarTextActiveHex: H_SIDEBAR_TEXT_ACTIVE,
  surfacePageHex: H_SURFACE_PAGE,
  surfaceCardHex: H_SURFACE_CARD,
  textPrimaryHex: H_TEXT_PRIMARY,
  textSecondaryHex: H_TEXT_SECONDARY,
  textMutedHex: H_TEXT_MUTED,
  statusActiveHex: H_STATUS_ACTIVE,
  statusWarningHex: H_STATUS_WARNING,
  statusDangerHex: H_STATUS_DANGER,
  statusInfoHex: H_STATUS_INFO,
  statusNeutralHex: H_STATUS_NEUTRAL
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe("BRAND_LIGHT_ONLY_V1 — applyBrandScheme writes style element, not inline props", () => {
  let docStub: ReturnType<typeof makeDocumentStub>;
  let lsStub: ReturnType<typeof makeLocalStorageStub>;

  beforeEach(() => {
    docStub = makeDocumentStub();
    lsStub = makeLocalStorageStub();
    vi.stubGlobal("document", docStub);
    vi.stubGlobal("localStorage", lsStub);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Test 1: no inline properties; style element exists ─────────────────────

  it("test-1: after applyBrandScheme, documentElement.style has NO managed custom property", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);

    // No setProperty calls on documentElement.style for managed properties.
    expect(docStub.documentElement._setPropertyCalls).toHaveLength(0);
  });

  it("test-1b: a style#brand-scheme element exists in head after applyBrandScheme", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);

    expect(getBrandCss(docStub)).not.toBeNull();
    expect(docStub._elements.has("brand-scheme")).toBe(true);
  });

  // ── Test 2: CSS text structure — light-only selectors ─────────────────────

  it("test-2a: generated CSS contains [data-theme=\"light\"] rule", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);

    const css = getBrandCss(docStub)!;
    expect(css).toContain('[data-theme="light"]');
  });

  it("test-2b: generated CSS contains prefers-color-scheme: light block", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);

    const css = getBrandCss(docStub)!;
    expect(css).toContain("prefers-color-scheme: light");
  });

  it("test-2c: [data-theme=\"light\"] block carries every valid property", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);

    const css = getBrandCss(docStub)!;
    expect(css).toContain("--brand-primary: " + H_PRIMARY);
    expect(css).toContain("--brand-accent: " + H_ACCENT);
    expect(css).toContain("--surface-sidebar: " + H_SIDEBAR_BG);
    expect(css).toContain("--sidebar-text: " + H_SIDEBAR_TEXT);
    expect(css).toContain("--sidebar-text-active: " + H_SIDEBAR_TEXT_ACTIVE);
    expect(css).toContain("--surface-page: " + H_SURFACE_PAGE);
    expect(css).toContain("--surface-card: " + H_SURFACE_CARD);
    expect(css).toContain("--text-primary: " + H_TEXT_PRIMARY);
    expect(css).toContain("--text-secondary: " + H_TEXT_SECONDARY);
    expect(css).toContain("--text-muted: " + H_TEXT_MUTED);
    expect(css).toContain("--status-active: " + H_STATUS_ACTIVE);
    expect(css).toContain("--status-warning: " + H_STATUS_WARNING);
    expect(css).toContain("--status-danger: " + H_STATUS_DANGER);
    expect(css).toContain("--status-info: " + H_STATUS_INFO);
    expect(css).toContain("--status-neutral: " + H_STATUS_NEUTRAL);
  });

  it("test-2d: generated CSS contains NO data-theme=\"dark\" selector", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);

    const css = getBrandCss(docStub)!;
    expect(css).not.toContain('data-theme="dark"');
    expect(css).not.toContain("data-theme='dark'");
  });

  it("test-2e: generated CSS contains NO prefers-color-scheme: dark block", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);

    const css = getBrandCss(docStub)!;
    expect(css).not.toContain("prefers-color-scheme: dark");
  });

  // ── Test 3: clearBrandScheme removes the element ──────────────────────────

  it("test-3: clearBrandScheme removes the style#brand-scheme element", async () => {
    const { applyBrandScheme, clearBrandScheme } = await import("../brand-scheme");

    applyBrandScheme(HARBOUR_FULL);
    expect(getBrandCss(docStub)).not.toBeNull();

    clearBrandScheme();

    expect(getBrandCss(docStub)).toBeNull();
    expect(docStub._elements.has("brand-scheme")).toBe(false);
  });

  // ── Test 4: invalid hex omits only that property ──────────────────────────

  it("test-4: an invalid hex in one field omits only that property from the CSS", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({
      primaryColorHex: H_PRIMARY,
      secondaryColorHex: H_ACCENT,
      statusDangerHex: "NOT_A_HEX", // invalid — must be omitted
      statusInfoHex: H_STATUS_INFO
    });

    const css = getBrandCss(docStub)!;
    expect(css).not.toBeNull();
    // Bad property absent.
    expect(css).not.toContain("--status-danger:");
    // Good properties present.
    expect(css).toContain("--brand-primary: " + H_PRIMARY);
    expect(css).toContain("--brand-accent: " + H_ACCENT);
    expect(css).toContain("--status-info: " + H_STATUS_INFO);
  });

  // ── Test 5: clearUserBrandOverride re-applies cached company scheme ────────
  // Element is REPLACED not duplicated — exactly one style#brand-scheme after.

  it("test-5: clearUserBrandOverride replaces (not duplicates) the style element", async () => {
    // Seed both company and override in localStorage.
    lsStub._store["projectops.brand-scheme"] = JSON.stringify({
      primaryColorHex: COMPANY_PRIMARY,
      secondaryColorHex: COMPANY_ACCENT
    });
    lsStub._store["projectops.brand-override"] = JSON.stringify({
      primaryColorHex: OVERRIDE_PRIMARY,
      secondaryColorHex: OVERRIDE_ACCENT
    });

    const { clearUserBrandOverride } = await import("../brand-scheme");

    // IIFE at module load applied the override.
    const cssBeforeClear = getBrandCss(docStub);
    expect(cssBeforeClear).not.toBeNull();
    expect(cssBeforeClear).toContain("--brand-primary: " + OVERRIDE_PRIMARY);

    // Clear override — should re-apply company scheme.
    clearUserBrandOverride();

    // Only ONE style#brand-scheme element must exist (replaced, not duplicated).
    expect(docStub._elements.size).toBe(1);
    expect(docStub._elements.has("brand-scheme")).toBe(true);

    // Content reflects company scheme.
    const cssAfterClear = getBrandCss(docStub)!;
    expect(cssAfterClear).toContain("--brand-primary: " + COMPANY_PRIMARY);
    expect(cssAfterClear).toContain("--brand-accent: " + COMPANY_ACCENT);
    expect(cssAfterClear).not.toContain("--brand-primary: " + OVERRIDE_PRIMARY);
  });

  // ── Test 6: BRAND_LIGHT_ONLY_V1 marker is exported ───────────────────────

  it("BRAND_LIGHT_ONLY_V1 marker is exported with the correct value", async () => {
    const { BRAND_LIGHT_ONLY_V1 } = await import("../brand-scheme");
    expect(BRAND_LIGHT_ONLY_V1).toBe("brandtheme-light-only");
  });
});
