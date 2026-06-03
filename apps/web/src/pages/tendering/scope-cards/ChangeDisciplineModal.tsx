import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";
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
    <CenteredModal
      title="Change discipline?"
      onClose={onCancel}
      busy={busy}
      maxWidth={520}
      footer={
        <>
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
        </>
      }
    >
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
    </CenteredModal>
  );
}
