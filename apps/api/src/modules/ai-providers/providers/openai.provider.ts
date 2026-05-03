import type {
  ChatMessage,
  ChatMessageBlock,
  ChatRequest,
  ChatStreamChunk
} from "../ai-providers.types";
import { toolsToOpenAIFormat } from "../tools/translation";

const VALID_IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

// Translate provider-agnostic ChatMessage[] to OpenAI's wire shape.
// OpenAI is more constrained than Anthropic: tool results live on a
// `tool` role message with text-only content. Image content from a
// tool_result block has to be split out into a synthesised follow-up
// `user` role message with an image_url block, because OpenAI's tool
// message does not accept image content. The follow-up message is
// inserted immediately after the tool message so the model sees them
// as a contiguous unit.
//
// Legacy callers passing string content continue to work — pass-through.
export function serializeMessagesForOpenAI(
  systemPrompt: string | null,
  messages: ChatMessage[]
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  if (systemPrompt) {
    out.push({ role: "system", content: systemPrompt });
  }
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    // Block content: split per OpenAI's role rules.
    const toolUseBlocks = m.content.filter(
      (b): b is Extract<ChatMessageBlock, { type: "tool_use" }> => b.type === "tool_use"
    );
    const textBlocks = m.content.filter(
      (b): b is Extract<ChatMessageBlock, { type: "text" }> => b.type === "text"
    );
    const toolResultBlocks = m.content.filter(
      (b): b is Extract<ChatMessageBlock, { type: "tool_result" }> => b.type === "tool_result"
    );

    if (m.role === "assistant" && toolUseBlocks.length > 0) {
      // Assistant turn with tool_use blocks → assistant message with
      // tool_calls array (function calling format) plus optional content.
      out.push({
        role: "assistant",
        content: textBlocks.map((b) => b.text).join("") || null,
        tool_calls: toolUseBlocks.map((b) => ({
          id: b.id,
          type: "function",
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) }
        }))
      });
      continue;
    }

    if (m.role === "user" && toolResultBlocks.length > 0) {
      // User-role synthesised turn with tool results → emit one `tool`
      // message per tool_result, plus follow-up user image_url messages
      // for any image content. Text from tool_result text content goes
      // into the tool message's content field; images go into the
      // follow-up.
      const followUpImages: Array<Record<string, unknown>> = [];
      for (const tr of toolResultBlocks) {
        const textParts: string[] = [];
        for (const c of tr.content) {
          if (c.type === "text") {
            textParts.push(c.text);
          } else {
            // image
            if (!VALID_IMAGE_MEDIA_TYPES.has(c.mediaType)) {
              throw new Error(
                `Invalid image media type for OpenAI tool_result: ${c.mediaType}. ` +
                  "Must be one of image/png, image/jpeg, image/webp, image/gif."
              );
            }
            followUpImages.push({
              type: "image_url",
              image_url: { url: `data:${c.mediaType};base64,${c.data}` }
            });
          }
        }
        const toolMessage: Record<string, unknown> = {
          role: "tool",
          tool_call_id: tr.toolUseId,
          content: textParts.join("\n") || "(no text content)"
        };
        if (tr.isError) {
          // OpenAI tool messages have no native is_error flag — prepend
          // a marker so the model sees something distinct.
          toolMessage.content = `[tool error] ${toolMessage.content as string}`;
        }
        out.push(toolMessage);
        if (followUpImages.length > 0) {
          out.push({
            role: "user",
            content: [
              {
                type: "text",
                text: "Image attachment(s) from the previous tool call(s):"
              },
              ...followUpImages
            ]
          });
          followUpImages.length = 0;
        }
      }
      continue;
    }

    // Mixed/text-only block message — flatten to plain content.
    if (textBlocks.length > 0) {
      out.push({ role: m.role, content: textBlocks.map((b) => b.text).join("") });
    }
  }
  return out;
}

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
  const messages = serializeMessagesForOpenAI(request.systemPrompt ?? null, request.messages);

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

  // Multi-turn loop: emit a stop_reason chunk when the assistant turn
  // closes. OpenAI's finish_reason values: 'stop' | 'length' |
  // 'tool_calls' | 'content_filter' | 'function_call' (legacy).
  // Map to the unified stop_reason union.
  if (typeof choice.finish_reason === "string" && choice.finish_reason.length > 0) {
    const reason = choice.finish_reason;
    out.push({
      type: "stop_reason",
      reason:
        reason === "stop"
          ? "end_turn"
          : reason === "tool_calls"
            ? "tool_use"
            : reason === "length"
              ? "max_tokens"
              : "other"
    });
  }

  return out;
}
