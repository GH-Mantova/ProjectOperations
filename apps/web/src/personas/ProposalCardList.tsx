import { useState } from "react";
import type { ChatProposal } from "./chat-helpers";
import { useConfirm } from "../hooks/useConfirm";

const DISCIPLINE_LABEL: Record<ChatProposal["discipline"], string> = {
  demolition: "Demolition",
  asbestos: "Asbestos",
  civil: "Civil"
};

const DISCIPLINE_COLOUR: Record<ChatProposal["discipline"], { bg: string; fg: string }> = {
  demolition: { bg: "rgba(217, 119, 6, 0.12)", fg: "#B45309" },
  asbestos: { bg: "rgba(220, 38, 38, 0.12)", fg: "#B91C1C" },
  civil: { bg: "rgba(2, 132, 199, 0.12)", fg: "#075985" }
};

export function ProposalCardList({
  messageId,
  proposals,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll
}: {
  messageId: string;
  proposals: ChatProposal[];
  onAccept: (messageId: string, proposalIndex: number, edits?: Partial<ChatProposal>) => Promise<{ ok: boolean; scopeItemId?: string; error?: string }>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
  onAcceptAll: (messageId: string) => Promise<{ accepted: number; failed: number }>;
  onRejectAll: (messageId: string) => Promise<number>;
}) {
  const confirm = useConfirm();
  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  return (
    <div className="persona-window__proposals">
      <div className="persona-window__proposals-header">
        Proposed scope items ({proposals.length})
      </div>
      {proposals.map((p) => (
        <ProposalCard
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
              void confirm({
                title: "Reject all pending proposals",
                message: `Reject all ${pendingCount} pending proposals?`,
                confirmLabel: "Reject all",
                variant: "danger"
              }).then((ok) => {
                if (ok) void onRejectAll(messageId);
              });
            }}
          >
            Reject all pending
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProposalCard({
  messageId,
  proposal,
  onAccept,
  onReject
}: {
  messageId: string;
  proposal: ChatProposal;
  onAccept: (messageId: string, proposalIndex: number, edits?: Partial<ChatProposal>) => Promise<{ ok: boolean; scopeItemId?: string; error?: string }>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
}) {
  const confirm = useConfirm();
  const colour = DISCIPLINE_COLOUR[proposal.discipline];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ChatProposal>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = proposal.status === "pending";
  const merged = { ...proposal, ...draft };

  const handleAccept = async (edits?: Partial<ChatProposal>) => {
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
    const ok = await confirm({
      title: "Reject proposal",
      message: "Reject this proposal?",
      confirmLabel: "Reject",
      variant: "danger"
    });
    if (!ok) return;
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
          {DISCIPLINE_LABEL[proposal.discipline]}
        </span>
        <ProposalStatusBadge status={proposal.status} />
      </div>
      {editing ? (
        <ProposalEditForm
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
        <ReadOnlyContent proposal={merged} />
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

function ReadOnlyContent({ proposal }: { proposal: ChatProposal }) {
  return (
    <>
      <div className="persona-window__proposal-title">{proposal.title}</div>
      <div className="persona-window__proposal-description">{proposal.description}</div>
      <div className="persona-window__proposal-quantity">
        {proposal.quantity} {proposal.unit}
      </div>
      {proposal.notes ? (
        <div className="persona-window__proposal-notes">{proposal.notes}</div>
      ) : null}
    </>
  );
}

function ProposalEditForm({
  merged,
  onChange,
  onCancel,
  onSave,
  submitting,
  error
}: {
  merged: ChatProposal;
  onChange: (edits: Partial<ChatProposal>) => void;
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
          value={merged.description}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={submitting}
        />
      </label>
      <div className="persona-window__proposal-form-row">
        <label>
          <span>Quantity</span>
          <input
            type="number"
            min={0}
            value={merged.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
            disabled={submitting}
          />
        </label>
        <label>
          <span>Unit</span>
          <input
            type="text"
            value={merged.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            disabled={submitting}
          />
        </label>
      </div>
      <label>
        <span>Notes</span>
        <textarea
          rows={2}
          value={merged.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          disabled={submitting}
        />
      </label>
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

function ProposalStatusBadge({ status }: { status: ChatProposal["status"] }) {
  if (status === "accepted") {
    return <span className="persona-window__proposal-status persona-window__proposal-status--accepted">Accepted</span>;
  }
  if (status === "rejected") {
    return <span className="persona-window__proposal-status persona-window__proposal-status--rejected">Rejected</span>;
  }
  return <span className="persona-window__proposal-status persona-window__proposal-status--pending">Pending</span>;
}
