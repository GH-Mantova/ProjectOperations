import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  QUICK_ADD_CONTACT_FULL_DETAILS_URL,
  QuickAddError,
  openFullDetailsTab,
  quickAddContact,
  type QuickAddContactResult
} from "./tenderQuickAdd";

export function QuickAddContactModal({
  clientId,
  clientName,
  onClose,
  onCreated
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onCreated: (contact: QuickAddContactResult) => void;
}) {
  const { authFetch } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const created = await quickAddContact(authFetch, {
        clientId,
        firstName,
        lastName,
        email,
        phone,
        mobile
      });
      onCreated(created);
    } catch (err) {
      const msg = err instanceof QuickAddError ? err.message : (err as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CenteredModal
      title="Add contact"
      subtitle={`Adding a contact for ${clientName}. Full form opens in a new tab.`}
      onClose={onClose}
      busy={busy}
      maxWidth={520}
      dataTestId="quick-add-contact-modal"
      footer={
        <>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={() => openFullDetailsTab(QUICK_ADD_CONTACT_FULL_DETAILS_URL)}
            disabled={busy}
            data-testid="quick-add-contact-full-details"
          >
            Add full details
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={onClose}
            disabled={busy}
            data-testid="quick-add-contact-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
            style={{ minHeight: 44 }}
            data-testid="quick-add-contact-submit"
          >
            {busy ? "Saving…" : "Create contact"}
          </button>
        </>
      }
    >
      {error ? (
        <div className="login-card__error" role="alert" data-testid="quick-add-contact-error">
          {error}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="tender-form__field">
          <span className="s7-type-label">First name *</span>
          <input
            autoFocus
            className="s7-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            style={{ minHeight: 44 }}
          />
        </label>
        <label className="tender-form__field">
          <span className="s7-type-label">Last name *</span>
          <input
            className="s7-input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            style={{ minHeight: 44 }}
          />
        </label>
      </div>
      <label className="tender-form__field">
        <span className="s7-type-label">Email</span>
        <input
          className="s7-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Optional"
          style={{ minHeight: 44 }}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="tender-form__field">
          <span className="s7-type-label">Phone</span>
          <input
            className="s7-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
            style={{ minHeight: 44 }}
          />
        </label>
        <label className="tender-form__field">
          <span className="s7-type-label">Mobile</span>
          <input
            className="s7-input"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="Optional"
            style={{ minHeight: 44 }}
          />
        </label>
      </div>
    </CenteredModal>
  );
}
