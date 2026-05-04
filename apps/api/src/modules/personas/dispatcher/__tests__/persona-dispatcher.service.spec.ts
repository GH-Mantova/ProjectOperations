import { Logger } from "@nestjs/common";
import { PersonaDispatcherService, type DispatcherEvent } from "../persona-dispatcher.service";
import {
  ToolHandlerRegistry,
  buildSubModeKey
} from "../../tools/tool-handler.registry";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../../tools/tool-handler.types";
import type {
  ChatMessage,
  ChatStreamChunk,
  ChatToolResultBlock,
  ProviderConfig
} from "../../../ai-providers/ai-providers.types";
import type { AiProvidersService } from "../../../ai-providers/ai-providers.service";
import type { ConversationsService } from "../../conversations.service";

const ACTOR = { sub: "user-1", permissions: ["ai.persona.tendering"] };
const CONFIG: ProviderConfig = {
  providerId: "anthropic",
  apiKey: "sk-test",
  model: "claude-sonnet-4-6",
  source: "company"
};

async function* fakeProviderStream(chunks: ChatStreamChunk[]): AsyncIterable<ChatStreamChunk> {
  for (const c of chunks) yield c;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of iter) out.push(x);
  return out;
}

class StubHandler implements ToolHandler {
  name: string;
  description = "Stub handler for tests.";
  inputSchema = { type: "object" as const, properties: {}, required: [] };
  constructor(
    name: string,
    private readonly impl: (
      input: unknown,
      ctx: ToolHandlerContext
    ) => Promise<ToolHandlerExecuteResult>
  ) {
    this.name = name;
  }
  execute(input: unknown, ctx: ToolHandlerContext) {
    return this.impl(input, ctx);
  }
}

function buildDispatcher(
  registryHandlers: ToolHandler[],
  subModeBindings: Array<[string, string[]]>,
  providerStreams: ChatStreamChunk[][]
) {
  const registry = new ToolHandlerRegistry();
  for (const h of registryHandlers) registry.register(h);
  for (const [key, names] of subModeBindings) registry.bindToSubMode(key, names);

  // Mock AiProvidersService.streamChat to yield the next pre-built stream
  // each time it's called (one stream per turn in the loop).
  const streamCalls: ChatStreamChunk[][] = [...providerStreams];
  const aiProviders = {
    streamChat: jest.fn(() => {
      const next = streamCalls.shift();
      if (!next) throw new Error("provider streamChat called more times than mocked streams");
      return fakeProviderStream(next);
    })
  } as unknown as AiProvidersService;

  // Mock ConversationsService — track appendMessage calls + return
  // accumulated history from loadAllMessages so the loop's history
  // rebuild reflects the writes it just made.
  const persisted: Array<{
    role: string;
    content: string;
    visibility: string;
    metadata: unknown;
  }> = [];
  const conversations = {
    appendMessage: jest.fn(
      async (
        _convId: string,
        role: string,
        content: string,
        opts: { visibility?: string; payload?: unknown } = {}
      ) => {
        persisted.push({
          role,
          content,
          visibility: opts.visibility ?? "USER",
          metadata: opts.payload ?? null
        });
        return { id: `m-${persisted.length}`, role, content } as never;
      }
    ),
    loadAllMessages: jest.fn(async () =>
      persisted.map((p, i) => ({
        id: `m-${i + 1}`,
        conversationId: "conv-1",
        role: p.role,
        content: p.content,
        model: null,
        providerSource: null,
        metadata: p.metadata as never,
        visibility: p.visibility,
        createdAt: new Date()
      }))
    )
  } as unknown as ConversationsService;

  const dispatcher = new PersonaDispatcherService(registry, aiProviders, conversations);
  return { dispatcher, registry, aiProviders, conversations, persisted };
}

const SUBMODE_KEY = buildSubModeKey("tendering", "scope");

describe("PersonaDispatcherService", () => {
  describe("text-only conversation", () => {
    it("completes in one turn when model returns no tool calls", async () => {
      const { dispatcher } = buildDispatcher([], [], [
        [
          { type: "content", text: "hello" },
          { type: "stop_reason", reason: "end_turn" },
          { type: "done" }
        ]
      ]);
      const events = await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: "tender-1",
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );
      const types = events.map((e) => e.type);
      expect(types).toContain("text_delta");
      expect(types[types.length - 1]).toBe("done");
      const textEvents = events.filter(
        (e): e is Extract<DispatcherEvent, { type: "text_delta" }> => e.type === "text_delta"
      );
      expect(textEvents.map((e) => e.text).join("")).toBe("hello");
    });

    it("persists assistant text turn with visibility USER", async () => {
      const { dispatcher, persisted } = buildDispatcher([], [], [
        [
          { type: "content", text: "ok" },
          { type: "stop_reason", reason: "end_turn" },
          { type: "done" }
        ]
      ]);
      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "register",
          contextKey: null,
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );
      expect(persisted).toEqual([
        expect.objectContaining({ role: "assistant", content: "ok", visibility: "USER" })
      ]);
    });
  });

  describe("single tool call (text result)", () => {
    it("runs the tool, feeds result back, completes in turn 2", async () => {
      const handler = new StubHandler("clock", async () => ({
        result: { content: [{ type: "text", text: "2026-05-03T20:00:00Z" }] }
      }));
      const { dispatcher, aiProviders, persisted } = buildDispatcher(
        [handler],
        [[SUBMODE_KEY, ["clock"]]],
        [
          // Turn 1: model emits a tool_use
          [
            { type: "content", text: "Let me check." },
            { type: "tool_use_start", id: "tu-1", name: "clock" },
            {
              type: "tool_use_stop",
              id: "tu-1",
              name: "clock",
              finalArgs: {}
            },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          // Turn 2: model uses the result and finishes
          [
            { type: "content", text: "It's 8 PM." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );

      const events = await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: null,
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );

      // streamChat called twice — one per turn
      expect((aiProviders.streamChat as jest.Mock).mock.calls).toHaveLength(2);

      // Persisted: assistant turn 1 (INTERNAL, has tool_use), tool_result
      // turn (INTERNAL), assistant turn 2 (USER)
      const visibilities = persisted.map((p) => `${p.role}:${p.visibility}`);
      expect(visibilities).toEqual([
        "assistant:INTERNAL",
        "tool_result:INTERNAL",
        "assistant:USER"
      ]);

      // tool_use_started + tool_use_completed events emitted
      const toolEventTypes = events
        .filter((e) => e.type === "tool_use_started" || e.type === "tool_use_completed")
        .map((e) => e.type);
      expect(toolEventTypes).toEqual(["tool_use_started", "tool_use_completed"]);
    });
  });

  describe("single tool call (image result)", () => {
    it("persists tool_result with image marker but text content readable on replay", async () => {
      const handler = new StubHandler("snapshot", async () => ({
        result: {
          content: [
            { type: "text", text: "here it is" },
            { type: "image", mediaType: "image/png", data: "iVBORw0KGgo=" }
          ]
        }
      }));
      const { dispatcher, persisted } = buildDispatcher(
        [handler],
        [[SUBMODE_KEY, ["snapshot"]]],
        [
          [
            { type: "tool_use_start", id: "tu-1", name: "snapshot" },
            {
              type: "tool_use_stop",
              id: "tu-1",
              name: "snapshot",
              finalArgs: {}
            },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "I can see it." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );

      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: null,
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );

      const toolResultRow = persisted.find((p) => p.role === "tool_result");
      expect(toolResultRow).toBeDefined();
      // Image content omitted at persist time (replay would re-call the
      // tool); text content kept verbatim.
      const meta = toolResultRow!.metadata as { content: Array<{ type: string; omitted?: boolean }> };
      expect(meta.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text", text: "here it is" }),
          expect.objectContaining({ type: "image", omitted: true })
        ])
      );
    });
  });

  describe("error policy", () => {
    it("tool throws → returns error as tool_result with isError=true, loop continues", async () => {
      const handler = new StubHandler("flaky", async () => {
        throw new Error("boom");
      });
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const { dispatcher, persisted } = buildDispatcher(
        [handler],
        [[SUBMODE_KEY, ["flaky"]]],
        [
          [
            { type: "tool_use_start", id: "tu-1", name: "flaky" },
            { type: "tool_use_stop", id: "tu-1", name: "flaky", finalArgs: {} },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "Sorry, that tool failed." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );

      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: null,
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );

      const toolResultRow = persisted.find((p) => p.role === "tool_result");
      expect(toolResultRow).toBeDefined();
      const meta = toolResultRow!.metadata as { isError: boolean };
      expect(meta.isError).toBe(true);
      // Loop continued to a final assistant turn after the error
      const lastAssistant = [...persisted].reverse().find((p) => p.role === "assistant");
      expect(lastAssistant?.visibility).toBe("USER");
      warnSpy.mockRestore();
    });

    it("unknown tool name → returns error as tool_result, loop continues", async () => {
      const { dispatcher, persisted } = buildDispatcher(
        [],
        [[SUBMODE_KEY, []]],
        [
          [
            { type: "tool_use_start", id: "tu-1", name: "ghost_tool" },
            { type: "tool_use_stop", id: "tu-1", name: "ghost_tool", finalArgs: {} },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "That tool doesn't exist." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );
      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: null,
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );
      const toolResultRow = persisted.find((p) => p.role === "tool_result");
      expect(toolResultRow).toBeDefined();
      expect((toolResultRow!.metadata as { isError: boolean }).isError).toBe(true);
    });
  });

  describe("parallel tool calls", () => {
    it("rejects more than 8 parallel calls per turn", async () => {
      const handler = new StubHandler("h", async () => ({
        result: { content: [{ type: "text", text: "ok" }] }
      }));
      const { dispatcher } = buildDispatcher([handler], [[SUBMODE_KEY, ["h"]]], [
        [
          ...Array.from({ length: 9 }, (_, i) => [
            { type: "tool_use_start" as const, id: `tu-${i}`, name: "h" },
            { type: "tool_use_stop" as const, id: `tu-${i}`, name: "h", finalArgs: {} }
          ]).flat(),
          { type: "stop_reason", reason: "tool_use" },
          { type: "done" }
        ]
      ]);
      const events = await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: null,
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );
      const errors = events.filter((e) => e.type === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect((errors[0] as { error: string }).error).toMatch(/9 tool calls in one turn/);
    });
  });

  describe("image content round-trip across turns (PR #147)", () => {
    // Helper: pull tool_result blocks out of a captured streamChat
    // messages array regardless of whether content is a string or block array.
    function extractToolResultBlocks(messages: ChatMessage[]): ChatToolResultBlock[] {
      return messages.flatMap((m) =>
        typeof m.content === "string"
          ? []
          : m.content.filter((b): b is ChatToolResultBlock => b.type === "tool_result")
      );
    }

    it("passes full image content on the turn immediately after tool execution", async () => {
      const imageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";
      const handler = new StubHandler("render_drawing", async () => ({
        result: {
          content: [
            { type: "image", mediaType: "image/jpeg", data: imageData },
            { type: "text", text: "Drawing rendered." }
          ]
        }
      }));
      const { dispatcher, aiProviders } = buildDispatcher(
        [handler],
        [[SUBMODE_KEY, ["render_drawing"]]],
        [
          [
            { type: "tool_use_start", id: "tu-1", name: "render_drawing" },
            { type: "tool_use_stop", id: "tu-1", name: "render_drawing", finalArgs: {} },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "I can see the drawing." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );

      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: "tender-1",
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );

      // Second streamChat call (turn 2) carries the full-content
      // tool_result with the actual image bytes — not a "not replayed"
      // marker. This is the PR #147 fix.
      const calls = (aiProviders.streamChat as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      const secondCallMessages = calls[1][0].messages as ChatMessage[];
      const toolResultBlocks = extractToolResultBlocks(secondCallMessages);
      expect(toolResultBlocks).toHaveLength(1);
      const toolResult = toolResultBlocks[0]!;
      expect(toolResult.toolUseId).toBe("tu-1");

      const imageBlocks = toolResult.content.filter(
        (c): c is Extract<ChatToolResultBlock["content"][number], { type: "image" }> =>
          c.type === "image"
      );
      expect(imageBlocks).toHaveLength(1);
      expect(imageBlocks[0]!.mediaType).toBe("image/jpeg");
      expect(imageBlocks[0]!.data).toBe(imageData);

      for (const tb of toolResult.content.filter(
        (c): c is Extract<ChatToolResultBlock["content"][number], { type: "text" }> =>
          c.type === "text"
      )) {
        expect(tb.text).not.toContain("not replayed");
      }
    });

    it("does NOT pass image content for tool results from older turns", async () => {
      // Turn 1: image tool fires. Turn 2: text-only tool fires. Turn 3:
      // model finishes. On turn 3, the turn-1 tool_result should be
      // image-stripped (DB rebuild path with "not replayed" marker)
      // because pendingFullToolResults was cleared after turn 2.
      const imageHandler = new StubHandler("render_drawing", async () => ({
        result: {
          content: [
            { type: "image", mediaType: "image/jpeg", data: "abc" }
          ]
        }
      }));
      const textHandler = new StubHandler("clock", async () => ({
        result: { content: [{ type: "text", text: "now" }] }
      }));
      const { dispatcher, aiProviders } = buildDispatcher(
        [imageHandler, textHandler],
        [[SUBMODE_KEY, ["render_drawing", "clock"]]],
        [
          [
            { type: "tool_use_start", id: "tu-1", name: "render_drawing" },
            { type: "tool_use_stop", id: "tu-1", name: "render_drawing", finalArgs: {} },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "tool_use_start", id: "tu-2", name: "clock" },
            { type: "tool_use_stop", id: "tu-2", name: "clock", finalArgs: {} },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "Done." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );

      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: "tender-1",
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );

      const calls = (aiProviders.streamChat as jest.Mock).mock.calls;
      expect(calls).toHaveLength(3);
      const turn3Messages = calls[2][0].messages as ChatMessage[];
      const turn3ToolResults = extractToolResultBlocks(turn3Messages);
      // Both tool_results present in history; the older (image) one
      // must be image-stripped, the most recent (text) one is unchanged.
      const imgResult = turn3ToolResults.find((b) => b.toolUseId === "tu-1");
      expect(imgResult).toBeDefined();
      const imgBlocks = imgResult!.content.filter((c) => c.type === "image");
      expect(imgBlocks).toHaveLength(0);
      const textBlocks = imgResult!.content.filter(
        (c): c is Extract<ChatToolResultBlock["content"][number], { type: "text" }> =>
          c.type === "text"
      );
      expect(textBlocks.some((tb) => tb.text.includes("not replayed"))).toBe(true);
    });

    it("preserves toolUseId mapping when splicing parallel image tool calls", async () => {
      const handlerA = new StubHandler("render_a", async () => ({
        result: { content: [{ type: "image", mediaType: "image/png", data: "AAA" }] }
      }));
      const handlerB = new StubHandler("render_b", async () => ({
        result: { content: [{ type: "image", mediaType: "image/png", data: "BBB" }] }
      }));
      const { dispatcher, aiProviders } = buildDispatcher(
        [handlerA, handlerB],
        [[SUBMODE_KEY, ["render_a", "render_b"]]],
        [
          [
            { type: "tool_use_start", id: "tu-A", name: "render_a" },
            { type: "tool_use_stop", id: "tu-A", name: "render_a", finalArgs: {} },
            { type: "tool_use_start", id: "tu-B", name: "render_b" },
            { type: "tool_use_stop", id: "tu-B", name: "render_b", finalArgs: {} },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "Got both." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );

      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: "tender-1",
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );

      const calls = (aiProviders.streamChat as jest.Mock).mock.calls;
      const turn2Messages = calls[1][0].messages as ChatMessage[];
      const blocks = extractToolResultBlocks(turn2Messages);
      const a = blocks.find((b) => b.toolUseId === "tu-A");
      const bb = blocks.find((b) => b.toolUseId === "tu-B");
      expect(a).toBeDefined();
      expect(bb).toBeDefined();
      const aImg = a!.content.find(
        (c): c is Extract<ChatToolResultBlock["content"][number], { type: "image" }> =>
          c.type === "image"
      );
      const bImg = bb!.content.find(
        (c): c is Extract<ChatToolResultBlock["content"][number], { type: "image" }> =>
          c.type === "image"
      );
      expect(aImg!.data).toBe("AAA");
      expect(bImg!.data).toBe("BBB");
    });

    it("is a no-op for tool results that returned only text", async () => {
      const handler = new StubHandler("clock", async () => ({
        result: { content: [{ type: "text", text: "2026-05-05" }] }
      }));
      const { dispatcher, aiProviders } = buildDispatcher(
        [handler],
        [[SUBMODE_KEY, ["clock"]]],
        [
          [
            { type: "tool_use_start", id: "tu-1", name: "clock" },
            { type: "tool_use_stop", id: "tu-1", name: "clock", finalArgs: {} },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "Now is 2026-05-05." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );

      await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: null,
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );

      const calls = (aiProviders.streamChat as jest.Mock).mock.calls;
      const turn2Messages = calls[1][0].messages as ChatMessage[];
      const blocks = extractToolResultBlocks(turn2Messages);
      expect(blocks).toHaveLength(1);
      const textBlocks = blocks[0]!.content.filter(
        (c): c is Extract<ChatToolResultBlock["content"][number], { type: "text" }> =>
          c.type === "text"
      );
      expect(textBlocks.some((tb) => tb.text === "2026-05-05")).toBe(true);
      // No accidental image substitution.
      const imgBlocks = blocks[0]!.content.filter((c) => c.type === "image");
      expect(imgBlocks).toHaveLength(0);
    });
  });

  describe("propose_scope_items migration regression", () => {
    it("forwards tool_side_effect with event=proposals (PR #137 wire shape preserved)", async () => {
      const handler = new StubHandler("propose_scope_items", async () => ({
        result: { content: [{ type: "text", text: "Drafted 1 proposal." }] },
        sideEffects: [
          {
            type: "sse",
            event: "proposals",
            data: { messageId: "m-x", proposals: [{ index: 0 }] }
          }
        ]
      }));
      const { dispatcher } = buildDispatcher(
        [handler],
        [[SUBMODE_KEY, ["propose_scope_items"]]],
        [
          [
            {
              type: "tool_use_start",
              id: "tu-1",
              name: "propose_scope_items"
            },
            {
              type: "tool_use_stop",
              id: "tu-1",
              name: "propose_scope_items",
              finalArgs: { proposals: [] }
            },
            { type: "stop_reason", reason: "tool_use" },
            { type: "done" }
          ],
          [
            { type: "content", text: "Done." },
            { type: "stop_reason", reason: "end_turn" },
            { type: "done" }
          ]
        ]
      );
      const events = await collect(
        dispatcher.dispatch({
          conversationId: "conv-1",
          personaSlug: "tendering",
          subMode: "scope",
          contextKey: "tender-1",
          systemPrompt: "sys",
          config: CONFIG,
          actor: ACTOR
        })
      );
      const sideEffects = events.filter(
        (e): e is Extract<DispatcherEvent, { type: "tool_side_effect" }> =>
          e.type === "tool_side_effect"
      );
      expect(sideEffects).toHaveLength(1);
      expect(sideEffects[0]!.event).toBe("proposals");
      expect(sideEffects[0]!.data.messageId).toBe("m-x");
    });
  });
});
