import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const SINGLETON_ID = "singleton";
const IV_BYTES = 12;
const ALGO = "aes-256-gcm";

export type AiProviderName = "anthropic" | "gemini" | "groq" | "openai";

export const PROVIDER_PRIORITY: AiProviderName[] = ["anthropic", "gemini", "groq", "openai"];

export const DEFAULT_MODELS: Record<AiProviderName, string> = {
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-1.5-flash",
  groq: "llama3-8b-8192",
  openai: "gpt-4o-mini"
};

@Injectable()
export class PlatformConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService
  ) {}

  async getAnthropicApiKey(): Promise<string | null> {
    return this.resolveKey("anthropic");
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
    const anthropic = await this.providerStatus(
      "anthropic",
      record?.anthropicApiKey ?? null,
      record?.anthropicKeyUpdatedAt ?? null,
      record?.anthropicModel ?? null
    );
    const gemini = await this.providerStatus(
      "gemini",
      record?.geminiApiKey ?? null,
      record?.geminiKeyUpdatedAt ?? null,
      record?.geminiModel ?? null
    );
    const groq = await this.providerStatus(
      "groq",
      record?.groqApiKey ?? null,
      record?.groqKeyUpdatedAt ?? null,
      record?.groqModel ?? null
    );
    const openai = await this.providerStatus(
      "openai",
      record?.openaiApiKey ?? null,
      record?.openaiKeyUpdatedAt ?? null,
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

  async setAnthropicApiKey(rawKey: string, actorId?: string) {
    const clean = this.validateKey("anthropic", rawKey);
    await this.persistKey({ anthropicApiKey: this.encrypt(clean), anthropicKeyUpdatedAt: new Date() }, actorId);
    await this.audit.write({
      actorId,
      action: "platformConfig.anthropicKey.update",
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID
    });
    return this.status();
  }

  async setGeminiApiKey(rawKey: string, actorId?: string) {
    const clean = this.validateKey("gemini", rawKey);
    await this.persistKey({ geminiApiKey: this.encrypt(clean), geminiKeyUpdatedAt: new Date() }, actorId);
    await this.audit.write({
      actorId,
      action: "platformConfig.geminiKey.update",
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID
    });
    return this.status();
  }

  async setGroqApiKey(rawKey: string, actorId?: string) {
    const clean = this.validateKey("groq", rawKey);
    await this.persistKey({ groqApiKey: this.encrypt(clean), groqKeyUpdatedAt: new Date() }, actorId);
    await this.audit.write({
      actorId,
      action: "platformConfig.groqKey.update",
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID
    });
    return this.status();
  }

  async setOpenAiApiKey(rawKey: string, actorId?: string) {
    const clean = this.validateKey("openai", rawKey);
    await this.persistKey({ openaiApiKey: this.encrypt(clean), openaiKeyUpdatedAt: new Date() }, actorId);
    await this.audit.write({
      actorId,
      action: "platformConfig.openaiKey.update",
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
    const key = await this.getAnthropicApiKey();
    if (!key) return { ok: false, message: "No Anthropic API key configured." };
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 16,
          messages: [{ role: "user", content: "ping" }]
        })
      });
      if (response.ok) return { ok: true, message: "Connection successful." };
      const text = await response.text();
      return { ok: false, message: `Anthropic API ${response.status}: ${text.slice(0, 240)}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async testGeminiKey(): Promise<{ ok: boolean; message: string }> {
    const key = await this.getGeminiApiKey();
    if (!key) return { ok: false, message: "No Gemini API key configured." };
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 8 }
          })
        }
      );
      if (response.ok) return { ok: true, message: "Connection successful." };
      const text = await response.text();
      return { ok: false, message: `Gemini API ${response.status}: ${text.slice(0, 240)}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async testGroqKey(): Promise<{ ok: boolean; message: string }> {
    const key = await this.getGroqApiKey();
    if (!key) return { ok: false, message: "No Groq API key configured." };
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }]
        })
      });
      if (response.ok) return { ok: true, message: "Connection successful." };
      const text = await response.text();
      return { ok: false, message: `Groq API ${response.status}: ${text.slice(0, 240)}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async testOpenAiKey(): Promise<{ ok: boolean; message: string }> {
    const key = await this.getOpenAiApiKey();
    if (!key) return { ok: false, message: "No OpenAI API key configured." };
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { authorization: `Bearer ${key}` }
      });
      if (response.ok) return { ok: true, message: "Connection successful." };
      const text = await response.text();
      return { ok: false, message: `OpenAI API ${response.status}: ${text.slice(0, 240)}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
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
    const stored = this.storedFieldFor(record, provider);
    if (stored) {
      const decrypted = this.tryDecrypt(stored);
      if (decrypted) return decrypted;
    }
    return this.config.get<string>(this.envNameFor(provider)) ?? null;
  }

  private envNameFor(provider: AiProviderName): string {
    switch (provider) {
      case "anthropic":
        return "ANTHROPIC_API_KEY";
      case "gemini":
        return "GEMINI_API_KEY";
      case "groq":
        return "GROQ_API_KEY";
      case "openai":
        return "OPENAI_API_KEY";
    }
  }

  private storedFieldFor(
    record: {
      anthropicApiKey: string | null;
      geminiApiKey: string | null;
      groqApiKey: string | null;
      openaiApiKey: string | null;
    } | null,
    provider: AiProviderName
  ): string | null {
    if (!record) return null;
    if (provider === "anthropic") return record.anthropicApiKey;
    if (provider === "gemini") return record.geminiApiKey;
    if (provider === "groq") return record.groqApiKey;
    return record.openaiApiKey;
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

  private async providerStatus(
    provider: AiProviderName,
    storedEncrypted: string | null,
    updatedAt: Date | null,
    storedModel: string | null
  ) {
    const storedKey = storedEncrypted ? this.tryDecrypt(storedEncrypted) : null;
    const envKey = this.config.get<string>(this.envNameFor(provider)) ?? null;
    const effective = storedKey ?? envKey;
    return {
      configured: Boolean(effective),
      source: storedKey ? ("database" as const) : envKey ? ("env" as const) : null,
      maskedKey: effective ? this.mask(effective) : null,
      updatedAt,
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

  private validateKey(provider: AiProviderName, raw: string): string {
    const clean = raw.trim();
    if (!clean) throw new Error("API key cannot be empty.");
    if (provider === "anthropic" && !clean.startsWith("sk-ant-")) {
      throw new Error('Anthropic API keys start with "sk-ant-". Double-check the value.');
    }
    if (provider === "groq" && !clean.startsWith("gsk_")) {
      throw new Error('Groq API keys start with "gsk_". Double-check the value.');
    }
    if (provider === "openai" && !clean.startsWith("sk-")) {
      throw new Error('OpenAI API keys start with "sk-". Double-check the value.');
    }
    // Gemini keys are arbitrary — no prefix check.
    return clean;
  }

  private async persistKey(
    patch: {
      anthropicApiKey?: string;
      anthropicKeyUpdatedAt?: Date;
      anthropicModel?: string | null;
      geminiApiKey?: string;
      geminiKeyUpdatedAt?: Date;
      geminiModel?: string | null;
      groqApiKey?: string;
      groqKeyUpdatedAt?: Date;
      groqModel?: string | null;
      openaiApiKey?: string;
      openaiKeyUpdatedAt?: Date;
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

  private encryptionKey(): Buffer {
    const secret = this.config.get<string>("PLATFORM_CONFIG_SECRET") ?? "change-me-in-production";
    return createHash("sha256").update(secret, "utf8").digest();
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  }

  private decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload.");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv(ALGO, this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  }

  private tryDecrypt(payload: string): string | null {
    try {
      return this.decrypt(payload);
    } catch {
      return null;
    }
  }

  private mask(key: string): string {
    if (key.length <= 8) return "****";
    return `${key.slice(0, 7)}…${key.slice(-4)}`;
  }
}
