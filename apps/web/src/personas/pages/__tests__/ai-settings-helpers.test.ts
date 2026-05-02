import { describe, expect, it } from "vitest";
import {
  canViewAiSettingsPage,
  canViewCompanyTab,
  dropdownOptionsFromEnabledProviders,
  getInitialTab,
  getProviderLabel,
  hasAnyPersonaPermission,
  hasUnsavedChanges,
  shouldShowBYOKSection,
  shouldShowPersonalInstructionField,
  type GlobalSettings
} from "../ai-settings-helpers";

const baseGlobal: GlobalSettings = {
  allowUserInstructionOverrides: false,
  enabledProviders: ["anthropic"],
  allowBringYourOwnKey: false
};

describe("dropdownOptionsFromEnabledProviders", () => {
  it("returns just Anthropic when only Anthropic is enabled", () => {
    expect(dropdownOptionsFromEnabledProviders(["anthropic"])).toEqual([
      { value: "anthropic", label: "Anthropic Claude" }
    ]);
  });

  it("returns multiple providers in canonical order regardless of input order", () => {
    expect(dropdownOptionsFromEnabledProviders(["openai", "anthropic"])).toEqual([
      { value: "anthropic", label: "Anthropic Claude" },
      { value: "openai", label: "OpenAI GPT" }
    ]);
  });

  it("returns empty array when nothing enabled", () => {
    expect(dropdownOptionsFromEnabledProviders([])).toEqual([]);
  });

  it("ignores unknown provider keys", () => {
    expect(dropdownOptionsFromEnabledProviders(["anthropic", "unknown" as never])).toEqual([
      { value: "anthropic", label: "Anthropic Claude" }
    ]);
  });
});

describe("getProviderLabel", () => {
  it("returns the friendly label for known keys", () => {
    expect(getProviderLabel("anthropic")).toBe("Anthropic Claude");
    expect(getProviderLabel("openai")).toBe("OpenAI GPT");
    expect(getProviderLabel("gemini")).toBe("Google Gemini");
    expect(getProviderLabel("groq")).toBe("Groq");
  });

  it("falls back to the raw key for unknown providers (graceful)", () => {
    expect(getProviderLabel("future-provider")).toBe("future-provider");
  });
});

describe("shouldShowPersonalInstructionField", () => {
  it("returns true only when the global toggle is on", () => {
    expect(shouldShowPersonalInstructionField({ ...baseGlobal, allowUserInstructionOverrides: true })).toBe(true);
    expect(shouldShowPersonalInstructionField(baseGlobal)).toBe(false);
  });

  it("returns false when global settings haven't loaded yet", () => {
    expect(shouldShowPersonalInstructionField(null)).toBe(false);
  });
});

describe("shouldShowBYOKSection", () => {
  it("returns true only when the global BYOK toggle is on", () => {
    expect(shouldShowBYOKSection({ ...baseGlobal, allowBringYourOwnKey: true })).toBe(true);
    expect(shouldShowBYOKSection(baseGlobal)).toBe(false);
  });

  it("returns false when global settings haven't loaded yet", () => {
    expect(shouldShowBYOKSection(null)).toBe(false);
  });
});

describe("hasUnsavedChanges", () => {
  it("returns false when both states are equal", () => {
    expect(hasUnsavedChanges({ a: 1, b: "two" }, { a: 1, b: "two" })).toBe(false);
  });

  it("returns true when any field differs", () => {
    expect(hasUnsavedChanges({ a: 1 }, { a: 2 })).toBe(true);
    expect(hasUnsavedChanges({ a: null }, { a: "" })).toBe(true);
  });

  it("treats undefined and null as different (matches API semantics)", () => {
    expect(hasUnsavedChanges({ a: null }, { a: undefined })).toBe(true);
  });
});

describe("getInitialTab", () => {
  it("Super Users default to Company tab", () => {
    expect(getInitialTab(true)).toBe("company");
  });

  it("Non-Super Users default to My Settings", () => {
    expect(getInitialTab(false)).toBe("mine");
    expect(getInitialTab(undefined)).toBe("mine");
  });
});

describe("canViewCompanyTab", () => {
  it("only Super Users can view the Company tab", () => {
    expect(canViewCompanyTab(true)).toBe(true);
    expect(canViewCompanyTab(false)).toBe(false);
    expect(canViewCompanyTab(undefined)).toBe(false);
  });
});

describe("hasAnyPersonaPermission", () => {
  it("returns true when at least one permission starts with 'ai.persona.'", () => {
    expect(hasAnyPersonaPermission(["ai.persona.tendering"])).toBe(true);
    expect(hasAnyPersonaPermission(["finance.view", "ai.persona.tendering"])).toBe(true);
  });

  it("returns false for users with no persona permissions", () => {
    expect(hasAnyPersonaPermission(["finance.view", "tenders.view"])).toBe(false);
    expect(hasAnyPersonaPermission([])).toBe(false);
    expect(hasAnyPersonaPermission(undefined)).toBe(false);
  });
});

describe("canViewAiSettingsPage", () => {
  it("Super Users always see the page (even without an explicit ai.persona.* grant)", () => {
    expect(canViewAiSettingsPage(true, [])).toBe(true);
    expect(canViewAiSettingsPage(true, ["finance.view"])).toBe(true);
  });

  it("Non-Super Users with at least one ai.persona.* permission can view the page", () => {
    expect(canViewAiSettingsPage(false, ["ai.persona.tendering"])).toBe(true);
  });

  it("Non-Super Users with no persona permissions cannot view the page", () => {
    expect(canViewAiSettingsPage(false, [])).toBe(false);
    expect(canViewAiSettingsPage(false, ["finance.view"])).toBe(false);
    expect(canViewAiSettingsPage(undefined, undefined)).toBe(false);
  });
});
