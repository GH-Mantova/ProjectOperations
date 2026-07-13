import { permissionRegistry } from "../../../common/permissions/permission-registry";
import { permissionModuleRegistry } from "../../../common/permissions/module-registry";
import { PermissionsService } from "../permissions.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function permissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "perm-1",
    code: "users.view",
    module: "users",
    description: "View users",
    label: "View user accounts",
    isHighRisk: false,
    ...overrides
  };
}

// ─── Mock builders ─────────────────────────────────────────────────────────

function buildPrismaMock() {
  return {
    permission: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => create)
    },
    permissionModule: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => create)
    },
    $transaction: jest.fn().mockImplementation((input: Array<Promise<unknown>>) => Promise.all(input))
  };
}

function buildService() {
  const prisma = buildPrismaMock();
  const service = new PermissionsService(prisma as never);
  return { service, prisma };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PermissionsService.list", () => {
  it("returns permissions with joined module display labels", async () => {
    const { service, prisma } = buildService();
    prisma.permission.findMany.mockResolvedValueOnce([
      permissionRow({ code: "users.view", module: "users" }),
      permissionRow({ code: "audit.view", module: "audit" })
    ]);
    prisma.permissionModule.findMany.mockResolvedValueOnce([
      { name: "users", label: "Users" },
      { name: "audit", label: "Audit log" }
    ]);

    const result = await service.list();

    expect(result).toEqual([
      expect.objectContaining({ code: "users.view", module: "users", moduleLabel: "Users" }),
      expect.objectContaining({ code: "audit.view", module: "audit", moduleLabel: "Audit log" })
    ]);
    expect(prisma.permission.findMany).toHaveBeenCalledWith({
      orderBy: [{ module: "asc" }, { code: "asc" }]
    });
  });

  it("falls back to the raw module slug when the lookup row is missing", async () => {
    const { service, prisma } = buildService();
    prisma.permission.findMany.mockResolvedValueOnce([
      permissionRow({ code: "custom.view", module: "custom-module" })
    ]);
    prisma.permissionModule.findMany.mockResolvedValueOnce([]);

    const result = await service.list();

    expect(result[0].moduleLabel).toBe("custom-module");
  });

  it("returns an empty array when no permissions are seeded", async () => {
    const { service, prisma } = buildService();
    prisma.permission.findMany.mockResolvedValueOnce([]);
    prisma.permissionModule.findMany.mockResolvedValueOnce([]);

    await expect(service.list()).resolves.toEqual([]);
  });

  it("propagates Prisma errors", async () => {
    const { service, prisma } = buildService();
    prisma.$transaction.mockRejectedValueOnce(new Error("db down"));

    await expect(service.list()).rejects.toThrow("db down");
  });
});

describe("PermissionsService.syncRegistry", () => {
  it("upserts every entry in the permission registry with label + isHighRisk", async () => {
    const { service, prisma } = buildService();

    await service.syncRegistry();

    expect(prisma.permission.upsert).toHaveBeenCalledTimes(permissionRegistry.length);

    for (const entry of permissionRegistry) {
      expect(prisma.permission.upsert).toHaveBeenCalledWith({
        where: { code: entry.code },
        update: {
          description: entry.description,
          module: entry.module,
          label: entry.label,
          isHighRisk: ("isHighRisk" in entry ? entry.isHighRisk : false) ?? false
        },
        create: {
          code: entry.code,
          description: entry.description,
          module: entry.module,
          label: entry.label,
          isHighRisk: ("isHighRisk" in entry ? entry.isHighRisk : false) ?? false
        }
      });
    }
  });

  it("upserts every module display-name entry", async () => {
    const { service, prisma } = buildService();

    await service.syncRegistry();

    expect(prisma.permissionModule.upsert).toHaveBeenCalledTimes(permissionModuleRegistry.length);
    for (const mod of permissionModuleRegistry) {
      expect(prisma.permissionModule.upsert).toHaveBeenCalledWith({
        where: { name: mod.name },
        update: { label: mod.label },
        create: { name: mod.name, label: mod.label }
      });
    }
  });

  it("upserts a known canonical high-risk permission with the expected label", async () => {
    const { service, prisma } = buildService();

    await service.syncRegistry();

    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { code: "compliance.admin" },
      update: expect.objectContaining({
        isHighRisk: true,
        label: "Override compliance blocks and send manual alerts"
      }),
      create: expect.objectContaining({
        code: "compliance.admin",
        module: "compliance",
        isHighRisk: true
      })
    });
  });

  it("propagates Prisma errors from upsert", async () => {
    const { service, prisma } = buildService();
    prisma.permission.upsert.mockRejectedValueOnce(new Error("unique violation"));

    await expect(service.syncRegistry()).rejects.toThrow("unique violation");
  });
});

describe("PermissionsService registry shape", () => {
  it("registry contains no duplicate codes (guards against syncRegistry regressions)", () => {
    const codes = permissionRegistry.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every registry entry carries a human label — the UI never falls back to raw code", () => {
    for (const entry of permissionRegistry) {
      expect(entry.label).toBeTruthy();
      expect(entry.label.length).toBeGreaterThan(2);
    }
  });

  it("registry entries all have a module and description (Prisma create requires both)", () => {
    for (const entry of permissionRegistry) {
      expect(entry.module).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it("module registry contains no duplicate names", () => {
    const names = permissionModuleRegistry.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
