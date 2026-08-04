import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { ApiKeysService } from "../api-keys.service";
import { ApiKeyMutationEvents, GeocodingAdapterRegistry } from "../api-key-mutation-events";

type AnyRecord = Record<string, unknown>;

function makeActor(overrides: Partial<{ sub: string; isSuperUser: boolean; permissions: string[] }> = {}) {
  return {
    sub: overrides.sub ?? "actor-1",
    email: "actor@test",
    permissions: overrides.permissions ?? ["platform.admin"],
    isSuperUser: overrides.isSuperUser ?? true
  };
}

function buildService(seed: {
  credentials?: AnyRecord[];
  types?: AnyRecord[];
} = {}) {
  const credentials = new Map<string, AnyRecord>();
  const NOW = new Date("2026-08-05T00:00:00Z");
  const DEFAULTS: AnyRecord = {
    valueEncrypted: null,
    validatedAt: null,
    enabled: true,
    order: null,
    adapter: null,
    userId: null,
    config: null,
    updatedById: null,
    createdAt: NOW,
    updatedAt: NOW
  };
  for (const c of seed.credentials ?? []) credentials.set(c.id as string, { ...DEFAULTS, ...c });
  const types = new Map<string, AnyRecord>();
  for (const t of seed.types ?? []) types.set(t.id as string, { ...t });

  const apiCredential = {
    findMany: jest.fn(async (args: AnyRecord) => {
      let list = Array.from(credentials.values());
      const where = (args?.where as AnyRecord | undefined) ?? {};
      if (where.scope) list = list.filter((r) => r.scope === where.scope);
      if (where.userId !== undefined) list = list.filter((r) => r.userId === where.userId);
      if (where.id && (where.id as AnyRecord).in) {
        const ids = (where.id as AnyRecord).in as string[];
        list = list.filter((r) => ids.includes(r.id as string));
      }
      return list.map((row) => ({
        ...row,
        type: row.typeId ? types.get(row.typeId as string) ?? null : null,
        ...(args?.select ? {} : {})
      }));
    }),
    findUnique: jest.fn(async ({ where, include }: AnyRecord) => {
      const row = credentials.get((where as AnyRecord).id as string);
      if (!row) return null;
      const projected: AnyRecord = { ...row };
      if (include && (include as AnyRecord).type) {
        projected.type = types.get(row.typeId as string) ?? null;
      }
      return projected;
    }),
    create: jest.fn(async ({ data, include }: AnyRecord) => {
      const id = `cred-${credentials.size + 1}`;
      const row: AnyRecord = {
        id,
        createdAt: new Date("2026-08-05T00:00:00Z"),
        updatedAt: new Date("2026-08-05T00:00:00Z"),
        valueEncrypted: null,
        validatedAt: null,
        enabled: true,
        order: null,
        adapter: null,
        userId: null,
        config: null,
        updatedById: null,
        ...(data as AnyRecord)
      };
      credentials.set(id, row);
      const projected: AnyRecord = { ...row };
      if (include && (include as AnyRecord).type) {
        projected.type = types.get(row.typeId as string) ?? null;
      }
      return projected;
    }),
    update: jest.fn(async ({ where, data, include }: AnyRecord) => {
      const id = (where as AnyRecord).id as string;
      const existing = credentials.get(id);
      if (!existing) throw new Error("row not found");
      const next: AnyRecord = { ...existing, ...(data as AnyRecord), updatedAt: new Date() };
      credentials.set(id, next);
      const projected: AnyRecord = { ...next };
      if (include && (include as AnyRecord).type) {
        projected.type = types.get(next.typeId as string) ?? null;
      }
      return projected;
    }),
    delete: jest.fn(async ({ where }: AnyRecord) => {
      credentials.delete((where as AnyRecord).id as string);
      return { ok: true };
    })
  };

  const apiKeyType = {
    findMany: jest.fn(async () => {
      return Array.from(types.values()).map((t) => ({
        ...t,
        _count: {
          credentials: Array.from(credentials.values()).filter((c) => c.typeId === t.id).length
        }
      }));
    }),
    findUnique: jest.fn(async ({ where, include }: AnyRecord) => {
      const w = where as AnyRecord;
      let row: AnyRecord | undefined;
      if (w.id) row = types.get(w.id as string);
      else if (w.name) row = Array.from(types.values()).find((t) => t.name === w.name);
      if (!row) return null;
      if (include && (include as AnyRecord)._count) {
        return {
          ...row,
          _count: {
            credentials: Array.from(credentials.values()).filter((c) => c.typeId === row!.id).length
          }
        };
      }
      return { ...row };
    }),
    create: jest.fn(async ({ data }: AnyRecord) => {
      const id = `type-${types.size + 1}`;
      const row: AnyRecord = { id, description: null, systemKind: null, ...(data as AnyRecord) };
      types.set(id, row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: AnyRecord) => {
      const id = (where as AnyRecord).id as string;
      const existing = types.get(id);
      if (!existing) throw new Error("type not found");
      const next = { ...existing, ...(data as AnyRecord) };
      types.set(id, next);
      return next;
    }),
    delete: jest.fn(async ({ where }: AnyRecord) => {
      types.delete((where as AnyRecord).id as string);
      return { ok: true };
    })
  };

  const prisma = {
    apiCredential,
    apiKeyType,
    platformConfig: { findUnique: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => null) },
    $transaction: jest.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return ops;
      return ops;
    })
  } as never;

  const encryption = {
    encrypt: jest.fn((v: string) => `enc:${v}`),
    tryDecrypt: jest.fn((v: string | null | undefined) => (v ? `dec:${v}` : null))
  };
  const integrationKeys = { resolveIntegrationKey: jest.fn(async () => null) };
  const validator = { validate: jest.fn(async () => ({ valid: true })) };
  const events = new ApiKeyMutationEvents();
  const registry = new GeocodingAdapterRegistry();

  const service = new ApiKeysService(
    prisma,
    encryption as never,
    integrationKeys as never,
    validator as never,
    events,
    registry
  );
  return { service, prisma, encryption, validator, events, registry, credentials, types };
}

describe("ApiKeysService — vault management (SLICE-4a)", () => {
  describe("Permission matrix", () => {
    it("company-scope create is blocked for non-super-user", async () => {
      const { service, types } = buildService({
        types: [{ id: "t1", name: "Anthropic (Claude)", systemKind: "ai" }]
      });
      types.get("t1");
      const nonAdmin = makeActor({ isSuperUser: false, permissions: ["platform.admin"] });
      await expect(
        service.createCredential(
          { name: "n", typeId: "t1", scope: "company", key: "k", validate: false },
          nonAdmin
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("company-scope create is blocked for super-user missing platform.admin", async () => {
      const { service } = buildService({
        types: [{ id: "t1", name: "Anthropic (Claude)", systemKind: "ai" }]
      });
      const noPerm = makeActor({ isSuperUser: true, permissions: [] });
      await expect(
        service.createCredential(
          { name: "n", typeId: "t1", scope: "company", key: "k", validate: false },
          noPerm
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("user-scope create ignores client-supplied userId and forces actor.sub", async () => {
      const { service, credentials } = buildService({
        types: [{ id: "t1", name: "Anthropic (Claude)", systemKind: "ai" }]
      });
      const actor = makeActor({ sub: "user-42", isSuperUser: false, permissions: [] });
      await service.createCredential(
        // Attempt to plant on user-99: userId is not part of the DTO surface,
        // but the service force-sets it from actor.sub regardless of intent.
        { name: "personal", typeId: "t1", scope: "user", key: "k", validate: false },
        actor
      );
      const created = Array.from(credentials.values()).at(-1) as AnyRecord;
      expect(created.userId).toBe("user-42");
    });

    it("user cannot mutate another user's personal row", async () => {
      const { service } = buildService({
        types: [{ id: "t1", name: "Anthropic (Claude)", systemKind: "ai" }],
        credentials: [
          {
            id: "c1",
            name: "theirs",
            typeId: "t1",
            adapter: "anthropic",
            scope: "user",
            userId: "user-99",
            valueEncrypted: "enc:x",
            enabled: true
          }
        ]
      });
      const intruder = makeActor({ sub: "user-1", isSuperUser: false, permissions: [] });
      await expect(
        service.updateCredential("c1", { enabled: false }, intruder)
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deleteCredential("c1", intruder)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      await expect(service.testCredential("c1", intruder)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it("super-user can LIST other users' personal rows (status-only) but summary omits ciphertext", async () => {
      const { service } = buildService({
        types: [{ id: "t1", name: "Anthropic (Claude)", systemKind: "ai" }],
        credentials: [
          {
            id: "c1",
            name: "theirs",
            typeId: "t1",
            adapter: "anthropic",
            scope: "user",
            userId: "user-99",
            valueEncrypted: "enc:x",
            enabled: true
          }
        ]
      });
      const su = makeActor({ sub: "root", isSuperUser: true });
      const list = await service.listCredentials("user", su);
      expect(list).toHaveLength(1);
      const summary = list[0] as unknown as Record<string, unknown>;
      expect(summary.hasKey).toBe(true);
      expect("valueEncrypted" in summary).toBe(false);
      expect("value" in summary).toBe(false);
    });
  });

  describe("Create: encrypts and never echoes plaintext", () => {
    it("stores ciphertext via KeyEncryptionService.encrypt", async () => {
      const { service, encryption, credentials } = buildService({
        types: [{ id: "t1", name: "Anthropic (Claude)", systemKind: "ai" }]
      });
      const actor = makeActor();
      const summary = await service.createCredential(
        { name: "prod", typeId: "t1", scope: "company", key: "sk-live-secret", validate: false },
        actor
      );
      expect(encryption.encrypt).toHaveBeenCalledWith("sk-live-secret");
      const row = Array.from(credentials.values()).at(-1) as AnyRecord;
      expect(row.valueEncrypted).toBe("enc:sk-live-secret");
      // Response never leaks plaintext or ciphertext.
      const asRec = summary as unknown as Record<string, unknown>;
      expect(JSON.stringify(asRec)).not.toContain("sk-live-secret");
      expect(JSON.stringify(asRec)).not.toContain("enc:sk-live-secret");
      expect(asRec.hasKey).toBe(true);
    });
  });

  describe("Reorder + chain invalidation", () => {
    it("reorder sets sequential order and emits mutation event", async () => {
      const { service, events, credentials } = buildService({
        types: [{ id: "g", name: "Geoapify", systemKind: "geocoding" }],
        credentials: [
          { id: "a", name: "A", typeId: "g", adapter: "geoapify", scope: "company", enabled: true, order: null },
          { id: "b", name: "B", typeId: "g", adapter: "google", scope: "company", enabled: true, order: null }
        ]
      });
      const spy = jest.fn();
      events.onWrite(spy);
      await service.reorderCredentials(["b", "a"], makeActor());
      expect((credentials.get("b") as AnyRecord).order).toBe(1);
      expect((credentials.get("a") as AnyRecord).order).toBe(2);
      expect(spy).toHaveBeenCalled();
    });

    it("reorder rejects user-scope rows", async () => {
      const { service } = buildService({
        types: [{ id: "g", name: "Geoapify", systemKind: "geocoding" }],
        credentials: [{ id: "u1", typeId: "g", scope: "user", userId: "u", enabled: true, order: null }]
      });
      await expect(
        service.reorderCredentials(["u1"], makeActor())
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("ApiKeyType CRUD", () => {
    it("delete blocked with 409 when credentials reference the type", async () => {
      const { service } = buildService({
        types: [{ id: "t1", name: "Custom REST", systemKind: null }],
        credentials: [{ id: "c1", typeId: "t1", scope: "company", enabled: true }]
      });
      await expect(service.deleteType("t1", makeActor())).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    it("rename cascades: credential referencing the type reflects the new name via typeId join", async () => {
      const { service } = buildService({
        types: [{ id: "t1", name: "Old Name", systemKind: null }],
        credentials: [
          { id: "c1", name: "row", typeId: "t1", scope: "company", enabled: true, adapter: "custom" }
        ]
      });
      const actor = makeActor();
      await service.updateType("t1", { name: "New Name" }, actor);
      const list = await service.listCredentials("company", actor);
      expect(list[0].typeName).toBe("New Name");
    });

    it("duplicate name rejected with 409", async () => {
      const { service } = buildService({
        types: [{ id: "t1", name: "Existing", systemKind: null }]
      });
      await expect(
        service.createType({ name: "Existing" }, makeActor())
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("user-created types get systemKind=null (cannot invent a systemKind)", async () => {
      const { service, types } = buildService();
      const created = await service.createType({ name: "MyCustom" }, makeActor());
      expect(created.systemKind).toBeNull();
      expect((types.get(created.id) as AnyRecord).systemKind).toBeNull();
    });

    it("Manage Types writes require super-user + platform.admin", async () => {
      const { service } = buildService();
      const nonAdmin = makeActor({ isSuperUser: false });
      await expect(service.createType({ name: "X" }, nonAdmin)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });
  });

  describe("Validation dispatch", () => {
    it("AI type calls KeyValidationService.validate and stamps validatedAt on success", async () => {
      const { service, validator, credentials } = buildService({
        types: [{ id: "t1", name: "Anthropic (Claude)", systemKind: "ai" }]
      });
      await service.createCredential(
        { name: "c", typeId: "t1", scope: "company", key: "k", validate: true },
        makeActor()
      );
      expect(validator.validate).toHaveBeenCalledWith("anthropic", "k");
      const row = Array.from(credentials.values()).at(-1) as AnyRecord;
      expect(row.validatedAt).toBeInstanceOf(Date);
    });

    it("Geocoding type routes to the registered adapter — success stamps validatedAt", async () => {
      const { service, registry, credentials } = buildService({
        types: [{ id: "g", name: "Geoapify", systemKind: "geocoding" }]
      });
      const spy = jest.fn(async () => [{ formatted: "Brisbane" }]);
      registry.register("geoapify", { autocomplete: spy });
      await service.createCredential(
        { name: "geo", typeId: "g", scope: "company", key: "gk", validate: true },
        makeActor()
      );
      expect(spy).toHaveBeenCalledWith("Brisbane", "gk", null);
      const row = Array.from(credentials.values()).at(-1) as AnyRecord;
      expect(row.validatedAt).toBeInstanceOf(Date);
    });

    it("Custom REST fails validation when baseUrl is http (SSRF-first)", async () => {
      const { service, credentials } = buildService({
        types: [{ id: "c", name: "Custom REST", systemKind: null }]
      });
      await service.createCredential(
        {
          name: "cr",
          typeId: "c",
          scope: "company",
          key: "k",
          adapter: "custom-rest",
          config: { baseUrl: "http://example.com", autocompletePath: "/api" },
          validate: true
        },
        makeActor()
      );
      const row = Array.from(credentials.values()).at(-1) as AnyRecord;
      expect(row.validatedAt).toBeNull();
    });

    it("Custom REST rejects loopback baseUrl", async () => {
      const { service } = buildService({
        types: [{ id: "c", name: "Custom REST", systemKind: null }]
      });
      const result = await service.testCredential.bind(service);
      // Directly test the probe by creating a row with loopback URL and testing it.
      const created = await service.createCredential(
        {
          name: "cr",
          typeId: "c",
          scope: "company",
          key: "k",
          adapter: "custom-rest",
          config: { baseUrl: "https://127.0.0.1", autocompletePath: "/api" },
          validate: false
        },
        makeActor()
      );
      const outcome = await result(created.id, makeActor());
      expect(outcome.ok).toBe(false);
      expect(outcome.reason).toMatch(/private|loopback/i);
    });

    it("Passive / unclassified custom type skips validation with a friendly reason", async () => {
      const { service, credentials } = buildService({
        types: [{ id: "t1", name: "MyThing", systemKind: null }]
      });
      const created = await service.createCredential(
        {
          name: "row",
          typeId: "t1",
          scope: "company",
          key: "k",
          adapter: "mything",
          validate: true
        },
        makeActor()
      );
      // Create-side: validate=true but adapter is not recognised → skipped → validatedAt stamped
      const row = Array.from(credentials.values()).at(-1) as AnyRecord;
      expect(row.validatedAt).toBeInstanceOf(Date);
      const outcome = await service.testCredential(created.id, makeActor());
      expect(outcome.ok).toBe(true);
      expect(outcome.reason).toMatch(/skipped/i);
    });
  });

  describe("Missing type / row handling", () => {
    it("create on unknown typeId → 404", async () => {
      const { service } = buildService();
      await expect(
        service.createCredential(
          { name: "n", typeId: "does-not-exist", scope: "company", key: "k", validate: false },
          makeActor()
        )
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
