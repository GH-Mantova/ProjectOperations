/**
 * report-self-filter.spec.ts
 *
 * Unit tests for the EA-GATE resolveSelfFilter helper and the two regressions
 * it was introduced to fix:
 *
 *   Manager regression: a non-super-user holding reporting.team must NOT be
 *     self-filtered. The old selfFilterClause tested isSuperUser only — an
 *     estimating manager (isSuperUser=false) was always self-filtered even
 *     though she is the intended audience of these reports.
 *
 *   Exposure regression: tender-win-rate in reporting.service.ts had no
 *     self-filter at all — it returned every estimator's individual win rate
 *     to anyone holding reporting.view. resolveSelfFilter must be spread into
 *     its where clause; this test fails if the spread is removed.
 *
 *   Delivery-mechanism guard: production deploys with `prisma migrate deploy`
 *     and never runs the TS seed, so reporting.team is granted to no role on
 *     the first deploy. Team visibility therefore keys off TEAM_VISIBILITY_CODES,
 *     which also accepts tenders.allocate — a code production already has on
 *     exactly the manager roles we mean. The guard fails if anyone narrows the
 *     helper back to reporting.team alone without landing a real migration first.
 *
 * Test idiom: plain mock objects with jest.fn(), co-located, no @prisma/client
 * dependency — matches estimating-analytics-report.definitions.spec.ts.
 */

import { resolveSelfFilter, TEAM_VISIBILITY_CODES } from "./report-self-filter";
import { ReportingService } from "./reporting.service";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";

// ── Helpers ──────────────────────────────────────────────────────────────────

function noUser(): { currentUser?: AuthenticatedUser } {
  return {};
}

function superUser(): { currentUser: AuthenticatedUser } {
  return { currentUser: { sub: "su-1", email: "su@test.com", permissions: ["reporting.view"], isSuperUser: true } };
}

function teamManager(): { currentUser: AuthenticatedUser } {
  return {
    currentUser: {
      sub: "mgr-1",
      email: "manager@test.com",
      permissions: ["reporting.view", "reporting.team"],
      isSuperUser: false
    }
  };
}

// Manager-shaped role as it actually exists in production TODAY: holds
// tenders.allocate, does NOT hold the brand-new reporting.team code.
// This is the delivery-mechanism guard — see below.
function allocateManager(): { currentUser: AuthenticatedUser } {
  return {
    currentUser: {
      sub: "alloc-1",
      email: "allocator@test.com",
      permissions: ["reporting.view", "tenders.allocate"],
      isSuperUser: false
    }
  };
}

function plainEstimator(sub = "est-1"): { currentUser: AuthenticatedUser } {
  return {
    currentUser: {
      sub,
      email: `${sub}@test.com`,
      permissions: ["reporting.view"],
      isSuperUser: false
    }
  };
}

// ── resolveSelfFilter — branch coverage ──────────────────────────────────────

describe("resolveSelfFilter", () => {
  it("no currentUser (internal/seed/test call) → {}", () => {
    expect(resolveSelfFilter(noUser())).toEqual({});
  });

  it("super-user → {}", () => {
    expect(resolveSelfFilter(superUser())).toEqual({});
  });

  it("holds reporting.team (manager) → {} [manager regression]", () => {
    // This is the manager regression guard.
    // The old code tested !isSuperUser only — a manager (isSuperUser=false) who
    // holds reporting.team was incorrectly self-filtered. This test MUST fail if
    // the helper reverts to testing isSuperUser without checking reporting.team.
    expect(resolveSelfFilter(teamManager())).toEqual({});
  });

  it("holds only reporting.view (plain estimator) → { assignedEstimatorId: sub }", () => {
    expect(resolveSelfFilter(plainEstimator("est-99"))).toEqual({
      assignedEstimatorId: "est-99"
    });
  });

  it("holds tenders.allocate but NOT reporting.team → {} [delivery-mechanism guard]", () => {
    // This is the guard that keeps EA-GATE deliverable.
    //
    // Production deploys with `prisma migrate deploy` and never runs the TS
    // seed, so reporting.team is granted to NO role on the first deploy. If
    // reporting.team were the only code that unlocked the team rollup, every
    // estimating manager would silently drop to self-view while Admin kept
    // visibility through admin-all-permissions.
    //
    // tenders.allocate already exists in production and is already held by
    // exactly the manager roles we mean, so it is a member of
    // TEAM_VISIBILITY_CODES. This test MUST fail if someone narrows the helper
    // back to reporting.team alone without first landing a real migration that
    // grants reporting.team to allocate-holding roles.
    expect(resolveSelfFilter(allocateManager())).toEqual({});
  });

  it("TEAM_VISIBILITY_CODES contains both codes, and each one alone is sufficient", () => {
    expect([...TEAM_VISIBILITY_CODES]).toEqual(
      expect.arrayContaining(["reporting.team", "tenders.allocate"])
    );
    for (const code of TEAM_VISIBILITY_CODES) {
      expect(
        resolveSelfFilter({
          // SelfFilterParams.currentUser is a Pick<> — sub / isSuperUser /
          // permissions only. No email here or excess-property checking fails.
          currentUser: {
            sub: "solo-1",
            permissions: ["reporting.view", code],
            isSuperUser: false
          }
        })
      ).toEqual({});
    }
  });
});

// ── Exposure regression: tender-win-rate self-filter reaches its where ────────
//
// Before EA-GATE, tender-win-rate in reporting.service.ts built its where with
// no user clause at all. This test calls the service and inspects the Prisma
// findMany call to assert that the self-filter clause is present for a plain
// estimator. It FAILS if the spread of resolveSelfFilter is removed from
// tender-win-rate's run().

describe("tender-win-rate exposure regression", () => {
  function makePrisma(tenderRows: object[] = []) {
    return {
      tender: {
        findMany: jest.fn().mockResolvedValue(tenderRows)
      }
    };
  }

  it("plain estimator: assignedEstimatorId self-filter is present in tender-win-rate where", async () => {
    const mockPrisma = makePrisma([]);
    const svc = new ReportingService(mockPrisma as never);

    await svc.run("tender-win-rate", plainEstimator("est-exposure").currentUser
      ? { currentUser: plainEstimator("est-exposure").currentUser }
      : {});

    const callArg = (mockPrisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { assignedEstimatorId?: string };
    };
    // This assertion fails if the spread is removed from tender-win-rate's where.
    expect(callArg.where.assignedEstimatorId).toBe("est-exposure");
  });

  it("team manager: no assignedEstimatorId in tender-win-rate where", async () => {
    const mockPrisma = makePrisma([]);
    const svc = new ReportingService(mockPrisma as never);

    await svc.run("tender-win-rate", { currentUser: teamManager().currentUser });

    const callArg = (mockPrisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { assignedEstimatorId?: string };
    };
    expect(callArg.where.assignedEstimatorId).toBeUndefined();
  });
});
