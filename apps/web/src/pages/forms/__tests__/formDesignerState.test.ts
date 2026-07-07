import { describe, expect, it } from "vitest";
import {
  addFieldToSection,
  addSectionToDraft,
  deleteFieldFromDraft,
  duplicateField,
  moveFieldInDraft,
  PALETTE_GROUPS,
  removeSectionFromDraft,
  setDraftLayout,
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

describe("PALETTE_GROUPS (F-1: only the 9 existing types)", () => {
  it("groups exactly the 9 existing field types into Site & WHS and Input — no v2 tiles surfaced", () => {
    const flat = PALETTE_GROUPS.flatMap((g) => g.entries.map((e) => e.type));
    expect(flat).toHaveLength(9);
    expect(new Set(flat)).toEqual(
      new Set([
        "text",
        "textarea",
        "number",
        "date",
        "checkbox",
        "multiple_choice",
        "signature",
        "image_capture",
        "file"
      ])
    );
    expect(PALETTE_GROUPS.map((g) => g.key)).toEqual(["site_whs", "input"]);
  });
});

describe("tabsForFieldType", () => {
  it("shows General/Options/Logic for choice-bearing types", () => {
    expect(tabsForFieldType("multiple_choice")).toEqual(["general", "options", "logic"]);
  });

  it("shows General/Logic only for non-choice types (Options tab hides — no options to edit)", () => {
    expect(tabsForFieldType("text")).toEqual(["general", "logic"]);
    expect(tabsForFieldType("signature")).toEqual(["general", "logic"]);
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
});

describe("duplicateField", () => {
  it("inserts a copy immediately after the source and returns the new field for selection follow", () => {
    const draft = seedDraft();
    const result = duplicateField(draft, "sec1", "f1");
    expect(result.draft.sections[0].fields).toHaveLength(3);
    expect(result.draft.sections[0].fields[1].label).toBe("Which machine? (copy)");
    expect(result.newField?.fieldKey).not.toBe("machine");
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

describe("uid", () => {
  it("emits unique ids across rapid calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(uid());
    expect(ids.size).toBe(50);
  });
});
