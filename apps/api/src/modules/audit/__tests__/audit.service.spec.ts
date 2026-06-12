// Mock-based unit tests for AuditService — the shared audit-log writer used
// by nearly every other service, plus its paginated reader. The service is a
// thin Prisma pass-through, so these tests document the exact persisted
// shape (null-coalescing on actorId/entityId, metadata passed verbatim —
// no redaction layer exists today) rather than complex logic.

import { AuditService } from "../audit.service";

function buildService() {
  const prisma: Record<string, unknown> = {
    auditLog: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "audit-1", ...args.data })
      ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    $transaction: jest.fn().mockImplementation((input: Array<Promise<unknown>>) =>
      Promise.all(input)
    )
  };

  const service = new AuditService(prisma as never);

  return { service, prisma };
}

describe("AuditService.write", () => {
  it("passes action, actor, entity, and metadata through to auditLog.create", async () => {
    const { service, prisma } = buildService();

    await service.write({
      actorId: "user-1",
      action: "users.create",
      entityType: "User",
      entityId: "user-2",
      metadata: { email: "new@projectops.local" }
    });

    expect((prisma.auditLog as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: {
        actorId: "user-1",
        action: "users.create",
        entityType: "User",
        entityId: "user-2",
        metadata: { email: "new@projectops.local" }
      }
    });
  });

  it("coalesces missing actorId and entityId to null (system-initiated writes)", async () => {
    const { service, prisma } = buildService();

    await service.write({ action: "seed.run", entityType: "System" });

    expect((prisma.auditLog as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: "seed.run",
        entityType: "System",
        entityId: null,
        metadata: undefined
      }
    });
  });

  it("passes metadata verbatim — documents that no redaction layer exists", async () => {
    const { service, prisma } = buildService();
    const metadata = { updatedFields: ["password"], note: "value persists as supplied" };

    await service.write({ action: "users.update", entityType: "User", metadata });

    expect(
      ((prisma.auditLog as { create: jest.Mock }).create.mock.calls[0][0] as {
        data: { metadata: unknown };
      }).data.metadata
    ).toEqual(metadata);
  });
});

describe("AuditService.list", () => {
  it("pages with skip/take, includes the actor summary, and orders newest first", async () => {
    const { service, prisma } = buildService();

    await service.list({ page: 3, pageSize: 20 } as never);

    expect((prisma.auditLog as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: 40,
      take: 20
    });
    expect((prisma.auditLog as { count: jest.Mock }).count).toHaveBeenCalled();
  });

  it("returns items, total, and the echoed pagination", async () => {
    const { service, prisma } = buildService();
    const rows = [{ id: "audit-1", action: "users.create" }];
    (prisma.auditLog as { findMany: jest.Mock }).findMany.mockResolvedValue(rows);
    (prisma.auditLog as { count: jest.Mock }).count.mockResolvedValue(41);

    await expect(service.list({ page: 1, pageSize: 25 } as never)).resolves.toEqual({
      items: rows,
      total: 41,
      page: 1,
      pageSize: 25
    });
  });

  it("returns an empty page without throwing", async () => {
    const { service } = buildService();

    await expect(service.list({ page: 9, pageSize: 25 } as never)).resolves.toMatchObject({
      items: [],
      total: 0
    });
  });
});
