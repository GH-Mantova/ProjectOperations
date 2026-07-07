import { describe, expect, it } from "vitest";
import {
  CARD_BREAKPOINT_PX,
  readTemplateLayout,
  resolveEffectiveLayout
} from "../formLayoutResolver";

describe("resolveEffectiveLayout", () => {
  it("forces Card below the 768px breakpoint even if the template override is Classic", () => {
    expect(resolveEffectiveLayout({ templateLayout: "classic", viewportWidth: 767 })).toBe("card");
    expect(resolveEffectiveLayout({ templateLayout: null, viewportWidth: 500 })).toBe("card");
  });

  it("honours the per-form override at or above the breakpoint", () => {
    expect(resolveEffectiveLayout({ templateLayout: "card", viewportWidth: CARD_BREAKPOINT_PX })).toBe("card");
    expect(resolveEffectiveLayout({ templateLayout: "card", viewportWidth: 1200 })).toBe("card");
  });

  it("defaults to Classic at desktop widths when no override is set", () => {
    expect(resolveEffectiveLayout({ templateLayout: null, viewportWidth: 1024 })).toBe("classic");
    expect(resolveEffectiveLayout({ templateLayout: undefined, viewportWidth: CARD_BREAKPOINT_PX })).toBe("classic");
  });

  it("exposes the platform 768px mobile breakpoint as a shared constant", () => {
    expect(CARD_BREAKPOINT_PX).toBe(768);
  });
});

describe("readTemplateLayout", () => {
  it("returns 'card' or 'classic' when the settings blob carries a valid layout key", () => {
    expect(readTemplateLayout({ layout: "card" })).toBe("card");
    expect(readTemplateLayout({ layout: "classic" })).toBe("classic");
  });

  it("returns null for empty / non-object / unknown values so the resolver falls back to Classic", () => {
    expect(readTemplateLayout(null)).toBeNull();
    expect(readTemplateLayout(undefined)).toBeNull();
    expect(readTemplateLayout("card")).toBeNull();
    expect(readTemplateLayout({ layout: "STEPPER" })).toBeNull();
    expect(readTemplateLayout({ other: 1 })).toBeNull();
  });
});
