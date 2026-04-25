import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { QualificationsSection } from "./QualificationsSection";
import { AvailabilitySection } from "./AvailabilitySection";

type Allocation = {
  id: string;
  roleOnProject: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  project: { id: string; projectNumber: string; name: string; status: string };
};

type WorkerDetail = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  role: string;
  phone: string | null;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  licenceNumber: string | null;
  licenceClass: string | null;
  ticketNumbers: string | null;
  hasMobileAccess: boolean;
  internalUserId: string | null;
  isActive: boolean;
  allocations: Allocation[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "Ongoing";
  return new Date(iso).toLocaleDateString();
}

export function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const canManage = useMemo(() => user?.permissions.includes("resources.manage") ?? false, [user]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/workers/${id}`);
      if (!response.ok) throw new Error(await response.text());
      setWorker((await response.json()) as WorkerDetail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDeactivate() {
    if (!worker) return;
    if (!window.confirm(`Deactivate ${worker.firstName} ${worker.lastName}? Existing allocations stay intact.`)) {
      return;
    }
    setDeactivating(true);
    try {
      const response = await authFetch(`/workers/${worker.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      navigate("/workers");
    } catch (err) {
      setError((err as Error).message);
      setDeactivating(false);
    }
  }

  if (loading && !worker) {
    return (
      <div className="admin-page">
        <Skeleton width="40%" height={18} />
        <Skeleton width="60%" height={28} style={{ marginTop: 12 }} />
        <Skeleton width="100%" height={200} style={{ marginTop: 20 }} />
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="admin-page">
        <EmptyState
          heading="Worker not found"
          subtext={error ?? "This worker doesn't exist or has been removed."}
          action={<Link to="/workers" className="s7-btn s7-btn--primary">← Back to workers</Link>}
        />
      </div>
    );
  }

  const displayName = worker.preferredName
    ? `${worker.firstName} "${worker.preferredName}" ${worker.lastName}`
    : `${worker.firstName} ${worker.lastName}`;

  return (
    <div className="admin-page">
      <Link to="/workers" className="tender-detail__back">← Back to workers</Link>

      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">{worker.role}</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>{displayName}</h1>
          <span
            className="type-badge"
            style={{
              marginTop: 6,
              display: "inline-block",
              background: worker.isActive
                ? "color-mix(in srgb, #005B61 15%, transparent)"
                : "#FCEBEB",
              color: worker.isActive ? "#005B61" : "#A32D2D"
            }}
          >
            {worker.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--secondary" onClick={() => setEditOpen(true)}>
            Edit
          </button>
        ) : null}
      </header>

      <section className="s7-card" style={{ marginTop: 16 }}>
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Profile</h3>
        <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px 1fr", gap: "8px 16px", margin: 0 }}>
          <dt style={{ color: "var(--text-muted)" }}>Name</dt>
          <dd style={{ margin: 0 }}>{worker.firstName} {worker.lastName}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Phone</dt>
          <dd style={{ margin: 0 }}>{worker.phone ?? "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Email</dt>
          <dd style={{ margin: 0 }}>{worker.email ?? "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Emergency contact</dt>
          <dd style={{ margin: 0 }}>
            {worker.emergencyContactName ?? "—"}
            {worker.emergencyContactPhone ? ` · ${worker.emergencyContactPhone}` : ""}
          </dd>
        </dl>
      </section>

      <section className="s7-card" style={{ marginTop: 16 }}>
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Licence &amp; tickets</h3>
        <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px 1fr", gap: "8px 16px", margin: 0 }}>
          <dt style={{ color: "var(--text-muted)" }}>Licence number</dt>
          <dd style={{ margin: 0 }}>{worker.licenceNumber ?? "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Licence class</dt>
          <dd style={{ margin: 0 }}>{worker.licenceClass ?? "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Tickets</dt>
          <dd style={{ margin: 0, gridColumn: "2 / -1" }}>{worker.ticketNumbers ?? "—"}</dd>
        </dl>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
          Full compliance and expiry tracking coming in the Compliance module.
        </p>
      </section>

      <section className="s7-card" style={{ marginTop: 16 }}>
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Current allocations</h3>
        {worker.allocations.length === 0 ? (
          <EmptyState heading="No current allocations" subtext="This worker isn't allocated to any active project." />
        ) : (
          <table className="admin-page__table">
            <thead>
              <tr>
                <th>Project #</th>
                <th>Project name</th>
                <th>Role on project</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {worker.allocations.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/projects/${a.project.id}`} style={{ color: "var(--brand-accent, #FEAA6D)" }}>
                      {a.project.projectNumber}
                    </Link>
                  </td>
                  <td>{a.project.name}</td>
                  <td>{a.roleOnProject ?? "—"}</td>
                  <td>{formatDate(a.startDate)}</td>
                  <td>{formatDate(a.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <QualificationsSection
        workerProfileId={worker.id}
        canManage={Boolean(user?.permissions?.includes("compliance.manage")) || Boolean(user?.isSuperUser)}
      />

      <AvailabilitySection
        workerProfileId={worker.id}
        canManage={Boolean(user?.permissions?.includes("resources.manage")) || Boolean(user?.isSuperUser)}
      />

      <MobileAccessSection worker={worker} canManage={canManage} onProvisioned={() => void load()} />

      {canManage && worker.isActive ? (
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="s7-btn s7-btn--danger"
            onClick={() => void handleDeactivate()}
            disabled={deactivating}
          >
            {deactivating ? "Deactivating…" : "Deactivate worker"}
          </button>
        </div>
      ) : null}

      {editOpen ? (
        <EditWorkerModal
          worker={worker}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function EditWorkerModal({
  worker,
  onClose,
  onSaved
}: {
  worker: WorkerDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    firstName: worker.firstName,
    lastName: worker.lastName,
    preferredName: worker.preferredName ?? "",
    role: worker.role,
    phone: worker.phone ?? "",
    email: worker.email ?? "",
    emergencyContactName: worker.emergencyContactName ?? "",
    emergencyContactPhone: worker.emergencyContactPhone ?? "",
    licenceNumber: worker.licenceNumber ?? "",
    licenceClass: worker.licenceClass ?? "",
    ticketNumbers: worker.ticketNumbers ?? ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await authFetch(`/workers/${worker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          preferredName: form.preferredName.trim() || null,
          role: form.role.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          emergencyContactName: form.emergencyContactName.trim() || null,
          emergencyContactPhone: form.emergencyContactPhone.trim() || null,
          licenceNumber: form.licenceNumber.trim() || null,
          licenceClass: form.licenceClass.trim() || null,
          ticketNumbers: form.ticketNumbers.trim() || null
        })
      });
      if (!response.ok) throw new Error(await response.text());
      onSaved();
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
        <h2 className="s7-type-section-title" style={{ margin: 0 }}>Edit worker</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Labeled label="First name">
              <input className="s7-input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Labeled>
            <Labeled label="Last name">
              <input className="s7-input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Labeled>
            <Labeled label="Preferred name">
              <input className="s7-input" value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} />
            </Labeled>
            <Labeled label="Role">
              <input className="s7-input" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </Labeled>
            <Labeled label="Phone">
              <input className="s7-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Labeled>
            <Labeled label="Email">
              <input className="s7-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Labeled>
            <Labeled label="Emergency contact name">
              <input className="s7-input" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
            </Labeled>
            <Labeled label="Emergency contact phone">
              <input className="s7-input" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
            </Labeled>
            <Labeled label="Licence number">
              <input className="s7-input" value={form.licenceNumber} onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })} />
            </Labeled>
            <Labeled label="Licence class">
              <input className="s7-input" value={form.licenceClass} onChange={(e) => setForm({ ...form, licenceClass: e.target.value })} />
            </Labeled>
            <div style={{ gridColumn: "1 / -1" }}>
              <Labeled label="Ticket numbers">
                <input className="s7-input" value={form.ticketNumbers} onChange={(e) => setForm({ ...form, ticketNumbers: e.target.value })} />
              </Labeled>
            </div>
          </div>

          {error ? (
            <div role="alert" style={{ background: "#FCEBEB", color: "#A32D2D", padding: "8px 12px", borderRadius: 6, marginTop: 12, fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function MobileAccessSection({
  worker,
  canManage,
  onProvisioned
}: {
  worker: WorkerDetail;
  canManage: boolean;
  onProvisioned: () => void;
}) {
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <section className="s7-card" style={{ marginTop: 16 }}>
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Mobile access</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span
          className="type-badge"
          style={{
            background: worker.hasMobileAccess
              ? "color-mix(in srgb, #005B61 15%, transparent)"
              : "#E2E8F0",
            color: worker.hasMobileAccess ? "#005B61" : "#1F2937"
          }}
        >
          {worker.hasMobileAccess ? "Enabled" : "Not provisioned"}
        </span>
        {canManage && !worker.hasMobileAccess ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => setProvisionOpen(true)}
          >
            Provision mobile access
          </button>
        ) : null}
        {worker.hasMobileAccess ? (
          <>
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() =>
                setToast("SMS integration coming soon — note the temp password and share it directly with the worker for now")
              }
            >
              Send welcome SMS
            </button>
            {canManage ? (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() =>
                  setToast("To revoke access, deactivate the worker profile or contact your system administrator")
                }
              >
                Revoke access
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {issuedPassword ? (
        <div
          style={{
            marginTop: 12,
            padding: "12px 16px",
            background: "#FEF3C7",
            border: "1px solid #F59E0B",
            borderRadius: 6
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "#92400E" }}>
            Temporary password — copy now, it will not be shown again
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <code
              style={{
                background: "#fff",
                padding: "6px 10px",
                borderRadius: 4,
                fontSize: 15,
                fontFamily: "monospace"
              }}
            >
              {issuedPassword}
            </code>
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() => {
                void navigator.clipboard.writeText(issuedPassword);
                setToast("Copied to clipboard");
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => setIssuedPassword(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {provisionOpen ? (
        <ProvisionMobileAccessModal
          workerId={worker.id}
          workerName={`${worker.firstName} ${worker.lastName}`}
          onClose={() => setProvisionOpen(false)}
          onProvisioned={(tempPassword) => {
            setProvisionOpen(false);
            setIssuedPassword(tempPassword);
            setToast(`Mobile access provisioned for ${worker.firstName}`);
            onProvisioned();
          }}
        />
      ) : null}

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
    </section>
  );
}

function ProvisionMobileAccessModal({
  workerId,
  workerName,
  onClose,
  onProvisioned
}: {
  workerId: string;
  workerName: string;
  onClose: () => void;
  onProvisioned: (tempPassword: string) => void;
}) {
  const { authFetch } = useAuth();
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (tempPassword.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await authFetch(`/workers/${workerId}/provision-mobile-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword })
      });
      if (!response.ok) throw new Error(await response.text());
      onProvisioned(tempPassword);
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
        style={{ width: "min(480px, 92vw)", padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="s7-type-section-title" style={{ margin: 0 }}>
          Provision mobile access
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "8px 0" }}>
          This will create a login account for <strong>{workerName}</strong>. They will be required to reset their
          password on first login.
        </p>
        <form onSubmit={submit}>
          <label style={{ display: "block", marginTop: 12 }}>
            <span className="s7-type-label">Temporary password (min 8 chars)</span>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                className="s7-input"
                type={showPassword ? "text" : "password"}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                minLength={8}
                required
                style={{ flex: 1 }}
                autoFocus
              />
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

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
              {submitting ? "Provisioning…" : "Provision access"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
