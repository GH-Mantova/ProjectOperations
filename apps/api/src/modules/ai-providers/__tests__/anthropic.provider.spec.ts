import { parseAnthropicEvent, streamAnthropicChat } from "../providers/anthropic.provider";
import type { ChatRequest, ChatStreamChunk } from "../ai-providers.types";

describe("parseAnthropicEvent", () => {
  it("parses a content_block_delta into a content chunk", () => {
    const raw = 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}';
    expect(parseAnthropicEvent(raw)).toEqual([{ type: "content", text: "Hello" }]);
  });

  it("emits done on message_stop", () => {
    const raw = 'event: message_stop\ndata: {"type":"message_stop"}';
    expect(parseAnthropicEvent(raw)).toEqual([{ type: "done" }]);
  });

  it("emits done on the literal [DONE] sentinel", () => {
    const raw = "data: [DONE]";
    expect(parseAnthropicEvent(raw)).toEqual([{ type: "done" }]);
  });

  it("returns an error chunk on error events", () => {
    const raw = 'event: error\ndata: {"type":"error","error":{"message":"rate limit"}}';
    expect(parseAnthropicEvent(raw)).toEqual([{ type: "error", error: "rate limit" }]);
  });

  it("ignores unknown event types", () => {
    const raw = 'event: ping\ndata: {"type":"ping"}';
    expect(parseAnthropicEvent(raw)).toEqual([]);
  });

  it("ignores events with no data lines", () => {
    expect(parseAnthropicEvent("event: ping\n: keepalive")).toEqual([]);
  });

  it("ignores malformed JSON gracefully", () => {
    expect(parseAnthropicEvent("data: {not json")).toEqual([]);
  });

  it("ignores empty text deltas", () => {
    const raw = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":""}}';
    expect(parseAnthropicEvent(raw)).toEqual([]);
  });

  it("joins multi-line data fields (Anthropic occasionally splits long deltas)", () => {
    const raw = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}';
    expect(parseAnthropicEvent(raw)).toEqual([{ type: "content", text: "hi" }]);
  });
});

describe("streamAnthropicChat — error paths", () => {
  const baseRequest: ChatRequest = {
    systemPrompt: "test",
    messages: [{ role: "user", content: "hi" }],
    config: { providerId: "anthropic", apiKey: "sk-test", model: "claude-sonnet-4-6" }
  };

  function withFetch(impl: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
    const original = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = impl as never;
    return () => {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    };
  }

  async function collect(iter: AsyncIterable<ChatStreamChunk>): Promise<ChatStreamChunk[]> {
    const out: ChatStreamChunk[] = [];
    for await (const c of iter) out.push(c);
    return out;
  }

  it("yields an error chunk on network failure", async () => {
    const restore = withFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    try {
      const out = await collect(streamAnthropicChat(baseRequest));
      expect(out).toHaveLength(1);
      expect(out[0]!.type).toBe("error");
    } finally {
      restore();
    }
  });

  it("yields an error chunk on non-OK HTTP response", async () => {
    const restore = withFetch(
      async () =>
        new Response(JSON.stringify({ error: { message: "rate limit" } }), {
          status: 429,
          headers: { "content-type": "application/json" }
        })
    );
    try {
      const out = await collect(streamAnthropicChat(baseRequest));
      expect(out).toHaveLength(1);
      expect(out[0]!.type).toBe("error");
      const errorChunk = out[0] as { type: "error"; error: string };
      expect(errorChunk.error).toContain("429");
    } finally {
      restore();
    }
  });

  it("parses content chunks and a final done from a streamed body", async () => {
    const sse = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":", world"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ].join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split arbitrarily to exercise the chunk-boundary buffering.
        const encoder = new TextEncoder();
        const slice = sse.slice(0, 40);
        const rest = sse.slice(40);
        controller.enqueue(encoder.encode(slice));
        controller.enqueue(encoder.encode(rest));
        controller.close();
      }
    });
    const restore = withFetch(
      async () =>
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" }
        })
    );
    try {
      const out = await collect(streamAnthropicChat(baseRequest));
      expect(out).toEqual([
        { type: "content", text: "Hello" },
        { type: "content", text: ", world" },
        { type: "done" }
      ]);
    } finally {
      restore();
    }
  });
});
