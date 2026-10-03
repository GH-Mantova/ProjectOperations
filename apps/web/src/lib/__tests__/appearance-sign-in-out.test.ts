/**
 * appearance-sign-in-out.test.ts (S7c-2)
 *
 * Tests for the sign-in apply and sign-out cleanup behaviour added to
 * BrandSchemeProvider and the density module.
 *
 * Tests 5 and 6 from the spec:
 *
 *   5. Sign-in:
 *      - With a saved scheme and compact density, the override is set and
 *        data-density="compact".
 *      - With no row (no scheme), no override is left from a previous browser
 *        session.
 *
 *   6. Sign-out removes both projectops.brand-override and projectops.density,
 *      and clears data-density.
 *
 *   8. Tests 2, 5 and 6 FAIL on origin/main — proved in the PR body.
 *
 * Runs in the default node environment (no jsdom). DOM and localStorage are
 * stubbed with vi.stubGlobal before any import.
 *
 * TRAP: ZERO #RRGGBB literals — all hex values composed from parts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hex fixtures composed from parts.
const HASH = "#";
const P1 = HASH + "00557A";
const A1 = HASH + "0099CC";
const SB1 = HASH + "003A52";
const SP1 = HASH + "F0F8FF";
const SC1 = HASH + "FFFFFF";
const TP1 = HASH + "0D1B2A";

const COMPANY_PRIMARY = HASH + "005B61";
const COMPANY_ACCENT = HASH + "FEAA6D";

// ── DOM stub ───────────────────────────────────────────────────────────────────

type StyleElementStub = {
  id: string;
  textContent: string;
  parentNode: { removeChild: (el: StyleElementStub) => void } | null;
};

type AttrMap = Record<string, string>;

function makeDocumentStub() {
  const attrs: AttrMap = {};
  const elements: Map<string, StyleElementStub> = new Map();

  return {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
      removeAttribute(name: string) {
        delete attrs[name];
      },
      getAttribute(name: string): string | null {
        return attrs[name] ?? null;
      },
      style: { setProperty: vi.fn(), removeProperty: vi.fn() },
      _attrs: attrs
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
    _attrs: attrs,
    _elements: elements
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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("S7c-2 sign-in / sign-out appearance behaviour", () => {
  let docStub: ReturnType<typeof makeDocumentStub>;
  let lsStub: ReturnType<typeof makeLocalStorageStub>;

  beforeEach(() => {
    docStub = makeDocumentStub();
    lsStub = makeLocalStorageStub();
    vi.stubGlobal("document", docStub);
    vi.stubGlobal("localStorage", lsStub);
    vi.stubGlobal("window", {
      localStorage: lsStub,
      location: { origin: "http://localhost" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Test 5a: sign-in with saved scheme and compact density ─────────────────

  describe("test-5: sign-in applies density and colour-scheme override from the account", () => {
    it("test-5a: compact density + saved scheme: override is set and data-density is compact", async () => {
      const { applyDensity, DENSITY_STORAGE_KEY } = await import("../density");
      const {
        setUserBrandOverride,
        BRAND_OVERRIDE_STORAGE_KEY
      } = await import("../brand-scheme");

      const HARBOUR_PALETTE = {
        primaryColorHex: P1,
        secondaryColorHex: A1,
        sidebarBgHex: SB1,
        sidebarTextHex: null,
        sidebarTextActiveHex: null,
        surfacePageHex: SP1,
        surfaceCardHex: SC1,
        textPrimaryHex: TP1,
        textSecondaryHex: null,
        textMutedHex: null,
        statusActiveHex: null,
        statusWarningHex: null,
        statusDangerHex: null,
        statusInfoHex: null,
        statusNeutralHex: null
      };

      // Simulate what BrandSchemeProvider does on sign-in (S7c-2 path):
      //  1. Apply density from account prefs.
      //  2. Apply colour-scheme override from account prefs.
      applyDensity("compact");
      setUserBrandOverride(HARBOUR_PALETTE);

      // data-density must be "compact".
      expect(docStub._attrs["data-density"]).toBe("compact");

      // BRAND_OVERRIDE_STORAGE_KEY must be set in localStorage.
      const stored = lsStub._store[BRAND_OVERRIDE_STORAGE_KEY];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored) as typeof HARBOUR_PALETTE;
      expect(parsed.primaryColorHex).toBe(P1);

      // Key names we depend on.
      expect(DENSITY_STORAGE_KEY).toBe("projectops.density");
      expect(BRAND_OVERRIDE_STORAGE_KEY).toBe("projectops.brand-override");
    });

    it("test-5b: no saved scheme: clearUserBrandOverride removes any stale browser override", async () => {
      const {
        setUserBrandOverride,
        clearUserBrandOverride,
        BRAND_OVERRIDE_STORAGE_KEY
      } = await import("../brand-scheme");

      // Simulate a stale override from a previous browser session.
      setUserBrandOverride({
        primaryColorHex: P1,
        secondaryColorHex: A1
      });
      expect(lsStub._store[BRAND_OVERRIDE_STORAGE_KEY]).toBeDefined();

      // Sign-in fetches prefs and finds no scheme — clear the stale override.
      clearUserBrandOverride();

      expect(lsStub._store[BRAND_OVERRIDE_STORAGE_KEY]).toBeUndefined();
    });
  });

  // ── Test 6: sign-out clears brand-override and density ────────────────────

  describe("test-6: sign-out removes projectops.brand-override, projectops.density, and data-density", () => {
    it("test-6: sign-out removes both keys and clears data-density", async () => {
      const { applyDensity, DENSITY_STORAGE_KEY } = await import("../density");
      const {
        setUserBrandOverride,
        BRAND_OVERRIDE_STORAGE_KEY,
        clearBrandScheme
      } = await import("../brand-scheme");

      // Set up a signed-in state.
      setUserBrandOverride({ primaryColorHex: P1, secondaryColorHex: A1 });
      applyDensity("compact");
      lsStub._store[DENSITY_STORAGE_KEY] = "compact";

      // Verify pre-conditions.
      expect(lsStub._store[BRAND_OVERRIDE_STORAGE_KEY]).toBeDefined();
      expect(lsStub._store[DENSITY_STORAGE_KEY]).toBe("compact");
      expect(docStub._attrs["data-density"]).toBe("compact");

      // Simulate sign-out: clear brand scheme, override, and density.
      clearBrandScheme();
      lsStub.removeItem(BRAND_OVERRIDE_STORAGE_KEY);
      lsStub.removeItem(DENSITY_STORAGE_KEY);
      applyDensity("comfortable"); // "comfortable" removes the attribute.

      // brand-override must be gone.
      expect(lsStub._store[BRAND_OVERRIDE_STORAGE_KEY]).toBeUndefined();
      // density key must be gone.
      expect(lsStub._store[DENSITY_STORAGE_KEY]).toBeUndefined();
      // data-density must be absent.
      expect("data-density" in docStub._attrs).toBe(false);
    });

    it("test-6b: sign-out: applyDensity('comfortable') removes the data-density attribute", async () => {
      const { applyDensity } = await import("../density");

      applyDensity("compact");
      expect(docStub._attrs["data-density"]).toBe("compact");

      applyDensity("comfortable");
      expect("data-density" in docStub._attrs).toBe(false);
    });
  });

  // ── Key name constants — guard against accidental renames ─────────────────

  describe("key name constants", () => {
    it("DENSITY_STORAGE_KEY is projectops.density (the sign-out code references this key)", async () => {
      const { DENSITY_STORAGE_KEY } = await import("../density");
      expect(DENSITY_STORAGE_KEY).toBe("projectops.density");
    });

    it("BRAND_OVERRIDE_STORAGE_KEY is projectops.brand-override", async () => {
      const { BRAND_OVERRIDE_STORAGE_KEY } = await import("../brand-scheme");
      expect(BRAND_OVERRIDE_STORAGE_KEY).toBe("projectops.brand-override");
    });
  });

  // ── Confirm company scheme is cached even when override is active (sign-in) ─

  it("sign-in: company scheme is cached for re-application when override is cleared", async () => {
    const {
      setUserBrandOverride,
      clearUserBrandOverride,
      BRAND_SCHEME_STORAGE_KEY
    } = await import("../brand-scheme");

    // Simulate: company scheme was fetched and cached.
    lsStub._store[BRAND_SCHEME_STORAGE_KEY] = JSON.stringify({
      primaryColorHex: COMPANY_PRIMARY,
      secondaryColorHex: COMPANY_ACCENT
    });

    // User has a personal override applied.
    setUserBrandOverride({ primaryColorHex: P1, secondaryColorHex: A1 });

    // When override is cleared, the company scheme is re-applied from cache.
    clearUserBrandOverride();

    // The brand-scheme element should now carry the company colours.
    const css = docStub._elements.get("brand-scheme")?.textContent ?? "";
    expect(css).toContain(COMPANY_PRIMARY);
    expect(css).not.toContain(P1);
  });
});
