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

export type ChatMessage = ChatTextMessage | ChatProposalsMessage;

export type ChatStatus = "idle" | "streaming" | "error";

export type SSEChunk =
  | { type: "content"; text: string }
  | { type: "error"; error: string }
  | { type: "done" }
  | { type: "conversation"; conversationId: string }
  | { type: "proposals"; messageId: string; proposals: ChatProposal[] };

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
