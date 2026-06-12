// Mock-based unit tests for UsersService — §2 user CRUD, role assignment,
// and the safe-user projection. House pattern: plain-object Prisma mock,
// direct instantiation with `as never`. PasswordService is always mocked so
// no real hashing runs in the suite (backlog pr-92 rule).

import { ConflictException, NotFoundException } from "@nestjs/common";
import { UsersService } from "../users.service";

const PAGE = { page: 1, pageSize: 25 } as never;

const userRow = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "sam@projectops.local",
  firstName: "Sam",
  lastName: "Builder",
  isActive: true,
  isSuperUser: false,
  passwordHash: "stored-hash",
  lastLoginAt: null,
  userRoles: [
    {
      role: {
        id: "role-1",
        name: "Estimator",
        description: "Builds estimates",
        rolePermissions: [
          { permission: { code: "tendering.read" } },
          { permission: { code: "tendering.write" } }
        ]
      }
    },
    {
      role: {
        id: "role-2",
        name: "Viewer",
        description: null,
        rolePermissions: [{ permission: { code: "tendering.read" } }]
      }
    }
  ],
  ...overrides
});

function buildService() {
  const prisma: Record<string, unknown> = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(userRow({ id: "user-new" })),
      update: jest.fn().mockResolvedValue(userRow())
    },
    userRole: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    $transaction: jest.fn().mockImplementation((input: Array<Promise<unknown>>) =>
      Promise.all(input)
    )
  };

  const passwordService = { hashPassword: jest.fn().mockReturnValue("hashed-password") };
  const auditService = { write: jest.fn().mockResolvedValue({ id: "audit-1" }) };

  const service = new UsersService(prisma as never, passwordService as never, auditService as never);

  return { service, prisma, passwordService, auditService };
}

// ─── list ──────────────────────────────────────────────────────────────────

describe("UsersService.list", () => {
  it("builds a case-insensitive role filter shared by query and count", async () => {
    const { service, prisma } = buildService();

    await service.list(PAGE, "Estimator");

    const where = {
      userRoles: { some: { role: { name: { equals: "Estimator", mode: "insensitive" } } } }
    };
    expect((prisma.user as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })
    );
    expect((prisma.user as { count: jest.Mock }).count).toHaveBeenCalledWith({ where });
  });

  it("uses an empty filter when no role is supplied and pages with skip/take", async () => {
    const { service, prisma } = buildService();

    await service.list({ page: 2, pageSize: 10 } as never);

    expect((prisma.user as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 10, take: 10 })
    );
  });

  it("maps rows through toSafeUser — no passwordHash leaks", async () => {
    const { service, prisma } = buildService();
    (prisma.user as { findMany: jest.Mock }).findMany.mockResolvedValue([userRow()]);
    (prisma.user as { count: jest.Mock }).count.mockResolvedValue(1);

    const result = await service.list(PAGE);

    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty("passwordHash");
    expect(result.items[0]).not.toHaveProperty("userRoles");
    expect(result.items[0].roles).toEqual([
      { id: "role-1", name: "Estimator", description: "Builds estimates" },
      { id: "role-2", name: "Viewer", description: null }
    ]);
  });
});

// ─── create ────────────────────────────────────────────────────────────────

describe("UsersService.create", () => {
  const input = {
    email: "New.User@ProjectOps.local",
    firstName: "New",
    lastName: "User",
    password: "Password123!",
    roleIds: ["role-1"]
  } as never;

  it("409s when the email is already taken (lowercased lookup)", async () => {
    const { service, prisma } = buildService();
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(userRow());

    await expect(service.create(input, "actor-1")).rejects.toBeInstanceOf(ConflictException);
    expect((prisma.user as { findUnique: jest.Mock }).findUnique).toHaveBeenCalledWith({
      where: { email: "new.user@projectops.local" }
    });
  });

  it("lowercases the email, hashes via PasswordService, and nests role links", async () => {
    const { service, prisma, passwordService } = buildService();

    await service.create(input, "actor-1");

    expect(passwordService.hashPassword).toHaveBeenCalledWith("Password123!");
    expect((prisma.user as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new.user@projectops.local",
          passwordHash: "hashed-password",
          createdById: "actor-1",
          updatedById: "actor-1",
          userRoles: { create: [{ roleId: "role-1" }] }
        })
      })
    );
  });

  it("omits the userRoles nested create when no roleIds are supplied", async () => {
    const { service, prisma } = buildService();

    await service.create({ ...(input as object), roleIds: undefined } as never, "actor-1");

    expect(
      ((prisma.user as { create: jest.Mock }).create.mock.calls[0][0] as {
        data: { userRoles: unknown };
      }).data.userRoles
    ).toBeUndefined();
  });

  it("writes a users.create audit entry and returns the safe projection", async () => {
    const { service, auditService } = buildService();

    const result = await service.create(input, "actor-1");

    expect(auditService.write).toHaveBeenCalledWith({
      actorId: "actor-1",
      action: "users.create",
      entityType: "User",
      entityId: "user-new",
      metadata: { email: "sam@projectops.local", roleIds: ["role-1"] }
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.permissions).toEqual(["tendering.read", "tendering.write"]);
  });
});

// ─── update ────────────────────────────────────────────────────────────────

describe("UsersService.update", () => {
  it("404s when the user does not exist", async () => {
    const { service } = buildService();

    await expect(service.update("missing", {} as never, "actor-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("replaces role links wholesale — deleteMany then createMany", async () => {
    const { service, prisma } = buildService();
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(userRow());

    await service.update("user-1", { roleIds: ["role-2", "role-3"] } as never, "actor-1");

    expect((prisma.userRole as { deleteMany: jest.Mock }).deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" }
    });
    expect((prisma.userRole as { createMany: jest.Mock }).createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", roleId: "role-2" },
        { userId: "user-1", roleId: "role-3" }
      ]
    });
  });

  it("clears all roles when an empty roleIds array is supplied", async () => {
    const { service, prisma } = buildService();
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(userRow());

    await service.update("user-1", { roleIds: [] } as never, "actor-1");

    expect((prisma.userRole as { deleteMany: jest.Mock }).deleteMany).toHaveBeenCalled();
    expect((prisma.userRole as { createMany: jest.Mock }).createMany).not.toHaveBeenCalled();
  });

  it("only sets supplied fields and hashes a new password through PasswordService", async () => {
    const { service, prisma, passwordService } = buildService();
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(userRow());

    await service.update("user-1", { password: "NewPass123!", firstName: "Sammy" } as never, "actor-1");

    expect(passwordService.hashPassword).toHaveBeenCalledWith("NewPass123!");
    const data = ((prisma.user as { update: jest.Mock }).update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    }).data;
    expect(data).toEqual({
      updatedById: "actor-1",
      firstName: "Sammy",
      passwordHash: "hashed-password"
    });
  });

  it("audits activation toggles under users.activation, other edits under users.update", async () => {
    const { service, prisma, auditService } = buildService();
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(userRow());

    await service.update("user-1", { isActive: false } as never, "actor-1");
    await service.update("user-1", { firstName: "Sammy" } as never, "actor-1");

    expect(auditService.write).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: "users.activation" })
    );
    expect(auditService.write).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: "users.update", metadata: { updatedFields: ["firstName"] } })
    );
  });
});

// ─── Projections ───────────────────────────────────────────────────────────

describe("UsersService.flattenPermissions / toSafeUser", () => {
  it("flattens role permissions into a de-duplicated code list", () => {
    const { service } = buildService();

    expect(service.flattenPermissions(userRow() as never)).toEqual([
      "tendering.read",
      "tendering.write"
    ]);
  });

  it("toSafeUser coerces a missing isSuperUser to false", () => {
    const { service } = buildService();
    const row = userRow();
    delete (row as Record<string, unknown>).isSuperUser;

    expect(service.toSafeUser(row as never).isSuperUser).toBe(false);
  });
});

// ─── Lookups ───────────────────────────────────────────────────────────────

describe("UsersService lookups", () => {
  it("findByEmailWithSecurity lowercases the email", async () => {
    const { service, prisma } = buildService();

    await service.findByEmailWithSecurity("Admin@ProjectOps.local");

    expect((prisma.user as { findUnique: jest.Mock }).findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "admin@projectops.local" } })
    );
  });
});
