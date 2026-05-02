import { ServiceUnavailableException } from "@nestjs/common";
import { AiProvidersService } from "../ai-providers.service";

const TENDERING_ROW = { id: "persona-tendering-id", slug: "tendering" };

type AnyRecord = Record<string, unknown>;

function buildPrismaMock(overrides: {
  personaRow?: AnyRecord | null;
  companyInstruction?: { instruction: string } | null;
  userSettings?: { providerOverride?: string | null; instructionOverride?: string | null } | null;
  globalSettings?: {
    allowUserInstructionOverrides: boolean;
    enabledProviders: string[];
    allowBringYourOwnKey: boolean;
  } | null;
}) {
  const personaFindUnique = jest.fn(async () =>
    overrides.personaRow === null ? null : overrides.personaRow ?? TENDERING_ROW
  );
  const personaCompanyInstructionFindUnique = jest.fn(async () =>
    overrides.companyInstruction === undefined ? null : overrides.companyInstruction
  );
  const userPersonaSettingsFindUnique = jest.fn(async () =>
    overrides.userSettings === undefined ? null : overrides.userSettings
  );
  const globalAISettingsFindUnique = jest.fn(async () =>
    overrides.globalSettings === undefined
      ? { allowUserInstructionOverrides: false, enabledProviders: ["anthropic"], allowBringYourOwnKey: false }
      : overrides.globalSettings
  );
  const prisma = {
    persona: { findUnique: personaFindUnique },
    personaCompanyInstruction: { findUnique: personaCompanyInstructionFindUnique },
    userPersonaSettings: { findUnique: userPersonaSettingsFindUnique },
    globalAISettings: { findUnique: globalAISettingsFindUnique }
  } as never;
  return prisma;
}

function buildPlatformConfig(
  overrides: {
    apiKey?: string | null;
    openaiKey?: string | null;
    model?: string | null;
  } = {}
) {
  // `apiKey: null` means "explicitly missing"; not setting the key means "use default"
  const apiKey = "apiKey" in overrides ? overrides.apiKey : "sk-test";
  const openaiKey = "openaiKey" in overrides ? overrides.openaiKey : "sk-openai-test";
  return {
    getAnthropicApiKey: jest.fn(async () => apiKey),
    getOpenAiApiKey: jest.fn(async () => openaiKey),
    getModel: jest.fn(async (provider: "anthropic" | "openai") =>
      overrides.model ?? (provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-5.4-mini")
    )
  } as never;
}

describe("AiProvidersService.resolveProviderConfig", () => {
  it("returns Anthropic config from PlatformConfig + global default when no override", async () => {
    const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg).toEqual({ providerId: "anthropic", apiKey: "sk-test", model: "claude-sonnet-4-6" });
  });

  it("respects user providerOverride when supported", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({ userSettings: { providerOverride: "anthropic" } }),
      buildPlatformConfig()
    );
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg.providerId).toBe("anthropic");
  });

  it("falls back to global enabled providers when user override names a not-yet-implemented provider", async () => {
    // 'gemini' has a UserPersonaSettings DTO entry but no provider implementation yet —
    // exercises the SUPPORTED_PROVIDERS gate.
    const service = new AiProvidersService(
      buildPrismaMock({
        userSettings: { providerOverride: "gemini" },
        globalSettings: {
          allowUserInstructionOverrides: false,
          enabledProviders: ["anthropic"],
          allowBringYourOwnKey: false
        }
      }),
      buildPlatformConfig()
    );
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg.providerId).toBe("anthropic");
  });

  it("throws 503 when ANTHROPIC_API_KEY missing", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig({ apiKey: null })
    );
    await expect(service.resolveProviderConfig("user-1", "tendering")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("throws when persona slug is unknown", async () => {
    const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
    await expect(service.resolveProviderConfig("user-1", "nonexistent")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("uses model from PlatformConfig when present, else default", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig({ model: "claude-opus-4-7" })
    );
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg.model).toBe("claude-opus-4-7");
  });

  describe("OpenAI provider", () => {
    afterEach(() => {
      delete process.env.OPENAI_MODEL;
      delete process.env.ANTHROPIC_MODEL;
    });

    it("returns OpenAI config when user override is 'openai'", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({
          userSettings: { providerOverride: "openai" },
          globalSettings: {
            allowUserInstructionOverrides: false,
            enabledProviders: ["anthropic", "openai"],
            allowBringYourOwnKey: false
          }
        }),
        buildPlatformConfig()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.providerId).toBe("openai");
      expect(cfg.apiKey).toBe("sk-openai-test");
      expect(cfg.model).toBe("gpt-5.4-mini");
    });

    it("falls back to OpenAI when global enabled list starts with it", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({
          globalSettings: {
            allowUserInstructionOverrides: false,
            enabledProviders: ["openai"],
            allowBringYourOwnKey: false
          }
        }),
        buildPlatformConfig()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.providerId).toBe("openai");
    });

    it("throws 503 when OPENAI_API_KEY missing for an OpenAI selection", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({
          userSettings: { providerOverride: "openai" },
          globalSettings: {
            allowUserInstructionOverrides: false,
            enabledProviders: ["anthropic", "openai"],
            allowBringYourOwnKey: false
          }
        }),
        buildPlatformConfig({ openaiKey: null })
      );
      await expect(service.resolveProviderConfig("user-1", "tendering")).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it("OPENAI_MODEL env var overrides PlatformConfig + default", async () => {
      process.env.OPENAI_MODEL = "gpt-9-omega";
      const service = new AiProvidersService(
        buildPrismaMock({
          globalSettings: {
            allowUserInstructionOverrides: false,
            enabledProviders: ["openai"],
            allowBringYourOwnKey: false
          }
        }),
        buildPlatformConfig()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.model).toBe("gpt-9-omega");
    });

    it("ANTHROPIC_MODEL env var overrides PlatformConfig + default", async () => {
      process.env.ANTHROPIC_MODEL = "claude-future";
      const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.model).toBe("claude-future");
    });

    it("falls back to PlatformConfig.DEFAULT_MODELS when env unset and getModel returns empty", async () => {
      // Belt-and-braces case: getModel returns "" rather than the DEFAULT_MODELS
      // value. Service must still resolve via the imported DEFAULT_MODELS.
      // Confirms the single-source-of-truth post-PR #129: no per-provider
      // *_DEFAULT_MODEL constants exist anywhere outside DEFAULT_MODELS.
      const service = new AiProvidersService(
        buildPrismaMock({}),
        buildPlatformConfig({ model: "" })
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.model).toBe("claude-sonnet-4-6"); // DEFAULT_MODELS.anthropic
    });
  });
});

describe("AiProvidersService.resolveSystemPrompt", () => {
  it("includes only the persona's intrinsic prompt when no other layers exist", async () => {
    const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
    const prompt = await service.resolveSystemPrompt("tendering", "user-1");
    expect(prompt).toContain("Tendering Assistant");
    expect(prompt).toContain("Initial Services");
    expect(prompt).not.toContain("Company instruction:");
    expect(prompt).not.toContain("User instruction:");
  });

  it("includes the sub-mode description when an active sub-mode is supplied", async () => {
    const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
    const prompt = await service.resolveSystemPrompt("tendering", "user-1", "scope");
    expect(prompt).toContain("scope");
    expect(prompt).toContain("Scope drafting mode");
  });

  it("appends the company instruction when set", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({ companyInstruction: { instruction: "Use IS terminology." } }),
      buildPlatformConfig()
    );
    const prompt = await service.resolveSystemPrompt("tendering", "user-1");
    expect(prompt).toContain("Company instruction:");
    expect(prompt).toContain("Use IS terminology.");
  });

  it("appends the user instruction ONLY when allowUserInstructionOverrides is true", async () => {
    const allowed = new AiProvidersService(
      buildPrismaMock({
        userSettings: { instructionOverride: "Keep it brief." },
        globalSettings: {
          allowUserInstructionOverrides: true,
          enabledProviders: ["anthropic"],
          allowBringYourOwnKey: false
        }
      }),
      buildPlatformConfig()
    );
    const allowedPrompt = await allowed.resolveSystemPrompt("tendering", "user-1");
    expect(allowedPrompt).toContain("User instruction:");
    expect(allowedPrompt).toContain("Keep it brief.");

    const denied = new AiProvidersService(
      buildPrismaMock({
        userSettings: { instructionOverride: "Keep it brief." },
        globalSettings: {
          allowUserInstructionOverrides: false,
          enabledProviders: ["anthropic"],
          allowBringYourOwnKey: false
        }
      }),
      buildPlatformConfig()
    );
    const deniedPrompt = await denied.resolveSystemPrompt("tendering", "user-1");
    expect(deniedPrompt).not.toContain("User instruction:");
    expect(deniedPrompt).not.toContain("Keep it brief.");
  });

  it("trims whitespace and skips empty company/user instructions", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({
        companyInstruction: { instruction: "   " },
        userSettings: { instructionOverride: "" },
        globalSettings: {
          allowUserInstructionOverrides: true,
          enabledProviders: ["anthropic"],
          allowBringYourOwnKey: false
        }
      }),
      buildPlatformConfig()
    );
    const prompt = await service.resolveSystemPrompt("tendering", "user-1");
    expect(prompt).not.toContain("Company instruction:");
    expect(prompt).not.toContain("User instruction:");
  });

  it("throws when the persona slug is unknown", async () => {
    const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
    await expect(service.resolveSystemPrompt("nonexistent", "user-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});

describe("AiProvidersService.streamChat", () => {
  it("dispatches Anthropic config to the Anthropic provider implementation (smoke)", async () => {
    // We don't mock fetch here — just confirm dispatch returns an async iterable.
    // Detailed behaviour is covered by anthropic.provider.spec.ts.
    const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
    const iter = service.streamChat({
      systemPrompt: "x",
      messages: [{ role: "user", content: "hi" }],
      config: { providerId: "anthropic", apiKey: "sk-test", model: "claude-sonnet-4-6" }
    });
    expect(typeof iter[Symbol.asyncIterator]).toBe("function");
  });

  it("dispatches OpenAI config to the OpenAI provider implementation (smoke)", async () => {
    const service = new AiProvidersService(buildPrismaMock({}), buildPlatformConfig());
    const iter = service.streamChat({
      systemPrompt: "x",
      messages: [{ role: "user", content: "hi" }],
      config: { providerId: "openai", apiKey: "sk-test", model: "gpt-5.4-mini" }
    });
    expect(typeof iter[Symbol.asyncIterator]).toBe("function");
  });
});
