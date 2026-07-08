import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const THROTTLE_WINDOW_MS = 60_000;
const UNKNOWN = "unknown";
const UA_MAX = 512;

type CachedUserState = {
  updateRequested: boolean;
  checkedAt: number;
};

@Injectable()
export class ClientVersionsService {
  private readonly lastWriteAt = new Map<string, number>();
  private readonly userStateCache = new Map<string, CachedUserState>();

  constructor(private readonly prisma: PrismaService) {}

  serverVersion(): string {
    return process.env.GIT_SHA ?? "dev";
  }

  /**
   * Throttled: at most one DB write per (userId, clientVersion) per THROTTLE_WINDOW_MS.
   * Returns { skipped } and the cached "update requested" flag for header emission.
   */
  async recordSighting(
    userId: string,
    clientVersion: string | undefined,
    userAgent: string | undefined
  ): Promise<{ skipped: boolean; updateRequested: boolean }> {
    const version = (clientVersion ?? UNKNOWN).slice(0, 128) || UNKNOWN;
    const ua = userAgent ? userAgent.slice(0, UA_MAX) : null;
    const key = `${userId}::${version}`;
    const now = Date.now();
    const last = this.lastWriteAt.get(key);

    if (last !== undefined && now - last < THROTTLE_WINDOW_MS) {
      const cached = this.userStateCache.get(userId);
      const updateRequested = cached ? cached.updateRequested && version !== this.serverVersion() : false;
      return { skipped: true, updateRequested };
    }
    this.lastWriteAt.set(key, now);

    await this.prisma.clientSession.upsert({
      where: { userId_clientVersion: { userId, clientVersion: version } },
      create: { userId, clientVersion: version, userAgent: ua },
      update: { lastSeenAt: new Date(), userAgent: ua ?? undefined }
    });

    let updateRequestedAt: Date | null = null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { updateRequestedAt: true }
    });
    updateRequestedAt = user?.updateRequestedAt ?? null;

    // Auto-clear the nudge when the client reports the current server SHA.
    if (updateRequestedAt && version === this.serverVersion() && version !== UNKNOWN && version !== "dev") {
      await this.prisma.user.updateMany({
        where: { id: userId, updateRequestedAt: { not: null } },
        data: { updateRequestedAt: null }
      });
      updateRequestedAt = null;
    }

    const updateRequested = updateRequestedAt !== null && version !== this.serverVersion();
    this.userStateCache.set(userId, { updateRequested: updateRequestedAt !== null, checkedAt: now });
    return { skipped: false, updateRequested };
  }

  async list() {
    const serverSha = this.serverVersion();
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        updateRequestedAt: true,
        clientSessions: {
          orderBy: { lastSeenAt: "desc" },
          take: 1,
          select: { clientVersion: true, lastSeenAt: true, userAgent: true }
        }
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    });

    return {
      serverVersion: serverSha,
      users: users.map((u) => {
        const latest = u.clientSessions[0] ?? null;
        const clientVersion = latest?.clientVersion ?? null;
        const behind = clientVersion !== null && clientVersion !== serverSha;
        return {
          userId: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          clientVersion,
          lastSeenAt: latest?.lastSeenAt ?? null,
          userAgent: latest?.userAgent ?? null,
          behind,
          updateRequestedAt: u.updateRequestedAt
        };
      })
    };
  }

  async requestUpdate(params: { userId?: string; all?: boolean }): Promise<{ affected: number }> {
    const now = new Date();
    if (params.all) {
      const res = await this.prisma.user.updateMany({
        where: { isActive: true },
        data: { updateRequestedAt: now }
      });
      this.userStateCache.clear();
      return { affected: res.count };
    }
    if (!params.userId) return { affected: 0 };
    const res = await this.prisma.user.updateMany({
      where: { id: params.userId },
      data: { updateRequestedAt: now }
    });
    this.userStateCache.delete(params.userId);
    return { affected: res.count };
  }

  /** Test hook only. */
  __resetForTests() {
    this.lastWriteAt.clear();
    this.userStateCache.clear();
  }
}
