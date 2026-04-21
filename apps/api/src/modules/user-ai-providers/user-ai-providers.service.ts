import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  DEFAULT_MODELS,
  PROVIDER_PRIORITY,
  PlatformConfigService,
  type AiProviderName
} from "../platform/platform-config.service";

const IV_BYTES = 12;
const ALGO = "aes-256-gcm";

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  groq: "Llama 3 on Groq",
  openai: "ChatGPT (OpenAI)"
};

export type AvailableProvider = {
  id: string;
  type: AiProviderName;
  source: "company" | "personal";
  label: string;
  model: string;
  isDefault: boolean;
};

@Injectable()
export class UserAiProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigService
  ) {}

  async listForUser(userId: string) {
    const personal = await this.prisma.userAiProvider.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }]
    });
    const company = await this.companyEntries();
    return {
      personal: personal.map((p) => ({
        id: p.id,
        provider: p.provider,
        label: p.label,
        model: p.model ?? DEFAULT_MODELS[p.provider as AiProviderName] ?? "",
        isActive: p.isActive,
        maskedKey: this.mask(this.tryDecrypt(p.apiKey) ?? ""),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })),
      company
    };
  }

  async create(
    userId: string,
    dto: { provider: string; apiKey: string; label?: string | null; model?: string | null }
  ) {
    const provider = this.validateProviderName(dto.provider);
    const cleanKey = (dto.apiKey ?? "").trim();
    if (!cleanKey) {
      throw new BadRequestException({ error: "invalid_key", message: "API key cannot be empty." });
    }
    const test = await this.testLiveKey(provider, cleanKey);
    if (!test.ok) {
      throw new BadRequestException({ error: "invalid_key", message: test.message });
    }
    const created = await this.prisma.userAiProvider.create({
      data: {
        userId,
        provider,
        apiKey: this.encrypt(cleanKey),
        label: dto.label?.trim() || null,
        model: dto.model?.trim() || null,
        isActive: true
      }
    });
    await this.audit.write({
      actorId: userId,
      action: "userAiProvider.create",
      entityType: "UserAiProvider",
      entityId: created.id,
      metadata: { provider, label: created.label, model: created.model }
    });
    return this.sanitize(created);
  }

  async update(
    userId: string,
    id: string,
    dto: { apiKey?: string; label?: string | null; model?: string | null; isActive?: boolean }
  ) {
    const record = await this.prisma.userAiProvider.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Personal provider not found.");
    if (record.userId !== userId) throw new ForbiddenException("Not your provider.");

    const patch: Record<string, unknown> = {};
    if (dto.label !== undefined) patch.label = dto.label?.trim() || null;
    if (dto.model !== undefined) patch.model = dto.model?.trim() || null;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.apiKey !== undefined) {
      const cleanKey = dto.apiKey.trim();
      if (!cleanKey) throw new BadRequestException({ error: "invalid_key", message: "API key cannot be empty." });
      const test = await this.testLiveKey(record.provider as AiProviderName, cleanKey);
      if (!test.ok) throw new BadRequestException({ error: "invalid_key", message: test.message });
      patch.apiKey = this.encrypt(cleanKey);
    }

    const updated = await this.prisma.userAiProvider.update({ where: { id }, data: patch });
    await this.audit.write({
      actorId: userId,
      action: "userAiProvider.update",
      entityType: "UserAiProvider",
      entityId: updated.id,
      metadata: { keyChanged: dto.apiKey !== undefined, label: updated.label, model: updated.model, isActive: updated.isActive }
    });
    return this.sanitize(updated);
  }

  async remove(userId: string, id: string) {
    const record = await this.prisma.userAiProvider.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Personal provider not found.");
    if (record.userId !== userId) throw new ForbiddenException("Not your provider.");
    await this.prisma.userAiProvider.delete({ where: { id } });
    // If this was the "last used" in preferences, clear it so the picker doesn't
    // try to auto-resolve to a missing row on the next at-use trigger.
    await this.prisma.userAiPreference.updateMany({
      where: { userId, lastUsedProviderId: id },
      data: { lastUsedProviderId: null }
    });
    await this.audit.write({
      actorId: userId,
      action: "userAiProvider.delete",
      entityType: "UserAiProvider",
      entityId: id,
      metadata: { provider: record.provider }
    });
    return { id };
  }

  async available(userId: string): Promise<AvailableProvider[]> {
    const [personalRows, pref] = await Promise.all([
      this.prisma.userAiProvider.findMany({ where: { userId, isActive: true } }),
      this.prisma.userAiPreference.findUnique({ where: { userId } })
    ]);
    const company = await this.companyEntries();
    const personal: AvailableProvider[] = personalRows.map((p) => ({
      id: p.id,
      type: p.provider as AiProviderName,
      source: "personal",
      label:
        p.label?.trim() ||
        `${PROVIDER_LABELS[p.provider as AiProviderName] ?? p.provider} (personal)`,
      model: p.model ?? DEFAULT_MODELS[p.provider as AiProviderName] ?? "",
      isDefault: false
    }));
    // Company rows sorted by priority chain already; personal sorted alphabetically by label.
    personal.sort((a, b) => a.label.localeCompare(b.label));
    const list: AvailableProvider[] = [...company, ...personal];
    if (pref?.lastUsedProviderId) {
      for (const item of list) {
        if (item.id === pref.lastUsedProviderId) item.isDefault = true;
      }
    }
    return list;
  }

  async setPreference(userId: string, providerId: string | null) {
    if (providerId) {
      const list = await this.available(userId);
      if (!list.some((item) => item.id === providerId)) {
        throw new BadRequestException("Provider is not available to this user.");
      }
    }
    return this.prisma.userAiPreference.upsert({
      where: { userId },
      create: { userId, lastUsedProviderId: providerId },
      update: { lastUsedProviderId: providerId }
    });
  }

  /** Decrypt the stored key for a personal provider — used by the scope service. */
  async getPersonalKey(userId: string, providerId: string) {
    const row = await this.prisma.userAiProvider.findUnique({ where: { id: providerId } });
    if (!row) throw new NotFoundException("Personal provider not found.");
    if (row.userId !== userId) throw new ForbiddenException("Not your provider.");
    if (!row.isActive) throw new BadRequestException("This provider is inactive.");
    const plain = this.tryDecrypt(row.apiKey);
    if (!plain) throw new BadRequestException("Could not decrypt stored key — re-add the provider.");
    return { provider: row.provider as AiProviderName, apiKey: plain, model: row.model };
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private async companyEntries(): Promise<AvailableProvider[]> {
    const status = await this.platformConfig.status();
    const out: AvailableProvider[] = [];
    for (const name of PROVIDER_PRIORITY) {
      const s = status[name];
      if (s.configured) {
        out.push({
          id: `company-${name}`,
          type: name,
          source: "company",
          label: `${PROVIDER_LABELS[name]} (company)`,
          model: s.model,
          isDefault: false
        });
      }
    }
    return out;
  }

  private validateProviderName(raw: string): AiProviderName {
    if (!PROVIDER_PRIORITY.includes(raw as AiProviderName)) {
      throw new BadRequestException(
        `Unknown provider "${raw}". Expected one of ${PROVIDER_PRIORITY.join(", ")}.`
      );
    }
    return raw as AiProviderName;
  }

  private async testLiveKey(
    provider: AiProviderName,
    key: string
  ): Promise<{ ok: boolean; message: string }> {
    try {
      if (provider === "anthropic") {
        if (!key.startsWith("sk-ant-")) {
          return { ok: false, message: 'Anthropic API keys start with "sk-ant-". Double-check the value.' };
        }
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
      }
      if (provider === "gemini") {
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
      }
      if (provider === "groq") {
        if (!key.startsWith("gsk_")) {
          return { ok: false, message: 'Groq API keys start with "gsk_". Double-check the value.' };
        }
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            max_tokens: 8,
            messages: [{ role: "user", content: "ping" }]
          })
        });
        if (response.ok) return { ok: true, message: "Connection successful." };
        const text = await response.text();
        return { ok: false, message: `Groq API ${response.status}: ${text.slice(0, 240)}` };
      }
      // openai
      if (!key.startsWith("sk-")) {
        return { ok: false, message: 'OpenAI API keys start with "sk-". Double-check the value.' };
      }
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${key}` }
      });
      if (response.ok) return { ok: true, message: "Connection successful." };
      const text = await response.text();
      return { ok: false, message: `OpenAI API ${response.status}: ${text.slice(0, 240)}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async listModelsForKey(provider: string, apiKey: string): Promise<{ provider: string; models: string[] }> {
    const p = this.validateProviderName(provider);
    const key = apiKey.trim();
    if (!key) throw new BadRequestException({ error: "invalid_key", message: "API key required." });
    try {
      if (p === "anthropic") {
        return {
          provider: p,
          models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
        };
      }
      if (p === "openai") {
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
        return { provider: p, models };
      }
      if (p === "groq") {
        const response = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { authorization: `Bearer ${key}` }
        });
        if (!response.ok) {
          throw new Error(`Groq API ${response.status}: ${(await response.text()).slice(0, 240)}`);
        }
        const body = (await response.json()) as { data: Array<{ id: string }> };
        return { provider: p, models: body.data.map((m) => m.id).sort() };
      }
      // gemini
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
      return { provider: p, models };
    } catch (err) {
      throw new BadRequestException({
        error: "Could not fetch models",
        detail: `${(err as Error).message} Check your API key is valid and has the correct permissions.`
      });
    }
  }

  private sanitize(row: {
    id: string;
    provider: string;
    label: string | null;
    model: string | null;
    isActive: boolean;
    apiKey: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      provider: row.provider,
      label: row.label,
      model: row.model ?? DEFAULT_MODELS[row.provider as AiProviderName] ?? "",
      isActive: row.isActive,
      maskedKey: this.mask(this.tryDecrypt(row.apiKey) ?? ""),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
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
    if (!key) return "****";
    if (key.length <= 8) return "****";
    return `${key.slice(0, 7)}…${key.slice(-4)}`;
  }
}
