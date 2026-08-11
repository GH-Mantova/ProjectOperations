/**
 * Add-section and Add-field modals for the Handover Template editor.
 * These are controlled dialog overlays — callers drive open/close state.
 */
import { useState, type FormEvent } from "react";
import type { FieldType, SourceType } from "../../pages/settings/handoverTemplateApi";

// ─── Shared dialog styles ─────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000
};

const dialogStyle: React.CSSProperties = {
  background: "var(--surface-base, #fff)",
  border: "1px solid var(--border-default, #e5e7eb)",
  borderRadius: "var(--radius-lg, 8px)",
  padding: "var(--space-6, 24px)",
  width: 420,
  maxWidth: "90vw",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4, 16px)"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "var(--radius-sm, 4px)",
  border: "1px solid var(--border-default, #d1d5db)",
  fontSize: 14,
  boxSizing: "border-box"
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 13,
  fontWeight: 500
};

const btnRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "var(--space-2, 8px)",
  marginTop: "var(--space-2, 8px)"
};

// ─── Add Section Dialog ───────────────────────────────────────────────────────

type AddSectionDialogProps = {
  onConfirm: (label: string) => Promise<void>;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
};

export function AddSectionDialog({ onConfirm, onClose, busy, error }: AddSectionDialogProps) {
  const [label, setLabel] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (label.trim()) {
      void onConfirm(label.trim());
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Add section</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={labelStyle}>
            Section name
            <input
              autoFocus
              required
              style={inputStyle}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Contractor details"
              maxLength={120}
              disabled={busy}
            />
          </label>
          {error && (
            <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 12, margin: 0 }}>
              {error}
            </p>
          )}
          <div style={btnRowStyle}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={busy || !label.trim()}
            >
              {busy ? "Adding…" : "Add section"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Field Dialog ─────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "money", label: "Money" },
  { value: "date", label: "Date" },
  { value: "list", label: "List" },
  { value: "attachment", label: "Attachment" },
  { value: "contact", label: "Contact" }
];

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "auto", label: "Auto (system binding)" },
  { value: "capture", label: "Capture (user entry)" },
  { value: "attach", label: "Attach (file upload)" },
  { value: "derived", label: "Derived (calculated)" }
];

type AddFieldDialogProps = {
  sectionLabel: string;
  onConfirm: (data: {
    label: string;
    type: FieldType;
    sourceType: SourceType;
    autoBinding?: string;
    listId?: string;
    required?: boolean;
  }) => Promise<void>;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
};

export function AddFieldDialog({
  sectionLabel,
  onConfirm,
  onClose,
  busy,
  error
}: AddFieldDialogProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [sourceType, setSourceType] = useState<SourceType>("capture");
  const [autoBinding, setAutoBinding] = useState("");
  const [listId, setListId] = useState("");
  const [required, setRequired] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    void onConfirm({
      label: label.trim(),
      type,
      sourceType,
      autoBinding: sourceType === "auto" ? autoBinding.trim() || undefined : undefined,
      listId: type === "list" ? listId.trim() || undefined : undefined,
      required
    });
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{ ...dialogStyle, width: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>
          Add field — <span style={{ fontWeight: 400 }}>{sectionLabel}</span>
        </h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={labelStyle}>
            Field label
            <input
              autoFocus
              required
              style={inputStyle}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Site contact name"
              maxLength={200}
              disabled={busy}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Type
              <select
                style={inputStyle}
                value={type}
                onChange={(e) => setType(e.target.value as FieldType)}
                disabled={busy}
              >
                {FIELD_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Source type
              <select
                style={inputStyle}
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                disabled={busy}
              >
                {SOURCE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sourceType === "auto" && (
            <label style={labelStyle}>
              Auto-binding key
              <input
                required
                style={inputStyle}
                value={autoBinding}
                onChange={(e) => setAutoBinding(e.target.value)}
                placeholder="e.g. contract.clientName"
                disabled={busy}
              />
            </label>
          )}

          {type === "list" && (
            <label style={labelStyle}>
              List ID (optional)
              <input
                style={inputStyle}
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                placeholder="GlobalList ID or name"
                disabled={busy}
              />
            </label>
          )}

          <label
            style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              disabled={busy}
            />
            Required field
          </label>

          {error && (
            <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 12, margin: 0 }}>
              {error}
            </p>
          )}

          <div style={btnRowStyle}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={busy || !label.trim() || (sourceType === "auto" && !autoBinding.trim())}
            >
              {busy ? "Adding…" : "Add field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
