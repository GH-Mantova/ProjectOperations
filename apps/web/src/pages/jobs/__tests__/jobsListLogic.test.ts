import { describe, expect, it } from "vitest";
import { progressPercent } from "../jobsListLogic";

describe("progressPercent", () => {
  it("returns 22 for 18 activities across 5 stages with 4 COMPLETE (job-001 shape)", () => {
    const stages = [
      {
        id: "s1",
        activities: [
          { id: "a1", status: "COMPLETE" },
          { id: "a2", status: "COMPLETE" },
          { id: "a3", status: "IN_PROGRESS" },
          { id: "a4", status: "PLANNED" }
        ]
      },
      {
        id: "s2",
        activities: [
          { id: "a5", status: "COMPLETE" },
          { id: "a6", status: "IN_PROGRESS" },
          { id: "a7", status: "PLANNED" },
          { id: "a8", status: "PLANNED" }
        ]
      },
      {
        id: "s3",
        activities: [
          { id: "a9", status: "COMPLETE" },
          { id: "a10", status: "PLANNED" },
          { id: "a11", status: "PLANNED" },
          { id: "a12", status: "PLANNED" }
        ]
      },
      {
        id: "s4",
        activities: [
          { id: "a13", status: "PLANNED" },
          { id: "a14", status: "PLANNED" },
          { id: "a15", status: "PLANNED" }
        ]
      },
      {
        id: "s5",
        activities: [
          { id: "a16", status: "PLANNED" },
          { id: "a17", status: "PLANNED" },
          { id: "a18", status: "PLANNED" }
        ]
      }
    ];
    expect(progressPercent({ stages })).toBe(22);
  });

  it("returns 0 when the job has no stages", () => {
    expect(progressPercent({})).toBe(0);
    expect(progressPercent({ stages: [] })).toBe(0);
  });

  it("returns 0 when stages have no activities", () => {
    expect(progressPercent({ stages: [{ id: "s1" }, { id: "s2", activities: [] }] })).toBe(0);
  });

  it("returns 100 when every activity is COMPLETE", () => {
    const stages = [
      {
        id: "s1",
        activities: [
          { id: "a1", status: "COMPLETE" },
          { id: "a2", status: "COMPLETE" }
        ]
      },
      {
        id: "s2",
        activities: [{ id: "a3", status: "COMPLETE" }]
      }
    ];
    expect(progressPercent({ stages })).toBe(100);
  });
});
