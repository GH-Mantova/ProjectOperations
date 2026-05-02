import type { ChatRequest, ChatStreamChunk } from "../ai-providers.types";

export const OPENAI_DEFAULT_MODEL = "gpt-5.4-mini";
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
export async function* streamOpenAIChat(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  for (const m of request.messages) {
    messages.push({ role: m.role, content: m.content });
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
      body: JSON.stringify({
        model: request.config.model,
        max_tokens: MAX_TOKENS,
        messages,
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

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        for (const chunk of parseOpenAIEvent(rawEvent)) {
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
// data: lines carry JSON; we surface text deltas and ignore everything else.
export function parseOpenAIEvent(rawEvent: string): ChatStreamChunk[] {
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
    choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
  };

  if (obj.error) {
    return [{ type: "error", error: obj.error.message ?? "OpenAI returned an error event." }];
  }

  const choice = obj.choices?.[0];
  if (!choice) return [];
  const text = choice.delta?.content;
  if (typeof text === "string" && text.length > 0) {
    return [{ type: "content", text }];
  }
  // Some streams emit a final delta with finish_reason set and no content —
  // ignore those; the [DONE] sentinel will close the stream.
  return [];
}
