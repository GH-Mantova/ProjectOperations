import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export type ProviderKey = "anthropic" | "openai" | "gemini" | "groq";

type KeyStatus = { hasKey: boolean; validatedAt: string | null };
type StatusMap = Record<ProviderKey, KeyStatus>;

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI GPT",
  gemini: "Google Gemini",
  groq: "Groq"
};

const SUPPORTED_PROVIDERS: ProviderKey[] = ["anthropic", "openai"];

// §5A.1 PR 9 — provider key management UI. Used by both the Company tab
// (scope = /ai-settings/company/keys) and My Settings tab
// (scope = /ai-settings/me/keys). The plaintext key is set-once-write-only
// from the client perspective: GETs return only hasKey + validatedAt.
export function ProviderKeyManager({
  scope,
  title,
  description
}: {
  scope: "company" | "me";
  title: string;
  description?: string;
}) {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<StatusMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProviderKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const path = scope === "company" ? "/ai-settings/company/keys" : "/ai-settings/me/keys";

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(path);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setStatus((await res.json()) as StatusMap);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, path]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (provider: ProviderKey, apiKey: string): Promise<void> => {
    const res = await authFetch(`${path}/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey })
    });
    const body = (await res.json()) as
      | { ok: true; validatedAt: string }
      | { ok: false; error: string; category: string };
    if (!res.ok || body.ok === false) {
      const message = body.ok === false ? body.error : `Status ${res.status}`;
      throw new Error(message);
    }
    setEditing(null);
    showToast(`${PROVIDER_LABELS[provider]} key saved`);
    await load();
  };

  const handleDelete = async (provider: ProviderKey): Promise<void> => {
    if (
      !window.confirm(
        `Remove the ${PROVIDER_LABELS[provider]} key? AI features that use this provider will be disabled until a new key is entered.`
      )
    ) {
      return;
    }
    const res = await authFetch(`${path}/${provider}`, { method: "DELETE" });
    if (!res.ok) {
      showToast(`Failed to remove key (status ${res.status})`);
      return;
    }
    showToast(`${PROVIDER_LABELS[provider]} key removed`);
    await load();
  };

  if (loading) {
    return <Section title={title} description={description}><div style={{ color: "var(--text-muted)" }}>Loading…</div></Section>;
  }
  if (error || !status) {
    return (
      <Section title={title} description={description}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
          <span style={{ color: "#B91C1C" }}>Failed to load: {error}</span>
          <button type="button" onClick={() => void load()} style={primaryBtn(false)}>Retry</button>
        </div>
      </Section>
    );
  }

  return (
    <Section title={title} description={description}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map((p) => {
          const isSupported = SUPPORTED_PROVIDERS.includes(p);
          const s = status[p];
          return (
            <div
              key={p}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "var(--surface-card, #FFFFFF)",
                border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                borderRadius: 8
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{PROVIDER_LABELS[p]}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {!isSupported
                    ? "Provider not yet supported"
                    : s.hasKey
                      ? `Configured${s.validatedAt ? ` · validated ${formatDate(s.validatedAt)}` : ""}`
                      : "Not configured"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isSupported ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      style={primaryBtn(false)}
                    >
                      {s.hasKey ? "Update" : "Configure"}
                    </button>
                    {s.hasKey ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(p)}
                        style={ghostBtn()}
                      >
                        Remove
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button type="button" disabled style={primaryBtn(true)}>
                    Configure
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing ? (
        <KeyEditModal
          provider={editing}
          providerLabel={PROVIDER_LABELS[editing]}
          onSave={(key) => handleSave(editing, key)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {toast ? <Toast text={toast} /> : null}
    </Section>
  );
}

function KeyEditModal({
  provider: _provider,
  providerLabel,
  onSave,
  onClose
}: {
  provider: ProviderKey;
  providerLabel: string;
  onSave: (key: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!value.trim()) {
      setError("Enter a key first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSave(value.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 8,
          padding: 20,
          minWidth: 420,
          maxWidth: 540,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
        }}
      >
        <h3 style={{ margin: 0, fontFamily: "'Syne', 'Outfit', sans-serif", fontSize: 18 }}>
          {providerLabel} API Key
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>
          The key is validated against the provider before being saved (5-second timeout).
          Keys are encrypted at rest with AES-256-GCM and never displayed back.
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="API key"
          autoFocus
          disabled={submitting}
          style={{
            width: "100%",
            padding: 10,
            fontSize: 14,
            fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
            border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))",
            borderRadius: 6,
            marginTop: 8,
            boxSizing: "border-box"
          }}
        />
        {error ? (
          <div style={{ color: "#B91C1C", fontSize: 13, marginTop: 8 }}>{error}</div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={ghostBtn()}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            style={primaryBtn(submitting)}
          >
            {submitting ? "Validating…" : "Test and save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 style={{ margin: 0, fontFamily: "'Syne', 'Outfit', sans-serif", fontSize: 18 }}>{title}</h2>
      {description ? (
        <p style={{ color: "var(--text-muted)", marginTop: 4, marginBottom: 12, fontSize: 13 }}>{description}</p>
      ) : (
        <div style={{ height: 12 }} />
      )}
      {children}
    </section>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#005B61",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 6,
        zIndex: 100,
        fontSize: 14
      }}
    >
      {text}
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: disabled ? "var(--text-muted, #6B7280)" : "#005B61",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1
  };
}

function ghostBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: "transparent",
    color: "#005B61",
    border: "1px solid #005B61",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer"
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
