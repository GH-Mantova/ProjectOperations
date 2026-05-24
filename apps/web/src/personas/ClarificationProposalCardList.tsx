import { useState } from "react";
import type {
  ChatAcceptedClarificationRecord,
  ChatClarificationProposal,
  ChatClarificationProposalInput,
  ChatNewNoteProposal,
  ChatNewRfiProposal,
  ChatRfiResponseProposal
} from "./chat-helpers";

// §5A.1 PR F — clarification proposal cards. Mirrors
// QuoteProposalCardList but renders one of three discriminated kinds
// per card (new_rfi / new_note / rfi_response). Edit mode shows the
// fields valid for the card's kind.

type AcceptResult = {
  ok: boolean;
  acceptedRecord?: ChatAcceptedClarificationRecord;
  error?: string;
};

const KIND_LABEL: Record<ChatClarificationProposalInput["kind"], string> = {
  new_rfi: "New RFI",
  new_note: "Comms note",
  rfi_response: "RFI response"
};

const KIND_COLOUR: Record<
  ChatClarificationProposalInput["kind"],
  { bg: string; fg: string }
> = {
  new_rfi: { bg: "rgba(0, 91, 97, 0.12)", fg: "#005B61" },
  new_note: { bg: "rgba(149, 165, 166, 0.12)", fg: "#475569" },
  rfi_response: { bg: "rgba(39, 174, 96, 0.12)", fg: "#15803D" }
};

export function ClarificationProposalCardList({
  messageId,
  proposals,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll
}: {
  messageId: string;
  proposals: ChatClarificationProposal[];
  onAccept: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatClarificationProposal["proposal"]>
  ) => Promise<AcceptResult>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
  onAcceptAll: (messageId: string) => Promise<{ accepted: number; failed: number }>;
  onRejectAll: (messageId: string) => Promise<number>;
}) {
  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  return (
    <div className="persona-window__proposals">
      <div className="persona-window__proposals-header">
        Proposed clarifications activity ({proposals.length})
      </div>
      {proposals.map((p) => (
        <ClarificationProposalCard
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

function ClarificationProposalCard({
  messageId,
  proposal,
  onAccept,
  onReject
}: {
  messageId: string;
  proposal: ChatClarificationProposal;
  onAccept: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatClarificationProposal["proposal"]>
  ) => Promise<AcceptResult>;
  onReject: (messageId: string, proposalIndex: number) => Promise<boolean>;
}) {
  const colour = KIND_COLOUR[proposal.proposal.kind];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ChatClarificationProposal["proposal"]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = proposal.status === "pending";
  // Merging via the stored kind keeps the shape narrowable.
  const merged: ChatClarificationProposalInput = {
    ...proposal.proposal,
    ...draft
  } as ChatClarificationProposalInput;

  const handleAccept = async (edits?: Partial<ChatClarificationProposal["proposal"]>) => {
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
          {KIND_LABEL[proposal.proposal.kind]}
        </span>
        <ClarificationProposalStatusBadge status={proposal.status} />
      </div>
      {editing ? (
        <ClarificationProposalEditForm
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
        <ReadOnlyClarificationContent proposal={merged} />
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

function ReadOnlyClarificationContent({
  proposal
}: {
  proposal: ChatClarificationProposalInput;
}) {
  if (proposal.kind === "new_rfi") {
    return (
      <>
        <div className="persona-window__proposal-title">{proposal.subject}</div>
        {proposal.dueDate ? (
          <div className="persona-window__proposal-meta">
            Due: {formatMaybeDate(proposal.dueDate)}
          </div>
        ) : (
          <div className="persona-window__proposal-meta">No due date</div>
        )}
      </>
    );
  }
  if (proposal.kind === "new_note") {
    return (
      <>
        <div className="persona-window__proposal-meta">
          {proposal.noteType} · {proposal.direction}
          {proposal.occurredAt ? ` · ${formatMaybeDate(proposal.occurredAt)}` : ""}
        </div>
        <div className="persona-window__proposal-description">{proposal.text}</div>
      </>
    );
  }
  // rfi_response
  return (
    <>
      <div className="persona-window__proposal-meta">
        Responding to RFI <code>{proposal.rfiId}</code>
      </div>
      <div className="persona-window__proposal-description">{proposal.response}</div>
    </>
  );
}

function ClarificationProposalEditForm({
  merged,
  onChange,
  onCancel,
  onSave,
  submitting,
  error
}: {
  merged: ChatClarificationProposalInput;
  onChange: (edits: Partial<ChatClarificationProposal["proposal"]>) => void;
  onCancel: () => void;
  onSave: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="persona-window__proposal-form">
      {merged.kind === "new_rfi" ? (
        <NewRfiEditFields merged={merged} onChange={onChange} submitting={submitting} />
      ) : null}
      {merged.kind === "new_note" ? (
        <NewNoteEditFields merged={merged} onChange={onChange} submitting={submitting} />
      ) : null}
      {merged.kind === "rfi_response" ? (
        <RfiResponseEditFields merged={merged} onChange={onChange} submitting={submitting} />
      ) : null}
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

function NewRfiEditFields({
  merged,
  onChange,
  submitting
}: {
  merged: ChatNewRfiProposal;
  onChange: (edits: Partial<ChatClarificationProposal["proposal"]>) => void;
  submitting: boolean;
}) {
  return (
    <>
      <label>
        <span>Subject</span>
        <input
          type="text"
          value={merged.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          disabled={submitting}
        />
      </label>
      <label>
        <span>Due date (optional)</span>
        <input
          type="date"
          value={dateInputValue(merged.dueDate)}
          onChange={(e) =>
            onChange({ dueDate: e.target.value === "" ? undefined : new Date(e.target.value).toISOString() })
          }
          disabled={submitting}
        />
      </label>
    </>
  );
}

function NewNoteEditFields({
  merged,
  onChange,
  submitting
}: {
  merged: ChatNewNoteProposal;
  onChange: (edits: Partial<ChatClarificationProposal["proposal"]>) => void;
  submitting: boolean;
}) {
  return (
    <>
      <div className="persona-window__proposal-form-row">
        <label>
          <span>Type</span>
          <select
            value={merged.noteType}
            onChange={(e) =>
              onChange({ noteType: e.target.value as ChatNewNoteProposal["noteType"] })
            }
            disabled={submitting}
          >
            <option value="call">call</option>
            <option value="email">email</option>
            <option value="meeting">meeting</option>
            <option value="note">note</option>
            <option value="response">response</option>
          </select>
        </label>
        <label>
          <span>Direction</span>
          <select
            value={merged.direction}
            onChange={(e) =>
              onChange({ direction: e.target.value as ChatNewNoteProposal["direction"] })
            }
            disabled={submitting}
          >
            <option value="sent">sent</option>
            <option value="received">received</option>
          </select>
        </label>
      </div>
      <label>
        <span>Text</span>
        <textarea
          rows={3}
          value={merged.text}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={submitting}
        />
      </label>
    </>
  );
}

function RfiResponseEditFields({
  merged,
  onChange,
  submitting
}: {
  merged: ChatRfiResponseProposal;
  onChange: (edits: Partial<ChatClarificationProposal["proposal"]>) => void;
  submitting: boolean;
}) {
  return (
    <>
      <div className="persona-window__proposal-meta">
        Responding to RFI <code>{merged.rfiId}</code>
      </div>
      <label>
        <span>Response</span>
        <textarea
          rows={4}
          value={merged.response}
          onChange={(e) => onChange({ response: e.target.value })}
          disabled={submitting}
        />
      </label>
    </>
  );
}

function ClarificationProposalStatusBadge({
  status
}: {
  status: ChatClarificationProposal["status"];
}) {
  if (status === "accepted") {
    return (
      <span className="persona-window__proposal-status persona-window__proposal-status--accepted">
        Accepted
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="persona-window__proposal-status persona-window__proposal-status--rejected">
        Rejected
      </span>
    );
  }
  return (
    <span className="persona-window__proposal-status persona-window__proposal-status--pending">
      Pending
    </span>
  );
}

function formatMaybeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function dateInputValue(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
