import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type WorkerRow = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  role: string;
  phone: string | null;
  email: string | null;
  hasMobileAccess: boolean;
  isActive: boolean;
};

type ListResponse = { items: WorkerRow[]; total: number; page: number; limit: number };

export function WorkersListPage() {
  const { authFetch, user } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = useMemo(() => user?.permissions.includes("resources.manage") ?? false, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("isActive", activeOnly ? "true" : "false");
      if (search.trim()) params.set("search", search.trim());
      const response = await authFetch(`/workers?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      setData((await response.json()) as ListResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, activeOnly, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Workforce</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Workers</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            HR / compliance roster. Mobile login provisioning is handled separately.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="s7-input"
            placeholder="Search name or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 260 }}
          />
          {canManage ? (
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => setAddOpen(true)}
            >
              Add worker
            </button>
          ) : null}
        </div>
      </header>

      <nav className="admin-page__tabs" role="tablist" aria-label="Active filter">
        <button
          type="button"
          role="tab"
          aria-selected={activeOnly}
          className={activeOnly ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
          onClick={() => setActiveOnly(true)}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!activeOnly}
          className={!activeOnly ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
          onClick={() => setActiveOnly(false)}
        >
          Inactive
        </button>
      </nav>

      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="s7-card"><Skeleton width="100%" height={220} /></div>
      ) : !data || data.items.length === 0 ? (
        <div className="s7-card">
          <EmptyState
            heading={activeOnly ? "No active workers" : "No inactive workers"}
            subtext={canManage ? "Add your first worker profile to get started." : "Ask a manager to add workers."}
          />
        </div>
      ) : (
        <section className="s7-card">
          <table className="admin-page__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Mobile access</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((worker) => (
                <tr key={worker.id}>
                  <td>
                    <Link
                      to={`/workers/${worker.id}`}
                      style={{ color: "var(--brand-accent, #FEAA6D)", fontWeight: 500 }}
                    >
                      {worker.firstName} {worker.lastName}
                    </Link>
                    {worker.preferredName ? (
                      <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 12 }}>
                        ({worker.preferredName})
                      </span>
                    ) : null}
                  </td>
                  <td>{worker.role}</td>
                  <td>{worker.phone ?? "—"}</td>
                  <td>{worker.email ?? "—"}</td>
                  <td>
                    <span
                      className="type-badge"
                      style={{
                        background: worker.hasMobileAccess
                          ? "color-mix(in srgb, #005B61 15%, transparent)"
                          : "#E2E8F0",
                        color: worker.hasMobileAccess ? "#005B61" : "#1F2937"
                      }}
                    >
                      {worker.hasMobileAccess ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="type-badge"
                      style={{
                        background: worker.isActive
                          ? "color-mix(in srgb, #005B61 15%, transparent)"
                          : "#FCEBEB",
                        color: worker.isActive ? "#005B61" : "#A32D2D"
                      }}
                    >
                      {worker.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
            {data.total} worker{data.total === 1 ? "" : "s"}
          </p>
        </section>
      )}

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
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)"
          }}
        >
          {toast}
        </div>
      ) : null}

      {addOpen ? (
        <AddWorkerModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            setToast("Worker profile created");
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function AddWorkerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    role: "",
    phone: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    licenceNumber: "",
    licenceClass: "",
    ticketNumbers: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.role.trim()) {
      setError("First name, last name, and role are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role.trim()
      };
      if (form.preferredName.trim()) body.preferredName = form.preferredName.trim();
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.email.trim()) body.email = form.email.trim();
      if (form.emergencyContactName.trim()) body.emergencyContactName = form.emergencyContactName.trim();
      if (form.emergencyContactPhone.trim()) body.emergencyContactPhone = form.emergencyContactPhone.trim();
      if (form.licenceNumber.trim()) body.licenceNumber = form.licenceNumber.trim();
      if (form.licenceClass.trim()) body.licenceClass = form.licenceClass.trim();
      if (form.ticketNumbers.trim()) body.ticketNumbers = form.ticketNumbers.trim();

      const response = await authFetch(`/workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-worker-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 100
      }}
      onClick={onClose}
    >
      <div
        className="s7-card"
        style={{ width: "min(560px, 92vw)", padding: 24, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-worker-title" className="s7-type-section-title" style={{ margin: 0 }}>
          Add worker
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "6px 0 16px" }}>
          Create the HR profile. Mobile login access is provisioned separately.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="First name*">
              <input
                className="s7-input"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name*">
              <input
                className="s7-input"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
            <Field label="Preferred name">
              <input
                className="s7-input"
                value={form.preferredName}
                onChange={(e) => setForm({ ...form, preferredName: e.target.value })}
              />
            </Field>
            <Field label="Role*">
              <input
                className="s7-input"
                required
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className="s7-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                className="s7-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Emergency contact name">
              <input
                className="s7-input"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
              />
            </Field>
            <Field label="Emergency contact phone">
              <input
                className="s7-input"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
              />
            </Field>
            <Field label="Licence number">
              <input
                className="s7-input"
                value={form.licenceNumber}
                onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })}
              />
            </Field>
            <Field label="Licence class">
              <input
                className="s7-input"
                value={form.licenceClass}
                onChange={(e) => setForm({ ...form, licenceClass: e.target.value })}
              />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Ticket numbers">
                <input
                  className="s7-input"
                  placeholder="Comma-separated — full tracking in Compliance module"
                  value={form.ticketNumbers}
                  onChange={(e) => setForm({ ...form, ticketNumbers: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              style={{
                background: "#FCEBEB",
                color: "#A32D2D",
                padding: "8px 12px",
                borderRadius: 6,
                marginTop: 12,
                fontSize: 13
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : "Create worker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
