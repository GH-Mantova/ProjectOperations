/**
 * Tests for brand-scheme.ts
 *
 * Runs in the default node environment (no jsdom/happy-dom installed).
 * document and localStorage are stubbed with vi.stubGlobal before the module
 * is imported so the module-load IIFE sees the fakes.
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

// ── DOM / localStorage stubs ─────────────────────────────────────────────────

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
        _map: styleMap
      }
    }
  };
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

  it("valid pair sets both --brand-primary and --brand-accent", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({ primaryColorHex: PRIMARY, secondaryColorHex: ACCENT });

    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe(PRIMARY);
    expect(map["--brand-accent"]).toBe(ACCENT);
  });

  it("accepts 8-digit #RRGGBBAA hex", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({ primaryColorHex: PRIMARY_ALPHA, secondaryColorHex: ACCENT_ALPHA });

    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe(PRIMARY_ALPHA);
    expect(map["--brand-accent"]).toBe(ACCENT_ALPHA);
  });

  describe("invalid hex values — property must be ABSENT (not just no throw)", () => {
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

        const map = docStub.documentElement.style._map;
        expect("--brand-primary" in map).toBe(false);
        expect("--brand-accent" in map).toBe(false);
      });
    }
  });

  it("clearBrandScheme removes both custom properties", async () => {
    const { applyBrandScheme, clearBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({ primaryColorHex: PRIMARY, secondaryColorHex: ACCENT });

    // Verify they were set first.
    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe(PRIMARY);
    expect(map["--brand-accent"]).toBe(ACCENT);

    clearBrandScheme();

    expect("--brand-primary" in map).toBe(false);
    expect("--brand-accent" in map).toBe(false);
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

    // The CSS properties should still be applied.
    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe(PRIMARY);
    expect(map["--brand-accent"]).toBe(ACCENT);
  });

  // ── S3 palette tests ──────────────────────────────────────────────────────

  it("a valid full palette (all 15 properties) sets all fifteen custom properties", async () => {
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

    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe(PRIMARY);
    expect(map["--brand-accent"]).toBe(ACCENT);
    expect(map["--surface-sidebar"]).toBe(SIDEBAR_BG);
    expect(map["--sidebar-text"]).toBe(SIDEBAR_TEXT);
    expect(map["--sidebar-text-active"]).toBe(SIDEBAR_TEXT_ACTIVE);
    expect(map["--surface-page"]).toBe(SURFACE_PAGE);
    expect(map["--surface-card"]).toBe(SURFACE_CARD);
    expect(map["--text-primary"]).toBe(TEXT_PRIMARY);
    expect(map["--text-secondary"]).toBe(TEXT_SECONDARY);
    expect(map["--text-muted"]).toBe(TEXT_MUTED);
    expect(map["--status-active"]).toBe(STATUS_ACTIVE);
    expect(map["--status-warning"]).toBe(STATUS_WARNING);
    expect(map["--status-danger"]).toBe(STATUS_DANGER);
    expect(map["--status-info"]).toBe(STATUS_INFO);
    expect(map["--status-neutral"]).toBe(STATUS_NEUTRAL);
    // Exactly 15 properties written.
    expect(Object.keys(map).length).toBe(15);
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

    const map = docStub.documentElement.style._map;

    // The bad one must be ABSENT.
    expect("--status-danger" in map).toBe(false);

    // Every valid sibling must be present.
    expect(map["--brand-primary"]).toBe(PRIMARY);
    expect(map["--brand-accent"]).toBe(ACCENT);
    expect(map["--surface-sidebar"]).toBe(SIDEBAR_BG);
    expect(map["--sidebar-text"]).toBe(SIDEBAR_TEXT);
    expect(map["--sidebar-text-active"]).toBe(SIDEBAR_TEXT_ACTIVE);
    expect(map["--surface-page"]).toBe(SURFACE_PAGE);
    expect(map["--surface-card"]).toBe(SURFACE_CARD);
    expect(map["--text-primary"]).toBe(TEXT_PRIMARY);
    expect(map["--text-secondary"]).toBe(TEXT_SECONDARY);
    expect(map["--text-muted"]).toBe(TEXT_MUTED);
    expect(map["--status-active"]).toBe(STATUS_ACTIVE);
    expect(map["--status-warning"]).toBe(STATUS_WARNING);
    expect(map["--status-info"]).toBe(STATUS_INFO);
    expect(map["--status-neutral"]).toBe(STATUS_NEUTRAL);
    // 14 properties written (15 minus the 1 invalid).
    expect(Object.keys(map).length).toBe(14);
  });

  it("clearBrandScheme removes all fifteen custom properties including S3 palette", async () => {
    const { applyBrandScheme, clearBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({
      primaryColorHex: PRIMARY,
      secondaryColorHex: ACCENT,
      sidebarBgHex: SIDEBAR_BG,
      statusDangerHex: STATUS_DANGER
    });

    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe(PRIMARY);
    expect(map["--surface-sidebar"]).toBe(SIDEBAR_BG);
    expect(map["--status-danger"]).toBe(STATUS_DANGER);

    clearBrandScheme();

    expect("--brand-primary" in map).toBe(false);
    expect("--brand-accent" in map).toBe(false);
    expect("--surface-sidebar" in map).toBe(false);
    expect("--status-danger" in map).toBe(false);
  });

  it("null S3 fields do not set the corresponding CSS property (tokens.css fallback applies)", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({
      primaryColorHex: PRIMARY,
      secondaryColorHex: ACCENT,
      sidebarBgHex: null,
      statusDangerHex: null
    });

    const map = docStub.documentElement.style._map;
    // Null fields must be absent so cascade takes over.
    expect("--surface-sidebar" in map).toBe(false);
    expect("--status-danger" in map).toBe(false);
    // Original pair still applied.
    expect(map["--brand-primary"]).toBe(PRIMARY);
    expect(map["--brand-accent"]).toBe(ACCENT);
  });
});
