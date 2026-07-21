import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CenteredModal, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { CUSTOM_WIDGET_TYPE, type CustomChartType } from "./customWidget";
import type { WidgetConfigEntry } from "./types";
import {
  SMART_WIZARD_CHART_TYPES,
  buildWizardWidgetFilters,
  canBuildWizardConfig,
  dimensionFieldsOf,
  initialWizardChoice,
  measureFieldsOf,
  parseCatalog,
  visibleModels,
  type MetadataCatalog,
  type WizardChoice
} from "./smartWizardCatalog";

type Props = {
  onClose: () => void;
  /** Called with the configured entry — the canvas then enters placement mode,
   *  matching the existing WidgetGalleryModal contract. */
  onAdd: (entry: WidgetConfigEntry) => void;
};

const CHART_LABEL: Record<CustomChartType, string> = {
  kpi: "KPI tile",
  bar: "Bar chart",
  donut: "Donut chart",
  line: "Line chart"
};

/** Smart Wizard — reads the metadata catalog at RUNTIME (no code generation,
 *  no build-time snapshot). Emits a dashboard-widget config entry via the
 *  existing customWidget shape; the canvas handles placement. */
export function SmartWizardModal({ onClose, onAdd }: Props) {
  const { authFetch } = useAuth();
  const catalogQuery = useQuery({
    queryKey: ["smart-wizard", "catalog"],
    queryFn: async () => {
      const response = await authFetch("/meta/catalog");
      if (!response.ok) {
        const detail = await safeReadDetail(response);
        throw new Error(detail ?? `Catalog unavailable (${response.status})`);
      }
      return parseCatalog(await response.json());
    },
    staleTime: 30_000
  });

  const catalog = catalogQuery.data ?? null;

  return (
    <CenteredModal
      title="Smart Wizard — build a widget from live metadata"
      onClose={onClose}
      maxWidth={720}
      dataTestId="smart-wizard-modal"
    >
      <p
        className="wg-preview__badge"
        style={{ marginTop: 0, display: "inline-block" }}
        data-testid="smart-wizard-runtime-badge"
      >
        ● Live from /meta/catalog — no rebuild required
      </p>
      {catalogQuery.isLoading ? (
        <Skeleton width="100%" height={220} />
      ) : catalogQuery.isError || !catalog ? (
        <CatalogErrorState
          message={catalogQuery.error instanceof Error ? catalogQuery.error.message : "Catalog unavailable."}
          onRetry={() => void catalogQuery.refetch()}
        />
      ) : (
        <SmartWizardBody catalog={catalog} onAdd={onAdd} onClose={onClose} />
      )}
    </CenteredModal>
  );
}

async function safeReadDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: string };
    return typeof body.message === "string" ? body.message : null;
  } catch {
    return null;
  }
}

function CatalogErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: 16 }} data-testid="smart-wizard-error">
      <p style={{ marginTop: 0, color: "var(--status-danger)", fontSize: 13 }}>{message}</p>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        The wizard reads <code>docs/data-model/metadata-catalog.json</code> from the API at request
        time. If this is a fresh checkout, run{" "}
        <code>node scripts/data-model/build-relationship-map.mjs</code> once to seed it.
      </p>
      <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function SmartWizardBody({
  catalog,
  onAdd,
  onClose
}: {
  catalog: MetadataCatalog;
  onAdd: (entry: WidgetConfigEntry) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<WizardChoice>(initialWizardChoice);
  const models = useMemo(() => visibleModels(catalog), [catalog]);
  const activeModel = choice.model ? catalog.models[choice.model] ?? null : null;
  const measures = useMemo(() => (activeModel ? measureFieldsOf(activeModel) : []), [activeModel]);
  const dimensions = useMemo(() => (activeModel ? dimensionFieldsOf(activeModel) : []), [activeModel]);

  const canSubmit = canBuildWizardConfig(choice);

  const submit = () => {
    const built = buildWizardWidgetFilters(choice, catalog);
    if (!built) return;
    const id = `smart-wizard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: WidgetConfigEntry = {
      id,
      // Wizard emits the standard custom-builder widget type so the existing
      // dashboard canvas / customise panel treats it like any other widget.
      type: CUSTOM_WIDGET_TYPE,
      visible: true,
      order: 0,
      config: { period: null, filters: built.filters }
    };
    onAdd(entry);
  };

  if (models.length === 0) {
    return (
      <div style={{ padding: 16 }} data-testid="smart-wizard-empty">
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--text-muted)" }}>
          No models are marked wizard-visible in the catalog yet. Curate{" "}
          <code>metadata-catalog.json</code> and set <code>wizardVisible: true</code> on the models
          you want to expose here.
        </p>
      </div>
    );
  }

  return (
    <div className="wg-form" style={{ display: "grid", gap: 8 }}>
      <label className="wg-form__label" htmlFor="smart-wizard-title">
        Widget title
      </label>
      <input
        id="smart-wizard-title"
        className="s7-input"
        value={choice.title}
        onChange={(e) => setChoice({ ...choice, title: e.target.value })}
        placeholder="Optional — a default is used when blank"
        data-testid="smart-wizard-title"
      />

      <label className="wg-form__label" htmlFor="smart-wizard-model">
        Model ({models.length} from catalog)
      </label>
      <select
        id="smart-wizard-model"
        className="s7-input"
        value={choice.model ?? ""}
        onChange={(e) =>
          setChoice({
            ...initialWizardChoice(),
            title: choice.title,
            chartType: choice.chartType,
            model: e.target.value || null
          })
        }
        data-testid="smart-wizard-model"
      >
        <option value="">— Select a model —</option>
        {models.map((m) => (
          <option key={m.name} value={m.name}>
            {m.domain} › {m.label}
          </option>
        ))}
      </select>

      {activeModel ? (
        <>
          <label className="wg-form__label" htmlFor="smart-wizard-measure">
            Measure field (optional — leave blank for record count)
          </label>
          <select
            id="smart-wizard-measure"
            className="s7-input"
            value={choice.measureField ?? ""}
            onChange={(e) => setChoice({ ...choice, measureField: e.target.value || null })}
            data-testid="smart-wizard-measure"
            disabled={measures.length === 0}
          >
            <option value="">— None (count records) —</option>
            {measures.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {measures.length === 0 ? (
            <p className="wg-form__hint">This model has no numeric fields in the catalog.</p>
          ) : null}

          <label className="wg-form__label" htmlFor="smart-wizard-dimension">
            Group by (optional)
          </label>
          <select
            id="smart-wizard-dimension"
            className="s7-input"
            value={choice.dimensionField ?? ""}
            onChange={(e) => setChoice({ ...choice, dimensionField: e.target.value || null })}
            data-testid="smart-wizard-dimension"
            disabled={dimensions.length === 0}
          >
            <option value="">— None —</option>
            {dimensions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <label className="wg-form__label" htmlFor="smart-wizard-chart">
            Chart type
          </label>
          <select
            id="smart-wizard-chart"
            className="s7-input"
            value={choice.chartType}
            onChange={(e) =>
              setChoice({ ...choice, chartType: e.target.value as CustomChartType })
            }
            data-testid="smart-wizard-chart"
          >
            {SMART_WIZARD_CHART_TYPES.map((c) => (
              <option key={c} value={c}>
                {CHART_LABEL[c]}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          disabled={!canSubmit}
          onClick={submit}
          data-testid="smart-wizard-add"
        >
          Add to dashboard
        </button>
      </div>
    </div>
  );
}
