import { CenteredModal } from "@project-ops/ui";
import type { UserDashboard } from "./types";

type Props = {
  dashboard: UserDashboard;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteDashboardModal({ dashboard, busy, error, onCancel, onConfirm }: Props) {
  return (
    <CenteredModal
      title="Delete dashboard"
      onClose={onCancel}
      busy={busy}
      maxWidth={420}
      dataTestId="delete-dashboard-modal"
    >
      <p style={{ marginTop: 0, fontSize: 13 }}>
        Delete &lsquo;{dashboard.name}&rsquo;? This can&rsquo;t be undone.
      </p>
      {error ? <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="s7-btn s7-btn--danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </CenteredModal>
  );
}
