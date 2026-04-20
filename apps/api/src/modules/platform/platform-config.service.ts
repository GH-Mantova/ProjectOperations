import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const SINGLETON_ID = "singleton";
const IV_BYTES = 12;
const ALGO = "aes-256-gcm";

@Injectable()
export class PlatformConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService
  ) {}

  async getAnthropicApiKey(): Promise<string | null> {
    const record = await this.prisma.platformConfig.findUnique({ where: { id: SINGLETON_ID } });
    if (record?.anthropicApiKey) {
      try {
        return this.decrypt(record.anthropicApiKey);
      } catch {
        // ignore decrypt error; fall through to env var
      }
    }
    return this.config.get<string>("ANTHROPIC_API_KEY") ?? null;
  }

  async status() {
    const record = await this.prisma.platformConfig.findUnique({ where: { id: SINGLETON_ID } });
    const storedKey = record?.anthropicApiKey ? this.tryDecrypt(record.anthropicApiKey) : null;
    const envKey = this.config.get<string>("ANTHROPIC_API_KEY") ?? null;
    const effective = storedKey ?? envKey;
    return {
      anthropic: {
        configured: Boolean(effective),
        source: storedKey ? ("database" as const) : envKey ? ("env" as const) : null,
        maskedKey: effective ? this.mask(effective) : null,
        updatedAt: record?.anthropicKeyUpdatedAt ?? null
      },
      sharePoint: {
        mode: this.config.get<string>("SHAREPOINT_MODE", "mock")
      }
    };
  }

  async setAnthropicApiKey(rawKey: string, actorId?: string) {
    const clean = rawKey.trim();
    if (!clean) throw new Error("API key cannot be empty.");
    if (!clean.startsWith("sk-ant-")) {
      throw new Error("Anthropic API keys start with \"sk-ant-\". Double-check the value.");
    }
    const encrypted = this.encrypt(clean);
    await this.prisma.platformConfig.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        anthropicApiKey: encrypted,
        anthropicKeyUpdatedAt: new Date(),
        updatedById: actorId ?? null
      },
      update: {
        anthropicApiKey: encrypted,
        anthropicKeyUpdatedAt: new Date(),
        updatedById: actorId ?? null
      }
    });
    await this.audit.write({
      actorId,
      action: "platformConfig.anthropicKey.update",
      entityType: "PlatformConfig",
      entityId: SINGLETON_ID
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
