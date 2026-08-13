/**
 * ReportWidgetChrome — small shared export-button strip for report widgets.
 *
 * Renders three ghost buttons (Excel / CSV / PDF) that each trigger a
 * blob-download via the shared reportExport helper. Disabled while the widget
 * data is still loading OR while an export is in flight.
 *
 * SLICE 6 of the reporting-dashboard plan. Both reportTableWidget and
 * reportChartWidget mount this component inside their widget frame.
 *
 * Props:
 *  - reportKey: the BI report key (bound at factory time).
 *  - filters:   effective filters (post-composition) forwarded to the export URL.
 *  - disabled:  true while the widget is loading its data.
 *
 * The component is intentionally presentation-only — it owns no data fetch.
 */

import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { downloadReportExport, type ExportFormat } from "./reportExport";

export type ReportWidgetChromeProps = {
  reportKey: string;
  /** Effective filters (dashboard + widget merged) to pass to the export URL. */
  filters: Record<string, unknown>;
  /** True while the parent widget is loading its rows — disables all buttons. */
  disabled?: boolean;
};

const FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: "xlsx", label: "Excel" },
  { format: "csv", label: "CSV" },
  { format: "pdf", label: "PDF" }
];

export function ReportWidgetChrome({
  reportKey,
  filters,
  disabled = false
}: ReportWidgetChromeProps) {
  const { authFetch } = useAuth();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    setError(null);
    try {
      await downloadReportExport(authFetch, { reportKey, format, filters });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div
      data-testid={`report-widget-chrome-${reportKey}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderTop: "1px solid var(--surface-border, #e5e7eb)",
        background: "var(--surface-subtle, #f9fafb)"
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-muted, #6b7280)",
          marginRight: 4
        }}
      >
        Export:
      </span>
      {FORMATS.map(({ format, label }) => (
        <button
          key={format}
          type="button"
          data-testid={`export-${format}-${reportKey}`}
          className="s7-btn s7-btn--ghost"
          disabled={disabled || exporting !== null}
          onClick={() => void handleExport(format)}
          style={{ fontSize: 12, padding: "3px 10px", minHeight: 28 }}
        >
          {exporting === format ? "…" : label}
        </button>
      ))}
      {error ? (
        <span
          role="alert"
          style={{ fontSize: 11, color: "var(--status-danger, #dc2626)", marginLeft: 4 }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
