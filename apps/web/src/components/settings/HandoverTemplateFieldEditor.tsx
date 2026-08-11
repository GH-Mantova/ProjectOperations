/**
 * Field row in the draft editor — inline rename, required toggle,
 * autoBinding/listId edit, retire with confirm, up/down reorder.
 */
import { useState } from "react";
import type { HtField } from "../../pages/settings/handoverTemplateApi";

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  money: "Money",
  date: "Date",
  list: "List",
  attachment: "Attachment",
  contact: "Contact"
};

const SOURCE_LABEL: Record<string, string> = {
  auto: "Auto",
  capture: "Capture",
  attach: "Attach",
  derived: "Derived"
};

const badgeStyle = (retired: boolean): React.CSSProperties => ({
  display: "inline-block",
  fontSize: 10,
  fontWeight: 600,
  padding: "1px 5px",
  borderRadius: 3,
  background: retired ? "var(--surface-muted, #f3f4f6)" : "var(--surface-info-muted, #eff6ff)",
  color: retired ? "var(--text-muted, #6b7280)" : "var(--colour-info, #1d4ed8)",
  marginRight: 4
});

type Props = {
  field: HtField;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => Promise<unknown>;
  onMoveDown: () => Promise<unknown>;
  onUpdate: (dto: {
    label?: string;
    required?: boolean;
    autoBinding?: string | null;
    listId?: string | null;
  }) => Promise<unknown>;
  onRetire: () => Promise<unknown>;
  busy?: boolean;
};

export function HandoverTemplateFieldEditor({
  field,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onRetire,
  busy
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(field.label);
  const [editRequired, setEditRequired] = useState(field.required);
  const [editAutoBinding, setEditAutoBinding] = useState(field.autoBinding ?? "");
  const [editListId, setEditListId] = useState(field.listId ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const isRetired = field.retiredAt !== null;

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate({
        label: editLabel.trim() || field.label,
        required: editRequired,
        autoBinding: field.sourceType === "auto" ? editAutoBinding.trim() || null : undefined,
        listId: field.type === "list" ? editListId.trim() || null : undefined
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditLabel(field.label);
    setEditRequired(field.required);
    setEditAutoBinding(field.autoBinding ?? "");
    setEditListId(field.listId ?? "");
    setEditing(false);
  }

  async function handleRetireConfirm() {
    setSaving(true);
    try {
      await onRetire();
    } finally {
      setSaving(false);
      setConfirmRetire(false);
    }
  }

  const rowStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: "var(--radius-sm, 4px)",
    background: isRetired ? "var(--surface-muted, #f9fafb)" : "var(--surface-base, #fff)",
    border: "1px solid var(--border-default, #e5e7eb)",
    opacity: isRetired ? 0.6 : 1,
    display: "flex",
    flexDirection: "column",
    gap: 6
  };

  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Reorder arrows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--xs"
            disabled={isFirst || busy || saving || isRetired}
            onClick={() => void onMoveUp()}
            aria-label="Move field up"
            style={{ padding: "0 4px", lineHeight: 1 }}
          >
            &#8593;
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--xs"
            disabled={isLast || busy || saving || isRetired}
            onClick={() => void onMoveDown()}
            aria-label="Move field down"
            style={{ padding: "0 4px", lineHeight: 1 }}
          >
            &#8595;
          </button>
        </div>

        {/* Label / edit inline */}
        {editing ? (
          <input
            autoFocus
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            style={{
              flex: 1,
              padding: "3px 6px",
              fontSize: 13,
              border: "1px solid var(--border-default, #d1d5db)",
              borderRadius: 4
            }}
            maxLength={200}
            disabled={saving}
          />
        ) : (
          <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{field.label}</span>
        )}

        {/* Badges */}
        <span style={badgeStyle(false)}>{TYPE_LABEL[field.type] ?? field.type}</span>
        <span style={{ ...badgeStyle(false), background: "var(--surface-muted, #f3f4f6)", color: "var(--text-muted, #6b7280)" }}>
          {SOURCE_LABEL[field.sourceType] ?? field.sourceType}
        </span>
        {isRetired && (
          <span style={{ ...badgeStyle(true), background: "#fee2e2", color: "#991b1b" }}>
            Retired
          </span>
        )}

        {/* Action buttons */}
        {!isRetired && !editing && (
          <>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              disabled={busy || saving}
              onClick={() => setEditing(true)}
              style={{ fontSize: 12 }}
            >
              Edit
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              disabled={busy || saving}
              onClick={() => setConfirmRetire(true)}
              style={{ fontSize: 12, color: "var(--colour-danger, #dc2626)" }}
            >
              Retire
            </button>
          </>
        )}

        {editing && (
          <>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={saving || !editLabel.trim()}
              onClick={() => void handleSave()}
              style={{ fontSize: 12 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              disabled={saving}
              onClick={handleCancelEdit}
              style={{ fontSize: 12 }}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Editable extra fields */}
      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 28 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={editRequired}
              onChange={(e) => setEditRequired(e.target.checked)}
              disabled={saving}
            />
            Required
          </label>

          {field.sourceType === "auto" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
              Auto-binding
              <input
                value={editAutoBinding}
                onChange={(e) => setEditAutoBinding(e.target.value)}
                style={{
                  padding: "3px 6px",
                  fontSize: 12,
                  border: "1px solid var(--border-default, #d1d5db)",
                  borderRadius: 4
                }}
                disabled={saving}
              />
            </label>
          )}

          {field.type === "list" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
              List ID
              <input
                value={editListId}
                onChange={(e) => setEditListId(e.target.value)}
                style={{
                  padding: "3px 6px",
                  fontSize: 12,
                  border: "1px solid var(--border-default, #d1d5db)",
                  borderRadius: 4
                }}
                placeholder="GlobalList ID or name"
                disabled={saving}
              />
            </label>
          )}
        </div>
      )}

      {/* Non-edit extra info */}
      {!editing && (field.required || field.autoBinding || field.listId) && (
        <div style={{ paddingLeft: 28, fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 10 }}>
          {field.required && <span>Required</span>}
          {field.autoBinding && <span>Binding: {field.autoBinding}</span>}
          {field.listId && <span>List: {field.listId}</span>}
        </div>
      )}

      {/* Retire confirm */}
      {confirmRetire && (
        <div
          style={{
            paddingLeft: 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff7ed",
            borderRadius: 4,
            padding: "6px 10px",
            border: "1px solid #fed7aa"
          }}
        >
          <span style={{ fontSize: 12, flex: 1 }}>
            Retire this field? It will be hidden from new handovers but preserved on existing ones.
          </span>
          <button
            type="button"
            className="s7-btn s7-btn--sm"
            disabled={saving}
            onClick={() => void handleRetireConfirm()}
            style={{ fontSize: 12, background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px" }}
          >
            {saving ? "Retiring…" : "Yes, retire"}
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            disabled={saving}
            onClick={() => setConfirmRetire(false)}
            style={{ fontSize: 12 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
