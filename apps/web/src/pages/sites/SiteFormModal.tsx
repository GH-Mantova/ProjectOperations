import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export type SiteFormClientOption = { id: string; name: string };

export type SiteFormExisting = {
  id: string;
  name: string;
  code: string | null;
  clientId: string | null;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  notes: string | null;
};

export type SiteFormModalProps = {
  clients: SiteFormClientOption[];
  existing: SiteFormExisting | null;
  onClose: () => void;
  onSaved: () => void;
};

export function SiteFormModal({ clients, existing, onClose, onSaved }: SiteFormModalProps) {
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
