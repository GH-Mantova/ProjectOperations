import { useEffect, useState } from "react";
import { usePortalAuth } from "../PortalAuthContext";

type Job = {
  id: string;
  jobNumber: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
};

export function PortalJobsPage() {
  const { authFetch } = usePortalAuth();
  const [items, setItems] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch("/portal/client/jobs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setItems)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [authFetch]);

  return (
    <div>
      <h1 style={{ margin: "0 0 18px", fontSize: 22 }}>Jobs</h1>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ color: "#999" }}>Loading…</p> : null}
      {!loading && items.length === 0 ? <p style={{ color: "#666" }}>No jobs yet.</p> : null}

      <table style={{ width: "100%", background: "#fff", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f6f6f6" }}>
            {["Job #", "Name", "Status", "Created"].map((h) => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: "#666" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>{j.jobNumber}</td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>{j.name}</td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>{j.status}</td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: "#666" }}>
                {new Date(j.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
