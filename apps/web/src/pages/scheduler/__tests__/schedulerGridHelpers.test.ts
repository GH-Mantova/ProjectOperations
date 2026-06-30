import { describe, expect, it } from "vitest";
import {
  addDaysUtc,
  emptyCellAmber,
  groupByJob,
  groupByResource,
  indexCells,
  isoDay,
  isSameUtcDay,
  isWeekend,
  startOfWeekUtc,
  visibleRange,
  workerDayMap,
  type GridCell
} from "../schedulerGridHelpers";

function mkCell(partial: Partial<GridCell> & { date: string; projectId: string }): GridCell {
  return {
    id: `c-${partial.date}-${partial.projectId}-${partial.workerProfileId ?? "na"}`,
    targetType: "WORKER",
    workerProfileId: null,
    assetId: null,
    jobRoleId: null,
    note: null,
    overrideReason: null,
    conflict: "none",
    project: { id: partial.projectId, projectNumber: `P-${partial.projectId}`, name: `Project ${partial.projectId}` },
    workerProfile: partial.workerProfileId
      ? { id: partial.workerProfileId, firstName: "Wf", lastName: "Wl", role: null }
      : null,
    asset: partial.assetId ? { id: partial.assetId, name: "Asset", assetCode: "A1" } : null,
    jobRole: null,
    ...partial
  };
}

describe("schedulerGridHelpers", () => {
  it("isoDay round-trips through UTC", () => {
    const d = new Date(Date.UTC(2026, 6, 1));
    expect(isoDay(d)).toBe("2026-07-01");
  });

  it("startOfWeekUtc snaps to Monday", () => {
    // Sunday Jan 4 2026 → Monday Dec 29 2025
    const sun = new Date(Date.UTC(2026, 0, 4));
    const mon = startOfWeekUtc(sun);
    expect(isoDay(mon)).toBe("2025-12-29");
  });

  it("visibleRange month pads to whole weeks Mon..Sun", () => {
    const cursor = new Date(Date.UTC(2026, 1, 15)); // mid-Feb 2026
    const { days } = visibleRange("month", cursor);
    expect(days.length % 7).toBe(0);
    expect(days[0]!.getUTCDay()).toBe(1); // Monday
    expect(days[days.length - 1]!.getUTCDay()).toBe(0); // Sunday
  });

  it("visibleRange week returns 7 days", () => {
    const cursor = new Date(Date.UTC(2026, 5, 24));
    const { days } = visibleRange("week", cursor);
    expect(days).toHaveLength(7);
  });

  it("isWeekend flags Sat/Sun only", () => {
    expect(isWeekend(new Date(Date.UTC(2026, 5, 27)))).toBe(true); // Sat
    expect(isWeekend(new Date(Date.UTC(2026, 5, 28)))).toBe(true); // Sun
    expect(isWeekend(new Date(Date.UTC(2026, 5, 29)))).toBe(false); // Mon
  });

  it("isSameUtcDay ignores time", () => {
    const a = new Date(Date.UTC(2026, 0, 1, 10, 0));
    const b = new Date(Date.UTC(2026, 0, 1, 23, 59));
    expect(isSameUtcDay(a, b)).toBe(true);
  });

  it("groupByJob groups cells by project with worker rows", () => {
    const cells = [
      mkCell({ date: "2026-07-01", projectId: "p1", workerProfileId: "w1" }),
      mkCell({ date: "2026-07-02", projectId: "p1", workerProfileId: "w2" }),
      mkCell({ date: "2026-07-01", projectId: "p2", workerProfileId: "w1" })
    ];
    const groups = groupByJob(cells);
    expect(groups.map((g) => g.groupId).sort()).toEqual(["p1", "p2"]);
    const p1 = groups.find((g) => g.groupId === "p1")!;
    expect(p1.rows).toHaveLength(2);
  });

  it("groupByResource splits workers/assets", () => {
    const cells = [
      mkCell({ date: "2026-07-01", projectId: "p1", workerProfileId: "w1" }),
      mkCell({ date: "2026-07-01", projectId: "p1", workerProfileId: "w2" }),
      mkCell({ date: "2026-07-01", projectId: "p1", targetType: "ASSET", assetId: "a1" })
    ];
    const groups = groupByResource(cells);
    expect(groups.map((g) => g.groupId)).toEqual(expect.arrayContaining(["workers", "assets"]));
    const workers = groups.find((g) => g.groupId === "workers")!;
    expect(workers.rows).toHaveLength(2);
  });

  it("workerDayMap + emptyCellAmber surface elsewhere-allocated workers", () => {
    const cells = [mkCell({ date: "2026-07-01", projectId: "p1", workerProfileId: "w1" })];
    const map = workerDayMap(cells);
    // Empty cell on p2 for w1 on the same day → amber.
    expect(emptyCellAmber(map, "w1", "p2", "2026-07-01")).toBe(true);
    // Same project: not amber (cell would already be filled there).
    expect(emptyCellAmber(map, "w1", "p1", "2026-07-01")).toBe(false);
    // Different worker → not amber.
    expect(emptyCellAmber(map, "w2", "p2", "2026-07-01")).toBe(false);
  });

  it("indexCells supports both project- and resource-key lookups", () => {
    const cell = mkCell({ date: "2026-07-01", projectId: "p1", workerProfileId: "w1", jobRoleId: "r1" });
    const idx = indexCells([cell]);
    expect(idx.get("P|p1|W|w1|r1|2026-07-01")).toBeDefined();
    expect(idx.get("R|W|w1|2026-07-01")).toBeDefined();
  });

  it("addDaysUtc handles month boundaries", () => {
    const d = new Date(Date.UTC(2026, 0, 31));
    expect(isoDay(addDaysUtc(d, 1))).toBe("2026-02-01");
  });
});
