import type { ChatRequest, ChatStreamChunk } from "../ai-providers.types";
import { toolsToOpenAIFormat } from "../tools/translation";

// Model is supplied via ChatRequest.config.model; the default lives in
// PlatformConfigService.DEFAULT_MODELS.openai. Don't duplicate it here.
const MAX_TOKENS = 2048;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Streams chunks from OpenAI's Chat Completions API SSE response.
// OpenAI's stream format differs from Anthropic in two important ways:
//  1. The end-of-stream marker is the literal string `data: [DONE]` (not JSON)
//  2. Content arrives at choices[0].delta.content (not delta.text)
//  3. Errors come back as a JSON object with a top-level `error` field
//     (rather than an "error" event type)
// The system prompt is sent as the first message with role "system" rather
// than as a top-level parameter — caller still hands us a single string and
// we prepend it here.
//
// §5A.1 PR 11: tool calling. When request.tools is provided, we send
// `tools` + `tool_choice: 'auto'` and translate the streaming tool_calls
// deltas into the unified ChatStreamChunk shape. Tool_calls arguments
// stream as JSON-string fragments; we accumulate per call index and emit
// tool_use_stop when the stream finishes with finish_reason 'tool_calls'.
export async function* streamOpenAIChat(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  for (const m of request.messages) {
    messages.push({ role: m.role, content: m.content });
  }

  const body: Record<string, unknown> = {
    model: request.config.model,
    max_tokens: MAX_TOKENS,
    messages,
    stream: true
  };
  if (request.tools && request.tools.length > 0) {
    body.tools = toolsToOpenAIFormat(request.tools);
    body.tool_choice = "auto";
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.config.apiKey}`,
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
      error: `OpenAI API ${response.status}: ${text.slice(0, 400)}`
    };
    return;
  }
  if (!response.body) {
    yield { type: "error", error: "OpenAI API returned an empty stream body." };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  // Same chunk-boundary buffering as the Anthropic provider — SSE events
  // separated by \n\n; one network read may contain multiple events or split
  // a single event across boundaries.
  let buffer = "";

  // Per-tool-call accumulator. OpenAI references tool_calls by `index` within
  // the choices[0].delta.tool_calls array, NOT by id alone — the same id
  // appears in every subsequent fragment but `index` is the stable key. We
  // accumulate id, name (only present in the first fragment), and the
  // running JSON-string argument fragments.
  const toolCallState = new Map<number, { id: string; name: string; partialJson: string }>();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        for (const chunk of parseOpenAIEvent(rawEvent, toolCallState)) {
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

// Parses a single SSE event block (lines separated by \n) into zero-or-more
// chunks. The literal `data: [DONE]` sentinel terminates the stream. Other
// data: lines carry JSON; we surface text deltas, tool_call deltas, and
// finish_reason='tool_calls' which triggers tool_use_stop emission.
//
// `toolCallState` is mutated in-place to track per-index tool_call accumulation.
// Tests can pass a fresh Map and inspect post-call state.
export function parseOpenAIEvent(
  rawEvent: string,
  toolCallState: Map<number, { id: string; name: string; partialJson: string }> = new Map()
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
    error?: { message?: string };
    choices?: Array<{
      delta?: {
        content?: string;
        tool_calls?: Array<{
          index?: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string | null;
    }>;
  };

  if (obj.error) {
    return [{ type: "error", error: obj.error.message ?? "OpenAI returned an error event." }];
  }

  const choice = obj.choices?.[0];
  if (!choice) return [];
  const out: ChatStreamChunk[] = [];

  // Tool-call deltas. Each entry references an index; the first entry for an
  // index carries id + function.name; subsequent entries carry function.arguments
  // fragments only.
  const toolCalls = choice.delta?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      if (typeof tc.index !== "number") continue;
      const state = toolCallState.get(tc.index);
      if (!state) {
        // First fragment — must have id + function.name.
        if (typeof tc.id !== "string" || typeof tc.function?.name !== "string") {
          continue;
        }
        toolCallState.set(tc.index, {
          id: tc.id,
          name: tc.function.name,
          partialJson: tc.function.arguments ?? ""
        });
        out.push({ type: "tool_use_start", id: tc.id, name: tc.function.name });
        if (typeof tc.function.arguments === "string" && tc.function.arguments.length > 0) {
          out.push({
            type: "tool_use_delta",
            id: tc.id,
            partialJson: tc.function.arguments
          });
        }
        continue;
      }
      // Subsequent fragment — only function.arguments matters.
      const argFragment = tc.function?.arguments;
      if (typeof argFragment === "string" && argFragment.length > 0) {
        state.partialJson += argFragment;
        out.push({ type: "tool_use_delta", id: state.id, partialJson: argFragment });
      }
    }
  }

  // Text content delta.
  const text = choice.delta?.content;
  if (typeof text === "string" && text.length > 0) {
    out.push({ type: "content", text });
  }

  // Finish reason — when the stream closes the assistant turn, OpenAI sends
  // finish_reason 'stop' (text only) or 'tool_calls' (one or more tool calls
  // were dispatched). For 'tool_calls', we emit tool_use_stop for every
  // accumulated tool_call, parsing the joined JSON arguments.
  if (choice.finish_reason === "tool_calls") {
    for (const [, state] of toolCallState) {
      let finalArgs: unknown = {};
      if (state.partialJson.length > 0) {
        try {
          finalArgs = JSON.parse(state.partialJson);
        } catch {
          // Defence-in-depth — well-behaved models produce valid JSON, but
          // we surface a flagged payload rather than crash on malformed
          // arguments.
          finalArgs = { _parseError: true, raw: state.partialJson };
        }
      }
      out.push({ type: "tool_use_stop", id: state.id, name: state.name, finalArgs });
    }
    toolCallState.clear();
  }

  return out;
}
