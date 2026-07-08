import { describe, expect, it } from "vitest";
import {
  assetsByStatus,
  countPendingLeave,
  currentWeekBounds,
  daysSinceIncident,
  overlapsWindow,
  shapeActivity,
  summariseXeroHealth,
  topProjectsByHours,
  whoIsAwayThisWeek
} from "../batch1.helpers";

const NOW = new Date("2026-07-08T09:00:00Z"); // a Wednesday

describe("daysSinceIncident", () => {
  it("returns null when no date supplied", () => {
    expect(daysSinceIncident(null, NOW)).toBeNull();
    expect(daysSinceIncident(undefined, NOW)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(daysSinceIncident("not-a-date", NOW)).toBeNull();
  });

  it("counts whole days elapsed", () => {
    expect(daysSinceIncident("2026-07-01T09:00:00Z", NOW)).toBe(7);
    expect(daysSinceIncident("2026-07-08T08:00:00Z", NOW)).toBe(0);
  });

  it("clamps future dates to 0 instead of a negative number", () => {
    expect(daysSinceIncident("2026-07-09T09:00:00Z", NOW)).toBe(0);
  });
});

describe("overlapsWindow", () => {
  const start = new Date("2026-07-08T00:00:00Z");
  const end = new Date("2026-07-15T00:00:00Z");
  it("detects overlap on the boundary", () => {
    expect(overlapsWindow("2026-07-15T00:00:00Z", "2026-07-20T00:00:00Z", start, end)).toBe(true);
  });
  it("returns false for ranges entirely before the window", () => {
    expect(overlapsWindow("2026-07-01T00:00:00Z", "2026-07-05T00:00:00Z", start, end)).toBe(false);
  });
  it("returns false for ranges entirely after the window", () => {
    expect(overlapsWindow("2026-08-01T00:00:00Z", "2026-08-05T00:00:00Z", start, end)).toBe(false);
  });
});

describe("whoIsAwayThisWeek", () => {
  const worker = { id: "w1", firstName: "Ada", lastName: "Lovelace" };
  const worker2 = { id: "w2", firstName: "Grace", lastName: "Hopper" };

  it("filters to APPROVED leave overlapping the next 7 days", () => {
    const leaves = [
      {
        id: "l1",
        status: "APPROVED",
        leaveType: "ANNUAL",
        startDate: "2026-07-09",
        endDate: "2026-07-11",
        workerProfile: worker
      },
      {
        id: "l2",
        status: "PENDING",
        leaveType: "ANNUAL",
        startDate: "2026-07-09",
        endDate: "2026-07-11",
        workerProfile: worker
      },
      {
        id: "l3",
        status: "APPROVED",
        leaveType: "SICK",
        startDate: "2026-08-01",
        endDate: "2026-08-05",
        workerProfile: worker
      }
    ];
    const rows = whoIsAwayThisWeek(leaves, [], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].workerName).toBe("Ada Lovelace");
    expect(rows[0].reason).toBe("Annual");
    expect(rows[0].kind).toBe("leave");
  });

  it("includes unavailability blocks that overlap the window", () => {
    const unavail = [
      {
        id: "u1",
        reason: "Training",
        startDate: "2026-07-10",
        endDate: "2026-07-10",
        workerProfile: worker2
      }
    ];
    const rows = whoIsAwayThisWeek([], unavail, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("unavailability");
    expect(rows[0].workerName).toBe("Grace Hopper");
  });

  it("skips rows with no worker profile", () => {
    const rows = whoIsAwayThisWeek(
      [
        {
          id: "l1",
          status: "APPROVED",
          leaveType: "ANNUAL",
          startDate: "2026-07-09",
          endDate: "2026-07-11",
          workerProfile: null
        }
      ],
      [],
      NOW
    );
    expect(rows).toHaveLength(0);
  });
});

describe("countPendingLeave", () => {
  it("returns 0 when nothing is pending", () => {
    expect(countPendingLeave([])).toEqual({ count: 0, oldestRequestDate: null });
  });
  it("counts PENDING rows and picks the earliest start date as oldest", () => {
    const rows = countPendingLeave([
      { id: "a", status: "PENDING", leaveType: "ANNUAL", startDate: "2026-06-10", endDate: "2026-06-12" },
      { id: "b", status: "APPROVED", leaveType: "ANNUAL", startDate: "2026-05-01", endDate: "2026-05-02" },
      { id: "c", status: "PENDING", leaveType: "SICK", startDate: "2026-05-20", endDate: "2026-05-21" }
    ]);
    expect(rows).toEqual({ count: 2, oldestRequestDate: "2026-05-20" });
  });
});

describe("topProjectsByHours", () => {
  it("sorts by total hours desc and caps to the given limit", () => {
    const rows = topProjectsByHours(
      [
        { projectId: "1", projectNumber: "P-1", projectName: "Alpha", totalHours: 4, timesheetCount: 1 },
        { projectId: "2", projectNumber: "P-2", projectName: "Beta", totalHours: 12, timesheetCount: 3 },
        { projectId: "3", projectNumber: "P-3", projectName: "Gamma", totalHours: 0, timesheetCount: 0 }
      ],
      2
    );
    expect(rows).toEqual([
      { label: "P-2", value: 12 },
      { label: "P-1", value: 4 }
    ]);
  });
  it("returns an empty array on nullish input", () => {
    expect(topProjectsByHours(null)).toEqual([]);
    expect(topProjectsByHours(undefined)).toEqual([]);
  });
});

describe("currentWeekBounds", () => {
  it("returns Monday 00:00 as the from date", () => {
    // 2026-07-08 is a Wednesday
    const { from, to } = currentWeekBounds(new Date("2026-07-08T09:00:00"));
    expect(from.getDay()).toBe(1);
    expect(from.getHours()).toBe(0);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });
  it("handles Sunday by rolling back to the previous Monday", () => {
    const { from } = currentWeekBounds(new Date("2026-07-12T15:00:00")); // Sunday
    expect(from.getDay()).toBe(1);
    expect(from.getDate()).toBe(6);
  });
});

describe("assetsByStatus", () => {
  it("aggregates counts by status and applies palette colours", () => {
    const points = assetsByStatus([
      { id: "1", status: "AVAILABLE" },
      { id: "2", status: "AVAILABLE" },
      { id: "3", status: "DOWN" },
      { id: "4", status: "IN_USE" }
    ]);
    expect(points[0]).toEqual({ label: "Available", value: 2, color: "#22C55E" });
    const inUse = points.find((p) => p.label === "In Use");
    expect(inUse?.value).toBe(1);
    expect(inUse?.color).toBe("#005B61");
  });
  it("returns an empty list for null input", () => {
    expect(assetsByStatus(null)).toEqual([]);
  });
});

describe("summariseXeroHealth", () => {
  it("reports muted state when the status is missing", () => {
    expect(summariseXeroHealth(null, [], NOW).tone).toBe("muted");
    expect(summariseXeroHealth({ connected: false }, [], NOW).tone).toBe("muted");
  });

  it("marks danger when the latest sync log is ERROR", () => {
    const health = summariseXeroHealth(
      {
        connected: true,
        tenantId: "t",
        tenantName: "Initial",
        expiresAt: new Date(NOW.getTime() + 3600_000 * 48).toISOString(),
        scopes: [],
        connectedAt: NOW.toISOString()
      },
      [
        {
          id: "l",
          status: "ERROR",
          entityType: "invoice",
          createdAt: new Date(NOW.getTime() - 60_000).toISOString(),
          errorText: "Boom"
        }
      ],
      NOW
    );
    expect(health.tone).toBe("danger");
    expect(health.headline).toMatch(/failed/i);
  });

  it("warns when the token is inside the 24-hour expiry window", () => {
    const health = summariseXeroHealth(
      {
        connected: true,
        tenantId: "t",
        tenantName: "Initial",
        expiresAt: new Date(NOW.getTime() + 3600_000).toISOString(),
        scopes: [],
        connectedAt: NOW.toISOString()
      },
      [],
      NOW
    );
    expect(health.tone).toBe("warning");
  });

  it("reports OK when connected and the latest sync succeeded", () => {
    const health = summariseXeroHealth(
      {
        connected: true,
        tenantId: "t",
        tenantName: "Initial",
        expiresAt: new Date(NOW.getTime() + 3600_000 * 48).toISOString(),
        scopes: [],
        connectedAt: NOW.toISOString()
      },
      [
        {
          id: "l",
          status: "OK",
          entityType: "contact",
          createdAt: new Date(NOW.getTime() - 60_000 * 10).toISOString()
        }
      ],
      NOW
    );
    expect(health.tone).toBe("ok");
  });
});

describe("shapeActivity", () => {
  it("shapes audit rows into who/what/when and caps to the limit", () => {
    const rows = shapeActivity(
      [
        {
          id: "1",
          action: "tender.updated",
          entityType: "Tender",
          entityId: "t-1",
          createdAt: new Date(NOW.getTime() - 60_000).toISOString(),
          actor: { id: "u", firstName: "Ada", lastName: "Lovelace", email: "a@x" }
        },
        {
          id: "2",
          action: "user.created",
          entityType: "User",
          entityId: null,
          createdAt: new Date(NOW.getTime() - 3600_000).toISOString(),
          actor: null
        }
      ],
      1
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].who).toBe("Ada Lovelace");
    expect(rows[0].what).toContain("updated");
    expect(rows[0].what).toContain("tender");
  });
  it("labels missing actor as System", () => {
    const rows = shapeActivity([
      {
        id: "1",
        action: "job.deleted",
        entityType: "Job",
        entityId: null,
        createdAt: new Date().toISOString(),
        actor: null
      }
    ]);
    expect(rows[0].who).toBe("System");
  });
});
