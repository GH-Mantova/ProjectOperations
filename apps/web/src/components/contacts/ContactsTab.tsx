import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { DraftBanner, SaveDraftButton, useFormDraft } from "../../drafts";

export type ContactRecord = {
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
  isAccountsContact: boolean;
  isActive: boolean;
  hasPortalAccess: boolean;
  notes: string | null;
  createdById: string | null;
};

type FormState = {
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  mobile: string;
  email: string;
  isPrimary: boolean;
  isAccountsContact: boolean;
  notes: string;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  role: "",
  phone: "",
  mobile: "",
  email: "",
  isPrimary: false,
  isAccountsContact: false,
  notes: ""
};

type ContactsTabProps = {
  organisationType: "CLIENT" | "SUBCONTRACTOR" | "SUPPLIER";
  organisationId: string;
  canManage: boolean;
  // For private_person entities — the primary contact was auto-generated from
  // the entity name; flag it in the UI but still allow edits.
  autoCreatedContactId?: string | null;
  // Optional hook so the parent can refresh after the tab mutates contacts.
  onChanged?: () => void;
};

function fromRecord(c: ContactRecord): FormState {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    role: c.role ?? "",
    phone: c.phone ?? "",
    mobile: c.mobile ?? "",
    email: c.email ?? "",
    isPrimary: c.isPrimary,
    isAccountsContact: c.isAccountsContact,
    notes: c.notes ?? ""
  };
}

export function ContactsTab({
  organisationType,
  organisationId,
  canManage,
  autoCreatedContactId,
  onChanged
}: ContactsTabProps) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inviting, setInviting] = useState<ContactRecord | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(
        `/contacts?organisationType=${organisationType}&organisationId=${organisationId}&limit=100`
      );
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { items: ContactRecord[] };
      setItems(body.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, organisationType, organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const sendInvite = async (row: ContactRecord) => {
    if (!row.email) {
      setError("Contact must have an email address before inviting.");
      return;
    }
    if (!window.confirm(`Send a portal invitation to ${row.firstName} ${row.lastName} at ${row.email}?`)) return;
    try {
      const response = await authFetch(`/portal/invites`, {
        method: "POST",
        body: JSON.stringify({
          clientId: organisationId,
          contactId: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { inviteUrl: string };
      setInviteUrl(body.inviteUrl);
      setInviting(row);
      flashToast("Invitation created");
      await load();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (row: ContactRecord) => {
    if (!window.confirm(`Delete ${row.firstName} ${row.lastName}? This cannot be undone.`)) return;
    const response = await authFetch(`/contacts/${row.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    flashToast("Contact deleted");
    await load();
    onChanged?.();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {loading ? "Loading…" : `${items.length} contact${items.length === 1 ? "" : "s"}`}
        </div>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => setCreating(true)}
          >
            + Add contact
          </button>
        ) : null}
      </div>

      {error ? <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p> : null}
      {toast ? (
        <p style={{ color: "var(--status-success, #16a34a)", fontSize: 12, margin: "0 0 8px" }}>{toast}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No contacts yet — add the first contact for this{" "}
          {organisationType === "CLIENT" ? "client" : "entity"}.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {["Name", "Role", "Phone", "Mobile", "Email", "Flags", ""].map((h) => (
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
                    <strong>
                      {c.firstName} {c.lastName}
                    </strong>
                    {autoCreatedContactId && c.id === autoCreatedContactId ? (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-muted)" }}>(auto)</span>
                    ) : null}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.role ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.phone ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.mobile ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.email ?? "—"}</td>
                  <td style={{ padding: "6px 8px", display: "flex", gap: 4 }}>
                    {c.isPrimary ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          background: "#16a34a",
                          color: "#fff",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}
                      >
                        Primary
                      </span>
                    ) : null}
                    {c.isAccountsContact ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          background: "#3b82f6",
                          color: "#fff",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}
                      >
                        Accounts
                      </span>
                    ) : null}
                    {c.hasPortalAccess ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          background: "#005B61",
                          color: "#fff",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}
                      >
                        Portal
                      </span>
                    ) : null}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {canManage ? (
                      <>
                        {organisationType === "CLIENT" && c.email && !c.hasPortalAccess ? (
                          <button
                            type="button"
                            className="s7-btn s7-btn--ghost s7-btn--sm"
                            onClick={() => void sendInvite(c)}
                            title="Invite to client portal"
                          >
                            Invite
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          onClick={() => setEditing(c)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          onClick={() => void remove(c)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          ×
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviting && inviteUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setInviting(null);
            setInviteUrl(null);
          }}
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
          <div
            onClick={(e) => e.stopPropagation()}
            className="s7-card"
            style={{ padding: 20, width: "min(560px, 92vw)" }}
          >
            <h3 className="s7-type-section-heading" style={{ margin: "0 0 8px" }}>
              Portal invitation created
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
              Share this link with {inviting.firstName} {inviting.lastName} ({inviting.email}). It expires in 14 days.
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="s7-input" readOnly value={inviteUrl} style={{ flex: 1 }} />
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl);
                  flashToast("Link copied");
                }}
              >
                Copy
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => {
                  setInviting(null);
                  setInviteUrl(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {creating || editing ? (
        <ContactFormModal
          organisationType={organisationType}
          organisationId={organisationId}
          existing={editing}
          existingPrimary={items.find((c) => c.isPrimary && c.id !== editing?.id)?.firstName ?? null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(msg) => {
            flashToast(msg);
            setCreating(false);
            setEditing(null);
            void load();
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

type OrgOption = { id: string; name: string };

export function ContactFormModal({
  organisationType,
  organisationId,
  existing,
  existingPrimary,
  onClose,
  onSaved
}: {
  organisationType: "CLIENT" | "SUBCONTRACTOR" | "SUPPLIER";
  organisationId: string;
  existing: ContactRecord | null;
  existingPrimary: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { authFetch, user } = useAuth();
  const [form, setForm] = useState<FormState>(existing ? fromRecord(existing) : EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // PR #111 — drafts only for create mode. Edits already have the
  // server-side record as source of truth; re-editing is cheap so a
  // local draft adds friction without value. Empty formType makes the
  // hook a no-op (early-returns inside the hook).
  const draftFormType = existing ? "" : "contact_create";
  const draft = useFormDraft({
    formType: draftFormType,
    contextKey: organisationId,
    schemaVersion: 1,
    getValues: () => form,
    setValues: (d) => setForm(d as FormState)
  });

  // PR D FIX 3 — only allow reassignment when editing an existing contact.
  // Adding from a parent screen always inherits the parent's organisation.
  const [moveOrgType, setMoveOrgType] = useState<"CLIENT" | "SUBCONTRACTOR" | "SUPPLIER">(
    organisationType
  );
  const [moveOrgId, setMoveOrgId] = useState<string>(organisationId);
  const [moveOrgQuery, setMoveOrgQuery] = useState("");
  const [moveOrgOptions, setMoveOrgOptions] = useState<OrgOption[]>([]);

  // Live-search the directory/clients list when the user types ≥2 chars.
  // Empty query keeps the current selection's name visible without firing
  // a request, so opening the modal doesn't immediately spam the server.
  useEffect(() => {
    if (!existing) return;
    if (moveOrgQuery.trim().length < 2) {
      setMoveOrgOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const url =
          moveOrgType === "CLIENT"
            ? `/master-data/clients?search=${encodeURIComponent(moveOrgQuery.trim())}&limit=15`
            : `/directory?q=${encodeURIComponent(moveOrgQuery.trim())}&type=${moveOrgType === "SUPPLIER" ? "supplier" : "subcontractor"}`;
        const res = await authFetch(url);
        if (!res.ok || cancelled) return;
        const body = await res.json();
        const items: OrgOption[] = Array.isArray(body)
          ? body.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))
          : Array.isArray(body.items)
          ? body.items.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))
          : [];
        setMoveOrgOptions(items);
      } catch {
        if (!cancelled) setMoveOrgOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, moveOrgType, moveOrgQuery, existing]);

  const orgChanged =
    Boolean(existing) && (moveOrgType !== organisationType || moveOrgId !== organisationId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErr("First name and last name are required.");
      return;
    }
    if (orgChanged) {
      const target = moveOrgOptions.find((o) => o.id === moveOrgId)?.name ?? moveOrgId;
      const proceed = window.confirm(
        `Move ${form.firstName} ${form.lastName} to ${target}? This will remove the contact from the current organisation.`
      );
      if (!proceed) return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role.trim() || null,
        phone: form.phone.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        isPrimary: form.isPrimary,
        isAccountsContact: form.isAccountsContact,
        notes: form.notes.trim() || null
      };
      const url = existing ? `/contacts/${existing.id}` : "/contacts";
      const method = existing ? "PATCH" : "POST";
      const payload: Record<string, unknown> = existing
        ? { ...body }
        : { ...body, organisationType, organisationId };
      if (orgChanged) {
        payload.organisationType = moveOrgType;
        payload.organisationId = moveOrgId;
      }
      const response = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(await response.text());
      if (!existing) await draft.discardDraft();
      onSaved(
        orgChanged ? "Contact moved" : existing ? "Contact updated" : "Contact added"
      );
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
        style={{ padding: 20, width: "min(520px, 90vw)", maxHeight: "90vh", overflow: "auto" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>
          {existing ? "Edit contact" : "Add contact"}
        </h3>

        {!existing && draft.hasDraft ? (
          <DraftBanner
            userId={user?.id ?? null}
            formType={draftFormType}
            onRestore={draft.restoreDraft}
            onDiscard={draft.discardDraft}
          />
        ) : null}

        {existing ? (
          <fieldset
            style={{
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 6,
              padding: 10,
              margin: "0 0 12px",
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: 8
            }}
          >
            <legend style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 4px" }}>
              Organisation
            </legend>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Type</span>
              <select
                className="s7-select"
                value={moveOrgType}
                onChange={(e) => {
                  setMoveOrgType(e.target.value as "CLIENT" | "SUBCONTRACTOR" | "SUPPLIER");
                  setMoveOrgId("");
                  setMoveOrgQuery("");
                }}
              >
                <option value="CLIENT">Client</option>
                <option value="SUBCONTRACTOR">Subcontractor</option>
                <option value="SUPPLIER">Supplier</option>
              </select>
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Organisation</span>
              <input
                className="s7-input"
                placeholder="Type 2+ letters to search…"
                value={moveOrgQuery}
                onChange={(e) => setMoveOrgQuery(e.target.value)}
                list={`org-options-${existing.id}`}
              />
              <datalist id={`org-options-${existing.id}`}>
                {moveOrgOptions.map((o) => (
                  <option key={o.id} value={o.name} />
                ))}
              </datalist>
              {moveOrgOptions.length > 0 ? (
                <select
                  className="s7-select"
                  value={moveOrgId}
                  onChange={(e) => setMoveOrgId(e.target.value)}
                  size={Math.min(5, moveOrgOptions.length)}
                  style={{ marginTop: 4 }}
                >
                  {moveOrgOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              ) : null}
              {orgChanged ? (
                <span style={{ fontSize: 11, color: "#D97706" }}>
                  ⚠ Saving will move this contact to the selected organisation.
                </span>
              ) : null}
            </label>
          </fieldset>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>First name *</span>
            <input
              className="s7-input"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Last name *</span>
            <input
              className="s7-input"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Role</span>
            <input
              className="s7-input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Phone</span>
            <input
              className="s7-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Mobile</span>
            <input
              className="s7-input"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Email</span>
            <input
              className="s7-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", gridColumn: "1 / -1" }}>
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
            />
            Primary contact
            {form.isPrimary && existingPrimary ? (
              <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>
                This will unset the current primary ({existingPrimary}).
              </span>
            ) : null}
          </label>
          <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", gridColumn: "1 / -1" }}>
            <input
              type="checkbox"
              checked={form.isAccountsContact}
              onChange={(e) => setForm({ ...form, isAccountsContact: e.target.checked })}
            />
            Accounts contact
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Notes</span>
            <textarea
              className="s7-textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>

        {err ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{err}</p> : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {!existing ? (
            <SaveDraftButton
              onSave={draft.saveDraft}
              lastSavedAt={draft.lastSavedAt}
              disabled={submitting}
            />
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : existing ? "Save changes" : "Add contact"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
