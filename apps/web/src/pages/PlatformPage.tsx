import { useEffect, useState } from "react";
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

  const load = async () => {
    const [configResponse, foldersResponse] = await Promise.all([
      authFetch("/platform/config"),
      authFetch("/sharepoint/folders")
    ]);

    if (!configResponse.ok || !foldersResponse.ok) {
      throw new Error("Unable to load platform configuration.");
    }

    setConfig(await configResponse.json());
    setFolders(await foldersResponse.json());
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

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
      <AppCard title="Platform Configuration" subtitle="SharePoint and shared services foundation">
        {error ? <p className="error-text">{error}</p> : null}
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
        <div className="table-shell">
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
        </div>
      </AppCard>

      <AppCard title="Ensure Folder" subtitle="Mock-backed SharePoint folder provisioning foundation">
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
