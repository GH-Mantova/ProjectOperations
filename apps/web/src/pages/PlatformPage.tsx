import { useCallback, useEffect, useRef, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type PlatformConfig = {
  sharePoint: {
    mode: string;
    siteId: string;
    driveId: string;
    rootFolder: string;
  };
};

type ProviderKey = "anthropic" | "gemini" | "groq" | "openai";
type ProviderStatus = {
  configured: boolean;
  source: "database" | "env" | null;
  maskedKey: string | null;
  updatedAt: string | null;
  model: string;
};

type PlatformIntegrationsStatus = {
  anthropic: ProviderStatus;
  gemini: ProviderStatus;
  groq: ProviderStatus;
  openai: ProviderStatus;
  preferredProvider: ProviderKey | null;
  activeProvider: ProviderKey | null;
  sharePoint: { mode: string };
};

type SharePointFolder = {
  id: string;
  module: string;
  name: string;
  relativePath: string;
};

type ProviderDefinition = {
  key: ProviderKey;
  label: string;
  blurb: string;
  keyPlaceholder: string;
  modelField: "anthropicModel" | "geminiModel" | "groqModel" | "openaiModel";
  patchField: "anthropicApiKey" | "geminiApiKey" | "groqApiKey" | "openaiApiKey";
  testEndpoint: string;
  defaultModel: string;
  hints: string[];
  extraNote?: string;
};

const PROVIDERS: ProviderDefinition[] = [
  {
    key: "anthropic",
    label: "Claude (Anthropic)",
    blurb: "Primary provider for scope drafting — highest priority when configured.",
    keyPlaceholder: "sk-ant-…",
    modelField: "anthropicModel",
    patchField: "anthropicApiKey",
    testEndpoint: "/admin/platform-config/test-anthropic",
    defaultModel: "claude-sonnet-4-6",
    hints: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"]
  },
  {
    key: "gemini",
    label: "Gemini (Google)",
    blurb: "Falls back to Gemini when Claude isn't configured.",
    keyPlaceholder: "AIza…",
    modelField: "geminiModel",
    patchField: "geminiApiKey",
    testEndpoint: "/admin/platform-config/test-gemini",
    defaultModel: "gemini-1.5-flash",
    hints: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"]
  },
  {
    key: "groq",
    label: "Groq (Llama 3)",
    blurb: "Free-tier fallback provider.",
    keyPlaceholder: "gsk_…",
    modelField: "groqModel",
    patchField: "groqApiKey",
    testEndpoint: "/admin/platform-config/test-groq",
    defaultModel: "llama3-8b-8192",
    hints: ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"]
  },
  {
    key: "openai",
    label: "ChatGPT (OpenAI)",
    blurb: "ChatGPT via the OpenAI API.",
    keyPlaceholder: "sk-…",
    modelField: "openaiModel",
    patchField: "openaiApiKey",
    testEndpoint: "/admin/platform-config/test-openai",
    defaultModel: "gpt-4o-mini",
    hints: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o1-mini", "o3-mini"],
    extraNote:
      "Requires a paid OpenAI account. Check openai.com/api for available models and pricing."
  }
];

export function PlatformPage() {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [integrations, setIntegrations] = useState<PlatformIntegrationsStatus | null>(null);
  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<ProviderKey | null>(null);
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testResult, setTestResult] = useState<Record<ProviderKey, { ok: boolean; message: string } | null>>({
    anthropic: null,
    gemini: null,
    groq: null,
    openai: null
  });
  const [testing, setTesting] = useState<ProviderKey | null>(null);
  const [savingPreferred, setSavingPreferred] = useState(false);
  const [modelDrafts, setModelDrafts] = useState<Record<ProviderKey, string>>({
    anthropic: "",
    gemini: "",
    groq: "",
    openai: ""
  });
  const [fetchingModels, setFetchingModels] = useState<ProviderKey | null>(null);
  const [modelLists, setModelLists] = useState<Record<ProviderKey, string[] | null>>({
    anthropic: null,
    gemini: null,
    groq: null,
    openai: null
  });
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Tendering",
    relativePath: "Project Operations/Tendering",
    module: "tendering"
  });
  const dismissTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const [configResponse, foldersResponse, integrationsResponse] = await Promise.all([
      authFetch("/platform/config"),
      authFetch("/sharepoint/folders"),
      authFetch("/admin/platform-config")
    ]);
    if (!configResponse.ok || !foldersResponse.ok) {
      throw new Error("Unable to load platform configuration.");
    }
    setConfig(await configResponse.json());
    setFolders(await foldersResponse.json());
    if (integrationsResponse.ok) {
      const status = (await integrationsResponse.json()) as PlatformIntegrationsStatus;
      setIntegrations(status);
      setModelDrafts({
        anthropic: status.anthropic.model,
        gemini: status.gemini.model,
        groq: status.groq.model,
        openai: status.openai.model
      });
    }
  }, [authFetch]);

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    dismissTimer.current = window.setTimeout(() => setToast(null), 3000);
    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    };
  }, [toast]);

  const saveKey = async (provider: ProviderDefinition) => {
    setSavingKey(true);
    setError(null);
    try {
      const response = await authFetch("/admin/platform-config", {
        method: "PATCH",
        body: JSON.stringify({ [provider.patchField]: newKey.trim() })
      });
      if (!response.ok) throw new Error(await response.text());
      setNewKey("");
      setEditingKey(null);
      setShowKey(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingKey(false);
    }
  };

  const saveModel = async (provider: ProviderDefinition) => {
    const next = modelDrafts[provider.key].trim() || null;
    if (integrations && next === integrations[provider.key].model && next !== null) return;
    try {
      const response = await authFetch("/admin/platform-config", {
        method: "PATCH",
        body: JSON.stringify({ [provider.modelField]: next })
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
      setToast(`${provider.label} model saved`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const testConnection = async (provider: ProviderDefinition) => {
    setTesting(provider.key);
    setTestResult((prev) => ({ ...prev, [provider.key]: null }));
    try {
      const response = await authFetch(provider.testEndpoint, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { ok: boolean; message: string };
      setTestResult((prev) => ({ ...prev, [provider.key]: payload }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [provider.key]: { ok: false, message: (err as Error).message }
      }));
    } finally {
      setTesting(null);
    }
  };

  const fetchModels = async (provider: ProviderDefinition) => {
    setFetchingModels(provider.key);
    try {
      const response = await authFetch(`/admin/ai-providers/${provider.key}/models`);
      if (!response.ok) {
        setToast("Could not fetch models — check your API key");
        return;
      }
      const body = (await response.json()) as { models: string[] };
      setModelLists((prev) => ({ ...prev, [provider.key]: body.models }));
    } catch {
      setToast("Could not fetch models — check your API key");
    } finally {
      setFetchingModels(null);
    }
  };

  const setPreferredProvider = async (next: ProviderKey | "auto") => {
    setSavingPreferred(true);
    setError(null);
    try {
      const response = await authFetch("/admin/platform-config", {
        method: "PATCH",
        body: JSON.stringify({ preferredProvider: next })
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingPreferred(false);
    }
  };

  const ensureFolder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const response = await authFetch("/sharepoint/folders/ensure", {
      method: "POST",
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setError("Unable to ensure SharePoint folder.");
      return;
    }

    await load();
  };

  const activeLabel = integrations?.activeProvider
    ? PROVIDERS.find((p) => p.key === integrations.activeProvider)?.label ?? integrations.activeProvider
    : null;

  return (
    <div className="admin-grid">
      <AppCard title="AI & Integrations" subtitle="Connect external services used across the workspace.">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>Active provider</strong>
              {activeLabel ? (
                <span className="s7-badge" style={{ background: "#EAF3DE", color: "#3B6D11" }}>
                  {activeLabel} ✓
                </span>
              ) : (
                <span className="s7-badge" style={{ background: "#FAEEDA", color: "#854F0B" }}>
                  Mock fallback — configure an API key below
                </span>
              )}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 0 8px" }}>
              Scope drafting routes to the preferred provider when set, otherwise falls back
              Claude → Gemini → Groq → OpenAI. If none are configured it returns a mock
              scope item so the flow still works for demos.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["auto", "anthropic", "gemini", "groq", "openai"] as const).map((value) => {
                const label = value === "auto" ? "Auto" : PROVIDERS.find((p) => p.key === value)?.label ?? value;
                const active =
                  value === "auto"
                    ? integrations?.preferredProvider == null
                    : integrations?.preferredProvider === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className="s7-btn s7-btn--sm"
                    onClick={() => void setPreferredProvider(value)}
                    disabled={savingPreferred}
                    style={{
                      background: active ? "#FEAA6D" : "transparent",
                      color: active ? "#1F2937" : "var(--text-primary)",
                      border: `1px solid ${active ? "#FEAA6D" : "var(--border-subtle, rgba(0,0,0,0.15))"}`,
                      borderRadius: 999,
                      padding: "6px 14px",
                      fontWeight: active ? 600 : 400,
                      cursor: savingPreferred ? "default" : "pointer"
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {PROVIDERS.map((provider) => {
            const status = integrations?.[provider.key];
            const isEditing = editingKey === provider.key;
            const result = testResult[provider.key];
            const models = modelLists[provider.key];
            return (
              <div
                key={provider.key}
                style={{
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{provider.label}</strong>
                  {status?.configured ? (
                    <span className="s7-badge" style={{ background: "#EAF3DE", color: "#3B6D11" }}>Connected ✓</span>
                  ) : (
                    <span className="s7-badge" style={{ background: "#FCEBEB", color: "#A32D2D" }}>Not configured</span>
                  )}
                  {integrations?.activeProvider === provider.key ? (
                    <span className="s7-badge" style={{ background: "#FEAA6D", color: "#3E1C00" }}>In use</span>
                  ) : null}
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 0 10px" }}>{provider.blurb}</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* API key row */}
                  {!isEditing ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>
                        {status?.maskedKey ?? provider.keyPlaceholder}
                      </span>
                      <button
                        type="button"
                        className="s7-btn s7-btn--secondary s7-btn--sm"
                        onClick={() => {
                          setEditingKey(provider.key);
                          setNewKey("");
                          setShowKey(false);
                        }}
                      >
                        Update key
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--secondary s7-btn--sm"
                        onClick={() => void testConnection(provider)}
                        disabled={testing !== null || !status?.configured}
                      >
                        {testing === provider.key ? "Testing…" : "Test connection"}
                      </button>
                      {status?.source === "env" ? (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          (using env var — saving a new key here will override)
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          className="s7-input"
                          type={showKey ? "text" : "password"}
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          placeholder={provider.keyPlaceholder}
                          style={{ minWidth: 280 }}
                        />
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          onClick={() => setShowKey((s) => !s)}
                        >
                          {showKey ? "Hide" : "Show"}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="s7-btn s7-btn--primary s7-btn--sm"
                        onClick={() => void saveKey(provider)}
                        disabled={savingKey || !newKey.trim()}
                      >
                        {savingKey ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => {
                          setEditingKey(null);
                          setNewKey("");
                          setShowKey(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Model input + fetch models */}
                  <div>
                    <label
                      className="s7-type-label"
                      style={{ display: "block", marginBottom: 4, fontSize: 11 }}
                    >
                      Model
                    </label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        className="s7-input"
                        value={modelDrafts[provider.key]}
                        onChange={(e) =>
                          setModelDrafts((prev) => ({ ...prev, [provider.key]: e.target.value }))
                        }
                        onBlur={() => void saveModel(provider)}
                        placeholder={`e.g. ${provider.defaultModel}`}
                        style={{ minWidth: 280, fontFamily: "monospace" }}
                      />
                      <button
                        type="button"
                        className="s7-btn s7-btn--sm"
                        onClick={() => void fetchModels(provider)}
                        disabled={fetchingModels !== null || !status?.configured}
                        style={{
                          background: "transparent",
                          color: "#854F0B",
                          borderColor: "#FEAA6D",
                          border: "1px solid #FEAA6D"
                        }}
                      >
                        {fetchingModels === provider.key ? "Fetching…" : "Fetch available models"}
                      </button>
                    </div>

                    {models ? (
                      <div
                        style={{
                          marginTop: 6,
                          maxHeight: 200,
                          overflowY: "auto",
                          border: "1px solid var(--border-subtle, rgba(0,0,0,0.12))",
                          borderRadius: 6,
                          background: "var(--surface-card, white)"
                        }}
                      >
                        {models.length === 0 ? (
                          <p style={{ margin: 8, color: "var(--text-muted)", fontSize: 12 }}>
                            No models available.
                          </p>
                        ) : (
                          models.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setModelDrafts((prev) => ({ ...prev, [provider.key]: m }));
                                setModelLists((prev) => ({ ...prev, [provider.key]: null }));
                                void saveModel({ ...provider });
                              }}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "6px 10px",
                                border: 0,
                                background: "transparent",
                                fontFamily: "monospace",
                                fontSize: 13,
                                cursor: "pointer"
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = "var(--surface-subtle, rgba(0,0,0,0.04))")
                              }
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              {m}
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {provider.hints.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() =>
                            setModelDrafts((prev) => ({ ...prev, [provider.key]: h }))
                          }
                          style={{
                            background: "#F1EFE8",
                            border: 0,
                            borderRadius: 999,
                            padding: "2px 10px",
                            fontSize: 12,
                            fontFamily: "monospace",
                            cursor: "pointer",
                            color: "#374151"
                          }}
                        >
                          {h}
                        </button>
                      ))}
                    </div>

                    <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "6px 0 0" }}>
                      Type any valid model name or fetch your account's available models. New
                      models work immediately without any app updates.
                    </p>
                    {provider.extraNote ? (
                      <p style={{ color: "var(--text-muted)", fontSize: 11, margin: "4px 0 0" }}>
                        {provider.extraNote}
                      </p>
                    ) : null}
                  </div>

                  {result ? (
                    <p style={{ fontSize: 12, color: result.ok ? "#3B6D11" : "#A32D2D" }}>
                      {result.message}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}

          <div style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>SharePoint</strong>
              {integrations?.sharePoint.mode === "live" || integrations?.sharePoint.mode === "graph" ? (
                <span className="s7-badge" style={{ background: "#EAF3DE", color: "#3B6D11" }}>Live (Graph API)</span>
              ) : (
                <span className="s7-badge" style={{ background: "#FAEEDA", color: "#854F0B" }}>Mock mode</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Controlled by the <code>SHAREPOINT_MODE</code> env var (mock / live / graph). Set to live to enable document preview links.
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard title="Platform Configuration" subtitle="SharePoint and shared services foundation">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="notice-banner">
          <strong>Current operating posture</strong>
          <p className="muted-text">
            The app is still using the tracked SharePoint abstraction for local and pilot workflows. Keep using this workspace to verify the folder model before switching to live Graph-backed provisioning.
          </p>
        </div>
        <div className="module-summary-grid">
          <div className="module-summary-card">
            <strong>{config?.sharePoint.mode ?? "-"}</strong>
            <span>SharePoint mode</span>
          </div>
          <div className="module-summary-card">
            <strong>{folders.length}</strong>
            <span>Tracked folders</span>
          </div>
          <div className="module-summary-card">
            <strong>{config?.sharePoint.rootFolder ?? "-"}</strong>
            <span>Root operational folder</span>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>SharePoint mode</dt>
            <dd>{config?.sharePoint.mode ?? "-"}</dd>
          </div>
          <div>
            <dt>Site ID</dt>
            <dd>{config?.sharePoint.siteId ?? "-"}</dd>
          </div>
          <div>
            <dt>Library ID</dt>
            <dd>{config?.sharePoint.driveId ?? "-"}</dd>
          </div>
          <div>
            <dt>Root folder</dt>
            <dd>{config?.sharePoint.rootFolder ?? "-"}</dd>
          </div>
        </dl>
        <div className="table-shell table-shell--capped">
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Name</th>
                <th>Relative path</th>
              </tr>
            </thead>
            <tbody>
              {folders.map((folder) => (
                <tr key={folder.id}>
                  <td>{folder.module}</td>
                  <td>{folder.name}</td>
                  <td>{folder.relativePath}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!folders.length ? <p className="module-empty-state">No SharePoint folders have been tracked yet.</p> : null}
        </div>
      </AppCard>

      <AppCard title="Ensure Folder" subtitle="Create or confirm the operational folder structure without leaving the ERP.">
        <form className="admin-form" onSubmit={ensureFolder}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Relative path
            <input
              value={form.relativePath}
              onChange={(event) => setForm({ ...form, relativePath: event.target.value })}
            />
          </label>
          <label>
            Module
            <input value={form.module} onChange={(event) => setForm({ ...form, module: event.target.value })} />
          </label>
          <button type="submit">Ensure Folder</button>
        </form>
      </AppCard>

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
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            zIndex: 100
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
