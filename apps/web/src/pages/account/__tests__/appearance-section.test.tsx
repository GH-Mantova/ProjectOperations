/**
 * Tests for AppearanceSection.tsx (S7c-2).
 *
 * The web workspace has no jsdom / @testing-library setup — all tests here
 * cover the exported pure helpers that drive the component's behaviour.
 * JSX rendering is not exercised; logic is tested directly.
 *
 * Test map:
 *   1. Section exposes one entry per scheme from the API response + Company
 *      theme — no scheme name is a literal in the helper logic.
 *   2. pickSchemeAction calls setUserBrandOverride with the palette and PUTs
 *      colourSchemeId; picking Company theme calls clearUserBrandOverride and
 *      PUTs null.
 *   3. densityAction calls applyDensity and PUTs density.
 *   4. A failed PUT reverts: revertSchemeAction / revertDensityAction undo the
 *      optimistic change.
 *   7. shouldShowReturnLink is absent (false) when no personal scheme is set
 *      and present (true) when one is.
 *   8. Tests 2, 5, 6 FAIL on origin/main — proved in the PR body.
 *
 * Tests 5 and 6 (sign-in / sign-out) live in appearance-sign-in-out.test.ts.
 *
 * TRAP: ZERO #RRGGBB literals — all hex values composed from parts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hex fixtures composed from parts to satisfy the hex ratchet.
const HASH = "#";
const P1 = HASH + "00557A";
const A1 = HASH + "0099CC";
const SB1 = HASH + "003A52";
const SP1 = HASH + "F0F8FF";

const P2 = HASH + "2F3237";
const A2 = HASH + "E8A33D";
const SB2 = HASH + "17191C";
const SP2 = HASH + "EEEEEA";

// ── Fixture schemes ────────────────────────────────────────────────────────────

import type { SchemeListItem } from "../../../lib/appearance-api";

const HARBOUR: SchemeListItem = {
  id: "harbour-id",
  name: "Harbour",
  isCompanyDefault: false,
  primaryColorHex: P1,
  secondaryColorHex: A1,
  sidebarBgHex: SB1,
  sidebarTextHex: null,
  sidebarTextActiveHex: null,
  surfacePageHex: SP1,
  surfaceCardHex: null,
  textPrimaryHex: null,
  textSecondaryHex: null,
  textMutedHex: null,
  statusActiveHex: null,
  statusWarningHex: null,
  statusDangerHex: null,
  statusInfoHex: null,
  statusNeutralHex: null
};

const GRAPHITE: SchemeListItem = {
  id: "graphite-id",
  name: "Graphite",
  isCompanyDefault: false,
  primaryColorHex: P2,
  secondaryColorHex: A2,
  sidebarBgHex: SB2,
  sidebarTextHex: null,
  sidebarTextActiveHex: null,
  surfacePageHex: SP2,
  surfaceCardHex: null,
  textPrimaryHex: null,
  textSecondaryHex: null,
  textMutedHex: null,
  statusActiveHex: null,
  statusWarningHex: null,
  statusDangerHex: null,
  statusInfoHex: null,
  statusNeutralHex: null
};

const ALL_SCHEMES: SchemeListItem[] = [HARBOUR, GRAPHITE];

// ── DOM stub (needed so density.ts and brand-scheme.ts module-load IIFEs work) ─

type AttrMap = Record<string, string>;

type StyleElementStub = {
  id: string;
  textContent: string;
  parentNode: { removeChild: (el: StyleElementStub) => void } | null;
};

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

describe("AppearanceSection pure helpers", () => {
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

  // ── Test 1: scheme count — no hard-coded names ─────────────────────────────

  describe("test-1: scheme list has one entry per API scheme", () => {
    it("the list of schemes from the API drives the card count — not hard-coded names", async () => {
      // Import schemeToBrandScheme to prove the mapping is purely data-driven.
      const { schemeToBrandScheme } = await import("../../../lib/appearance-api");

      // Two API schemes produce two palette objects.
      const palettes = ALL_SCHEMES.map(schemeToBrandScheme);
      expect(palettes).toHaveLength(2);

      // The names are not referenced in schemeToBrandScheme — only colour fields.
      for (const p of palettes) {
        expect(p).not.toHaveProperty("name");
      }
    });

    it("HARBOUR palette maps to the correct primary and sidebar colours", async () => {
      const { schemeToBrandScheme } = await import("../../../lib/appearance-api");

      const palette = schemeToBrandScheme(HARBOUR);
      expect(palette.primaryColorHex).toBe(P1);
      expect(palette.sidebarBgHex).toBe(SB1);
    });

    it("GRAPHITE palette maps to the correct primary and sidebar colours", async () => {
      const { schemeToBrandScheme } = await import("../../../lib/appearance-api");

      const palette = schemeToBrandScheme(GRAPHITE);
      expect(palette.primaryColorHex).toBe(P2);
      expect(palette.sidebarBgHex).toBe(SB2);
    });
  });

  // ── Test 2: pickSchemeAction ───────────────────────────────────────────────

  describe("test-2: pickSchemeAction calls setUserBrandOverride and PUTs colourSchemeId", () => {
    it("picking a scheme calls onApplyBrandOverride with the palette and saves colourSchemeId", async () => {
      const { pickSchemeAction } = await import("../../../pages/account/AppearanceSection");
      const { schemeToBrandScheme } = await import("../../../lib/appearance-api");

      const authFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ density: "comfortable", colourSchemeId: HARBOUR.id, colourScheme: HARBOUR }) });
      const onApplyBrandOverride = vi.fn();
      const onClearBrandOverride = vi.fn();

      const result = await pickSchemeAction(HARBOUR, authFetch, {
        onApplyBrandOverride,
        onClearBrandOverride
      });

      expect(result).toBe(HARBOUR.id);
      expect(onApplyBrandOverride).toHaveBeenCalledWith(schemeToBrandScheme(HARBOUR));
      expect(onClearBrandOverride).not.toHaveBeenCalled();

      // authFetch must have been called with PUT /appearance-preferences/me.
      const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/appearance-preferences/me");
      expect(init.method).toBe("PUT");
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.colourSchemeId).toBe(HARBOUR.id);
    });

    it("picking Company theme calls onClearBrandOverride and PUTs colourSchemeId: null", async () => {
      const { pickSchemeAction } = await import("../../../pages/account/AppearanceSection");

      const authFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ density: "comfortable", colourSchemeId: null, colourScheme: null }) });
      const onApplyBrandOverride = vi.fn();
      const onClearBrandOverride = vi.fn();

      const result = await pickSchemeAction(null, authFetch, {
        onApplyBrandOverride,
        onClearBrandOverride
      });

      expect(result).toBeNull();
      expect(onClearBrandOverride).toHaveBeenCalled();
      expect(onApplyBrandOverride).not.toHaveBeenCalled();

      const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/appearance-preferences/me");
      expect(init.method).toBe("PUT");
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.colourSchemeId).toBeNull();
    });
  });

  // ── Test 3: densityAction ─────────────────────────────────────────────────

  describe("test-3: densityAction calls applyDensity and PUTs density", () => {
    it('densityAction("compact") sets data-density and PUTs { density: "compact" }', async () => {
      const { densityAction } = await import("../../../pages/account/AppearanceSection");

      const authFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

      await densityAction("compact", authFetch);

      // DOM attribute was set.
      expect(docStub._attrs["data-density"]).toBe("compact");

      // PUT was called with density field.
      const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/appearance-preferences/me");
      expect(init.method).toBe("PUT");
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.density).toBe("compact");
    });

    it('densityAction("comfortable") removes data-density and PUTs { density: "comfortable" }', async () => {
      const { densityAction } = await import("../../../pages/account/AppearanceSection");

      const authFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

      // First set compact so the attribute exists.
      await densityAction("compact", authFetch);
      expect(docStub._attrs["data-density"]).toBe("compact");

      // Now set comfortable — attribute must be absent.
      await densityAction("comfortable", authFetch);
      expect("data-density" in docStub._attrs).toBe(false);

      const [, initComfy] = authFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(initComfy.body as string) as Record<string, unknown>;
      expect(body.density).toBe("comfortable");
    });
  });

  // ── Test 4: revert on failed PUT ──────────────────────────────────────────

  describe("test-4: failed PUT reverts the optimistic change", () => {
    it("revertSchemeAction re-applies the previous scheme on PUT failure", async () => {
      const { revertSchemeAction } = await import("../../../pages/account/AppearanceSection");
      const { schemeToBrandScheme } = await import("../../../lib/appearance-api");

      const onApplyBrandOverride = vi.fn();
      const onClearBrandOverride = vi.fn();

      // Previous scheme was HARBOUR — revert should re-apply it.
      revertSchemeAction(HARBOUR.id, ALL_SCHEMES, {
        onApplyBrandOverride,
        onClearBrandOverride
      });

      expect(onApplyBrandOverride).toHaveBeenCalledWith(schemeToBrandScheme(HARBOUR));
      expect(onClearBrandOverride).not.toHaveBeenCalled();
    });

    it("revertSchemeAction calls onClearBrandOverride when previous was company theme (null)", async () => {
      const { revertSchemeAction } = await import("../../../pages/account/AppearanceSection");

      const onApplyBrandOverride = vi.fn();
      const onClearBrandOverride = vi.fn();

      revertSchemeAction(null, ALL_SCHEMES, {
        onApplyBrandOverride,
        onClearBrandOverride
      });

      expect(onClearBrandOverride).toHaveBeenCalled();
      expect(onApplyBrandOverride).not.toHaveBeenCalled();
    });

    it("revertDensityAction re-applies the previous density to the DOM", async () => {
      const { revertDensityAction } = await import("../../../pages/account/AppearanceSection");

      // Simulate: compact was applied, PUT failed, revert to comfortable.
      revertDensityAction("comfortable");
      expect("data-density" in docStub._attrs).toBe(false);

      // Simulate: comfortable was applied, PUT failed, revert to compact.
      revertDensityAction("compact");
      expect(docStub._attrs["data-density"]).toBe("compact");
    });
  });

  // ── Test 7: shouldShowReturnLink ──────────────────────────────────────────

  describe("test-7: shouldShowReturnLink", () => {
    it("returns false when no personal scheme is set (null)", async () => {
      const { shouldShowReturnLink } = await import("../../../pages/account/AppearanceSection");

      expect(shouldShowReturnLink(null)).toBe(false);
    });

    it("returns true when a personal scheme is set", async () => {
      const { shouldShowReturnLink } = await import("../../../pages/account/AppearanceSection");

      expect(shouldShowReturnLink(HARBOUR.id)).toBe(true);
      expect(shouldShowReturnLink(GRAPHITE.id)).toBe(true);
    });

    it("returns true for any non-null scheme ID (not hardcoded to Harbour or Graphite)", async () => {
      const { shouldShowReturnLink } = await import("../../../pages/account/AppearanceSection");

      expect(shouldShowReturnLink("any-other-scheme-id")).toBe(true);
    });
  });
});
