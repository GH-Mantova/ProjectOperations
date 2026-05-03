import { parseOpenAIEvent } from "../providers/openai.provider";

// §5A.1 PR 11 — OpenAI tool_calls streaming. The provider parses
// choices[0].delta.tool_calls deltas and finish_reason='tool_calls'
// into the unified tool_use_start / tool_use_delta / tool_use_stop
// chunk shape.

function event(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}`;
}

describe("OpenAI provider — tool_calls streaming", () => {
  it("emits tool_use_start on the first tool_calls fragment with id + name", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    const chunks = parseOpenAIEvent(
      event({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_ABC",
                  function: { name: "propose_scope_items", arguments: "" }
                }
              ]
            }
          }
        ]
      }),
      state
    );
    expect(chunks[0]).toEqual({
      type: "tool_use_start",
      id: "call_ABC",
      name: "propose_scope_items"
    });
    expect(state.get(0)).toEqual({
      id: "call_ABC",
      name: "propose_scope_items",
      partialJson: ""
    });
  });

  it("emits tool_use_delta on subsequent tool_calls argument fragments", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseOpenAIEvent(
      event({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "call_X", function: { name: "x", arguments: "" } }
              ]
            }
          }
        ]
      }),
      state
    );
    const chunks = parseOpenAIEvent(
      event({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '{"prop' } }]
            }
          }
        ]
      }),
      state
    );
    expect(chunks).toEqual([
      { type: "tool_use_delta", id: "call_X", partialJson: '{"prop' }
    ]);
    expect(state.get(0)?.partialJson).toBe('{"prop');
  });

  it("emits tool_use_stop on finish_reason 'tool_calls' with parsed args", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseOpenAIEvent(
      event({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "call_Y", function: { name: "propose_scope_items", arguments: '{"proposals":[]}' } }
              ]
            }
          }
        ]
      }),
      state
    );
    const chunks = parseOpenAIEvent(
      event({ choices: [{ finish_reason: "tool_calls", delta: {} }] }),
      state
    );
    expect(chunks[0]?.type).toBe("tool_use_stop");
    if (chunks[0]?.type === "tool_use_stop") {
      expect(chunks[0].id).toBe("call_Y");
      expect(chunks[0].finalArgs).toEqual({ proposals: [] });
    }
  });

  it("tracks multiple tool_calls by index independently", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseOpenAIEvent(
      event({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "call_a", function: { name: "tool_a", arguments: "" } },
                { index: 1, id: "call_b", function: { name: "tool_b", arguments: "" } }
              ]
            }
          }
        ]
      }),
      state
    );
    parseOpenAIEvent(
      event({
        choices: [
          { delta: { tool_calls: [{ index: 0, function: { arguments: '{"a":1}' } }] } }
        ]
      }),
      state
    );
    parseOpenAIEvent(
      event({
        choices: [
          { delta: { tool_calls: [{ index: 1, function: { arguments: '{"b":2}' } }] } }
        ]
      }),
      state
    );
    expect(state.get(0)?.partialJson).toBe('{"a":1}');
    expect(state.get(1)?.partialJson).toBe('{"b":2}');
  });

  it("text content delta still works alongside tool calls (no regression)", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    const chunks = parseOpenAIEvent(
      event({ choices: [{ delta: { content: "Hello" } }] }),
      state
    );
    expect(chunks).toEqual([{ type: "content", text: "Hello" }]);
  });

  it("[DONE] sentinel still terminates the stream (no regression)", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    const chunks = parseOpenAIEvent("data: [DONE]", state);
    expect(chunks).toEqual([{ type: "done" }]);
  });

  it("handles malformed JSON arguments via _parseError sentinel", () => {
    const state = new Map<number, { id: string; name: string; partialJson: string }>();
    parseOpenAIEvent(
      event({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "call_z", function: { name: "x", arguments: '{"broken' } }
              ]
            }
          }
        ]
      }),
      state
    );
    const chunks = parseOpenAIEvent(
      event({ choices: [{ finish_reason: "tool_calls", delta: {} }] }),
      state
    );
    expect(chunks[0]?.type).toBe("tool_use_stop");
    if (chunks[0]?.type === "tool_use_stop") {
      const args = chunks[0].finalArgs as { _parseError?: boolean };
      expect(args._parseError).toBe(true);
    }
  });
});
