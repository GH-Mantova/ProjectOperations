import { ServiceUnavailableException } from "@nestjs/common";
import { AiProvidersService } from "../ai-providers.service";
import { ProviderNotConfiguredError } from "../errors";

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
  userRow?: {
    anthropicKeyEncrypted?: string | null;
    openaiKeyEncrypted?: string | null;
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
  const userFindUnique = jest.fn(async () => {
    if (overrides.userRow === undefined) {
      return { anthropicKeyEncrypted: null, openaiKeyEncrypted: null };
    }
    if (overrides.userRow === null) return null;
    return {
      anthropicKeyEncrypted: overrides.userRow.anthropicKeyEncrypted ?? null,
      openaiKeyEncrypted: overrides.userRow.openaiKeyEncrypted ?? null
    };
  });
  const prisma = {
    persona: { findUnique: personaFindUnique },
    personaCompanyInstruction: { findUnique: personaCompanyInstructionFindUnique },
    userPersonaSettings: { findUnique: userPersonaSettingsFindUnique },
    globalAISettings: { findUnique: globalAISettingsFindUnique },
    user: { findUnique: userFindUnique }
  } as never;
  return prisma;
}

function buildPlatformConfig(
  overrides: {
    apiKey?: string | null;
    openaiKey?: string | null;
    model?: string | null;
    preferredProvider?: "anthropic" | "openai" | "gemini" | "groq" | null;
    firstConfiguredProvider?: "anthropic" | "openai" | "gemini" | "groq" | null;
  } = {}
) {
  // `apiKey: null` means "explicitly missing"; not setting the key means "use default"
  const apiKey = "apiKey" in overrides ? overrides.apiKey : "sk-test";
  const openaiKey = "openaiKey" in overrides ? overrides.openaiKey : "sk-openai-test";
  // Default firstConfigured derives from which keys are present so existing
  // tests continue to pass without touching every call site.
  const firstConfiguredDefault = apiKey
    ? ("anthropic" as const)
    : openaiKey
      ? ("openai" as const)
      : null;
  return {
    getAnthropicApiKey: jest.fn(async () => apiKey),
    getOpenAiApiKey: jest.fn(async () => openaiKey),
    getModel: jest.fn(async (provider: "anthropic" | "openai") =>
      overrides.model ?? (provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-5.4-mini")
    ),
    getPreferredProvider: jest.fn(async () =>
      "preferredProvider" in overrides ? overrides.preferredProvider ?? null : null
    ),
    getFirstConfiguredProvider: jest.fn(async () =>
      "firstConfiguredProvider" in overrides
        ? overrides.firstConfiguredProvider ?? null
        : firstConfiguredDefault
    )
  } as never;
}

function buildEncryption(overrides: { decrypt?: (s: string) => string } = {}) {
  return {
    decrypt: overrides.decrypt ?? ((s: string) => `decrypted:${s}`),
    encrypt: (s: string) => `encrypted:${s}`,
    tryDecrypt: (s: string | null | undefined) => {
      if (!s) return null;
      try {
        return overrides.decrypt ? overrides.decrypt(s) : `decrypted:${s}`;
      } catch {
        return null;
      }
    }
  } as never;
}

describe("AiProvidersService.resolveProviderConfig", () => {
  it("returns Anthropic config from PlatformConfig + global default when no override", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig(),
      buildEncryption()
    );
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg).toEqual({
      providerId: "anthropic",
      apiKey: "sk-test",
      model: "claude-sonnet-4-6",
      source: "company"
    });
  });

  it("respects user providerOverride when supported", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({ userSettings: { providerOverride: "anthropic" } }),
      buildPlatformConfig(),
      buildEncryption()
    );
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg.providerId).toBe("anthropic");
  });

  it("falls back to global enabled providers when user override names a not-yet-implemented provider", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({
        userSettings: { providerOverride: "gemini" },
        globalSettings: {
          allowUserInstructionOverrides: false,
          enabledProviders: ["anthropic"],
          allowBringYourOwnKey: false
        }
      }),
      buildPlatformConfig(),
      buildEncryption()
    );
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg.providerId).toBe("anthropic");
  });

  it("throws ProviderNotConfiguredError when neither user nor company key is configured", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig({ apiKey: null, openaiKey: null, firstConfiguredProvider: null }),
      buildEncryption()
    );
    await expect(service.resolveProviderConfig("user-1", "tendering")).rejects.toBeInstanceOf(
      ProviderNotConfiguredError
    );
  });

  it("throws when persona slug is unknown", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig(),
      buildEncryption()
    );
    await expect(service.resolveProviderConfig("user-1", "nonexistent")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("uses model from PlatformConfig when present, else default", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig({ model: "claude-opus-4-7" }),
      buildEncryption()
    );
    const cfg = await service.resolveProviderConfig("user-1", "tendering");
    expect(cfg.model).toBe("claude-opus-4-7");
  });

  describe("three-tier provider resolution (fix 2026-05-03)", () => {
    it("falls back to platform preferredProvider when user setting is system default", async () => {
      // Bug repro: user persona = "Use system default" (null), only company
      // Anthropic key saved, admin set preferredProvider='anthropic'.
      // Pre-fix this would have stayed at the literal "anthropic" default
      // and worked by coincidence; this test pins down that we resolve via
      // preferredProvider explicitly.
      const service = new AiProvidersService(
        buildPrismaMock({
          userSettings: { providerOverride: null },
          globalSettings: {
            allowUserInstructionOverrides: false,
            // empty enabledProviders — must NOT short-circuit the chain
            enabledProviders: [],
            allowBringYourOwnKey: false
          }
        }),
        buildPlatformConfig({ preferredProvider: "anthropic" }),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.providerId).toBe("anthropic");
      expect(cfg.source).toBe("company");
      expect(cfg.apiKey).toBe("sk-test");
    });

    it("falls back to first configured company provider when both user setting AND preferredProvider are null", async () => {
      // The actual user-facing bug: BYOK off, user persona = system default,
      // no preferredProvider, no global enabledProviders, only Anthropic
      // company key saved. Pre-fix this threw "AI provider not configured".
      const service = new AiProvidersService(
        buildPrismaMock({
          userSettings: { providerOverride: null },
          globalSettings: {
            allowUserInstructionOverrides: false,
            enabledProviders: [],
            allowBringYourOwnKey: false
          }
        }),
        buildPlatformConfig({
          preferredProvider: null,
          firstConfiguredProvider: "anthropic"
        }),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.providerId).toBe("anthropic");
      expect(cfg.source).toBe("company");
    });

    it("throws ProviderNotConfiguredError(provider) when user explicitly chooses provider with no key available", async () => {
      // User picks OpenAI in My Settings but only Anthropic company key
      // exists and BYOK is off. Pre-fix the error said only "AI provider
      // not configured" — no clue which provider failed. After the fix
      // the message names openai.
      const service = new AiProvidersService(
        buildPrismaMock({
          userSettings: { providerOverride: "openai" },
          globalSettings: {
            allowUserInstructionOverrides: false,
            enabledProviders: ["anthropic", "openai"],
            allowBringYourOwnKey: false
          },
          userRow: { anthropicKeyEncrypted: null, openaiKeyEncrypted: null }
        }),
        buildPlatformConfig({
          openaiKey: null,
          preferredProvider: "anthropic",
          firstConfiguredProvider: "anthropic"
        }),
        buildEncryption()
      );
      await expect(
        service.resolveProviderConfig("user-1", "tendering")
      ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
      // Substring match — do NOT match the full string verbatim per spec.
      await expect(
        service.resolveProviderConfig("user-1", "tendering")
      ).rejects.toMatchObject({
        message: expect.stringContaining("openai"),
        provider: "openai"
      });
      await expect(
        service.resolveProviderConfig("user-1", "tendering")
      ).rejects.toMatchObject({
        message: expect.stringContaining("not configured")
      });
    });
  });

  describe("BYOK precedence", () => {
    it("prefers per-user key over company key when both are set", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({ userRow: { anthropicKeyEncrypted: "enc-user-anthro" } }),
        buildPlatformConfig(),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.source).toBe("user");
      expect(cfg.apiKey).toBe("decrypted:enc-user-anthro");
    });

    it("falls back to company key when user has no key", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({ userRow: { anthropicKeyEncrypted: null } }),
        buildPlatformConfig(),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.source).toBe("company");
      expect(cfg.apiKey).toBe("sk-test");
    });

    it("throws ProviderNotConfiguredError when user key absent and company key absent", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({ userRow: { anthropicKeyEncrypted: null } }),
        buildPlatformConfig({ apiKey: null, openaiKey: null, firstConfiguredProvider: null }),
        buildEncryption()
      );
      await expect(service.resolveProviderConfig("user-1", "tendering")).rejects.toBeInstanceOf(
        ProviderNotConfiguredError
      );
    });

    it("falls through to company key when user key fails to decrypt (does NOT throw)", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({ userRow: { anthropicKeyEncrypted: "corrupt" } }),
        buildPlatformConfig(),
        buildEncryption({
          decrypt: () => {
            throw new Error("auth tag mismatch");
          }
        })
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.source).toBe("company");
      expect(cfg.apiKey).toBe("sk-test");
    });

    it("scoped per provider: user has openai key only, anthropic selection still falls back to company", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({
          userRow: { anthropicKeyEncrypted: null, openaiKeyEncrypted: "enc-user-openai" }
        }),
        buildPlatformConfig(),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.providerId).toBe("anthropic");
      expect(cfg.source).toBe("company");
    });
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
        buildPlatformConfig(),
        buildEncryption()
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
        buildPlatformConfig(),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.providerId).toBe("openai");
    });

    it("throws 503 when no key (user nor company) for an OpenAI selection", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({
          userSettings: { providerOverride: "openai" },
          globalSettings: {
            allowUserInstructionOverrides: false,
            enabledProviders: ["anthropic", "openai"],
            allowBringYourOwnKey: false
          }
        }),
        buildPlatformConfig({ openaiKey: null }),
        buildEncryption()
      );
      await expect(service.resolveProviderConfig("user-1", "tendering")).rejects.toBeInstanceOf(
        ProviderNotConfiguredError
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
        buildPlatformConfig(),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.model).toBe("gpt-9-omega");
    });

    it("ANTHROPIC_MODEL env var overrides PlatformConfig + default", async () => {
      process.env.ANTHROPIC_MODEL = "claude-future";
      const service = new AiProvidersService(
        buildPrismaMock({}),
        buildPlatformConfig(),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.model).toBe("claude-future");
    });

    it("falls back to PlatformConfig.DEFAULT_MODELS when env unset and getModel returns empty", async () => {
      const service = new AiProvidersService(
        buildPrismaMock({}),
        buildPlatformConfig({ model: "" }),
        buildEncryption()
      );
      const cfg = await service.resolveProviderConfig("user-1", "tendering");
      expect(cfg.model).toBe("claude-sonnet-4-6");
    });
  });
});

describe("AiProvidersService.resolveSystemPrompt", () => {
  it("includes only the persona's intrinsic prompt when no other layers exist", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig(),
      buildEncryption()
    );
    const prompt = await service.resolveSystemPrompt("tendering", "user-1");
    expect(prompt).toContain("Tendering Assistant");
    expect(prompt).toContain("Initial Services");
    expect(prompt).not.toContain("Company instruction:");
    expect(prompt).not.toContain("User instruction:");
  });

  it("includes the sub-mode description when an active sub-mode is supplied", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig(),
      buildEncryption()
    );
    const prompt = await service.resolveSystemPrompt("tendering", "user-1", "scope");
    expect(prompt).toContain("scope");
    expect(prompt).toContain("Scope drafting mode");
  });

  it("appends the company instruction when set", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({ companyInstruction: { instruction: "Use IS terminology." } }),
      buildPlatformConfig(),
      buildEncryption()
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
      buildPlatformConfig(),
      buildEncryption()
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
      buildPlatformConfig(),
      buildEncryption()
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
      buildPlatformConfig(),
      buildEncryption()
    );
    const prompt = await service.resolveSystemPrompt("tendering", "user-1");
    expect(prompt).not.toContain("Company instruction:");
    expect(prompt).not.toContain("User instruction:");
  });

  it("throws when the persona slug is unknown", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig(),
      buildEncryption()
    );
    await expect(service.resolveSystemPrompt("nonexistent", "user-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});

describe("AiProvidersService.streamChat", () => {
  it("dispatches Anthropic config to the Anthropic provider implementation (smoke)", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig(),
      buildEncryption()
    );
    const iter = service.streamChat({
      systemPrompt: "x",
      messages: [{ role: "user", content: "hi" }],
      config: {
        providerId: "anthropic",
        apiKey: "sk-test",
        model: "claude-sonnet-4-6",
        source: "company"
      }
    });
    expect(typeof iter[Symbol.asyncIterator]).toBe("function");
  });

  it("dispatches OpenAI config to the OpenAI provider implementation (smoke)", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({}),
      buildPlatformConfig(),
      buildEncryption()
    );
    const iter = service.streamChat({
      systemPrompt: "x",
      messages: [{ role: "user", content: "hi" }],
      config: {
        providerId: "openai",
        apiKey: "sk-test",
        model: "gpt-5.4-mini",
        source: "company"
      }
    });
    expect(typeof iter[Symbol.asyncIterator]).toBe("function");
  });
});
