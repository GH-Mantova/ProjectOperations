import { useEffect, useState } from "react";
import {
  deleteDeadLetter,
  listDeadLetter,
  retryDeadLetter,
  type DeadLetterMutation
} from "./db";
import { useOffline } from "./OfflineContext";

// PR F FIX 3 — surfaces queue items that exceeded MAX_ATTEMPTS so the
// field user can review what failed and either retry (back to outbox)
// or discard (gone for good). Shows nothing while the dead-letter
// count is zero so the banner stays out of the way on a healthy device.
export function DeadLetterBanner() {
  const { deadLetterCount, refreshDeadLetterCount, flush } = useOffline();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DeadLetterMutation[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listDeadLetter().then(setItems);
  }, [open]);

  if (deadLetterCount === 0) return null;

  const refreshList = async () => {
    setItems(await listDeadLetter());
    await refreshDeadLetterCount();
  };

  const retryOne = async (id: string) => {
    setBusy(true);
    try {
      await retryDeadLetter(id);
      await refreshList();
      void flush();
    } finally {
      setBusy(false);
    }
  };

  const discardOne = async (id: string) => {
    if (!window.confirm("Discard this failed item? It will be lost permanently.")) return;
    setBusy(true);
    try {
      await deleteDeadLetter(id);
      await refreshList();
    } finally {
      setBusy(false);
    }
  };

  const retryAll = async () => {
    setBusy(true);
    try {
      const all = await listDeadLetter();
      for (const m of all) {
        await retryDeadLetter(m.id);
      }
      await refreshList();
      void flush();
    } finally {
      setBusy(false);
    }
  };

  const discardAll = async () => {
    if (!window.confirm(`Discard all ${deadLetterCount} failed items? They will be lost permanently.`)) return;
    setBusy(true);
    try {
      const all = await listDeadLetter();
      for (const m of all) {
        await deleteDeadLetter(m.id);
      }
      await refreshList();
    } finally {
      setBusy(false);
    }
  };

  const fmtTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return new Date(ts).toISOString();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          width: "100%",
          padding: "10px 14px",
          marginBottom: 12,
          borderRadius: 10,
          background: "#FEF3C7",
          border: "1px solid #F59E0B",
          color: "#78350F",
          fontSize: 13,
          fontWeight: 600,
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        <span aria-hidden>⚠️</span>
        <span>
          {deadLetterCount === 1
            ? "1 item could not sync — tap to review"
            : `${deadLetterCount} items could not sync — tap to review`}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              width: "min(560px, 100%)",
              maxHeight: "85vh",
              borderRadius: "16px 16px 0 0",
              padding: 16,
              overflow: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontFamily: "Syne, Outfit, sans-serif" }}>
                Failed sync items ({items.length})
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            {items.length === 0 ? (
              <p style={{ color: "#6B7280", fontSize: 13 }}>Loading…</p>
            ) : (
              <>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
                  {items.map((m) => (
                    <li
                      key={m.id}
                      style={{
                        padding: 10,
                        border: "1px solid #E5E5E5",
                        borderRadius: 8,
                        marginBottom: 8,
                        fontSize: 13
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{m.kind}</div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                        Failed {fmtTime(m.failedAt)} · {m.attempts} attempts
                      </div>
                      {m.lastError ? (
                        <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 4, wordBreak: "break-word" }}>
                          {m.lastError}
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => void retryOne(m.id)}
                          disabled={busy}
                          style={{
                            background: "#005B61",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            cursor: "pointer"
                          }}
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => void discardOne(m.id)}
                          disabled={busy}
                          style={{
                            background: "transparent",
                            color: "#A32D2D",
                            border: "1px solid #E5E5E5",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            cursor: "pointer"
                          }}
                        >
                          Discard
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                  <button
                    type="button"
                    onClick={() => void retryAll()}
                    disabled={busy}
                    style={{
                      flex: 1,
                      background: "#005B61",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Retry all
                  </button>
                  <button
                    type="button"
                    onClick={() => void discardAll()}
                    disabled={busy}
                    style={{
                      flex: 1,
                      background: "transparent",
                      color: "#A32D2D",
                      border: "1px solid #A32D2D",
                      borderRadius: 8,
                      padding: "10px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Discard all
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
