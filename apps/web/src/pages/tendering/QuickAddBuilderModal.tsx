import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  QUICK_ADD_CLIENT_FULL_DETAILS_URL,
  QuickAddError,
  openFullDetailsTab,
  quickAddClient,
  type QuickAddClientResult
} from "./tenderQuickAdd";

export function QuickAddBuilderModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (client: QuickAddClientResult) => void;
}) {
  const { authFetch } = useAuth();
  const [name, setName] = useState("");
  const [abn, setAbn] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const created = await quickAddClient(authFetch, { name, abn, email });
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
      title="Add new builder"
      subtitle="Minimum details only — you can round out the rest later. Full form opens in a new tab."
      onClose={onClose}
      busy={busy}
      maxWidth={480}
      dataTestId="quick-add-builder-modal"
      footer={
        <>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={() => openFullDetailsTab(QUICK_ADD_CLIENT_FULL_DETAILS_URL)}
            disabled={busy}
            data-testid="quick-add-builder-full-details"
          >
            Add full details
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={onClose}
            disabled={busy}
            data-testid="quick-add-builder-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
            style={{ minHeight: 44 }}
            data-testid="quick-add-builder-submit"
          >
            {busy ? "Saving…" : "Create builder"}
          </button>
        </>
      }
    >
      {error ? (
        <div className="login-card__error" role="alert" data-testid="quick-add-builder-error">
          {error}
        </div>
      ) : null}
      <label className="tender-form__field">
        <span className="s7-type-label">Name *</span>
        <input
          autoFocus
          className="s7-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Builder legal or trading name"
          required
          style={{ minHeight: 44 }}
        />
      </label>
      <label className="tender-form__field">
        <span className="s7-type-label">ABN</span>
        <input
          className="s7-input"
          value={abn}
          onChange={(e) => setAbn(e.target.value)}
          placeholder="Optional"
          style={{ minHeight: 44 }}
        />
      </label>
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
    </CenteredModal>
  );
}
