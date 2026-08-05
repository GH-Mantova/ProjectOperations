import type { ReactNode } from "react";

/**
 * F-3 — repeating section entries.
 *
 * Renders N entries of a repeating FormSection's fields. Each entry is an
 * isolated per-field value map (namespaced by entryIndex at submit time by
 * the FormFillPage), with add/remove controls that respect the section's
 * minRepeat / maxRepeat bounds.
 *
 * The component is intentionally presentational: it does not know about
 * autosave, drafts, or rules — those live in FormFillPage. Callers pass in
 * a `renderField` function so the same FieldRender used elsewhere can render
 * one entry's cell without this file having to know about every field type.
 */

type RepeatingField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired: boolean;
};

export type RepeatingSectionEntry = Record<string, unknown>;

export interface RepeatingSectionEntriesProps {
  section: {
    id: string;
    title: string;
    minRepeat?: number | null;
    maxRepeat?: number | null;
    fields: RepeatingField[];
  };
  entries: RepeatingSectionEntry[];
  onChange: (entries: RepeatingSectionEntry[]) => void;
  /** Render one field cell inside an entry. Receives per-entry value + setter. */
  renderField: (args: {
    field: RepeatingField;
    value: unknown;
    onChange: (v: unknown) => void;
    entryIndex: number;
  }) => ReactNode;
}

export function RepeatingSectionEntries({
  section,
  entries,
  onChange,
  renderField
}: RepeatingSectionEntriesProps) {
  const min = Math.max(0, section.minRepeat ?? 0);
  const max = section.maxRepeat != null && section.maxRepeat > 0 ? section.maxRepeat : Infinity;
  const canAdd = entries.length < max;
  const canRemove = entries.length > min;

  const addEntry = () => {
    if (!canAdd) return;
    onChange([...entries, {}]);
  };
  const removeEntry = (idx: number) => {
    if (!canRemove) return;
    onChange(entries.filter((_, i) => i !== idx));
  };
  const updateEntryField = (idx: number, fieldKey: string, value: unknown) => {
    onChange(entries.map((entry, i) => (i === idx ? { ...entry, [fieldKey]: value } : entry)));
  };

  const orderedFields = section.fields.slice().sort((a, b) => a.fieldOrder - b.fieldOrder);

  return (
    <div
      data-testid={`repeating-section-${section.id}`}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {entries.length === 0 ? (
        <div
          style={{
            padding: 12,
            background: "var(--surface-muted, #F6F6F6)",
            borderRadius: 6,
            fontSize: 13,
            color: "var(--text-muted)"
          }}
        >
          No entries yet.
        </div>
      ) : (
        entries.map((entry, entryIndex) => (
          <div
            key={entryIndex}
            data-testid={`repeating-entry-${section.id}-${entryIndex}`}
            style={{
              border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
              borderRadius: 6,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 13, color: "#005B61" }}>
                {section.title} — entry {entryIndex + 1}
              </strong>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => removeEntry(entryIndex)}
                disabled={!canRemove}
                aria-label={`Remove entry ${entryIndex + 1}`}
              >
                Remove
              </button>
            </div>
            {orderedFields.map((field) =>
              renderField({
                field,
                value: entry[field.fieldKey],
                onChange: (v) => updateEntryField(entryIndex, field.fieldKey, v),
                entryIndex
              })
            )}
          </div>
        ))
      )}
      <div>
        <button
          type="button"
          className="s7-btn s7-btn--secondary s7-btn--sm"
          onClick={addEntry}
          disabled={!canAdd}
          aria-label={`Add ${section.title} entry`}
        >
          + Add {section.title}
        </button>
        {section.maxRepeat != null ? (
          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>
            {entries.length}/{section.maxRepeat}
          </span>
        ) : null}
      </div>
    </div>
  );
}
