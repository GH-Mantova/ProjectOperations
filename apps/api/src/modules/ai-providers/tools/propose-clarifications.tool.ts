import type { ToolDefinition } from "./types";

// §5A.1 PR F — clarifications sub-mode content tool. Parallel to
// propose_scope_items / propose_estimate_items / propose_quote_content.
//
// Discriminated by `kind`:
//   - new_rfi      → creates a TenderClarification (formal RFI, status OPEN)
//   - new_note     → creates a TenderClarificationNote (comms log)
//   - rfi_response → updates an existing TenderClarification with a
//                    response + flips status to CLOSED
//
// The model proposes 1..N proposals per call — the user accepts /
// rejects each one as a card.
export const proposeClarificationsTool: ToolDefinition = {
  name: "propose_clarifications",
  description: [
    "Propose clarifications activity for the current tender. Each proposal",
    "is one of three kinds: new_rfi (raise a formal RFI), new_note (log a",
    "communication — call, email, meeting, note, or response), or",
    "rfi_response (answer an existing RFI by id). Always call",
    "list_tender_clarifications first so you can target existing RFIs by",
    "id rather than raising a duplicate. Each proposal is reviewed by the",
    "user as a card with Accept / Edit / Reject buttons — the database",
    "does not change until they click Accept."
  ].join(" "),
  inputSchema: {
    type: "object",
    properties: {
      proposals: {
        type: "array",
        minItems: 1,
        maxItems: 30,
        items: {
          // The schema allows ANY of the three shapes; the dispatch
          // happens on `kind` at runtime. anyOf gives the model a clear
          // mental model of the per-kind required fields.
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["new_rfi", "new_note", "rfi_response"],
              description:
                "Discriminator. new_rfi → create a formal RFI; new_note → log a communication entry; rfi_response → answer an existing RFI."
            },
            // new_rfi fields
            subject: {
              type: "string",
              maxLength: 500,
              description:
                "Required when kind=new_rfi. Short subject line for the RFI, e.g. 'Confirm asbestos register coverage on level 2'."
            },
            dueDate: {
              type: "string",
              description:
                "Optional when kind=new_rfi. ISO-8601 date or datetime; if omitted the RFI has no due date."
            },
            // new_note fields
            noteType: {
              type: "string",
              enum: ["call", "email", "meeting", "note", "response"],
              description:
                "Required when kind=new_note. Type of comms-log entry. 'response' is a free-form response logged in the comms log; for answering a formal RFI use kind=rfi_response instead."
            },
            direction: {
              type: "string",
              enum: ["sent", "received"],
              description:
                "Required when kind=new_note. Was the communication sent by IS (sent) or received from the client/consultant (received)?"
            },
            text: {
              type: "string",
              maxLength: 5000,
              description:
                "Required when kind=new_note. The note body — what was said / written / agreed."
            },
            occurredAt: {
              type: "string",
              description:
                "Optional when kind=new_note. ISO-8601 datetime the communication actually happened. Defaults to now if omitted (useful when the user is logging something just now)."
            },
            // rfi_response fields
            rfiId: {
              type: "string",
              description:
                "Required when kind=rfi_response. The id of the TenderClarification (RFI) being responded to. Get this from list_tender_clarifications. The RFI must belong to the active tender and must not already have a response."
            },
            response: {
              type: "string",
              maxLength: 5000,
              description:
                "Required when kind=rfi_response. The response text. Accepting this proposal flips the RFI's status to CLOSED."
            }
          },
          required: ["kind"]
        }
      }
    },
    required: ["proposals"]
  }
};

// Discriminated proposal type — TypeScript narrowing on `kind` mirrors
// the runtime dispatch in ClarificationProposalsService.accept...
export type NewRfiProposal = {
  kind: "new_rfi";
  subject: string;
  dueDate?: string;
};

export type NewNoteProposal = {
  kind: "new_note";
  noteType: "call" | "email" | "meeting" | "note" | "response";
  direction: "sent" | "received";
  text: string;
  occurredAt?: string;
};

export type RfiResponseProposal = {
  kind: "rfi_response";
  rfiId: string;
  response: string;
};

export type ClarificationProposalInput =
  | NewRfiProposal
  | NewNoteProposal
  | RfiResponseProposal;

export type ProposeClarificationsArgs = {
  proposals: ClarificationProposalInput[];
};
