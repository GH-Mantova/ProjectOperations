import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export function AnthropicKeyModal({
  open,
  onClose,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch("/admin/platform-config", {
        method: "PATCH",
        body: JSON.stringify({ anthropicApiKey: apiKey.trim() })
      });
      if (!response.ok) throw new Error(await response.text());
      setApiKey("");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="slide-over-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Connect your AI agent"
      onClick={onClose}
    >
      <div className="s7-card anthropic-key-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Connect your AI agent</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          To use AI scope drafting, you need an Anthropic API key. Get yours at{" "}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a> — it
          takes 2 minutes.
        </p>

        <label className="estimate-editor__field">
          <span>API Key</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="s7-input"
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoFocus
            />
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() => setShow((prev) => !prev)}
              aria-label={show ? "Hide" : "Show"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13 }}
          >
            Learn more →
          </a>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => void save()}
              disabled={saving || !apiKey.trim()}
            >
              {saving ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
