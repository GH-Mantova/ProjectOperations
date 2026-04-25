import { useEffect, useState } from "react";
import { usePortalAuth } from "../PortalAuthContext";

type Doc = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  createdAt: string;
  project: { id: string; projectNumber: string; name: string } | null;
};

export function PortalDocumentsPage() {
  const { authFetch } = usePortalAuth();
  const [items, setItems] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch("/portal/client/documents")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setItems)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [authFetch]);

  return (
    <div>
      <h1 style={{ margin: "0 0 18px", fontSize: 22 }}>Documents</h1>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ color: "#999" }}>Loading…</p> : null}
      {!loading && items.length === 0 ? <p style={{ color: "#666" }}>No documents available.</p> : null}

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((d) => (
          <div
            key={d.id}
            style={{
              background: "#fff",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 6,
              padding: 14
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
                {d.project ? (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                    {d.project.projectNumber} — {d.project.name}
                  </div>
                ) : null}
                {d.description ? (
                  <div style={{ fontSize: 13, color: "#444", marginTop: 6 }}>{d.description}</div>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  background: "#FEAA6D",
                  color: "#242424",
                  borderRadius: 999,
                  textTransform: "uppercase",
                  height: "fit-content"
                }}
              >
                {d.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
