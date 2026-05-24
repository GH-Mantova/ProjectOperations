import { useState } from "react";
import type {
  ChatEstimateCuttingLine,
  ChatEstimateLabourLine,
  ChatEstimatePlantLine,
  ChatEstimateProposal,
  ChatEstimateWasteLine
} from "./chat-helpers";

// §5A.1 PR D — estimate-item proposal cards. Mirrors ProposalCardList
// (scope items) but renders the richer estimate-item shape: a header
// (code/title/markup/provisional) plus optional collapsible cost-line
// groups (labour, plant, cutting, waste). Edit mode reveals the header
// fields; line-level editing is left for a follow-up — for now the
// estimator can either accept the AI-supplied lines verbatim or reject
// the whole proposal and propose again.

const DISCIPLINE_LABEL: Record<ChatEstimateProposal["code"], string> = {
  DEM: "Demolition",
  CIV: "Civil",
  ASB: "Asbestos",
  Other: "Other"
};

const DISCIPLINE_COLOUR: Record<ChatEstimateProposal["code"], { bg: string; fg: string }> = {
  DEM: { bg: "rgba(217, 119, 6, 0.12)", fg: "#B45309" },
  CIV: { bg: "rgba(2, 132, 199, 0.12)", fg: "#075985" },
  ASB: { bg: "rgba(220, 38, 38, 0.12)", fg: "#B91C1C" },
  Other: { bg: "rgba(75, 85, 99, 0.12)", fg: "#374151" }
};

type AcceptResult = { ok: boolean; estimateItemId?: string; error?: string };

export function EstimateProposalCardList({
  messageId,
  proposals,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll
}: {
  messageId: string;
  proposals: ChatEstimateProposal[];
  onAccept: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatEstimateProposal>
  ) => Promise<AcceptResult>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
  onAcceptAll: (messageId: string) => Promise<{ accepted: number; failed: number }>;
  onRejectAll: (messageId: string) => Promise<number>;
}) {
  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  return (
    <div className="persona-window__proposals">
      <div className="persona-window__proposals-header">
        Proposed estimate items ({proposals.length})
      </div>
      {proposals.map((p) => (
        <EstimateProposalCard
          key={p.index}
          messageId={messageId}
          proposal={p}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
      {pendingCount >= 2 ? (
        <div className="persona-window__proposals-bulk">
          <button
            type="button"
            className="persona-window__proposal-btn persona-window__proposal-btn--primary"
            onClick={() => void onAcceptAll(messageId)}
          >
            Accept all pending ({pendingCount})
          </button>
          <button
            type="button"
            className="persona-window__proposal-btn persona-window__proposal-btn--ghost"
            onClick={() => {
              if (window.confirm(`Reject all ${pendingCount} pending proposals?`)) {
                void onRejectAll(messageId);
              }
            }}
          >
            Reject all pending
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EstimateProposalCard({
  messageId,
  proposal,
  onAccept,
  onReject
}: {
  messageId: string;
  proposal: ChatEstimateProposal;
  onAccept: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatEstimateProposal>
  ) => Promise<AcceptResult>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
}) {
  const colour = DISCIPLINE_COLOUR[proposal.code];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ChatEstimateProposal>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = proposal.status === "pending";
  const merged: ChatEstimateProposal = { ...proposal, ...draft };

  const handleAccept = async (edits?: Partial<ChatEstimateProposal>) => {
    setSubmitting(true);
    setError(null);
    const result = await onAccept(messageId, proposal.index, edits);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not accept proposal");
      return;
    }
    setEditing(false);
  };

  const handleReject = async () => {
    if (!window.confirm("Reject this proposal?")) return;
    setSubmitting(true);
    await onReject(messageId, proposal.index);
    setSubmitting(false);
  };

  return (
    <div className={`persona-window__proposal persona-window__proposal--${proposal.status}`}>
      <div className="persona-window__proposal-row1">
        <span
          className="persona-window__proposal-discipline"
          style={{ background: colour.bg, color: colour.fg }}
        >
          {DISCIPLINE_LABEL[proposal.code]}
        </span>
        {proposal.isProvisional ? (
          <span
            className="persona-window__proposal-discipline"
            style={{ background: "rgba(245, 158, 11, 0.12)", color: "#92400E" }}
          >
            Provisional
          </span>
        ) : null}
        <EstimateProposalStatusBadge status={proposal.status} />
      </div>
      {editing ? (
        <EstimateProposalEditForm
          merged={merged}
          onChange={setDraft}
          onCancel={() => {
            setEditing(false);
            setDraft({});
            setError(null);
          }}
          onSave={() => void handleAccept(draft)}
          submitting={submitting}
          error={error}
        />
      ) : (
        <ReadOnlyEstimateContent proposal={merged} />
      )}
      {isPending && !editing ? (
        <div className="persona-window__proposal-actions">
          <button
            type="button"
            className="persona-window__proposal-btn persona-window__proposal-btn--primary"
            onClick={() => void handleAccept()}
            disabled={submitting}
          >
            Accept
          </button>
          <button
            type="button"
            className="persona-window__proposal-btn persona-window__proposal-btn--ghost"
            onClick={() => setEditing(true)}
            disabled={submitting}
          >
            Edit
          </button>
          <button
            type="button"
            className="persona-window__proposal-btn persona-window__proposal-btn--danger"
            onClick={() => void handleReject()}
            disabled={submitting}
          >
            Reject
          </button>
        </div>
      ) : null}
      {error && !editing ? (
        <div className="persona-window__proposal-error">{error}</div>
      ) : null}
    </div>
  );
}

function ReadOnlyEstimateContent({ proposal }: { proposal: ChatEstimateProposal }) {
  const labour = proposal.labourLines ?? [];
  const plant = proposal.plantLines ?? [];
  const cutting = proposal.cuttingLines ?? [];
  const waste = proposal.wasteLines ?? [];
  return (
    <>
      <div className="persona-window__proposal-title">{proposal.title}</div>
      {proposal.description ? (
        <div className="persona-window__proposal-description">{proposal.description}</div>
      ) : null}
      <div className="persona-window__proposal-meta">
        Markup {proposal.markup ?? 30}%
        {proposal.isProvisional && proposal.provisionalAmount != null
          ? ` · PS allowance $${proposal.provisionalAmount.toLocaleString()}`
          : ""}
      </div>
      {labour.length > 0 ? <LabourLineGroup lines={labour} /> : null}
      {plant.length > 0 ? <PlantLineGroup lines={plant} /> : null}
      {cutting.length > 0 ? <CuttingLineGroup lines={cutting} /> : null}
      {waste.length > 0 ? <WasteLineGroup lines={waste} /> : null}
    </>
  );
}

function LabourLineGroup({ lines }: { lines: ChatEstimateLabourLine[] }) {
  return (
    <details className="persona-window__proposal-lines" open>
      <summary>Labour ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            {l.qty}× {l.role} — {l.days}d @ {l.shift} · ${l.rate.toFixed(2)}/h
          </li>
        ))}
      </ul>
    </details>
  );
}

function PlantLineGroup({ lines }: { lines: ChatEstimatePlantLine[] }) {
  return (
    <details className="persona-window__proposal-lines" open>
      <summary>Plant ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            {l.qty}× {l.plantItem} — {l.days}d · ${l.rate.toFixed(2)}/day
            {l.comment ? ` · ${l.comment}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CuttingLineGroup({ lines }: { lines: ChatEstimateCuttingLine[] }) {
  return (
    <details className="persona-window__proposal-lines" open>
      <summary>Cutting ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            {l.cuttingType}
            {l.equipment ? ` · ${l.equipment}` : ""}
            {l.elevation ? ` · ${l.elevation}` : ""}
            {l.material ? ` · ${l.material}` : ""}
            {l.depthMm ? ` · ${l.depthMm}mm` : ""}
            {l.diameterMm ? ` · Ø${l.diameterMm}mm` : ""}
            {" — "}
            {l.qty} {l.unit} @ ${l.rate.toFixed(2)}/{l.unit}
            {l.comment ? ` · ${l.comment}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

function WasteLineGroup({ lines }: { lines: ChatEstimateWasteLine[] }) {
  return (
    <details className="persona-window__proposal-lines" open>
      <summary>Waste ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            {l.wasteType} @ {l.facility}
            {l.wasteGroup ? ` (${l.wasteGroup})` : ""}
            {" — "}
            {l.qtyTonnes}t · ${l.tonRate.toFixed(2)}/t
            {l.loads > 0 ? ` · ${l.loads} loads × $${l.loadRate.toFixed(2)}/load` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

function EstimateProposalEditForm({
  merged,
  onChange,
  onCancel,
  onSave,
  submitting,
  error
}: {
  merged: ChatEstimateProposal;
  onChange: (edits: Partial<ChatEstimateProposal>) => void;
  onCancel: () => void;
  onSave: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="persona-window__proposal-form">
      <label>
        <span>Title</span>
        <input
          type="text"
          value={merged.title}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={submitting}
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          rows={3}
          value={merged.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={submitting}
        />
      </label>
      <div className="persona-window__proposal-form-row">
        <label>
          <span>Code</span>
          <select
            value={merged.code}
            onChange={(e) =>
              onChange({ code: e.target.value as ChatEstimateProposal["code"] })
            }
            disabled={submitting}
          >
            <option value="DEM">DEM</option>
            <option value="CIV">CIV</option>
            <option value="ASB">ASB</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label>
          <span>Markup %</span>
          <input
            type="number"
            min={0}
            value={merged.markup ?? 30}
            onChange={(e) => onChange({ markup: Number(e.target.value) })}
            disabled={submitting}
          />
        </label>
      </div>
      <label className="persona-window__proposal-form-checkbox">
        <input
          type="checkbox"
          checked={merged.isProvisional ?? false}
          onChange={(e) => onChange({ isProvisional: e.target.checked })}
          disabled={submitting}
        />
        <span>Provisional sum / cost option</span>
      </label>
      {merged.isProvisional ? (
        <label>
          <span>Provisional amount (AUD)</span>
          <input
            type="number"
            min={0}
            value={merged.provisionalAmount ?? 0}
            onChange={(e) => onChange({ provisionalAmount: Number(e.target.value) })}
            disabled={submitting}
          />
        </label>
      ) : null}
      <div className="persona-window__proposal-form-note">
        Cost lines (labour / plant / cutting / waste) accept verbatim from the proposal — edit them on the estimate page after accepting if needed.
      </div>
      {error ? <div className="persona-window__proposal-error">{error}</div> : null}
      <div className="persona-window__proposal-actions">
        <button
          type="button"
          className="persona-window__proposal-btn persona-window__proposal-btn--primary"
          onClick={onSave}
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Save and accept"}
        </button>
        <button
          type="button"
          className="persona-window__proposal-btn persona-window__proposal-btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EstimateProposalStatusBadge({ status }: { status: ChatEstimateProposal["status"] }) {
  if (status === "accepted") {
    return <span className="persona-window__proposal-status persona-window__proposal-status--accepted">Accepted</span>;
  }
  if (status === "rejected") {
    return <span className="persona-window__proposal-status persona-window__proposal-status--rejected">Rejected</span>;
  }
  return <span className="persona-window__proposal-status persona-window__proposal-status--pending">Pending</span>;
}
