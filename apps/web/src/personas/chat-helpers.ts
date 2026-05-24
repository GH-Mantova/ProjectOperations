import type { ActivePersona } from "./types";

// Sub-mode names map to short, natural-reading clauses for the chat panel
// empty-state hint. Falls back to a generic "this view" for unknown values
// so the hint never reads as a stub or sub-mode internal name.
const SUB_MODE_FRIENDLY_LABELS: Record<string, string> = {
  register: "this view",
  "tender-detail": "this tender",
  scope: "scope drafting",
  estimate: "estimating",
  quote: "the quote",
  clarifications: "clarifications"
};

export function chatPanelEmptyHint(active: ActivePersona): string {
  const friendly = SUB_MODE_FRIENDLY_LABELS[active.subMode.name] ?? "this view";
  return `Ask the ${active.persona.displayName} about ${friendly}.`;
}

// §5A.1 PR 11 — ChatMessage is now a discriminated union. Text messages
// (user/assistant) carry content. Proposal messages carry the tool_result
// messageId + the array of proposals so ProposalCardList can render
// inline. tool_call rows are filtered out by the hook (no UI).
export type ChatTextMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProposalStatus = "pending" | "accepted" | "rejected";

export type ChatProposal = {
  index: number;
  discipline: "demolition" | "asbestos" | "civil";
  title: string;
  description: string;
  quantity: number;
  unit: string;
  notes?: string;
  status: ProposalStatus;
  acceptedScopeItemId?: string;
  decidedAt?: string;
};

export type ChatProposalsMessage = {
  role: "proposals";
  messageId: string;
  proposals: ChatProposal[];
};

// §5A.1 PR D — estimate-item proposal types, parallel to ChatProposal /
// ChatProposalsMessage. Shape mirrors StoredEstimateProposal on the
// backend; the chat surface receives them via the "estimate_proposals"
// SSE event (distinct from scope proposals' "proposals" event).
export type IsDisciplineCode = "DEM" | "CIV" | "ASB" | "Other";

export type ChatEstimateLabourLine = {
  role: string;
  qty: number;
  days: number;
  shift: "Day" | "Night" | "Weekend";
  rate: number;
};

export type ChatEstimatePlantLine = {
  plantItem: string;
  qty: number;
  days: number;
  comment?: string;
  rate: number;
};

export type ChatEstimateCuttingLine = {
  cuttingType: string;
  equipment?: string;
  elevation?: string;
  material?: string;
  depthMm?: number;
  diameterMm?: number;
  qty: number;
  unit: string;
  comment?: string;
  rate: number;
};

export type ChatEstimateWasteLine = {
  wasteGroup?: string;
  wasteType: string;
  facility: string;
  qtyTonnes: number;
  tonRate: number;
  loads: number;
  loadRate: number;
};

export type ChatEstimateProposal = {
  index: number;
  code: IsDisciplineCode;
  title: string;
  description?: string;
  markup?: number;
  isProvisional?: boolean;
  provisionalAmount?: number;
  labourLines?: ChatEstimateLabourLine[];
  plantLines?: ChatEstimatePlantLine[];
  cuttingLines?: ChatEstimateCuttingLine[];
  wasteLines?: ChatEstimateWasteLine[];
  status: ProposalStatus;
  acceptedEstimateItemId?: string;
  decidedAt?: string;
};

export type ChatEstimateProposalsMessage = {
  role: "estimate-proposals";
  messageId: string;
  proposals: ChatEstimateProposal[];
};

// §5A.1 PR E — quote-content proposal types, parallel to the estimate
// variant. The model proposes content (cost-line structure / exclusions
// / assumptions) into an existing ClientQuote.
export type ChatQuoteCostLine = {
  label: string;
  description: string;
  price?: number;
};

export type ChatQuoteExclusion = {
  text: string;
};

export type ChatQuoteAssumption = {
  text: string;
};

export type ChatQuoteProposal = {
  index: number;
  quoteId: string;
  costLines?: ChatQuoteCostLine[];
  exclusions?: ChatQuoteExclusion[];
  assumptions?: ChatQuoteAssumption[];
  status: ProposalStatus;
  acceptedCostLineIds?: string[];
  acceptedExclusionIds?: string[];
  acceptedAssumptionIds?: string[];
  decidedAt?: string;
};

export type ChatQuoteProposalsMessage = {
  role: "quote-proposals";
  messageId: string;
  proposals: ChatQuoteProposal[];
};

// §5A.1 PR F — clarifications-content proposal types. Discriminated by
// `kind`: new_rfi (creates a TenderClarification), new_note (creates a
// TenderClarificationNote), rfi_response (updates an existing RFI).
export type ChatNewRfiProposal = {
  kind: "new_rfi";
  subject: string;
  dueDate?: string;
};

export type ChatNewNoteProposal = {
  kind: "new_note";
  noteType: "call" | "email" | "meeting" | "note" | "response";
  direction: "sent" | "received";
  text: string;
  occurredAt?: string;
};

export type ChatRfiResponseProposal = {
  kind: "rfi_response";
  rfiId: string;
  response: string;
};

export type ChatClarificationProposalInput =
  | ChatNewRfiProposal
  | ChatNewNoteProposal
  | ChatRfiResponseProposal;

export type ChatAcceptedClarificationRecord =
  | { kind: "new_rfi"; rfiId: string }
  | { kind: "new_note"; noteId: string }
  | { kind: "rfi_response"; rfiId: string };

export type ChatClarificationProposal = {
  index: number;
  proposal: ChatClarificationProposalInput;
  status: ProposalStatus;
  acceptedRecord?: ChatAcceptedClarificationRecord;
  decidedAt?: string;
};

export type ChatClarificationProposalsMessage = {
  role: "clarification-proposals";
  messageId: string;
  proposals: ChatClarificationProposal[];
};

export type ChatMessage =
  | ChatTextMessage
  | ChatProposalsMessage
  | ChatEstimateProposalsMessage
  | ChatQuoteProposalsMessage
  | ChatClarificationProposalsMessage;

export type ChatStatus = "idle" | "streaming" | "error";

export type SSEChunk =
  | { type: "content"; text: string }
  | { type: "error"; error: string }
  | { type: "done" }
  | { type: "conversation"; conversationId: string }
  | { type: "proposals"; messageId: string; proposals: ChatProposal[] }
  | {
      type: "estimate_proposals";
      messageId: string;
      proposals: ChatEstimateProposal[];
    }
  | {
      type: "quote_proposals";
      messageId: string;
      proposals: ChatQuoteProposal[];
    }
  | {
      type: "clarification_proposals";
      messageId: string;
      proposals: ChatClarificationProposal[];
    };

// Send button is active only when the user has typed something AND we're not
// currently streaming a response back.
export function shouldDisableSendButton(status: ChatStatus, inputText: string): boolean {
  if (status === "streaming") return true;
  return inputText.trim().length === 0;
}

export function appendUserMessage(history: ChatMessage[], content: string): ChatMessage[] {
  return [...history, { role: "user", content }];
}

export function appendAssistantMessage(history: ChatMessage[], content: string): ChatMessage[] {
  return [...history, { role: "assistant", content }];
}

export function appendProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  proposals: ChatProposal[]
): ChatMessage[] {
  return [...history, { role: "proposals", messageId, proposals }];
}

// Update the proposals payload for a tool_result message in the local
// history (after accept/reject API success). Returns a new array (immutable).
export function updateProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  updater: (proposals: ChatProposal[]) => ChatProposal[]
): ChatMessage[] {
  return history.map((m) => {
    if (m.role !== "proposals" || m.messageId !== messageId) return m;
    return { ...m, proposals: updater(m.proposals) };
  });
}

// §5A.1 PR D — estimate-proposal helpers, parallel to the scope-proposal
// helpers above. The two flows are independent: an estimate_proposals
// SSE event creates an "estimate-proposals" message row; scope proposals
// create "proposals" rows. Accept/edit/reject hits different endpoints.
export function appendEstimateProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  proposals: ChatEstimateProposal[]
): ChatMessage[] {
  return [...history, { role: "estimate-proposals", messageId, proposals }];
}

export function updateEstimateProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  updater: (proposals: ChatEstimateProposal[]) => ChatEstimateProposal[]
): ChatMessage[] {
  return history.map((m) => {
    if (m.role !== "estimate-proposals" || m.messageId !== messageId) return m;
    return { ...m, proposals: updater(m.proposals) };
  });
}

// §5A.1 PR E — quote-proposal helpers, parallel to the
// estimate-proposal helpers above. The three flows
// (scope / estimate / quote) are independent: each carries its own
// SSE event, role string, message history shape, and accept/reject
// endpoint.
export function appendQuoteProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  proposals: ChatQuoteProposal[]
): ChatMessage[] {
  return [...history, { role: "quote-proposals", messageId, proposals }];
}

export function updateQuoteProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  updater: (proposals: ChatQuoteProposal[]) => ChatQuoteProposal[]
): ChatMessage[] {
  return history.map((m) => {
    if (m.role !== "quote-proposals" || m.messageId !== messageId) return m;
    return { ...m, proposals: updater(m.proposals) };
  });
}

// §5A.1 PR F — clarifications-proposal helpers, parallel to the
// quote/estimate/scope helpers above.
export function appendClarificationProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  proposals: ChatClarificationProposal[]
): ChatMessage[] {
  return [...history, { role: "clarification-proposals", messageId, proposals }];
}

export function updateClarificationProposalsMessage(
  history: ChatMessage[],
  messageId: string,
  updater: (proposals: ChatClarificationProposal[]) => ChatClarificationProposal[]
): ChatMessage[] {
  return history.map((m) => {
    if (m.role !== "clarification-proposals" || m.messageId !== messageId) return m;
    return { ...m, proposals: updater(m.proposals) };
  });
}

// Build the message history to replay when the user clicks Retry on an
// errored chat. Returns everything up to and INCLUDING the last user message;
// any partial assistant response that came after the last user turn (e.g. a
// few words that streamed before the error) is dropped — re-sending those
// would just confuse the model. Returns [] when there is no user message
// to replay. Tool_result rows are also dropped (the AI must re-propose if
// the user retries).
//
// For chat API calls we send only text messages to the provider — tool_use
// rounds were already encoded in the prior conversation server-side.
export function buildRetryHistory(messages: ChatMessage[]): ChatMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      return messages.slice(0, i + 1);
    }
  }
  return [];
}

// Filter to text messages only — proposals rows don't go to the AI provider
// directly (they're stored as tool_result on the server side and re-included
// in the conversation history when the next chat request resolves).
export function toApiMessages(history: ChatMessage[]): ChatTextMessage[] {
  return history.filter((m): m is ChatTextMessage => m.role === "user" || m.role === "assistant");
}

// Reset the chat when the active persona+sub-mode changes (different page).
// Window close/reopen on the same sub-mode does NOT trigger a reset — the
// caller should keep the message list across that transition.
export function shouldResetOnPersonaChange(
  prev: ActivePersona | null,
  current: ActivePersona | null
): boolean {
  if (prev === null && current === null) return false;
  if (prev === null || current === null) return true;
  return prev.persona.slug !== current.persona.slug || prev.subMode.name !== current.subMode.name;
}

// Parse a single SSE event block (lines separated by \n) into zero-or-more
// chunks. Multiple data: lines are concatenated with \n per the SSE spec.
// Returns an empty array for events that aren't ours (e.g. : keepalive).
export function parseSSEEvent(rawEvent: string): SSEChunk[] {
  const dataLines: string[] = [];
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return [];
  const data = dataLines.join("\n");
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const obj = parsed as {
    type?: string;
    text?: string;
    error?: string;
    conversationId?: string;
    messageId?: string;
    proposals?: ChatProposal[];
  };
  if (obj.type === "content" && typeof obj.text === "string") {
    return [{ type: "content", text: obj.text }];
  }
  if (obj.type === "error" && typeof obj.error === "string") {
    return [{ type: "error", error: obj.error }];
  }
  if (obj.type === "done") {
    return [{ type: "done" }];
  }
  if (obj.type === "conversation" && typeof obj.conversationId === "string") {
    return [{ type: "conversation", conversationId: obj.conversationId }];
  }
  if (
    obj.type === "proposals" &&
    typeof obj.messageId === "string" &&
    Array.isArray(obj.proposals)
  ) {
    return [{ type: "proposals", messageId: obj.messageId, proposals: obj.proposals }];
  }
  // §5A.1 PR D — estimate-proposals SSE event. Distinct wire type from
  // "proposals" so the frontend routes the payload to the dedicated
  // EstimateProposalCardList without coupling to the scope shape.
  if (
    obj.type === "estimate_proposals" &&
    typeof obj.messageId === "string" &&
    Array.isArray(obj.proposals)
  ) {
    return [
      {
        type: "estimate_proposals",
        messageId: obj.messageId,
        proposals: obj.proposals as unknown as ChatEstimateProposal[]
      }
    ];
  }
  // §5A.1 PR E — quote-proposals SSE event. Parallel to estimate_proposals;
  // routes the payload to QuoteProposalCardList.
  if (
    obj.type === "quote_proposals" &&
    typeof obj.messageId === "string" &&
    Array.isArray(obj.proposals)
  ) {
    return [
      {
        type: "quote_proposals",
        messageId: obj.messageId,
        proposals: obj.proposals as unknown as ChatQuoteProposal[]
      }
    ];
  }
  // §5A.1 PR F — clarification-proposals SSE event. Routes the payload
  // to ClarificationProposalCardList.
  if (
    obj.type === "clarification_proposals" &&
    typeof obj.messageId === "string" &&
    Array.isArray(obj.proposals)
  ) {
    return [
      {
        type: "clarification_proposals",
        messageId: obj.messageId,
        proposals: obj.proposals as unknown as ChatClarificationProposal[]
      }
    ];
  }
  return [];
}

// Drains an SSE stream from a fetch Response. Yields chunks as they arrive.
// Buffers across network chunk boundaries — a single SSE event may be split
// across multiple network reads, and one network read may contain multiple
// events. Stops on `done` or `error`.
export async function* readSSEStream(response: Response): AsyncIterable<SSEChunk> {
  if (!response.body) {
    yield { type: "error", error: "Response has no body" };
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      for (const chunk of parseSSEEvent(rawEvent)) {
        yield chunk;
        if (chunk.type === "done" || chunk.type === "error") return;
      }
      separator = buffer.indexOf("\n\n");
    }
  }
}
