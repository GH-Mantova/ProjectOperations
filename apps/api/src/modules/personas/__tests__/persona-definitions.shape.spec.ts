import { tenderingPersona } from "../definitions/tendering.persona";
import type { PersonaDefinition } from "../personas.types";

// PR #150 — every PersonaSubMode must have both `label` (UI string) and
// `description` (system prompt block). Iterating over every persona
// definition guarantees this contract holds for any persona added in
// future PRs without needing per-persona test boilerplate.
const ALL_PERSONAS: PersonaDefinition[] = [tenderingPersona];

describe("PersonaSubMode shape (PR #150)", () => {
  it.each(ALL_PERSONAS)("$displayName: every sub-mode has a UI-safe label", (persona) => {
    for (const subMode of persona.subModes) {
      expect(subMode.label).toBeDefined();
      expect(typeof subMode.label).toBe("string");
      expect(subMode.label.length).toBeGreaterThan(0);
      expect(subMode.label).not.toContain("##");
      expect(subMode.label).not.toContain("\n");
    }
  });

  it.each(ALL_PERSONAS)("$displayName: every sub-mode has a description", (persona) => {
    for (const subMode of persona.subModes) {
      expect(subMode.description).toBeDefined();
      expect(typeof subMode.description).toBe("string");
      expect(subMode.description.length).toBeGreaterThan(0);
    }
  });
});

describe("Tendering sub-mode labels (PR #150)", () => {
  const expectedLabels: Record<string, string> = {
    register: "Tender register — pipeline view",
    "tender-detail": "Tender detail — answer questions about the tender",
    scope: "Scope — propose and refine scope items",
    estimate: "Estimate — review and refine cost lines",
    quote: "Quote — cost line structure and exclusions",
    clarifications: "Clarifications — summarisation and response drafts"
  };

  it.each(Object.entries(expectedLabels))(
    "tendering.%s label is %s",
    (subModeName, expectedLabel) => {
      const subMode = tenderingPersona.subModes.find((s) => s.name === subModeName);
      expect(subMode).toBeDefined();
      expect(subMode!.label).toBe(expectedLabel);
    }
  );
});
