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

function buildPlatformConfig(overrides: { apiKey?: string | null; model?: string | null } = {}) {
  // `apiKey: null` means "explicitly missing"; not setting the key means "use default"
  const apiKey = "apiKey" in overrides ? overrides.apiKey : "sk-test";
  return {
    getAnthropicApiKey: jest.fn(async () => apiKey),
    getModel: jest.fn(async () => overrides.model ?? "claude-sonnet-4-6")
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

  it("falls back to global enabled providers when user override is unsupported", async () => {
    const service = new AiProvidersService(
      buildPrismaMock({
        userSettings: { providerOverride: "openai" },
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
});
