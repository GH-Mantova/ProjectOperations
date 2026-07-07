// Mock-based unit tests for InternalMessagesService — proves inbox reads
// are gated on the caller (recipient) and mark-read is gated on ownership.

import { InternalMessagesService } from "../internal-messages.service";

interface MessageRow {
  id: string;
  entityType: string;
  entityId: string;
  senderId: string;
  recipientId: string;
  subject: string | null;
  body: string;
  status: "UNREAD" | "READ";
  readAt: Date | null;
  createdAt: Date;
}

function buildPrisma(users: Record<string, { isActive: boolean }>) {
  const messages: MessageRow[] = [];
  const notifications: Array<{ userId: string; metadata: Record<string, unknown> }> = [];

  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const u = users[where.id];
        return u ? { id: where.id, isActive: u.isActive } : null;
      })
    },
    internalMessage: {
      create: jest.fn(async ({ data }: { data: Partial<MessageRow> }) => {
        const row: MessageRow = {
          id: `msg-${messages.length + 1}`,
          entityType: data.entityType!,
          entityId: data.entityId!,
          senderId: data.senderId!,
          recipientId: data.recipientId!,
          subject: data.subject ?? null,
          body: data.body!,
          status: "UNREAD",
          readAt: null,
          createdAt: new Date()
        };
        messages.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        messages.find((m) => m.id === where.id) ?? null
      ),
      findMany: jest.fn(async ({ where, orderBy }: { where: Record<string, unknown>; orderBy: unknown }) => {
        // Only need to support the two shapes the service actually uses.
        let filtered = messages;
        if (where.entityType && where.entityId) {
          filtered = filtered.filter(
            (m) => m.entityType === where.entityType && m.entityId === where.entityId
          );
          const or = where.OR as Array<Record<string, string>>;
          filtered = filtered.filter((m) =>
            or.some((clause) => Object.entries(clause).every(([k, v]) => (m as any)[k] === v))
          );
          return filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        filtered = filtered.filter((m) => m.recipientId === where.recipientId);
        // status desc then createdAt desc — matches the service ordering
        return filtered.sort((a, b) => {
          if (a.status !== b.status) return a.status < b.status ? 1 : -1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<MessageRow> }) => {
        const row = messages.find((m) => m.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      })
    },
    notification: {
      create: jest.fn(async ({ data }: { data: { userId: string; metadata: Record<string, unknown> } }) => {
        notifications.push(data);
        return { id: `n${notifications.length}`, ...data };
      })
    }
  };

  return { prisma, messages, notifications };
}

describe("InternalMessagesService.send", () => {
  it("stores the message and fans out a notification anchored to the record", async () => {
    const { prisma, messages, notifications } = buildPrisma({
      alice: { isActive: true },
      bob: { isActive: true }
    });
    const service = new InternalMessagesService(prisma as never);

    const msg = await service.send(
      {
        entityType: "Job",
        entityId: "job-1",
        recipientId: "bob",
        subject: "Question",
        body: "Do you have the spec?"
      },
      "alice"
    );

    expect(msg.senderId).toBe("alice");
    expect(messages).toHaveLength(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe("bob");
    expect(notifications[0].metadata).toMatchObject({
      kind: "INTERNAL_MESSAGE",
      messageId: msg.id,
      entityType: "Job",
      entityId: "job-1",
      senderId: "alice"
    });
  });

  it("rejects when recipient is inactive or missing", async () => {
    const { prisma } = buildPrisma({ alice: { isActive: true } });
    const service = new InternalMessagesService(prisma as never);

    await expect(
      service.send(
        { entityType: "Job", entityId: "job-1", recipientId: "ghost", body: "hi" },
        "alice"
      )
    ).rejects.toThrow(/not found/i);
  });
});

describe("InternalMessagesService.listForCaller", () => {
  it("without a record filter returns the caller's inbox, unread-first", async () => {
    const { prisma } = buildPrisma({
      alice: { isActive: true },
      bob: { isActive: true }
    });
    const service = new InternalMessagesService(prisma as never);
    await service.send({ entityType: "Job", entityId: "j1", recipientId: "bob", body: "1" }, "alice");
    const second = await service.send(
      { entityType: "Job", entityId: "j1", recipientId: "bob", body: "2" },
      "alice"
    );
    await service.markRead(second.id, "bob");

    const inbox = await service.listForCaller("bob");
    expect(inbox).toHaveLength(2);
    // UNREAD sorts before READ under status asc.
    expect(inbox[0].status).toBe("UNREAD");
    expect(inbox[1].status).toBe("READ");
  });

  it("with a record filter returns only that record's thread involving the caller", async () => {
    const { prisma } = buildPrisma({
      alice: { isActive: true },
      bob: { isActive: true }
    });
    const service = new InternalMessagesService(prisma as never);
    await service.send({ entityType: "Job", entityId: "j1", recipientId: "bob", body: "for j1" }, "alice");
    await service.send({ entityType: "Job", entityId: "j2", recipientId: "bob", body: "for j2" }, "alice");

    const thread = await service.listForCaller("bob", { entityType: "Job", entityId: "j1" });
    expect(thread).toHaveLength(1);
    expect(thread[0].body).toBe("for j1");
  });
});

describe("InternalMessagesService.markRead", () => {
  it("only the recipient may mark a message read", async () => {
    const { prisma } = buildPrisma({
      alice: { isActive: true },
      bob: { isActive: true },
      carol: { isActive: true }
    });
    const service = new InternalMessagesService(prisma as never);
    const msg = await service.send(
      { entityType: "Job", entityId: "j1", recipientId: "bob", body: "hey" },
      "alice"
    );

    await expect(service.markRead(msg.id, "carol")).rejects.toThrow(/recipient/i);
    await expect(service.markRead(msg.id, "alice")).rejects.toThrow(/recipient/i);
    const read = await service.markRead(msg.id, "bob");
    expect(read.status).toBe("READ");
    expect(read.readAt).toBeInstanceOf(Date);
  });
});
