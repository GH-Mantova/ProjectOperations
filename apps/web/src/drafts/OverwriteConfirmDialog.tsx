import { CenteredModal } from "@project-ops/ui";

// PR #111 — modal shown when manual saveDraft detects an existing draft
// for (current user, this form). The hook calls onOverwriteConfirm which
// can render this dialog and resolve true/false. Kept tiny so callers
// can drop it inline without their own modal infra.

export function OverwriteConfirmDialog({
  existingUpdatedAt,
  onConfirm,
  onCancel
}: {
  existingUpdatedAt: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const when = new Date(existingUpdatedAt).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  return (
    <CenteredModal
      title="Overwrite existing draft?"
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: "#FEAA6D",
              color: "#1F2937",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Overwrite
          </button>
        </>
      }
    >
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#4B5563" }}>
        A draft for this form already exists, saved {when}. Overwrite with
        the current values?
      </p>
    </CenteredModal>
  );
}
