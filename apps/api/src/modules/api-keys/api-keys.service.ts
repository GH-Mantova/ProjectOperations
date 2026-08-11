import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { KeyEncryptionService } from "../security/key-encryption.service";
import { KeyValidationService, type ProviderId } from "../security/key-validation.service";
import { IntegrationKeysService } from "../../common/integrations/integration-keys.service";
import {
  ApiKeyMutationEvents,
  GeocodingAdapterRegistry
} from "./api-key-mutation-events";
import type {
  CreateApiCredentialDto,
  UpdateApiCredentialDto
} from "./dto/api-credential.dto";
import type {
  CreateApiKeyTypeDto,
  UpdateApiKeyTypeDto
} from "./dto/api-key-type.dto";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";

// The one seam every server-side key consumer routes through. See
// docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md
// (§3 signature, §3b wiring, §3c compat contract).
//
// VAULT-FIRST as of SLICE-3. The two internal branches below run in this
// order:
//
//   1. vaultResolve  — queries the ApiCredential vault (SLICE-1 tables,
//                      populated by the SLICE-3 backfill migration).
//   2. legacyResolve — falls back to the pre-vault stores when the vault
//                      has no matching row
//                        (IntegrationCredential → env var for integrations;
//                         PlatformConfig.<provider>KeyEncrypted for company AI;
//                         User.<provider>KeyEncrypted for per-user AI).
//
// The flip is a single-line reorder (per plan §3c). Rollback = swap the
// two lines back to legacy-first and the vault rows can stay in the DB
// harmlessly.
export type KeyScope = "company" | "user";

const INTEGRATION_ADAPTERS = new Set(["geoapify", "fuelpricesqld"]);
const AI_ADAPTERS = new Set<ProviderId>(["anthropic", "openai", "gemini", "groq"]);

// Systemic vs custom adapter classification for validation dispatch.
const AI_ADAPTER_KEYS = new Set(["anthropic", "openai", "gemini", "groq"]);
const GEOCODING_ADAPTER_KEYS = new Set([
  "geoapify",
  "google",
  "geocodify",
  "maptiler",
  "nominatim"
]);

// Public projection of an ApiCredential row for the vault UI. NEVER includes
// the encrypted value or a decrypted key. Plan §6.2 — no plaintext to the
// browser, ever.
export interface CredentialSummary {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  systemKind: string | null;
  adapter: string | null;
  scope: KeyScope;
  userId: string | null;
  hasKey: boolean;
  validatedAt: string | null;
  enabled: boolean;
  order: number | null;
  config: unknown;
  updatedAt: string;
  createdAt: string;
  updatedById: string | null;
}

export interface TypeSummary {
  id: string;
  name: string;
  description: string | null;
  systemKind: string | null;
  credentialCount: number;
}

export interface TestCredentialResult {
  ok: boolean;
  validatedAt?: string;
  reason?: string;
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: KeyEncryptionService,
    private readonly integrationKeys: IntegrationKeysService,
    private readonly validator: KeyValidationService,
    private readonly events: ApiKeyMutationEvents,
    private readonly geocodingRegistry: GeocodingAdapterRegistry
  ) {}

  async resolve(adapter: string, scope: KeyScope, userId?: string): Promise<string | null> {
    // scope="user" cannot cross-read another user's row. userId is taken from
    // the caller's JWT (req.user.sub); missing userId = deny.
    if (scope === "user" && !userId) return null;

    // Vault-first (SLICE-3 flip). Rollback = swap these two lines back to
    // legacy-first; the vault rows in the DB remain harmless.
    const primary = await this.vaultResolve(adapter, scope, userId);
    if (primary !== null) return primary;
    return this.legacyResolve(adapter, scope, userId);
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
    if (AI_ADAPTERS.has(adapter as ProviderId)) {
      if (scope === "company") return this.resolveCompanyAiKey(adapter);
      return this.resolveUserAiKey(adapter, userId!);
    }
    return null;
  }

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

  // ── SLICE-4a: Vault management API ──────────────────────────────────
  //
  // Every method here enforces the plan §1d + §6 permission invariants IN
  // ADDITION TO the controller-layer guards (defence in depth per §6.4). A
  // controller misconfiguration or a future direct-service caller cannot
  // punch through these checks.

  async listCredentials(scope: KeyScope, actor: AuthenticatedUser): Promise<CredentialSummary[]> {
    if (scope === "company") {
      this.assertCompanyAdmin(actor);
      const rows = await this.prisma.apiCredential.findMany({
        where: { scope: "company" },
        include: { type: true },
        orderBy: [{ order: "asc" }, { name: "asc" }]
      });
      return rows.map((row) => this.toSummary(row));
    }
    // Personal scope: caller sees ONLY their own rows. A super-user can
    // see status of other users' personal rows for audit purposes but
    // never the value (§6.3) — the summary already strips valueEncrypted
    // so the same projection is safe.
    const where = actor.isSuperUser
      ? { scope: "user" as const }
      : { scope: "user" as const, userId: actor.sub };
    const rows = await this.prisma.apiCredential.findMany({
      where,
      include: { type: true },
      orderBy: [{ userId: "asc" }, { name: "asc" }]
    });
    return rows.map((row) => this.toSummary(row));
  }

  async createCredential(
    dto: CreateApiCredentialDto,
    actor: AuthenticatedUser
  ): Promise<CredentialSummary> {
    if (dto.scope === "company") this.assertCompanyAdmin(actor);
    if (!dto.key || !dto.key.trim()) {
      throw new BadRequestException("Key value cannot be empty.");
    }
    const type = await this.prisma.apiKeyType.findUnique({ where: { id: dto.typeId } });
    if (!type) throw new NotFoundException(`ApiKeyType '${dto.typeId}' not found.`);

    const adapter = dto.adapter ?? this.defaultAdapterForType(type.name);
    const clean = dto.key.trim();
    const valueEncrypted = this.encryption.encrypt(clean);

    // Personal scope: userId is FORCED to req.user.sub. Any client-supplied
    // userId is discarded (§1d — a user cannot create a row on someone else's
    // behalf, not even a super-user creating a "personal" row for another
    // user; those are always company-scope rows).
    const userId = dto.scope === "user" ? actor.sub : null;

    const normalisedConfig = this.normaliseConfig(dto.config);
    let validationResult: TestCredentialResult | undefined;
    if (dto.validate !== false) {
      validationResult = await this.runValidation(adapter, type.systemKind, clean, normalisedConfig);
    }

    const row = await this.prisma.apiCredential.create({
      data: {
        name: dto.name,
        typeId: dto.typeId,
        adapter,
        scope: dto.scope,
        userId,
        valueEncrypted,
        enabled: dto.enabled ?? true,
        order: dto.order ?? null,
        config: normalisedConfig as never,
        validatedAt: validationResult?.ok ? new Date() : null,
        updatedById: actor.sub
      },
      include: { type: true }
    });
    this.logger.log(
      `Credential create [id=${row.id}, typeId=${row.typeId}, scope=${row.scope}, subjectId=${row.userId ?? "-"}, actor=${actor.sub}]`
    );
    this.events.emit();
    return this.toSummary(row as never);
  }

  async updateCredential(
    id: string,
    dto: UpdateApiCredentialDto,
    actor: AuthenticatedUser
  ): Promise<CredentialSummary> {
    const existing = await this.prisma.apiCredential.findUnique({
      where: { id },
      include: { type: true }
    });
    if (!existing) throw new NotFoundException(`Credential '${id}' not found.`);
    this.assertCanMutate(existing, actor);

    let typeName = existing.type.name;
    let systemKind = existing.type.systemKind;
    if (dto.typeId && dto.typeId !== existing.typeId) {
      const nextType = await this.prisma.apiKeyType.findUnique({ where: { id: dto.typeId } });
      if (!nextType) throw new NotFoundException(`ApiKeyType '${dto.typeId}' not found.`);
      typeName = nextType.name;
      systemKind = nextType.systemKind;
    }

    let valueEncrypted: string | undefined;
    let clearValidatedAt = false;
    if (dto.key !== undefined) {
      const clean = dto.key.trim();
      if (!clean) throw new BadRequestException("Key value cannot be empty.");
      valueEncrypted = this.encryption.encrypt(clean);
      clearValidatedAt = true;
    }

    const data: Record<string, unknown> = {
      updatedById: actor.sub
    };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.typeId !== undefined) data.typeId = dto.typeId;
    if (dto.adapter !== undefined) {
      data.adapter = dto.adapter || this.defaultAdapterForType(typeName);
    }
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.config !== undefined) data.config = this.normaliseConfig(dto.config) as never;
    if (valueEncrypted !== undefined) data.valueEncrypted = valueEncrypted;
    if (clearValidatedAt) data.validatedAt = null;

    const row = await this.prisma.apiCredential.update({
      where: { id },
      data,
      include: { type: true }
    });
    this.logger.log(
      `Credential update [id=${row.id}, scope=${row.scope}, subjectId=${row.userId ?? "-"}, actor=${actor.sub}, rotated=${valueEncrypted !== undefined}]`
    );
    this.events.emit();
    // Suppress unused variable warning — systemKind is referenced for symmetry
    // with create(); reserved for a future re-validate-on-type-change flow.
    void systemKind;
    return this.toSummary(row as never);
  }

  async deleteCredential(id: string, actor: AuthenticatedUser): Promise<{ ok: true }> {
    const existing = await this.prisma.apiCredential.findUnique({
      where: { id },
      include: { type: true }
    });
    if (!existing) throw new NotFoundException(`Credential '${id}' not found.`);
    this.assertCanMutate(existing, actor);
    await this.prisma.apiCredential.delete({ where: { id } });
    this.logger.log(
      `Credential delete [id=${id}, scope=${existing.scope}, subjectId=${existing.userId ?? "-"}, actor=${actor.sub}]`
    );
    this.events.emit();
    return { ok: true };
  }

  async reorderCredentials(ids: string[], actor: AuthenticatedUser): Promise<{ ok: true }> {
    this.assertCompanyAdmin(actor);
    if (ids.length === 0) return { ok: true };
    const rows = await this.prisma.apiCredential.findMany({
      where: { id: { in: ids } },
      select: { id: true, scope: true }
    });
    if (rows.some((r) => r.scope !== "company")) {
      throw new BadRequestException("Reorder is only available for company-scope credentials.");
    }
    const found = new Set(rows.map((r) => r.id));
    for (const id of ids) {
      if (!found.has(id)) throw new NotFoundException(`Credential '${id}' not found.`);
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.apiCredential.update({
          where: { id },
          data: { order: index + 1, updatedById: actor.sub }
        })
      )
    );
    this.logger.log(`Credential reorder [count=${ids.length}, actor=${actor.sub}]`);
    this.events.emit();
    return { ok: true };
  }

  async testCredential(id: string, actor: AuthenticatedUser): Promise<TestCredentialResult> {
    const existing = await this.prisma.apiCredential.findUnique({
      where: { id },
      include: { type: true }
    });
    if (!existing) throw new NotFoundException(`Credential '${id}' not found.`);
    this.assertCanMutate(existing, actor);
    if (!existing.valueEncrypted) return { ok: false, reason: "No key value stored." };
    const decrypted = this.encryption.tryDecrypt(existing.valueEncrypted, {
      provider: existing.adapter ?? existing.type.name,
      scope: existing.scope,
      subjectId: existing.userId ?? undefined
    });
    if (!decrypted) return { ok: false, reason: "Stored key could not be decrypted." };
    const adapter = existing.adapter ?? this.defaultAdapterForType(existing.type.name);
    const result = await this.runValidation(
      adapter,
      existing.type.systemKind,
      decrypted,
      existing.config
    );
    if (result.ok) {
      const validatedAt = new Date();
      await this.prisma.apiCredential.update({
        where: { id },
        data: { validatedAt }
      });
      return { ok: true, validatedAt: validatedAt.toISOString(), reason: result.reason };
    }
    return result;
  }

  // ── ApiKeyType CRUD (Manage Types) ──────────────────────────────────

  async listTypes(): Promise<TypeSummary[]> {
    const rows = await this.prisma.apiKeyType.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { credentials: true } } }
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      systemKind: row.systemKind,
      credentialCount: row._count.credentials
    }));
  }

  async createType(dto: CreateApiKeyTypeDto, actor: AuthenticatedUser): Promise<TypeSummary> {
    this.assertCompanyAdmin(actor);
    const existing = await this.prisma.apiKeyType.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`An API key type named '${dto.name}' already exists.`);
    }
    // User-created types always land with systemKind=null (§2a — users cannot
    // invent a systemKind, only seeded types get one).
    const row = await this.prisma.apiKeyType.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        systemKind: null
      }
    });
    this.logger.log(`ApiKeyType create [id=${row.id}, name=${row.name}, actor=${actor.sub}]`);
    return { id: row.id, name: row.name, description: row.description, systemKind: row.systemKind, credentialCount: 0 };
  }

  async updateType(
    id: string,
    dto: UpdateApiKeyTypeDto,
    actor: AuthenticatedUser
  ): Promise<TypeSummary> {
    this.assertCompanyAdmin(actor);
    const existing = await this.prisma.apiKeyType.findUnique({
      where: { id },
      include: { _count: { select: { credentials: true } } }
    });
    if (!existing) throw new NotFoundException(`ApiKeyType '${id}' not found.`);
    if (existing.systemKind && dto.name && dto.name !== existing.name) {
      // Seeded types can be renamed by super-user but cannot have their
      // systemKind/adapterHint changed (the prompt: "Block editing
      // systemKind/adapterHint on seeded types"). Rename is allowed because
      // credentials reference id, not name (rename-cascade is automatic).
    }
    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.apiKeyType.findUnique({ where: { name: dto.name } });
      if (clash) {
        throw new ConflictException(`An API key type named '${dto.name}' already exists.`);
      }
    }
    const row = await this.prisma.apiKeyType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {})
      }
    });
    this.logger.log(`ApiKeyType update [id=${row.id}, name=${row.name}, actor=${actor.sub}]`);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      systemKind: row.systemKind,
      credentialCount: existing._count.credentials
    };
  }

  async deleteType(id: string, actor: AuthenticatedUser): Promise<{ ok: true }> {
    this.assertCompanyAdmin(actor);
    const existing = await this.prisma.apiKeyType.findUnique({
      where: { id },
      include: { _count: { select: { credentials: true } } }
    });
    if (!existing) throw new NotFoundException(`ApiKeyType '${id}' not found.`);
    if (existing._count.credentials > 0) {
      throw new ConflictException(
        `${existing._count.credentials} key(s) use this type — reassign them before deleting.`
      );
    }
    await this.prisma.apiKeyType.delete({ where: { id } });
    this.logger.log(`ApiKeyType delete [id=${id}, name=${existing.name}, actor=${actor.sub}]`);
    return { ok: true };
  }

  // ── Permission helpers (defence-in-depth per §6.4) ──────────────────

  private assertCompanyAdmin(actor: AuthenticatedUser): void {
    if (!actor.isSuperUser) {
      throw new ForbiddenException("Super-user access required for company-scope key management.");
    }
    if (!actor.permissions?.includes("platform.admin")) {
      throw new ForbiddenException("platform.admin permission required.");
    }
  }

  private assertCanMutate(
    row: { scope: string; userId: string | null },
    actor: AuthenticatedUser
  ): void {
    if (row.scope === "company") {
      this.assertCompanyAdmin(actor);
      return;
    }
    // Personal scope: only the owning user may mutate. Super-users can see
    // status (list) but cannot write / delete / test another user's row
    // (§6.3 — "cannot decrypt or overwrite a per-user row").
    if (row.userId !== actor.sub) {
      throw new ForbiddenException("You may only manage your own personal credentials.");
    }
  }

  // ── Validation dispatch ─────────────────────────────────────────────

  private async runValidation(
    adapter: string,
    systemKind: string | null,
    key: string,
    config: unknown
  ): Promise<TestCredentialResult> {
    if (systemKind === "ai" && AI_ADAPTER_KEYS.has(adapter)) {
      try {
        const result = await this.validator.validate(adapter as ProviderId, key);
        if (result.valid) return { ok: true };
        return { ok: false, reason: result.reason };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
    if (systemKind === "geocoding" && GEOCODING_ADAPTER_KEYS.has(adapter)) {
      return this.runGeocodingProbe(adapter, key, config);
    }
    if (adapter === "custom-rest") {
      return this.runCustomRestProbe(key, config);
    }
    if (adapter === "fuelpricesqld") {
      return this.runFuelPricesProbe(key);
    }
    return { ok: true, reason: "validation skipped — custom type" };
  }

  private async runGeocodingProbe(
    adapter: string,
    key: string,
    config: unknown
  ): Promise<TestCredentialResult> {
    const impl = this.geocodingRegistry.get(adapter);
    if (!impl) {
      return { ok: false, reason: `Unknown geocoding adapter '${adapter}'` };
    }
    try {
      const results = await impl.autocomplete("Brisbane", key, config);
      if (Array.isArray(results) && results.length > 0) return { ok: true };
      return { ok: false, reason: `${adapter}: no results for probe query.` };
    } catch (err) {
      return { ok: false, reason: `${adapter}: ${(err as Error).message}` };
    }
  }

  private async runCustomRestProbe(
    key: string,
    config: unknown
  ): Promise<TestCredentialResult> {
    const cfg = (config as Record<string, unknown> | null) ?? {};
    const baseUrl = typeof cfg.baseUrl === "string" ? cfg.baseUrl : null;
    const autocompletePath =
      typeof cfg.autocompletePath === "string" ? cfg.autocompletePath : null;
    if (!baseUrl) return { ok: false, reason: "config.baseUrl is required for custom REST." };
    if (!autocompletePath) {
      return { ok: false, reason: "config.autocompletePath is required for custom REST." };
    }
    // Fetch-free pre-check: reject an obviously unsafe base URL (non-https or a
    // literal private/loopback host) with a friendly reason before touching the
    // network at all.
    try {
      assertSafeUrl(baseUrl);
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
    // Delegate the actual probe to the hardened CustomRestAdapter (request-time
    // DNS-rebind IP allow-check, https-only, redirect re-check, timeout). The
    // vault never issues a user-controlled fetch itself — routing every custom
    // egress through the adapter keeps the SSRF surface in one audited place.
    const impl = this.geocodingRegistry.get("custom-rest");
    if (!impl) {
      return { ok: false, reason: "custom-rest: adapter unavailable." };
    }
    try {
      const results = await impl.autocomplete("Brisbane", key, config);
      if (Array.isArray(results) && results.length > 0) return { ok: true };
      return { ok: false, reason: "custom-rest: no rows in response." };
    } catch (err) {
      return { ok: false, reason: `custom-rest: ${(err as Error).message}` };
    }
  }

  private async runFuelPricesProbe(key: string): Promise<TestCredentialResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        "https://fppdirectapi-prod.fuelpricesqld.com.au/Subscriber/GetCountryFuelTypes?countryId=21",
        {
          method: "GET",
          signal: controller.signal,
          headers: { Authorization: `FPDAPI SubscriberToken=${key}` }
        }
      );
      if (res.ok) return { ok: true };
      return { ok: false, reason: `fuelpricesqld: HTTP ${res.status}` };
    } catch (err) {
      const message =
        (err as Error).name === "AbortError"
          ? "fuelpricesqld: request timed out."
          : `fuelpricesqld: ${(err as Error).message}`;
      return { ok: false, reason: message };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Projections ─────────────────────────────────────────────────────

  private toSummary(row: {
    id: string;
    name: string;
    typeId: string;
    type: { name: string; systemKind: string | null };
    adapter: string | null;
    scope: string;
    userId: string | null;
    valueEncrypted: string | null;
    validatedAt: Date | null;
    enabled: boolean;
    order: number | null;
    config: unknown;
    updatedAt: Date;
    createdAt: Date;
    updatedById: string | null;
  }): CredentialSummary {
    return {
      id: row.id,
      name: row.name,
      typeId: row.typeId,
      typeName: row.type.name,
      systemKind: row.type.systemKind,
      adapter: row.adapter,
      scope: row.scope as KeyScope,
      userId: row.userId,
      hasKey: Boolean(row.valueEncrypted),
      validatedAt: row.validatedAt ? row.validatedAt.toISOString() : null,
      enabled: row.enabled,
      order: row.order,
      config: row.config,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedById: row.updatedById
    };
  }

  private defaultAdapterForType(name: string): string {
    const norm = name.trim().toLowerCase();
    if (norm.startsWith("anthropic")) return "anthropic";
    if (norm.startsWith("openai")) return "openai";
    if (norm.startsWith("google gemini") || norm === "gemini") return "gemini";
    if (norm.startsWith("groq")) return "groq";
    if (norm.startsWith("geoapify")) return "geoapify";
    if (norm.startsWith("google maps") || norm === "google") return "google";
    if (norm.startsWith("geocodify")) return "geocodify";
    if (norm.startsWith("maptiler")) return "maptiler";
    if (norm.startsWith("nominatim")) return "nominatim";
    if (norm.startsWith("fuel prices")) return "fuelpricesqld";
    if (norm.startsWith("custom rest")) return "custom-rest";
    return norm.replace(/\s+/g, "-");
  }

  private normaliseConfig(config: unknown): unknown {
    if (config === undefined || config === null) return null;
    if (typeof config !== "object") return null;
    return config;
  }
}

// SSRF guard used by the custom-REST probe. Rejects non-https schemes and
// hosts that resolve to private / loopback / link-local ranges. The full
// hardening (DNS-rebind, IP allowlist, redirect re-check) lands with the
// dedicated CustomRestAdapter in SLICE-7; this is the minimum the vault
// needs so a save probe cannot fetch an internal URL.
function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Custom REST base URL must use https.");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host.startsWith("100.64.") ||
    host.startsWith("::1") ||
    host.startsWith("fc00:") ||
    host.startsWith("fd00:") ||
    host.startsWith("fe80:")
  ) {
    throw new Error("Custom REST base URL resolves to a private or loopback host.");
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    throw new Error("Custom REST base URL resolves to a private range (172.16/12).");
  }
}
