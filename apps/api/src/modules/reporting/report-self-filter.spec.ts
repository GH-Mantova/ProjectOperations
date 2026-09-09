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
 * Test idiom: plain mock objects with jest.fn(), co-located, no @prisma/client
 * dependency — matches estimating-analytics-report.definitions.spec.ts.
 */

import { resolveSelfFilter } from "./report-self-filter";
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

// ── resolveSelfFilter — four branches ────────────────────────────────────────

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
