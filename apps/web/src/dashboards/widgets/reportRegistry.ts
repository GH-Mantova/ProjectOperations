/**
 * reportRegistry — factory that converts ReportDefinitionSummary[] into
 * WidgetMeta[] for the dashboard registry.
 *
 * SLICE 3 shipped table widgets. SLICE 4 extends this file with chart
 * widget emission (report:chart:<key>) for definitions that have a `chart` spec.
 *
 * EA-2b: the `period` ConfigField is removed from report widget schemas.
 * Date windowing (`from`/`to`) is handled at the dashboard level by
 * DashboardFilterBar, not per-widget. Setting a per-widget period previously
 * broke the widget with a 400 (ReportRunQueryDto has no `period` field and
 * the global pipe runs forbidNonWhitelisted:true). The dead field is removed
 * rather than wired to an API that doesn't accept it.
 * String parameters (clientId, estimatorId) remain as text fields.
 */

import { makeReportTableWidget } from "./reportTableWidget";
import { makeReportChartWidget } from "./reportChartWidget";
import type { ConfigField, WidgetMeta } from "../types";

/** Minimal summary shape returned by GET /reporting/definitions.
 *  Mirrors ReportDefinitionSummary in reporting.service.ts:52-60 — copied
 *  here to avoid a cross-layer import (plan §7: no modifications to the BI
 *  reporting layer). */
export type ReportDefinitionSummary = {
  key: string;
  title: string;
  description: string;
  parameters: Array<{
    name: string;
    label: string;
    type: "date" | "string";
    required?: boolean;
    helperText?: string;
  }>;
  columns: Array<{
    key: string;
    label: string;
    align?: "left" | "right";
    format?: "text" | "number" | "currency" | "percent" | "date";
  }>;
  chart?: {
    type: string;
    xKey: string;
    yKey: string;
    title: string;
    unit?: string;
  };
};

/** Derive a configSchema from a definition's parameters list.
 *
 * EA-2b: date parameters (`from`, `to`) are intentionally omitted from the
 * per-widget configSchema. Date windowing is a dashboard-level concern handled
 * by DashboardFilterBar. Emitting a `period` field was broken (the API rejects
 * it with 400; see EA-2b prompt for full diagnosis).
 *
 * String parameters (clientId, estimatorId, projectId, etc.) remain as text
 * fields — they can still be overridden per-widget via WidgetSettingsPopover.
 */
function buildConfigSchema(
  parameters: ReportDefinitionSummary["parameters"]
): ConfigField[] {
  const fields: ConfigField[] = [];

  for (const param of parameters) {
    // Skip date parameters — windowing is handled by the filter bar, not
    // per-widget configSchema.
    if (param.type === "date") continue;

    // string parameters (clientId, estimatorId, projectId, etc.) → text
    fields.push({
      key: param.name,
      label: param.label,
      type: "text",
      placeholder: param.helperText
    });
  }

  return fields;
}

/**
 * Given a list of ReportDefinitionSummary objects (from GET /reporting/definitions),
 * produce WidgetMeta entries for every definition that has columns.
 *
 * Widget type format:
 *   `report:table:<reportKey>` — table widget for every definition with columns.
 *   `report:chart:<reportKey>` — chart widget for definitions that have a `chart` spec.
 *
 * Both type formats follow the SLICE 1 naming convention.
 */
export function registerReportWidgets(defs: ReportDefinitionSummary[]): WidgetMeta[] {
  const metas: WidgetMeta[] = [];

  for (const def of defs) {
    if (!def.columns || def.columns.length === 0) continue;

    const configSchema = buildConfigSchema(def.parameters);

    // Table widget — always emitted for definitions with columns.
    metas.push({
      type: `report:table:${def.key}`,
      name: def.title,
      category: "reporting",
      submodule: def.key,
      description: def.description,
      size: "full",
      defaultColSpan: 4,
      defaultRowSpan: 3,
      configSchema,
      component: makeReportTableWidget(def.key)
    });

    // Chart widget — only emitted for definitions that have a chart spec.
    if (def.chart) {
      metas.push({
        type: `report:chart:${def.key}`,
        name: def.chart.title,
        category: "reporting",
        submodule: def.key,
        description: def.description,
        size: "full",
        defaultColSpan: 4,
        defaultRowSpan: 3,
        configSchema,
        component: makeReportChartWidget(def.key, def.chart)
      });
    }
  }

  return metas;
}
