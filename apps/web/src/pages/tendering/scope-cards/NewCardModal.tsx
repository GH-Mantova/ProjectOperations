import { useState } from "react";
import {
  DISCIPLINE_CODES,
  DISCIPLINE_LABELS,
  disciplineColor,
  type DisciplineCode
} from "./utils/card-display";

// PR 5A — modal for card creation with upfront discipline selection.
// Replaces the old inline-input create flow so estimators always pick
// a discipline before the card exists.

type Props = {
  onConfirm: (name: string, discipline: string) => Promise<void>;
  onClose: () => void;
};

export function NewCardModal({ onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<DisciplineCode | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const name = DISCIPLINE_LABELS[selected] ?? selected;
      await onConfirm(name, selected);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="new-card-modal"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface-card, #fff)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: 24,
          maxWidth: 420,
          width: "90%",
          boxShadow: "var(--shadow-dropdown, 0 4px 16px rgba(0,0,0,0.10))"
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add scope card</h3>
        <p style={{ marginTop: 8, marginBottom: 16, color: "var(--text-secondary, #6B7280)", fontSize: 14 }}>
          Choose a discipline for the new card.
        </p>

        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            Discipline
          </legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {DISCIPLINE_CODES.map((code) => {
              const isSelected = selected === code;
              return (
                <label
                  key={code}
                  data-testid={`discipline-option-${code}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: `1.5px solid ${isSelected ? disciplineColor(code) : "var(--border-default, #E5E7EB)"}`,
                    background: isSelected ? `${disciplineColor(code)}0D` : "transparent",
                    cursor: "pointer",
                    transition: "border-color 120ms ease, background 120ms ease"
                  }}
                >
                  <input
                    type="radio"
                    name="discipline"
                    value={code}
                    checked={isSelected}
                    onChange={() => setSelected(code)}
                    style={{ accentColor: disciplineColor(code), width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: disciplineColor(code),
                      flexShrink: 0
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {DISCIPLINE_LABELS[code]} <span style={{ color: "var(--text-muted, #9CA3AF)", fontWeight: 400 }}>({code})</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button
            type="button"
            className="s7-btn s7-btn--secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            disabled={!selected || busy}
            onClick={() => void handleCreate()}
          >
            {busy ? "Creating…" : "Create card"}
          </button>
        </div>
      </div>
    </div>
  );
}
