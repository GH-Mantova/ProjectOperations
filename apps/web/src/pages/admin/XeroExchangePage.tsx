/**
 * CFX-4 — Xero file exchange admin surface.
 *
 * Two "Download CSV" buttons (Clients, Vendors) point at the CFX-4 export
 * endpoints. One "Include bank details" checkbox flips the includeBankDetails
 * query param on both links. Defaults OFF because BSB + account are AU
 * banking PII (plan §7.5); every export is audited server-side.
 *
 * Files match Xero's contact-import format; custom fields are never included
 * (plan §2 decision 3 — Xero rejects unknown columns on import).
 */

import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";

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
  const [includeBankDetails, setIncludeBankDetails] = useState(false);

  const clientsHref = buildDownloadHref("clients", includeBankDetails);
  const vendorsHref = buildDownloadHref("vendors", includeBankDetails);

  return (
    <div style={{ padding: 24, maxWidth: 780 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 className="s7-type-page-heading" style={{ marginTop: 0, marginBottom: 4 }}>
          Xero file exchange
        </h1>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          Download clients and vendors as Xero-format contact-import CSVs.
        </p>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            cursor: "pointer"
          }}
        >
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
      </section>
    </div>
  );
}
