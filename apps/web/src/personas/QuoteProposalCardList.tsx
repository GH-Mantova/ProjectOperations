import { useState } from "react";
import type {
  ChatQuoteAssumption,
  ChatQuoteCostLine,
  ChatQuoteExclusion,
  ChatQuoteProposal
} from "./chat-helpers";

// §5A.1 PR E — quote-content proposal cards. Mirrors
// EstimateProposalCardList. The estimator creates the ClientQuote in
// the Quote tab; the AI proposes content INTO it. Each proposal card
// surfaces:
//   - the target quoteId (the AI looked it up via list_tender_quotes
//     and the estimator confirmed it before the propose call)
//   - the proposed cost-line / exclusion / assumption groups
//   - Accept / Edit / Reject buttons
// Edit mode reveals editable cost-line and clause fields. The accept
// path writes one row per cost-line / exclusion / assumption into the
// target quote.

type AcceptResult = {
  ok: boolean;
  acceptedCostLineIds?: string[];
  acceptedExclusionIds?: string[];
  acceptedAssumptionIds?: string[];
  error?: string;
};

export function QuoteProposalCardList({
  messageId,
  proposals,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll
}: {
  messageId: string;
  proposals: ChatQuoteProposal[];
  onAccept: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatQuoteProposal>
  ) => Promise<AcceptResult>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
  onAcceptAll: (messageId: string) => Promise<{ accepted: number; failed: number }>;
  onRejectAll: (messageId: string) => Promise<number>;
}) {
  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  return (
    <div className="persona-window__proposals">
      <div className="persona-window__proposals-header">
        Proposed quote content ({proposals.length})
      </div>
      {proposals.map((p) => (
        <QuoteProposalCard
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

function QuoteProposalCard({
  messageId,
  proposal,
  onAccept,
  onReject
}: {
  messageId: string;
  proposal: ChatQuoteProposal;
  onAccept: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatQuoteProposal>
  ) => Promise<AcceptResult>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ChatQuoteProposal>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = proposal.status === "pending";
  const merged: ChatQuoteProposal = { ...proposal, ...draft };

  const handleAccept = async (edits?: Partial<ChatQuoteProposal>) => {
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
          style={{ background: "rgba(2, 132, 199, 0.12)", color: "#075985" }}
        >
          Quote
        </span>
        <QuoteProposalStatusBadge status={proposal.status} />
      </div>
      <div className="persona-window__proposal-meta">
        Target quote: <code>{proposal.quoteId}</code>
      </div>
      {editing ? (
        <QuoteProposalEditForm
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
        <ReadOnlyQuoteContent proposal={merged} />
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

function ReadOnlyQuoteContent({ proposal }: { proposal: ChatQuoteProposal }) {
  const costLines = proposal.costLines ?? [];
  const exclusions = proposal.exclusions ?? [];
  const assumptions = proposal.assumptions ?? [];
  return (
    <>
      {costLines.length > 0 ? <CostLineGroup lines={costLines} /> : null}
      {exclusions.length > 0 ? <ExclusionGroup lines={exclusions} /> : null}
      {assumptions.length > 0 ? <AssumptionGroup lines={assumptions} /> : null}
      {costLines.length === 0 && exclusions.length === 0 && assumptions.length === 0 ? (
        <div className="persona-window__proposal-description">No content in this proposal.</div>
      ) : null}
    </>
  );
}

function CostLineGroup({ lines }: { lines: ChatQuoteCostLine[] }) {
  return (
    <details className="persona-window__proposal-lines" open>
      <summary>Cost lines ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            <strong>{l.label}</strong>
            {l.price != null ? ` — $${l.price.toLocaleString()}` : " — price TBD ($0)"}
            <div className="persona-window__proposal-description">{l.description}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ExclusionGroup({ lines }: { lines: ChatQuoteExclusion[] }) {
  return (
    <details className="persona-window__proposal-lines" open>
      <summary>Exclusions ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>{l.text}</li>
        ))}
      </ul>
    </details>
  );
}

function AssumptionGroup({ lines }: { lines: ChatQuoteAssumption[] }) {
  return (
    <details className="persona-window__proposal-lines" open>
      <summary>Assumptions ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>{l.text}</li>
        ))}
      </ul>
    </details>
  );
}

function QuoteProposalEditForm({
  merged,
  onChange,
  onCancel,
  onSave,
  submitting,
  error
}: {
  merged: ChatQuoteProposal;
  onChange: (edits: Partial<ChatQuoteProposal>) => void;
  onCancel: () => void;
  onSave: () => void;
  submitting: boolean;
  error: string | null;
}) {
  // Light edit surface: append a new clause / cost-line. The model's
  // proposal contents themselves stay editable on the quote page after
  // acceptance; this form is for last-mile tweaks (add an exclusion the
  // model forgot, edit a cost-line label, etc).
  const costLines = merged.costLines ?? [];
  const exclusions = merged.exclusions ?? [];
  const assumptions = merged.assumptions ?? [];

  const updateCostLine = (idx: number, patch: Partial<ChatQuoteCostLine>) => {
    const next = costLines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ costLines: next });
  };
  const updateExclusion = (idx: number, text: string) => {
    const next = exclusions.map((l, i) => (i === idx ? { text } : l));
    onChange({ exclusions: next });
  };
  const updateAssumption = (idx: number, text: string) => {
    const next = assumptions.map((l, i) => (i === idx ? { text } : l));
    onChange({ assumptions: next });
  };

  return (
    <div className="persona-window__proposal-form">
      {costLines.length > 0 ? (
        <>
          <div className="persona-window__proposal-form-section-label">Cost lines</div>
          {costLines.map((l, i) => (
            <div key={i} className="persona-window__proposal-form-row">
              <label>
                <span>Label</span>
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => updateCostLine(i, { label: e.target.value })}
                  disabled={submitting}
                />
              </label>
              <label>
                <span>Price (optional)</span>
                <input
                  type="number"
                  min={0}
                  value={l.price ?? ""}
                  onChange={(e) =>
                    updateCostLine(i, {
                      price: e.target.value === "" ? undefined : Number(e.target.value)
                    })
                  }
                  disabled={submitting}
                />
              </label>
            </div>
          ))}
        </>
      ) : null}
      {exclusions.length > 0 ? (
        <>
          <div className="persona-window__proposal-form-section-label">Exclusions</div>
          {exclusions.map((l, i) => (
            <label key={i}>
              <textarea
                rows={2}
                value={l.text}
                onChange={(e) => updateExclusion(i, e.target.value)}
                disabled={submitting}
              />
            </label>
          ))}
        </>
      ) : null}
      {assumptions.length > 0 ? (
        <>
          <div className="persona-window__proposal-form-section-label">Assumptions</div>
          {assumptions.map((l, i) => (
            <label key={i}>
              <textarea
                rows={2}
                value={l.text}
                onChange={(e) => updateAssumption(i, e.target.value)}
                disabled={submitting}
              />
            </label>
          ))}
        </>
      ) : null}
      <div className="persona-window__proposal-form-note">
        Edit any cost-line label / price or clause text above. To add new entries beyond the AI's proposal, accept this card and add them on the quote page.
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

function QuoteProposalStatusBadge({ status }: { status: ChatQuoteProposal["status"] }) {
  if (status === "accepted") {
    return <span className="persona-window__proposal-status persona-window__proposal-status--accepted">Accepted</span>;
  }
  if (status === "rejected") {
    return <span className="persona-window__proposal-status persona-window__proposal-status--rejected">Rejected</span>;
  }
  return <span className="persona-window__proposal-status persona-window__proposal-status--pending">Pending</span>;
}
