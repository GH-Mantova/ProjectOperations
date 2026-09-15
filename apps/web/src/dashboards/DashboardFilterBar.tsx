/**
 * DashboardFilterBar — view-time filter surface for dashboards.
 *
 * DASHBOARD_FILTER_BAR_V1
 *
 * Mounted by DashboardCanvas above the widget grid. Writes directly into
 * dashboardFilters (via props callbacks) — view-time only, never persisted.
 * Saving filter defaults remains the Customise drawer's job.
 *
 * Carries:
 *  - Period preset selector (resolves to real from/to for report widgets, since
 *    the API only accepts from/to, not a period enum).
 *  - Real `from` / `to` date inputs (divergence from preset is flagged).
 *  - `clientId` and `estimatorId` text inputs.
 *  - Window-resolution line: shows which widgets obey the period vs. the date
 *    range vs. neither.
 *  - Filter-reachability chips per widget: "applied" / "available" / "not a parameter".
 *  - Per-widget override badge when config.filters diverges from the bar.
 *  - Dashboard-level export (beside the per-widget strip already shipped).
 *  - Refresh + as-at stamp.
 *
 * Colour discipline: every colour value is a bare CSS variable reference —
 * no hex literals, no var(--token, #fallback) — so the component works
 * correctly in both light and dark themes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReportDefinitionSummary } from "./widgets/reportRegistry";
import {
  PERIOD_LABELS,
  PERIOD_ORDER,
  periodStart,
  resolveEffectiveFilters,
  type UserDashboardConfig,
  type WidgetConfigEntry,
  type WidgetFilters,
  type WidgetPeriod
} from "./types";

// ── Period → from/to conversion ───────────────────────────────────────────────

function periodToFromTo(period: WidgetPeriod): { from: string; to: string } {
  const to = new Date();
  const from = periodStart(period);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

function toDateString(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return "";
}

// ── Filter-reachability for a single widget ───────────────────────────────────

export type ReachabilityChip = "applied" | "available" | "not-a-parameter";

export type FilterReachability = {
  from: ReachabilityChip;
  to: ReachabilityChip;
  clientId: ReachabilityChip;
  estimatorId: ReachabilityChip;
};

/** Derive reachability chips for a widget given its definition's parameter list
 *  and the current bar values.
 *
 *  - "applied"          — the bar has a non-empty value AND the definition accepts it.
 *  - "available"        — the definition accepts it but the bar value is empty.
 *  - "not-a-parameter"  — the definition does not declare this parameter.
 */
export function deriveReachability(
  params: Array<{ name: string; type: string }>,
  barFilters: WidgetFilters
): FilterReachability {
  const paramNames = new Set(params.map((p) => p.name));

  function chip(key: string): ReachabilityChip {
    if (!paramNames.has(key)) return "not-a-parameter";
    const v = barFilters[key];
    const hasValue = v !== undefined && v !== null && v !== "";
    return hasValue ? "applied" : "available";
  }

  return {
    from: chip("from"),
    to: chip("to"),
    clientId: chip("clientId"),
    estimatorId: chip("estimatorId")
  };
}

// ── Override detection ────────────────────────────────────────────────────────

/** True when a widget's config.filters diverge from the bar filters on any key
 *  that the bar controls. An explicit empty string in config.filters is an
 *  override that clears the bar value (plan §5 rule 2). */
export function hasWidgetOverride(
  widgetFilters: WidgetFilters | undefined,
  barFilters: WidgetFilters
): boolean {
  if (!widgetFilters) return false;
  for (const key of Object.keys(widgetFilters)) {
    const barVal = barFilters[key];
    const widgetVal = widgetFilters[key];
    if (widgetVal !== barVal) return true;
  }
  return false;
}

// ── Chip component ────────────────────────────────────────────────────────────

function Chip({
  label,
  reach
}: {
  label: string;
  reach: ReachabilityChip;
}) {
  // All colour values are bare CSS custom properties — no hex literals.
  const chipStyle: React.CSSProperties =
    reach === "applied"
      ? {
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: "2px 7px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.4,
          border: "1px solid",
          whiteSpace: "nowrap",
          background: "var(--status-success-subtle)",
          color: "var(--status-success)",
          borderColor: "var(--status-success)"
        }
      : reach === "available"
        ? {
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 7px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1.4,
            border: "1px solid",
            whiteSpace: "nowrap",
            background: "var(--surface-subtle)",
            color: "var(--text-muted)",
            borderColor: "var(--border-subtle)"
          }
        : {
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 7px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1.4,
            border: "1px solid",
            whiteSpace: "nowrap",
            background: "transparent",
            color: "var(--text-disabled)",
            borderColor: "var(--border-subtle)",
            textDecoration: "line-through" as const
          };

  const dot =
    reach === "applied" ? "●" : reach === "available" ? "○" : "–";

  const title =
    reach === "not-a-parameter"
      ? `${label} is not a parameter of this report`
      : reach === "applied"
        ? `${label} filter is active`
        : `${label} filter available but not set`;

  return (
    <span style={chipStyle} title={title}>
      <span aria-hidden>{dot}</span>
      {label}
    </span>
  );
}

// ── Override badge ────────────────────────────────────────────────────────────

function OverrideBadge() {
  return (
    <span
      title="This widget has per-widget filter overrides that differ from the filter bar"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1.4,
        border: "1px solid",
        background: "var(--status-warning-subtle)",
        color: "var(--status-warning)",
        borderColor: "var(--status-warning)"
      }}
    >
      override
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export type DashboardFilterBarProps = {
  /** The active dashboard config — read-only; bar does not mutate saved config. */
  config: UserDashboardConfig;
  /** Current view-time filters (controlled from DashboardCanvas). */
  barFilters: WidgetFilters;
  /** Called when any filter field changes. */
  onFiltersChange: (next: WidgetFilters) => void;
  /** All visible widgets (for reachability panel). */
  widgets: WidgetConfigEntry[];
  /** Report definitions fetched from /reporting/definitions — for reachability. */
  definitions: ReportDefinitionSummary[];
  /** Timestamp of last data refresh (ISO string), or null while loading. */
  asAt: string | null;
  /** True while any widget is loading. */
  loading: boolean;
  /** Called when the user clicks Refresh. */
  onRefresh: () => void;
  /** Called to export all report widgets at once (dashboard-level export). */
  onDashboardExport?: (format: "xlsx" | "csv") => void;
};

export function DashboardFilterBar({
  config,
  barFilters,
  onFiltersChange,
  widgets,
  definitions,
  asAt,
  loading,
  onRefresh,
  onDashboardExport
}: DashboardFilterBarProps) {
  const [reachabilityOpen, setReachabilityOpen] = useState(false);

  // Derive from/to from the bar or fall back to the global period.
  const barFrom = toDateString(barFilters.from);
  const barTo = toDateString(barFilters.to);
  const barClientId = String(barFilters.clientId ?? "");
  const barEstimatorId = String(barFilters.estimatorId ?? "");

  // Track whether the dates were hand-typed (diverged from preset).
  const presetFromTo = useMemo(
    () => periodToFromTo(config.period as WidgetPeriod),
    [config.period]
  );
  const diverged =
    (barFrom !== "" && barFrom !== presetFromTo.from) ||
    (barTo !== "" && barTo !== presetFromTo.to);

  // Report widgets present on this dashboard.
  const reportWidgets = useMemo(
    () =>
      widgets.filter(
        (w) => w.type.startsWith("report:table:") || w.type.startsWith("report:chart:")
      ),
    [widgets]
  );

  // Map reportKey → definition for reachability lookup.
  const defsByKey = useMemo(() => {
    const map = new Map<string, ReportDefinitionSummary>();
    for (const def of definitions) map.set(def.key, def);
    return map;
  }, [definitions]);

  // Extract report key from widget type "report:table:<key>" or "report:chart:<key>".
  const reportKeyOf = (type: string) => type.split(":")[2] ?? "";

  // Count report widgets for the dashboard export label.
  const reportCount = reportWidgets.length;

  const setFilter = (key: string, value: string) => {
    onFiltersChange({ ...barFilters, [key]: value });
  };

  // When the preset selector changes, also update from/to.
  const handlePresetChange = (period: WidgetPeriod) => {
    const { from, to } = periodToFromTo(period);
    onFiltersChange({ ...barFilters, from, to });
  };

  // Which preset, if any, matches the current from/to?
  const matchingPreset = useMemo((): WidgetPeriod | "custom" => {
    if (!barFrom && !barTo) return config.period as WidgetPeriod;
    for (const p of PERIOD_ORDER) {
      const { from, to } = periodToFromTo(p);
      if (from === barFrom && to === barTo) return p;
    }
    return "custom";
  }, [barFrom, barTo, config.period]);

  // Summary of widgets by filter responsiveness.
  const windowSummary = useMemo(() => {
    let period = 0; // ops / forms / tendering — honour globalPeriod
    let dateRange = 0; // report widgets — honour from/to
    let neither = 0; // no date params at all

    for (const w of widgets) {
      const isReport =
        w.type.startsWith("report:table:") || w.type.startsWith("report:chart:");
      if (isReport) {
        const def = defsByKey.get(reportKeyOf(w.type));
        const hasDate = def?.parameters.some((p) => p.type === "date") ?? false;
        if (hasDate) {
          dateRange++;
        } else {
          neither++;
        }
      } else {
        // Non-report widgets that call resolvePeriod (ops, forms, tendering).
        period++;
      }
    }
    return { period, dateRange, neither };
  }, [widgets, defsByKey]);

  return (
    <div
      data-testid="dashboard-filter-bar"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--surface-border)",
        borderRadius: 8,
        marginBottom: 12,
        overflow: "hidden"
      }}
    >
      {/* ── Main filter row ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 10,
          padding: "10px 14px"
        }}
      >
        {/* Period preset */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 130 }}>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontWeight: 500
            }}
          >
            Period
          </span>
          <select
            className="s7-input"
            style={{ padding: "4px 8px", fontSize: 13, height: 32 }}
            value={matchingPreset}
            onChange={(e) => {
              const v = e.target.value as WidgetPeriod | "custom";
              if (v !== "custom") handlePresetChange(v);
            }}
            aria-label="Period preset"
          >
            {PERIOD_ORDER.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
            {matchingPreset === "custom" ? (
              <option value="custom">Custom range</option>
            ) : null}
          </select>
        </label>

        {/* From date */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            From
          </span>
          <input
            className="s7-input"
            type="date"
            style={{ padding: "4px 8px", fontSize: 13, height: 32 }}
            value={barFrom}
            onChange={(e) => setFilter("from", e.target.value)}
            aria-label="From date"
            data-testid="filter-bar-from"
          />
        </label>

        {/* To date */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            To
          </span>
          <input
            className="s7-input"
            type="date"
            style={{ padding: "4px 8px", fontSize: 13, height: 32 }}
            value={barTo}
            onChange={(e) => setFilter("to", e.target.value)}
            aria-label="To date"
            data-testid="filter-bar-to"
          />
        </label>

        {/* Client */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            Client
          </span>
          <input
            className="s7-input"
            type="text"
            style={{ padding: "4px 8px", fontSize: 13, height: 32 }}
            value={barClientId}
            onChange={(e) => setFilter("clientId", e.target.value)}
            placeholder="Client ID"
            aria-label="Client ID filter"
            data-testid="filter-bar-clientId"
          />
        </label>

        {/* Estimator */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            Estimator
          </span>
          <input
            className="s7-input"
            type="text"
            style={{ padding: "4px 8px", fontSize: 13, height: 32 }}
            value={barEstimatorId}
            onChange={(e) => setFilter("estimatorId", e.target.value)}
            placeholder="Estimator ID"
            aria-label="Estimator ID filter"
            data-testid="filter-bar-estimatorId"
          />
        </label>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Refresh + as-at stamp */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            onClick={onRefresh}
            disabled={loading}
            data-testid="filter-bar-refresh"
            aria-label="Refresh dashboard data"
          >
            {loading ? "Loading" : "↻ Refresh"}
          </button>
          {asAt ? (
            <span
              style={{ fontSize: 10, color: "var(--text-muted)" }}
              data-testid="filter-bar-asat"
            >
              As at {new Date(asAt).toLocaleString("en-AU", { hour12: true })}
            </span>
          ) : null}
        </div>

        {/* Dashboard-level export */}
        {onDashboardExport && reportCount > 0 ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => onDashboardExport("xlsx")}
              data-testid="filter-bar-export-xlsx"
              title={`Export all ${reportCount} report widget${reportCount !== 1 ? "s" : ""} as Excel`}
            >
              Export Excel ({reportCount})
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => onDashboardExport("csv")}
              data-testid="filter-bar-export-csv"
              title={`Export all ${reportCount} report widget${reportCount !== 1 ? "s" : ""} as CSV`}
            >
              Export CSV ({reportCount})
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Window-resolution line ───────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          padding: "5px 14px 6px",
          borderTop: "1px solid var(--surface-border)",
          background: "var(--surface-subtle)",
          fontSize: 11,
          color: "var(--text-muted)"
        }}
        data-testid="filter-bar-window-resolution"
      >
        <span>Window:</span>
        {windowSummary.period > 0 ? (
          <span title="These widgets honour the period selector (ops, forms, tendering)">
            <b style={{ color: "var(--text-primary)" }}>{windowSummary.period}</b>{" "}
            use period
          </span>
        ) : null}
        {windowSummary.dateRange > 0 ? (
          <span title="These report widgets honour the from/to date range">
            {windowSummary.period > 0 ? <span aria-hidden> · </span> : null}
            <b style={{ color: "var(--text-primary)" }}>{windowSummary.dateRange}</b>{" "}
            use date range
          </span>
        ) : null}
        {windowSummary.neither > 0 ? (
          <span title="These report widgets declare no date parameters — all-time">
            {windowSummary.period > 0 || windowSummary.dateRange > 0 ? (
              <span aria-hidden> · </span>
            ) : null}
            <b style={{ color: "var(--text-primary)" }}>{windowSummary.neither}</b>{" "}
            all-time
          </span>
        ) : null}
        {diverged ? (
          <span
            style={{
              marginLeft: 6,
              padding: "1px 6px",
              borderRadius: 999,
              background: "var(--status-warning-subtle)",
              color: "var(--status-warning)",
              fontWeight: 600,
              border: "1px solid var(--status-warning)"
            }}
            title="The date range has been hand-typed and no longer matches the period preset"
          >
            custom range
          </span>
        ) : null}

        {/* Reachability toggle */}
        {reportWidgets.length > 0 ? (
          <button
            type="button"
            style={{
              marginLeft: "auto",
              fontSize: 11,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              textDecoration: "underline",
              padding: 0
            }}
            onClick={() => setReachabilityOpen((o) => !o)}
            data-testid="filter-bar-reachability-toggle"
          >
            {reachabilityOpen ? "Hide" : "Show"} filter reach per widget
          </button>
        ) : null}
      </div>

      {/* ── Reachability panel ───────────────────────────────────────────── */}
      {reachabilityOpen && reportWidgets.length > 0 ? (
        <div
          data-testid="filter-bar-reachability-panel"
          style={{
            borderTop: "1px solid var(--surface-border)",
            padding: "8px 14px 10px"
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              margin: "0 0 8px 0"
            }}
          >
            applied (set) · available (not set) · not a parameter
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reportWidgets.map((w) => {
              const key = reportKeyOf(w.type);
              const def = defsByKey.get(key);
              const params = def?.parameters ?? [];
              const reach = deriveReachability(params, {
                ...barFilters,
                from: barFrom || presetFromTo.from,
                to: barTo || presetFromTo.to
              });
              const override = hasWidgetOverride(w.config.filters, {
                ...barFilters,
                from: barFrom || presetFromTo.from,
                to: barTo || presetFromTo.to
              });
              const title = def?.title ?? w.type;

              return (
                <div
                  key={w.id}
                  data-testid={`reachability-row-${key}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 5
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      minWidth: 160
                    }}
                  >
                    {title}
                  </span>
                  {override ? <OverrideBadge /> : null}
                  <Chip label="from" reach={reach.from} />
                  <Chip label="to" reach={reach.to} />
                  <Chip label="clientId" reach={reach.clientId} />
                  <Chip label="estimatorId" reach={reach.estimatorId} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── useDashboardBarFilters — ephemeral filter state hook ──────────────────────

/** Manages the view-time bar filter state inside DashboardCanvas.
 *  Never written to the saved config — that is the Customise drawer's job. */
export function useDashboardBarFilters(initialConfig: UserDashboardConfig | null) {
  const [barFilters, setBarFilters] = useState<WidgetFilters>({});
  const [asAt, setAsAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Initialise from/to from the global period when the dashboard first loads.
  const initialisedRef = useRef(false);
  useEffect(() => {
    if (!initialConfig || initialisedRef.current) return;
    initialisedRef.current = true;
    const { from, to } = periodToFromTo(initialConfig.period as WidgetPeriod);
    setBarFilters({ from, to });
  }, [initialConfig]);

  // Update as-at stamp whenever data is "refreshed".
  useEffect(() => {
    setAsAt(new Date().toISOString());
  }, [refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setAsAt(new Date().toISOString());
  }, []);

  return { barFilters, setBarFilters, asAt, refreshKey, refresh };
}
