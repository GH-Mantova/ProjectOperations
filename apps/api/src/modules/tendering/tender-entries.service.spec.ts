import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TenderEntriesService } from "./tender-entries.service";

type PrismaMock = {
  tender: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  tenderEntry: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

const buildPrismaMock = (overrides: Partial<PrismaMock> = {}): PrismaMock => ({
  tender: {
    findUnique: jest.fn().mockResolvedValue({ id: "tender-1" })
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: "user-2", isActive: true })
  },
  tenderEntry: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create: jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: "entry-1",
        tenderId: data.tenderId,
        type: data.type,
        subject: data.subject ?? null,
        body: data.body,
        dueDate: data.dueDate ?? null,
        assigneeId: data.assigneeId ?? null,
        status: data.status ?? "open",
        authorId: data.authorId
      })
    ),
    update: jest.fn().mockImplementation(({ where, data }) =>
      Promise.resolve({ id: where.id, status: data.status ?? "open" })
    )
  },
  ...overrides
});

const buildAuditMock = () => ({ write: jest.fn().mockResolvedValue(undefined) });
const buildNotificationsMock = () => ({ create: jest.fn().mockResolvedValue(undefined) });
const buildEmailMock = () => ({
  resolveProvider: jest
    .fn()
    .mockResolvedValue({ sendMail: jest.fn().mockResolvedValue(undefined) })
});

const buildService = (prisma: PrismaMock = buildPrismaMock()) => {
  const audit = buildAuditMock();
  const notifications = buildNotificationsMock();
  const email = buildEmailMock();
  const service = new TenderEntriesService(
    prisma as never,
    audit as never,
    notifications as never,
    email as never
  );
  return { service, prisma, audit, notifications, email };
};

describe("TenderEntriesService", () => {
  describe("create — conditional validation", () => {
    it("rejects a task entry that is missing an assignee", async () => {
      const { service } = buildService();
      await expect(
        service.create(
          "tender-1",
          {
            type: "task",
            body: "Follow up on bid clarification",
            dueDate: "2026-07-01"
          },
          "user-1"
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a follow_up entry that is missing a due date", async () => {
      const { service } = buildService();
      await expect(
        service.create(
          "tender-1",
          { type: "follow_up", body: "Chase up client" },
          "user-1"
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a self_reminder entry that is missing a due date", async () => {
      const { service } = buildService();
      await expect(
        service.create(
          "tender-1",
          { type: "self_reminder", body: "Re-check pricing assumptions" },
          "user-1"
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a task whose assignee does not exist", async () => {
      const prisma = buildPrismaMock();
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const { service } = buildService(prisma);

      await expect(
        service.create(
          "tender-1",
          {
            type: "task",
            body: "Follow up on bid clarification",
            dueDate: "2026-07-01",
            assigneeId: "ghost-user"
          },
          "user-1"
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(["note", "rfi", "email", "call", "meeting"])(
      "accepts a %s entry without dueDate or assignee",
      async (type) => {
        const { service, prisma } = buildService();
        await expect(
          service.create("tender-1", { type, body: "Some content" }, "user-1")
        ).resolves.toMatchObject({ type });
        expect(prisma.tenderEntry.create).toHaveBeenCalledTimes(1);
      }
    );

    it("throws NotFoundException when the tender does not exist", async () => {
      const prisma = buildPrismaMock();
      prisma.tender.findUnique.mockResolvedValueOnce(null);
      const { service } = buildService(prisma);

      await expect(
        service.create("missing", { type: "note", body: "Hi" }, "user-1")
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("create — audit and notification side effects", () => {
    it("writes exactly one audit entry per successful create", async () => {
      const { service, audit } = buildService();
      await service.create(
        "tender-1",
        { type: "note", body: "Pricing locked" },
        "user-1"
      );
      expect(audit.write).toHaveBeenCalledTimes(1);
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "tenders.entries.create",
          entityType: "TenderEntry"
        })
      );
    });

    it("dispatches a notification when a task is assigned to someone other than the actor", async () => {
      const prisma = buildPrismaMock();
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: "user-2", isActive: true })
        .mockResolvedValueOnce({
          id: "user-2",
          email: "assignee@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          isActive: true
        });
      prisma.tender.findUnique
        .mockResolvedValueOnce({ id: "tender-1" })
        .mockResolvedValueOnce({ id: "tender-1", tenderNumber: "T-001", title: "Bid A" });
      prisma.tenderEntry.create.mockResolvedValueOnce({
        id: "entry-99",
        tenderId: "tender-1",
        subject: null,
        body: "Follow up on bid clarification",
        dueDate: new Date("2026-07-01"),
        assigneeId: "user-2",
        status: "open",
        type: "task",
        authorId: "user-1"
      });

      const { service, notifications, email } = buildService(prisma);
      await service.create(
        "tender-1",
        {
          type: "task",
          body: "Follow up on bid clarification",
          dueDate: "2026-07-01",
          assigneeId: "user-2"
        },
        "user-1"
      );

      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-2", severity: "MEDIUM" }),
        "user-1"
      );
      expect(email.resolveProvider).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch a notification when the task assignee is the actor", async () => {
      const prisma = buildPrismaMock();
      prisma.tenderEntry.create.mockResolvedValueOnce({
        id: "entry-100",
        tenderId: "tender-1",
        subject: null,
        body: "Self assignment",
        dueDate: new Date("2026-07-01"),
        assigneeId: "user-1",
        status: "open",
        type: "task",
        authorId: "user-1"
      });
      const { service, notifications, email } = buildService(prisma);

      await service.create(
        "tender-1",
        {
          type: "task",
          body: "Self assignment",
          dueDate: "2026-07-01",
          assigneeId: "user-1"
        },
        "user-1"
      );

      expect(notifications.create).not.toHaveBeenCalled();
      expect(email.resolveProvider).not.toHaveBeenCalled();
    });
  });

  describe("list — query shape", () => {
    it("scopes the where clause to the tender id when no filters are supplied", async () => {
      const { service, prisma } = buildService();
      await service.list("tender-1", {});

      expect(prisma.tenderEntry.findMany).toHaveBeenCalledTimes(1);
      const call = prisma.tenderEntry.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ tenderId: "tender-1" });
      expect(call.orderBy).toEqual({ createdAt: "desc" });
    });

    it("adds a type filter when the type query is supplied", async () => {
      const { service, prisma } = buildService();
      await service.list("tender-1", { type: "note" });
      expect(prisma.tenderEntry.findMany.mock.calls[0][0].where).toMatchObject({
        tenderId: "tender-1",
        type: "note"
      });
    });

    it("adds an assignee filter when the assigneeId query is supplied", async () => {
      const { service, prisma } = buildService();
      await service.list("tender-1", { assigneeId: "user-2" });
      expect(prisma.tenderEntry.findMany.mock.calls[0][0].where).toMatchObject({
        tenderId: "tender-1",
        assigneeId: "user-2"
      });
    });

    it("adds a status filter when the status query is supplied", async () => {
      const { service, prisma } = buildService();
      await service.list("tender-1", { status: "done" });
      expect(prisma.tenderEntry.findMany.mock.calls[0][0].where).toMatchObject({
        tenderId: "tender-1",
        status: "done"
      });
    });

    it("converts from/to into a createdAt range on the where clause", async () => {
      const { service, prisma } = buildService();
      await service.list("tender-1", { from: "2026-01-01", to: "2026-12-31" });
      const where = prisma.tenderEntry.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date("2026-01-01"));
      expect(where.createdAt.lte).toEqual(new Date("2026-12-31"));
    });

    it("rejects an unknown status value", async () => {
      const { service } = buildService();
      await expect(service.list("tender-1", { status: "garbage" })).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });

  describe("remove — soft delete", () => {
    it("updates status to 'cancelled' rather than calling delete", async () => {
      const prisma = buildPrismaMock();
      prisma.tenderEntry.findUnique.mockResolvedValueOnce({
        id: "entry-1",
        tenderId: "tender-1",
        status: "open"
      });
      const { service, audit } = buildService(prisma);

      await service.remove("tender-1", "entry-1", "user-1");

      expect(prisma.tenderEntry.update).toHaveBeenCalledTimes(1);
      expect(prisma.tenderEntry.update).toHaveBeenCalledWith({
        where: { id: "entry-1" },
        data: { status: "cancelled" }
      });
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: "tenders.entries.cancel" })
      );
    });

    it("is a no-op when the entry is already cancelled", async () => {
      const prisma = buildPrismaMock();
      prisma.tenderEntry.findUnique.mockResolvedValueOnce({
        id: "entry-1",
        tenderId: "tender-1",
        status: "cancelled"
      });
      const { service, audit } = buildService(prisma);

      const result = await service.remove("tender-1", "entry-1", "user-1");

      expect(prisma.tenderEntry.update).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "entry-1", status: "cancelled" });
    });

    it("throws NotFoundException when the entry belongs to a different tender", async () => {
      const prisma = buildPrismaMock();
      prisma.tenderEntry.findUnique.mockResolvedValueOnce({
        id: "entry-1",
        tenderId: "other-tender",
        status: "open"
      });
      const { service } = buildService(prisma);

      await expect(service.remove("tender-1", "entry-1", "user-1")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });
});
