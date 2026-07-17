import { NotFoundException } from "@nestjs/common";
import { ScheduleAllocationService } from "../schedule-allocation.service";
import {
  SchedulerSuggestionService,
  haversineKm,
  proximityScoreForKm
} from "../suggestion.service";

/**
 * Suggest engine (D365 Field Service RSO parity, phase 1).
 *
 * The engine is assistive — asserts here focus on:
 *   • scoring composition (roleFit + availability + proximity)
 *   • reasons list stays machine-parseable
 *   • proximity is neutral when either coord is missing
 *   • ineligible workers are excluded by default and included behind the flag
 */

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    project: { findUnique: jest.fn() },
    jobRole: { findUnique: jest.fn().mockResolvedValue({ id: "role-1" }) },
    workerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    scheduleAllocation: {
      findMany: jest.fn().mockResolvedValue([])
    },
    asset: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides
  } as never;
}

function allocationsMock(eligible = true, reasons: string[] = []) {
  return {
    computeEligibility: jest.fn().mockResolvedValue({ eligible, reasons })
  } as unknown as ScheduleAllocationService;
}

const BRISBANE = { lat: -27.4698, lng: 153.0251 };
const IPSWICH = { lat: -27.6146, lng: 152.7609 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };

describe("haversineKm", () => {
  it("returns ~35km Brisbane→Ipswich", () => {
    const km = haversineKm(BRISBANE, IPSWICH);
    expect(km).toBeGreaterThan(25);
    expect(km).toBeLessThan(45);
  });

  it("returns ~730km Brisbane→Sydney", () => {
    const km = haversineKm(BRISBANE, SYDNEY);
    expect(km).toBeGreaterThan(700);
    expect(km).toBeLessThan(800);
  });
});

describe("proximityScoreForKm", () => {
  it("awards max for adjacent sites (≤15km)", () => {
    expect(proximityScoreForKm(5, "2026-07-10").score).toBe(30);
  });

  it("awards mid-tier for same-metro (≤40km)", () => {
    expect(proximityScoreForKm(30, "2026-07-10").score).toBe(20);
  });

  it("awards low for cross-region (≤100km)", () => {
    expect(proximityScoreForKm(80, "2026-07-10").score).toBe(10);
  });

  it("awards minimum for interstate", () => {
    expect(proximityScoreForKm(700, "2026-07-10").score).toBe(5);
  });
});

describe("SchedulerSuggestionService.suggestAllocation", () => {
  const date = "2026-07-10";

  it("404s when the project is missing", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({ project: { findUnique: jest.fn().mockResolvedValue(null) } }),
      allocationsMock()
    );
    await expect(
      svc.suggestAllocation({ date, projectId: "p-missing" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("404s when the jobRole is missing", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({
        project: {
          findUnique: jest.fn().mockResolvedValue({ id: "p-1", site: null })
        },
        jobRole: { findUnique: jest.fn().mockResolvedValue(null) }
      }),
      allocationsMock()
    );
    await expect(
      svc.suggestAllocation({ date, projectId: "p-1", jobRoleId: "role-x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("ranks eligible workers with a full-score row and no blockers", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({
        project: {
          findUnique: jest.fn().mockResolvedValue({
            id: "p-1",
            site: { id: "s-1", centreLat: BRISBANE.lat, centreLng: BRISBANE.lng }
          })
        },
        workerProfile: {
          findMany: jest.fn().mockResolvedValue([
            { id: "w-1", firstName: "Alex", lastName: "Zee", role: "Labourer" }
          ])
        },
        scheduleAllocation: {
          findMany: jest.fn().mockResolvedValue([
            {
              date: new Date("2026-07-05T00:00:00.000Z"),
              project: {
                projectNumber: "P-100",
                site: { centreLat: BRISBANE.lat + 0.01, centreLng: BRISBANE.lng + 0.01 }
              }
            }
          ])
        }
      }),
      allocationsMock(true, [])
    );

    const out = await svc.suggestAllocation({ date, projectId: "p-1", jobRoleId: "role-1" });
    expect(out.suggestions).toHaveLength(1);
    const s = out.suggestions[0]!;
    expect(s.targetType).toBe("WORKER");
    expect(s.eligible).toBe(true);
    expect(s.breakdown.roleFit).toBe(40);
    expect(s.breakdown.availability).toBe(30);
    expect(s.breakdown.proximity).toBe(30);
    expect(s.score).toBe(100);
    expect(s.reasons).toContain("roleFit:met");
    expect(s.reasons).toContain("availability:free");
    expect(s.reasons.some((r) => r.startsWith("proximity:km="))).toBe(true);
  });

  it("filters ineligible workers by default", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({
        project: {
          findUnique: jest.fn().mockResolvedValue({ id: "p-1", site: null })
        },
        workerProfile: {
          findMany: jest.fn().mockResolvedValue([
            { id: "w-1", firstName: "A", lastName: "One", role: null }
          ])
        }
      }),
      allocationsMock(false, ["missing:asbestos_a"])
    );

    const out = await svc.suggestAllocation({ date, projectId: "p-1", jobRoleId: "role-1" });
    expect(out.suggestions).toHaveLength(0);
  });

  it("returns ineligible workers when includeIneligible=true, with blocker reasons", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({
        project: {
          findUnique: jest.fn().mockResolvedValue({ id: "p-1", site: null })
        },
        workerProfile: {
          findMany: jest.fn().mockResolvedValue([
            { id: "w-1", firstName: "A", lastName: "One", role: null }
          ])
        }
      }),
      allocationsMock(false, ["missing:asbestos_a", "on_leave:ANNUAL"])
    );

    const out = await svc.suggestAllocation({
      date,
      projectId: "p-1",
      jobRoleId: "role-1",
      includeIneligible: true
    });
    expect(out.suggestions).toHaveLength(1);
    const s = out.suggestions[0]!;
    expect(s.eligible).toBe(false);
    expect(s.breakdown.roleFit).toBe(0);
    expect(s.breakdown.availability).toBe(0);
    expect(s.reasons).toContain("blocker:missing:asbestos_a");
    expect(s.reasons).toContain("blocker:on_leave:ANNUAL");
  });

  it("uses a neutral proximity score when the project has no coords", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({
        project: {
          findUnique: jest.fn().mockResolvedValue({ id: "p-1", site: null })
        },
        workerProfile: {
          findMany: jest.fn().mockResolvedValue([
            { id: "w-1", firstName: "A", lastName: "One", role: null }
          ])
        }
      }),
      allocationsMock(true, [])
    );

    const out = await svc.suggestAllocation({ date, projectId: "p-1" });
    const s = out.suggestions[0]!;
    expect(s.breakdown.proximity).toBe(15);
    expect(s.reasons).toContain("proximity:project_no_coords");
  });

  it("respects the limit and orders by score desc", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({
        project: {
          findUnique: jest.fn().mockResolvedValue({ id: "p-1", site: null })
        },
        workerProfile: {
          findMany: jest.fn().mockResolvedValue([
            { id: "w-a", firstName: "A", lastName: "A", role: null },
            { id: "w-b", firstName: "B", lastName: "B", role: null },
            { id: "w-c", firstName: "C", lastName: "C", role: null }
          ])
        }
      }),
      allocationsMock(true, [])
    );

    const out = await svc.suggestAllocation({ date, projectId: "p-1", limit: 2 });
    expect(out.suggestions).toHaveLength(2);
    // All three are equally scored; verify limit + deterministic tie-break by lastName
    expect(out.suggestions.map((s) => (s.targetType === "WORKER" ? s.worker.id : ""))).toEqual([
      "w-a",
      "w-b"
    ]);
  });

  it("suggests available assets and excludes double-booked ones", async () => {
    const svc = new SchedulerSuggestionService(
      prismaMock({
        project: {
          findUnique: jest.fn().mockResolvedValue({ id: "p-1", site: null })
        },
        asset: {
          findMany: jest.fn().mockResolvedValue([
            { id: "a-1", name: "Excavator 1", assetCode: "EX01" },
            { id: "a-2", name: "Excavator 2", assetCode: "EX02" }
          ])
        },
        scheduleAllocation: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ assetId: "a-1", projectId: "p-other" }])
        }
      }),
      allocationsMock()
    );

    const out = await svc.suggestAllocation({
      date,
      projectId: "p-1",
      targetType: "ASSET"
    });
    expect(out.suggestions).toHaveLength(1);
    const s = out.suggestions[0]!;
    expect(s.targetType).toBe("ASSET");
    if (s.targetType === "ASSET") expect(s.asset.id).toBe("a-2");
    expect(s.eligible).toBe(true);
  });
});
