import { useCallback, useEffect, useState } from "react";
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

type ProviderKey = "anthropic" | "gemini" | "groq";
type ProviderStatus = {
  configured: boolean;
  source: "database" | "env" | null;
  maskedKey: string | null;
  updatedAt: string | null;
};

type PlatformIntegrationsStatus = {
  anthropic: ProviderStatus;
  gemini: ProviderStatus;
  groq: ProviderStatus;
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
  testEndpoint: string;
  patchField: "anthropicApiKey" | "geminiApiKey" | "groqApiKey";
};

const PROVIDERS: ProviderDefinition[] = [
  {
    key: "anthropic",
    label: "Claude (Anthropic)",
    blurb: "claude-sonnet-4-6 — primary provider for scope drafting when configured.",
    keyPlaceholder: "sk-ant-…",
    testEndpoint: "/admin/platform-config/test-anthropic",
    patchField: "anthropicApiKey"
  },
  {
    key: "gemini",
    label: "Gemini (Google)",
    blurb: "gemini-1.5-flash — falls back to this provider when Claude isn't configured.",
    keyPlaceholder: "AIza…",
    testEndpoint: "/admin/platform-config/test-gemini",
    patchField: "geminiApiKey"
  },
  {
    key: "groq",
    label: "Groq (Llama 3)",
    blurb: "llama3-8b-8192 — free-tier fallback provider.",
    keyPlaceholder: "gsk_…",
    testEndpoint: "/admin/platform-config/test-groq",
    patchField: "groqApiKey"
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
  const [savingKey, setSavingKey] = useState(false);
  const [testResult, setTestResult] = useState<Record<ProviderKey, { ok: boolean; message: string } | null>>({
    anthropic: null,
    gemini: null,
    groq: null
  });
  const [testing, setTesting] = useState<ProviderKey | null>(null);
  const [savingPreferred, setSavingPreferred] = useState(false);
  const [form, setForm] = useState({
    name: "Tendering",
    relativePath: "Project Operations/Tendering",
    module: "tendering"
  });

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
      setIntegrations((await integrationsResponse.json()) as PlatformIntegrationsStatus);
    }
  }, [authFetch]);

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, [load]);

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
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingKey(false);
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

  return (
    <div className="admin-grid">
      <AppCard title="AI & Integrations" subtitle="Connect external services used across the workspace.">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>AI Provider</strong>
              {integrations?.activeProvider ? (
                <span className="s7-badge" style={{ background: "#EAF3DE", color: "#3B6D11" }}>
                  Active: {PROVIDERS.find((p) => p.key === integrations.activeProvider)?.label ?? integrations.activeProvider}
                </span>
              ) : (
                <span className="s7-badge" style={{ background: "#FCEBEB", color: "#A32D2D" }}>
                  None configured
                </span>
              )}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 0 8px" }}>
              Scope drafting routes to the preferred provider when set, otherwise falls back through
              Claude → Gemini → Groq in order.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["auto", "anthropic", "gemini", "groq"] as const).map((value) => {
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
                <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 0 8px" }}>{provider.blurb}</p>
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
                    <input
                      className="s7-input"
                      type="password"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder={provider.keyPlaceholder}
                      style={{ minWidth: 280 }}
                    />
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
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {result ? (
                  <p style={{ fontSize: 12, color: result.ok ? "#3B6D11" : "#A32D2D", marginTop: 6 }}>
                    {result.message}
                  </p>
                ) : null}
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
    </div>
  );
}
