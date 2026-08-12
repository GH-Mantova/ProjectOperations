import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CommsService, extractMentions } from "../comms.service";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

type MockPrisma = {
  commThread: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  commMessage: {
    create: jest.Mock;
  };
  commTask: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    commThread: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0)
    },
    commMessage: {
      create: jest.fn()
    },
    commTask: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0)
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: "user-1" }) },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    })
  };
  return prisma;
}

function makeService(prisma: MockPrisma) {
  return new CommsService(prisma as never);
}

const THREAD_STUB = {
  id: "thread-1",
  entityType: "ACCOUNT",
  entityId: "acct-1",
  subject: "Kick-off",
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  createdBy: { id: "user-1", firstName: "Marco", lastName: "Rossi" }
};

// ── createThread ──────────────────────────────────────────────────────────────

describe("CommsService.createThread", () => {
  it("creates a thread anchored to a supported entityType", async () => {
    const prisma = makePrisma();
    prisma.commThread.create.mockResolvedValue(THREAD_STUB);

    const service = makeService(prisma);
    const result = await service.createThread({
      entityType: "ACCOUNT",
      entityId: "acct-1",
      subject: "Kick-off",
      createdById: "user-1"
    });

    expect(result).toEqual(THREAD_STUB);
    expect(prisma.commThread.create).toHaveBeenCalledTimes(1);
  });

  it("rejects an unsupported entityType", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(
      service.createThread({
        entityType: "USER" as never,
        entityId: "acct-1",
        createdById: "user-1"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when entityId is empty", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(
      service.createThread({
        entityType: "ACCOUNT",
        entityId: "   ",
        createdById: "user-1"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when creator is unknown", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(
      service.createThread({
        entityType: "ACCOUNT",
        entityId: "acct-1",
        createdById: "ghost"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── getThread ─────────────────────────────────────────────────────────────────

describe("CommsService.getThread", () => {
  it("returns thread with messages + tasks when found", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue({
      ...THREAD_STUB,
      messages: [],
      tasks: []
    });

    const service = makeService(prisma);
    const result = await service.getThread("thread-1");
    expect(result.id).toBe("thread-1");
    expect(result.messages).toEqual([]);
    expect(result.tasks).toEqual([]);
  });

  it("throws NotFoundException when missing", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.getThread("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── archive/unarchive thread ─────────────────────────────────────────────────

describe("CommsService.archive/unarchiveThread", () => {
  it("archives a live thread", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue(THREAD_STUB);
    prisma.commThread.update.mockResolvedValue({ ...THREAD_STUB, archivedAt: new Date() });

    const service = makeService(prisma);
    const result = await service.archiveThread("thread-1");
    expect(result.archivedAt).toBeDefined();
  });

  it("rejects double-archive", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue({ ...THREAD_STUB, archivedAt: new Date() });

    const service = makeService(prisma);
    await expect(service.archiveThread("thread-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unarchive on a live thread", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue(THREAD_STUB);

    const service = makeService(prisma);
    await expect(service.unarchiveThread("thread-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("restores an archived thread", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue({ ...THREAD_STUB, archivedAt: new Date() });
    prisma.commThread.update.mockResolvedValue(THREAD_STUB);

    const service = makeService(prisma);
    const result = await service.unarchiveThread("thread-1");
    expect(result.archivedAt).toBeNull();
  });
});

// ── postMessage ───────────────────────────────────────────────────────────────

describe("CommsService.postMessage", () => {
  it("posts a message and bumps the thread updatedAt", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue(THREAD_STUB);
    prisma.commMessage.create.mockResolvedValue({
      id: "msg-1",
      threadId: "thread-1",
      authorId: "user-1",
      body: "hi @jane",
      mentions: ["jane"],
      createdAt: new Date(),
      author: { id: "user-1", firstName: "Marco", lastName: "Rossi" }
    });

    const service = makeService(prisma);
    const result = await service.postMessage({
      threadId: "thread-1",
      authorId: "user-1",
      body: "hi @jane"
    });
    expect(result.id).toBe("msg-1");
    expect(prisma.commThread.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "thread-1" } })
    );
  });

  it("rejects empty body", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(
      service.postMessage({ threadId: "thread-1", authorId: "user-1", body: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects posting to an archived thread", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue({ ...THREAD_STUB, archivedAt: new Date() });

    const service = makeService(prisma);
    await expect(
      service.postMessage({ threadId: "thread-1", authorId: "user-1", body: "hi" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when thread does not exist", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(
      service.postMessage({ threadId: "missing", authorId: "user-1", body: "hi" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

const TASK_STUB = {
  id: "task-1",
  threadId: null,
  entityType: "ACCOUNT",
  entityId: "acct-1",
  title: "Follow up",
  description: null,
  status: "OPEN" as const,
  assigneeId: null,
  createdById: "user-1",
  dueAt: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: "user-1", firstName: "Marco", lastName: "Rossi" },
  assignee: null
};

describe("CommsService.createTask", () => {
  it("creates a task with an assignee + due date", async () => {
    const prisma = makePrisma();
    prisma.commTask.create.mockResolvedValue(TASK_STUB);

    const service = makeService(prisma);
    const result = await service.createTask({
      entityType: "ACCOUNT",
      entityId: "acct-1",
      title: "Follow up",
      createdById: "user-1",
      assigneeId: "user-2",
      dueAt: "2026-08-20"
    });
    expect(result.id).toBe("task-1");
  });

  it("rejects empty title", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(
      service.createTask({
        entityType: "ACCOUNT",
        entityId: "acct-1",
        title: "   ",
        createdById: "user-1"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when threadId does not exist", async () => {
    const prisma = makePrisma();
    prisma.commThread.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(
      service.createTask({
        entityType: "ACCOUNT",
        entityId: "acct-1",
        title: "Follow up",
        createdById: "user-1",
        threadId: "ghost"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("CommsService.updateTask", () => {
  it("sets completedAt when status → DONE", async () => {
    const prisma = makePrisma();
    prisma.commTask.findUnique.mockResolvedValue(TASK_STUB);
    prisma.commTask.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...TASK_STUB, status: data.status, completedAt: data.completedAt })
    );

    const service = makeService(prisma);
    const result = await service.updateTask("task-1", { status: "DONE" });
    expect(result.status).toBe("DONE");
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it("clears completedAt when status leaves DONE", async () => {
    const prisma = makePrisma();
    prisma.commTask.findUnique.mockResolvedValue({ ...TASK_STUB, status: "DONE" });
    prisma.commTask.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...TASK_STUB, status: data.status, completedAt: data.completedAt })
    );

    const service = makeService(prisma);
    const result = await service.updateTask("task-1", { status: "IN_PROGRESS" });
    expect(result.status).toBe("IN_PROGRESS");
    expect(result.completedAt).toBeNull();
  });

  it("rejects empty title update", async () => {
    const prisma = makePrisma();
    prisma.commTask.findUnique.mockResolvedValue(TASK_STUB);

    const service = makeService(prisma);
    await expect(service.updateTask("task-1", { title: "   " })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("throws NotFoundException for missing task", async () => {
    const prisma = makePrisma();
    prisma.commTask.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.updateTask("missing", { status: "DONE" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

describe("CommsService.listTasks", () => {
  it("filters overdue tasks and defaults status to open/in-progress", async () => {
    const prisma = makePrisma();
    prisma.commTask.findMany.mockResolvedValue([TASK_STUB]);
    prisma.commTask.count.mockResolvedValue(1);

    const service = makeService(prisma);
    const result = await service.listTasks({ overdueOnly: true });

    expect(result.items).toHaveLength(1);
    const call = prisma.commTask.findMany.mock.calls[0][0];
    expect(call.where.dueAt.lt).toBeInstanceOf(Date);
    expect(call.where.status).toEqual({ in: ["OPEN", "IN_PROGRESS"] });
  });
});

// ── extractMentions ──────────────────────────────────────────────────────────

describe("extractMentions", () => {
  it("returns @-mentions without the leading @", () => {
    expect(extractMentions("hi @jane and @bob.smith please")).toEqual(["jane", "bob.smith"]);
  });

  it("ignores emails and non-word chars", () => {
    expect(extractMentions("email me at me@example.com")).toEqual([]);
  });

  it("returns empty on plain text", () => {
    expect(extractMentions("no mentions here")).toEqual([]);
  });
});
