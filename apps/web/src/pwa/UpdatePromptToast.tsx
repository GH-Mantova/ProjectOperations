import { useSyncExternalStore } from "react";
import { isPromptVisible, updatePromptStore } from "./updatePromptStore";

// Non-blocking "new version available" banner. Rendered app-wide so a fresh
// deploy is picked up on any tab — including outside the /field/* offline
// scope. Reload is user-driven (never auto): unsaved wizard/form input would
// be lost otherwise.
export function UpdatePromptToast() {
  const state = useSyncExternalStore(
    updatePromptStore.subscribe,
    updatePromptStore.getSnapshot,
    updatePromptStore.getSnapshot
  );

  if (!isPromptVisible(state)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1000,
        background: "#005B61",
        color: "#fff",
        borderRadius: 12,
        padding: "12px 14px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: 360,
        fontSize: 14,
        fontWeight: 500
      }}
    >
      <span style={{ flex: 1 }}>A new version is available.</span>
      <button
        type="button"
        onClick={() => updatePromptStore.applyUpdate()}
        style={{
          minHeight: 44,
          minWidth: 44,
          background: "#FEAA6D",
          color: "#242424",
          border: 0,
          borderRadius: 8,
          padding: "0 14px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer"
        }}
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => updatePromptStore.dismiss()}
        aria-label="Dismiss update notification"
        style={{
          minHeight: 44,
          minWidth: 44,
          background: "transparent",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.5)",
          borderRadius: 8,
          padding: "0 10px",
          fontSize: 14,
          cursor: "pointer"
        }}
      >
        Later
      </button>
    </div>
  );
}
