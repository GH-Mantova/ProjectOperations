/**
 * reportExport — shared blob-download helper for BI report exports.
 *
 * Extracted from ReportsPage.tsx:156-188 (SLICE 6) so that both
 * ReportsPage and reportWidgetChrome can import it without duplication.
 *
 * Calling convention:
 *   const doExport = useReportExport(authFetch);
 *   await doExport({ reportKey, format, params });
 *
 * The helper:
 *  1. Builds the query string (format + any BI params).
 *  2. Hits GET /reporting/:reportKey/export?format=…&<params>.
 *  3. Streams the response blob.
 *  4. Derives the filename from Content-Disposition, falling back to
 *     "<reportKey>.<format>".
 *  5. Triggers a browser download via a temporary <a> element.
 *  6. Throws on a non-ok response so callers can set error state.
 */

export type ExportFormat = "xlsx" | "csv" | "pdf";

type ReportParamName = "from" | "to" | "projectId" | "clientId";
const VALID_PARAMS = new Set<ReportParamName>(["from", "to", "projectId", "clientId"]);

export type ExportParams = {
  reportKey: string;
  format: ExportFormat;
  /** Effective filters to forward as query params (invalid keys are silently dropped). */
  filters?: Record<string, unknown>;
};

export type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Execute a single BI export request and trigger a browser download.
 * Throws an Error if the server returns a non-ok status.
 */
export async function downloadReportExport(
  authFetch: AuthFetch,
  { reportKey, format, filters }: ExportParams
): Promise<void> {
  const query = new URLSearchParams();
  query.set("format", format);

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (!VALID_PARAMS.has(key as ReportParamName)) continue;
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }

  const response = await authFetch(`/reporting/${reportKey}/export?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Export failed.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `${reportKey}.${format}`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
