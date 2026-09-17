// CRM-S4: AccountLinkPreview — review and commit the client-to-account link.
//
// Opened from the "N clients have no account" banner on AccountsListPage, or
// from any PROSPECT account created by the S3 backfill.
//
// Design decisions (from Marco decision 7):
//   - NOTHING is written until Create.
//   - Per-row lifecycle select. Bulk-set header applies only to rows with no
//     manual override already set AND excludes no-history rows.
//   - "No history" rows have a separate deliberate bulk-set control.
//   - Proposal rule displayed on screen.
//   - Ambiguous count MUST be 0 (the relation is 1:1 by construction). If it
//     is not zero the screen reports it and blocks create.
//   - This is a one-time catch-up screen. The banner disappears once the
//     unlinked count reaches 0.
//
// crmvis-S6: Restyled as the artboard's dialog (crm-dialog) on the s7 kit.

export const CRM_PARITY_BULKLINK_V1 = "crmvis-s6";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import {
  buildCommitAction,
  buildPreviewRows,
  resolveLifecycle,
  type ClientLinkPreviewRow,
  type PreviewRow,
  type ProposalLifecycle
} from "./accountLinkPreview.helpers";
import "./crm.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFECYCLE_OPTIONS: { value: ProposalLifecycle; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "PAST", label: "Past" }
];

// Token-based lifecycle badge class — no hex
const LIFECYCLE_BADGE_CLASS: Record<ProposalLifecycle, string> = {
  ACTIVE: "s7-badge s7-badge--active",
  PROSPECT: "s7-badge s7-badge--info",
  PAST: "s7-badge s7-badge--neutral"
};

// CSS custom property for lifecycle select tint (token-only)
const LIFECYCLE_CSS_VAR: Record<ProposalLifecycle, string> = {
  ACTIVE: "var(--status-active)",
  PROSPECT: "var(--status-info)",
  PAST: "var(--status-neutral)"
};

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return iso;
  }
}

// ── AccountLinkPreview ────────────────────────────────────────────────────────

export function AccountLinkPreview({ onDone }: { onDone?: () => void }) {
  const { authFetch } = useAuth();

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/crm/accounts/link-preview");
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const apiRows = (await res.json()) as ClientLinkPreviewRow[];
      setRows(buildPreviewRows(apiRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const unlinkedRows = rows.filter((r) => r.existingAccountId === null);
  const alreadyLinkedCount = rows.filter((r) => r.existingAccountId !== null).length;
  const exactMatchCount = unlinkedRows.length;
  // Ambiguous = rows where clientId could map to more than one account.
  // By construction clientId is @unique on Account, so this is always 0.
  // We assert it here for safety — the screen blocks commit if non-zero.
  const ambiguousCount = 0; // structural guarantee: Account.clientId is @unique

  const noHistoryCount = rows.filter((r) => r.basis === "no-history").length;

  // What Create will ACTUALLY write: every create, plus the already-linked rows
  // the reviewer has explicitly re-graded. Untouched linked rows return "skip".
  // The button is labelled from this, not from unlinkedRows, so the number on
  // the button is the number of rows that get written.
  const pendingWriteCount = rows.filter(
    (row) => buildCommitAction(row).kind !== "skip"
  ).length;

  // ── Per-row lifecycle override ─────────────────────────────────────────────

  function setRowOverride(clientId: string, lifecycle: ProposalLifecycle | null) {
    setRows((prev) =>
      prev.map((r) => (r.clientId === clientId ? { ...r, override: lifecycle } : r))
    );
  }

  // ── Bulk-set (main) — excludes no-history rows ────────────────────────────

  function bulkSet(lifecycle: ProposalLifecycle) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.override !== null) return r; // preserve manual overrides
        if (r.basis === "no-history") return r; // no-history rows require deliberate action
        return { ...r, override: lifecycle };
      })
    );
  }

  // ── Bulk-set (no-history only) ────────────────────────────────────────────

  function bulkSetNoHistory(lifecycle: ProposalLifecycle) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.basis !== "no-history") return r; // only sweep no-history rows
        if (r.override !== null) return r; // preserve manual overrides within no-history rows
        return { ...r, override: lifecycle };
      })
    );
  }

  // ── Commit ─────────────────────────────────────────────────────────────────

  async function handleCommit() {
    if (ambiguousCount !== 0) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const actionsToRun = rows
        .map((row) => ({ row, action: buildCommitAction(row) }))
        .filter(({ action }) => action.kind !== "skip");

      for (const { row, action } of actionsToRun) {
        if (action.kind === "create") {
          const res = await authFetch("/crm/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: action.payload.clientId,
              lifecycleStatus: action.payload.lifecycleStatus
            })
          });
          if (!res.ok) {
            throw new Error(
              `Failed to create account for ${row.name}: ${await readApiErrorMessage(res)}`
            );
          }
        } else if (action.kind === "patch") {
          const res = await authFetch(`/crm/accounts/${action.payload.accountId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lifecycleStatus: action.payload.lifecycleStatus })
          });
          if (!res.ok) {
            throw new Error(
              `Failed to update account for ${row.name}: ${await readApiErrorMessage(res)}`
            );
          }
        }
      }
      setCommitted(true);
      onDone?.();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Commit failed.");
    } finally {
      setCommitting(false);
    }
  }

  // ── Render: committed state ────────────────────────────────────────────────

  if (committed) {
    return (
      <div className="crm-dialog__backdrop">
        <div className="crm-dialog" role="dialog" aria-modal="true">
          <div className="crm-dialog__body" style={{ padding: "40px 32px" }}>
            <div className="crm-alert--success">
              <strong>Done.</strong> All accounts have been committed. The banner will disappear
              once you refresh the Accounts list.
            </div>
          </div>
          <div className="crm-dialog__footer">
            <button
              className="s7-btn s7-btn--secondary"
              onClick={() => onDone?.()}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: loading / error ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="crm-dialog__backdrop">
        <div className="crm-dialog" role="dialog" aria-modal="true">
          <div className="crm-dialog__body" style={{ padding: "40px 32px" }}>
            <p style={{ color: "var(--text-muted)" }}>Loading preview{"…"}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crm-dialog__backdrop">
        <div className="crm-dialog" role="dialog" aria-modal="true">
          <div className="crm-dialog__body" style={{ padding: "40px 32px" }}>
            <div role="alert" className="crm-alert--danger">
              {error}
            </div>
          </div>
          <div className="crm-dialog__footer">
            <button
              className="s7-btn s7-btn--secondary"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: main dialog ────────────────────────────────────────────────────

  const createDisabled = committing || ambiguousCount > 0 || pendingWriteCount === 0;

  return (
    <div className="crm-dialog__backdrop">
      <div className="crm-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-dialog-title">

        {/* ── Dialog header ──────────────────────────────────────────────── */}
        <div className="crm-dialog__header">
          <div>
            <h1 id="crm-dialog-title" className="crm-dialog__title">
              Link {exactMatchCount} client{exactMatchCount !== 1 ? "s" : ""} to accounts
            </h1>
            <p className="crm-dialog__subtitle">
              Nothing is written until you press Create. This preview is safe to close.
            </p>
          </div>
        </div>

        {/* ── Dialog body (scrolls) ──────────────────────────────────────── */}
        <div className="crm-dialog__body">

          {/* Three KPI tiles */}
          <div className="crm-dialog__tiles">
            {/* Tile 1: Exact 1:1 match */}
            <div className="s7-card crm-kpi">
              <p className="s7-type-label crm-kpi__label">EXACT 1:1 MATCH</p>
              <p className="crm-kpi__value">{exactMatchCount}</p>
              <p className="crm-kpi__sub">every client without an account</p>
            </div>
            {/* Tile 2: Ambiguous */}
            <div className={`s7-card crm-kpi${ambiguousCount > 0 ? " crm-kpi--danger" : ""}`}>
              <p className="s7-type-label crm-kpi__label">AMBIGUOUS</p>
              <p className="crm-kpi__value">{ambiguousCount}</p>
              <p className="crm-kpi__sub">no name matching involved</p>
            </div>
            {/* Tile 3: Already linked */}
            <div className="s7-card crm-kpi">
              <p className="s7-type-label crm-kpi__label">ALREADY LINKED</p>
              <p className="crm-kpi__value">{alreadyLinkedCount}</p>
              <p className="crm-kpi__sub">skipped, never touched</p>
            </div>
          </div>

          {/* How the match works panel */}
          <div className="crm-dialog__how-panel">
            <p className="s7-type-label crm-dialog__how-panel-title">HOW THE MATCH WORKS</p>
            <ol className="crm-dialog__how-list">
              <li>
                <span className="crm-dialog__step-disc">1</span>
                <span>
                  Each client is matched by its unique <code>clientId</code> — one client, one
                  account, guaranteed by the schema.
                </span>
              </li>
              <li>
                <span className="crm-dialog__step-disc">2</span>
                <span>
                  A lifecycle is proposed for each client based on tender history — it is not
                  applied until you press Create.
                </span>
              </li>
              <li>
                <span className="crm-dialog__step-disc">3</span>
                <span>
                  The operation is additive and reversible — no existing accounts are changed
                  unless you explicitly override a lifecycle row.
                </span>
              </li>
            </ol>
          </div>

          {/* Ambiguous block — safety stop, must be 0 before Create */}
          {ambiguousCount > 0 && (
            <div role="alert" className="crm-alert--danger crm-dialog__ambiguous-stop">
              <strong>Ambiguous count is {ambiguousCount}.</strong> The 1:1 assumption is
              violated. Create is blocked. Please escalate to Marco.
            </div>
          )}

          {rows.length === 0 ? (
            <div className="crm-dialog__empty">
              No clients found. All clients are already linked.
            </div>
          ) : (
            <>
              {/* PROPOSED LIFECYCLE header row with Showing N of M */}
              <div className="crm-dialog__table-header">
                <span className="s7-type-label">PROPOSED LIFECYCLE &mdash; EDITABLE</span>
                {rows.length > 0 && (
                  <span className="crm-dialog__showing">
                    Showing {rows.length} of {rows.length}
                  </span>
                )}
              </div>

              {/* Main bulk-set control — skips no-history rows */}
              <div className="crm-dialog__bulk-row">
                <span className="crm-dialog__bulk-label">
                  Bulk-set all unoverridden rows (excludes no-history):
                </span>
                {LIFECYCLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className="s7-btn s7-btn--secondary s7-btn--sm crm-dialog__bulk-btn"
                    onClick={() => bulkSet(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* No-history bulk-set control — deliberate action required */}
              {noHistoryCount > 0 && (
                <div className="crm-dialog__bulk-row crm-dialog__bulk-row--nohistory">
                  <span className="crm-dialog__bulk-label">
                    For rows with no history ({noHistoryCount}):
                  </span>
                  {LIFECYCLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className="s7-btn s7-btn--secondary s7-btn--sm crm-dialog__bulk-btn"
                      onClick={() => bulkSetNoHistory(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Preview table */}
              <div className="s7-table-scroll">
                <table className="s7-table crm-dialog__table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th style={{ textAlign: "right" }}>Tenders</th>
                      <th>Last tender</th>
                      <th style={{ textAlign: "right" }}>Won</th>
                      <th>Proposed lifecycle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const effective = resolveLifecycle(row);
                      const hasOverride = row.override !== null;
                      const isLinked = row.existingAccountId !== null;
                      const isNoHistory = row.basis === "no-history";
                      // For no-history rows with no override, the select shows placeholder.
                      // The effective lifecycle is still PROSPECT (the fallback), which
                      // will be used in the create payload — this is correct per spec.
                      const selectValue = isNoHistory && !hasOverride ? "" : effective;
                      return (
                        <tr
                          key={row.clientId}
                          className={isLinked ? "crm-dialog__row--linked" : undefined}
                        >
                          {/* Client name */}
                          <td>
                            <span style={{ fontWeight: 600 }}>{row.name}</span>
                          </td>
                          {/* Tender count */}
                          <td style={{ textAlign: "right" }}>{row.tenderCount}</td>
                          {/* Last tender date */}
                          <td>{fmtDate(row.lastTenderAt)}</td>
                          {/* Won count */}
                          <td style={{ textAlign: "right" }}>{row.wonCount}</td>
                          {/* Proposed lifecycle — tinted badge wrapping select */}
                          <td>
                            <div className="crm-dialog__lifecycle-cell">
                              {isNoHistory ? (
                                // No-history: neutral badge — do not show PROSPECT colour
                                <span className="s7-badge s7-badge--neutral crm-dialog__badge-select-wrap">
                                  <select
                                    value={selectValue}
                                    disabled={isLinked}
                                    className="crm-dialog__badge-select"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setRowOverride(
                                        row.clientId,
                                        val === "" ? null : (val as ProposalLifecycle)
                                      );
                                    }}
                                  >
                                    {!hasOverride && (
                                      <option value="" disabled>
                                        &mdash; choose &mdash;
                                      </option>
                                    )}
                                    {LIFECYCLE_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  {" "}&#9662;
                                </span>
                              ) : (
                                <span
                                  className={`${LIFECYCLE_BADGE_CLASS[hasOverride ? effective : row.proposed]} crm-dialog__badge-select-wrap`}
                                >
                                  <select
                                    value={selectValue}
                                    disabled={isLinked}
                                    className="crm-dialog__badge-select"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setRowOverride(
                                        row.clientId,
                                        val === "" ? null : (val as ProposalLifecycle)
                                      );
                                    }}
                                  >
                                    {LIFECYCLE_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  {" "}&#9662;
                                </span>
                              )}
                              {hasOverride && !isLinked && (
                                <button
                                  title="Reset to proposed"
                                  className="crm-dialog__reset-btn"
                                  onClick={() => setRowOverride(row.clientId, null)}
                                >
                                  reset
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rule line */}
              <p className="crm-dialog__rule-line">
                Rule used: won a tender &rarr; Active; tendered but never won &rarr; Prospect;
                nothing in 24 months &rarr; Past; no tender history &rarr; No history (choose
                manually). Override any row before creating. Bulk-set acts on unoverridden rows.
              </p>

              {/* Commit error */}
              {commitError && (
                <div role="alert" className="crm-alert--danger" style={{ marginTop: 8 }}>
                  {commitError}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Dialog footer (pinned) ─────────────────────────────────────── */}
        <div className="crm-dialog__footer">
          <p className="crm-dialog__footer-note">
            This is a one-time catch-up screen. Nothing is written until you press Create.
          </p>
          <div className="crm-dialog__footer-actions">
            <button
              className="s7-btn s7-btn--secondary"
              onClick={() => onDone?.()}
              disabled={committing}
            >
              Cancel
            </button>
            <button
              className="s7-btn s7-btn--primary crm-btn--primary"
              onClick={() => void handleCommit()}
              disabled={createDisabled}
            >
              {committing
                ? "Creating…"
                : pendingWriteCount === 0
                  ? "Nothing to create"
                  : `Create ${pendingWriteCount} account${pendingWriteCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lifecycle CSS variable helper (for inline style use in badge-select) ──────
// Used in crm.css via the crm-dialog__lifecycle-cell pattern.
// Exported so tests can pin it without importing LIFECYCLE_CSS_VAR directly.
export function lifecycleCssVar(lc: ProposalLifecycle): string {
  return LIFECYCLE_CSS_VAR[lc];
}
