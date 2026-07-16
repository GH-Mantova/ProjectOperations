import type { FormLayout } from "./formLayoutResolver";

/**
 * Field types the F-1 designer emits.
 *
 * F-1 shipped exactly nine functional types; this slice widens the palette to
 * cover the renderer-ready basic inputs / survey types / static layout blocks
 * so the builder catches up with what `FormFillPage` already draws.
 */
export type FieldType =
  // Basic inputs
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "email"
  | "phone"
  | "address"
  | "file"
  // Choice
  | "multiple_choice"
  | "checkbox"
  | "radio"
  // Survey
  | "rating"
  | "scale"
  // Static layout (produces no `FormSubmissionValue`)
  | "heading"
  | "paragraph"
  | "divider"
  | "image"
  // Site & WHS
  | "signature"
  | "image_capture"
  // Advanced (F-4)
  | "lookup"
  | "calculation"
  | "table"
  | "terms"
  // Content library (forms-content-library)
  | "content_block";

/**
 * Static-layout field types render read-only content and never contribute a
 * `FormSubmissionValue` — they exist purely for canvas structure. Enforce this
 * in one place so designer + renderer + tests agree.
 */
export const LAYOUT_ONLY_TYPES: ReadonlySet<string> = new Set<string>([
  "heading",
  "paragraph",
  "divider",
  "image",
  // content_block renders a snippet's HTML at fill-time; no submission value
  "content_block"
]);

export function isLayoutOnlyType(fieldType: string): boolean {
  return LAYOUT_ONLY_TYPES.has(fieldType);
}

/** Choice-bearing types share the same options-list authoring surface. */
export const CHOICE_TYPES: ReadonlySet<string> = new Set<string>([
  "multiple_choice",
  "checkbox",
  "radio"
]);

/** Survey types carry a numeric scale config rather than an options list. */
export const SURVEY_TYPES: ReadonlySet<string> = new Set<string>(["rating", "scale"]);

/**
 * Advanced F-4 types. All four keep their config in `FormField.config` so no
 * schema migration is needed — that's why they can ship in a single slice.
 * The remaining F-4 tile, Unique ID, is deferred pending the
 * `fv2_form_number_sequence` migration.
 */
export const ADVANCED_TYPES: ReadonlySet<string> = new Set<string>([
  "lookup",
  "calculation",
  "table",
  "terms"
]);

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
  config?: Record<string, unknown>;
  /** For content_block fields — the code of the referenced FormContentSnippet. */
  snippetCode?: string;
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
  key: "site_whs" | "basic" | "choice" | "survey" | "layout" | "advanced";
  label: string;
  entries: Array<{ type: FieldType; label: string; icon: string; badge?: string }>;
};

/**
 * Palette groups per the F-1 category model. This slice widens F-1's
 * two-group palette to the full Basic / Choice / Survey / Layout set, keeping
 * Site & WHS on top for the construction-critical Photo + Signature tiles.
 *
 * F-4 adds an Advanced group with Lookup, Calculation, Table and Terms. The
 * remaining advanced tiles (Unique ID, Worker, Asset, Location, Weather) are
 * still deferred — Unique ID pends the `fv2_form_number_sequence` migration.
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
    key: "basic",
    label: "Basic",
    entries: [
      { type: "text", label: "Text", icon: "T" },
      { type: "textarea", label: "Long text", icon: "¶" },
      { type: "number", label: "Number", icon: "#" },
      { type: "date", label: "Date", icon: "\u{1F4C5}" },
      { type: "time", label: "Time", icon: "⏱" },
      { type: "email", label: "Email", icon: "✉" },
      { type: "phone", label: "Phone", icon: "☎" },
      { type: "address", label: "Address", icon: "\u{1F4CD}" },
      { type: "file", label: "File", icon: "\u{1F4CE}" }
    ]
  },
  {
    key: "choice",
    label: "Choice",
    entries: [
      { type: "multiple_choice", label: "Dropdown", icon: "▾" },
      { type: "checkbox", label: "Checkbox", icon: "☑" },
      { type: "radio", label: "Radio", icon: "◉" }
    ]
  },
  {
    key: "survey",
    label: "Survey",
    entries: [
      { type: "rating", label: "Star rating", icon: "★" },
      { type: "scale", label: "Scale", icon: "\u{1F4CF}" }
    ]
  },
  {
    key: "layout",
    label: "Layout",
    entries: [
      { type: "heading", label: "Heading", icon: "H" },
      { type: "paragraph", label: "Paragraph", icon: "¶" },
      { type: "divider", label: "Divider", icon: "—" },
      { type: "image", label: "Image", icon: "\u{1F5BC}" },
      { type: "content_block", label: "Content block", icon: "\u{1F4D1}", badge: "snippet" }
    ]
  },
  {
    key: "advanced",
    label: "Advanced",
    entries: [
      { type: "lookup", label: "Lookup", icon: "\u{1F50D}" },
      { type: "calculation", label: "Calculation", icon: "\u{1F9EE}" },
      { type: "table", label: "Table", icon: "\u{1F4CB}" },
      { type: "terms", label: "Terms", icon: "\u{1F4DC}" }
    ]
  }
];

export type PropertyTab = "general" | "options" | "logic";

/**
 * Right-panel tabs per field type. Choice + survey types earn an Options tab
 * (choices list or scale config). Static layout blocks show General only —
 * they carry no logic target of their own, and F-2 handles conditional
 * visibility at the section level.
 *
 * The Push tab arrives with F-9; not surfaced here.
 */
export function tabsForFieldType(fieldType: string): PropertyTab[] {
  if (isLayoutOnlyType(fieldType)) return ["general"];
  if (
    CHOICE_TYPES.has(fieldType) ||
    SURVEY_TYPES.has(fieldType) ||
    ADVANCED_TYPES.has(fieldType)
  ) {
    return ["general", "options", "logic"];
  }
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

const DEFAULT_LABEL: Partial<Record<string, string>> = {
  heading: "Section heading",
  paragraph: "Static paragraph",
  divider: "Divider",
  image: "Image",
  lookup: "Lookup",
  calculation: "Calculated total",
  table: "Table",
  terms: "Terms & conditions"
};

function defaultConfigFor(fieldType: FieldType | string): Record<string, unknown> | undefined {
  if (fieldType === "rating") return { maxRating: 5 };
  if (fieldType === "scale") return { min: 1, max: 5, minLabel: "", maxLabel: "" };
  if (fieldType === "image") return { imageUrl: "" };
  if (fieldType === "lookup") return { listSlug: "", parentFieldKey: "" };
  if (fieldType === "calculation") return { operation: "sum", operandKeys: [], decimals: 2 };
  if (fieldType === "table") {
    return {
      columns: [
        { key: "col_1", label: "Column 1", fieldType: "text" },
        { key: "col_2", label: "Column 2", fieldType: "number" }
      ],
      minRows: 1,
      maxRows: 20
    };
  }
  if (fieldType === "terms") {
    return {
      termsText: "I agree to the terms and conditions.",
      termsVersion: "1"
    };
  }
  return undefined;
}

function defaultOptionsFor(fieldType: FieldType | string): string[] | undefined {
  if (CHOICE_TYPES.has(String(fieldType))) return ["Option 1", "Option 2"];
  return undefined;
}

export function makeField(fieldType: FieldType | string, label?: string): DraftField {
  const displayLabel =
    label ?? DEFAULT_LABEL[String(fieldType)] ?? `New ${String(fieldType).replace(/_/g, " ")} field`;
  return {
    tempId: uid(),
    fieldKey: `${keyFromLabel(displayLabel)}_${uid().slice(0, 4)}`,
    label: displayLabel,
    fieldType,
    fieldOrder: 0,
    isRequired: false,
    options: defaultOptionsFor(fieldType),
    config: defaultConfigFor(fieldType)
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
        options: source.options ? [...source.options] : undefined,
        config: source.config ? { ...source.config } : undefined
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

/**
 * Publish-time shape of a single field — mirrors the API's
 * `FormFieldInputDto`. Kept structural (no class) so callers can spread it
 * straight into fetch bodies.
 */
export type FieldPublishPayload = {
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
  optionsJson?: unknown;
  config: Record<string, unknown>;
  /** Populated for content_block fields — the snippet code to resolve at fill time. */
  snippetCode?: string;
};

/**
 * Serialise a designer draft field for the publish endpoint.
 *
 * Two invariants worth calling out:
 * 1. **Layout blocks never publish as required.** The isRequired toggle is
 *    hidden for them in the UI, but this belt-and-braces catches drafts
 *    imported from older shapes where the flag might have been set.
 * 2. **Choice options are mirrored into `config.options`.** FormFillPage's
 *    FieldInput reads options from `field.config.options`; the canonical
 *    `optionsJson` column is preserved for API compatibility.
 */
export function fieldToPublishPayload(field: DraftField): FieldPublishPayload {
  const authoredConfig = (field.config ?? {}) as Record<string, unknown>;
  const mergedConfig: Record<string, unknown> = { ...authoredConfig };
  if (CHOICE_TYPES.has(field.fieldType) && field.options !== undefined) {
    mergedConfig.options = field.options;
  }
  return {
    fieldKey: field.fieldKey,
    label: field.label,
    fieldType: field.fieldType,
    fieldOrder: field.fieldOrder,
    isRequired: isLayoutOnlyType(field.fieldType) ? false : field.isRequired,
    placeholder: field.placeholder,
    helpText: field.helpText,
    optionsJson: field.options,
    config: mergedConfig,
    ...(field.snippetCode ? { snippetCode: field.snippetCode } : {})
  };
}
