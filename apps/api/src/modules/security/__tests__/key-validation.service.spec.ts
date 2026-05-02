import { KeyValidationService } from "../key-validation.service";

describe("KeyValidationService", () => {
  let service: KeyValidationService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new KeyValidationService();
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(impl as typeof fetch);
  }

  describe("validateAnthropicKey", () => {
    it("returns valid:true on 200", async () => {
      mockFetch(async () => new Response("{}", { status: 200 }));
      const result = await service.validateAnthropicKey("sk-ant-XXX");
      expect(result).toEqual({ valid: true });
    });

    it("returns valid:false with auth category on 401", async () => {
      mockFetch(async () => new Response("invalid_api_key", { status: 401 }));
      const result = await service.validateAnthropicKey("bad-key");
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.category).toBe("auth");
        expect(result.reason).toMatch(/authentication failed/i);
      }
    });

    it("returns valid:false with rate-limit category on 429", async () => {
      mockFetch(async () => new Response("too many requests", { status: 429 }));
      const result = await service.validateAnthropicKey("sk-ant-XXX");
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.category).toBe("rate-limit");
        expect(result.reason).toMatch(/rate limit/i);
      }
    });

    it("returns valid:false with server category on 500", async () => {
      mockFetch(async () => new Response("internal error", { status: 500 }));
      const result = await service.validateAnthropicKey("sk-ant-XXX");
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.category).toBe("server");
      }
    });

    it("returns valid:false with network category on AbortError (timeout)", async () => {
      mockFetch(async (_input, init) => {
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });
      const result = await service.validateAnthropicKey("sk-ant-XXX");
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.category).toBe("network");
        expect(result.reason).toMatch(/timed out/i);
      }
    }, 10_000);

    it("returns valid:false with network category on fetch failure", async () => {
      mockFetch(async () => {
        throw new Error("fetch failed");
      });
      const result = await service.validateAnthropicKey("sk-ant-XXX");
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.category).toBe("network");
      }
    });
  });

  describe("validateOpenAiKey", () => {
    it("returns valid:true on 200", async () => {
      mockFetch(async () => new Response("{}", { status: 200 }));
      const result = await service.validateOpenAiKey("sk-XXX");
      expect(result).toEqual({ valid: true });
    });

    it("returns valid:false with auth on 401", async () => {
      mockFetch(async () => new Response("unauthorized", { status: 401 }));
      const result = await service.validateOpenAiKey("bad");
      expect(result.valid).toBe(false);
      if (result.valid === false) expect(result.category).toBe("auth");
    });
  });

  describe("validate dispatch", () => {
    it("dispatches to anthropic", async () => {
      mockFetch(async () => new Response("{}", { status: 200 }));
      const result = await service.validate("anthropic", "k");
      expect(result.valid).toBe(true);
    });

    it("dispatches to openai", async () => {
      mockFetch(async () => new Response("{}", { status: 200 }));
      const result = await service.validate("openai", "k");
      expect(result.valid).toBe(true);
    });

    it("throws not-implemented for gemini", async () => {
      await expect(service.validate("gemini", "k")).rejects.toThrow(/not yet implemented/i);
    });

    it("throws not-implemented for groq", async () => {
      await expect(service.validate("groq", "k")).rejects.toThrow(/not yet implemented/i);
    });
  });
});
