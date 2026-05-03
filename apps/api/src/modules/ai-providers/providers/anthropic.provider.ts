import type { ChatRequest, ChatStreamChunk } from "../ai-providers.types";
import { toolsToAnthropicFormat } from "../tools/translation";

// Model is supplied via ChatRequest.config.model; the default lives in
// PlatformConfigService.DEFAULT_MODELS.anthropic. Don't duplicate it here.
const MAX_TOKENS = 2048;
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Streams chunks from Anthropic's Messages API SSE response.
// Yields { type: 'content', text } per content_block_delta text_delta,
// { type: 'tool_use_start' | 'tool_use_delta' | 'tool_use_stop' } for
// tool_use blocks (when tools are provided), then { type: 'done' }.
// On API or network errors, yields a single { type: 'error', error } and stops.
export async function* streamAnthropicChat(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
  // Per-block-index state for tool_use blocks. Anthropic emits a
  // content_block_start with type=tool_use carrying the block index, name,
  // and id, followed by content_block_delta input_json_delta events with
  // partial_json fragments, finally content_block_stop. We accumulate the
  // partial JSON per block so we can emit tool_use_stop with parsed args.
  const toolBlockState = new Map<number, { id: string; name: string; partialJson: string }>();

  const body: Record<string, unknown> = {
    model: request.config.model,
    max_tokens: MAX_TOKENS,
    system: request.systemPrompt,
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true
  };
  if (request.tools && request.tools.length > 0) {
    body.tools = toolsToAnthropicFormat(request.tools);
  }

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
      body: JSON.stringify(body),
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
        for (const chunk of parseAnthropicEvent(rawEvent, toolBlockState)) {
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
// chunks. Anthropic emits multiple event types; we surface text deltas plus
// tool_use lifecycle events. Other events (ping, message_start, message_delta
// carrying usage) are ignored.
//
// `toolBlockState` is mutated in-place to track per-block tool_use accumulation.
// Tests can pass a fresh Map and inspect post-call state.
export function parseAnthropicEvent(
  rawEvent: string,
  toolBlockState: Map<number, { id: string; name: string; partialJson: string }> = new Map()
): ChatStreamChunk[] {
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
  const obj = parsed as {
    type?: string;
    index?: number;
    content_block?: { type?: string; id?: string; name?: string };
    delta?: { type?: string; text?: string; partial_json?: string };
    error?: { message?: string };
  };

  // Text content delta — most common event during a non-tool response.
  if (obj.type === "content_block_delta" && obj.delta?.type === "text_delta") {
    const text = obj.delta.text ?? "";
    if (text.length === 0) return [];
    return [{ type: "content", text }];
  }

  // Tool use lifecycle: start of a tool_use block.
  if (
    obj.type === "content_block_start" &&
    obj.content_block?.type === "tool_use" &&
    typeof obj.index === "number" &&
    typeof obj.content_block.id === "string" &&
    typeof obj.content_block.name === "string"
  ) {
    toolBlockState.set(obj.index, {
      id: obj.content_block.id,
      name: obj.content_block.name,
      partialJson: ""
    });
    return [{ type: "tool_use_start", id: obj.content_block.id, name: obj.content_block.name }];
  }

  // Tool use lifecycle: incremental JSON arguments.
  if (
    obj.type === "content_block_delta" &&
    obj.delta?.type === "input_json_delta" &&
    typeof obj.index === "number" &&
    typeof obj.delta.partial_json === "string"
  ) {
    const state = toolBlockState.get(obj.index);
    if (!state) return [];
    state.partialJson += obj.delta.partial_json;
    return [
      {
        type: "tool_use_delta",
        id: state.id,
        partialJson: obj.delta.partial_json
      }
    ];
  }

  // Tool use lifecycle: end of a content block — only emit tool_use_stop
  // when the block was a tool_use one. Anthropic also emits content_block_stop
  // for text blocks; ignore those.
  if (obj.type === "content_block_stop" && typeof obj.index === "number") {
    const state = toolBlockState.get(obj.index);
    if (!state) return [];
    toolBlockState.delete(obj.index);
    let finalArgs: unknown = {};
    if (state.partialJson.length > 0) {
      try {
        finalArgs = JSON.parse(state.partialJson);
      } catch {
        // Leave finalArgs as {} — caller will surface as a malformed-tool-call
        // error rather than crash. This shouldn't happen for well-behaved
        // models, but defence-in-depth costs nothing.
        finalArgs = { _parseError: true, raw: state.partialJson };
      }
    }
    return [{ type: "tool_use_stop", id: state.id, name: state.name, finalArgs }];
  }

  if (obj.type === "message_stop") {
    return [{ type: "done" }];
  }
  if (obj.type === "error") {
    return [{ type: "error", error: obj.error?.message ?? "Anthropic returned an error event." }];
  }
  return [];
}
