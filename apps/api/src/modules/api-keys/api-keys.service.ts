import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { KeyEncryptionService } from "../security/key-encryption.service";
import { IntegrationKeysService } from "../../common/integrations/integration-keys.service";

// SLICE-2 seam. One method — resolve(adapter, scope, userId?) — that every
// server-side key consumer routes through. See
// docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md
// (§3 signature, §3b wiring, §3c compat contract).
//
// LEGACY-PRIMARY for this slice. The two internal branches below run in
// this order:
//
//   1. legacyResolve — reads existing stores today
//        (IntegrationCredential row → env var for integrations;
//         PlatformConfig.<provider>KeyEncrypted for company AI;
//         User.<provider>KeyEncrypted for per-user AI).
//   2. vaultResolve  — queries the new ApiCredential vault (SLICE-1).
//
// SLICE-3 flips these by swapping the two lines inside resolve() — nothing
// else changes. Because SLICE-1 shipped the tables with no seed data, the
// vault query never hits today, so behaviour is byte-identical to pre-slice.
export type KeyScope = "company" | "user";

const INTEGRATION_ADAPTERS = new Set(["geoapify", "fuelpricesqld"]);
const AI_ADAPTERS = new Set(["anthropic", "openai", "gemini", "groq"]);

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: KeyEncryptionService,
    private readonly integrationKeys: IntegrationKeysService
  ) {}

  async resolve(adapter: string, scope: KeyScope, userId?: string): Promise<string | null> {
    // scope="user" cannot cross-read another user's row. userId is taken from
    // the caller's JWT (req.user.sub); missing userId = deny.
    if (scope === "user" && !userId) return null;

    // SLICE-3 will swap these two lines (vault first, legacy fallback). No
    // other behaviour change is required for the flip.
    const primary = await this.legacyResolve(adapter, scope, userId);
    if (primary !== null) return primary;
    return this.vaultResolve(adapter, scope, userId);
  }

  private async legacyResolve(
    adapter: string,
    scope: KeyScope,
    userId?: string
  ): Promise<string | null> {
    if (INTEGRATION_ADAPTERS.has(adapter)) {
      if (scope !== "company") return null;
      return this.integrationKeys.resolveIntegrationKey(adapter);
    }
    if (AI_ADAPTERS.has(adapter)) {
      if (scope === "company") return this.resolveCompanyAiKey(adapter);
      return this.resolveUserAiKey(adapter, userId!);
    }
    return null;
  }

  // Company AI keys live on PlatformConfig singleton. Reading via Prisma
  // directly (rather than PlatformConfigService) keeps ApiKeysService
  // dependency-free of PlatformModule and avoids a circular graph once
  // PlatformConfigService callers route through us.
  private async resolveCompanyAiKey(adapter: string): Promise<string | null> {
    const record = await this.prisma.platformConfig.findUnique({
      where: { id: "singleton" },
      select: {
        anthropicKeyEncrypted: true,
        openaiKeyEncrypted: true,
        geminiKeyEncrypted: true,
        groqKeyEncrypted: true
      }
    });
    if (!record) return null;
    const encrypted =
      adapter === "anthropic"
        ? record.anthropicKeyEncrypted
        : adapter === "openai"
          ? record.openaiKeyEncrypted
          : adapter === "gemini"
            ? record.geminiKeyEncrypted
            : record.groqKeyEncrypted;
    return this.encryption.tryDecrypt(encrypted, { provider: adapter, scope: "company" });
  }

  private async resolveUserAiKey(adapter: string, userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        anthropicKeyEncrypted: true,
        openaiKeyEncrypted: true,
        geminiKeyEncrypted: true,
        groqKeyEncrypted: true
      }
    });
    if (!user) return null;
    const encrypted =
      adapter === "anthropic"
        ? user.anthropicKeyEncrypted
        : adapter === "openai"
          ? user.openaiKeyEncrypted
          : adapter === "gemini"
            ? user.geminiKeyEncrypted
            : user.groqKeyEncrypted;
    return this.encryption.tryDecrypt(encrypted, {
      provider: adapter,
      scope: "user",
      subjectId: userId
    });
  }

  private async vaultResolve(
    adapter: string,
    scope: KeyScope,
    userId?: string
  ): Promise<string | null> {
    // ApiKeyType.adapterHint is not on the SLICE-1 schema, so the SLICE-3
    // backfill will populate row.adapter on every credential; the coalesce
    // over type.adapterHint from plan §3a lands only once that column
    // exists. Until then, match on row.adapter directly.
    const rows = await this.prisma.apiCredential.findMany({
      where: {
        enabled: true,
        scope,
        adapter,
        ...(scope === "user" ? { userId } : { userId: null })
      },
      orderBy: [{ order: "asc" }, { updatedAt: "desc" }]
    });
    for (const row of rows) {
      if (!row.valueEncrypted) continue;
      const decrypted = this.encryption.tryDecrypt(row.valueEncrypted, {
        provider: adapter,
        scope,
        subjectId: userId
      });
      if (decrypted) return decrypted;
    }
    return null;
  }
}
