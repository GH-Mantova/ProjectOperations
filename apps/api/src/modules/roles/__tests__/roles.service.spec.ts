// Mock-based unit tests for RolesService — §2 role definitions and
// permission assignment. House pattern: plain-object Prisma mock, direct
// instantiation with `as never`. Documents the replace-not-merge semantics
// of permission updates and the absence of a system-role mutation guard at
// the service layer (isSystem is persisted but not enforced here).

import { ConflictException, NotFoundException } from "@nestjs/common";
import { RolesService } from "../roles.service";

const roleRow = (overrides: Record<string, unknown> = {}) => ({
  id: "role-1",
  name: "Estimator",
  description: "Builds estimates",
  isSystem: false,
  rolePermissions: [
    { permission: { id: "perm-1", code: "tendering.read" } },
    { permission: { id: "perm-2", code: "tendering.write" } }
  ],
  ...overrides
});

function buildService() {
  const prisma: Record<string, unknown> = {
    role: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(roleRow({ id: "role-new" })),
      update: jest.fn().mockResolvedValue(roleRow())
    },
    rolePermission: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    $transaction: jest.fn().mockImplementation((input: Array<Promise<unknown>>) =>
      Promise.all(input)
    )
  };

  const auditService = { write: jest.fn().mockResolvedValue({ id: "audit-1" }) };

  const service = new RolesService(prisma as never, auditService as never);

  return { service, prisma, auditService };
}

// ─── list ──────────────────────────────────────────────────────────────────

describe("RolesService.list", () => {
  it("pages alphabetically and lifts permissions out of the join rows", async () => {
    const { service, prisma } = buildService();
    (prisma.role as { findMany: jest.Mock }).findMany.mockResolvedValue([roleRow()]);
    (prisma.role as { count: jest.Mock }).count.mockResolvedValue(1);

    const result = await service.list({ page: 2, pageSize: 10 } as never);

    expect((prisma.role as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" }, skip: 10, take: 10 })
    );
    expect(result.items[0].permissions).toEqual([
      { id: "perm-1", code: "tendering.read" },
      { id: "perm-2", code: "tendering.write" }
    ]);
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 10 });
  });
});

// ─── create ────────────────────────────────────────────────────────────────

describe("RolesService.create", () => {
  it("409s on a duplicate role name", async () => {
    const { service, prisma } = buildService();
    (prisma.role as { findUnique: jest.Mock }).findUnique.mockResolvedValue(roleRow());

    await expect(
      service.create({ name: "Estimator" } as never, "actor-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("defaults isSystem to false and nests permission links", async () => {
    const { service, prisma } = buildService();

    await service.create(
      { name: "Scheduler", description: "Plans work", permissionIds: ["perm-9"] } as never,
      "actor-1"
    );

    expect((prisma.role as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Scheduler",
          isSystem: false,
          rolePermissions: { create: [{ permissionId: "perm-9" }] }
        })
      })
    );
  });

  it("omits the nested create when no permissionIds are supplied", async () => {
    const { service, prisma } = buildService();

    await service.create({ name: "Scheduler" } as never, "actor-1");

    expect(
      ((prisma.role as { create: jest.Mock }).create.mock.calls[0][0] as {
        data: { rolePermissions: unknown };
      }).data.rolePermissions
    ).toBeUndefined();
  });

  it("writes a roles.create audit entry with the actor", async () => {
    const { service, auditService } = buildService();

    await service.create({ name: "Scheduler" } as never, "actor-1");

    expect(auditService.write).toHaveBeenCalledWith({
      actorId: "actor-1",
      action: "roles.create",
      entityType: "Role",
      entityId: "role-new",
      metadata: { name: "Estimator" }
    });
  });
});

// ─── update ────────────────────────────────────────────────────────────────

describe("RolesService.update", () => {
  it("404s when the role does not exist", async () => {
    const { service } = buildService();

    await expect(service.update("missing", {} as never, "actor-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("replaces permissions wholesale — deleteMany then createMany with the full set", async () => {
    const { service, prisma } = buildService();
    (prisma.role as { findUnique: jest.Mock }).findUnique.mockResolvedValue(roleRow());

    await service.update("role-1", { permissionIds: ["perm-3", "perm-4"] } as never, "actor-1");

    expect((prisma.rolePermission as { deleteMany: jest.Mock }).deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role-1" }
    });
    expect((prisma.rolePermission as { createMany: jest.Mock }).createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "role-1", permissionId: "perm-3" },
        { roleId: "role-1", permissionId: "perm-4" }
      ]
    });
  });

  it("clears all permissions when an empty array is supplied", async () => {
    const { service, prisma } = buildService();
    (prisma.role as { findUnique: jest.Mock }).findUnique.mockResolvedValue(roleRow());

    await service.update("role-1", { permissionIds: [] } as never, "actor-1");

    expect((prisma.rolePermission as { deleteMany: jest.Mock }).deleteMany).toHaveBeenCalled();
    expect((prisma.rolePermission as { createMany: jest.Mock }).createMany).not.toHaveBeenCalled();
  });

  it("leaves permission links untouched when permissionIds is omitted", async () => {
    const { service, prisma } = buildService();
    (prisma.role as { findUnique: jest.Mock }).findUnique.mockResolvedValue(roleRow());

    await service.update("role-1", { description: "Updated" } as never, "actor-1");

    expect((prisma.rolePermission as { deleteMany: jest.Mock }).deleteMany).not.toHaveBeenCalled();
  });

  it("permits mutating a system role — documents that no isSystem guard exists here", async () => {
    const { service, prisma } = buildService();
    (prisma.role as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      roleRow({ isSystem: true })
    );

    await expect(
      service.update("role-1", { name: "Renamed System Role" } as never, "actor-1")
    ).resolves.toBeDefined();
    expect((prisma.role as { update: jest.Mock }).update).toHaveBeenCalled();
  });

  it("writes a roles.update audit entry listing the touched fields", async () => {
    const { service, prisma, auditService } = buildService();
    (prisma.role as { findUnique: jest.Mock }).findUnique.mockResolvedValue(roleRow());

    await service.update("role-1", { name: "Renamed", permissionIds: [] } as never, "actor-1");

    expect(auditService.write).toHaveBeenCalledWith({
      actorId: "actor-1",
      action: "roles.update",
      entityType: "Role",
      entityId: "role-1",
      metadata: { updatedFields: ["name", "permissionIds"] }
    });
  });
});
