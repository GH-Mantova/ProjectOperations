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

type PlatformIntegrationsStatus = {
  anthropic: {
    configured: boolean;
    source: "database" | "env" | null;
    maskedKey: string | null;
    updatedAt: string | null;
  };
  sharePoint: { mode: string };
};

type SharePointFolder = {
  id: string;
  module: string;
  name: string;
  relativePath: string;
};

export function PlatformPage() {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [integrations, setIntegrations] = useState<PlatformIntegrationsStatus | null>(null);
  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
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

  const saveAnthropicKey = async () => {
    setSavingKey(true);
    setError(null);
    try {
      const response = await authFetch("/admin/platform-config", {
        method: "PATCH",
        body: JSON.stringify({ anthropicApiKey: newKey.trim() })
      });
      if (!response.ok) throw new Error(await response.text());
      setNewKey("");
      setEditingKey(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingKey(false);
    }
  };

  const testAnthropic = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await authFetch("/admin/platform-config/test-anthropic", { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      setTestResult((await response.json()) as { ok: boolean; message: string });
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
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
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>Anthropic API (Claude AI)</strong>
              {integrations?.anthropic.configured ? (
                <span className="s7-badge" style={{ background: "#EAF3DE", color: "#3B6D11" }}>Connected ✓</span>
              ) : (
                <span className="s7-badge" style={{ background: "#FCEBEB", color: "#A32D2D" }}>Not configured</span>
              )}
            </div>
            {!editingKey ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>
                  {integrations?.anthropic.maskedKey ?? "sk-ant-…"}
                </span>
                <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => setEditingKey(true)}>
                  Update key
                </button>
                <button
                  type="button"
                  className="s7-btn s7-btn--secondary s7-btn--sm"
                  onClick={() => void testAnthropic()}
                  disabled={testing || !integrations?.anthropic.configured}
                >
                  {testing ? "Testing…" : "Test connection"}
                </button>
                {integrations?.anthropic.source === "env" ? (
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    (using ANTHROPIC_API_KEY env var — saving a new key here will override)
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
                  placeholder="sk-ant-..."
                  style={{ minWidth: 280 }}
                />
                <button
                  type="button"
                  className="s7-btn s7-btn--primary s7-btn--sm"
                  onClick={() => void saveAnthropicKey()}
                  disabled={savingKey || !newKey.trim()}
                >
                  {savingKey ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={() => {
                    setEditingKey(false);
                    setNewKey("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            {testResult ? (
              <p
                style={{
                  fontSize: 12,
                  color: testResult.ok ? "#3B6D11" : "#A32D2D",
                  marginTop: 6
                }}
              >
                {testResult.message}
              </p>
            ) : null}
          </div>

          <div>
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
