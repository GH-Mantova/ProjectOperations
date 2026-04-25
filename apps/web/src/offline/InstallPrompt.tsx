import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "project-ops.installPrompt.dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Project Operations"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1200,
        background: "#fff",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 8,
        padding: 14,
        width: 320,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        fontSize: 13
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Install ProjectOps</div>
      <div style={{ color: "#666", marginBottom: 10 }}>
        Add to home screen for offline access on site. Pre-starts, timesheets, and safety reports
        keep working without signal.
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, "1");
            setVisible(false);
          }}
          style={{
            background: "transparent",
            border: "1px solid var(--border, #e5e7eb)",
            color: "#666",
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 12,
            cursor: "pointer"
          }}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => {
            void deferred.prompt();
            void deferred.userChoice.finally(() => {
              setVisible(false);
              setDeferred(null);
            });
          }}
          style={{
            background: "#005B61",
            color: "#fff",
            border: 0,
            borderRadius: 4,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
