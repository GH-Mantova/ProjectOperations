import type { ActivePersona } from "./types";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatStatus = "idle" | "streaming" | "error";

export type SSEChunk =
  | { type: "content"; text: string }
  | { type: "error"; error: string }
  | { type: "done" };

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

// Build the message history to replay when the user clicks Retry on an
// errored chat. Returns everything up to and INCLUDING the last user message;
// any partial assistant response that came after the last user turn (e.g. a
// few words that streamed before the error) is dropped — re-sending those
// would just confuse the model. Returns [] when there is no user message
// to replay.
export function buildRetryHistory(messages: ChatMessage[]): ChatMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      return messages.slice(0, i + 1);
    }
  }
  return [];
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
  const obj = parsed as { type?: string; text?: string; error?: string };
  if (obj.type === "content" && typeof obj.text === "string") {
    return [{ type: "content", text: obj.text }];
  }
  if (obj.type === "error" && typeof obj.error === "string") {
    return [{ type: "error", error: obj.error }];
  }
  if (obj.type === "done") {
    return [{ type: "done" }];
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
