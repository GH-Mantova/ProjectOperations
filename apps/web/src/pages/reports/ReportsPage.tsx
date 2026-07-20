import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { BarChartWidget, EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type ReportParamName = "from" | "to" | "projectId" | "clientId";

type ReportParameterSpec = {
  name: ReportParamName;
  label: string;
  type: "date" | "string";
  required?: boolean;
  helperText?: string;
};

type ReportColumnSpec = {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: "text" | "number" | "currency" | "percent" | "date";
};

type ReportChartSpec = {
  type: "bar";
  xKey: string;
  yKey: string;
  title: string;
  unit?: string;
};

type ReportDefinition = {
  key: string;
  title: string;
  description: string;
  parameters: ReportParameterSpec[];
  columns: ReportColumnSpec[];
  chart?: ReportChartSpec;
};

type ReportRunResponse = ReportDefinition & {
  params: Partial<Record<ReportParamName, string>>;
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number>;
  generatedAt: string;
};

type ExportFormat = "xlsx" | "csv" | "pdf";

function buildQuery(params: Partial<Record<ReportParamName, string>>): string {
  const search = new URLSearchParams();
  (Object.entries(params) as Array<[ReportParamName, string | undefined]>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") search.set(k, v);
  });
  const q = search.toString();
  return q ? `?${q}` : "";
}

function formatCell(value: string | number | null | undefined, column: ReportColumnSpec): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (column.format) {
    case "currency":
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0
      }).format(Number(value));
    case "percent":
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

export function ReportsPage() {
  const { authFetch } = useAuth();
  const [definitions, setDefinitions] = useState<ReportDefinition[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [params, setParams] = useState<Partial<Record<ReportParamName, string>>>({});
  const [report, setReport] = useState<ReportRunResponse | null>(null);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingDefs(true);
    authFetch("/reporting/definitions")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load report definitions.");
        const data = (await response.json()) as ReportDefinition[];
        if (cancelled) return;
        setDefinitions(data);
        setSelectedKey((current) => current ?? data[0]?.key ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingDefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const definition = useMemo(
    () => definitions?.find((def) => def.key === selectedKey) ?? null,
    [definitions, selectedKey]
  );

  useEffect(() => {
    setParams({});
    setReport(null);
    setError(null);
    if (!selectedKey) return;
    let cancelled = false;
    setLoadingReport(true);
    authFetch(`/reporting/${selectedKey}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not run report.");
        const data = (await response.json()) as ReportRunResponse;
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, selectedKey]);

  const runReport = useCallback(async () => {
    if (!selectedKey) return;
    setLoadingReport(true);
    setError(null);
    try {
      const response = await authFetch(`/reporting/${selectedKey}${buildQuery(params)}`);
      if (!response.ok) throw new Error("Could not run report.");
      const data = (await response.json()) as ReportRunResponse;
      setReport(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingReport(false);
    }
  }, [authFetch, selectedKey, params]);

  const doExport = useCallback(
    async (format: ExportFormat) => {
      if (!selectedKey) return;
      setExporting(format);
      setError(null);
      try {
        const query = new URLSearchParams();
        query.set("format", format);
        (Object.entries(params) as Array<[ReportParamName, string | undefined]>).forEach(([k, v]) => {
          if (v) query.set(k, v);
        });
        const response = await authFetch(`/reporting/${selectedKey}/export?${query.toString()}`);
        if (!response.ok) throw new Error("Export failed.");
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") ?? "";
        const match = /filename="?([^";]+)"?/i.exec(disposition);
        const filename = match?.[1] ?? `${selectedKey}.${format}`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setExporting(null);
      }
    },
    [authFetch, selectedKey, params]
  );

  const chartData = useMemo(() => {
    if (!report?.chart) return [];
    const { xKey, yKey } = report.chart;
    return report.rows.map((row) => ({
      label: String(row[xKey] ?? ""),
      value: Number(row[yKey] ?? 0)
    }));
  }, [report]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Reporting</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Reports</h1>
          <p className="s7-type-body" style={{ margin: "6px 0 0", color: "var(--text-secondary, #6b7280)" }}>
            Cross-module reporting surface — pick a report, apply filters, export to Excel / CSV / PDF.
          </p>
        </div>
      </header>

      {error ? (
        <div className="tender-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "flex-start" }}>
        <aside className="s7-card" style={{ padding: 12 }} aria-label="Report picker">
          <p className="s7-type-label" style={{ marginBottom: 8 }}>Available reports</p>
          {loadingDefs ? (
            <>
              <Skeleton height={40} />
              <Skeleton height={40} style={{ marginTop: 8 }} />
              <Skeleton height={40} style={{ marginTop: 8 }} />
            </>
          ) : definitions && definitions.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {definitions.map((def) => {
                const active = def.key === selectedKey;
                return (
                  <li key={def.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(def.key)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid",
                        borderColor: active ? "#005B61" : "transparent",
                        background: active ? "rgba(0,91,97,0.08)" : "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary, #111827)"
                      }}
                    >
                      <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{def.title}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary, #6b7280)", marginTop: 2 }}>
                        {def.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState heading="No reports available" />
          )}
        </aside>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!definition ? (
            <div className="s7-card" style={{ padding: 20 }}>
              <p style={{ color: "var(--text-secondary, #6b7280)" }}>Select a report to run it.</p>
            </div>
          ) : (
            <>
              <div className="s7-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }} aria-label="Report filters">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                  {definition.parameters.length === 0 ? (
                    <p style={{ color: "var(--text-secondary, #6b7280)", fontSize: 13 }}>This report has no filters.</p>
                  ) : (
                    definition.parameters.map((param) => (
                      <label key={param.name} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
                        <span className="s7-type-label">{param.label}</span>
                        <input
                          className="s7-input"
                          type={param.type === "date" ? "date" : "text"}
                          value={params[param.name] ?? ""}
                          onChange={(e) => setParams((prev) => ({ ...prev, [param.name]: e.target.value }))}
                          placeholder={param.helperText}
                          style={{ minHeight: 40 }}
                        />
                        {param.helperText ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted, #6b7280)" }}>{param.helperText}</span>
                        ) : null}
                      </label>
                    ))
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="s7-btn s7-btn--primary"
                      onClick={runReport}
                      disabled={loadingReport}
                      style={{ minHeight: 40 }}
                    >
                      {loadingReport ? "Running…" : "Run report"}
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost"
                      onClick={() => doExport("xlsx")}
                      disabled={!report || exporting !== null}
                      style={{ minHeight: 40 }}
                    >
                      {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost"
                      onClick={() => doExport("csv")}
                      disabled={!report || exporting !== null}
                      style={{ minHeight: 40 }}
                    >
                      {exporting === "csv" ? "Exporting…" : "Export CSV"}
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost"
                      onClick={() => doExport("pdf")}
                      disabled={!report || exporting !== null}
                      style={{ minHeight: 40 }}
                    >
                      {exporting === "pdf" ? "Exporting…" : "Export PDF"}
                    </button>
                  </div>
                </div>
              </div>

              {report?.chart && chartData.length > 0 ? (
                <BarChartWidget
                  title={report.chart.title}
                  data={chartData}
                  unit={report.chart.unit}
                  yAxisFormatter={
                    report.chart.unit
                      ? (value: number) => `${value}${report.chart!.unit === "%" ? "%" : ` ${report.chart!.unit}`}`
                      : undefined
                  }
                  tooltipFormatter={
                    report.chart.unit
                      ? (value: number) => `${value}${report.chart!.unit === "%" ? "%" : ` ${report.chart!.unit}`}`
                      : undefined
                  }
                />
              ) : null}

              <section className="s7-card" style={{ padding: 0, overflowX: "auto" }} aria-label="Report table">
                {loadingReport ? (
                  <div style={{ padding: 16 }}>
                    <Skeleton height={32} />
                    <Skeleton height={24} style={{ marginTop: 8 }} />
                    <Skeleton height={24} style={{ marginTop: 8 }} />
                  </div>
                ) : !report ? (
                  <EmptyState heading="No data yet" subtext="Run the report to see rows." />
                ) : report.rows.length === 0 ? (
                  <EmptyState heading="No rows for this filter set" subtext="Widen the filter window or clear filters." />
                ) : (
                  <table className="s7-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {definition.columns.map((column) => (
                          <th key={column.key} style={column.align === "right" ? cellHeaderRight : cellHeader}>
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row, idx) => (
                        <tr key={idx}>
                          {definition.columns.map((column) => (
                            <td key={column.key} style={column.align === "right" ? cellBodyRight : cellBody}>
                              {formatCell(row[column.key], column)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {report.totals ? (
                        <tr>
                          {definition.columns.map((column, idx) => {
                            const val =
                              idx === 0
                                ? "Total"
                                : report.totals && column.key in report.totals
                                  ? formatCell(report.totals[column.key], column)
                                  : "";
                            return (
                              <td
                                key={column.key}
                                style={{
                                  ...(column.align === "right" ? cellBodyRight : cellBody),
                                  fontWeight: 600,
                                  background: "var(--surface-subtle, #f3f4f6)"
                                }}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                )}
              </section>
              {report ? (
                <p style={{ fontSize: 12, color: "var(--text-muted, #6b7280)" }}>
                  Generated {new Date(report.generatedAt).toLocaleString("en-AU")}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const cellHeader: CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  borderBottom: "1px solid var(--surface-border, #e5e7eb)",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-secondary, #6b7280)"
};
const cellHeaderRight: CSSProperties = { ...cellHeader, textAlign: "right" };
const cellBody: CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--surface-border, #e5e7eb)",
  fontSize: 14,
  color: "var(--text-primary, #111827)"
};
const cellBodyRight: CSSProperties = { ...cellBody, textAlign: "right" };
