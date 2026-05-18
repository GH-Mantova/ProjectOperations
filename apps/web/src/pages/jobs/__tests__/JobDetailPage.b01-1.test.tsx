// PR fix/B01.1 — regression guards for the line 207 precedence bug
// (`job?.activities.length` short-circuiting only on nullish job).
//
// The web workspace has no @testing-library / jsdom set up (existing
// specs are pure logic), so we test the extracted `flattenActivities`
// helper that JobDetailPage now uses in place of the broken
// `job?.activities.length` expression. The helper covers exactly the
// shape the API actually returns — stages[].activities — and is the
// thing that would have to break for the page to blank again.

import { describe, expect, it } from "vitest";
import { flattenActivities } from "../JobDetailPage";

type ActivityFixture = {
  id: string;
  jobStageId: string;
  name: string;
  status: string;
  activityOrder: number;
};

const a = (id: string, status = "NOT_STARTED"): ActivityFixture => ({
  id,
  jobStageId: "s1",
  name: `Activity ${id}`,
  status,
  activityOrder: 0
});

describe("flattenActivities (PR fix/B01.1)", () => {
  // Spec A — the actual regression case. Reproduces the API shape
  // that exposed the bug: job has stages but no top-level
  // `activities` field. The broken `job?.activities.length` form
  // threw TypeError here. The fix flattens via stages, which works.
  it("returns the flattened activities when the job has stages but no top-level activities field", () => {
    const job = {
      id: "job-001",
      name: "Test job",
      stages: [
        { id: "s1", activities: [a("a1"), a("a2")] },
        { id: "s2", activities: [a("a3")] }
      ]
    };
    const result = flattenActivities(job);
    expect(result).toHaveLength(3);
    expect(result.map((x) => x.id)).toEqual(["a1", "a2", "a3"]);
  });

  // Spec B — totalActivities derivation. Confirms the consumer side
  // of the same expression — what JobDetailPage uses for the
  // Overview KPI tile.
  it("derives totalActivities/completedActivities correctly from stages[].activities", () => {
    const job = {
      stages: [
        {
          id: "s1",
          activities: [a("a1", "COMPLETE"), a("a2", "IN_PROGRESS")]
        },
        { id: "s2", activities: [a("a3", "COMPLETE")] }
      ]
    };
    const flat = flattenActivities(job);
    const total = flat.length;
    const completed = flat.filter((x) => x.status === "COMPLETE").length;
    expect(total).toBe(3);
    expect(completed).toBe(2);
  });

  // Spec C — null-job safety. The component calls flattenActivities
  // before its `if (!job)` early return runs (it's inside a useMemo),
  // so the helper has to tolerate null/undefined input without
  // throwing. This is what was broken — line 207's `?.` parsed wrong
  // and surfaced the precedence trap.
  it("returns [] for null, undefined, or a job with no stages — never throws", () => {
    expect(flattenActivities(null)).toEqual([]);
    expect(flattenActivities(undefined)).toEqual([]);
    expect(flattenActivities({})).toEqual([]);
    expect(flattenActivities({ stages: [] })).toEqual([]);
    expect(flattenActivities({ stages: [{ id: "s1" }] })).toEqual([]);
    expect(flattenActivities({ stages: [{ id: "s1", activities: undefined }] })).toEqual([]);
  });
});
