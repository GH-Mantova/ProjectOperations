import { useEffect, useState } from "react";
import { usePortalAuth } from "../PortalAuthContext";

type Quote = {
  id: string;
  quoteRef: string;
  revision: number;
  status: string;
  sentAt: string | null;
  createdAt: string;
  tender: { id: string; tenderNumber: string; title: string } | null;
};

export function PortalQuotesPage() {
  const { authFetch } = usePortalAuth();
  const [items, setItems] = useState<Quote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch("/portal/client/quotes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setItems)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [authFetch]);

  return (
    <div>
      <h1 style={{ margin: "0 0 18px", fontSize: 22 }}>Quotes</h1>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ color: "#999" }}>Loading…</p> : null}
      {!loading && items.length === 0 ? <p style={{ color: "#666" }}>No quotes available.</p> : null}

      <table style={{ width: "100%", background: "#fff", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f6f6f6" }}>
            {["Quote ref", "Tender", "Rev", "Status", "Sent"].map((h) => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: "#666" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((q) => (
            <tr key={q.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>{q.quoteRef}</td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>
                {q.tender ? `${q.tender.tenderNumber} — ${q.tender.title}` : "—"}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>R{q.revision}</td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>{q.status}</td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: "#666" }}>
                {q.sentAt ? new Date(q.sentAt).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
