/**
 * Integration spec for the admin reset-password endpoint.
 *
 * Wires AdminUsersController + AdminUsersService through a NestJS
 * TestingModule with a real PasswordService, a mocked PrismaService,
 * and a mocked AuditService. This exercises the controller → service →
 * audit-service path end-to-end — including the tier/permission rules
 * and the audit emission — without standing up a Postgres instance.
 *
 * (The codebase uses mocked Prisma in all spec files; there is no
 * test-DB harness on `pnpm test:api:serial` yet. Adding one is out of
 * scope for this PR.)
 */
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PasswordService } from "../../../common/security/password.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { AdminUsersController } from "../admin-users.controller";
import { AdminUsersService, USER_PASSWORD_RESET_BY_ADMIN } from "../admin-users.service";

type PrismaMock = {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

type AuditMock = {
  write: jest.Mock;
};

const ADMIN_ID = "admin-1";
const ADMIN_EMAIL = "admin@projectops.local";
const TARGET_ID = "worker-1";
const TARGET_EMAIL = "worker@projectops.local";
const REGULAR_ID = "worker-2";

function adminUserRow(overrides: Partial<{ id: string; email: string }> = {}) {
  return {
    id: overrides.id ?? ADMIN_ID,
    email: overrides.email ?? ADMIN_EMAIL,
    isSuperUser: false,
    isActive: true,
    userRoles: [{ role: { id: "role-admin", name: "Admin" } }]
  };
}

function workerUserRow(overrides: Partial<{ id: string; email: string; isActive: boolean }> = {}) {
  return {
    id: overrides.id ?? TARGET_ID,
    email: overrides.email ?? TARGET_EMAIL,
    isSuperUser: false,
    isActive: overrides.isActive ?? true,
    passwordHash: "old-salt:old-hash",
    userRoles: [{ role: { id: "role-worker", name: "Worker" } }]
  };
}

describe("Admin reset-password (integration)", () => {
  let controller: AdminUsersController;
  let prisma: PrismaMock;
  let audit: AuditMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: where.id,
          ...data
        }))
      }
    };
    audit = { write: jest.fn(async () => undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        AdminUsersService,
        PasswordService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AdminUsersController);
  });

  it("admin successfully resets another user's password — returns temp password, hash updated, audit row written", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(adminUserRow()) // me(actorId)
      .mockResolvedValueOnce(workerUserRow()); // target lookup

    const result = await controller.resetPassword(TARGET_ID, { sub: ADMIN_ID });

    expect(result.userId).toBe(TARGET_ID);
    expect(typeof result.temporaryPassword).toBe("string");
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(result.message).toMatch(/out of band/i);

    // Target user's password hash was rewritten and forcePasswordReset flipped on.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const [updateArgs] = prisma.user.update.mock.calls[0] as [
      { where: { id: string }; data: { passwordHash: string; forcePasswordReset: boolean } }
    ];
    expect(updateArgs.where.id).toBe(TARGET_ID);
    expect(updateArgs.data.forcePasswordReset).toBe(true);
    expect(updateArgs.data.passwordHash).not.toBe("old-salt:old-hash");
    expect(updateArgs.data.passwordHash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

    // Audit log was written with the canonical action.
    expect(audit.write).toHaveBeenCalledTimes(1);
    const [auditArgs] = audit.write.mock.calls[0] as [
      { action: string; actorId: string; entityType: string; entityId: string; metadata: Record<string, unknown> }
    ];
    expect(auditArgs.action).toBe(USER_PASSWORD_RESET_BY_ADMIN);
    expect(auditArgs.actorId).toBe(ADMIN_ID);
    expect(auditArgs.entityType).toBe("User");
    expect(auditArgs.entityId).toBe(TARGET_ID);
    expect(auditArgs.metadata.resetByEmail).toBe(ADMIN_EMAIL);
  });

  it("non-admin caller is rejected with ForbiddenException (403)", async () => {
    const regularUserRow = {
      id: REGULAR_ID,
      email: "regular@projectops.local",
      isSuperUser: false,
      isActive: true,
      userRoles: [{ role: { id: "role-worker", name: "Worker" } }]
    };
    prisma.user.findUnique.mockResolvedValueOnce(regularUserRow);

    await expect(
      controller.resetPassword(TARGET_ID, { sub: REGULAR_ID })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("rejects self-reset with BadRequestException (400)", async () => {
    await expect(
      controller.resetPassword(ADMIN_ID, { sub: ADMIN_ID })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("non-existent target user → NotFoundException (404)", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(adminUserRow()) // me(actorId)
      .mockResolvedValueOnce(null); // target lookup

    await expect(
      controller.resetPassword("does-not-exist", { sub: ADMIN_ID })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("audit log metadata never contains the new temporary password value", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(adminUserRow())
      .mockResolvedValueOnce(workerUserRow());

    const result = await controller.resetPassword(TARGET_ID, { sub: ADMIN_ID });
    const tempPassword = result.temporaryPassword;

    expect(audit.write).toHaveBeenCalledTimes(1);
    const [auditArgs] = audit.write.mock.calls[0] as [{ metadata: Record<string, unknown> }];

    // Stringify the full audit call payload — the temp password must not appear anywhere.
    const fullPayload = JSON.stringify(audit.write.mock.calls[0]);
    expect(fullPayload).not.toContain(tempPassword);

    // Belt-and-braces: also walk known metadata keys.
    for (const value of Object.values(auditArgs.metadata)) {
      if (typeof value === "string") {
        expect(value).not.toContain(tempPassword);
      }
    }
  });

  it("admin cannot reset another Admin's password — 403", async () => {
    const adminTarget = {
      id: "admin-2",
      email: "admin2@projectops.local",
      isSuperUser: false,
      isActive: true,
      userRoles: [{ role: { id: "role-admin", name: "Admin" } }]
    };
    prisma.user.findUnique
      .mockResolvedValueOnce(adminUserRow())
      .mockResolvedValueOnce(adminTarget);

    await expect(
      controller.resetPassword("admin-2", { sub: ADMIN_ID })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
});
