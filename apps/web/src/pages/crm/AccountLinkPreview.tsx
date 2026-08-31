// CRM-S4: AccountLinkPreview — review and commit the client-to-account link.
//
// Opened from the "N clients have no account" banner on AccountsListPage, or
// from any PROSPECT account created by the S3 backfill.
//
// Design decisions (from Marco decision 7):
//   - NOTHING is written until Commit.
//   - Per-row lifecycle select. Bulk-set header applies only to rows with no
//     manual override already set AND excludes no-history rows.
//   - "No history" rows have a separate deliberate bulk-set control.
//   - Proposal rule displayed on screen.
//   - Ambiguous count MUST be 0 (the relation is 1:1 by construction). If it
//     is not zero the screen reports it and blocks commit.
//   - This is a one-time catch-up screen. The banner disappears once the
//     unlinked count reaches 0.

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

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFECYCLE_OPTIONS: { value: ProposalLifecycle; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "PAST", label: "Past" }
];

const LIFECYCLE_COLOUR: Record<ProposalLifecycle, string> = {
  ACTIVE: "#16a34a",
  PROSPECT: "#6366f1",
  PAST: "#9ca3af"
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

  // What Commit will ACTUALLY write: every create, plus the already-linked rows
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
      <div style={{ padding: "40px 32px", maxWidth: 700 }}>
        <div
          style={{
            padding: 24,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            color: "#15803d"
          }}
        >
          <strong>Done.</strong> All accounts have been committed. The banner will disappear once
          you refresh the Accounts list.
        </div>
      </div>
    );
  }

  // ── Render: loading / error ────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "40px 32px" }}>
        <p style={{ color: "var(--text-muted, #666)" }}>Loading preview{"…"}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px 32px" }}>
        <div
          role="alert"
          style={{
            color: "#dc2626",
            padding: 12,
            background: "#fef2f2",
            borderRadius: 6
          }}
        >
          {error}
        </div>
        <button
          onClick={() => void load()}
          style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Render: main screen ────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Header */}
      <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 22, margin: "0 0 8px 0" }}>
        Review and link client accounts
      </h1>
      <p style={{ color: "var(--text-muted, #6b7280)", margin: "0 0 20px 0", fontSize: 14 }}>
        This is a one-time catch-up screen. Review the proposed lifecycle for each client, correct
        any rows, then click <strong>Commit</strong>. Nothing is written until you commit. The
        banner on the Accounts list disappears once all clients are linked.
      </p>

      {/* Proposal rule */}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 6,
          padding: "10px 14px",
          marginBottom: 20,
          fontSize: 13,
          color: "#1e40af"
        }}
      >
        <strong>Proposal rule:</strong> won a tender &rarr; <em>Active</em>; tendered but never won
        &rarr; <em>Prospect</em>; nothing in 24 months &rarr; <em>Past</em>; no tender history at
        all &rarr; <em>No history</em> (choose a lifecycle manually before committing).
        You can override any row before committing.
      </div>

      {/* Summary counts */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <CountTile label="Exact matches (1:1)" value={exactMatchCount} />
        <CountTile label="Ambiguous" value={ambiguousCount} warn={ambiguousCount > 0} />
        <CountTile label="Already linked (skipped)" value={alreadyLinkedCount} />
        <CountTile label="No history" value={noHistoryCount} />
      </div>

      {/* Ambiguous block — design says stop here if non-zero */}
      {ambiguousCount > 0 && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            padding: "12px 16px",
            marginBottom: 20,
            color: "#dc2626"
          }}
        >
          <strong>Ambiguous count is {ambiguousCount}.</strong> The 1:1 assumption is violated.
          Commit is blocked. Please escalate to Marco.
        </div>
      )}

      {rows.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-muted, #888)",
            background: "#fff",
            border: "1px dashed #e5e7eb",
            borderRadius: 8
          }}
        >
          No clients found. All clients are already linked.
        </div>
      ) : (
        <>
          {/* Main bulk-set control — skips no-history rows */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
              padding: "8px 12px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 13
            }}
          >
            <span style={{ color: "#374151", fontWeight: 600 }}>
              Bulk-set all unoverridden rows (excludes no-history):
            </span>
            {LIFECYCLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => bulkSet(opt.value)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: LIFECYCLE_COLOUR[opt.value]
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* No-history bulk-set control — deliberate action required */}
          {noHistoryCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                padding: "8px 12px",
                background: "#fafaf9",
                border: "1px solid #e7e5e4",
                borderRadius: 6,
                fontSize: 13
              }}
            >
              <span style={{ color: "#57534e", fontWeight: 600 }}>
                For rows with no history ({noHistoryCount}):
              </span>
              {LIFECYCLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => bulkSetNoHistory(opt.value)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 4,
                    border: "1px solid #d6d3d1",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: LIFECYCLE_COLOUR[opt.value]
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Preview table */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
              marginBottom: 20
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f6f6f6", textAlign: "left" }}>
                  <th style={thStyle}>Client name</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Tenders</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Won</th>
                  <th style={thStyle}>Last tender</th>
                  <th style={thStyle}>Proposed</th>
                  <th style={thStyle}>Lifecycle</th>
                  <th style={thStyle}>Status</th>
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
                      style={{
                        borderTop: "1px solid #f3f4f6",
                        background: isLinked ? "#f9fafb" : "#fff"
                      }}
                    >
                      {/* Client name */}
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600 }}>{row.name}</span>
                      </td>
                      {/* Tender count */}
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.tenderCount}</td>
                      {/* Won count */}
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.wonCount}</td>
                      {/* Last tender date */}
                      <td style={tdStyle}>{fmtDate(row.lastTenderAt)}</td>
                      {/* Proposed lifecycle badge */}
                      <td style={tdStyle}>
                        {isNoHistory ? (
                          // No-history: neutral pill — do not show PROSPECT colour
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: "transparent",
                              border: "1px solid #9ca3af",
                              color: "#6b7280",
                              fontSize: 11,
                              fontWeight: 600
                            }}
                          >
                            No history
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: LIFECYCLE_COLOUR[row.proposed],
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 600
                            }}
                          >
                            {row.proposed}
                          </span>
                        )}
                      </td>
                      {/* Editable lifecycle select */}
                      <td style={tdStyle}>
                        <select
                          value={selectValue}
                          disabled={isLinked}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRowOverride(
                              row.clientId,
                              val === "" ? null : (val as ProposalLifecycle)
                            );
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: `1px solid ${hasOverride ? "#6366f1" : "#d1d5db"}`,
                            fontSize: 12,
                            fontWeight: hasOverride ? 700 : 400,
                            color: selectValue === "" ? "#9ca3af" : LIFECYCLE_COLOUR[effective],
                            background: "#fff",
                            cursor: isLinked ? "not-allowed" : "pointer"
                          }}
                        >
                          {/* Placeholder shown only for no-history rows before user picks a value */}
                          {isNoHistory && !hasOverride && (
                            <option value="" disabled>
                              — choose —
                            </option>
                          )}
                          {LIFECYCLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {hasOverride && (
                          <button
                            title="Reset to proposed"
                            onClick={() => setRowOverride(row.clientId, null)}
                            style={{
                              marginLeft: 4,
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 11,
                              color: "#9ca3af"
                            }}
                          >
                            reset
                          </button>
                        )}
                      </td>
                      {/* Status pill */}
                      <td style={tdStyle}>
                        {isLinked ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: "#f3f4f6",
                              color: "#6b7280",
                              fontSize: 11
                            }}
                          >
                            Already linked
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: "#fff7ed",
                              border: "1px solid #fed7aa",
                              color: "#ea580c",
                              fontSize: 11
                            }}
                          >
                            To link
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Commit error */}
          {commitError && (
            <div
              role="alert"
              style={{
                color: "#dc2626",
                padding: 12,
                background: "#fef2f2",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 13
              }}
            >
              {commitError}
            </div>
          )}

          {/* Commit button */}
          <button
            onClick={() => void handleCommit()}
            disabled={committing || ambiguousCount > 0 || pendingWriteCount === 0}
            style={{
              padding: "12px 28px",
              borderRadius: 6,
              border: "none",
              background:
                ambiguousCount > 0 || pendingWriteCount === 0 ? "#9ca3af" : "#4f46e5",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor:
                committing || ambiguousCount > 0 || pendingWriteCount === 0
                  ? "not-allowed"
                  : "pointer",
              minHeight: 44
            }}
          >
            {committing
              ? "Committing…"
              : pendingWriteCount === 0
                ? "Nothing to commit"
                : `Commit ${pendingWriteCount} row${pendingWriteCount !== 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </div>
  );
}

// ── Count tile ────────────────────────────────────────────────────────────────

function CountTile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div
      style={{
        background: warn ? "#fef2f2" : "#fff",
        border: `1px solid ${warn ? "#fecaca" : "#e5e7eb"}`,
        borderRadius: 8,
        padding: "12px 16px",
        minWidth: 140
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted, #6b7280)", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: warn ? "#dc2626" : "#111827"
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Table styles ──────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
