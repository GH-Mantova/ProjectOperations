/**
 * CFX-4 + CFX-5 — Xero file exchange admin surface.
 *
 * Export section (CFX-4):
 *   Two "Download CSV" buttons (Clients, Vendors) point at the CFX-4 export
 *   endpoints. One "Include bank details" checkbox flips the includeBankDetails
 *   query param on both links. Defaults OFF because BSB + account are AU
 *   banking PII (plan §7.5); every export is audited server-side.
 *
 * Import section (CFX-5):
 *   File picker → column mapping → preview (dry-run) → confirm + commit.
 *   Custom fields are never written from an import (plan §2 decision 3).
 *   Existing bank details on a matched row are flagged as "would overwrite" and
 *   the caller must check a per-row confirmation checkbox before committing.
 *   Auto-commit after preview is intentionally NOT provided.
 */

import { useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";
import {
  CsvColumnMapper,
  autoSuggestMapping,
  buildColumnMap
} from "../../components/CsvColumnMapper";

// ── Pure helpers (exported for tests) ──────────────────────────────────────

export type ExportKind = "clients" | "vendors";

/**
 * Build the CFX-4 CSV download URL. Kept pure + exported so unit tests can
 * assert URL shape without mounting the component.
 */
export function buildDownloadHref(kind: ExportKind, includeBankDetails: boolean): string {
  const param = includeBankDetails ? "true" : "false";
  return `/api/v1/xero/export/${kind}.csv?includeBankDetails=${param}`;
}

export const BANK_DETAIL_WARNING =
  "Bank details are sensitive PII. Every export is audited by user + timestamp.";

export const CUSTOM_FIELDS_NOTE =
  "File matches Xero's contact-import format. Custom fields are not included.";

// ── CFX-5 import types ─────────────────────────────────────────────────────

export type ImportAppliesTo = "CLIENT" | "VENDOR";

export type DiffEntry = {
  field: string;
  from: unknown;
  to: unknown;
  wouldOverwriteBank?: boolean;
};

export type ImportRow = {
  rowIndex: number;
  action: "matched-by-xero-id" | "matched-by-name" | "new" | "rejected";
  matchedRecordId?: string;
  diffs?: DiffEntry[];
  reason?: string;
};

export type ImportPreview = {
  previewId: string;
  appliesTo: ImportAppliesTo;
  rows: ImportRow[];
  fileSha256: string;
  createdAt: string;
};

/** Read the first line of a CSV buffer to get the header names. */
export function parseHeadersFromCsv(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  if (!firstLine.trim()) return [];
  // Minimal header parse: split on commas, strip outer quotes and whitespace.
  return firstLine.split(",").map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  });
}

/**
 * Build the initial header-mapping state from detected headers by
 * auto-suggesting known Xero column names.
 */
export function buildInitialMappings(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};
  const usedKeys = new Set<string>();
  for (const header of headers) {
    const suggestion = autoSuggestMapping(header);
    if (suggestion && !usedKeys.has(suggestion)) {
      mappings[header] = suggestion;
      usedKeys.add(suggestion);
    } else {
      mappings[header] = "";
    }
  }
  return mappings;
}

// ── Component ──────────────────────────────────────────────────────────────

export function XeroExchangePage() {
  const { user } = useAuth();

  if (!user) return null;
  if (!can(user, "platform.admin")) {
    return (
      <NoAccess required="platform.admin" title="Xero file exchange requires platform administration" />
    );
  }

  return <XeroExchangeContent />;
}

function XeroExchangeContent() {
  // ── Export state (CFX-4) ────────────────────────────────────────────────
  const [includeBankDetails, setIncludeBankDetails] = useState(false);

  const clientsHref = buildDownloadHref("clients", includeBankDetails);
  const vendorsHref = buildDownloadHref("vendors", includeBankDetails);

  // ── Import state (CFX-5) ────────────────────────────────────────────────
  const [importAppliesTo, setImportAppliesTo] = useState<ImportAppliesTo>("CLIENT");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [headerMappings, setHeaderMappings] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  // Per-row bank-overwrite confirmations: Set of matchedRecordIds.
  const [confirmedBankIds, setConfirmedBankIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ──────────────────────────────────────────────────────
  async function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0] ?? null;
    setImportFile(file);
    setPreview(null);
    setPreviewError(null);
    setCommitResult(null);
    setCommitError(null);
    setConfirmedBankIds(new Set());

    if (!file) {
      setImportHeaders([]);
      setHeaderMappings({});
      return;
    }

    const text = await file.text();
    const headers = parseHeadersFromCsv(text);
    setImportHeaders(headers);
    setHeaderMappings(buildInitialMappings(headers));
  }

  // ── Preview (dry-run) ───────────────────────────────────────────────────
  async function handlePreview() {
    if (!importFile) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    setCommitResult(null);
    setCommitError(null);
    setConfirmedBankIds(new Set());

    try {
      const columnMap = buildColumnMap(headerMappings);
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("appliesTo", importAppliesTo);
      formData.append("columnMap", JSON.stringify(columnMap));

      const res = await fetch("/api/v1/xero/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Server error: ${res.status}`);
      }

      const data = (await res.json()) as ImportPreview;
      setPreview(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Commit ──────────────────────────────────────────────────────────────
  async function handleCommit() {
    if (!preview) return;
    setCommitLoading(true);
    setCommitError(null);

    try {
      const res = await fetch("/api/v1/xero/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          previewId: preview.previewId,
          confirmedOverwriteBankRecordIds: Array.from(confirmedBankIds)
        })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Server error: ${res.status}`);
      }

      const data = (await res.json()) as { inserted: number; updated: number; skipped: number };
      setCommitResult(data);
      setPreview(null);

      // Reset file input so the user can upload a new file.
      setImportFile(null);
      setImportHeaders([]);
      setHeaderMappings({});
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitLoading(false);
    }
  }

  // ── Bank overwrite toggle ───────────────────────────────────────────────
  function toggleBankConfirm(recordId: string, checked: boolean) {
    setConfirmedBankIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(recordId);
      else next.delete(recordId);
      return next;
    });
  }

  // Count rows with bank-overwrite warnings that have not yet been confirmed.
  const unconfirmedBankRows = preview?.rows.filter(
    (row) =>
      row.matchedRecordId &&
      !confirmedBankIds.has(row.matchedRecordId) &&
      row.diffs?.some((diff) => diff.wouldOverwriteBank)
  ) ?? [];

  const canCommit = preview !== null && !commitLoading;

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 className="s7-type-page-heading" style={{ marginTop: 0, marginBottom: 4 }}>
          Xero file exchange
        </h1>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          Download and upload contacts as Xero-format CSVs.
        </p>
      </header>

      {/* ── Export section (CFX-4) ────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>
          Export
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeBankDetails}
              onChange={(ev) => setIncludeBankDetails(ev.target.checked)}
              aria-describedby="cfx4-bank-warning"
            />
            <span>Include bank details (BSB + Account #)</span>
          </label>

          {includeBankDetails && (
            <div
              id="cfx4-bank-warning"
              role="alert"
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: "var(--surface-warning, #fffbeb)",
                color: "var(--text-warning, #b45309)",
                border: "1px solid var(--border-warning, #fcd34d)",
                fontSize: 13
              }}
            >
              {BANK_DETAIL_WARNING}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={clientsHref}
              className="s7-btn s7-btn--primary"
              data-testid="download-clients"
              download
              style={{ textDecoration: "none" }}
            >
              Download clients CSV
            </a>
            <a
              href={vendorsHref}
              className="s7-btn s7-btn--primary"
              data-testid="download-vendors"
              download
              style={{ textDecoration: "none" }}
            >
              Download vendors CSV
            </a>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            {CUSTOM_FIELDS_NOTE}
          </p>
        </div>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--border-default, #e5e7eb)", margin: "0 0 28px" }} />

      {/* ── Import section (CFX-5) ────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 4 }}>
          Import CSV
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 16px" }}>
          Upload a Xero-format contact CSV to import. Preview the changes first — no data is
          written until you confirm. Custom fields are never imported.
        </p>

        {commitResult && (
          <div
            role="status"
            style={{
              padding: "12px 16px",
              borderRadius: 6,
              background: "var(--surface-success, #f0fdf4)",
              color: "var(--text-success, #166534)",
              border: "1px solid var(--border-success, #bbf7d0)",
              marginBottom: 16
            }}
            data-testid="commit-result"
          >
            Import complete: {commitResult.inserted} inserted, {commitResult.updated} updated,{" "}
            {commitResult.skipped} skipped.
          </div>
        )}

        {/* File picker + appliesTo picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
              Contact type
            </label>
            <select
              value={importAppliesTo}
              onChange={(ev) => setImportAppliesTo(ev.target.value as ImportAppliesTo)}
              data-testid="import-applies-to"
              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 4, border: "1px solid var(--border-default, #d1d5db)" }}
            >
              <option value="CLIENT">Clients</option>
              <option value="VENDOR">Vendors / Subcontractors</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
              CSV file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              data-testid="import-file-input"
              style={{ fontSize: 13 }}
            />
          </div>
        </div>

        {/* Column mapper */}
        {importHeaders.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>
              Map columns
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px" }}>
              Match each CSV header to the corresponding field. Unmapped headers (— ignore —) are
              skipped. Custom fields are never written from an import.
            </p>
            <CsvColumnMapper
              headers={importHeaders}
              headerMappings={headerMappings}
              onChange={setHeaderMappings}
            />
          </div>
        )}

        {/* Preview button */}
        {importFile && importHeaders.length > 0 && !preview && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handlePreview}
              disabled={previewLoading}
              data-testid="preview-btn"
              className="s7-btn s7-btn--primary"
            >
              {previewLoading ? "Previewing…" : "Preview changes"}
            </button>
          </div>
        )}

        {previewError && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: 6,
              background: "var(--surface-error, #fef2f2)",
              color: "var(--text-error, #991b1b)",
              border: "1px solid var(--border-error, #fca5a5)",
              fontSize: 13,
              marginBottom: 16
            }}
            data-testid="preview-error"
          >
            {previewError}
          </div>
        )}

        {/* Preview results table */}
        {preview && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>
              Preview results — {preview.rows.length} row{preview.rows.length !== 1 ? "s" : ""}
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
                data-testid="preview-table"
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-default, #e5e7eb)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", width: 60 }}>#</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", width: 160 }}>Action</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Diffs / Info</th>
                    <th style={{ textAlign: "center", padding: "6px 8px", width: 120 }}>
                      Confirm bank overwrite
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const hasBankWarning = row.diffs?.some((diff) => diff.wouldOverwriteBank);
                    const isConfirmed =
                      row.matchedRecordId !== undefined &&
                      confirmedBankIds.has(row.matchedRecordId);

                    return (
                      <tr
                        key={row.rowIndex}
                        style={{
                          borderBottom: "1px solid var(--border-subtle, #f3f4f6)",
                          background:
                            row.action === "rejected"
                              ? "var(--surface-error-subtle, #fef2f2)"
                              : hasBankWarning && !isConfirmed
                              ? "var(--surface-warning-subtle, #fffbeb)"
                              : undefined
                        }}
                      >
                        <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                          {row.rowIndex + 1}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <ActionBadge action={row.action} />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {row.action === "rejected" && (
                            <span style={{ color: "var(--text-error, #991b1b)" }}>
                              {row.reason}
                            </span>
                          )}
                          {row.diffs && row.diffs.length > 0 && (
                            <DiffList diffs={row.diffs} />
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          {hasBankWarning && row.matchedRecordId && (
                            <label
                              style={{ cursor: "pointer" }}
                              title="Check to allow overwriting existing bank details for this record"
                            >
                              <input
                                type="checkbox"
                                checked={isConfirmed}
                                onChange={(ev) =>
                                  toggleBankConfirm(row.matchedRecordId!, ev.target.checked)
                                }
                                data-testid={`bank-confirm-${row.matchedRecordId}`}
                                aria-label={`Confirm bank overwrite for row ${row.rowIndex + 1}`}
                              />
                            </label>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {unconfirmedBankRows.length > 0 && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "var(--surface-warning, #fffbeb)",
                  color: "var(--text-warning, #b45309)",
                  border: "1px solid var(--border-warning, #fcd34d)",
                  fontSize: 13
                }}
              >
                {unconfirmedBankRows.length} row
                {unconfirmedBankRows.length !== 1 ? "s" : ""} would overwrite existing bank
                details. Check the confirmation checkbox on each row to allow the overwrite, or
                leave unchecked to skip those bank fields.
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={handleCommit}
                disabled={!canCommit}
                data-testid="commit-btn"
                className="s7-btn s7-btn--primary"
              >
                {commitLoading ? "Importing…" : "Confirm and import"}
              </button>
              <button
                onClick={() => {
                  setPreview(null);
                  setConfirmedBankIds(new Set());
                }}
                className="s7-btn s7-btn--secondary"
                data-testid="cancel-preview-btn"
              >
                Cancel
              </button>
            </div>

            {commitError && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "var(--surface-error, #fef2f2)",
                  color: "var(--text-error, #991b1b)",
                  border: "1px solid var(--border-error, #fca5a5)",
                  fontSize: 13
                }}
                data-testid="commit-error"
              >
                {commitError}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: ImportRow["action"] }) {
  const colours: Record<ImportRow["action"], string> = {
    "matched-by-xero-id": "#dbeafe",
    "matched-by-name": "#ede9fe",
    new: "#dcfce7",
    rejected: "#fee2e2"
  };
  const labels: Record<ImportRow["action"], string> = {
    "matched-by-xero-id": "Matched (Xero ID)",
    "matched-by-name": "Matched (name)",
    new: "New",
    rejected: "Rejected"
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: colours[action],
        color: "inherit"
      }}
    >
      {labels[action]}
    </span>
  );
}

function DiffList({ diffs }: { diffs: DiffEntry[] }) {
  return (
    <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc" }}>
      {diffs.map((diff, idx) => (
        <li key={idx} style={{ marginBottom: 2 }}>
          <strong>{diff.field}</strong>:{" "}
          <span style={{ color: "var(--text-muted)" }}>
            {diff.from === null || diff.from === undefined || diff.from === ""
              ? "(empty)"
              : String(diff.from)}
          </span>{" "}
          &rarr; <strong>{String(diff.to)}</strong>
          {diff.wouldOverwriteBank && (
            <span
              style={{
                marginLeft: 6,
                color: "var(--text-error, #991b1b)",
                fontWeight: 700,
                fontSize: 11
              }}
              title="This would overwrite existing bank details"
              data-testid="bank-overwrite-flag"
            >
              [BANK]
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
