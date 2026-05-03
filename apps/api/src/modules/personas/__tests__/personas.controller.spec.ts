import { Logger } from "@nestjs/common";
import { PersonasController } from "../personas.controller";
import { PersonasService } from "../personas.service";
import { AiProvidersService } from "../../ai-providers/ai-providers.service";
import { ConversationsService } from "../conversations.service";
import { PersonaDispatcherService, type DispatcherEvent } from "../dispatcher/persona-dispatcher.service";

type AuthLike = { sub?: string; permissions?: string[]; isSuperUser?: boolean };

function buildController(
  aiOverrides: Partial<AiProvidersService> = {},
  conversationsOverrides: Partial<ConversationsService> = {},
  dispatcherOverrides: Partial<PersonaDispatcherService> = {}
): PersonasController {
  const service = new PersonasService({} as never);
  const ai = {
    resolveProviderConfig: jest.fn(async () => ({
      providerId: "anthropic" as const,
      apiKey: "sk-test",
      model: "claude-sonnet-4-6",
      source: "company" as const
    })),
    resolveSystemPrompt: jest.fn(async () => "system"),
    streamChat: jest.fn(),
    ...aiOverrides
  } as unknown as AiProvidersService;
  const conversations = {
    findOrCreateActiveConversation: jest.fn(async () => ({ id: "conv-1" })),
    startNewConversation: jest.fn(async () => ({ id: "conv-new" })),
    listRecentConversations: jest.fn(async () => []),
    loadConversation: jest.fn(async () => ({ conversation: { id: "conv-1" }, messages: [] })),
    appendMessage: jest.fn(async () => ({ id: "msg-1" })),
    deleteConversation: jest.fn(async () => undefined),
    ...conversationsOverrides
  } as unknown as ConversationsService;
  // Default dispatcher mock yields a single conversation + done event.
  // Tests that need richer streams pass `dispatch` in dispatcherOverrides.
  const dispatcher = {
    dispatch: jest.fn(() =>
      fakeDispatchStream([
        { type: "conversation", conversationId: "conv-1" },
        { type: "done" }
      ])
    ),
    ...dispatcherOverrides
  } as unknown as PersonaDispatcherService;
  return new PersonasController(service, ai, conversations, dispatcher);
}

function buildResponse() {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  let ended = false;
  const res = {
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: jest.fn(() => {
      ended = true;
    })
  };
  return {
    res: res as never,
    written,
    headers,
    isEnded: () => ended
  };
}

async function* fakeDispatchStream(events: DispatcherEvent[]): AsyncIterable<DispatcherEvent> {
  for (const e of events) yield e;
}

describe("PersonasController.activeForRoute", () => {
  const tendering = (sub: string) => ({
    persona: {
      slug: "tendering",
      displayName: "Tendering Assistant",
      description: expect.any(String) as unknown as string
    },
    subMode: { name: sub, description: expect.any(String) as unknown as string }
  });

  it("returns persona for matching route + permitted user", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute("/tenders", actor as never);
    expect(result).toEqual(tendering("register"));
  });

  it("returns persona for matching route + Super User (permission bypassed)", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-sean", permissions: [], isSuperUser: true };
    const result = await controller.activeForRoute("/tenders/123?detail=scope", actor as never);
    expect(result).toEqual(tendering("scope"));
  });

  it("returns null for matching route + unpermitted user (graceful, not 403)", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-amy", permissions: ["finance.view"] };
    const result = await controller.activeForRoute("/tenders", actor as never);
    expect(result).toBeNull();
  });

  it("returns null for non-matching route", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute("/dashboards", actor as never);
    expect(result).toBeNull();
  });

  it("returns null when the url query param is missing", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute(undefined, actor as never);
    expect(result).toBeNull();
  });

  it("returns null when the url query param is an empty string", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute("", actor as never);
    expect(result).toBeNull();
  });
});

describe("PersonasController.chat", () => {
  const actor = { sub: "user-1", email: "raj@x.test", permissions: ["ai.persona.tendering"] };
  const dto = { messages: [{ role: "user" as const, content: "hi" }] };

  it("sets SSE headers and translates dispatcher text_delta → content events", async () => {
    const controller = buildController({}, {}, {
      dispatch: jest.fn(() =>
        fakeDispatchStream([
          { type: "conversation", conversationId: "conv-1" },
          { type: "text_delta", text: "Hello" },
          { type: "text_delta", text: ", world" },
          { type: "done" }
        ])
      ) as never
    });
    const { res, written, headers, isEnded } = buildResponse();
    await controller.chat("tendering", dto as never, actor as never, res as never);

    expect(headers["Content-Type"]).toBe("text/event-stream");
    expect(headers["Cache-Control"]).toBe("no-cache, no-transform");
    expect(headers["Connection"]).toBe("keep-alive");
    expect(written).toContain('data: {"type":"content","text":"Hello"}\n\n');
    expect(written).toContain('data: {"type":"content","text":", world"}\n\n');
    expect(written.at(-1)).toBe('data: {"type":"done"}\n\n');
    expect(isEnded()).toBe(true);
  });

  it("forwards subMode + caller userId through to resolveSystemPrompt", async () => {
    const resolveSystemPrompt = jest.fn(async () => "system");
    const controller = buildController({ resolveSystemPrompt });
    const { res } = buildResponse();
    await controller.chat(
      "tendering",
      { ...dto, subMode: "scope" } as never,
      actor as never,
      res as never
    );
    expect(resolveSystemPrompt).toHaveBeenCalledWith("tendering", "user-1", "scope", null);
  });

  it("emits a sanitised error event when resolveProviderConfig throws (e.g. missing key)", async () => {
    const controller = buildController({
      resolveProviderConfig: jest.fn(async () => {
        throw new Error("AI provider not configured. Contact your administrator.");
      }) as never
    });
    const { res, written, isEnded } = buildResponse();
    await controller.chat("tendering", dto as never, actor as never, res as never);
    expect(written.some((w) => w.includes('"type":"error"'))).toBe(true);
    expect(written.some((w) => w.includes("AI provider not configured"))).toBe(true);
    expect(written.at(-1)).toBe('data: {"type":"done"}\n\n');
    expect(isEnded()).toBe(true);
  });

  it("forwards tool_side_effect events with their original event name (proposals wire-shape preserved)", async () => {
    // Multi-turn loop refactor moved propose_scope_items to the
    // tool-handler registry; the side-effect SSE event must still hit
    // the wire as `type: "proposals"` so the frontend ProposalCardList
    // continues to work without change.
    const controller = buildController({}, {}, {
      dispatch: jest.fn(() =>
        fakeDispatchStream([
          { type: "conversation", conversationId: "conv-1" },
          {
            type: "tool_side_effect",
            event: "proposals",
            data: { messageId: "m-1", proposals: [{ index: 0, title: "x" }] }
          },
          { type: "done" }
        ])
      ) as never
    });
    const { res, written } = buildResponse();
    await controller.chat("tendering", dto as never, actor as never, res as never);
    expect(written.some((w) => w.includes('"type":"proposals"'))).toBe(true);
    expect(written.some((w) => w.includes('"messageId":"m-1"'))).toBe(true);
  });

  it("forwards dispatcher error events", async () => {
    const controller = buildController({}, {}, {
      dispatch: jest.fn(() =>
        fakeDispatchStream([
          { type: "conversation", conversationId: "conv-1" },
          { type: "text_delta", text: "partial" },
          { type: "error", error: "Maximum tool turns (10) reached." },
          { type: "done" }
        ])
      ) as never
    });
    const { res, written } = buildResponse();
    await controller.chat("tendering", dto as never, actor as never, res as never);
    expect(written.some((w) => w.includes("partial"))).toBe(true);
    expect(written.some((w) => w.includes('"type":"error"'))).toBe(true);
    expect(written.some((w) => w.includes("Maximum tool turns"))).toBe(true);
    expect(written.at(-1)).toBe('data: {"type":"done"}\n\n');
  });

  it("logs the full original error text server-side when resolveProviderConfig throws", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const controller = buildController({
      resolveProviderConfig: jest.fn(async () => {
        throw new Error("Anthropic API 401: invalid_api_key");
      }) as never
    });
    const { res } = buildResponse();
    await controller.chat("tendering", dto as never, actor as never, res as never);
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes("Anthropic API 401"))).toBe(
      true
    );
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes("invalid_api_key"))).toBe(
      true
    );
    errorSpy.mockRestore();
  });
});
