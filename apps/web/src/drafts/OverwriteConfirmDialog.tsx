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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1100,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 20,
          width: "min(420px, 90vw)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)"
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Overwrite existing draft?</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#4B5563" }}>
          A draft for this form already exists, saved {when}. Overwrite with
          the current values?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
        </div>
      </div>
    </div>
  );
}
