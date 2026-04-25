import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Site = {
  id: string;
  clientId: string | null;
  name: string;
  code: string | null;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  notes: string | null;
  client: { id: string; name: string } | null;
  jobs?: Array<{ id: string }>;
};

type ClientOption = { id: string; name: string };

export function SitesListPage() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<Site[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("pageSize", "100");
      const response = await authFetch(`/master-data/sites?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { items: Site[] };
      setItems(body.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void authFetch("/master-data/clients?limit=100").then(async (r) => {
      if (!r.ok || cancelled) return;
      const body = (await r.json()) as { items: ClientOption[] };
      if (!cancelled) setClients(body.items);
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const filtered = useMemo(() => {
    if (!clientFilter) return items;
    return items.filter((s) => s.clientId === clientFilter);
  }, [items, clientFilter]);

  return (
    <div style={{ padding: 20 }}>
      <header
        style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}
      >
        <div>
          <h1 className="s7-type-page-heading" style={{ margin: 0 }}>Sites</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
            All project sites — locations where IS has worked or is working.
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => setCreating(true)}
          >
            + New site
          </button>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
          padding: 10,
          background: "var(--surface-subtle, rgba(0,0,0,0.02))",
          borderRadius: 6
        }}
      >
        <input
          className="s7-input s7-input--sm"
          placeholder="Search by name or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <select
          className="s7-select s7-input--sm"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No sites match the current filters.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {["Site name", "Address", "Client", "Code", "Jobs", ""].map((h) => (
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
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setEditing(s)}
                  style={{ borderTop: "1px solid var(--border, #e5e7eb)", cursor: "pointer" }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    <strong>{s.name}</strong>
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>
                    {[s.addressLine1, s.suburb, s.state, s.postcode].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{s.client?.name ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{s.code ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{s.jobs?.length ?? 0}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text-muted)", fontSize: 11 }}>
                    ✎
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating || editing ? (
        <SiteFormModal
          clients={clients}
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function SiteFormModal({
  clients,
  existing,
  onClose,
  onSaved
}: {
  clients: ClientOption[];
  existing: Site | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    code: existing?.code ?? "",
    clientId: existing?.clientId ?? "",
    addressLine1: existing?.addressLine1 ?? "",
    suburb: existing?.suburb ?? "",
    state: existing?.state ?? "QLD",
    postcode: existing?.postcode ?? "",
    notes: existing?.notes ?? ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("Site name is required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        clientId: form.clientId || undefined,
        addressLine1: form.addressLine1.trim() || undefined,
        suburb: form.suburb.trim() || undefined,
        state: form.state.trim() || undefined,
        postcode: form.postcode.trim() || undefined,
        notes: form.notes.trim() || undefined
      };
      const url = existing ? `/master-data/sites/${existing.id}` : "/master-data/sites";
      const method = existing ? "PATCH" : "POST";
      const response = await authFetch(url, { method, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await response.text());
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1100,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="s7-card"
        style={{ padding: 20, width: "min(540px, 90vw)", maxHeight: "90vh", overflow: "auto" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>
          {existing ? `Edit site · ${existing.name}` : "New site"}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Site name *</span>
            <input
              className="s7-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Code</span>
            <input
              className="s7-input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Client</span>
            <select
              className="s7-select"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="">— none —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Street address</span>
            <input
              className="s7-input"
              value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Suburb</span>
            <input
              className="s7-input"
              value={form.suburb}
              onChange={(e) => setForm({ ...form, suburb: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>State</span>
            <input
              className="s7-input"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Postcode</span>
            <input
              className="s7-input"
              value={form.postcode}
              onChange={(e) => setForm({ ...form, postcode: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Access notes / known hazards</span>
            <textarea
              className="s7-textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>

        {err ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{err}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
            {submitting ? "Saving…" : existing ? "Save changes" : "Create site"}
          </button>
        </div>
      </form>
    </div>
  );
}
