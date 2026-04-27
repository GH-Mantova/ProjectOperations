import { useEffect, useState } from "react";

// PR #111 — reusable Save draft button with relative-time
// "Last saved" caption. Orange brand colour per Section 5
// (interactive elements only). Caller wires onSave to the hook's
// saveDraft.

function relativeTime(then: Date): string {
  const diffSec = Math.floor((Date.now() - then.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return then.toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SaveDraftButton({
  onSave,
  lastSavedAt,
  disabled = false
}: {
  onSave: () => Promise<void>;
  lastSavedAt: Date | null;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  // Force a re-render every minute so the relative-time caption stays
  // current without the parent having to drive it.
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [lastSavedAt]);

  const click = async () => {
    setBusy(true);
    try {
      await onSave();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
      <button
        type="button"
        onClick={() => void click()}
        disabled={disabled || busy}
        style={{
          background: "#FEAA6D",
          color: "#1F2937",
          border: "none",
          borderRadius: 8,
          padding: "8px 14px",
          fontWeight: 600,
          fontSize: 13,
          cursor: disabled || busy ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          minHeight: 36
        }}
      >
        {busy ? "Saving…" : "Save draft"}
      </button>
      {lastSavedAt ? (
        <span style={{ fontSize: 11, color: "var(--text-muted, #6B7280)" }}>
          Last saved: {relativeTime(lastSavedAt)}
        </span>
      ) : null}
    </div>
  );
}
