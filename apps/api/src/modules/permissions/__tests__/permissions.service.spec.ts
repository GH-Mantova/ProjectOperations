import { permissionRegistry } from "../../../common/permissions/permission-registry";
import { PermissionsService } from "../permissions.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function permissionRow(overrides: Record<string, unknown> = {}) {
  return {
    code: "users.view",
    module: "users",
    description: "View users",
    ...overrides
  };
}

// ─── Mock builders ─────────────────────────────────────────────────────────

function buildPrismaMock() {
  return {
    permission: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => create)
    }
  };
}

function buildService() {
  const prisma = buildPrismaMock();
  const service = new PermissionsService(prisma as never);
  return { service, prisma };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PermissionsService.list", () => {
  it("returns all permissions ordered by module then code", async () => {
    const { service, prisma } = buildService();
    const rows = [
      permissionRow({ code: "audit.view", module: "audit" }),
      permissionRow({ code: "users.view", module: "users" })
    ];
    prisma.permission.findMany.mockResolvedValueOnce(rows);

    await expect(service.list()).resolves.toEqual(rows);

    expect(prisma.permission.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.permission.findMany).toHaveBeenCalledWith({
      orderBy: [{ module: "asc" }, { code: "asc" }]
    });
  });

  it("returns an empty array when no permissions are seeded", async () => {
    const { service, prisma } = buildService();
    prisma.permission.findMany.mockResolvedValueOnce([]);

    await expect(service.list()).resolves.toEqual([]);
  });

  it("propagates Prisma errors", async () => {
    const { service, prisma } = buildService();
    prisma.permission.findMany.mockRejectedValueOnce(new Error("db down"));

    await expect(service.list()).rejects.toThrow("db down");
  });
});

describe("PermissionsService.syncRegistry", () => {
  it("upserts every entry in the permission registry", async () => {
    const { service, prisma } = buildService();

    await service.syncRegistry();

    expect(prisma.permission.upsert).toHaveBeenCalledTimes(permissionRegistry.length);

    for (const entry of permissionRegistry) {
      expect(prisma.permission.upsert).toHaveBeenCalledWith({
        where: { code: entry.code },
        update: {
          description: entry.description,
          module: entry.module
        },
        create: entry
      });
    }
  });

  it("issues upserts in parallel (Promise.all)", async () => {
    const { service, prisma } = buildService();
    const order: string[] = [];

    prisma.permission.upsert.mockImplementation(async ({ where }: { where: { code: string } }) => {
      order.push(`start:${where.code}`);
      await new Promise((resolve) => setImmediate(resolve));
      order.push(`end:${where.code}`);
      return {};
    });

    await service.syncRegistry();

    const firstEnd = order.findIndex((entry) => entry.startsWith("end:"));
    const lastStart = order.map((entry) => entry.startsWith("start:")).lastIndexOf(true);
    expect(lastStart).toBeLessThan(firstEnd);
  });

  it("upserts a known canonical permission with the expected description and module", async () => {
    const { service, prisma } = buildService();

    await service.syncRegistry();

    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { code: "platform.admin" },
      update: {
        description:
          "Administer platform configuration — AI providers, notifications, email, integrations",
        module: "platform"
      },
      create: expect.objectContaining({
        code: "platform.admin",
        module: "platform"
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

  it("registry entries all have a module and description (Prisma create requires both)", () => {
    for (const entry of permissionRegistry) {
      expect(entry.module).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });
});
