import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../hooks/useConfirm";

type PlatformConfig = {
  sharePoint: {
    mode: string;
    siteId: string;
    driveId: string;
    rootFolder: string;
  };
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
  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Tendering",
    relativePath: "Project Operations/Tendering",
    module: "tendering"
  });

  const load = useCallback(async () => {
    const [configResponse, foldersResponse] = await Promise.all([
      authFetch("/platform/config"),
      authFetch("/sharepoint/folders")
    ]);
    if (!configResponse.ok || !foldersResponse.ok) {
      throw new Error("Unable to load platform configuration.");
    }
    setConfig(await configResponse.json());
    setFolders(await foldersResponse.json());
  }, [authFetch]);

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, [load]);

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
      <AppCard
        title="AI & Integrations"
        subtitle="AI provider API keys and model selection."
      >
        <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0 0 16px" }}>
          AI provider configuration (Anthropic, Gemini, Groq, OpenAI) — including API keys,
          model selection, and preferred provider — is managed in{" "}
          <strong>Settings &rarr; AI settings</strong>.
        </p>
        <Link to="/settings/ai" className="s7-btn s7-btn--primary">
          Open AI settings
        </Link>
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

      <AppCard
        title="Platform integrations — SharePoint"
        subtitle="SharePoint tenant, site, and library bindings plus the root folder tree used by Project Operations. SHAREPOINT_MODE is set by environment."
      >
        <SharePointTestPanel />
        <SharePointFolderMappingsPanel />
        <XeroPanel />
      </AppCard>
    </div>
  );
}

function SharePointTestPanel() {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ connected: boolean; mode: string; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await authFetch("/sharepoint/test");
      if (!response.ok) throw new Error(await response.text());
      setResult(await response.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="s7-card" style={{ marginTop: 12 }}>
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>SharePoint connection</h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 10px" }}>
        Probes the configured adapter. Mock mode always returns OK. Live mode performs a benign
        ensureFolder call against the configured root.
      </p>
      <button type="button" className="s7-btn s7-btn--secondary" onClick={() => void run()} disabled={busy}>
        {busy ? "Testing…" : "Test connection"}
      </button>
      {error ? (
        <p style={{ color: "var(--status-danger)", marginTop: 10 }}>{error}</p>
      ) : null}
      {result ? (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 6,
            background: result.connected ? "rgba(22, 163, 74, 0.10)" : "rgba(245, 158, 11, 0.10)",
            borderLeft: `4px solid ${result.connected ? "#16a34a" : "#f59e0b"}`,
            fontSize: 13
          }}
        >
          <strong>{result.connected ? "Connected" : "Unavailable"}</strong> — mode: <code>{result.mode}</code>
          {result.message ? <div style={{ marginTop: 4 }}>{result.message}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

// SharePoint folder mappings — DB-backed, super-user-only. Same idea as
// the Rates admin: which folder each entity's documents live in is a
// business decision, not a deployment setting. Server enforces
// super-user; this hides the panel from everyone else so it doesn't
// look editable when it isn't.
type FolderMapping = {
  id: string;
  entityType: "TENDER" | "JOB";
  folderPath: string;
  isActive: boolean;
  updatedAt: string;
};

const ENTITY_LABELS: Record<FolderMapping["entityType"], string> = {
  TENDER: "Tender",
  JOB: "Job"
};

function SharePointFolderMappingsPanel() {
  const { authFetch, user } = useAuth();
  const isSuperUser = user?.isSuperUser === true;
  const [mappings, setMappings] = useState<FolderMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ entityType: FolderMapping["entityType"]; path: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSuperUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/admin/sharepoint-folder-mappings");
      if (!response.ok) throw new Error(await response.text());
      setMappings((await response.json()) as FolderMapping[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isSuperUser]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isSuperUser) return null;

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await authFetch(
        `/admin/sharepoint-folder-mappings/${editing.entityType}`,
        {
          method: "PATCH",
          body: JSON.stringify({ folderPath: editing.path })
        }
      );
      if (!response.ok) {
        // Server rejects an invalid path with a specific message naming
        // the folder that wasn't found — surface it verbatim so the
        // admin can see what's wrong instead of a generic error.
        const message = await response.text();
        throw new Error(message);
      }
      setFlash(`Updated ${ENTITY_LABELS[editing.entityType]} folder path.`);
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="s7-card" style={{ marginTop: 12 }}>
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>SharePoint folder mappings</h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 10px" }}>
        Which folder each entity's documents live in. Edit the path and Save — the change is
        validated against SharePoint and takes effect immediately. No redeploy.
      </p>
      {loading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p> : null}
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      {flash ? <p style={{ color: "#16a34a", margin: "0 0 10px" }}>{flash}</p> : null}
      {!loading && mappings.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--divider)" }}>Entity</th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--divider)" }}>Folder path</th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--divider)", width: 100 }}>Status</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--divider)", width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => {
              const isEditing = editing?.entityType === m.entityType;
              return (
                <tr key={m.id}>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)" }}>{ENTITY_LABELS[m.entityType]}</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)" }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editing!.path}
                        onChange={(e) => setEditing({ entityType: m.entityType, path: e.target.value })}
                        style={{ width: "100%", padding: 4, fontFamily: "monospace", fontSize: 12 }}
                        disabled={saving}
                      />
                    ) : (
                      <code style={{ fontSize: 12 }}>{m.folderPath}</code>
                    )}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)" }}>
                    {m.isActive ? (
                      <span style={{ color: "#16a34a" }}>Active</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Inactive</span>
                    )}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)", textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="s7-btn s7-btn--primary"
                          onClick={() => void save()}
                          disabled={saving}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost"
                          onClick={() => {
                            setEditing(null);
                            setSaveError(null);
                          }}
                          disabled={saving}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost"
                        onClick={() => {
                          setEditing({ entityType: m.entityType, path: m.folderPath });
                          setFlash(null);
                          setSaveError(null);
                        }}
                        style={{ padding: "4px 10px", fontSize: 12 }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {saveError ? (
        <p style={{ color: "var(--status-danger)", marginTop: 10, fontSize: 12 }}>{saveError}</p>
      ) : null}
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        Paths are relative to the SharePoint library. A path that doesn't exist in the library will
        be rejected — create the folder in SharePoint first.
      </p>
    </section>
  );
}

function XeroPanel() {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [status, setStatus] = useState<{
    connected: boolean;
    tenantName?: string | null;
    expiresAt?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await authFetch("/xero/status");
      if (r.ok) setStatus(await r.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch("/xero/connect");
      if (!r.ok) throw new Error(await r.text());
      const body = (await r.json()) as { url: string };
      window.open(body.url, "_blank", "noopener");
      setInfo("Consent window opened — finish the flow in the new tab.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: "Disconnect Xero",
      message: "Disconnect Xero? You'll need to re-consent next time.",
      confirmLabel: "Disconnect",
      variant: "danger"
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch("/xero/disconnect", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      setInfo("Disconnected.");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const syncAll = async () => {
    const ok = await confirm({
      title: "Sync all clients to Xero",
      message: "Push all active clients to Xero now?",
      confirmLabel: "Sync"
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await authFetch("/xero/contacts/sync-all", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const body = (await r.json()) as {
        total: number;
        results: Array<{ clientId: string; status: string }>;
      };
      const ok = body.results.filter((x) => x.status === "success").length;
      setInfo(`Synced ${ok}/${body.total} clients.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="s7-card" style={{ marginTop: 16, padding: 16 }}>
      <h3 className="s7-type-section-heading" style={{ margin: "0 0 8px" }}>
        Xero integration
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>
        Push clients into Xero as contacts, and create draft invoices from approved progress claims.
        Set <code>XERO_CLIENT_ID</code>, <code>XERO_CLIENT_SECRET</code>, <code>XERO_REDIRECT_URI</code> in
        the API environment first.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {status?.connected ? (
          <>
            <span
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(22, 163, 74, 0.15)",
                color: "#16a34a"
              }}
            >
              Connected{status.tenantName ? ` — ${status.tenantName}` : ""}
            </span>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => void syncAll()}
              disabled={busy}
            >
              Sync all clients
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => void disconnect()}
              disabled={busy}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void connect()}
            disabled={busy}
          >
            {busy ? "Working…" : "Connect Xero"}
          </button>
        )}
      </div>

      {info ? <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 10 }}>{info}</p> : null}
      {error ? <p style={{ color: "var(--status-danger)", marginTop: 10 }}>{error}</p> : null}
    </section>
  );
}
