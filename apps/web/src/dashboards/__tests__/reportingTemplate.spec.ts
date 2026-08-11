/**
 * reportingTemplate.spec.ts — pure-logic tests for the SLICE 7 template function.
 *
 * Follows the style used in widgetGallery-reporting.spec.ts and
 * renameAndCopyDashboard.test.ts (no React, no jsdom, no fetch).
 */

import { describe, expect, it } from "vitest";
import { reportingTemplate } from "../reportingTemplate";
import type { ReportDefinitionSummary } from "../widgets/reportRegistry";

function makeDef(key: string): ReportDefinitionSummary {
  return {
    key,
    title: `Report ${key}`,
    description: `Description for ${key}`,
    parameters: [],
    columns: [{ key: "value", label: "Value" }]
  };
}

const THREE_DEFS: ReportDefinitionSummary[] = [
  makeDef("tender-pipeline"),
  makeDef("job-status-summary"),
  makeDef("asset-utilisation-snapshot")
];

describe("reportingTemplate", () => {
  it("returns a config with one widget per definition", () => {
    const config = reportingTemplate(THREE_DEFS);
    expect(config.widgets).toHaveLength(3);
  });

  it("empty list produces an empty widgets array with a valid config", () => {
    const config = reportingTemplate([]);
    expect(config.widgets).toEqual([]);
    expect(config.period).toBeDefined();
  });

  it("all widgets have visible = true", () => {
    const config = reportingTemplate(THREE_DEFS);
    for (const w of config.widgets) {
      expect(w.visible).toBe(true);
    }
  });

  it("widget ids are unique", () => {
    const config = reportingTemplate(THREE_DEFS);
    const ids = config.widgets.map((w) => w.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("order values are monotonically increasing starting from 0", () => {
    const config = reportingTemplate(THREE_DEFS);
    const orders = config.widgets.map((w) => w.order);
    for (let i = 0; i < orders.length; i++) {
      expect(orders[i]).toBe(i);
    }
  });

  it("each widget type follows the report:table:<key> convention", () => {
    const config = reportingTemplate(THREE_DEFS);
    for (let i = 0; i < config.widgets.length; i++) {
      expect(config.widgets[i].type).toBe(`report:table:${THREE_DEFS[i].key}`);
    }
  });

  it("widget ids are constructed from the definition key (report-table-<key>)", () => {
    const config = reportingTemplate(THREE_DEFS);
    for (let i = 0; i < config.widgets.length; i++) {
      expect(config.widgets[i].id).toBe(`report-table-${THREE_DEFS[i].key}`);
    }
  });

  it("single definition produces exactly one widget", () => {
    const config = reportingTemplate([makeDef("only-report")]);
    expect(config.widgets).toHaveLength(1);
    expect(config.widgets[0].type).toBe("report:table:only-report");
    expect(config.widgets[0].order).toBe(0);
  });

  it("config has a period set (valid UserDashboardConfig)", () => {
    const config = reportingTemplate(THREE_DEFS);
    expect(config.period).toBeTruthy();
  });
});
