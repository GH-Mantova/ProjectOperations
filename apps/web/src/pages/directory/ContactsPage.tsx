import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Contact = {
  id: string;
  organisationType: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

// Stub page — full contact management UI lands in a follow-up PR. This view
// surfaces the unified polymorphic contacts table so the route exists and
// the backend can be validated from the sidebar.
export function ContactsPage() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgType, setOrgType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (orgType) params.set("organisationType", orgType);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "100");
      const response = await authFetch(`/contacts?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { items: Contact[] };
      setItems(body.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, orgType, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 className="s7-type-page-heading" style={{ margin: 0 }}>Contacts</h1>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
          Unified view across clients, subcontractors, and suppliers. Full
          management UI (create, edit, roles) arrives in a follow-up PR.
        </p>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select
          className="s7-select s7-input--sm"
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
        >
          <option value="">All organisation types</option>
          <option value="CLIENT">Clients</option>
          <option value="SUBCONTRACTOR">Subcontractors</option>
          <option value="SUPPLIER">Suppliers</option>
        </select>
        <input
          className="s7-input s7-input--sm"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No contacts match the current filters.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {["Name", "Organisation", "Role", "Email", "Phone", "Mobile", "Primary"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-muted)"
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderTop: "1px solid var(--border, #e5e7eb)",
                    opacity: c.isActive ? 1 : 0.5
                  }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    <strong>{c.firstName} {c.lastName}</strong>
                  </td>
                  <td style={{ padding: "6px 8px", textTransform: "capitalize", fontSize: 11 }}>
                    {c.organisationType.toLowerCase()}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.role ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.email ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.phone ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.mobile ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>
                    {c.isPrimary ? "✓" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
