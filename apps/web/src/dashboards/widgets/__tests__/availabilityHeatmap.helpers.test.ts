import { describe, expect, it } from "vitest";
import { bucketLoad, distinctProjectsPerDay } from "../availabilityHeatmap.helpers";

describe("bucketLoad", () => {
  it("maps zero distinct projects to free", () => {
    expect(bucketLoad(0)).toBe("free");
  });

  it("maps one distinct project to partial", () => {
    expect(bucketLoad(1)).toBe("partial");
  });

  it("maps two or more distinct projects to full", () => {
    expect(bucketLoad(2)).toBe("full");
    expect(bucketLoad(5)).toBe("full");
  });

  it("clamps negative counts to free (defensive)", () => {
    expect(bucketLoad(-1)).toBe("free");
  });
});

describe("distinctProjectsPerDay", () => {
  it("counts two allocation rows on the same worker+day+project as ONE project (multi-role rule)", () => {
    // Ken has two allocation rows on 2026-07-10 for project-A (Foreman + WHS
    // rep roles). The locked scheduler invariant says he is one worker-day,
    // not two — so distinct-project count for that key must be 1.
    const rows = [
      { workerProfileId: "ken", date: "2026-07-10", projectId: "project-A" },
      { workerProfileId: "ken", date: "2026-07-10", projectId: "project-A" }
    ];
    const counts = distinctProjectsPerDay(rows);
    expect(counts.get("ken::2026-07-10")).toBe(1);
  });

  it("counts allocations across DIFFERENT projects on the same day as 2 projects (fully allocated)", () => {
    const rows = [
      { workerProfileId: "ken", date: "2026-07-10", projectId: "project-A" },
      { workerProfileId: "ken", date: "2026-07-10", projectId: "project-B" }
    ];
    const counts = distinctProjectsPerDay(rows);
    expect(counts.get("ken::2026-07-10")).toBe(2);
  });

  it("keys separate workers independently", () => {
    const rows = [
      { workerProfileId: "ken", date: "2026-07-10", projectId: "project-A" },
      { workerProfileId: "sam", date: "2026-07-10", projectId: "project-A" }
    ];
    const counts = distinctProjectsPerDay(rows);
    expect(counts.get("ken::2026-07-10")).toBe(1);
    expect(counts.get("sam::2026-07-10")).toBe(1);
  });

  it("returns an empty map for empty input", () => {
    expect(distinctProjectsPerDay([]).size).toBe(0);
  });
});
