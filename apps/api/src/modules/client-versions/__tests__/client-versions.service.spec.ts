import { ClientVersionsService } from "../client-versions.service";

function makePrismaMock() {
  const state = {
    sessions: new Map<string, { userId: string; clientVersion: string; userAgent: string | null; lastSeenAt: Date; firstSeenAt: Date }>(),
    users: new Map<string, { id: string; email: string; firstName: string; lastName: string; isActive: boolean; updateRequestedAt: Date | null }>(),
    upsertCalls: 0
  };

  const prisma = {
    _state: state,
    clientSession: {
      upsert: jest.fn(async (args: any) => {
        state.upsertCalls++;
        const key = `${args.where.userId_clientVersion.userId}::${args.where.userId_clientVersion.clientVersion}`;
        const existing = state.sessions.get(key);
        if (existing) {
          existing.lastSeenAt = args.update.lastSeenAt;
          if (args.update.userAgent !== undefined) existing.userAgent = args.update.userAgent;
          return existing;
        }
        const row = {
          userId: args.create.userId,
          clientVersion: args.create.clientVersion,
          userAgent: args.create.userAgent ?? null,
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        };
        state.sessions.set(key, row);
        return row;
      })
    },
    user: {
      findUnique: jest.fn(async (args: any) => {
        const u = state.users.get(args.where.id);
        return u ? { updateRequestedAt: u.updateRequestedAt } : null;
      }),
      updateMany: jest.fn(async (args: any) => {
        let count = 0;
        for (const u of state.users.values()) {
          const match =
            (args.where.id === undefined || u.id === args.where.id) &&
            (args.where.isActive === undefined || u.isActive === args.where.isActive) &&
            (args.where.updateRequestedAt === undefined || (args.where.updateRequestedAt.not === null && u.updateRequestedAt !== null));
          if (match) {
            u.updateRequestedAt = args.data.updateRequestedAt;
            count++;
          }
        }
        return { count };
      }),
      findMany: jest.fn(async () => {
        return Array.from(state.users.values()).map((u) => {
          const sessions = Array.from(state.sessions.values())
            .filter((s) => s.userId === u.id)
            .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
            .slice(0, 1);
          return {
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            updateRequestedAt: u.updateRequestedAt,
            clientSessions: sessions
          };
        });
      })
    }
  };
  return prisma as any;
}

function seedUser(prisma: any, id: string, overrides: Partial<any> = {}) {
  prisma._state.users.set(id, {
    id,
    email: `${id}@example.com`,
    firstName: "T",
    lastName: id,
    isActive: true,
    updateRequestedAt: null,
    ...overrides
  });
}

describe("ClientVersionsService", () => {
  const originalSha = process.env.GIT_SHA;
  beforeEach(() => {
    process.env.GIT_SHA = "abc1234";
  });
  afterAll(() => {
    process.env.GIT_SHA = originalSha;
  });

  it("throttles repeat writes for the same (user, version) inside the window", async () => {
    const prisma = makePrismaMock();
    seedUser(prisma, "u1");
    const svc = new ClientVersionsService(prisma);

    const r1 = await svc.recordSighting("u1", "sha1", "Mozilla/5.0");
    const r2 = await svc.recordSighting("u1", "sha1", "Mozilla/5.0");
    const r3 = await svc.recordSighting("u1", "sha1", "Mozilla/5.0");

    expect(r1.skipped).toBe(false);
    expect(r2.skipped).toBe(true);
    expect(r3.skipped).toBe(true);
    expect(prisma._state.upsertCalls).toBe(1);
  });

  it("writes a fresh row when the version changes, and lastSeenAt advances", async () => {
    const prisma = makePrismaMock();
    seedUser(prisma, "u1");
    const svc = new ClientVersionsService(prisma);

    await svc.recordSighting("u1", "sha1", "ua");
    await svc.recordSighting("u1", "sha2", "ua");

    expect(prisma._state.sessions.size).toBe(2);
    expect(prisma._state.upsertCalls).toBe(2);

    svc.__resetForTests();
    const before = prisma._state.sessions.get("u1::sha1")!.lastSeenAt.getTime();
    await new Promise((r) => setTimeout(r, 5));
    await svc.recordSighting("u1", "sha1", "ua");
    const after = prisma._state.sessions.get("u1::sha1")!.lastSeenAt.getTime();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("records 'unknown' when no clientVersion header is present", async () => {
    const prisma = makePrismaMock();
    seedUser(prisma, "u1");
    const svc = new ClientVersionsService(prisma);
    await svc.recordSighting("u1", undefined, undefined);
    expect(prisma._state.sessions.has("u1::unknown")).toBe(true);
  });

  it("emits updateRequested when the user has an outstanding nudge and is behind", async () => {
    const prisma = makePrismaMock();
    seedUser(prisma, "u1", { updateRequestedAt: new Date() });
    const svc = new ClientVersionsService(prisma);
    const res = await svc.recordSighting("u1", "old-sha", "ua");
    expect(res.updateRequested).toBe(true);
  });

  it("auto-clears the nudge (and does not emit) once the client reports the current server SHA", async () => {
    const prisma = makePrismaMock();
    seedUser(prisma, "u1", { updateRequestedAt: new Date() });
    const svc = new ClientVersionsService(prisma);
    const res = await svc.recordSighting("u1", "abc1234", "ua");
    expect(res.updateRequested).toBe(false);
    expect(prisma._state.users.get("u1")!.updateRequestedAt).toBeNull();
  });

  it("list() flags users behind vs current and includes server SHA", async () => {
    const prisma = makePrismaMock();
    seedUser(prisma, "u1");
    seedUser(prisma, "u2");
    const svc = new ClientVersionsService(prisma);
    await svc.recordSighting("u1", "abc1234", "ua");
    await svc.recordSighting("u2", "old-sha", "ua");
    const out = await svc.list();
    expect(out.serverVersion).toBe("abc1234");
    const byId = new Map(out.users.map((u) => [u.userId, u]));
    expect(byId.get("u1")!.behind).toBe(false);
    expect(byId.get("u2")!.behind).toBe(true);
  });

  it("requestUpdate sets the flag for one user or for all active users", async () => {
    const prisma = makePrismaMock();
    seedUser(prisma, "u1");
    seedUser(prisma, "u2");
    seedUser(prisma, "u3", { isActive: false });
    const svc = new ClientVersionsService(prisma);

    const one = await svc.requestUpdate({ userId: "u1" });
    expect(one.affected).toBe(1);
    expect(prisma._state.users.get("u1")!.updateRequestedAt).not.toBeNull();
    expect(prisma._state.users.get("u2")!.updateRequestedAt).toBeNull();

    const all = await svc.requestUpdate({ all: true });
    expect(all.affected).toBe(2); // u3 inactive → skipped
    expect(prisma._state.users.get("u2")!.updateRequestedAt).not.toBeNull();
    expect(prisma._state.users.get("u3")!.updateRequestedAt).toBeNull();
  });
});
