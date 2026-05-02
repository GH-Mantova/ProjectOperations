import { describe, expect, it } from "vitest";
import {
  appendAssistantMessage,
  appendUserMessage,
  parseSSEEvent,
  readSSEStream,
  shouldDisableSendButton,
  shouldResetOnPersonaChange
} from "../chat-helpers";
import type { ActivePersona } from "../types";

describe("shouldDisableSendButton", () => {
  it("disables while streaming regardless of input", () => {
    expect(shouldDisableSendButton("streaming", "anything")).toBe(true);
  });

  it("disables when input is empty or whitespace-only", () => {
    expect(shouldDisableSendButton("idle", "")).toBe(true);
    expect(shouldDisableSendButton("idle", "   ")).toBe(true);
    expect(shouldDisableSendButton("error", "\n\t")).toBe(true);
  });

  it("enables when idle/error and input is non-empty", () => {
    expect(shouldDisableSendButton("idle", "Hello")).toBe(false);
    expect(shouldDisableSendButton("error", "retry")).toBe(false);
  });
});

describe("appendUserMessage / appendAssistantMessage", () => {
  it("appends user messages immutably", () => {
    const before = [{ role: "user" as const, content: "first" }];
    const after = appendUserMessage(before, "second");
    expect(after).toHaveLength(2);
    expect(after[1]).toEqual({ role: "user", content: "second" });
    expect(before).toHaveLength(1);
  });

  it("appends assistant messages immutably", () => {
    const before: ReturnType<typeof appendUserMessage> = [];
    const after = appendAssistantMessage(before, "hi there");
    expect(after).toEqual([{ role: "assistant", content: "hi there" }]);
  });
});

describe("shouldResetOnPersonaChange", () => {
  const tendering = (subModeName: string): ActivePersona => ({
    persona: { slug: "tendering", displayName: "Tendering Assistant", description: "" },
    subMode: { name: subModeName, description: "" }
  });

  it("does not reset when both are null", () => {
    expect(shouldResetOnPersonaChange(null, null)).toBe(false);
  });

  it("resets when going from a persona to no persona, or vice versa", () => {
    expect(shouldResetOnPersonaChange(null, tendering("scope"))).toBe(true);
    expect(shouldResetOnPersonaChange(tendering("scope"), null)).toBe(true);
  });

  it("resets when the sub-mode changes (different tab in tendering)", () => {
    expect(shouldResetOnPersonaChange(tendering("scope"), tendering("quote"))).toBe(true);
  });

  it("does not reset when persona+sub-mode are unchanged (e.g. window reopen)", () => {
    expect(shouldResetOnPersonaChange(tendering("scope"), tendering("scope"))).toBe(false);
  });
});

describe("parseSSEEvent", () => {
  it("parses a content event", () => {
    expect(parseSSEEvent('data: {"type":"content","text":"Hello"}')).toEqual([
      { type: "content", text: "Hello" }
    ]);
  });

  it("parses a done event", () => {
    expect(parseSSEEvent('data: {"type":"done"}')).toEqual([{ type: "done" }]);
  });

  it("parses an error event", () => {
    expect(parseSSEEvent('data: {"type":"error","error":"rate limit"}')).toEqual([
      { type: "error", error: "rate limit" }
    ]);
  });

  it("ignores events with no data: lines", () => {
    expect(parseSSEEvent(": keepalive")).toEqual([]);
  });

  it("ignores malformed JSON", () => {
    expect(parseSSEEvent("data: {not json")).toEqual([]);
  });

  it("ignores unknown event types", () => {
    expect(parseSSEEvent('data: {"type":"unknown"}')).toEqual([]);
  });

  it("joins multi-line data fields", () => {
    expect(parseSSEEvent('data: {"type":"content","text":"line1\\nline2"}')).toEqual([
      { type: "content", text: "line1\nline2" }
    ]);
  });
});

describe("readSSEStream", () => {
  function makeResponse(chunks: string[]): Response {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      }
    });
    return new Response(stream, { status: 200 });
  }

  async function collect(iter: AsyncIterable<unknown>) {
    const out: unknown[] = [];
    for await (const c of iter) out.push(c);
    return out;
  }

  it("yields parsed events in order, buffers across network-chunk boundaries", async () => {
    // Split the second event across two network chunks to exercise buffering.
    const out = await collect(
      readSSEStream(
        makeResponse([
          'data: {"type":"content","text":"Hel',
          'lo"}\n\ndata: {"type":"content","text":"!"}\n\ndata: {"type":"done"}\n\n'
        ])
      )
    );
    expect(out).toEqual([
      { type: "content", text: "Hello" },
      { type: "content", text: "!" },
      { type: "done" }
    ]);
  });

  it("stops at done and ignores anything after", async () => {
    const out = await collect(
      readSSEStream(
        makeResponse([
          'data: {"type":"content","text":"a"}\n\n',
          'data: {"type":"done"}\n\n',
          'data: {"type":"content","text":"never"}\n\n'
        ])
      )
    );
    expect(out).toEqual([
      { type: "content", text: "a" },
      { type: "done" }
    ]);
  });

  it("stops at error", async () => {
    const out = await collect(
      readSSEStream(
        makeResponse([
          'data: {"type":"content","text":"partial"}\n\n',
          'data: {"type":"error","error":"oops"}\n\n',
          'data: {"type":"content","text":"never"}\n\n'
        ])
      )
    );
    expect(out).toEqual([
      { type: "content", text: "partial" },
      { type: "error", error: "oops" }
    ]);
  });
});
