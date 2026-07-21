/**
 * Smart Wizard — runtime metadata catalog client + config translation.
 *
 * The catalog is fetched from the API at open time (never bundled at build
 * time) so adding a model to docs/data-model/metadata-catalog.json surfaces
 * in the wizard on the next open with no rebuild. Keep this file logic-only
 * (no React/JSX) so the shape/parse code is unit-testable.
 */

import type { CustomChartType, CustomMetric, DataSourceKey } from "./customWidget";
import { DATA_SOURCE_BY_KEY, chartsForMetric, defaultTitle, metricsForSource } from "./customWidget";

// Catalog role vocabulary comes from build-relationship-map.mjs.
export type CatalogRole =
  | "measure"
  | "measure-candidate"
  | "dimension"
  | "filter"
  | "time"
  | "attribute"
  | "system";

export type CatalogField = {
  role: CatalogRole | string;
  label: string | null;
  filterable: boolean;
  aggregations: string[];
};

export type CatalogModel = {
  domain: string;
  wizardVisible: boolean;
  label: string | null;
  reviewed: boolean;
  fields: Record<string, CatalogField>;
};

export type MetadataCatalog = {
  domains: string[];
  models: Record<string, CatalogModel>;
};

/** Narrow the catch-all fetch result to the shape the wizard consumes.
 *  Missing shape → null (caller renders an "unavailable" state). */
export function parseCatalog(input: unknown): MetadataCatalog | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const domains = Array.isArray(obj.domains)
    ? obj.domains.filter((d): d is string => typeof d === "string")
    : [];
  const modelsRaw = obj.models;
  if (!modelsRaw || typeof modelsRaw !== "object") return null;
  const models: Record<string, CatalogModel> = {};
  for (const [name, m] of Object.entries(modelsRaw as Record<string, unknown>)) {
    if (!m || typeof m !== "object") continue;
    const model = m as Record<string, unknown>;
    const fieldsRaw = model.fields;
    const fields: Record<string, CatalogField> = {};
    if (fieldsRaw && typeof fieldsRaw === "object") {
      for (const [fname, f] of Object.entries(fieldsRaw as Record<string, unknown>)) {
        if (!f || typeof f !== "object") continue;
        const field = f as Record<string, unknown>;
        fields[fname] = {
          role: typeof field.role === "string" ? field.role : "attribute",
          label: typeof field.label === "string" ? field.label : null,
          filterable: field.filterable === true,
          aggregations: Array.isArray(field.aggregations)
            ? field.aggregations.filter((a): a is string => typeof a === "string")
            : []
        };
      }
    }
    models[name] = {
      domain: typeof model.domain === "string" ? model.domain : "Unclassified",
      wizardVisible: model.wizardVisible !== false,
      label: typeof model.label === "string" ? model.label : null,
      reviewed: model.reviewed === true,
      fields
    };
  }
  return { domains, models };
}

// ── Wizard step model ────────────────────────────────────────

export type WizardChoice = {
  model: string | null;
  measureField: string | null;
  dimensionField: string | null;
  chartType: CustomChartType;
  title: string;
};

export function initialWizardChoice(): WizardChoice {
  return {
    model: null,
    measureField: null,
    dimensionField: null,
    chartType: "kpi",
    title: ""
  };
}

/** Wizard is complete once a model + chart type + (measure OR grouping) are set.
 *  Records-count over time / donut needs no measure — a dimension is enough. */
export function canBuildWizardConfig(choice: WizardChoice): boolean {
  if (!choice.model) return false;
  if (choice.chartType === "kpi") return true; // KPI = record count of the model
  return choice.dimensionField != null || choice.measureField != null;
}

// ── Model → renderable-data-source mapping ───────────────────
//
// Only these Prisma models currently have a widget data source hooked up in
// CustomBuilderWidget. Every other catalog model still produces a valid
// config object (the shell contract), but the widget renders the "configure
// this widget" placeholder for it — live rendering for arbitrary models is a
// downstream slice and out of scope here.

const MODEL_TO_DATA_SOURCE: Record<string, DataSourceKey> = {
  Tender: "tenders",
  Job: "jobs",
  Project: "projects",
  FormSubmission: "formSubmissions",
  MaintenancePlan: "maintenancePlans"
};

export function renderableDataSourceFor(model: string): DataSourceKey | null {
  return MODEL_TO_DATA_SOURCE[model] ?? null;
}

// ── Emit a widget config from the wizard choice ──────────────

export type WizardConfigOutput = {
  filters: Record<string, unknown>;
  /** True when the resulting filters bag will render live in CustomBuilderWidget.
   *  False means the config was captured, but the widget will show the
   *  "configure me" placeholder because no data source is wired yet. */
  renderable: boolean;
};

export function buildWizardWidgetFilters(
  choice: WizardChoice,
  catalog: MetadataCatalog
): WizardConfigOutput | null {
  if (!canBuildWizardConfig(choice) || !choice.model) return null;
  const modelMeta = catalog.models[choice.model];
  const modelLabel = modelMeta?.label || choice.model;
  const source = renderableDataSourceFor(choice.model);

  // Metric selection: a measure field → sum_value; grouped-by-dimension →
  // count_by_status; nothing picked → count.
  let metric: CustomMetric;
  if (choice.measureField) metric = "sum_value";
  else if (choice.dimensionField) metric = "count_by_status";
  else metric = "count";

  const chartType = choice.chartType;
  const title = choice.title.trim() || `${modelLabel} — ${metric.replace(/_/g, " ")}`;

  if (source) {
    // Renderable: build a CustomWidgetConfig-compatible filters bag. If the
    // wizard's picked metric can't be produced by the mapped data source
    // (e.g. sum_value on a source without a valueField), fall back to the
    // first available metric — the shell's job is to always emit a valid
    // config object.
    const sourceMeta = DATA_SOURCE_BY_KEY[source];
    const allowedMetrics = metricsForSource(sourceMeta);
    const finalMetric = allowedMetrics.includes(metric) ? metric : allowedMetrics[0];
    const allowedCharts = chartsForMetric(finalMetric);
    const finalChart = allowedCharts.includes(chartType) ? chartType : allowedCharts[0];
    return {
      renderable: true,
      filters: {
        title: choice.title.trim() || defaultTitle(sourceMeta, finalMetric),
        dataSource: source,
        metric: finalMetric,
        chartType: finalChart,
        // Wizard-picked context — preserved on the entry for future runtime
        // rendering slices even though CustomBuilderWidget ignores them today.
        smartWizard: {
          model: choice.model,
          measureField: choice.measureField,
          dimensionField: choice.dimensionField
        }
      }
    };
  }

  // Non-renderable: still emit a well-formed config object so the shell
  // contract is met. The CustomBuilderWidget placeholder handles this.
  return {
    renderable: false,
    filters: {
      title,
      dataSource: `__wizard:${choice.model}`,
      metric,
      chartType,
      smartWizard: {
        model: choice.model,
        measureField: choice.measureField,
        dimensionField: choice.dimensionField
      }
    }
  };
}

// ── Field partitioning for the wizard's field selects ────────

export function measureFieldsOf(model: CatalogModel): string[] {
  return Object.entries(model.fields)
    .filter(([, f]) => f.role === "measure" || f.role === "measure-candidate")
    .map(([name]) => name)
    .sort();
}

export function dimensionFieldsOf(model: CatalogModel): string[] {
  return Object.entries(model.fields)
    .filter(([, f]) => f.role === "dimension")
    .map(([name]) => name)
    .sort();
}

export function visibleModels(catalog: MetadataCatalog): Array<{ name: string; label: string; domain: string }> {
  return Object.entries(catalog.models)
    .filter(([, m]) => m.wizardVisible)
    .map(([name, m]) => ({
      name,
      label: m.label || name,
      domain: m.domain
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
}

export const SMART_WIZARD_CHART_TYPES: CustomChartType[] = ["kpi", "bar", "donut", "line"];
