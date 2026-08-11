/**
 * reportRegistry — factory that converts ReportDefinitionSummary[] into
 * WidgetMeta[] for the dashboard registry.
 *
 * SLICE 3 shipped table widgets. SLICE 4 extends this file with chart
 * widget emission (report:chart:<key>) for definitions that have a `chart` spec.
 *
 * W2 (parity audit): `from`/`to` parameters collapse into a single
 * ConfigFieldType "period" field so the widget inherits the dashboard period
 * picker. `clientId` maps to "text" (W3 — upgrading to a "select" with
 * dynamicOptions: "clients" is a follow-on, not blocking).
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
 * W2: if the definition has both `from` and `to` date parameters, collapse
 * them into a single "period" ConfigField so the widget can inherit the
 * dashboard-level period selector.
 * W3: string parameters (clientId, projectId) map to "text" for now.
 */
function buildConfigSchema(
  parameters: ReportDefinitionSummary["parameters"]
): ConfigField[] {
  const fields: ConfigField[] = [];
  const hasFrom = parameters.some((p) => p.name === "from" && p.type === "date");
  const hasTo = parameters.some((p) => p.name === "to" && p.type === "date");
  let periodEmitted = false;

  for (const param of parameters) {
    if (param.type === "date" && (param.name === "from" || param.name === "to")) {
      // Collapse from+to into one "period" field (W2). Only emit once.
      if (!periodEmitted && hasFrom && hasTo) {
        fields.push({
          key: "period",
          label: "Period",
          type: "period"
        });
        periodEmitted = true;
      } else if (!(hasFrom && hasTo)) {
        // Definition has only one of from/to — fall back to text.
        fields.push({
          key: param.name,
          label: param.label,
          type: "text",
          placeholder: param.helperText ?? "YYYY-MM-DD"
        });
      }
      // If we already emitted the period field, skip the second date param.
    } else {
      // string parameters (clientId, projectId) → text (W3)
      fields.push({
        key: param.name,
        label: param.label,
        type: "text",
        placeholder: param.helperText
      });
    }
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
