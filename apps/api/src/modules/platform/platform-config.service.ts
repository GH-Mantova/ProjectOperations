import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { KeyEncryptionService } from "../security/key-encryption.service";
import { KeyValidationService } from "../security/key-validation.service";

const SINGLETON_ID = "singleton";

export type AiProviderName = "anthropic" | "gemini" | "groq" | "openai";

export const PROVIDER_PRIORITY: AiProviderName[] = ["anthropic", "gemini", "groq", "openai"];

export function isValidProvider(value: string): value is AiProviderName {
  return (PROVIDER_PRIORITY as readonly string[]).includes(value);
}

// Single source of truth for AI provider model defaults across the codebase.
// PlatformConfigService.getModel() consults this constant; env vars
// (ANTHROPIC_MODEL, OPENAI_MODEL) override at runtime.
export const DEFAULT_MODELS: Record<AiProviderName, string> = {
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-1.5-flash",
  groq: "llama3-8b-8192",
  openai: "gpt-5.4-mini"
};

// §5A.1 PR 9: company keys read/written via the *_key_encrypted columns
// (KeyEncryptionService, BYOK_ENCRYPTION_KEY master). The legacy
// *_api_key columns + ANTHROPIC_API_KEY/etc env fallback are no longer
// consulted. Sean enters the key once via the UI (POST /ai-settings/
// company/keys/:provider).
@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly encryption: KeyEncryptionService,
    private readonly validator: KeyValidationService
  ) {}

  async getAnthropicApiKey(): Promise<string | null> {
    return this.resolveKey("anthropic");
  }

  // Admin-set platform default. Used by AiProvidersService.resolveChosenProvider
  // as Tier 2 (between explicit user choice and the first-configured-key
  // safety net). Returns null when unset or when the stored value is not
  // one of the four valid provider names (logged as a warn so the config
  // drift is visible).
  async getPreferredProvider(): Promise<AiProviderName | null> {
    const record = await this.prisma.platformConfig.findUnique({
      where: { id: SINGLETON_ID },
      select: { preferredProvider: true }
    });
    if (!record?.preferredProvider) return null;
    if (!isValidProvider(record.preferredProvider)) {
      this.logger.warn(
        `PlatformConfig.preferredProvider has invalid value: ${record.preferredProvider}`
      );
      return null;
    }
    return record.preferredProvider;
  }

  // Tier-3 safety net for resolveChosenProvider. Returns the first provider
  // (in the canonical priority order) that has a saved company key. Used
  // when the user picked "Use system default" AND no preferredProvider is
  // configured — picks something useful instead of throwing.
  async getFirstConfiguredProvider(): Promise<AiProviderName | null> {
    const record = await this.prisma.platformConfig.findUnique({
      where: { id: SINGLETON_ID },
      select: {
        anthropicKeyEncrypted: true,
        openaiKeyEncrypted: true,
        geminiKeyEncrypted: true,
        groqKeyEncrypted: true
      }
    });
    if (!record) return null;
    if (record.anthropicKeyEncrypted) return "anthropic";
    if (record.openaiKeyEncrypted) return "openai";
    if (record.geminiKeyEncrypted) return "gemini";
    if (record.groqKeyEncrypted) return "groq";
    return null;
  }

  async getGeminiApiKey(): Promise<string | null> {
    return this.resolveKey("gemini");
  }

  async getGroqApiKey(): Promise<string | null> {
    return this.resolveKey("groq");
  }

  async getOpenAiApiKey(): Promise<string | null> {
    return this.resolveKey("openai");
  }

  async getModel(provider: AiProviderName): Promise<string> {
    const record = await this.prisma.platformConfig.findUnique({ where: { id: SINGLETON_ID } });
    const stored = this.modelFieldFor(record, provider);
    return stored && stored.trim() ? stored.trim() : DEFAULT_MODELS[provider];
  }

  async status() {
    const record = await this.prisma.platformConfig.findUnique({ where: { id: SINGLETON_ID } });
    const anthropic = this.providerStatus(
      "anthropic",
      record?.anthropicKeyEncrypted ?? null,
      record?.anthropicKeyValidatedAt ?? null,
      record?.anthropicModel ?? null
    );
    const gemini = this.providerStatus(
      "gemini",
      record?.geminiKeyEncrypted ?? null,
      record?.geminiKeyValidatedAt ?? null,
      record?.geminiModel ?? null
    );
    const groq = this.providerStatus(
      "groq",
      record?.groqKeyEncrypted ?? null,
      record?.groqKeyValidatedAt ?? null,
      record?.groqModel ?? null
    );
    const openai = this.providerStatus(
      "openai",
      record?.openaiKeyEncrypted ?? null,
      record?.openaiKeyValidatedAt ?? null,
      record?.openaiModel ?? null
    );
    const preferred = (record?.preferredProvider as AiProviderName | null | undefined) ?? null;
    return {
      anthropic,
      gemini,
      groq,
      openai,
      preferredProvider: preferred,
      activeProvider: this.pickActiveProvider({ anthropic, gemini, groq, openai }, preferred),
      sharePoint: { mode: this.config.get<string>("SHAREPOINT_MODE", "mock") }
    };
  }

  // Validates → encrypts → stores. Used by both the legacy
  // /admin/platform-config PATCH endpoint and the new /ai-settings/company/
  // keys/:provider endpoint. Throws on validation failure (categorised
  // message via KeyValidationService).
  async setAnthropicApiKey(rawKey: string, actorId?: string) {
    return this.persistCompanyKey("anthropic", rawKey, actorId);
  }

  async setGeminiApiKey(rawKey: string, actorId?: string) {
    return this.persistCompanyKey("gemini", rawKey, actorId);
  }

  async setGroqApiKey(rawKey: string, actorId?: string) {
    return this.persistCompanyKey("groq", rawKey, actorId);
  }

  async setOpenAiApiKey(rawKey: string, actorId?: string) {
    return this.persistCompanyKey("openai", rawKey, actorId);
  }

  async clearCompanyKey(provider: AiProviderName, actorId?: string) {
    const patch = this.keyPatch(provider, null, null);
    await this.persistKey(patch, actorId);
    await this.audit.write({
      actorId,
      action: `platformConfig.${provider}Key.delete`,
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID
    });
    return this.status();
  }

  async setModel(provider: AiProviderName, rawModel: string | null, actorId?: string) {
    const clean = rawModel?.trim() || null;
    const patch: Parameters<PlatformConfigService["persistKey"]>[0] = {};
    if (provider === "anthropic") patch.anthropicModel = clean;
    else if (provider === "gemini") patch.geminiModel = clean;
    else if (provider === "groq") patch.groqModel = clean;
    else if (provider === "openai") patch.openaiModel = clean;
    await this.persistKey(patch, actorId);
    await this.audit.write({
      actorId,
      action: "platformConfig.model.update",
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID,
      metadata: { provider, model: clean }
    });
    return this.status();
  }

  async setPreferredProvider(provider: AiProviderName | null, actorId?: string) {
    if (provider !== null && !PROVIDER_PRIORITY.includes(provider)) {
      throw new Error(`Unknown AI provider "${provider}".`);
    }
    await this.persistKey({ preferredProvider: provider }, actorId);
    await this.audit.write({
      actorId,
      action: "platformConfig.preferredProvider.update",
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID,
      metadata: { provider: provider ?? "auto" }
    });
    return this.status();
  }

  async testAnthropicKey(): Promise<{ ok: boolean; message: string }> {
    return this.testConfiguredKey("anthropic");
  }

  async testGeminiKey(): Promise<{ ok: boolean; message: string }> {
    const key = await this.getGeminiApiKey();
    if (!key) return { ok: false, message: "No Gemini API key configured." };
    return { ok: false, message: "Gemini key validation not yet implemented." };
  }

  async testGroqKey(): Promise<{ ok: boolean; message: string }> {
    const key = await this.getGroqApiKey();
    if (!key) return { ok: false, message: "No Groq API key configured." };
    return { ok: false, message: "Groq key validation not yet implemented." };
  }

  async testOpenAiKey(): Promise<{ ok: boolean; message: string }> {
    return this.testConfiguredKey("openai");
  }

  async listModels(provider: AiProviderName): Promise<{ provider: AiProviderName; models: string[] }> {
    if (provider === "anthropic") {
      return {
        provider,
        models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
      };
    }
    if (provider === "openai") {
      const key = await this.getOpenAiApiKey();
      if (!key) throw new Error("OpenAI API key not configured.");
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${key}` }
      });
      if (!response.ok) {
        throw new Error(`OpenAI API ${response.status}: ${(await response.text()).slice(0, 240)}`);
      }
      const body = (await response.json()) as { data: Array<{ id: string }> };
      const models = body.data
        .map((m) => m.id)
        .filter((id) => {
          const lower = id.toLowerCase();
          return !/(embedding|whisper|tts|dall-?e|audio|image|vision-only|moderation)/.test(lower);
        })
        .sort();
      return { provider, models };
    }
    if (provider === "groq") {
      const key = await this.getGroqApiKey();
      if (!key) throw new Error("Groq API key not configured.");
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { authorization: `Bearer ${key}` }
      });
      if (!response.ok) {
        throw new Error(`Groq API ${response.status}: ${(await response.text()).slice(0, 240)}`);
      }
      const body = (await response.json()) as { data: Array<{ id: string }> };
      return { provider, models: body.data.map((m) => m.id).sort() };
    }
    // gemini
    const key = await this.getGeminiApiKey();
    if (!key) throw new Error("Gemini API key not configured.");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`
    );
    if (!response.ok) {
      throw new Error(`Gemini API ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }
    const body = (await response.json()) as {
      models: Array<{ name: string; supportedGenerationMethods?: string[] }>;
    };
    const models = body.models
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .sort();
    return { provider, models };
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  private async resolveKey(provider: AiProviderName): Promise<string | null> {
    const record = await this.prisma.platformConfig.findUnique({ where: { id: SINGLETON_ID } });
    const stored = this.encryptedFieldFor(record, provider);
    if (!stored) return null;
    return this.encryption.tryDecrypt(stored, { provider, scope: "company" });
  }

  private async persistCompanyKey(
    provider: AiProviderName,
    rawKey: string,
    actorId?: string
  ): Promise<{ ok: true; validatedAt: string } | never> {
    const clean = rawKey.trim();
    if (!clean) throw new Error("API key cannot be empty.");
    const result = await this.validator.validate(provider, clean);
    if (!result.valid) {
      await this.audit.write({
        actorId,
        action: `platformConfig.${provider}Key.validation_failed`,
        entityType: "PlatformConfig",
        entityId: SINGLETON_ID,
        metadata: { category: result.category }
      });
      throw new Error(result.reason);
    }
    const validatedAt = new Date();
    const patch = this.keyPatch(provider, this.encryption.encrypt(clean), validatedAt);
    await this.persistKey(patch, actorId);
    await this.audit.write({
      actorId,
      action: `platformConfig.${provider}Key.update`,
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID
    });
    return { ok: true, validatedAt: validatedAt.toISOString() };
  }

  private keyPatch(
    provider: AiProviderName,
    encrypted: string | null,
    validatedAt: Date | null
  ) {
    const patch: Parameters<PlatformConfigService["persistKey"]>[0] = {};
    if (provider === "anthropic") {
      patch.anthropicKeyEncrypted = encrypted;
      patch.anthropicKeyValidatedAt = validatedAt;
    } else if (provider === "openai") {
      patch.openaiKeyEncrypted = encrypted;
      patch.openaiKeyValidatedAt = validatedAt;
    } else if (provider === "gemini") {
      patch.geminiKeyEncrypted = encrypted;
      patch.geminiKeyValidatedAt = validatedAt;
    } else if (provider === "groq") {
      patch.groqKeyEncrypted = encrypted;
      patch.groqKeyValidatedAt = validatedAt;
    }
    return patch;
  }

  private encryptedFieldFor(
    record: {
      anthropicKeyEncrypted: string | null;
      geminiKeyEncrypted: string | null;
      groqKeyEncrypted: string | null;
      openaiKeyEncrypted: string | null;
    } | null,
    provider: AiProviderName
  ): string | null {
    if (!record) return null;
    if (provider === "anthropic") return record.anthropicKeyEncrypted;
    if (provider === "gemini") return record.geminiKeyEncrypted;
    if (provider === "groq") return record.groqKeyEncrypted;
    return record.openaiKeyEncrypted;
  }

  private modelFieldFor(
    record: {
      anthropicModel: string | null;
      geminiModel: string | null;
      groqModel: string | null;
      openaiModel: string | null;
    } | null,
    provider: AiProviderName
  ): string | null {
    if (!record) return null;
    if (provider === "anthropic") return record.anthropicModel;
    if (provider === "gemini") return record.geminiModel;
    if (provider === "groq") return record.groqModel;
    return record.openaiModel;
  }

  private providerStatus(
    provider: AiProviderName,
    encrypted: string | null,
    validatedAt: Date | null,
    storedModel: string | null
  ) {
    const decrypted = encrypted
      ? this.encryption.tryDecrypt(encrypted, { provider, scope: "company" })
      : null;
    return {
      configured: Boolean(decrypted),
      source: decrypted ? ("database" as const) : null,
      maskedKey: decrypted ? this.mask(decrypted) : null,
      validatedAt,
      model: storedModel && storedModel.trim() ? storedModel.trim() : DEFAULT_MODELS[provider]
    };
  }

  private pickActiveProvider(
    s: {
      anthropic: { configured: boolean };
      gemini: { configured: boolean };
      groq: { configured: boolean };
      openai: { configured: boolean };
    },
    preferred: AiProviderName | null
  ): AiProviderName | null {
    const considered: AiProviderName[] = preferred
      ? [preferred, ...PROVIDER_PRIORITY.filter((p) => p !== preferred)]
      : [...PROVIDER_PRIORITY];
    for (const p of considered) {
      if (s[p].configured) return p;
    }
    return null;
  }

  private async testConfiguredKey(
    provider: "anthropic" | "openai"
  ): Promise<{ ok: boolean; message: string }> {
    const key = await this.resolveKey(provider);
    if (!key) {
      return { ok: false, message: `No ${provider} API key configured.` };
    }
    const result = await this.validator.validate(provider, key);
    if (result.valid) return { ok: true, message: "Connection successful." };
    return { ok: false, message: result.reason };
  }

  private async persistKey(
    patch: {
      anthropicKeyEncrypted?: string | null;
      anthropicKeyValidatedAt?: Date | null;
      anthropicModel?: string | null;
      geminiKeyEncrypted?: string | null;
      geminiKeyValidatedAt?: Date | null;
      geminiModel?: string | null;
      groqKeyEncrypted?: string | null;
      groqKeyValidatedAt?: Date | null;
      groqModel?: string | null;
      openaiKeyEncrypted?: string | null;
      openaiKeyValidatedAt?: Date | null;
      openaiModel?: string | null;
      preferredProvider?: string | null;
    },
    actorId?: string
  ) {
    await this.prisma.platformConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...patch, updatedById: actorId ?? null },
      update: { ...patch, updatedById: actorId ?? null }
    });
  }

  private mask(key: string): string {
    if (key.length <= 8) return "****";
    return `${key.slice(0, 7)}…${key.slice(-4)}`;
  }
}
