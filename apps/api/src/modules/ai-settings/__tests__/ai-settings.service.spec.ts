import { ForbiddenException, NotImplementedException } from "@nestjs/common";
import { AiSettingsService } from "../ai-settings.service";

type AnyMock = jest.Mock;

function buildService(opts: {
  globalAllowBYOK?: boolean;
  userRow?: Record<string, unknown> | null;
  validate?: AnyMock;
  encrypt?: AnyMock;
  setAnthropic?: AnyMock;
  setOpenAi?: AnyMock;
  clear?: AnyMock;
  status?: AnyMock;
} = {}) {
  const userUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => data);
  const userFindUnique = jest.fn(async () => opts.userRow ?? null);
  const globalAISettingsFindUnique = jest.fn(async () => ({
    allowBringYourOwnKey: opts.globalAllowBYOK ?? true
  }));
  const prisma = {
    user: { findUnique: userFindUnique, update: userUpdate },
    globalAISettings: { findUnique: globalAISettingsFindUnique }
  } as never;
  const audit = { write: jest.fn(async () => undefined) } as never;
  const platformConfig = {
    status: opts.status ?? jest.fn(async () => ({
      anthropic: { configured: false, validatedAt: null },
      openai: { configured: false, validatedAt: null },
      gemini: { configured: false, validatedAt: null },
      groq: { configured: false, validatedAt: null }
    })),
    setAnthropicApiKey:
      opts.setAnthropic ??
      jest.fn(async () => ({ ok: true as const, validatedAt: new Date().toISOString() })),
    setOpenAiApiKey:
      opts.setOpenAi ??
      jest.fn(async () => ({ ok: true as const, validatedAt: new Date().toISOString() })),
    clearCompanyKey: opts.clear ?? jest.fn(async () => ({}))
  } as never;
  const encryption = {
    encrypt: opts.encrypt ?? jest.fn((s: string) => `enc:${s}`),
    decrypt: jest.fn((s: string) => s.replace(/^enc:/, "")),
    tryDecrypt: jest.fn((s: string | null) => (s ? s.replace(/^enc:/, "") : null))
  } as never;
  const validator = {
    validate:
      opts.validate ??
      jest.fn(async () => ({ valid: true as const })),
    validateAnthropicKey: jest.fn(),
    validateOpenAiKey: jest.fn(),
    validateGeminiKey: jest.fn(),
    validateGroqKey: jest.fn()
  } as never;
  const service = new AiSettingsService(prisma, audit, platformConfig, encryption, validator);
  return { service, prisma, audit, platformConfig, encryption, validator, userUpdate };
}

describe("AiSettingsService — company keys", () => {
  it("getCompanyKeys returns hasKey + validatedAt per provider, no plaintext", async () => {
    const validatedAt = new Date("2026-05-03T08:00:00Z");
    const { service } = buildService({
      status: jest.fn(async () => ({
        anthropic: { configured: true, validatedAt },
        openai: { configured: false, validatedAt: null },
        gemini: { configured: false, validatedAt: null },
        groq: { configured: false, validatedAt: null }
      }))
    });
    const result = await service.getCompanyKeys();
    expect(result.anthropic).toEqual({
      hasKey: true,
      validatedAt: "2026-05-03T08:00:00.000Z"
    });
    expect(result.openai.hasKey).toBe(false);
  });

  it("saveCompanyKey returns success when validation passes", async () => {
    const setAnthropic = jest.fn(async () => ({
      ok: true as const,
      validatedAt: "2026-05-03T08:00:00.000Z"
    }));
    const { service } = buildService({ setAnthropic });
    const result = await service.saveCompanyKey("anthropic", "sk-ant-XXX", "user-1");
    expect(result).toEqual({ ok: true, validatedAt: "2026-05-03T08:00:00.000Z" });
    expect(setAnthropic).toHaveBeenCalledWith("sk-ant-XXX", "user-1");
  });

  it("saveCompanyKey returns categorised error on validation failure", async () => {
    const setAnthropic = jest.fn(async () => {
      throw new Error("AI provider authentication failed. Contact your administrator.");
    });
    const { service } = buildService({ setAnthropic });
    const result = await service.saveCompanyKey("anthropic", "bad-key", "user-1");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toMatch(/authentication failed/i);
    }
  });

  it("saveCompanyKey throws NotImplemented for gemini/groq", async () => {
    const { service } = buildService();
    await expect(service.saveCompanyKey("gemini", "k", "user-1")).rejects.toBeInstanceOf(
      NotImplementedException
    );
    await expect(service.saveCompanyKey("groq", "k", "user-1")).rejects.toBeInstanceOf(
      NotImplementedException
    );
  });

  it("deleteCompanyKey clears the key", async () => {
    const clear = jest.fn(async () => ({}));
    const { service } = buildService({ clear });
    const result = await service.deleteCompanyKey("anthropic", "user-1");
    expect(result).toEqual({ ok: true });
    expect(clear).toHaveBeenCalledWith("anthropic", "user-1");
  });
});

describe("AiSettingsService — user keys (BYOK)", () => {
  it("getUserKeys returns per-provider hasKey + validatedAt, never plaintext", async () => {
    const validatedAt = new Date("2026-05-03T09:00:00Z");
    const { service } = buildService({
      userRow: {
        anthropicKeyEncrypted: "enc:sk-ant-XXX",
        anthropicKeyValidatedAt: validatedAt,
        openaiKeyEncrypted: null,
        openaiKeyValidatedAt: null,
        geminiKeyEncrypted: null,
        geminiKeyValidatedAt: null,
        groqKeyEncrypted: null,
        groqKeyValidatedAt: null
      }
    });
    const result = await service.getUserKeys("user-1");
    expect(result.anthropic.hasKey).toBe(true);
    expect(result.anthropic.validatedAt).toBe("2026-05-03T09:00:00.000Z");
    expect(result.openai.hasKey).toBe(false);
    // Status payload contains no plaintext key
    expect(JSON.stringify(result)).not.toContain("sk-ant-XXX");
  });

  it("saveUserKey throws Forbidden when global BYOK toggle is off", async () => {
    const { service } = buildService({ globalAllowBYOK: false });
    await expect(
      service.saveUserKey("user-1", "anthropic", "sk-ant")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("saveUserKey persists encrypted blob + validatedAt on validation success", async () => {
    const validate = jest.fn(async () => ({ valid: true as const }));
    const encrypt = jest.fn((s: string) => `enc:${s}`);
    const { service, userUpdate } = buildService({ validate, encrypt });
    const result = await service.saveUserKey("user-1", "anthropic", "sk-ant-XXX");
    expect(result.ok).toBe(true);
    expect(validate).toHaveBeenCalledWith("anthropic", "sk-ant-XXX");
    expect(encrypt).toHaveBeenCalledWith("sk-ant-XXX");
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const data = userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.anthropicKeyEncrypted).toBe("enc:sk-ant-XXX");
    expect(data.anthropicKeyValidatedAt).toBeInstanceOf(Date);
  });

  it("saveUserKey returns categorised error on validation failure", async () => {
    const validate = jest.fn(async () => ({
      valid: false as const,
      reason: "Invalid API key. Check the key and try again.",
      category: "auth"
    }));
    const { service, userUpdate } = buildService({ validate });
    const result = await service.saveUserKey("user-1", "anthropic", "bad");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.category).toBe("auth");
      expect(result.error).toMatch(/Invalid API key/);
    }
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("saveUserKey throws NotImplemented for gemini/groq", async () => {
    const { service } = buildService();
    await expect(service.saveUserKey("user-1", "gemini", "k")).rejects.toBeInstanceOf(
      NotImplementedException
    );
    await expect(service.saveUserKey("user-1", "groq", "k")).rejects.toBeInstanceOf(
      NotImplementedException
    );
  });

  it("deleteUserKey clears only the requested provider's key", async () => {
    const { service, userUpdate } = buildService();
    await service.deleteUserKey("user-1", "openai");
    const data = userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.openaiKeyEncrypted).toBeNull();
    expect(data.openaiKeyValidatedAt).toBeNull();
    expect(data.anthropicKeyEncrypted).toBeUndefined();
  });

  it("deleteUserKey throws Forbidden when global BYOK toggle is off", async () => {
    const { service } = buildService({ globalAllowBYOK: false });
    await expect(service.deleteUserKey("user-1", "anthropic")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
