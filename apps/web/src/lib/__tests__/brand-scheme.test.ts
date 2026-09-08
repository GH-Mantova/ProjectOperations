/**
 * Tests for brand-scheme.ts
 *
 * Runs in the default node environment (no jsdom/happy-dom installed).
 * document and localStorage are stubbed with vi.stubGlobal before the module
 * is imported so the module-load IIFE sees the fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    applyBrandScheme({ primaryColorHex: "#005B61", secondaryColorHex: "#FF8C00" });

    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe("#005B61");
    expect(map["--brand-accent"]).toBe("#FF8C00");
  });

  it("accepts 8-digit #RRGGBBAA hex", async () => {
    const { applyBrandScheme } = await import("../brand-scheme");

    applyBrandScheme({ primaryColorHex: "#005B61FF", secondaryColorHex: "#FF8C00AA" });

    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe("#005B61FF");
    expect(map["--brand-accent"]).toBe("#FF8C00AA");
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

    applyBrandScheme({ primaryColorHex: "#005B61", secondaryColorHex: "#FF8C00" });

    // Verify they were set first.
    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe("#005B61");
    expect(map["--brand-accent"]).toBe("#FF8C00");

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
      applyBrandScheme({ primaryColorHex: "#005B61", secondaryColorHex: "#FF8C00" })
    ).not.toThrow();

    // The CSS properties should still be applied.
    const map = docStub.documentElement.style._map;
    expect(map["--brand-primary"]).toBe("#005B61");
    expect(map["--brand-accent"]).toBe("#FF8C00");
  });
});
