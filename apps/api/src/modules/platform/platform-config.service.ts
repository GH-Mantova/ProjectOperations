import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const SINGLETON_ID = "singleton";
const IV_BYTES = 12;
const ALGO = "aes-256-gcm";

export type AiProviderName = "anthropic" | "gemini" | "groq";

export const PROVIDER_PRIORITY: AiProviderName[] = ["anthropic", "gemini", "groq"];

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

  async status() {
    const record = await this.prisma.platformConfig.findUnique({ where: { id: SINGLETON_ID } });
    const anthropic = await this.providerStatus(
      "anthropic",
      record?.anthropicApiKey ?? null,
      record?.anthropicKeyUpdatedAt ?? null
    );
    const gemini = await this.providerStatus(
      "gemini",
      record?.geminiApiKey ?? null,
      record?.geminiKeyUpdatedAt ?? null
    );
    const groq = await this.providerStatus(
      "groq",
      record?.groqApiKey ?? null,
      record?.groqKeyUpdatedAt ?? null
    );
    const preferred = (record?.preferredProvider as AiProviderName | null | undefined) ?? null;
    return {
      anthropic,
      gemini,
      groq,
      preferredProvider: preferred,
      activeProvider: this.pickActiveProvider({ anthropic, gemini, groq }, preferred),
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
    }
  }

  private storedFieldFor(
    record: { anthropicApiKey: string | null; geminiApiKey: string | null; groqApiKey: string | null } | null,
    provider: AiProviderName
  ): string | null {
    if (!record) return null;
    if (provider === "anthropic") return record.anthropicApiKey;
    if (provider === "gemini") return record.geminiApiKey;
    return record.groqApiKey;
  }

  private async providerStatus(
    provider: AiProviderName,
    storedEncrypted: string | null,
    updatedAt: Date | null
  ) {
    const storedKey = storedEncrypted ? this.tryDecrypt(storedEncrypted) : null;
    const envKey = this.config.get<string>(this.envNameFor(provider)) ?? null;
    const effective = storedKey ?? envKey;
    return {
      configured: Boolean(effective),
      source: storedKey ? ("database" as const) : envKey ? ("env" as const) : null,
      maskedKey: effective ? this.mask(effective) : null,
      updatedAt
    };
  }

  private pickActiveProvider(
    s: {
      anthropic: { configured: boolean };
      gemini: { configured: boolean };
      groq: { configured: boolean };
    },
    preferred: AiProviderName | null
  ): AiProviderName | null {
    if (preferred) {
      if (preferred === "anthropic" && s.anthropic.configured) return "anthropic";
      if (preferred === "gemini" && s.gemini.configured) return "gemini";
      if (preferred === "groq" && s.groq.configured) return "groq";
    }
    for (const p of PROVIDER_PRIORITY) {
      if (p === "anthropic" && s.anthropic.configured) return p;
      if (p === "gemini" && s.gemini.configured) return p;
      if (p === "groq" && s.groq.configured) return p;
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
    // Gemini keys are arbitrary — no prefix check.
    return clean;
  }

  private async persistKey(
    patch: {
      anthropicApiKey?: string;
      anthropicKeyUpdatedAt?: Date;
      geminiApiKey?: string;
      geminiKeyUpdatedAt?: Date;
      groqApiKey?: string;
      groqKeyUpdatedAt?: Date;
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
