import { describe, expect, it } from "vitest";
import { siteJobsCount } from "../sitesListLogic";

describe("siteJobsCount", () => {
  it("returns the _count.jobs value when present", () => {
    expect(siteJobsCount({ _count: { jobs: 3 } })).toBe(3);
  });

  it("returns 0 when _count is missing", () => {
    expect(siteJobsCount({})).toBe(0);
  });

  it("returns 0 when _count.jobs is undefined", () => {
    expect(siteJobsCount({ _count: {} })).toBe(0);
  });
});
