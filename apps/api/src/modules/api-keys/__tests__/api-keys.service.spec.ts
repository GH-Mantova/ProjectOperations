import { ApiKeysService } from "../api-keys.service";
import { ApiKeyMutationEvents, GeocodingAdapterRegistry } from "../api-key-mutation-events";

type AnyRecord = Record<string, unknown>;

function buildService(opts: {
  platformConfig?: {
    anthropicKeyEncrypted?: string | null;
    openaiKeyEncrypted?: string | null;
    geminiKeyEncrypted?: string | null;
    groqKeyEncrypted?: string | null;
  } | null;
  userRow?:
    | {
        anthropicKeyEncrypted?: string | null;
        openaiKeyEncrypted?: string | null;
        geminiKeyEncrypted?: string | null;
        groqKeyEncrypted?: string | null;
      }
    | null;
  vaultRows?: Array<AnyRecord>;
  integrationValue?: string | null;
  tryDecrypt?: jest.Mock;
} = {}) {
  const platformConfigFindUnique = jest.fn(async () => {
    if (opts.platformConfig === null) return null;
    return {
      anthropicKeyEncrypted: opts.platformConfig?.anthropicKeyEncrypted ?? null,
      openaiKeyEncrypted: opts.platformConfig?.openaiKeyEncrypted ?? null,
      geminiKeyEncrypted: opts.platformConfig?.geminiKeyEncrypted ?? null,
      groqKeyEncrypted: opts.platformConfig?.groqKeyEncrypted ?? null
    };
  });
  const userFindUnique = jest.fn(async ({ where }: { where: { id: string } }) => {
    if (opts.userRow === null) return null;
    if (opts.userRow === undefined) return null;
    return {
      anthropicKeyEncrypted: opts.userRow.anthropicKeyEncrypted ?? null,
      openaiKeyEncrypted: opts.userRow.openaiKeyEncrypted ?? null,
      geminiKeyEncrypted: opts.userRow.geminiKeyEncrypted ?? null,
      groqKeyEncrypted: opts.userRow.groqKeyEncrypted ?? null,
      __whereId: where.id
    };
  });
  const apiCredentialFindMany = jest.fn(async () => opts.vaultRows ?? []);
  const prisma = {
    platformConfig: { findUnique: platformConfigFindUnique },
    user: { findUnique: userFindUnique },
    apiCredential: { findMany: apiCredentialFindMany }
  } as never;
  const tryDecrypt =
    opts.tryDecrypt ??
    jest.fn((s: string | null | undefined) => (s ? `decrypted:${s}` : null));
  const encryption = { tryDecrypt } as never;
  const resolveIntegrationKey = jest.fn(async () =>
    opts.integrationValue === undefined ? null : opts.integrationValue
  );
  const integrationKeys = { resolveIntegrationKey } as never;
  const validator = { validate: jest.fn(async () => ({ valid: true })) } as never;
  const events = new ApiKeyMutationEvents();
  const registry = new GeocodingAdapterRegistry();
  const service = new ApiKeysService(prisma, encryption, integrationKeys, validator, events, registry);
  return {
    service,
    prisma,
    encryption,
    integrationKeys,
    resolveIntegrationKey,
    platformConfigFindUnique,
    userFindUnique,
    apiCredentialFindMany,
    tryDecrypt
  };
}

describe("ApiKeysService.resolve — vault-first (SLICE-3)", () => {
  describe("AI adapters — company scope", () => {
    it("returns the decrypted PlatformConfig key via legacy fallback when vault empty", async () => {
      const { service, apiCredentialFindMany, platformConfigFindUnique } = buildService({
        platformConfig: { anthropicKeyEncrypted: "enc-company-ant" }
      });
      const result = await service.resolve("anthropic", "company");
      expect(result).toBe("decrypted:enc-company-ant");
      // vault query is always attempted first (vault-first), then legacy fires
      expect(apiCredentialFindMany).toHaveBeenCalledTimes(1);
      expect(platformConfigFindUnique).toHaveBeenCalledTimes(1);
    });

    it("returns null when PlatformConfig row missing AND vault empty", async () => {
      const { service, apiCredentialFindMany } = buildService({ platformConfig: null });
      const result = await service.resolve("anthropic", "company");
      expect(result).toBeNull();
      expect(apiCredentialFindMany).toHaveBeenCalledTimes(1);
    });

    it("routes each of anthropic/openai/gemini/groq to the matching encrypted column", async () => {
      const { service } = buildService({
        platformConfig: {
          anthropicKeyEncrypted: "a",
          openaiKeyEncrypted: "o",
          geminiKeyEncrypted: "g",
          groqKeyEncrypted: "q"
        }
      });
      expect(await service.resolve("anthropic", "company")).toBe("decrypted:a");
      expect(await service.resolve("openai", "company")).toBe("decrypted:o");
      expect(await service.resolve("gemini", "company")).toBe("decrypted:g");
      expect(await service.resolve("groq", "company")).toBe("decrypted:q");
    });
  });

  describe("AI adapters — user scope", () => {
    it("returns the decrypted per-user key when set", async () => {
      const { service } = buildService({
        userRow: { anthropicKeyEncrypted: "enc-user-ant" }
      });
      const result = await service.resolve("anthropic", "user", "user-1");
      expect(result).toBe("decrypted:enc-user-ant");
    });

    it("returns null when scope=user AND userId is missing (cross-read denied)", async () => {
      const { service, userFindUnique } = buildService({
        userRow: { anthropicKeyEncrypted: "enc-user-ant" }
      });
      const result = await service.resolve("anthropic", "user");
      expect(result).toBeNull();
      expect(userFindUnique).not.toHaveBeenCalled();
    });

    it("queries the User row keyed by the supplied userId (no cross-user read)", async () => {
      const { service, userFindUnique } = buildService({
        userRow: { anthropicKeyEncrypted: "enc-user-ant" }
      });
      await service.resolve("anthropic", "user", "user-42");
      expect(userFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "user-42" } })
      );
    });

    it("returns null when user has no key AND vault empty", async () => {
      const { service } = buildService({ userRow: { anthropicKeyEncrypted: null } });
      const result = await service.resolve("anthropic", "user", "user-1");
      expect(result).toBeNull();
    });
  });

  describe("Integration adapters", () => {
    it("delegates geoapify company lookup to IntegrationKeysService", async () => {
      const { service, resolveIntegrationKey } = buildService({ integrationValue: "geo-key" });
      const result = await service.resolve("geoapify", "company");
      expect(result).toBe("geo-key");
      expect(resolveIntegrationKey).toHaveBeenCalledWith("geoapify");
    });

    it("delegates fuelpricesqld company lookup to IntegrationKeysService", async () => {
      const { service, resolveIntegrationKey } = buildService({ integrationValue: "fuel-key" });
      const result = await service.resolve("fuelpricesqld", "company");
      expect(result).toBe("fuel-key");
      expect(resolveIntegrationKey).toHaveBeenCalledWith("fuelpricesqld");
    });

    it("integration adapters have no user scope — returns null without any lookup", async () => {
      const { service, resolveIntegrationKey, apiCredentialFindMany } = buildService({
        integrationValue: "geo-key"
      });
      const result = await service.resolve("geoapify", "user", "user-1");
      expect(result).toBeNull();
      expect(resolveIntegrationKey).not.toHaveBeenCalled();
      // vault path always runs first; no matching row exists in this fixture
      expect(apiCredentialFindMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("Vault-first behaviour (SLICE-3 flip)", () => {
    it("returns null for unknown adapters when nothing is configured", async () => {
      const { service } = buildService();
      const result = await service.resolve("something-not-registered", "company");
      expect(result).toBeNull();
    });

    it("vault hit wins over legacy — legacy is not queried at all", async () => {
      const { service, platformConfigFindUnique } = buildService({
        platformConfig: { anthropicKeyEncrypted: "enc-legacy-ant" },
        vaultRows: [{ adapter: "anthropic", valueEncrypted: "enc-vault-ant" }]
      });
      const result = await service.resolve("anthropic", "company");
      expect(result).toBe("decrypted:enc-vault-ant");
      expect(platformConfigFindUnique).not.toHaveBeenCalled();
    });

    it("legacy still fires when vault has no matching row", async () => {
      const { service, platformConfigFindUnique } = buildService({
        platformConfig: { anthropicKeyEncrypted: "enc-legacy-ant" }
      });
      const result = await service.resolve("anthropic", "company");
      expect(result).toBe("decrypted:enc-legacy-ant");
      expect(platformConfigFindUnique).toHaveBeenCalledTimes(1);
    });

    it("passes the requested adapter into the vault query (no cross-adapter match)", async () => {
      const { service, apiCredentialFindMany } = buildService({ platformConfig: null });
      await service.resolve("anthropic", "company");
      expect(apiCredentialFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ adapter: "anthropic", scope: "company" })
        })
      );
    });
  });

  describe("Corrupted ciphertext (tryDecrypt returns null)", () => {
    it("never throws — returns null when both vault and legacy decrypt fail", async () => {
      const { service } = buildService({
        platformConfig: { anthropicKeyEncrypted: "corrupt" },
        tryDecrypt: jest.fn(() => null)
      });
      const result = await service.resolve("anthropic", "company");
      expect(result).toBeNull();
    });
  });
});
