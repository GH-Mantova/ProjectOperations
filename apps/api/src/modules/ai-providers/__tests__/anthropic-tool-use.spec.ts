import { parseAnthropicEvent } from "../providers/anthropic.provider";

// §5A.1 PR 11 — Anthropic tool_use streaming. The provider parses
// content_block_start (type=tool_use), content_block_delta
// (input_json_delta), and content_block_stop into the unified
// tool_use_start / tool_use_delta / tool_use_stop chunk shape.

function event(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}`;
}

describe("Anthropic provider — tool_use streaming", () => {
  it("emits tool_use_start on content_block_start with tool_use type", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    const chunks = parseAnthropicEvent(
      event({
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "toolu_01ABC", name: "propose_scope_items" }
      }),
      state
    );
    expect(chunks).toEqual([
      { type: "tool_use_start", id: "toolu_01ABC", name: "propose_scope_items" }
    ]);
    expect(state.get(0)).toEqual({
      id: "toolu_01ABC",
      name: "propose_scope_items",
      partialJson: ""
    });
  });

  it("emits tool_use_delta on input_json_delta and accumulates partial JSON", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseAnthropicEvent(
      event({
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "toolu_1", name: "propose_scope_items" }
      }),
      state
    );
    const c1 = parseAnthropicEvent(
      event({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"proposals":' }
      }),
      state
    );
    const c2 = parseAnthropicEvent(
      event({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "[]}" }
      }),
      state
    );
    expect(c1).toEqual([
      { type: "tool_use_delta", id: "toolu_1", partialJson: '{"proposals":' }
    ]);
    expect(c2).toEqual([
      { type: "tool_use_delta", id: "toolu_1", partialJson: "[]}" }
    ]);
    expect(state.get(0)?.partialJson).toBe('{"proposals":[]}');
  });

  it("emits tool_use_stop with parsed args on content_block_stop", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseAnthropicEvent(
      event({
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "toolu_2", name: "propose_scope_items" }
      }),
      state
    );
    parseAnthropicEvent(
      event({
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "input_json_delta",
          partial_json: '{"proposals":[{"discipline":"demolition","title":"x","description":"y","quantity":1,"unit":"sqm"}]}'
        }
      }),
      state
    );
    const stop = parseAnthropicEvent(
      event({ type: "content_block_stop", index: 0 }),
      state
    );
    expect(stop).toHaveLength(1);
    expect(stop[0]!.type).toBe("tool_use_stop");
    if (stop[0]!.type === "tool_use_stop") {
      expect(stop[0]!.id).toBe("toolu_2");
      expect(stop[0]!.name).toBe("propose_scope_items");
      const args = stop[0]!.finalArgs as { proposals: unknown[] };
      expect(Array.isArray(args.proposals)).toBe(true);
    }
    expect(state.has(0)).toBe(false);
  });

  it("tracks multiple tool_use blocks by index independently", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseAnthropicEvent(
      event({
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "tu0", name: "tool_a" }
      }),
      state
    );
    parseAnthropicEvent(
      event({
        type: "content_block_start",
        index: 1,
        content_block: { type: "tool_use", id: "tu1", name: "tool_b" }
      }),
      state
    );
    parseAnthropicEvent(
      event({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "{}" }
      }),
      state
    );
    parseAnthropicEvent(
      event({
        type: "content_block_delta",
        index: 1,
        delta: { type: "input_json_delta", partial_json: '{"x":1}' }
      }),
      state
    );
    expect(state.get(0)?.partialJson).toBe("{}");
    expect(state.get(1)?.partialJson).toBe('{"x":1}');
  });

  it("ignores content_block_stop for non-tool_use blocks (text blocks)", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    // Index 0 was never registered as a tool_use block
    const stop = parseAnthropicEvent(event({ type: "content_block_stop", index: 0 }), state);
    expect(stop).toEqual([]);
  });

  it("survives malformed JSON arguments (defence-in-depth)", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseAnthropicEvent(
      event({
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "tu0", name: "x" }
      }),
      state
    );
    parseAnthropicEvent(
      event({
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"broken' }
      }),
      state
    );
    const stop = parseAnthropicEvent(
      event({ type: "content_block_stop", index: 0 }),
      state
    );
    expect(stop[0]!.type).toBe("tool_use_stop");
    if (stop[0]!.type === "tool_use_stop") {
      const args = stop[0]!.finalArgs as { _parseError?: boolean };
      expect(args._parseError).toBe(true);
    }
  });

  it("text content delta still works alongside tool blocks (no regression)", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    const chunks = parseAnthropicEvent(
      event({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" }
      }),
      state
    );
    expect(chunks).toEqual([{ type: "content", text: "Hello" }]);
  });
});
