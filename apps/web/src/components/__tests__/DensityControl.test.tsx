/**
 * Tests for DensityControl.tsx
 *
 * The web workspace has no jsdom / @testing-library set up (all existing web
 * specs are pure-logic tests). We cover the exported pure helpers and the
 * option descriptor list that the component renders, proving:
 *
 *   1. DENSITY_OPTIONS contains both "comfortable" and "compact" entries.
 *   2. isActiveOption correctly marks the current option and no other.
 *   3. The option whose value matches the current mode is marked active.
 *   4. Changing the mode via applyDensity calls through to the DOM.
 *
 * The JSX rendering path is not exercised here — that requires jsdom or an
 * E2E suite. This file covers the logic layer that the rendered component
 * delegates to, which is the boundary that is both testable and meaningful
 * without a browser environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DENSITY_OPTIONS, isActiveOption } from "../DensityControl";
import type { DensityMode } from "../../lib/density";

// ── DOM stub (needed so density.ts module-load IIFE doesn't crash) ────────────

function makeDocumentStub() {
  const attrs: Record<string, string> = {};
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

describe("DENSITY_OPTIONS", () => {
  it("contains exactly two options: comfortable and compact", () => {
    const values = DENSITY_OPTIONS.map((o) => o.value);
    expect(values).toContain("comfortable");
    expect(values).toContain("compact");
    expect(DENSITY_OPTIONS).toHaveLength(2);
  });

  it("every option has a non-empty label and description", () => {
    for (const option of DENSITY_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  it("comfortable is listed first (natural default first)", () => {
    expect(DENSITY_OPTIONS[0]?.value).toBe("comfortable");
  });
});

describe("isActiveOption — marks the current one, and no other", () => {
  it("returns true for the option whose value matches the current mode", () => {
    const comfortable = DENSITY_OPTIONS.find((o) => o.value === "comfortable")!;
    const compact = DENSITY_OPTIONS.find((o) => o.value === "compact")!;

    expect(isActiveOption(comfortable, "comfortable")).toBe(true);
    expect(isActiveOption(compact, "compact")).toBe(true);
  });

  it("returns false for the option that does NOT match the current mode", () => {
    const comfortable = DENSITY_OPTIONS.find((o) => o.value === "comfortable")!;
    const compact = DENSITY_OPTIONS.find((o) => o.value === "compact")!;

    expect(isActiveOption(comfortable, "compact")).toBe(false);
    expect(isActiveOption(compact, "comfortable")).toBe(false);
  });

  it("exactly one option is active per mode", () => {
    const modes: DensityMode[] = ["comfortable", "compact"];
    for (const current of modes) {
      const activeCount = DENSITY_OPTIONS.filter((o) => isActiveOption(o, current)).length;
      expect(activeCount).toBe(1);
    }
  });
});

describe("applyDensity integration — calls through to DOM on change", () => {
  let docStub: ReturnType<typeof makeDocumentStub>;
  let lsStub: ReturnType<typeof makeLocalStorageStub>;

  beforeEach(() => {
    docStub = makeDocumentStub();
    lsStub = makeLocalStorageStub();
    vi.stubGlobal("document", docStub);
    vi.stubGlobal("window", { localStorage: lsStub, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("localStorage", lsStub);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selecting "compact" sets data-density on the root element', async () => {
    const { applyDensity } = await import("../../lib/density");

    applyDensity("compact");

    expect(docStub.documentElement._attrs["data-density"]).toBe("compact");
  });

  it('selecting "comfortable" removes data-density from the root element', async () => {
    const { applyDensity } = await import("../../lib/density");

    applyDensity("compact");
    applyDensity("comfortable");

    expect("data-density" in docStub.documentElement._attrs).toBe(false);
  });
});
