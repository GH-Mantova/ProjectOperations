/**
 * ReportTableWidget — generic dashboard widget that renders one BI report as a
 * table of rows + optional totals row. The reportKey is bound at registration
 * time via makeReportTableWidget(); the widget itself is stateless beyond the
 * per-instance WidgetSubConfig.filters.
 *
 * Design notes (plan §6.1 — widget bootstrap timing):
 * - `reportKey` is closed over at factory time, so there is no import-time
 *   async; each widget instance is an ordinary React component.
 * - Filters are read from `config.filters` (WidgetSubConfig.filters), which
 *   is the SLICE 5 composition slot. SLICE 3 widgets do not yet merge
 *   dashboard-level filters — that is SLICE 5's job.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { resolveEffectiveFilters, type WidgetProps } from "../types";
import { ReportWidgetChrome } from "./reportWidgetChrome";

// ── Shared types (mirrors reporting.service.ts, local to avoid cross-layer
//   import — see plan §7 "out of scope: rewriting the BI reporting layer")

type ReportColumnSpec = {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: "text" | "number" | "currency" | "percent" | "date";
};

type ReportRunResponse = {
  key: string;
  title: string;
  description: string;
  columns: ReportColumnSpec[];
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number>;
  generatedAt: string;
};

type ReportParamName = "from" | "to" | "projectId" | "clientId";

const VALID_PARAMS = new Set<ReportParamName>(["from", "to", "projectId", "clientId"]);

function buildQuery(filters: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (!VALID_PARAMS.has(k as ReportParamName)) continue;
    if (v !== undefined && v !== null && v !== "") {
      search.set(k, String(v));
    }
  }
  const q = search.toString();
  return q ? `?${q}` : "";
}

/** Mirrors formatCell in ReportsPage.tsx — same logic, co-located so the
 *  widget can be tested independently. */
function formatCell(
  value: string | number | null | undefined,
  column: ReportColumnSpec
): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (column.format) {
    case "currency":
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0
      }).format(Number(value));
    case "percent":
      // W1 from the parity audit: render percent as pre-formatted text with
      // trailing %, right-aligned. No WidgetField schema change required.
      return `${Number(value)}%`;
    case "number":
      return new Intl.NumberFormat("en-AU").format(Number(value));
    case "date":
      if (typeof value === "string") return value.slice(0, 10);
      return String(value);
    default:
      return String(value);
  }
}

const cellHeader: CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: "1px solid var(--surface-border, #e5e7eb)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-secondary, #6b7280)",
  whiteSpace: "nowrap"
};
const cellHeaderRight: CSSProperties = { ...cellHeader, textAlign: "right" };
const cellBody: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid var(--surface-border, #e5e7eb)",
  fontSize: 13,
  color: "var(--text-primary, #111827)"
};
const cellBodyRight: CSSProperties = { ...cellBody, textAlign: "right" };
const cellTotals: CSSProperties = {
  ...cellBody,
  fontWeight: 600,
  background: "var(--surface-subtle, #f3f4f6)"
};
const cellTotalsRight: CSSProperties = { ...cellTotals, textAlign: "right" };

type ReportTableState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ok"; data: ReportRunResponse };

function ReportTable({
  reportKey,
  config,
  dashboardFilters,
  onLoadingChange
}: {
  reportKey: string;
  config: WidgetProps["config"];
  dashboardFilters?: WidgetProps["dashboardFilters"];
  /** Notifies the parent wrapper when loading state changes (SLICE 6). */
  onLoadingChange?: (loading: boolean) => void;
}) {
  const { authFetch } = useAuth();
  const [state, setState] = useState<ReportTableState>({ status: "loading" });

  // SLICE 5: resolve effective filters — widget overrides dashboard (plan §5).
  const effectiveFilters = resolveEffectiveFilters(dashboardFilters, config.filters);
  const query = buildQuery(effectiveFilters);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    onLoadingChange?.(true);
    authFetch(`/reporting/${reportKey}${query}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text().catch(() => "Unknown error");
          setState({ status: "error", message: text });
          onLoadingChange?.(false);
          return;
        }
        const data = (await res.json()) as ReportRunResponse;
        if (cancelled) return;
        setState(
          data.rows.length === 0
            ? { status: "empty" }
            : { status: "ok", data }
        );
        onLoadingChange?.(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: (err as Error).message });
        onLoadingChange?.(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, reportKey, query, onLoadingChange]);

  if (state.status === "loading") {
    return (
      <div style={{ padding: 14 }}>
        <Skeleton height={32} />
        <Skeleton height={24} style={{ marginTop: 8 }} />
        <Skeleton height={24} style={{ marginTop: 8 }} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p
        role="alert"
        style={{ padding: 14, color: "var(--status-danger, #dc2626)", fontSize: 13 }}
      >
        {state.message}
      </p>
    );
  }

  if (state.status === "empty") {
    return (
      <p style={{ padding: 14, color: "var(--text-muted, #6b7280)", fontSize: 13 }}>
        No rows for this filter set.
      </p>
    );
  }

  const { data } = state;

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        className="s7-table"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th
                key={col.key}
                style={col.align === "right" ? cellHeaderRight : cellHeader}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={idx}>
              {data.columns.map((col) => (
                <td
                  key={col.key}
                  style={col.align === "right" ? cellBodyRight : cellBody}
                >
                  {formatCell(row[col.key], col)}
                </td>
              ))}
            </tr>
          ))}
          {data.totals ? (
            <tr>
              {data.columns.map((col, idx) => {
                const val =
                  idx === 0
                    ? "Total"
                    : data.totals && col.key in data.totals
                      ? formatCell(data.totals[col.key], col)
                      : "";
                return (
                  <td
                    key={col.key}
                    style={col.align === "right" ? cellTotalsRight : cellTotals}
                  >
                    {val}
                  </td>
                );
              })}
            </tr>
          ) : null}
        </tbody>
      </table>
      <p
        style={{
          padding: "6px 14px",
          fontSize: 11,
          color: "var(--text-muted, #6b7280)"
        }}
      >
        Generated {new Date(data.generatedAt).toLocaleString("en-AU")}
      </p>
    </div>
  );
}

/** Factory — binds a fixed reportKey into a WidgetProps-compatible component.
 *  Called by reportRegistry.ts at registration time; each report gets its own
 *  component instance with the key closed over.
 *
 *  SLICE 5: dashboardFilters is forwarded from WidgetProps so the widget can
 *  resolve effectiveFilters = { ...dashboardFilters, ...config.filters }.
 *  SLICE 6: mounts ReportWidgetChrome (export buttons) below the table;
 *  disabled while the table is loading. */
export function makeReportTableWidget(reportKey: string) {
  // Named component (uppercase) so react-hooks/rules-of-hooks recognises it.
  function ReportTableWithChrome({ config, dashboardFilters }: WidgetProps) {
    const [loading, setLoading] = useState(true);
    // Stable callback so the child's useEffect dependency array stays stable.
    const handleLoadingChange = useRef((v: boolean) => setLoading(v)).current;

    const effectiveFilters = resolveEffectiveFilters(dashboardFilters, config.filters);

    return (
      <div
        data-testid={`report-table-${reportKey}`}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <div style={{ flex: 1, overflow: "auto" }}>
          <ReportTable
            reportKey={reportKey}
            config={config}
            dashboardFilters={dashboardFilters}
            onLoadingChange={handleLoadingChange}
          />
        </div>
        <ReportWidgetChrome
          reportKey={reportKey}
          filters={effectiveFilters}
          disabled={loading}
        />
      </div>
    );
  }
  ReportTableWithChrome.displayName = `ReportTableWidget(${reportKey})`;
  return ReportTableWithChrome;
}

/** Re-exported for tests that need to poke the formatting logic directly. */
export { formatCell };
