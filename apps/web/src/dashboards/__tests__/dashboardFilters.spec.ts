/**
 * dashboardFilters.spec.ts — unit tests for SLICE 5 filter composition logic.
 *
 * Tests:
 *  1. Merge precedence: widget filters override dashboard filters.
 *  2. Empty-string override: explicit empty string in widget clears dashboard value.
 *  3. Missing widget key defers to dashboard filter.
 *  4. Absent dashboard filters leave widget filters intact.
 *  5. Both undefined/empty → empty result.
 *  6. collectReportParameters union: deduplication by key, first occurrence wins.
 *  7. collectReportParameters: section absent (returns []) when no report widgets present.
 *
 * EA-2b: the `period` ConfigField was removed from report widget schemas (the
 * API rejects it with 400; date windowing is handled by DashboardFilterBar).
 * Tests 6–7 updated accordingly: configSchema no longer contains `period`.
 *
 * All tests are pure-logic (no React, no fetch).
 */

import { describe, expect, it } from "vitest";
import { resolveEffectiveFilters } from "../types";
import { registerReportWidgets, type ReportDefinitionSummary } from "../widgets/reportRegistry";

// ── 1–5: resolveEffectiveFilters ─────────────────────────────────────────────

describe("resolveEffectiveFilters", () => {
  it("widget filter value overrides dashboard filter for the same key", () => {
    const result = resolveEffectiveFilters(
      { from: "2024-01-01", to: "2024-12-31" },
      { from: "2025-01-01" }
    );
    expect(result.from).toBe("2025-01-01");
    // Dashboard-level `to` is preserved — widget did not touch it.
    expect(result.to).toBe("2024-12-31");
  });

  it("explicit empty string in widget filters clears the dashboard-level value", () => {
    const result = resolveEffectiveFilters(
      { projectId: "proj-123" },
      { projectId: "" }
    );
    // Empty string is an override — the key is present in widgetFilters.
    expect(result.projectId).toBe("");
  });

  it("missing key in widget filters defers to the dashboard filter", () => {
    const result = resolveEffectiveFilters(
      { clientId: "client-abc", from: "2025-01-01" },
      { from: "2025-06-01" }
    );
    // clientId is not in widgetFilters so it falls through from dashboardFilters.
    expect(result.clientId).toBe("client-abc");
    // from is overridden by widget.
    expect(result.from).toBe("2025-06-01");
  });

  it("absent dashboard filters leave widget filters intact", () => {
    const result = resolveEffectiveFilters(undefined, { from: "2025-01-01", clientId: "x" });
    expect(result.from).toBe("2025-01-01");
    expect(result.clientId).toBe("x");
  });

  it("both undefined returns an empty object", () => {
    const result = resolveEffectiveFilters(undefined, undefined);
    expect(result).toEqual({});
  });

  it("both empty objects returns an empty object", () => {
    const result = resolveEffectiveFilters({}, {});
    expect(result).toEqual({});
  });
});

// ── 6–7: collectReportParameters (parameter union) ───────────────────────────
// We exercise this via registerReportWidgets (same production path used by the
// CustomisePanel helper, which iterates WIDGET_BY_TYPE for live widgets).

const DEFS_WITH_PARAMS: ReportDefinitionSummary[] = [
  {
    key: "tender-pipeline",
    title: "Tender pipeline",
    description: "Live tenders grouped by status.",
    parameters: [
      { name: "from", label: "From date", type: "date" },
      { name: "to", label: "To date", type: "date" },
      { name: "clientId", label: "Client", type: "string" }
    ],
    columns: [{ key: "status", label: "Status" }]
  },
  {
    key: "job-status-summary",
    title: "Job status summary",
    description: "Jobs grouped by status.",
    parameters: [
      { name: "from", label: "From date", type: "date" },
      { name: "to", label: "To date", type: "date" },
      { name: "projectId", label: "Project", type: "string" }
    ],
    columns: [{ key: "status", label: "Status" }]
  }
];

describe("collectReportParameters (via registerReportWidgets configSchema)", () => {
  const metas = registerReportWidgets(DEFS_WITH_PARAMS);

  it("emits configSchema entries for both report definitions", () => {
    const tenderMeta = metas.find((m) => m.type === "report:table:tender-pipeline");
    const jobMeta = metas.find((m) => m.type === "report:table:job-status-summary");
    // tender-pipeline has clientId (string param) — non-zero configSchema
    expect(tenderMeta?.configSchema?.length).toBeGreaterThan(0);
    // job-status-summary has projectId (string param) — non-zero configSchema
    expect(jobMeta?.configSchema?.length).toBeGreaterThan(0);
  });

  it("tender-pipeline configSchema contains clientId but NO period/from/to (EA-2b: date windowing is the filter bar's job)", () => {
    const tenderMeta = metas.find((m) => m.type === "report:table:tender-pipeline");
    const keys = tenderMeta?.configSchema?.map((f) => f.key) ?? [];
    // String params are retained for per-widget override via WidgetSettingsPopover.
    expect(keys).toContain("clientId");
    // Date params are NOT in the per-widget schema — DashboardFilterBar owns them.
    expect(keys).not.toContain("period");
    expect(keys).not.toContain("from");
    expect(keys).not.toContain("to");
  });

  it("job-status-summary configSchema contains projectId but NO period/from/to", () => {
    const jobMeta = metas.find((m) => m.type === "report:table:job-status-summary");
    const keys = jobMeta?.configSchema?.map((f) => f.key) ?? [];
    expect(keys).toContain("projectId");
    expect(keys).not.toContain("period");
    expect(keys).not.toContain("from");
    expect(keys).not.toContain("to");
  });

  it("union of string parameters across two definitions includes all unique non-date keys", () => {
    // Simulate collectReportParameters: iterate all report:table widgets,
    // union configSchema keys with deduplication.
    const seen = new Set<string>();
    const union: string[] = [];
    for (const meta of metas.filter((m) => m.type.startsWith("report:table:"))) {
      for (const field of meta.configSchema ?? []) {
        if (!seen.has(field.key)) {
          seen.add(field.key);
          union.push(field.key);
        }
      }
    }
    // period is gone — the filter bar owns date windowing.
    expect(union).not.toContain("period");
    // Both string-param keys present.
    expect(union).toContain("clientId");
    expect(union).toContain("projectId");
  });

  it("returns empty configSchema for a definition with only date parameters (dates are filter-bar only)", () => {
    const dateOnlyDefs: ReportDefinitionSummary[] = [
      {
        key: "date-only",
        title: "Date only",
        description: "A definition with only date parameters.",
        parameters: [
          { name: "from", label: "From date", type: "date" },
          { name: "to", label: "To date", type: "date" }
        ],
        columns: [{ key: "count", label: "Count" }]
      }
    ];
    const dateMetas = registerReportWidgets(dateOnlyDefs);
    const meta = dateMetas.find((m) => m.type === "report:table:date-only");
    expect(meta?.configSchema).toEqual([]);
  });

  it("returns empty configSchema for a definition with zero parameters (no report filter section needed)", () => {
    const zeroParamDefs: ReportDefinitionSummary[] = [
      {
        key: "no-params",
        title: "No params",
        description: "A definition with no parameters.",
        parameters: [],
        columns: [{ key: "count", label: "Count" }]
      }
    ];
    const zeroMetas = registerReportWidgets(zeroParamDefs);
    const meta = zeroMetas.find((m) => m.type === "report:table:no-params");
    expect(meta?.configSchema).toEqual([]);
  });
});
