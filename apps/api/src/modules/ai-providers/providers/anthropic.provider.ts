import type { ChatRequest, ChatStreamChunk } from "../ai-providers.types";

// Model is supplied via ChatRequest.config.model; the default lives in
// PlatformConfigService.DEFAULT_MODELS.anthropic. Don't duplicate it here.
const MAX_TOKENS = 2048;
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Streams chunks from Anthropic's Messages API SSE response.
// Yields { type: 'content', text } per content_block_delta, then { type: 'done' }.
// On API or network errors, yields a single { type: 'error', error } and stops.
export async function* streamAnthropicChat(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": request.config.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
        accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: request.config.model,
        max_tokens: MAX_TOKENS,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true
      }),
      signal: request.signal
    });
  } catch (err) {
    yield { type: "error", error: `Network error: ${(err as Error).message}` };
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    yield {
      type: "error",
      error: `Anthropic API ${response.status}: ${text.slice(0, 400)}`
    };
    return;
  }
  if (!response.body) {
    yield { type: "error", error: "Anthropic API returned an empty stream body." };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  // SSE events are separated by a blank line (\n\n). A single network chunk
  // can contain multiple events or split one event across boundaries — buffer
  // until we see the separator, then split.
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        for (const chunk of parseAnthropicEvent(rawEvent)) {
          yield chunk;
          if (chunk.type === "error" || chunk.type === "done") return;
        }
        separator = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    yield { type: "error", error: `Stream read error: ${(err as Error).message}` };
    return;
  }

  yield { type: "done" };
}

// Parse a single SSE event block (lines separated by \n) into zero-or-more
// chunks. Anthropic emits multiple event types; we only surface text deltas
// and message_stop. Other events (ping, message_start, content_block_start,
// message_delta carrying usage) are ignored.
export function parseAnthropicEvent(rawEvent: string): ChatStreamChunk[] {
  const dataLines: string[] = [];
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return [];
  const data = dataLines.join("\n");
  if (data === "[DONE]") return [{ type: "done" }];

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const obj = parsed as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };

  if (obj.type === "content_block_delta" && obj.delta?.type === "text_delta") {
    const text = obj.delta.text ?? "";
    if (text.length === 0) return [];
    return [{ type: "content", text }];
  }
  if (obj.type === "message_stop") {
    return [{ type: "done" }];
  }
  if (obj.type === "error") {
    return [{ type: "error", error: obj.error?.message ?? "Anthropic returned an error event." }];
  }
  return [];
}
