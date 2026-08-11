/**
 * Section row in the draft editor — inline rename, delete with confirm,
 * up/down reorder, and the list of fields within.
 */
import { useState } from "react";
import type { HtSection, HtField, AddFieldDto } from "../../pages/settings/handoverTemplateApi";
import { HandoverTemplateFieldEditor } from "./HandoverTemplateFieldEditor";
import { AddFieldDialog } from "./HandoverTemplateAddDialogs";

type SectionCallbacks = {
  onRename: (sectionId: string, label: string) => Promise<unknown>;
  onDelete: (sectionId: string) => Promise<unknown>;
  onMoveUp: (sectionId: string) => Promise<unknown>;
  onMoveDown: (sectionId: string) => Promise<unknown>;
  onAddField: (sectionId: string, dto: AddFieldDto) => Promise<unknown>;
  onFieldMoveUp: (sectionId: string, fieldId: string) => Promise<unknown>;
  onFieldMoveDown: (sectionId: string, fieldId: string) => Promise<unknown>;
  onFieldUpdate: (
    fieldId: string,
    dto: {
      label?: string;
      required?: boolean;
      autoBinding?: string | null;
      listId?: string | null;
    }
  ) => Promise<unknown>;
  onFieldRetire: (fieldId: string) => Promise<unknown>;
  globalBusy?: boolean;
};

type Props = {
  section: HtSection;
  isFirst: boolean;
  isLast: boolean;
} & SectionCallbacks;

export function HandoverTemplateSectionEditor({
  section,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddField,
  onFieldMoveUp,
  onFieldMoveDown,
  onFieldUpdate,
  onFieldRetire,
  globalBusy
}: Props) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(section.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [addFieldBusy, setAddFieldBusy] = useState(false);
  const [addFieldError, setAddFieldError] = useState<string | null>(null);

  async function handleRename() {
    const trimmed = labelValue.trim();
    if (!trimmed || trimmed === section.label) {
      setEditingLabel(false);
      setLabelValue(section.label);
      return;
    }
    setSaving(true);
    try {
      await onRename(section.id, trimmed);
      setEditingLabel(false);
    } catch (err) {
      setLabelValue(section.label);
      setEditingLabel(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onDelete(section.id);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  async function handleAddField(dto: AddFieldDto) {
    setAddFieldBusy(true);
    setAddFieldError(null);
    try {
      await onAddField(section.id, dto);
      setShowAddField(false);
    } catch (err) {
      setAddFieldError(err instanceof Error ? err.message : "Failed to add field.");
    } finally {
      setAddFieldBusy(false);
    }
  }

  const sectionStyle: React.CSSProperties = {
    border: "1px solid var(--border-default, #e5e7eb)",
    borderRadius: "var(--radius-md, 6px)",
    background: "var(--surface-raised, #f9fafb)",
    overflow: "hidden"
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    background: "var(--surface-elevated, #f3f4f6)",
    borderBottom: "1px solid var(--border-default, #e5e7eb)"
  };

  // Separate active and retired fields
  const activeFields = section.fields.filter((f: HtField) => !f.retiredAt);
  const retiredFields = section.fields.filter((f: HtField) => f.retiredAt !== null);
  const sortedFields = [...activeFields, ...retiredFields];

  return (
    <div style={sectionStyle}>
      {/* Section header */}
      <div style={headerStyle}>
        {/* Reorder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--xs"
            disabled={isFirst || globalBusy || saving}
            onClick={() => void onMoveUp(section.id)}
            aria-label="Move section up"
            style={{ padding: "0 4px", lineHeight: 1 }}
          >
            &#8593;
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--xs"
            disabled={isLast || globalBusy || saving}
            onClick={() => void onMoveDown(section.id)}
            aria-label="Move section down"
            style={{ padding: "0 4px", lineHeight: 1 }}
          >
            &#8595;
          </button>
        </div>

        {/* Label / inline edit */}
        {editingLabel ? (
          <input
            autoFocus
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={() => void handleRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
              if (e.key === "Escape") {
                setLabelValue(section.label);
                setEditingLabel(false);
              }
            }}
            style={{
              flex: 1,
              padding: "3px 6px",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid var(--border-default, #d1d5db)",
              borderRadius: 4
            }}
            maxLength={120}
            disabled={saving}
          />
        ) : (
          <span
            style={{ flex: 1, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
            title="Click to rename"
            onClick={() => setEditingLabel(true)}
          >
            {section.label}
          </span>
        )}

        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
          {section.fields.length} field{section.fields.length !== 1 ? "s" : ""}
        </span>

        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={globalBusy || saving}
          onClick={() => setEditingLabel(true)}
          style={{ fontSize: 12 }}
        >
          Rename
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={globalBusy || saving}
          onClick={() => setConfirmDelete(true)}
          style={{ fontSize: 12, color: "var(--colour-danger, #dc2626)" }}
        >
          Delete
        </button>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          style={{
            padding: "8px 12px",
            background: "#fff7ed",
            borderBottom: "1px solid #fed7aa",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <span style={{ flex: 1, fontSize: 13 }}>
            Delete section <strong>{section.label}</strong> and all its fields? This cannot be undone on the draft.
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleDelete()}
            style={{
              fontSize: 12,
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer"
            }}
          >
            {saving ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            disabled={saving}
            onClick={() => setConfirmDelete(false)}
            style={{ fontSize: 12 }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Fields list */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {sortedFields.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            No fields yet. Add one below.
          </p>
        )}
        {sortedFields.map((field: HtField) => {
          const activeIdx = activeFields.indexOf(field);
          const isFieldFirst = activeIdx === 0;
          const isFieldLast = activeIdx === activeFields.length - 1;
          return (
            <HandoverTemplateFieldEditor
              key={field.id}
              field={field}
              isFirst={isFieldFirst}
              isLast={isFieldLast || field.retiredAt !== null}
              onMoveUp={() => onFieldMoveUp(section.id, field.id)}
              onMoveDown={() => onFieldMoveDown(section.id, field.id)}
              onUpdate={(dto) => onFieldUpdate(field.id, dto)}
              onRetire={() => onFieldRetire(field.id)}
              busy={globalBusy}
            />
          );
        })}

        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => setShowAddField(true)}
          disabled={globalBusy}
          style={{ alignSelf: "flex-start", marginTop: 4, fontSize: 12 }}
        >
          + Add field
        </button>
      </div>

      {/* Add field dialog */}
      {showAddField && (
        <AddFieldDialog
          sectionLabel={section.label}
          onConfirm={handleAddField}
          onClose={() => {
            setShowAddField(false);
            setAddFieldError(null);
          }}
          busy={addFieldBusy}
          error={addFieldError}
        />
      )}
    </div>
  );
}
