import { describe, expect, it } from "vitest";
import {
  addFieldToSection,
  addSectionToDraft,
  CHOICE_TYPES,
  deleteFieldFromDraft,
  duplicateField,
  fieldToPublishPayload,
  isLayoutOnlyType,
  LAYOUT_ONLY_TYPES,
  makeField,
  moveFieldInDraft,
  PALETTE_GROUPS,
  removeSectionFromDraft,
  setDraftLayout,
  SURVEY_TYPES,
  tabsForFieldType,
  uid,
  updateFieldInDraft,
  updateSectionInDraft,
  type DesignerDraft
} from "../formDesignerState";

function seedDraft(): DesignerDraft {
  return {
    name: "Plant Pre-Start",
    code: "PPS",
    layout: "classic",
    sections: [
      {
        tempId: "sec1",
        title: "Machine",
        sectionOrder: 1,
        fields: [
          {
            tempId: "f1",
            fieldKey: "machine",
            label: "Which machine?",
            fieldType: "text",
            fieldOrder: 1,
            isRequired: true
          },
          {
            tempId: "f2",
            fieldKey: "hours",
            label: "Hour meter reading",
            fieldType: "number",
            fieldOrder: 2,
            isRequired: true
          }
        ]
      }
    ],
    rules: []
  };
}

describe("PALETTE_GROUPS (Basic / Choice / Survey / Layout / Advanced category model)", () => {
  it("exposes the F-1 category model plus Site & WHS on top and Advanced (F-4) at the bottom", () => {
    expect(PALETTE_GROUPS.map((g) => g.key)).toEqual([
      "site_whs",
      "basic",
      "choice",
      "survey",
      "layout",
      "advanced"
    ]);
  });

  it("surfaces every renderer-ready basic input in the Basic group", () => {
    const basic = PALETTE_GROUPS.find((g) => g.key === "basic")!;
    const types = new Set(basic.entries.map((e) => e.type));
    for (const t of ["text", "textarea", "number", "date", "time", "email", "phone", "address", "file"]) {
      expect(types).toContain(t);
    }
  });

  it("groups every choice-bearing type under Choice", () => {
    const choice = PALETTE_GROUPS.find((g) => g.key === "choice")!;
    expect(new Set(choice.entries.map((e) => e.type))).toEqual(
      new Set(["multiple_choice", "checkbox", "radio"])
    );
  });

  it("groups the survey types under Survey", () => {
    const survey = PALETTE_GROUPS.find((g) => g.key === "survey")!;
    expect(new Set(survey.entries.map((e) => e.type))).toEqual(new Set(["rating", "scale"]));
  });

  it("groups the four static layout blocks under Layout", () => {
    const layout = PALETTE_GROUPS.find((g) => g.key === "layout")!;
    expect(new Set(layout.entries.map((e) => e.type))).toEqual(
      new Set(["heading", "paragraph", "divider", "image"])
    );
  });

  it("surfaces the four F-4 advanced tiles under Advanced", () => {
    const advanced = PALETTE_GROUPS.find((g) => g.key === "advanced")!;
    expect(new Set(advanced.entries.map((e) => e.type))).toEqual(
      new Set(["lookup", "calculation", "table", "terms"])
    );
  });

  it("keeps the still-deferred F-4/F-5 tiles out of the palette", () => {
    const flat = PALETTE_GROUPS.flatMap((g) => g.entries.map((e) => e.type));
    // Unique ID needs the fv2_form_number_sequence migration; the rest are F-5.
    for (const deferred of ["unique_id", "worker", "asset", "location", "weather"]) {
      expect(flat).not.toContain(deferred);
    }
  });

  it("does not repeat a type across groups", () => {
    const flat = PALETTE_GROUPS.flatMap((g) => g.entries.map((e) => e.type));
    expect(flat.length).toBe(new Set(flat).size);
  });
});

describe("layout / choice / survey type sets", () => {
  it("layout classifier agrees with the exported set", () => {
    for (const t of LAYOUT_ONLY_TYPES) expect(isLayoutOnlyType(t)).toBe(true);
    expect(isLayoutOnlyType("text")).toBe(false);
    expect(isLayoutOnlyType("radio")).toBe(false);
  });

  it("layout blocks and survey/choice sets are disjoint", () => {
    for (const t of LAYOUT_ONLY_TYPES) {
      expect(CHOICE_TYPES.has(t)).toBe(false);
      expect(SURVEY_TYPES.has(t)).toBe(false);
    }
  });
});

describe("tabsForFieldType", () => {
  it("shows General/Options/Logic for every choice-bearing type", () => {
    for (const t of ["multiple_choice", "checkbox", "radio"]) {
      expect(tabsForFieldType(t)).toEqual(["general", "options", "logic"]);
    }
  });

  it("shows General/Options/Logic for survey types (Options carries scale config)", () => {
    for (const t of ["rating", "scale"]) {
      expect(tabsForFieldType(t)).toEqual(["general", "options", "logic"]);
    }
  });

  it("shows General only for static layout blocks (no rules target, no options)", () => {
    for (const t of ["heading", "paragraph", "divider", "image"]) {
      expect(tabsForFieldType(t)).toEqual(["general"]);
    }
  });

  it("shows General/Options/Logic for advanced F-4 types (Options carries lookup/calc/table/terms config)", () => {
    for (const t of ["lookup", "calculation", "table", "terms"]) {
      expect(tabsForFieldType(t)).toEqual(["general", "options", "logic"]);
    }
  });

  it("shows General/Logic for the remaining input types", () => {
    for (const t of ["text", "email", "phone", "address", "time", "signature"]) {
      expect(tabsForFieldType(t)).toEqual(["general", "logic"]);
    }
  });
});

describe("makeField default config seeding", () => {
  it("seeds a 5-star rating by default", () => {
    const f = makeField("rating");
    expect(f.config).toEqual({ maxRating: 5 });
  });

  it("seeds a 1–5 scale with empty end-labels by default", () => {
    const f = makeField("scale");
    expect(f.config).toEqual({ min: 1, max: 5, minLabel: "", maxLabel: "" });
  });

  it("seeds an empty image URL for the image layout block", () => {
    const f = makeField("image");
    expect(f.config).toEqual({ imageUrl: "" });
    expect(f.options).toBeUndefined();
  });

  it("does not seed options for static layout blocks", () => {
    for (const t of ["heading", "paragraph", "divider", "image"]) {
      expect(makeField(t).options).toBeUndefined();
    }
  });

  it("seeds a two-choice default for every choice type", () => {
    for (const t of ["multiple_choice", "checkbox", "radio"]) {
      expect(makeField(t).options).toEqual(["Option 1", "Option 2"]);
    }
  });

  it("gives static layout blocks a human default label", () => {
    expect(makeField("heading").label).toBe("Section heading");
    expect(makeField("paragraph").label).toBe("Static paragraph");
    expect(makeField("divider").label).toBe("Divider");
    expect(makeField("image").label).toBe("Image");
  });

  it("never marks a static layout block as required at creation", () => {
    for (const t of ["heading", "paragraph", "divider", "image"]) {
      expect(makeField(t).isRequired).toBe(false);
    }
  });

  it("seeds an empty listSlug for lookup fields (points at /lists/:slug/items at fill time)", () => {
    const f = makeField("lookup");
    expect(f.config).toEqual({ listSlug: "", parentFieldKey: "" });
  });

  it("seeds a calculation with empty operands so the server treats it as pending config", () => {
    const f = makeField("calculation");
    expect(f.config).toEqual({ operation: "sum", operandKeys: [], decimals: 2 });
  });

  it("seeds a two-column table skeleton", () => {
    const f = makeField("table");
    const cfg = f.config as { columns: Array<{ key: string; label: string; fieldType: string }>; minRows: number; maxRows: number };
    expect(cfg.columns).toHaveLength(2);
    expect(cfg.minRows).toBe(1);
    expect(cfg.maxRows).toBe(20);
  });

  it("seeds terms with a default v1 version and prompt text", () => {
    const f = makeField("terms");
    const cfg = f.config as { termsText: string; termsVersion: string };
    expect(cfg.termsVersion).toBe("1");
    expect(cfg.termsText.length).toBeGreaterThan(0);
  });
});

describe("addFieldToSection", () => {
  it("appends a new field with sequential order and returns the created field for selection follow", () => {
    const draft = seedDraft();
    const result = addFieldToSection(draft, "sec1", "date");
    expect(result.draft.sections[0].fields).toHaveLength(3);
    expect(result.draft.sections[0].fields[2].fieldType).toBe("date");
    expect(result.draft.sections[0].fields[2].fieldOrder).toBe(3);
    expect(result.newField.tempId).toBe(result.draft.sections[0].fields[2].tempId);
  });

  it("seeds default options when the field type is a dropdown", () => {
    const result = addFieldToSection(seedDraft(), "sec1", "multiple_choice");
    expect(result.newField.options).toEqual(["Option 1", "Option 2"]);
  });

  it("seeds default options when a radio field is added from the palette", () => {
    const result = addFieldToSection(seedDraft(), "sec1", "radio");
    expect(result.newField.options).toEqual(["Option 1", "Option 2"]);
  });

  it("carries scale config through to the newly-created field", () => {
    const result = addFieldToSection(seedDraft(), "sec1", "scale");
    expect(result.newField.config).toEqual({ min: 1, max: 5, minLabel: "", maxLabel: "" });
  });
});

describe("updateFieldInDraft", () => {
  it("applies a partial patch and preserves untouched fields (inline label commit)", () => {
    const draft = seedDraft();
    const next = updateFieldInDraft(draft, "sec1", "f1", { label: "Which excavator?" });
    expect(next.sections[0].fields[0].label).toBe("Which excavator?");
    expect(next.sections[0].fields[1].label).toBe("Hour meter reading");
  });

  it("toggles the required flag independently of label", () => {
    const draft = seedDraft();
    const next = updateFieldInDraft(draft, "sec1", "f1", { isRequired: false });
    expect(next.sections[0].fields[0].isRequired).toBe(false);
    expect(next.sections[0].fields[0].label).toBe("Which machine?");
  });

  it("patches a config setting (rating maxRating) without touching other keys", () => {
    const start = addFieldToSection(seedDraft(), "sec1", "scale");
    const scaleField = start.newField;
    const next = updateFieldInDraft(start.draft, "sec1", scaleField.tempId, {
      config: { ...(scaleField.config ?? {}), max: 10 }
    });
    const updated = next.sections[0].fields.find((f) => f.tempId === scaleField.tempId)!;
    expect(updated.config).toEqual({ min: 1, max: 10, minLabel: "", maxLabel: "" });
  });
});

describe("duplicateField", () => {
  it("inserts a copy immediately after the source and returns the new field for selection follow", () => {
    const draft = seedDraft();
    const result = duplicateField(draft, "sec1", "f1");
    expect(result.draft.sections[0].fields).toHaveLength(3);
    expect(result.draft.sections[0].fields[1].label).toBe("Which machine? (copy)");
    expect(result.newField?.fieldKey).not.toBe("machine");
  });

  it("deep-copies config so edits to the copy do not mutate the original", () => {
    const withRating = addFieldToSection(seedDraft(), "sec1", "rating");
    const original = withRating.newField;
    const duped = duplicateField(withRating.draft, "sec1", original.tempId);
    const copy = duped.newField!;
    expect(copy.config).toEqual(original.config);
    expect(copy.config).not.toBe(original.config);
  });
});

describe("moveFieldInDraft", () => {
  it("swaps adjacent fields when in-range", () => {
    const draft = seedDraft();
    const next = moveFieldInDraft(draft, "sec1", "f2", -1);
    expect(next.sections[0].fields.map((f) => f.tempId)).toEqual(["f2", "f1"]);
    expect(next.sections[0].fields[0].fieldOrder).toBe(1);
  });

  it("no-ops at the boundary", () => {
    const draft = seedDraft();
    const next = moveFieldInDraft(draft, "sec1", "f1", -1);
    expect(next.sections[0].fields.map((f) => f.tempId)).toEqual(["f1", "f2"]);
  });
});

describe("deleteFieldFromDraft", () => {
  it("removes the field and cascades any rule referencing its key", () => {
    const draft: DesignerDraft = {
      ...seedDraft(),
      rules: [
        {
          tempId: "r1",
          sourceFieldKey: "machine",
          targetFieldKey: "hours",
          operator: "equals",
          comparisonValue: "CAT 320",
          effect: "SHOW"
        }
      ]
    };
    const next = deleteFieldFromDraft(draft, "sec1", "f1");
    expect(next.sections[0].fields.map((f) => f.tempId)).toEqual(["f2"]);
    expect(next.rules).toEqual([]);
  });
});

describe("section state (cog popover targets)", () => {
  it("adds a new section with sequential order", () => {
    const next = addSectionToDraft(seedDraft());
    expect(next.sections).toHaveLength(2);
    expect(next.sections[1].sectionOrder).toBe(2);
    expect(next.sections[1].title).toBe("Section 2");
  });

  it("patches the section title from the cog popover", () => {
    const next = updateSectionInDraft(seedDraft(), "sec1", { title: "Machine & meter" });
    expect(next.sections[0].title).toBe("Machine & meter");
  });

  it("removes the section and re-numbers remaining sections", () => {
    const draft = addSectionToDraft(seedDraft());
    const secondId = draft.sections[1].tempId;
    const next = removeSectionFromDraft(draft, "sec1");
    expect(next.sections).toHaveLength(1);
    expect(next.sections[0].tempId).toBe(secondId);
    expect(next.sections[0].sectionOrder).toBe(1);
  });
});

describe("setDraftLayout (Classic/Card toggle)", () => {
  it("switches the layout without touching sections or rules", () => {
    const draft = seedDraft();
    const next = setDraftLayout(draft, "card");
    expect(next.layout).toBe("card");
    expect(next.sections).toBe(draft.sections);
    expect(next.rules).toBe(draft.rules);
  });
});

describe("fieldToPublishPayload (publish-time serialisation)", () => {
  it("mirrors choice options into config.options so FormFillPage can render them", () => {
    const field = { ...makeField("radio"), options: ["Yes", "No"] };
    const payload = fieldToPublishPayload(field);
    expect(payload.optionsJson).toEqual(["Yes", "No"]);
    expect((payload.config as { options?: string[] }).options).toEqual(["Yes", "No"]);
  });

  it("keeps the canonical optionsJson column even when config mirrors it", () => {
    const field = { ...makeField("checkbox"), options: ["A", "B", "C"] };
    const payload = fieldToPublishPayload(field);
    expect(payload.optionsJson).toEqual(["A", "B", "C"]);
  });

  it("forces isRequired=false for every static layout block regardless of the draft flag", () => {
    for (const t of ["heading", "paragraph", "divider", "image"]) {
      const field = { ...makeField(t), isRequired: true };
      expect(fieldToPublishPayload(field).isRequired).toBe(false);
    }
  });

  it("preserves isRequired for value-producing fields", () => {
    const field = { ...makeField("text"), isRequired: true };
    expect(fieldToPublishPayload(field).isRequired).toBe(true);
  });

  it("threads scale config through unchanged", () => {
    const field = makeField("scale");
    const payload = fieldToPublishPayload(field);
    expect(payload.config).toEqual({ min: 1, max: 5, minLabel: "", maxLabel: "" });
  });

  it("threads image URL config through unchanged", () => {
    const field = { ...makeField("image"), config: { imageUrl: "https://cdn.example/x.png" } };
    const payload = fieldToPublishPayload(field);
    expect(payload.config).toEqual({ imageUrl: "https://cdn.example/x.png" });
  });

  it("does not mirror options into config for non-choice types", () => {
    const field = { ...makeField("rating"), options: ["stray"] as string[] };
    const payload = fieldToPublishPayload(field);
    expect((payload.config as { options?: unknown }).options).toBeUndefined();
  });
});

describe("uid", () => {
  it("emits unique ids across rapid calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(uid());
    expect(ids.size).toBe(50);
  });
});
