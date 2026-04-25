import { useOffline } from "./OfflineContext";

// Floating status pill in the bottom-left corner of the field layout. Shows
// connection state + queued mutation count + a "Sync now" button while online.
export function OfflineIndicator() {
  const { online, pendingCount, syncing, flush } = useOffline();

  if (online && pendingCount === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 900,
        background: online ? "#FEAA6D" : "#A32D2D",
        color: online ? "#242424" : "#fff",
        borderRadius: 999,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        gap: 8
      }}
      aria-live="polite"
    >
      <span aria-hidden="true">{online ? "⚠" : "○"}</span>
      <span>
        {online
          ? pendingCount === 1
            ? "1 change waiting to sync"
            : `${pendingCount} changes waiting to sync`
          : "Offline"}
      </span>
      {online && pendingCount > 0 ? (
        <button
          type="button"
          onClick={() => void flush()}
          disabled={syncing}
          style={{
            background: "rgba(0,0,0,0.15)",
            color: "inherit",
            border: 0,
            borderRadius: 999,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 600,
            cursor: syncing ? "wait" : "pointer"
          }}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      ) : null}
    </div>
  );
}
