// Mock-based unit tests for ApprovalsService — the two paths this slice
// is required to prove:
//
//   1. record-decision routes through AuthorityService.check (open-ceiling
//      by default; refuses APPROVED when the seam bounds the amount)
//   2. overrule enforces "senior in the managerId chain" and cannot
//      overrule your own decision or an already-overruled one
//
// The Prisma layer is stubbed so the tests stay in-memory and fast.

import { ApprovalsService } from "../approvals.service";

interface DecisionRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  amount: number | null;
  decision: "APPROVED" | "REJECTED" | "OVERRULED";
  reason: string | null;
  decidedById: string;
  overrulesId: string | null;
  authorityRuleId: string | null;
  createdAt: Date;
}

interface NotificationRow {
  userId: string;
  title: string;
  body: string;
  severity: string;
  metadata: Record<string, unknown>;
}

function buildPrisma(users: Record<string, { managerId: string | null }>) {
  const decisions: DecisionRow[] = [];
  const notifications: NotificationRow[] = [];

  const prisma = {
    approvalDecision: {
      create: jest.fn(async ({ data }: { data: Partial<DecisionRow> }) => {
        const row: DecisionRow = {
          id: data.id ?? `dec-${decisions.length + 1}`,
          entityType: data.entityType!,
          entityId: data.entityId!,
          action: data.action!,
          amount: (data.amount as number | null) ?? null,
          decision: data.decision!,
          reason: data.reason ?? null,
          decidedById: data.decidedById!,
          overrulesId: data.overrulesId ?? null,
          authorityRuleId: data.authorityRuleId ?? null,
          createdAt: new Date()
        };
        decisions.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return decisions.find((row) => row.id === where.id) ?? null;
      }),
      findMany: jest.fn(async () => decisions),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<DecisionRow> }) => {
        const row = decisions.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      })
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const u = users[where.id];
        return u ? { managerId: u.managerId } : null;
      })
    },
    notification: {
      create: jest.fn(async ({ data }: { data: NotificationRow }) => {
        notifications.push(data);
        return { id: `notif-${notifications.length}`, ...data };
      })
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
  };

  return { prisma, decisions, notifications };
}

function makeService(
  prisma: unknown,
  authorityDecision: {
    allowed: boolean;
    requiresEscalation: boolean;
    escalateToUserId?: string;
    matchedRuleId?: string;
  }
) {
  const authority = {
    check: jest.fn().mockResolvedValue(authorityDecision)
  };
  return {
    service: new ApprovalsService(prisma as never, authority as never),
    authority
  };
}

describe("ApprovalsService.recordDecision", () => {
  it("open-ceiling seam: APPROVED goes through and no rule id is captured", async () => {
    const { prisma } = buildPrisma({});
    const { service, authority } = makeService(prisma, {
      allowed: true,
      requiresEscalation: false
    });

    const decision = await service.recordDecision(
      {
        entityType: "Tender",
        entityId: "tender-1",
        action: "procurement.purchase.approve",
        amount: 250,
        decision: "APPROVED"
      },
      "user-actor"
    );

    expect(authority.check).toHaveBeenCalledWith({
      userId: "user-actor",
      action: "procurement.purchase.approve",
      amount: 250
    });
    expect(decision.decision).toBe("APPROVED");
    expect(decision.authorityRuleId).toBeNull();
    expect(decision.decidedById).toBe("user-actor");
  });

  it("seam refuses APPROVED over cap → ForbiddenException, nothing written", async () => {
    const { prisma, decisions } = buildPrisma({});
    const { service } = makeService(prisma, {
      allowed: false,
      requiresEscalation: true,
      matchedRuleId: "rule-cap-500",
      escalateToUserId: "user-manager"
    });

    await expect(
      service.recordDecision(
        {
          entityType: "Tender",
          entityId: "tender-1",
          action: "procurement.purchase.approve",
          amount: 900,
          decision: "APPROVED"
        },
        "user-actor"
      )
    ).rejects.toThrow(/refused/);
    expect(decisions).toHaveLength(0);
  });

  it("REJECTED is written even when seam refuses, captures matched rule + notifies escalation target", async () => {
    const { prisma, decisions, notifications } = buildPrisma({});
    const { service } = makeService(prisma, {
      allowed: false,
      requiresEscalation: true,
      matchedRuleId: "rule-cap-500",
      escalateToUserId: "user-manager"
    });

    const decision = await service.recordDecision(
      {
        entityType: "Tender",
        entityId: "tender-1",
        action: "procurement.purchase.approve",
        amount: 900,
        decision: "REJECTED",
        reason: "Over cap"
      },
      "user-actor"
    );

    expect(decision.decision).toBe("REJECTED");
    expect(decision.authorityRuleId).toBe("rule-cap-500");
    expect(decisions).toHaveLength(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe("user-manager");
    expect(notifications[0].metadata.kind).toBe("APPROVAL_DECISION");
  });
});

describe("ApprovalsService.overrule", () => {
  const seed = async (prisma: ReturnType<typeof buildPrisma>["prisma"], decidedById: string) => {
    return prisma.approvalDecision.create({
      data: {
        id: "dec-prior",
        entityType: "Tender",
        entityId: "tender-1",
        action: "procurement.purchase.approve",
        amount: 200,
        decision: "APPROVED",
        reason: null,
        decidedById,
        overrulesId: null,
        authorityRuleId: null
      }
    });
  };

  it("senior in the managerId chain may overrule; fan-out reaches whole chain + prior decider (excl. overruler)", async () => {
    // chain: junior -> ops -> director
    const { prisma, decisions, notifications } = buildPrisma({
      junior: { managerId: "ops" },
      ops: { managerId: "director" },
      director: { managerId: null }
    });
    await seed(prisma, "junior");
    const { service } = makeService(prisma, {
      allowed: true,
      requiresEscalation: false
    });

    const override = await service.overrule(
      "dec-prior",
      { reason: "Policy correction" },
      "director"
    );

    expect(override.decision).toBe("APPROVED");
    expect(override.overrulesId).toBe("dec-prior");
    const prior = decisions.find((d) => d.id === "dec-prior")!;
    expect(prior.decision).toBe("OVERRULED");

    const notified = new Set(notifications.map((n) => n.userId));
    // The overruler (director) is excluded from fan-out; ops (in the chain
    // between prior decider and director) and the prior decider (junior)
    // are both notified.
    expect(notified.has("director")).toBe(false);
    expect(notified.has("ops")).toBe(true);
    expect(notified.has("junior")).toBe(true);
    for (const n of notifications) {
      expect(n.metadata.kind).toBe("APPROVAL_OVERRULE");
    }
  });

  it("non-senior cannot overrule (managerId chain enforcement)", async () => {
    const { prisma } = buildPrisma({
      junior: { managerId: "ops" },
      ops: { managerId: null },
      outsider: { managerId: null }
    });
    await seed(prisma, "junior");
    const { service } = makeService(prisma, {
      allowed: true,
      requiresEscalation: false
    });

    await expect(
      service.overrule("dec-prior", { reason: "no" }, "outsider")
    ).rejects.toThrow(/senior/i);
  });

  it("cannot overrule your own decision", async () => {
    const { prisma } = buildPrisma({
      junior: { managerId: null }
    });
    await seed(prisma, "junior");
    const { service } = makeService(prisma, {
      allowed: true,
      requiresEscalation: false
    });

    await expect(
      service.overrule("dec-prior", { reason: "self" }, "junior")
    ).rejects.toThrow(/own decision/);
  });

  it("cannot overrule an already-OVERRULED decision", async () => {
    const { prisma } = buildPrisma({
      junior: { managerId: "ops" },
      ops: { managerId: null }
    });
    const prior = await seed(prisma, "junior");
    prior.decision = "OVERRULED";
    const { service } = makeService(prisma, {
      allowed: true,
      requiresEscalation: false
    });

    await expect(
      service.overrule("dec-prior", { reason: "again" }, "ops")
    ).rejects.toThrow(/already/i);
  });
});
