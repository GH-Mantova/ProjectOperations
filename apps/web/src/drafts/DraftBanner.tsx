import { useEffect, useState } from "react";
import { FormDraftStore } from "./FormDraftStore";

// PR #111 — banner shown at the top of a form when a saved draft
// exists for (current user, this form type). Restore loads the draft
// into the form via the hook's restoreDraft callback; Discard clears
// the record. Caller renders this conditionally on hasDraft.

function relativeTime(then: Date): string {
  const diffSec = Math.floor((Date.now() - then.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return then.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function DraftBanner({
  userId,
  formType,
  onRestore,
  onDiscard
}: {
  userId: string | null;
  formType: string;
  onRestore: () => Promise<void> | void;
  onDiscard: () => Promise<void> | void;
}) {
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Read the timestamp on mount so the banner can show "saved 2h ago".
  // Re-runs when the user or form changes.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const row = await FormDraftStore.get(userId, formType);
        if (!cancelled) setUpdatedAt(row ? new Date(row.updatedAt) : null);
      } catch {
        if (!cancelled) setUpdatedAt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, formType]);

  if (hidden || !updatedAt) return null;

  const handleRestore = async () => {
    setBusy(true);
    try {
      await onRestore();
      setHidden(true);
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm("Discard this draft? This cannot be undone.")) return;
    setBusy(true);
    try {
      await onDiscard();
      setHidden(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      style={{
        padding: "10px 14px",
        marginBottom: 12,
        background: "#FEF3C7",
        border: "1px solid #F59E0B",
        borderRadius: 8,
        color: "#78350F",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }}
    >
      <span style={{ fontSize: 16 }} aria-hidden>📝</span>
      <span style={{ flex: 1, minWidth: 200 }}>
        You have an unsaved draft from {relativeTime(updatedAt)}.
      </span>
      <button
        type="button"
        onClick={() => void handleRestore()}
        disabled={busy}
        style={{
          background: "#FEAA6D",
          color: "#1F2937",
          border: "none",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer"
        }}
      >
        Restore draft
      </button>
      <button
        type="button"
        onClick={() => void handleDiscard()}
        disabled={busy}
        style={{
          background: "transparent",
          color: "#78350F",
          border: "1px solid #F59E0B",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer"
        }}
      >
        Discard
      </button>
    </div>
  );
}
