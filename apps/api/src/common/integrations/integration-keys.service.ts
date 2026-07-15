import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { KeyEncryptionService } from "../../modules/security/key-encryption.service";
import {
  INTEGRATION_REGISTRY,
  IntegrationDefinition,
  findIntegrationDefinition
} from "./integration-keys.registry";

export interface IntegrationCredentialStatus {
  slug: string;
  label: string;
  description: string | null;
  envVar: string;
  configured: boolean;
  source: "database" | "env" | null;
  updatedAt: Date | null;
  meta: unknown;
}

// Central seam for third-party API key lookup. Every integration client
// resolves its key through resolveIntegrationKey(slug) — nobody reads
// process.env directly. This is what allows Marco to rotate a key in the
// Admin UI without touching Azure config.
//
// Fallback order:
//   1. IntegrationCredential.valueEncrypted (decrypted via KeyEncryptionService).
//   2. process.env[envVar] from the registry (transitional — keys already
//      set in Azure keep working until re-entered in the UI).
//   3. null.
//
// Never logs decrypted values. Never returns a decrypted key to any HTTP
// handler that responds to the browser — only server-side integration
// clients call resolveIntegrationKey.
@Injectable()
export class IntegrationKeysService {
  private readonly logger = new Logger(IntegrationKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: KeyEncryptionService
  ) {}

  async resolveIntegrationKey(slug: string): Promise<string | null> {
    const definition = findIntegrationDefinition(slug);
    if (!definition) {
      this.logger.warn(`resolveIntegrationKey called with unknown slug "${slug}"`);
      return null;
    }
    const row = await this.prisma.integrationCredential.findUnique({ where: { slug } });
    if (row?.valueEncrypted) {
      const decrypted = this.encryption.tryDecrypt(row.valueEncrypted, {
        provider: slug,
        scope: "integration"
      });
      if (decrypted) return decrypted;
    }
    const envValue = process.env[definition.envVar];
    if (envValue && envValue.trim()) return envValue.trim();
    return null;
  }

  async list(): Promise<IntegrationCredentialStatus[]> {
    const rows = await this.prisma.integrationCredential.findMany();
    const rowsBySlug = new Map(rows.map((r) => [r.slug, r]));
    return INTEGRATION_REGISTRY.map((def) => this.statusFor(def, rowsBySlug.get(def.slug) ?? null));
  }

  async setValue(slug: string, rawValue: string, actorId?: string): Promise<IntegrationCredentialStatus> {
    const definition = this.requireDefinition(slug);
    const clean = rawValue.trim();
    if (!clean) throw new Error("Value cannot be empty.");
    const encrypted = this.encryption.encrypt(clean);
    const row = await this.prisma.integrationCredential.upsert({
      where: { slug: definition.slug },
      create: {
        slug: definition.slug,
        label: definition.label,
        valueEncrypted: encrypted,
        updatedById: actorId ?? null
      },
      update: {
        label: definition.label,
        valueEncrypted: encrypted,
        updatedById: actorId ?? null
      }
    });
    return this.statusFor(definition, row);
  }

  async clear(slug: string, actorId?: string): Promise<IntegrationCredentialStatus> {
    const definition = this.requireDefinition(slug);
    const row = await this.prisma.integrationCredential.upsert({
      where: { slug: definition.slug },
      create: {
        slug: definition.slug,
        label: definition.label,
        valueEncrypted: null,
        updatedById: actorId ?? null
      },
      update: {
        valueEncrypted: null,
        updatedById: actorId ?? null
      }
    });
    return this.statusFor(definition, row);
  }

  private requireDefinition(slug: string): IntegrationDefinition {
    const def = findIntegrationDefinition(slug);
    if (!def) throw new NotFoundException(`Unknown integration "${slug}".`);
    return def;
  }

  private statusFor(
    definition: IntegrationDefinition,
    row: {
      valueEncrypted: string | null;
      meta: unknown;
      updatedAt: Date;
    } | null
  ): IntegrationCredentialStatus {
    let source: IntegrationCredentialStatus["source"] = null;
    if (row?.valueEncrypted) {
      const decrypted = this.encryption.tryDecrypt(row.valueEncrypted, {
        provider: definition.slug,
        scope: "integration"
      });
      if (decrypted) source = "database";
    }
    if (!source && process.env[definition.envVar]?.trim()) {
      source = "env";
    }
    return {
      slug: definition.slug,
      label: definition.label,
      description: definition.description ?? null,
      envVar: definition.envVar,
      configured: source !== null,
      source,
      updatedAt: row?.updatedAt ?? null,
      meta: row?.meta ?? null
    };
  }
}
