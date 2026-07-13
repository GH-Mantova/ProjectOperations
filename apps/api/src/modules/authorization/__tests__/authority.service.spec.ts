// Mock-based unit tests for AuthorityService.check — the seam future
// approval / spend-limit consumers route through. Documents the default
// open-ceiling posture: no rule matches ⇒ allowed, no escalation.

import { ConflictException, NotFoundException } from "@nestjs/common";
import { AuthorityScopeType } from "@prisma/client";
import { AuthorityService } from "../authority.service";

interface RuleRow {
  id: string;
  scopeType: AuthorityScopeType;
  scopeId: string | null;
  action: string;
  limitAmount: unknown;
  escalateToUserId: string | null;
  enabled: boolean;
}

const rule = (over: Partial<RuleRow> = {}): RuleRow => ({
  id: "rule-1",
  scopeType: AuthorityScopeType.GLOBAL,
  scopeId: null,
  action: "procurement.purchase.approve",
  limitAmount: null,
  escalateToUserId: null,
  enabled: true,
  ...over
});

function buildService(rules: RuleRow[], roleIds: string[] = []) {
  const prisma: Record<string, unknown> = {
    authorityRule: {
      findMany: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        const or = (where.OR as Array<Record<string, unknown>> | undefined) ?? [];
        const filtered = rules.filter((row) => {
          if (row.action !== where.action) return false;
          if (row.enabled !== where.enabled) return false;
          return or.some((clause) => {
            if (clause.scopeType !== row.scopeType) return false;
            const scopeId = clause.scopeId as string | { in: string[] } | undefined;
            if (scopeId === undefined) return row.scopeId === null;
            if (typeof scopeId === "string") return row.scopeId === scopeId;
            return row.scopeId !== null && scopeId.in.includes(row.scopeId);
          });
        });
        return Promise.resolve(filtered);
      })
    },
    userRole: {
      findMany: jest.fn().mockResolvedValue(roleIds.map((roleId) => ({ roleId })))
    }
  };

  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  return new AuthorityService(prisma as never, audit as never);
}

function buildRemoveHarness(rule: RuleRow | null) {
  const prisma = {
    authorityRule: {
      findUnique: jest.fn().mockResolvedValue(rule),
      delete: jest.fn().mockResolvedValue({ id: rule?.id ?? "x" })
    }
  };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new AuthorityService(prisma as never, audit as never),
    prisma,
    audit
  };
}

describe("AuthorityService.check", () => {
  it("defaults to open ceiling when no rule matches", async () => {
    const service = buildService([]);
    const decision = await service.check({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 999999
    });
    expect(decision).toEqual({ allowed: true, requiresEscalation: false });
  });

  it("allows spend under a user-scoped limit and surfaces the matched rule", async () => {
    const service = buildService([
      rule({
        id: "rule-user",
        scopeType: AuthorityScopeType.USER,
        scopeId: "user-1",
        limitAmount: 500
      })
    ]);
    const decision = await service.check({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 250
    });
    expect(decision).toMatchObject({ allowed: true, matchedRuleId: "rule-user" });
  });

  it("flips to escalation when amount exceeds a user-scoped limit", async () => {
    const service = buildService([
      rule({
        id: "rule-user",
        scopeType: AuthorityScopeType.USER,
        scopeId: "user-1",
        limitAmount: 500,
        escalateToUserId: "director-1"
      })
    ]);
    const decision = await service.check({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 1500
    });
    expect(decision).toEqual({
      allowed: false,
      requiresEscalation: true,
      escalateToUserId: "director-1",
      matchedRuleId: "rule-user"
    });
  });

  it("prefers a user-scoped rule over a matching role-scoped rule", async () => {
    const service = buildService(
      [
        rule({
          id: "rule-role",
          scopeType: AuthorityScopeType.ROLE,
          scopeId: "role-1",
          limitAmount: 100
        }),
        rule({
          id: "rule-user",
          scopeType: AuthorityScopeType.USER,
          scopeId: "user-1",
          limitAmount: 10000
        })
      ],
      ["role-1"]
    );
    const decision = await service.check({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 5000
    });
    expect(decision).toMatchObject({ allowed: true, matchedRuleId: "rule-user" });
  });

  it("falls back to GLOBAL when no user or role rule matches", async () => {
    const service = buildService([
      rule({ id: "rule-global", scopeType: AuthorityScopeType.GLOBAL, limitAmount: 200 })
    ]);
    const decision = await service.check({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 250
    });
    expect(decision).toMatchObject({
      allowed: false,
      requiresEscalation: true,
      matchedRuleId: "rule-global"
    });
  });

  it("ignores disabled rules — they never match, even with the tightest scope", async () => {
    const service = buildService([
      rule({
        id: "rule-user-disabled",
        scopeType: AuthorityScopeType.USER,
        scopeId: "user-1",
        limitAmount: 10,
        enabled: false
      })
    ]);
    const decision = await service.check({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 100000
    });
    expect(decision).toEqual({ allowed: true, requiresEscalation: false });
  });

  it("remove refuses an enabled rule with 409 and never deletes", async () => {
    const { service, prisma, audit } = buildRemoveHarness(
      rule({ id: "rule-live", enabled: true })
    );
    await expect(service.remove("rule-live", "actor-1")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.authorityRule.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("remove throws NotFound when the rule does not exist", async () => {
    const { service } = buildRemoveHarness(null);
    await expect(service.remove("missing", "actor-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("remove hard-deletes a disabled rule and writes an audit row with the payload", async () => {
    const { service, prisma, audit } = buildRemoveHarness(
      rule({
        id: "rule-off",
        enabled: false,
        limitAmount: null,
        scopeType: AuthorityScopeType.USER,
        scopeId: "user-9",
        escalateToUserId: "director-9"
      })
    );
    await expect(service.remove("rule-off", "actor-1")).resolves.toEqual({ id: "rule-off" });
    expect(prisma.authorityRule.delete).toHaveBeenCalledWith({ where: { id: "rule-off" } });
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        action: "authorityRule.delete",
        entityType: "AuthorityRule",
        entityId: "rule-off",
        metadata: expect.objectContaining({
          scopeType: AuthorityScopeType.USER,
          scopeId: "user-9",
          escalateToUserId: "director-9",
          enabled: false
        })
      })
    );
  });

  it("returns escalateToUserId undefined when the matched rule has no escalation target", async () => {
    const service = buildService([
      rule({
        id: "rule-user",
        scopeType: AuthorityScopeType.USER,
        scopeId: "user-1",
        limitAmount: 500
      })
    ]);
    const decision = await service.check({
      userId: "user-1",
      action: "procurement.purchase.approve",
      amount: 1500
    });
    expect(decision).toMatchObject({
      allowed: false,
      requiresEscalation: true,
      matchedRuleId: "rule-user"
    });
    expect(decision.escalateToUserId).toBeUndefined();
  });
});
