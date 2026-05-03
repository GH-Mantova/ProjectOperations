import { parseOpenAIEvent, streamOpenAIChat } from "../providers/openai.provider";
import type { ChatRequest, ChatStreamChunk } from "../ai-providers.types";

describe("parseOpenAIEvent", () => {
  it("parses a content delta into a content chunk", () => {
    const raw = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    expect(parseOpenAIEvent(raw)).toEqual([{ type: "content", text: "Hello" }]);
  });

  it("emits done on the [DONE] sentinel", () => {
    expect(parseOpenAIEvent("data: [DONE]")).toEqual([{ type: "done" }]);
  });

  it("returns an error chunk on top-level error objects", () => {
    const raw = 'data: {"error":{"message":"bad request"}}';
    expect(parseOpenAIEvent(raw)).toEqual([{ type: "error", error: "bad request" }]);
  });

  it("ignores empty deltas (no content yet)", () => {
    const raw = 'data: {"choices":[{"delta":{},"finish_reason":null}]}';
    expect(parseOpenAIEvent(raw)).toEqual([]);
  });

  it("emits stop_reason chunk on finish_reason='stop' (multi-turn loop signal)", () => {
    const raw = 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}';
    expect(parseOpenAIEvent(raw)).toEqual([{ type: "stop_reason", reason: "end_turn" }]);
  });

  it("ignores malformed JSON gracefully", () => {
    expect(parseOpenAIEvent("data: {not json")).toEqual([]);
  });

  it("ignores events with no data: lines", () => {
    expect(parseOpenAIEvent(": keepalive")).toEqual([]);
  });

  it("ignores empty content strings", () => {
    const raw = 'data: {"choices":[{"delta":{"content":""}}]}';
    expect(parseOpenAIEvent(raw)).toEqual([]);
  });

  it("joins multi-line data fields per SSE spec", () => {
    const raw = 'data: {"choices":[{"delta":{"content":"line1\\nline2"}}]}';
    expect(parseOpenAIEvent(raw)).toEqual([{ type: "content", text: "line1\nline2" }]);
  });
});

describe("streamOpenAIChat", () => {
  const baseRequest: ChatRequest = {
    systemPrompt: "test system",
    messages: [{ role: "user", content: "hi" }],
    config: { providerId: "openai", apiKey: "sk-test", model: "gpt-5.4-mini", source: "company" }
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
      const out = await collect(streamOpenAIChat(baseRequest));
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
      const out = await collect(streamOpenAIChat(baseRequest));
      expect(out).toHaveLength(1);
      expect(out[0]!.type).toBe("error");
      const errorChunk = out[0] as { type: "error"; error: string };
      expect(errorChunk.error).toContain("429");
    } finally {
      restore();
    }
  });

  it("calls OpenAI with bearer auth, system message prepended, stream:true", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const restore = withFetch(async (input, init) => {
      captured = { url: String(input), init: init ?? {} };
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      });
      return new Response(stream, { status: 200 });
    });
    try {
      await collect(streamOpenAIChat(baseRequest));
      expect(captured).not.toBeNull();
      expect(captured!.url).toBe("https://api.openai.com/v1/chat/completions");
      const headers = captured!.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer sk-test");
      const body = JSON.parse(captured!.init.body as string) as {
        model: string;
        stream: boolean;
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.model).toBe("gpt-5.4-mini");
      expect(body.stream).toBe(true);
      expect(body.messages[0]).toEqual({ role: "system", content: "test system" });
      expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    } finally {
      restore();
    }
  });

  it("parses content chunks across network-chunk boundaries and ends on [DONE]", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":", world"}}]}\n\n',
      "data: [DONE]\n\n"
    ].join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        // Split mid-event to exercise buffering.
        controller.enqueue(encoder.encode(sse.slice(0, 35)));
        controller.enqueue(encoder.encode(sse.slice(35)));
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
      const out = await collect(streamOpenAIChat(baseRequest));
      expect(out).toEqual([
        { type: "content", text: "Hello" },
        { type: "content", text: ", world" },
        { type: "done" }
      ]);
    } finally {
      restore();
    }
  });

  it("omits the system message when systemPrompt is empty (still works)", async () => {
    let captured: { init: RequestInit } | null = null;
    const restore = withFetch(async (_input, init) => {
      captured = { init: init ?? {} };
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      });
      return new Response(stream, { status: 200 });
    });
    try {
      await collect(streamOpenAIChat({ ...baseRequest, systemPrompt: "" }));
      const body = JSON.parse(captured!.init.body as string) as {
        messages: Array<{ role: string }>;
      };
      expect(body.messages[0]!.role).toBe("user");
    } finally {
      restore();
    }
  });
});
