// GPS-A2 — pin the honest-gap segmentation used by the live crew map
// trail overlay. The web workspace has no jsdom set up (see
// PayrollExportPage.test.ts), so we test the pure helper directly.

import { describe, expect, it } from "vitest";
import { buildTrailSegments, TRAIL_GAP_THRESHOLD_MS } from "../LiveCrewMapPage";

function point(iso: string, lat = 0, lng = 0) {
  return { lat, lng, accuracy: null, recordedAt: iso, source: "breadcrumb" as const };
}

describe("buildTrailSegments", () => {
  it("returns a single segment when all points are within the gap threshold", () => {
    const points = [
      point("2026-07-20T06:00:00.000Z"),
      point("2026-07-20T06:03:00.000Z"),
      point("2026-07-20T06:06:00.000Z")
    ];
    const segments = buildTrailSegments(points);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
  });

  it("breaks the trail whenever a gap exceeds the threshold", () => {
    const beforeGap = new Date("2026-07-20T06:00:00.000Z");
    // Gap between points[1] and points[2] = threshold + 1 min → strictly >.
    const afterGap = new Date(
      beforeGap.getTime() + 60_000 + TRAIL_GAP_THRESHOLD_MS + 60_000
    );
    const points = [
      point(beforeGap.toISOString()),
      point(new Date(beforeGap.getTime() + 60_000).toISOString()),
      point(afterGap.toISOString()),
      point(new Date(afterGap.getTime() + 60_000).toISOString())
    ];
    const segments = buildTrailSegments(points);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(2);
    expect(segments[1]).toHaveLength(2);
  });

  it("returns an empty array for an empty trail", () => {
    expect(buildTrailSegments([])).toEqual([]);
  });
});
