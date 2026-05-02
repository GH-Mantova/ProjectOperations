import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  dropdownOptionsFromEnabledProviders,
  hasUnsavedChanges,
  shouldShowBYOKSection,
  shouldShowPersonalInstructionField,
  type GlobalSettings,
  type ProviderOption,
  type UserPersonaSettings
} from "./ai-settings-helpers";
import { ProviderKeyManager } from "./ProviderKeyManager";

type PersonaSummary = {
  slug: string;
  displayName: string;
  description: string;
  rootRoutePattern: string;
};

type CompanyInstructionRow = {
  instruction: string;
};

export function MySettingsTab() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [global, setGlobal] = useState<GlobalSettings | null>(null);
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
      // Global settings: needed to know which providers are enabled and whether
      // the personal-instruction / BYOK features are switched on. Non-Super-Users
      // are gated out of this endpoint server-side so we fall back to defaults.
      const [globalRes, personasRes] = await Promise.all([
        authFetch("/personas/global-settings"),
        authFetch("/personas")
      ]);
      const globalBody: GlobalSettings = globalRes.ok
        ? ((await globalRes.json()) as GlobalSettings)
        : { allowUserInstructionOverrides: false, enabledProviders: ["anthropic"], allowBringYourOwnKey: false };
      if (!personasRes.ok) throw new Error(`personas: ${personasRes.status}`);
      const personasBody = (await personasRes.json()) as PersonaSummary[];
      setGlobal(globalBody);
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

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>;
  if (loadError) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
        <span style={{ color: "#B91C1C" }}>Failed to load: {loadError}</span>
        <button type="button" onClick={() => void load()} style={primaryButtonStyle(false)}>
          Retry
        </button>
      </div>
    );
  }
  if (!global) return null;

  const providerOptions = dropdownOptionsFromEnabledProviders(global.enabledProviders);
  const showPersonalInstruction = shouldShowPersonalInstructionField(global);
  const showBYOK = shouldShowBYOKSection(global);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {showBYOK ? (
        <ProviderKeyManager
          scope="me"
          title="Personal API Keys (Bring Your Own Key)"
          description="When set, your personal key is used in place of the company key for the matching provider. Keys are validated live before being stored and are encrypted at rest (AES-256-GCM)."
        />
      ) : (
        <section>
          <h2 style={{ margin: 0, fontFamily: "'Syne', 'Outfit', sans-serif", fontSize: 18 }}>
            Personal API Keys (Bring Your Own Key)
          </h2>
          <div
            style={{
              background: "var(--surface-card, #FFFFFF)",
              border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
              borderRadius: 8,
              padding: 16,
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 12
            }}
          >
            Personal AI keys are disabled by your administrator.
          </div>
        </section>
      )}

      {personas.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
          You don&apos;t have any AI personas assigned yet.
        </div>
      ) : (
        personas.map((p) => (
          <PersonaSettingsCard
            key={p.slug}
            persona={p}
            providerOptions={providerOptions}
            showPersonalInstruction={showPersonalInstruction}
            showBYOK={false}
            onSaved={() => showToast("My settings saved")}
            onError={(m) => showToast(`Failed to save: ${m}`)}
          />
        ))
      )}

      {toast ? (
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
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function PersonaSettingsCard({
  persona,
  providerOptions,
  showPersonalInstruction,
  showBYOK,
  onSaved,
  onError
}: {
  persona: PersonaSummary;
  providerOptions: ProviderOption[];
  showPersonalInstruction: boolean;
  showBYOK: boolean;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companyInstruction, setCompanyInstruction] = useState<string>("");
  const [initial, setInitial] = useState<UserPersonaSettings | null>(null);
  const [current, setCurrent] = useState<UserPersonaSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([authFetch(`/personas/${persona.slug}`), authFetch(`/personas/${persona.slug}/my-settings`)])
      .then(async ([defRes, mineRes]) => {
        if (!defRes.ok) throw new Error(await defRes.text());
        if (!mineRes.ok) throw new Error(await mineRes.text());
        const defBody = (await defRes.json()) as { companyInstruction: CompanyInstructionRow };
        const mineBody = (await mineRes.json()) as UserPersonaSettings;
        return { defBody, mineBody };
      })
      .then(({ defBody, mineBody }) => {
        if (cancelled) return;
        setCompanyInstruction(defBody.companyInstruction.instruction ?? "");
        const settings: UserPersonaSettings = {
          providerOverride: mineBody.providerOverride ?? null,
          instructionOverride: mineBody.instructionOverride ?? null,
          bringYourOwnKey: mineBody.bringYourOwnKey ?? null
        };
        setInitial(settings);
        setCurrent(settings);
      })
      .catch(() => {
        if (cancelled) return;
        const blank: UserPersonaSettings = {
          providerOverride: null,
          instructionOverride: null,
          bringYourOwnKey: null
        };
        setInitial(blank);
        setCurrent(blank);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, persona.slug]);

  const dirty = initial !== null && current !== null && hasUnsavedChanges(initial, current);

  const save = async () => {
    if (!current) return;
    setSaving(true);
    try {
      // Send only the fields the user can actually change in this PR. Personal
      // instruction is omitted entirely when the global toggle is off so we
      // don't accidentally clear an existing override server-side. The API
      // distinguishes undefined (don't touch) from null (clear) — see PR #118.
      const body: Partial<UserPersonaSettings> = {
        providerOverride: current.providerOverride
      };
      if (showPersonalInstruction) {
        body.instructionOverride = current.instructionOverride;
      }
      const res = await authFetch(`/personas/${persona.slug}/my-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as UserPersonaSettings;
      const next: UserPersonaSettings = {
        providerOverride: updated.providerOverride ?? null,
        instructionOverride: updated.instructionOverride ?? null,
        bringYourOwnKey: updated.bringYourOwnKey ?? null
      };
      setInitial(next);
      setCurrent(next);
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
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontFamily: "'Syne', 'Outfit', sans-serif", fontSize: 16 }}>
          {persona.displayName}
        </h3>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Active on: {persona.rootRoutePattern}/*
        </div>
      </div>

      {loading || !current ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Provider override (optional)
            </label>
            <select
              value={current.providerOverride ?? ""}
              onChange={(e) => setCurrent({ ...current, providerOverride: e.target.value === "" ? null : e.target.value })}
              style={{
                padding: "6px 10px",
                fontSize: 14,
                border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))",
                borderRadius: 6,
                minWidth: 240
              }}
            >
              <option value="">Use system default (Anthropic)</option>
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Company Instruction (read-only)
            </label>
            <div
              style={{
                background: "var(--surface-page, #F6F6F6)",
                border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                borderRadius: 6,
                padding: 10,
                fontSize: 13,
                color: "var(--text-primary, #000)",
                whiteSpace: "pre-wrap",
                fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
                minHeight: 60
              }}
            >
              {companyInstruction.trim().length > 0 ? companyInstruction : <em style={{ color: "var(--text-muted)" }}>No company instruction set yet.</em>}
            </div>
          </div>

          {showPersonalInstruction ? (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                My Personal Instruction
              </label>
              <textarea
                rows={6}
                value={current.instructionOverride ?? ""}
                onChange={(e) => setCurrent({ ...current, instructionOverride: e.target.value === "" ? null : e.target.value })}
                placeholder="Add your own personal guidance here. This is added AFTER the company instruction."
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
            </div>
          ) : null}

          {showBYOK ? (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                My API Key (Bring Your Own Key)
              </label>
              <div
                style={{
                  background: "var(--surface-page, #F6F6F6)",
                  border: "1px dashed var(--border-subtle, rgba(0,0,0,0.16))",
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 13,
                  color: "var(--text-muted)"
                }}
              >
                🔒 BYOK is currently in development. The infrastructure to securely store
                your key is still being built. Once it ships, you&apos;ll be able to add your
                personal API key here.
              </div>
            </div>
          ) : null}

          <div>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void save()}
              style={primaryButtonStyle(!dirty || saving)}
            >
              {saving ? "Saving…" : "Save my settings"}
            </button>
          </div>
        </>
      )}
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
