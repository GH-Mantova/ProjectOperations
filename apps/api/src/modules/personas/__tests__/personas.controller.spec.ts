import { PersonasController } from "../personas.controller";
import { PersonasService } from "../personas.service";
import { AiProvidersService } from "../../ai-providers/ai-providers.service";
import type { ChatStreamChunk } from "../../ai-providers/ai-providers.types";

type AuthLike = { sub?: string; permissions?: string[]; isSuperUser?: boolean };

function buildController(aiOverrides: Partial<AiProvidersService> = {}): PersonasController {
  const service = new PersonasService({} as never);
  const ai = {
    resolveProviderConfig: jest.fn(async () => ({
      providerId: "anthropic" as const,
      apiKey: "sk-test",
      model: "claude-sonnet-4-6"
    })),
    resolveSystemPrompt: jest.fn(async () => "system"),
    streamChat: jest.fn(),
    ...aiOverrides
  } as unknown as AiProvidersService;
  return new PersonasController(service, ai);
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

async function* fakeStream(chunks: ChatStreamChunk[]): AsyncIterable<ChatStreamChunk> {
  for (const c of chunks) yield c;
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
    // /tenders is the canonical Tendering Assistant route post-collapse —
    // it covers both register and pipeline views (toggleable in the UI).
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

  it("sets SSE headers and streams content + done events", async () => {
    const controller = buildController({
      streamChat: jest.fn(() =>
        fakeStream([
          { type: "content", text: "Hello" },
          { type: "content", text: ", world" }
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
    const controller = buildController({
      resolveSystemPrompt,
      streamChat: jest.fn(() => fakeStream([])) as never
    });
    const { res } = buildResponse();
    await controller.chat(
      "tendering",
      { ...dto, subMode: "scope" } as never,
      actor as never,
      res as never
    );
    expect(resolveSystemPrompt).toHaveBeenCalledWith("tendering", "user-1", "scope");
  });

  it("emits an error event when resolveProviderConfig throws (e.g. missing key)", async () => {
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

  it("emits an error event mid-stream and stops sending content after it", async () => {
    const controller = buildController({
      streamChat: jest.fn(() =>
        fakeStream([
          { type: "content", text: "partial" },
          { type: "error", error: "rate limited" },
          { type: "content", text: "should not appear" }
        ])
      ) as never
    });
    const { res, written } = buildResponse();
    await controller.chat("tendering", dto as never, actor as never, res as never);
    expect(written.some((w) => w.includes("partial"))).toBe(true);
    expect(written.some((w) => w.includes("rate limited"))).toBe(true);
    expect(written.some((w) => w.includes("should not appear"))).toBe(false);
    // 'done' is always the final write so the client knows the stream is finished.
    expect(written.at(-1)).toBe('data: {"type":"done"}\n\n');
  });
});
