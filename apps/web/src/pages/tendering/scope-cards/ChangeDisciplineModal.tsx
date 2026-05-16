import { useState } from "react";
import type { ScopeCard } from "./useScopeCards";
import { DISCIPLINE_LABELS, disciplineColor, formatCardCode } from "./utils/card-display";

// PR B1.5 — confirmation modal for card discipline change. Shows a
// renumber preview before triggering the cascade endpoint. The new
// cardNumber depends on server-side MAX+1 calculation, so the preview
// uses "?" as the placeholder.

type Props = {
  card: ScopeCard;
  newDiscipline: string;
  itemCount: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

export function ChangeDisciplineModal({ card, newDiscipline, itemCount, onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
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
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 520,
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18 }}>Change discipline?</h3>
        <p style={{ marginTop: 12, lineHeight: 1.5 }}>
          Change card <strong>{card.name}</strong> from{" "}
          <span style={{ color: disciplineColor(card.discipline), fontWeight: 600 }}>
            {card.discipline}
          </span>{" "}
          to{" "}
          <span style={{ color: disciplineColor(newDiscipline), fontWeight: 600 }}>
            {newDiscipline}
          </span>{" "}
          ({DISCIPLINE_LABELS[newDiscipline] ?? newDiscipline})?
        </p>
        {itemCount > 0 ? (
          <p style={{ marginTop: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
            <strong>{itemCount}</strong> item{itemCount === 1 ? "" : "s"} will be renumbered
            ({formatCardCode(card.discipline, card.cardNumber)}.1 →{" "}
            {newDiscipline}<em>?</em>.1, …). Any linked cutting or waste lines
            will be updated automatically. The new card number depends on
            existing {newDiscipline} cards on this tender.
          </p>
        ) : (
          <p style={{ marginTop: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
            The card has no items. Only the discipline label and card number change.
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border, #e5e7eb)", borderRadius: 4, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            style={{ padding: "8px 16px", background: "#005B61", color: "#fff", border: "none", borderRadius: 4, cursor: busy ? "wait" : "pointer" }}
          >
            {busy ? "Changing…" : "Change discipline"}
          </button>
        </div>
      </div>
    </div>
  );
}
