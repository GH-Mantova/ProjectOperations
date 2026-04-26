import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type ClientLite = { id: string; name: string };

type LinkedTender = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  dueDate: string | null;
};

type LinkedProject = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  plannedStartDate: string | null;
};

type SiteDetail = {
  id: string;
  clientId: string | null;
  client: ClientLite | null;
  name: string;
  code: string | null;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  notes: string | null;
  tenders: LinkedTender[];
  projects: LinkedProject[];
};

type FormState = {
  name: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  clientId: string;
  notes: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function fromDetail(d: SiteDetail): FormState {
  return {
    name: d.name,
    addressLine1: d.addressLine1 ?? "",
    suburb: d.suburb ?? "",
    state: d.state ?? "QLD",
    postcode: d.postcode ?? "",
    clientId: d.clientId ?? "",
    notes: d.notes ?? ""
  };
}

export function SiteDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/master-data/sites/${id}`);
      if (response.status === 404) {
        setError("Site not found.");
        setDetail(null);
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as SiteDetail;
      setDetail(body);
      setForm(fromDetail(body));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void authFetch("/master-data/clients?limit=200").then(async (r) => {
      if (!r.ok || cancelled) return;
      const body = (await r.json()) as { items: ClientLite[] };
      if (!cancelled) setClients(body.items);
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = form !== null && detail !== null && (
    form.name !== detail.name ||
    form.addressLine1 !== (detail.addressLine1 ?? "") ||
    form.suburb !== (detail.suburb ?? "") ||
    form.state !== (detail.state ?? "QLD") ||
    form.postcode !== (detail.postcode ?? "") ||
    form.clientId !== (detail.clientId ?? "") ||
    form.notes !== (detail.notes ?? "")
  );

  const save = async () => {
    if (!form || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(`/master-data/sites/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          addressLine1: form.addressLine1.trim() || undefined,
          suburb: form.suburb.trim() || undefined,
          state: form.state.trim() || undefined,
          postcode: form.postcode.trim() || undefined,
          clientId: form.clientId || undefined,
          notes: form.notes.trim() || undefined
        })
      });
      if (!response.ok) throw new Error(await response.text());
      setToast("Site saved");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}><p>Loading site…</p></div>;
  }
  if (error && !detail) {
    return (
      <div style={{ padding: 20 }}>
        <Link to="/sites">← Back to sites</Link>
        <p style={{ color: "var(--status-danger)", marginTop: 12 }}>{error}</p>
      </div>
    );
  }
  if (!detail || !form) return null;

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => navigate("/sites")}
        >
          ← Back to sites
        </button>
        <input
          className="s7-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ fontSize: 22, fontWeight: 600, flex: 1, minWidth: 240, border: "none", background: "transparent" }}
        />
        {dirty ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void save()}
            disabled={saving}
            style={{ background: "#FEAA6D", borderColor: "#FEAA6D", color: "#000" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        ) : null}
      </header>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, alignItems: "flex-start" }}>
        <section className="s7-card" style={{ padding: 16 }}>
          <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>Site details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
              <select
                className="s7-select"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              >
                {["QLD", "NSW", "VIC", "TAS", "ACT", "SA", "NT", "WA"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Postcode</span>
              <input
                className="s7-input"
                value={form.postcode}
                onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                inputMode="numeric"
              />
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Client</span>
              <select
                className="s7-select"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              >
                <option value="">— None —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
              <span>Access notes / hazards</span>
              <textarea
                className="s7-textarea"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{ resize: "vertical" }}
              />
            </label>
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section className="s7-card" style={{ padding: 16 }}>
            <h4 className="s7-type-card-title" style={{ margin: "0 0 8px" }}>
              Linked tenders ({detail.tenders.length})
            </h4>
            {detail.tenders.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
                No tenders linked to this site yet.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {detail.tenders.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/tenders/${t.id}`)}
                      style={{ borderTop: "1px solid var(--border, #e5e7eb)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "6px 4px", fontWeight: 600 }}>{t.tenderNumber}</td>
                      <td style={{ padding: "6px 4px" }}>{t.title}</td>
                      <td style={{ padding: "6px 4px", color: "var(--text-muted)" }}>{t.status}</td>
                      <td style={{ padding: "6px 4px", color: "var(--text-muted)" }}>{fmtDate(t.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="s7-card" style={{ padding: 16 }}>
            <h4 className="s7-type-card-title" style={{ margin: "0 0 8px" }}>
              Linked projects ({detail.projects.length})
            </h4>
            {detail.projects.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
                No projects linked to this site yet.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {detail.projects.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      style={{ borderTop: "1px solid var(--border, #e5e7eb)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "6px 4px", fontWeight: 600 }}>{p.projectNumber}</td>
                      <td style={{ padding: "6px 4px" }}>{p.name}</td>
                      <td style={{ padding: "6px 4px", color: "var(--text-muted)" }}>{p.status}</td>
                      <td style={{ padding: "6px 4px", color: "var(--text-muted)" }}>{fmtDate(p.plannedStartDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="s7-card" style={{ padding: 16 }}>
            <h4 className="s7-type-card-title" style={{ margin: "0 0 8px" }}>Documents</h4>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => setToast("Document uploads coming soon")}
            >
              + Upload document
            </button>
          </section>
        </aside>
      </div>

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#005B61",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            zIndex: 100
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
