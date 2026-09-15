/**
 * reportWidgetFilters.test.tsx — filter composition tests for report widgets.
 *
 * Exercises the interaction between:
 *  - The filter bar's view-time filters (barFilters)
 *  - Per-widget config.filters (saved, override the bar via plan §5)
 *  - resolveEffectiveFilters (the merger)
 *  - buildQuery (the URL serialiser for the report widget fetch)
 *
 * EA-2b: the `period` ConfigField is removed from report widget schemas.
 * These tests confirm that from/to flow from the bar into report widgets
 * correctly, and that per-widget overrides (including empty-string clears) work.
 *
 * All tests are pure-logic (no React, no fetch).
 */

import { describe, expect, it } from "vitest";
import { resolveEffectiveFilters } from "../types";
import { registerReportWidgets, type ReportDefinitionSummary } from "../widgets/reportRegistry";

// ── EA-2b: confirm period is gone from report widget configSchema ──────────────

describe("EA-2b: report widget configSchema no longer contains period", () => {
  const defs: ReportDefinitionSummary[] = [
    {
      key: "tender-win-rate",
      title: "Tender win rate",
      description: "Win rate per estimator.",
      parameters: [
        { name: "from", label: "From date", type: "date" },
        { name: "to", label: "To date", type: "date" }
      ],
      columns: [{ key: "estimator", label: "Estimator" }]
    },
    {
      key: "estimator-turnaround",
      title: "Estimator turnaround",
      description: "Turnaround by estimator.",
      parameters: [
        { name: "from", label: "From date", type: "date" },
        { name: "to", label: "To date", type: "date" },
        { name: "estimatorId", label: "Estimator", type: "string" }
      ],
      columns: [{ key: "estimator", label: "Estimator" }]
    },
    {
      key: "estimator-qty-vs-value",
      title: "Estimator qty vs value",
      description: "Quantity versus value.",
      parameters: [
        { name: "from", label: "From date", type: "date" },
        { name: "to", label: "To date", type: "date" },
        { name: "estimatorId", label: "Estimator", type: "string" }
      ],
      columns: [{ key: "estimator", label: "Estimator" }]
    }
  ];

  const metas = registerReportWidgets(defs);

  it("tender-win-rate has no period, from, or to in configSchema", () => {
    const meta = metas.find((m) => m.type === "report:table:tender-win-rate");
    const keys = meta?.configSchema?.map((f) => f.key) ?? [];
    expect(keys).not.toContain("period");
    expect(keys).not.toContain("from");
    expect(keys).not.toContain("to");
    // tender-win-rate has only date params — configSchema is empty.
    expect(keys).toHaveLength(0);
  });

  it("estimator-turnaround configSchema contains estimatorId but NOT period/from/to", () => {
    const meta = metas.find((m) => m.type === "report:table:estimator-turnaround");
    const keys = meta?.configSchema?.map((f) => f.key) ?? [];
    expect(keys).toContain("estimatorId");
    expect(keys).not.toContain("period");
    expect(keys).not.toContain("from");
    expect(keys).not.toContain("to");
  });

  it("estimator-qty-vs-value configSchema contains estimatorId but NOT period/from/to", () => {
    const meta = metas.find((m) => m.type === "report:table:estimator-qty-vs-value");
    const keys = meta?.configSchema?.map((f) => f.key) ?? [];
    expect(keys).toContain("estimatorId");
    expect(keys).not.toContain("period");
    expect(keys).not.toContain("from");
    expect(keys).not.toContain("to");
  });
});

// ── Filter flow: bar → widget ─────────────────────────────────────────────────

describe("filter flow from bar through resolveEffectiveFilters to widget", () => {
  /** Simulates the bar sending from/to to a report widget. */
  it("bar from/to reaches report widget as effectiveFilters.from/to", () => {
    const barFilters = { from: "2026-01-01", to: "2026-09-15" };
    const widgetFilters = {}; // no widget-level overrides
    const effective = resolveEffectiveFilters(barFilters, widgetFilters);
    expect(effective.from).toBe("2026-01-01");
    expect(effective.to).toBe("2026-09-15");
  });

  it("bar clientId reaches a widget that accepts it", () => {
    const barFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "client-abc" };
    const effective = resolveEffectiveFilters(barFilters, {});
    expect(effective.clientId).toBe("client-abc");
  });

  it("widget-level from/to override bar dates (per-widget period still works via filters)", () => {
    const barFilters = { from: "2026-01-01", to: "2026-09-15" };
    const widgetFilters = { from: "2026-06-01", to: "2026-09-01" };
    const effective = resolveEffectiveFilters(barFilters, widgetFilters);
    expect(effective.from).toBe("2026-06-01");
    expect(effective.to).toBe("2026-09-01");
  });

  it("explicit empty string in widget.filters.clientId clears bar clientId (plan §5 rule 2 — override badge)", () => {
    const barFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "client-abc" };
    // Widget explicitly clears clientId — runs unfiltered for that dimension.
    const widgetFilters = { clientId: "" };
    const effective = resolveEffectiveFilters(barFilters, widgetFilters);
    // The empty string is the override. buildQuery ignores empty strings, so
    // the request goes without clientId — widget runs unfiltered.
    expect(effective.clientId).toBe("");
  });

  it("bar estimatorId flows through to widget if widget has no override", () => {
    const barFilters = { estimatorId: "est-7" };
    const effective = resolveEffectiveFilters(barFilters, undefined);
    expect(effective.estimatorId).toBe("est-7");
  });
});

// ── WidgetSettingsPopover no longer renders a period field ────────────────────

describe("WidgetSettingsPopover no longer has period in report widget configSchema", () => {
  const def: ReportDefinitionSummary = {
    key: "some-report",
    title: "Some report",
    description: "A report with only date params.",
    parameters: [
      { name: "from", label: "From date", type: "date" },
      { name: "to", label: "To date", type: "date" }
    ],
    columns: [{ key: "col", label: "Col" }]
  };

  it("report widget configSchema is empty (no period, no from, no to) — settings popover renders nothing for this widget", () => {
    const metas = registerReportWidgets([def]);
    const meta = metas.find((m) => m.type === "report:table:some-report");
    // configSchema is empty — WidgetSettingsPopover has no fields to render.
    // Before EA-2b this would have had {key:"period", type:"period"} which
    // serialised as "period" on the URL and caused a 400 (forbidNonWhitelisted).
    expect(meta?.configSchema).toEqual([]);
  });
});
