/**
 * Smoke tests for reportChartWidget.
 *
 * The widget uses authFetch (browser-only) so React-render tests would require
 * jsdom + a fetch mock which is not wired in the current vitest config.
 * Instead, we test that makeReportChartWidget returns a valid React component
 * function (i.e. it is callable and its displayName is set) and that the
 * factory correctly handles the absent-chartSpec defense case.
 *
 * This matches the pattern used by reportTableWidget.spec.tsx.
 */

import { describe, expect, it } from "vitest";
import { makeReportChartWidget, type ChartSpec } from "../reportChartWidget";

const SAMPLE_CHART_SPEC: ChartSpec = {
  type: "bar",
  xKey: "month",
  yKey: "value",
  title: "Pipeline value by month",
  unit: "$"
};

describe("makeReportChartWidget", () => {
  it("returns a function (React component) with the correct displayName", () => {
    const widget = makeReportChartWidget("tender-pipeline", SAMPLE_CHART_SPEC);
    expect(typeof widget).toBe("function");
    expect(widget.displayName).toBe("ReportChartWidget(tender-pipeline)");
  });

  it("produces distinct component references for different report keys", () => {
    const widgetA = makeReportChartWidget("tender-pipeline", SAMPLE_CHART_SPEC);
    const widgetB = makeReportChartWidget("job-status-summary", SAMPLE_CHART_SPEC);
    expect(widgetA).not.toBe(widgetB);
    expect(widgetA.displayName).not.toBe(widgetB.displayName);
  });

  it("still returns a component when chartSpec is undefined (defense in depth)", () => {
    const widget = makeReportChartWidget("some-report", undefined);
    expect(typeof widget).toBe("function");
    expect(widget.displayName).toBe("ReportChartWidget(some-report)");
  });

  it("chart spec with unknown type is handled — widget is still a function", () => {
    const unknownTypeSpec: ChartSpec = {
      type: "line",
      xKey: "month",
      yKey: "count",
      title: "Line chart"
    };
    const widget = makeReportChartWidget("some-report", unknownTypeSpec);
    // The component should be callable (rendering is tested by the e2e suite).
    expect(typeof widget).toBe("function");
  });
});
