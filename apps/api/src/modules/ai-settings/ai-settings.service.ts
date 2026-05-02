import {
  ForbiddenException,
  Injectable,
  Logger,
  NotImplementedException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { KeyEncryptionService } from "../security/key-encryption.service";
import {
  KeyValidationService,
  type ProviderId
} from "../security/key-validation.service";
import {
  PlatformConfigService,
  type AiProviderName
} from "../platform/platform-config.service";

const SUPPORTED_USER_PROVIDERS: ProviderId[] = ["anthropic", "openai"];

export type ProviderKeyStatus = {
  hasKey: boolean;
  validatedAt: string | null;
};

export type SaveKeyResult =
  | { ok: true; validatedAt: string }
  | { ok: false; error: string; category: string };

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly platformConfig: PlatformConfigService,
    private readonly encryption: KeyEncryptionService,
    private readonly validator: KeyValidationService
  ) {}

  // ── Company keys (admin) ─────────────────────────────────────────
  async getCompanyKeys(): Promise<Record<AiProviderName, ProviderKeyStatus>> {
    const status = await this.platformConfig.status();
    return {
      anthropic: {
        hasKey: status.anthropic.configured,
        validatedAt: toIso(status.anthropic.validatedAt)
      },
      openai: {
        hasKey: status.openai.configured,
        validatedAt: toIso(status.openai.validatedAt)
      },
      gemini: {
        hasKey: status.gemini.configured,
        validatedAt: toIso(status.gemini.validatedAt)
      },
      groq: {
        hasKey: status.groq.configured,
        validatedAt: toIso(status.groq.validatedAt)
      }
    };
  }

  async saveCompanyKey(
    provider: AiProviderName,
    apiKey: string,
    actorId: string
  ): Promise<SaveKeyResult> {
    if (provider === "gemini" || provider === "groq") {
      throw new NotImplementedException(
        `${provider} provider validation not yet implemented`
      );
    }
    try {
      const setter =
        provider === "anthropic"
          ? this.platformConfig.setAnthropicApiKey.bind(this.platformConfig)
          : this.platformConfig.setOpenAiApiKey.bind(this.platformConfig);
      const result = (await setter(apiKey, actorId)) as { ok: true; validatedAt: string };
      this.logger.log(
        `Company key save success [provider=${provider}, actor=${actorId}]`
      );
      return result;
    } catch (err) {
      this.logger.warn(
        `Company key save validation_failed [provider=${provider}, actor=${actorId}]`
      );
      return {
        ok: false,
        error: (err as Error).message,
        category: "validation_failed"
      };
    }
  }

  async deleteCompanyKey(provider: AiProviderName, actorId: string): Promise<{ ok: true }> {
    if (provider === "gemini" || provider === "groq") {
      throw new NotImplementedException(
        `${provider} provider not yet implemented`
      );
    }
    await this.platformConfig.clearCompanyKey(provider, actorId);
    this.logger.log(`Company key delete [provider=${provider}, actor=${actorId}]`);
    return { ok: true };
  }

  // ── Per-user keys (BYOK) ──────────────────────────────────────────
  async getUserKeys(userId: string): Promise<Record<ProviderId, ProviderKeyStatus>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        anthropicKeyEncrypted: true,
        anthropicKeyValidatedAt: true,
        openaiKeyEncrypted: true,
        openaiKeyValidatedAt: true,
        geminiKeyEncrypted: true,
        geminiKeyValidatedAt: true,
        groqKeyEncrypted: true,
        groqKeyValidatedAt: true
      }
    });
    return {
      anthropic: {
        hasKey: Boolean(user?.anthropicKeyEncrypted),
        validatedAt: toIso(user?.anthropicKeyValidatedAt ?? null)
      },
      openai: {
        hasKey: Boolean(user?.openaiKeyEncrypted),
        validatedAt: toIso(user?.openaiKeyValidatedAt ?? null)
      },
      gemini: {
        hasKey: Boolean(user?.geminiKeyEncrypted),
        validatedAt: toIso(user?.geminiKeyValidatedAt ?? null)
      },
      groq: {
        hasKey: Boolean(user?.groqKeyEncrypted),
        validatedAt: toIso(user?.groqKeyValidatedAt ?? null)
      }
    };
  }

  async saveUserKey(
    userId: string,
    provider: ProviderId,
    apiKey: string
  ): Promise<SaveKeyResult> {
    await this.assertUserBYOKAllowed();
    if (!SUPPORTED_USER_PROVIDERS.includes(provider)) {
      throw new NotImplementedException(`${provider} provider not yet implemented`);
    }
    const clean = apiKey.trim();
    if (!clean) throw new Error("API key cannot be empty.");

    const result = await this.validator.validate(provider, clean);
    if (!result.valid) {
      this.logger.warn(
        `User key validation_failed [provider=${provider}, user=${userId}, category=${result.category}]`
      );
      await this.audit.write({
        actorId: userId,
        action: `userAiKey.${provider}.validation_failed`,
        entityType: "User",
        entityId: userId,
        metadata: { provider, category: result.category }
      });
      return { ok: false, error: result.reason, category: result.category };
    }
    const validatedAt = new Date();
    const encrypted = this.encryption.encrypt(clean);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(provider === "anthropic" && {
          anthropicKeyEncrypted: encrypted,
          anthropicKeyValidatedAt: validatedAt
        }),
        ...(provider === "openai" && {
          openaiKeyEncrypted: encrypted,
          openaiKeyValidatedAt: validatedAt
        })
      }
    });
    this.logger.log(`User key save success [provider=${provider}, user=${userId}]`);
    await this.audit.write({
      actorId: userId,
      action: `userAiKey.${provider}.update`,
      entityType: "User",
      entityId: userId,
      metadata: { provider }
    });
    return { ok: true, validatedAt: validatedAt.toISOString() };
  }

  async deleteUserKey(userId: string, provider: ProviderId): Promise<{ ok: true }> {
    await this.assertUserBYOKAllowed();
    if (!SUPPORTED_USER_PROVIDERS.includes(provider)) {
      throw new NotImplementedException(`${provider} provider not yet implemented`);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(provider === "anthropic" && {
          anthropicKeyEncrypted: null,
          anthropicKeyValidatedAt: null
        }),
        ...(provider === "openai" && {
          openaiKeyEncrypted: null,
          openaiKeyValidatedAt: null
        })
      }
    });
    this.logger.log(`User key delete [provider=${provider}, user=${userId}]`);
    await this.audit.write({
      actorId: userId,
      action: `userAiKey.${provider}.delete`,
      entityType: "User",
      entityId: userId,
      metadata: { provider }
    });
    return { ok: true };
  }

  // ── Helpers ───────────────────────────────────────────────────────
  private async assertUserBYOKAllowed(): Promise<void> {
    const global = await this.prisma.globalAISettings.findUnique({ where: { id: 1 } });
    if (!global?.allowBringYourOwnKey) {
      throw new ForbiddenException(
        "Personal AI keys are disabled by your administrator."
      );
    }
  }
}

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
