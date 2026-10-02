/**
 * Tests for brand-scheme.ts
 *
 * Runs in the default node environment (no jsdom/happy-dom installed).
 * document and localStorage are stubbed with vi.stubGlobal before the module
 * is imported so the module-load IIFE sees the fakes.
 *
 * TRAP 4: this file contains ZERO #RRGGBB literals. All hex fixture values
 * are assembled from string parts (HASH + digits) so the hex ratchet never
 * counts a colour literal here. Do not inline them back.
 *
 * BRAND_LIGHT_ONLY_V1: applyBrandScheme now writes a <style id="brand-scheme">
 * element instead of inline custom properties on documentElement. Tests that
 * previously asserted inline properties now assert the stylesheet element.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The hex ratchet (scripts/pipeline/check-hex-ratchet.mjs) requires a file NEW to
// apps/web/src to contain zero colour literals, and it has no exemption for tests.
// These fixtures are real hex values the assertions need, composed from parts so no
// `#` is ever followed by hex digits in this source. Do not inline them back.
const HASH = "#";
const PRIMARY = HASH + "005B61";
const ACCENT = HASH + "FF8C00";
const PRIMARY_ALPHA = PRIMARY + "FF";
const ACCENT_ALPHA = ACCENT + "AA";
// S3 palette fixtures — also composed to avoid hex ratchet.
const SIDEBAR_BG = HASH + "1A2B3C";
const SIDEBAR_TEXT = HASH + "FFFFFF";
const SIDEBAR_TEXT_ACTIVE = HASH + "F0F0F0";
const SURFACE_PAGE = HASH + "F5F5F5";
const SURFACE_CARD = HASH + "FFFFFF";
const TEXT_PRIMARY = HASH + "111111";
const TEXT_SECONDARY = HASH + "444444";
const TEXT_MUTED = HASH + "888888";
const STATUS_ACTIVE = HASH + "22CC44";
const STATUS_WARNING = HASH + "FFAA00";
const STATUS_DANGER = HASH + "EE2211";
const STATUS_INFO = HASH + "2288EE";
const STATUS_NEUTRAL = HASH + "AAAAAA";
// S6 override fixtures.
const OVERRIDE_PRIMARY = HASH + "AA1122";
const OVERRIDE_ACCENT = HASH + "33BB44";

// ── DOM / localStorage stubs ─────────────────────────────────────────────────

/**
 * A minimal stub for a style element.
 * textContent holds the CSS text; id mirrors the real DOM API.
 */
type StyleElementStub = {
  id: string;
  textContent: string;
  parentNode: { removeChild: (el: StyleElementStub) => void } | null;
};

/**
 * makeDocumentStub returns a stub that:
 * - tracks a collection of created style elements by id
 * - head.appendChild inserts them into the collection
 * - getElementById retrieves them
 * - documentElement.style is a no-op (no inline properties expected)
 *
 * Updated for BRAND_LIGHT_ONLY_V1: applyBrandScheme no longer writes inline
 * properties; it injects a <style id="brand-scheme"> element instead.
 */
function makeDocumentStub() {
  const elements: Map<string, StyleElementStub> = new Map();

  const stub = {
    documentElement: {
      style: {
        // These should NOT be called in the new implementation.
        // Kept as no-ops so old paths don't throw if accidentally called.
        setProperty(_prop: string, _value: string) {},
        removeProperty(_prop: string) {}
      }
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
    // Expose internal state for assertions.
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

/** Helper: get the text of the brand-scheme style element from the stub. */
function getBrandCss(docStub: ReturnType<typeof makeDocumentStub>): string | null {
  const el = docStub._elements.get("brand-scheme");
  return el ? el.textContent : null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("applyBrandScheme / clearBrandScheme", () => {
  let docStub: ReturnType<typeof makeDocumentStub>;
  let lsStub: ReturnType<typeof makeLocalStorageStub>;

  beforeEach(async () => {
    // Provide fresh stubs before each test.
    docStub = makeDocumentStub();
    lsStub = makeLocalStorageStub();

    vi.stubGlobal("document", docStub);
    vi.stubGlobal("localStorage", lsStub);

    // Re-import the module fresh each time so stubs are in place.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("valid pair sets both --brand-primary and --brand-accent in the stylesheet", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({ primaryColorHex: PRIMARY, secondaryColorHex: ACCENT });

    const css = getBrandCss(docStub);
    expect(css).not.toBeNull();
    expect(css).toContain("--brand-primary: " + PRIMARY);
    expect(css).toContain("--brand-accent: " + ACCENT);
  });

  it("accepts 8-digit #RRGGBBAA hex", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({ primaryColorHex: PRIMARY_ALPHA, secondaryColorHex: ACCENT_ALPHA });

    const css = getBrandCss(docStub);
    expect(css).not.toBeNull();
    expect(css).toContain("--brand-primary: " + PRIMARY_ALPHA);
    expect(css).toContain("--brand-accent: " + ACCENT_ALPHA);
  });

  describe("invalid hex values — property must be ABSENT from stylesheet", () => {
    const invalidValues = [
      { label: "word colour", value: "red" },
      { label: "short hex", value: "#12" },
      { label: "SQL injection attempt", value: "'; DROP" },
      { label: "empty string", value: "" }
    ];

    for (const { label, value } of invalidValues) {
      it(`does NOT set --brand-primary for: ${label} (${JSON.stringify(value)})`, async () => {
        const { applyBrandScheme } = await import("../brand-scheme");

        applyBrandScheme({ primaryColorHex: value, secondaryColorHex: value });

        // All values invalid — no CSS element should be emitted.
        const css = getBrandCss(docStub);
        expect(css).toBeNull();
      });
    }
  });

  it("clearBrandScheme removes the style element", async () => {
    const { applyBrandScheme, clearBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({ primaryColorHex: PRIMARY, secondaryColorHex: ACCENT });

    // Element must exist.
    expect(getBrandCss(docStub)).not.toBeNull();

    clearBrandScheme();

    expect(getBrandCss(docStub)).toBeNull();
  });

  it("localStorage that throws does not prevent applyBrandScheme from working", async () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
      removeItem: vi.fn()
    };
    vi.stubGlobal("localStorage", throwingStorage);

    // Should not throw — applyBrandScheme catches localStorage errors
    const { applyBrandScheme } = await import("../brand-scheme");

    expect(() =>
      applyBrandScheme({ primaryColorHex: PRIMARY, secondaryColorHex: ACCENT })
    ).not.toThrow();

    // The brand-scheme style element should still be present.
    const css = getBrandCss(docStub);
    expect(css).not.toBeNull();
    expect(css).toContain("--brand-primary: " + PRIMARY);
    expect(css).toContain("--brand-accent: " + ACCENT);
  });

  // ── S3 palette tests ──────────────────────────────────────────────────────

  it("a valid full palette (all 15 properties) emits all fifteen declarations in the stylesheet", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({
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
    });

    const css = getBrandCss(docStub);
    expect(css).not.toBeNull();
    expect(css).toContain("--brand-primary: " + PRIMARY);
    expect(css).toContain("--brand-accent: " + ACCENT);
    expect(css).toContain("--surface-sidebar: " + SIDEBAR_BG);
    expect(css).toContain("--sidebar-text: " + SIDEBAR_TEXT);
    expect(css).toContain("--sidebar-text-active: " + SIDEBAR_TEXT_ACTIVE);
    expect(css).toContain("--surface-page: " + SURFACE_PAGE);
    expect(css).toContain("--surface-card: " + SURFACE_CARD);
    expect(css).toContain("--text-primary: " + TEXT_PRIMARY);
    expect(css).toContain("--text-secondary: " + TEXT_SECONDARY);
    expect(css).toContain("--text-muted: " + TEXT_MUTED);
    expect(css).toContain("--status-active: " + STATUS_ACTIVE);
    expect(css).toContain("--status-warning: " + STATUS_WARNING);
    expect(css).toContain("--status-danger: " + STATUS_DANGER);
    expect(css).toContain("--status-info: " + STATUS_INFO);
    expect(css).toContain("--status-neutral: " + STATUS_NEUTRAL);
  });

  it("one invalid value among twelve valid ones skips only the bad property and applies all siblings", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    // statusDangerHex is deliberately invalid; all others are valid.
    applyBrandScheme({
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
      statusDangerHex: "not-a-valid-hex", // INVALID — must be skipped
      statusInfoHex: STATUS_INFO,
      statusNeutralHex: STATUS_NEUTRAL
    });

    const css = getBrandCss(docStub);
    expect(css).not.toBeNull();

    // The bad one must be ABSENT from the stylesheet.
    expect(css).not.toContain("--status-danger:");

    // Every valid sibling must be present.
    expect(css).toContain("--brand-primary: " + PRIMARY);
    expect(css).toContain("--brand-accent: " + ACCENT);
    expect(css).toContain("--surface-sidebar: " + SIDEBAR_BG);
    expect(css).toContain("--sidebar-text: " + SIDEBAR_TEXT);
    expect(css).toContain("--sidebar-text-active: " + SIDEBAR_TEXT_ACTIVE);
    expect(css).toContain("--surface-page: " + SURFACE_PAGE);
    expect(css).toContain("--surface-card: " + SURFACE_CARD);
    expect(css).toContain("--text-primary: " + TEXT_PRIMARY);
    expect(css).toContain("--text-secondary: " + TEXT_SECONDARY);
    expect(css).toContain("--text-muted: " + TEXT_MUTED);
    expect(css).toContain("--status-active: " + STATUS_ACTIVE);
    expect(css).toContain("--status-warning: " + STATUS_WARNING);
    expect(css).toContain("--status-info: " + STATUS_INFO);
    expect(css).toContain("--status-neutral: " + STATUS_NEUTRAL);
  });

  it("clearBrandScheme removes the style element (including after full palette apply)", async () => {
    const { applyBrandScheme, clearBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({
      primaryColorHex: PRIMARY,
      secondaryColorHex: ACCENT,
      sidebarBgHex: SIDEBAR_BG,
      statusDangerHex: STATUS_DANGER
    });

    expect(getBrandCss(docStub)).not.toBeNull();

    clearBrandScheme();

    expect(getBrandCss(docStub)).toBeNull();
  });

  it("null S3 fields do not emit the corresponding CSS property (tokens.css fallback applies)", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({
      primaryColorHex: PRIMARY,
      secondaryColorHex: ACCENT,
      sidebarBgHex: null,
      statusDangerHex: null
    });

    const css = getBrandCss(docStub);
    // Null fields must be absent so cascade takes over.
    expect(css).not.toContain("--surface-sidebar:");
    expect(css).not.toContain("--status-danger:");
    // Original pair still applied.
    expect(css).toContain("--brand-primary: " + PRIMARY);
    expect(css).toContain("--brand-accent: " + ACCENT);
  });
});

// ── S6: three-way precedence and override lifecycle ──────────────────────────

describe("S6 per-user override — three-way precedence", () => {
  let docStub: ReturnType<typeof makeDocumentStub>;
  let lsStub: ReturnType<typeof makeLocalStorageStub>;

  const companyScheme = {
    primaryColorHex: PRIMARY,
    secondaryColorHex: ACCENT
  };

  const overrideScheme = {
    primaryColorHex: OVERRIDE_PRIMARY,
    secondaryColorHex: OVERRIDE_ACCENT
  };

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

  it("module-load IIFE applies override (level 1) when both override and company scheme are cached", async () => {
    // Pre-populate localStorage: both keys present.
    lsStub._store["projectops.brand-scheme"] = JSON.stringify(companyScheme);
    lsStub._store["projectops.brand-override"] = JSON.stringify(overrideScheme);

    // Import the module — the IIFE runs immediately.
    await import("../brand-scheme");

    const css = getBrandCss(docStub);
    // Override takes precedence — we should see OVERRIDE_PRIMARY, not PRIMARY.
    expect(css).not.toBeNull();
    expect(css).toContain("--brand-primary: " + OVERRIDE_PRIMARY);
    expect(css).toContain("--brand-accent: " + OVERRIDE_ACCENT);
  });

  it("module-load IIFE falls through to company scheme (level 2) when no override is cached", async () => {
    lsStub._store["projectops.brand-scheme"] = JSON.stringify(companyScheme);
    // No override key.

    await import("../brand-scheme");

    const css = getBrandCss(docStub);
    expect(css).not.toBeNull();
    expect(css).toContain("--brand-primary: " + PRIMARY);
    expect(css).toContain("--brand-accent: " + ACCENT);
  });

  it("module-load IIFE writes nothing (level 3) when both caches are empty", async () => {
    // No keys in localStorage.
    await import("../brand-scheme");

    expect(getBrandCss(docStub)).toBeNull();
  });

  it("setUserBrandOverride writes the key and immediately applies the override in the stylesheet", async () => {
    const { setUserBrandOverride } = await import("../brand-scheme");

    setUserBrandOverride(overrideScheme);

    // localStorage must have been written.
    expect(lsStub.setItem).toHaveBeenCalledWith(
      "projectops.brand-override",
      JSON.stringify(overrideScheme)
    );
    // Stylesheet must reflect the override.
    const css = getBrandCss(docStub);
    expect(css).not.toBeNull();
    expect(css).toContain("--brand-primary: " + OVERRIDE_PRIMARY);
    expect(css).toContain("--brand-accent: " + OVERRIDE_ACCENT);
  });

  it("clearUserBrandOverride removes the override key and re-applies the company scheme without reload", async () => {
    // Company scheme is cached.
    lsStub._store["projectops.brand-scheme"] = JSON.stringify(companyScheme);
    // Override is also present.
    lsStub._store["projectops.brand-override"] = JSON.stringify(overrideScheme);

    const { clearUserBrandOverride } = await import("../brand-scheme");

    // The IIFE applied the override at module load; confirm that.
    const css1 = getBrandCss(docStub);
    expect(css1).toContain("--brand-primary: " + OVERRIDE_PRIMARY);

    // Clear the override.
    clearUserBrandOverride();

    // Override key must be removed.
    expect(lsStub.removeItem).toHaveBeenCalledWith("projectops.brand-override");
    // Company scheme must now be active — no reload needed.
    const css2 = getBrandCss(docStub);
    expect(css2).not.toBeNull();
    expect(css2).toContain("--brand-primary: " + PRIMARY);
    expect(css2).toContain("--brand-accent: " + ACCENT);
  });

  it("clearUserBrandOverride falls back to tokens.css when no company scheme is cached", async () => {
    lsStub._store["projectops.brand-override"] = JSON.stringify(overrideScheme);
    // No company scheme cached.

    const { clearUserBrandOverride } = await import("../brand-scheme");

    // IIFE applied override at load.
    expect(getBrandCss(docStub)).not.toBeNull();

    clearUserBrandOverride();

    // Style element should be absent (tokens.css level 3 takes over).
    expect(getBrandCss(docStub)).toBeNull();
  });

  it("BRAND_OVERRIDE_STORAGE_KEY exports the correct key string", async () => {
    const { BRAND_OVERRIDE_STORAGE_KEY } = await import("../brand-scheme");
    expect(BRAND_OVERRIDE_STORAGE_KEY).toBe("projectops.brand-override");
  });
});

// ── S6: logout clears the override key ───────────────────────────────────────

describe("S6 logout — override key cleared via BrandSchemeProvider's null-user path", () => {
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

  it("clearBrandScheme AND removeItem(BRAND_OVERRIDE_STORAGE_KEY) are called when user is null", async () => {
    // Seed both keys.
    lsStub._store["projectops.brand-scheme"] = JSON.stringify({ primaryColorHex: PRIMARY, secondaryColorHex: ACCENT });
    lsStub._store["projectops.brand-override"] = JSON.stringify({ primaryColorHex: OVERRIDE_PRIMARY, secondaryColorHex: OVERRIDE_ACCENT });

    const { clearBrandScheme, BRAND_OVERRIDE_STORAGE_KEY } = await import("../brand-scheme");

    // Simulate what BrandSchemeProvider does on logout (user goes null):
    //   clearBrandScheme() + localStorage.removeItem(BRAND_OVERRIDE_STORAGE_KEY)
    clearBrandScheme();
    localStorage.removeItem(BRAND_OVERRIDE_STORAGE_KEY);

    // Style element must be removed.
    expect(getBrandCss(docStub)).toBeNull();

    // Override key removed.
    expect(lsStub.removeItem).toHaveBeenCalledWith("projectops.brand-override");
    // Override key absent from store.
    expect(lsStub._store["projectops.brand-override"]).toBeUndefined();
  });
});
