import type { FormLayout } from "./formLayoutResolver";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "multiple_choice"
  | "signature"
  | "image_capture"
  | "file";

export type DraftField = {
  tempId: string;
  fieldKey: string;
  label: string;
  fieldType: FieldType | string;
  fieldOrder: number;
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
};

export type DraftSection = {
  tempId: string;
  title: string;
  description?: string;
  sectionOrder: number;
  fields: DraftField[];
};

export type DraftRule = {
  tempId: string;
  sourceFieldKey: string;
  targetFieldKey: string;
  operator: string;
  comparisonValue: string;
  effect: string;
};

export type DesignerDraft = {
  name: string;
  code: string;
  description?: string;
  layout: FormLayout;
  sections: DraftSection[];
  rules: DraftRule[];
};

export type PaletteGroup = {
  key: "site_whs" | "input" | "structure";
  label: string;
  entries: Array<{ type: FieldType; label: string; icon: string; badge?: string }>;
};

/**
 * F-1 palette: only the 9 existing types are functional, grouped per the
 * mockup (form-builder-mockup.html:107-131). New-in-v2 palette tiles are
 * intentionally not surfaced in F-1 — they arrive with F-4/F-5.
 */
export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    key: "site_whs",
    label: "Site & WHS",
    entries: [
      { type: "image_capture", label: "Photo", icon: "\u{1F4F7}" },
      { type: "signature", label: "Signature", icon: "✍" }
    ]
  },
  {
    key: "input",
    label: "Input",
    entries: [
      { type: "text", label: "Text", icon: "T" },
      { type: "textarea", label: "Long text", icon: "¶" },
      { type: "number", label: "Number", icon: "#" },
      { type: "date", label: "Date", icon: "\u{1F4C5}" },
      { type: "multiple_choice", label: "Dropdown", icon: "▾" },
      { type: "checkbox", label: "Checkbox", icon: "☑" },
      { type: "file", label: "File", icon: "\u{1F4CE}" }
    ]
  }
];

export type PropertyTab = "general" | "options" | "logic";

/**
 * Which right-panel tabs a field type shows. F-1 exposes General/Options for
 * choice-bearing types and General/Logic for the rest — Push tab arrives with
 * F-9 (push engine), so it is intentionally absent here.
 */
export function tabsForFieldType(fieldType: string): PropertyTab[] {
  if (fieldType === "multiple_choice") return ["general", "options", "logic"];
  return ["general", "logic"];
}

let uidCounter = 0;
export function uid(): string {
  uidCounter += 1;
  return `f${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

export function keyFromLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "") || uid()
  );
}

export function makeField(fieldType: FieldType | string, label?: string): DraftField {
  const displayLabel = label ?? `New ${String(fieldType).replace(/_/g, " ")} field`;
  return {
    tempId: uid(),
    fieldKey: `${keyFromLabel(displayLabel)}_${uid().slice(0, 4)}`,
    label: displayLabel,
    fieldType,
    fieldOrder: 0,
    isRequired: false,
    options: fieldType === "multiple_choice" ? ["Option 1", "Option 2"] : undefined
  };
}

export function reorderFields(fields: DraftField[]): DraftField[] {
  return fields.map((field, i) => ({ ...field, fieldOrder: i + 1 }));
}

export function addFieldToSection(
  draft: DesignerDraft,
  sectionTempId: string,
  fieldType: FieldType | string
): { draft: DesignerDraft; newField: DraftField } {
  const newField = makeField(fieldType);
  const nextDraft: DesignerDraft = {
    ...draft,
    sections: draft.sections.map((section) => {
      if (section.tempId !== sectionTempId) return section;
      return { ...section, fields: reorderFields([...section.fields, newField]) };
    })
  };
  return { draft: nextDraft, newField };
}

export function updateFieldInDraft(
  draft: DesignerDraft,
  sectionTempId: string,
  fieldTempId: string,
  patch: Partial<DraftField>
): DesignerDraft {
  return {
    ...draft,
    sections: draft.sections.map((section) => {
      if (section.tempId !== sectionTempId) return section;
      return {
        ...section,
        fields: section.fields.map((field) =>
          field.tempId === fieldTempId ? { ...field, ...patch } : field
        )
      };
    })
  };
}

export function duplicateField(
  draft: DesignerDraft,
  sectionTempId: string,
  fieldTempId: string
): { draft: DesignerDraft; newField: DraftField | null } {
  let created: DraftField | null = null;
  const nextDraft: DesignerDraft = {
    ...draft,
    sections: draft.sections.map((section) => {
      if (section.tempId !== sectionTempId) return section;
      const source = section.fields.find((f) => f.tempId === fieldTempId);
      if (!source) return section;
      const copy: DraftField = {
        ...source,
        tempId: uid(),
        fieldKey: `${source.fieldKey}_copy_${uid().slice(0, 4)}`,
        label: `${source.label} (copy)`,
        options: source.options ? [...source.options] : undefined
      };
      created = copy;
      const idx = section.fields.findIndex((f) => f.tempId === fieldTempId);
      const next = [...section.fields];
      next.splice(idx + 1, 0, copy);
      return { ...section, fields: reorderFields(next) };
    })
  };
  return { draft: nextDraft, newField: created };
}

export function deleteFieldFromDraft(
  draft: DesignerDraft,
  sectionTempId: string,
  fieldTempId: string
): DesignerDraft {
  const deletedKey = draft.sections
    .find((s) => s.tempId === sectionTempId)
    ?.fields.find((f) => f.tempId === fieldTempId)?.fieldKey;
  return {
    ...draft,
    sections: draft.sections.map((section) => {
      if (section.tempId !== sectionTempId) return section;
      return {
        ...section,
        fields: reorderFields(section.fields.filter((f) => f.tempId !== fieldTempId))
      };
    }),
    rules: deletedKey
      ? draft.rules.filter((r) => r.sourceFieldKey !== deletedKey && r.targetFieldKey !== deletedKey)
      : draft.rules
  };
}

export function moveFieldInDraft(
  draft: DesignerDraft,
  sectionTempId: string,
  fieldTempId: string,
  direction: -1 | 1
): DesignerDraft {
  return {
    ...draft,
    sections: draft.sections.map((section) => {
      if (section.tempId !== sectionTempId) return section;
      const index = section.fields.findIndex((f) => f.tempId === fieldTempId);
      if (index < 0) return section;
      const target = index + direction;
      if (target < 0 || target >= section.fields.length) return section;
      const next = [...section.fields];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...section, fields: reorderFields(next) };
    })
  };
}

export function updateSectionInDraft(
  draft: DesignerDraft,
  sectionTempId: string,
  patch: Partial<DraftSection>
): DesignerDraft {
  return {
    ...draft,
    sections: draft.sections.map((s) => (s.tempId === sectionTempId ? { ...s, ...patch } : s))
  };
}

export function addSectionToDraft(draft: DesignerDraft): DesignerDraft {
  return {
    ...draft,
    sections: [
      ...draft.sections,
      {
        tempId: uid(),
        title: `Section ${draft.sections.length + 1}`,
        sectionOrder: draft.sections.length + 1,
        fields: []
      }
    ]
  };
}

export function removeSectionFromDraft(
  draft: DesignerDraft,
  sectionTempId: string
): DesignerDraft {
  return {
    ...draft,
    sections: draft.sections
      .filter((s) => s.tempId !== sectionTempId)
      .map((s, i) => ({ ...s, sectionOrder: i + 1 }))
  };
}

export function setDraftLayout(draft: DesignerDraft, layout: FormLayout): DesignerDraft {
  return { ...draft, layout };
}
