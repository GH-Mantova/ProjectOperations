/**
 * Tests for density.ts
 *
 * Runs in the default node environment (no jsdom/happy-dom installed).
 * document and localStorage are stubbed with vi.stubGlobal before the module
 * is imported so the module-load IIFE sees the fakes — same pattern as
 * brand-scheme.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── DOM / localStorage stubs ──────────────────────────────────────────────────

type AttrMap = Record<string, string>;

function makeDocumentStub() {
  const attrs: AttrMap = {};
  return {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
      removeAttribute(name: string) {
        delete attrs[name];
      },
      _attrs: attrs
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

describe("applyDensity", () => {
  let docStub: ReturnType<typeof makeDocumentStub>;
  let lsStub: ReturnType<typeof makeLocalStorageStub>;

  beforeEach(() => {
    docStub = makeDocumentStub();
    lsStub = makeLocalStorageStub();
    vi.stubGlobal("document", docStub);
    vi.stubGlobal("window", { localStorage: lsStub });
    vi.stubGlobal("localStorage", lsStub);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applyDensity("compact") sets data-density="compact" on documentElement', async () => {
    const { applyDensity } = await import("../density");

    applyDensity("compact");

    expect(docStub.documentElement._attrs["data-density"]).toBe("compact");
  });

  it('applyDensity("comfortable") removes the data-density attribute', async () => {
    const { applyDensity } = await import("../density");

    // First set compact so the attribute exists.
    applyDensity("compact");
    expect(docStub.documentElement._attrs["data-density"]).toBe("compact");

    // Then switch back to comfortable — attribute must be absent.
    applyDensity("comfortable");
    expect("data-density" in docStub.documentElement._attrs).toBe(false);
  });

  it("a localStorage accessor that throws does not prevent applyDensity from working", async () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    vi.stubGlobal("localStorage", throwingStorage);
    vi.stubGlobal("window", { localStorage: throwingStorage });

    // Import fresh so the module-load IIFE runs against the throwing storage.
    const { applyDensity } = await import("../density");

    // Should not throw even though localStorage threw during module load.
    expect(() => applyDensity("compact")).not.toThrow();
    expect(docStub.documentElement._attrs["data-density"]).toBe("compact");
  });

  it("an unknown stored value falls back to comfortable (no data-density attribute)", async () => {
    // Seed localStorage with a value that is not a valid DensityMode.
    const lsWithUnknown = makeLocalStorageStub({ "projectops.density": "ultra-dense" });
    vi.stubGlobal("localStorage", lsWithUnknown);
    vi.stubGlobal("window", { localStorage: lsWithUnknown });

    // Import fresh so the module-load IIFE reads "ultra-dense" and falls back.
    await import("../density");

    // The module-load IIFE should have called applyDensity("comfortable"),
    // which removes the attribute — so the key must be absent.
    expect("data-density" in docStub.documentElement._attrs).toBe(false);
  });
});

describe("DENSITY_STORAGE_KEY", () => {
  it('is "projectops.density" (distinct from THEME_STORAGE_KEY)', async () => {
    vi.stubGlobal("document", makeDocumentStub());
    vi.stubGlobal("localStorage", makeLocalStorageStub());
    vi.stubGlobal("window", { localStorage: makeLocalStorageStub() });
    vi.resetModules();

    const { DENSITY_STORAGE_KEY } = await import("../density");

    expect(DENSITY_STORAGE_KEY).toBe("projectops.density");
    // Belt-and-suspenders: must not reuse the theme key.
    expect(DENSITY_STORAGE_KEY).not.toBe("projectops.theme");
  });
});
