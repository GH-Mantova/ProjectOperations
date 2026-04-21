import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type ProviderKey = "anthropic" | "gemini" | "groq" | "openai";

type ProviderDef = {
  key: ProviderKey;
  label: string;
  placeholder: string;
  defaultModel: string;
  hints: string[];
};

const PROVIDERS: ProviderDef[] = [
  {
    key: "anthropic",
    label: "Claude (Anthropic)",
    placeholder: "sk-ant-…",
    defaultModel: "claude-sonnet-4-6",
    hints: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"]
  },
  {
    key: "openai",
    label: "ChatGPT (OpenAI)",
    placeholder: "sk-…",
    defaultModel: "gpt-4o-mini",
    hints: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini"]
  },
  {
    key: "gemini",
    label: "Gemini (Google)",
    placeholder: "AIza…",
    defaultModel: "gemini-1.5-flash",
    hints: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"]
  },
  {
    key: "groq",
    label: "Llama 3 on Groq",
    placeholder: "gsk_…",
    defaultModel: "llama3-8b-8192",
    hints: ["llama3-8b-8192", "llama3-70b-8192"]
  }
];

export function AddPersonalProviderModal({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [providerKey, setProviderKey] = useState<ProviderKey>("anthropic");
  const def = useMemo(() => PROVIDERS.find((p) => p.key === providerKey)!, [providerKey]);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [label, setLabel] = useState("");
  const [model, setModel] = useState(def.defaultModel);
  const [fetchedModels, setFetchedModels] = useState<string[] | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchProvider = (next: ProviderKey) => {
    const nextDef = PROVIDERS.find((p) => p.key === next)!;
    setProviderKey(next);
    setModel(nextDef.defaultModel);
    setFetchedModels(null);
  };

  const fetchModels = async () => {
    if (!apiKey.trim()) {
      setError("Enter your API key first so we can list available models.");
      return;
    }
    setFetchingModels(true);
    setError(null);
    try {
      const response = await authFetch("/user/ai-providers/list-models", {
        method: "POST",
        body: JSON.stringify({ provider: providerKey, apiKey: apiKey.trim() })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail || body?.message || "Could not fetch models.");
      }
      const body = (await response.json()) as { models: string[] };
      setFetchedModels(body.models);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetchingModels(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch("/user/ai-providers", {
        method: "POST",
        body: JSON.stringify({
          provider: providerKey,
          apiKey: apiKey.trim(),
          label: label.trim() || undefined,
          model: model.trim() || undefined
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          body?.message?.message ??
          body?.message ??
          body?.error ??
          `Save failed (${response.status}).`;
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
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
      aria-label="Add personal AI provider"
      onClick={onClose}
    >
      <div className="s7-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>
          Add a personal AI provider
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          Your key is encrypted at rest and only used for your own AI actions. It is tested against
          the live provider before we save it.
        </p>

        <label className="estimate-editor__field">
          <span>Provider</span>
          <select
            className="s7-input"
            value={providerKey}
            onChange={(e) => switchProvider(e.target.value as ProviderKey)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="estimate-editor__field">
          <span>API Key</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="s7-input"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={def.placeholder}
              autoFocus
            />
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="estimate-editor__field">
          <span>Model</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="s7-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={def.defaultModel}
            />
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() => void fetchModels()}
              disabled={fetchingModels || !apiKey.trim()}
            >
              {fetchingModels ? "Fetching…" : "Fetch models"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {(fetchedModels ?? def.hints).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                style={{
                  padding: "2px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border, #ccc)",
                  background: m === model ? "var(--brand-primary, #005B61)" : "transparent",
                  color: m === model ? "#fff" : "var(--text, #111)",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </label>

        <label className="estimate-editor__field">
          <span>Label (optional)</span>
          <input
            className="s7-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My personal Claude"
          />
        </label>

        {error ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void save()}
            disabled={saving || !apiKey.trim()}
          >
            {saving ? "Testing & saving…" : "Test & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
