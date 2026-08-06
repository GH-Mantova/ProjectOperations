/**
 * widgetGallery-reporting — asserts that the `reporting` category appears with
 * N entries matching a mocked definitions list, exercising registerReportWidgets
 * and the resulting WidgetMeta shape.
 *
 * This is a pure logic test (no React, no fetch). It mocks the definitions
 * that the real GET /reporting/definitions endpoint returns (as documented in
 * the SLICE 2 parity audit) and asserts that:
 *   1. Every definition with columns produces one `report:table:<key>` entry.
 *   2. Each entry has category "reporting", correct type, name, and size.
 *   3. The configSchema is derived correctly from the definition's parameters.
 *   4. Definitions with from+to parameters get a "period" configField (W2).
 *   5. Definitions with string params get "text" configFields (W3).
 *   6. Definitions with zero parameters get an empty configSchema.
 */

import { describe, expect, it } from "vitest";
import { registerReportWidgets, type ReportDefinitionSummary } from "../widgets/reportRegistry";

/** Five mocked definitions matching the SLICE 2 audit inventory. */
const MOCK_DEFS: ReportDefinitionSummary[] = [
  {
    key: "tender-pipeline",
    title: "Tender pipeline",
    description: "Live tenders grouped by status.",
    parameters: [
      { name: "from", label: "From date", type: "date" },
      { name: "to", label: "To date", type: "date" },
      { name: "clientId", label: "Client", type: "string", helperText: "Filter by client" }
    ],
    columns: [
      { key: "status", label: "Status" },
      { key: "count", label: "Count", format: "number" },
      { key: "estimatedValue", label: "Est. value", format: "currency", align: "right" }
    ],
    chart: { type: "bar", xKey: "status", yKey: "count", title: "Tenders by status" }
  },
  {
    key: "tender-win-rate",
    title: "Tender win rate",
    description: "Win rate per estimator.",
    parameters: [
      { name: "from", label: "From date", type: "date" },
      { name: "to", label: "To date", type: "date" }
    ],
    columns: [
      { key: "estimator", label: "Estimator" },
      { key: "submitted", label: "Submitted", format: "number" },
      { key: "awarded", label: "Awarded", format: "number" },
      { key: "lost", label: "Lost", format: "number" },
      { key: "winRatePct", label: "Win rate", format: "percent", align: "right" }
    ],
    chart: { type: "bar", xKey: "estimator", yKey: "winRatePct", title: "Win rate (%)", unit: "%" }
  },
  {
    key: "job-status-summary",
    title: "Job status summary",
    description: "Jobs grouped by status.",
    parameters: [
      { name: "from", label: "From date", type: "date" },
      { name: "to", label: "To date", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [
      { key: "status", label: "Status" },
      { key: "count", label: "Count", format: "number" }
    ],
    chart: { type: "bar", xKey: "status", yKey: "count", title: "Jobs by status" }
  },
  {
    key: "worker-competency-expiry",
    title: "Worker competency expiry",
    description: "Competencies expiring within the window.",
    parameters: [
      { name: "from", label: "From date", type: "date", helperText: "Defaults to today" },
      { name: "to", label: "To date", type: "date", helperText: "Defaults to +90 days" }
    ],
    columns: [
      { key: "worker", label: "Worker" },
      { key: "competency", label: "Competency" },
      { key: "expiresAt", label: "Expires", format: "date" },
      { key: "daysToExpiry", label: "Days to expiry", format: "number", align: "right" }
    ]
    // No chart — SLICE 4 must not emit a chart widget for this one (W5).
  },
  {
    key: "asset-utilisation-snapshot",
    title: "Asset utilisation snapshot",
    description: "Assets grouped by status.",
    parameters: [], // Zero parameters (W6 — configSchema must be empty).
    columns: [
      { key: "status", label: "Status" },
      { key: "count", label: "Count", format: "number" }
    ],
    chart: { type: "bar", xKey: "status", yKey: "count", title: "Assets by status" }
  }
];

describe("registerReportWidgets", () => {
  const metas = registerReportWidgets(MOCK_DEFS);

  it("emits exactly one WidgetMeta per definition with columns (5 total)", () => {
    expect(metas).toHaveLength(5);
  });

  it("every meta has category 'reporting'", () => {
    for (const meta of metas) {
      expect(meta.category).toBe("reporting");
    }
  });

  it("type follows the report:table:<key> naming convention", () => {
    const types = metas.map((m) => m.type);
    expect(types).toContain("report:table:tender-pipeline");
    expect(types).toContain("report:table:tender-win-rate");
    expect(types).toContain("report:table:job-status-summary");
    expect(types).toContain("report:table:worker-competency-expiry");
    expect(types).toContain("report:table:asset-utilisation-snapshot");
  });

  it("name is taken from def.title verbatim", () => {
    const tenderMeta = metas.find((m) => m.type === "report:table:tender-pipeline");
    expect(tenderMeta?.name).toBe("Tender pipeline");
  });

  it("submodule is set to def.key for gallery module grouping", () => {
    const tenderMeta = metas.find((m) => m.type === "report:table:tender-pipeline");
    expect(tenderMeta?.submodule).toBe("tender-pipeline");
  });

  it("size is 'full', defaultColSpan 4, defaultRowSpan 3", () => {
    for (const meta of metas) {
      expect(meta.size).toBe("full");
      expect(meta.defaultColSpan).toBe(4);
      expect(meta.defaultRowSpan).toBe(3);
    }
  });

  it("component is a function (React component factory result)", () => {
    for (const meta of metas) {
      expect(typeof meta.component).toBe("function");
    }
  });

  // W2: from+to date params collapse into a single "period" ConfigField.
  it("from+to parameters become a single 'period' configSchema field (W2)", () => {
    const meta = metas.find((m) => m.type === "report:table:tender-pipeline");
    const periodField = meta?.configSchema?.find((f) => f.key === "period");
    expect(periodField).toBeDefined();
    expect(periodField?.type).toBe("period");

    // Must NOT have separate "from" and "to" fields alongside the period field.
    const fromField = meta?.configSchema?.find((f) => f.key === "from");
    const toField = meta?.configSchema?.find((f) => f.key === "to");
    expect(fromField).toBeUndefined();
    expect(toField).toBeUndefined();
  });

  // W3: string params (clientId) map to "text".
  it("clientId string parameter maps to a 'text' configSchema field (W3)", () => {
    const meta = metas.find((m) => m.type === "report:table:tender-pipeline");
    const clientField = meta?.configSchema?.find((f) => f.key === "clientId");
    expect(clientField).toBeDefined();
    expect(clientField?.type).toBe("text");
  });

  // W6: zero-parameter definition → empty configSchema.
  it("definition with zero parameters produces an empty configSchema (W6)", () => {
    const meta = metas.find((m) => m.type === "report:table:asset-utilisation-snapshot");
    expect(meta?.configSchema).toEqual([]);
  });

  // W5: worker-competency-expiry has no chart — factory must NOT emit a chart
  // widget in this SLICE. (SLICE 4 will add chart widgets.) Verify by checking
  // the type list contains no `report:chart:*` entries.
  it("SLICE 3 does not emit any report:chart:* widgets (those belong to SLICE 4)", () => {
    for (const meta of metas) {
      expect(meta.type).not.toMatch(/^report:chart:/);
    }
  });

  it("does not emit widgets for definitions with no columns (hypothetical edge case)", () => {
    const defsWithEmpty: ReportDefinitionSummary[] = [
      {
        key: "empty-report",
        title: "Empty",
        description: "No columns",
        parameters: [],
        columns: []
      }
    ];
    expect(registerReportWidgets(defsWithEmpty)).toHaveLength(0);
  });
});
