import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  hasUnsavedChanges,
  type GlobalSettings,
  type ProviderKey
} from "./ai-settings-helpers";
import { ProviderKeyManager } from "./ProviderKeyManager";

const PROVIDER_LIST: { key: ProviderKey; label: string; isLocked?: boolean }[] = [
  { key: "anthropic", label: "Anthropic Claude", isLocked: true },
  { key: "openai", label: "OpenAI GPT" },
  { key: "gemini", label: "Google Gemini" },
  { key: "groq", label: "Groq" }
];

type PersonaSummary = {
  slug: string;
  displayName: string;
  description: string;
  rootRoutePattern: string;
};

type CompanyInstructionRow = {
  instruction: string;
  updatedAt: string;
  updatedById: string | null;
};

export function CompanySettingsTab() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [global, setGlobal] = useState<GlobalSettings | null>(null);
  const [globalInitial, setGlobalInitial] = useState<GlobalSettings | null>(null);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [globalRes, personasRes] = await Promise.all([
        authFetch("/personas/global-settings"),
        authFetch("/personas")
      ]);
      if (!globalRes.ok) throw new Error(`global-settings: ${globalRes.status}`);
      if (!personasRes.ok) throw new Error(`personas: ${personasRes.status}`);
      const globalBody = (await globalRes.json()) as GlobalSettings;
      const personasBody = (await personasRes.json()) as PersonaSummary[];
      setGlobal(globalBody);
      setGlobalInitial(globalBody);
      setPersonas(personasBody);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const globalDirty = useMemo(
    () => global !== null && globalInitial !== null && hasUnsavedChanges(globalInitial, global),
    [global, globalInitial]
  );

  const [savingGlobal, setSavingGlobal] = useState(false);
  const saveGlobal = useCallback(async () => {
    if (!global) return;
    setSavingGlobal(true);
    try {
      const res = await authFetch("/personas/global-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowUserInstructionOverrides: global.allowUserInstructionOverrides,
          enabledProviders: global.enabledProviders,
          allowBringYourOwnKey: global.allowBringYourOwnKey
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as GlobalSettings;
      setGlobal(body);
      setGlobalInitial(body);
      showToast("Company AI settings saved");
    } catch (err) {
      showToast(`Failed to save: ${(err as Error).message}`);
    } finally {
      setSavingGlobal(false);
    }
  }, [authFetch, global, showToast]);

  const toggleProvider = useCallback((key: ProviderKey, on: boolean) => {
    setGlobal((current) => {
      if (!current) return current;
      const set = new Set(current.enabledProviders);
      if (on) set.add(key);
      else set.delete(key);
      return { ...current, enabledProviders: Array.from(set) };
    });
  }, []);

  if (loading) return <Loading />;
  if (loadError) return <LoadError message={loadError} onRetry={() => void load()} />;
  if (!global) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Section title="Provider Access" description="Which AI providers is the company allowed to use?">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PROVIDER_LIST.map((p) => {
            const enabled = global.enabledProviders.includes(p.key);
            return (
              <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={p.isLocked ? true : enabled}
                  disabled={p.isLocked}
                  onChange={(e) => toggleProvider(p.key, e.target.checked)}
                />
                {p.label}
                {p.isLocked ? (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>(default — required for now)</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="User Customisation">
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={global.allowUserInstructionOverrides}
            onChange={(e) => setGlobal((g) => (g ? { ...g, allowUserInstructionOverrides: e.target.checked } : g))}
          />
          <span>
            <strong>Allow users to add personal instructions to AI personas</strong>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
              When enabled, each user can append their own guidance to the AI&apos;s behaviour.
              The company instruction always applies first; user additions come second.
            </div>
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={global.allowBringYourOwnKey}
            onChange={(e) => setGlobal((g) => (g ? { ...g, allowBringYourOwnKey: e.target.checked } : g))}
          />
          <span>
            <strong>Allow users to bring their own API keys (BYOK)</strong>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
              When enabled, users can add their own AI provider API keys on the My Settings tab.
            </div>
          </span>
        </label>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            disabled={!globalDirty || savingGlobal}
            onClick={() => void saveGlobal()}
            style={primaryButtonStyle(!globalDirty || savingGlobal)}
          >
            {savingGlobal ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Section>

      <Section title="Personas" description="Company-wide instructions for each persona. These are sent as part of every AI request.">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {personas.map((p) => (
            <PersonaInstructionEditor key={p.slug} persona={p} onSaved={() => showToast("Company instruction saved")} onError={(m) => showToast(`Failed to save: ${m}`)} />
          ))}
        </div>
      </Section>

      <ProviderKeyManager
        scope="company"
        title="API Keys"
        description="Company-wide API keys for each AI provider. Keys are validated live against the provider before being stored, and are encrypted at rest (AES-256-GCM)."
      />

      {toast ? <Toast text={toast} /> : null}
    </div>
  );
}

function PersonaInstructionEditor({
  persona,
  onSaved,
  onError
}: {
  persona: PersonaSummary;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<CompanyInstructionRow | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch(`/personas/${persona.slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as { companyInstruction: CompanyInstructionRow };
      })
      .then((body) => {
        if (cancelled) return;
        setRow(body.companyInstruction);
        setDraft(body.companyInstruction.instruction ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setRow({ instruction: "", updatedAt: "", updatedById: null });
        setDraft("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, persona.slug]);

  const dirty = row !== null && draft !== row.instruction;
  const save = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`/personas/${persona.slug}/company-instruction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: draft })
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as CompanyInstructionRow;
      setRow(updated);
      setDraft(updated.instruction);
      onSaved();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--surface-card, #FFFFFF)",
        border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
        borderRadius: 8,
        padding: 16
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontFamily: "'Syne', 'Outfit', sans-serif", fontSize: 16 }}>
          {persona.displayName}
        </h3>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Active on: {persona.rootRoutePattern}/*
        </div>
      </div>
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Company Instruction
          </label>
          <textarea
            rows={10}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write the company's standing guidance for this persona."
            style={{
              width: "100%",
              fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
              fontSize: 13,
              padding: 10,
              border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))",
              borderRadius: 6,
              resize: "vertical"
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void save()}
              style={primaryButtonStyle(!dirty || saving)}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {row?.updatedAt ? (
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Last updated: {new Date(row.updatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </>
      )}
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

function Loading() {
  return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>;
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
      <span style={{ color: "#B91C1C" }}>Failed to load: {message}</span>
      <button type="button" onClick={onRetry} style={primaryButtonStyle(false)}>
        Retry
      </button>
    </div>
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

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
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
