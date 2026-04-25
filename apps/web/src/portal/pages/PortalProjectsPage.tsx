import { useEffect, useState } from "react";
import { usePortalAuth } from "../PortalAuthContext";

type Project = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  siteAddressLine1: string;
  siteAddressSuburb: string;
  siteAddressState: string;
  contractValue: string | number;
  proposedStartDate: string | null;
  actualStartDate: string | null;
  practicalCompletionDate: string | null;
};

export function PortalProjectsPage() {
  const { authFetch } = usePortalAuth();
  const [items, setItems] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch("/portal/client/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setItems)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [authFetch]);

  return (
    <div>
      <h1 style={{ margin: "0 0 18px", fontSize: 22 }}>Projects</h1>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ color: "#999" }}>Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p style={{ color: "#666" }}>No projects to show yet.</p>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((p) => (
          <div
            key={p.id}
            style={{
              background: "#fff",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 6,
              padding: 16
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, color: "#888" }}>{p.projectNumber}</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                  {p.siteAddressLine1}, {p.siteAddressSuburb} {p.siteAddressState}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  background: "#005B61",
                  color: "#fff",
                  borderRadius: 999,
                  textTransform: "uppercase"
                }}
              >
                {p.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
