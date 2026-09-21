// QuotePushDiffModal.tsx -- QUOTE_PUSH_PANEL_V1 (scopecards-s4b)
//
// Modal showing the diff of what a re-push will do (mock-up state 4).
// Always POSTs push-from-estimate to apply (not the scope variant).

import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { type PushPlan, type PushChange } from "./quotePush.helpers";

function fmtCurrency(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "$0.00";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);
}

function changeIcon(action: string): string {
  switch (action) {
    case "move": return "→"; // right arrow
    case "update": return "Δ"; // delta
    case "unchanged": return "=";
    case "create": return "+";
    case "withdraw": return "−"; // minus sign
    default: return "?";
  }
}

function ChangeRow({ change }: { change: PushChange }) {
  const isWithdraw = change.action === "withdraw";

  const rowStyle: React.CSSProperties = isWithdraw
    ? {
        borderLeft: "3px solid var(--status-danger)",
        paddingLeft: 8,
        marginBottom: 8
      }
    : { marginBottom: 8 };

  let body: React.ReactNode = null;

  if (change.action === "move") {
    body = (
      <span style={{ fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{changeIcon("move")} move</span>{" "}
        {change.description} moves{" "}
        <em>{change.fromDestination}</em> {"→"} <em>{change.destination}</em>.{" "}
        {fmtCurrency(change.price)}
      </span>
    );
  } else if (change.action === "update") {
    const delta = change.price - change.prevPrice;
    body = (
      <span style={{ fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{changeIcon("update")} recompute</span>{" "}
        {change.description} is recomputed{" "}
        {fmtCurrency(change.prevPrice)} {"→"} {fmtCurrency(change.price)}.{" "}
        {delta !== 0 ? (
          <span style={{ color: delta > 0 ? "var(--status-danger)" : "var(--status-success)" }}>
            {delta > 0 ? "+" : ""}{fmtCurrency(delta)}
          </span>
        ) : null}
        {change.keptOverrideAmount ? " The Adjusted column follows." : ""}
        {change.keptDisplayDescription ? " Display wording kept." : ""}
      </span>
    );
  } else if (change.action === "unchanged") {
    const kept = change as Extract<PushChange, { action: "unchanged" }>;
    body = (
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        <span style={{ fontWeight: 600 }}>= kept</span>{" "}
        {kept.description} {"—"} {fmtCurrency(kept.price)}
      </span>
    );
  } else if (change.action === "create") {
    body = (
      <span style={{ fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>+ create</span>{" "}
        {change.description} added to <em>{change.destination}</em> {"—"} {fmtCurrency(change.price)}
      </span>
    );
  } else if (change.action === "withdraw") {
    body = (
      <span style={{ fontSize: 12, color: "var(--status-danger)" }}>
        <span style={{ fontWeight: 600 }}>{changeIcon("withdraw")} withdrawn</span>{" "}
        {change.description} leaves the quote {"—"} {fmtCurrency(change.prevPrice)}
      </span>
    );
  }

  return <div style={rowStyle}>{body}</div>;
}

type Props = {
  tenderId: string;
  quoteId: string;
  plan: PushPlan;
  onClose: () => void;
  onApplied: () => Promise<void>;
};

export function QuotePushDiffModal({ tenderId, quoteId, plan, onClose, onApplied }: Props) {
  const { authFetch } = useAuth();
  const [applying, setApplying] = useState(false);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  const totalChanges =
    plan.counts.create + plan.counts.update + plan.counts.move + plan.counts.withdraw;
  const withdrawn = plan.counts.withdraw;

  const titleSuffix =
    withdrawn > 0 ? `${withdrawn} withdrawn` : "nothing withdrawn";
  const title = `What re-pushing will do · ${totalChanges} ${totalChanges === 1 ? "change" : "changes"}, ${titleSuffix}`;

  // Visible changes (exclude unchanged from the modal list for brevity)
  const visibleChanges = plan.changes.filter((c) => c.action !== "unchanged");

  const provisionalUpdated = plan.changes.filter(
    (c) => (c.action === "update" || c.action === "create") &&
      ("destination" in c && c.destination === "PROVISIONAL")
  ).length;
  const optionUpdated = plan.changes.filter(
    (c) => (c.action === "update" || c.action === "create") &&
      ("destination" in c && c.destination === "OPTION")
  ).length;
  const internalCrossing = plan.changes.filter(
    (c) => ("destination" in c && c.destination === "INTERNAL") ||
      ("fromDestination" in c && c.fromDestination === "INTERNAL")
  ).length;

  const handleApply = async () => {
    setApplying(true);
    setConflictMsg(null);
    try {
      const res = await authFetch(
        `/tenders/${tenderId}/quotes/${quoteId}/push-from-estimate`,
        { method: "POST" }
      );
      if (res.status === 409) {
        const msg = await readApiErrorMessage(res);
        setConflictMsg(msg);
        return;
      }
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      await onApplied();
    } catch (err) {
      setConflictMsg((err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <CenteredModal
      title={title}
      onClose={onClose}
      maxWidth={640}
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={onClose}
            disabled={applying}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void handleApply()}
            disabled={applying}
          >
            Apply {totalChanges} {totalChanges === 1 ? "change" : "changes"}
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 13 }}>
        {conflictMsg ? (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              background: "var(--surface-muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-muted)",
              fontSize: 12
            }}
          >
            {conflictMsg}
          </div>
        ) : null}

        {visibleChanges.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No changes {"—"} the estimate is up to date.</p>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {visibleChanges.map((c, i) => (
              <ChangeRow key={i} change={c} />
            ))}
          </div>
        )}

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
            fontSize: 12,
            color: "var(--text-muted)"
          }}
        >
          Provisional and options: {provisionalUpdated + optionUpdated > 0
            ? `${provisionalUpdated} updated, ${optionUpdated} new`
            : "nothing changes"}.{" "}
          Internal only: {internalCrossing > 0 ? `${internalCrossing} crossing` : "nothing crosses"}.{" "}
          Rows added on this quote are not touched.
        </div>
      </div>
    </CenteredModal>
  );
}
