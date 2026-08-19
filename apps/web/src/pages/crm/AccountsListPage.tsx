import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";

// NAV-2: Accounts index — Client-360 landing page.
// Lists all non-archived accounts with summary stats.
// Links each row to AccountDetailPage at /crm/accounts/:id.

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountSummaryRow = {
  id: string;
  name: string;
  type: string;
  lifecycle: "PROSPECT" | "ACTIVE" | "PAST";
  winRate: number | null;
  openOpportunitiesCount: number;
  lastContactedAt: string | null;
  goingCold: boolean;
};

// ── Helper: goingCold logic (pure, exported for unit tests) ───────────────────

/**
 * Derives the going-cold flag from a summary row.
 * Mirrors the server-side deriveGoingCold — exported so the vitest suite
 * can assert the four cases without a DOM or fetch mock.
 *
 * Rules:
 *   - lifecycle === "PAST"  → never cold
 *   - lastContactedAt null  → not cold (no evidence)
 *   - lastContactedAt > 14 days ago + lifecycle !== PAST → cold
 */
export function computeGoingCold(
  lifecycle: string,
  lastContactedAt: string | Date | null,
  nowMs = Date.now()
): boolean {
  if (lifecycle === "PAST") return false;
  if (!lastContactedAt) return false;
  const ts =
    typeof lastContactedAt === "string"
      ? new Date(lastContactedAt).getTime()
      : lastContactedAt.getTime();
  if (!Number.isFinite(ts)) return false;
  const diffDays = (nowMs - ts) / (1000 * 60 * 60 * 24);
  return diffDays > 14;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LIFECYCLE_LABEL: Record<string, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  PAST: "Past"
};

const LIFECYCLE_COLOUR: Record<string, string> = {
  PROSPECT: "#6366f1",
  ACTIVE: "#16a34a",
  PAST: "#9ca3af"
};

const TYPE_LABEL: Record<string, string> = {
  CLIENT: "Client",
  PROSPECT: "Prospect",
  HEAD_CONTRACTOR: "Head contractor",
  SUBCONTRACTOR: "Subcontractor",
  PARTNER: "Partner",
  OTHER: "Other"
};

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtPct(val: number | null): string {
  if (val == null) return "—";
  return `${Math.round(val * 100)}%`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return "Today";
    if (days === 1) return "1d ago";
    if (days < 30) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (days < 90) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return iso;
  }
}

// ── Stat tile helper ──────────────────────────────────────────────────────────

function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? "#fff7ed" : "#fff",
        border: `1px solid ${accent ? "#fed7aa" : "#e5e7eb"}`,
        borderRadius: 8,
        padding: 16,
        minWidth: 120
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ? "#ea580c" : "#111827" }}>{value}</div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AccountsListPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AccountSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/crm/accounts/summary");
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setRows((await res.json()) as AccountSummaryRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived stat tiles ─────────────────────────────────────────────────────

  const totalAccounts = rows.length;
  const activeCount = rows.filter((r) => r.lifecycle === "ACTIVE").length;
  const prospectCount = rows.filter((r) => r.lifecycle === "PROSPECT").length;
  const goingColdCount = rows.filter((r) => r.goingCold).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20
        }}
      >
        <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: 0 }}>
          Accounts
        </h1>
        <button
          onClick={() => void load()}
          style={{
            padding: "10px 18px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
            minHeight: 44
          }}
        >
          Refresh
        </button>
      </div>

      {/* Loading / error */}
      {loading && (
        <p style={{ color: "var(--text-muted, #666)" }}>Loading accounts…</p>
      )}
      {error && (
        <div
          role="alert"
          style={{
            color: "#dc2626",
            padding: 12,
            background: "#fef2f2",
            borderRadius: 6,
            marginBottom: 16
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stat tiles */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <StatTile label="Total accounts" value={totalAccounts} />
            <StatTile label="Active" value={activeCount} />
            <StatTile label="Prospects" value={prospectCount} />
            <StatTile label="Going cold" value={goingColdCount} accent={goingColdCount > 0} />
          </div>

          {/* Empty state */}
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
              No accounts yet. Accounts are created from the Directory when a Client is promoted to
              an Account.
            </div>
          ) : (
            /* Accounts table */
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                overflow: "hidden"
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f6f6f6", textAlign: "left" }}>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Lifecycle</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Win rate</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Open opps</th>
                    <th style={thStyle}>Last contact</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/crm/accounts/${row.id}`)}
                      style={{
                        borderTop: "1px solid #f3f4f6",
                        cursor: "pointer",
                        transition: "background 0.1s"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "";
                      }}
                    >
                      {/* Name — linked */}
                      <td style={tdStyle}>
                        <span
                          style={{ color: "#6366f1", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/accounts/${row.id}`);
                          }}
                        >
                          {row.name}
                        </span>
                      </td>
                      {/* Type */}
                      <td style={tdStyle}>{TYPE_LABEL[row.type] ?? row.type}</td>
                      {/* Lifecycle badge */}
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 12,
                            background: LIFECYCLE_COLOUR[row.lifecycle] ?? "#9ca3af",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600
                          }}
                        >
                          {LIFECYCLE_LABEL[row.lifecycle] ?? row.lifecycle}
                        </span>
                      </td>
                      {/* Win rate */}
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtPct(row.winRate)}</td>
                      {/* Open opportunities */}
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.openOpportunitiesCount}</td>
                      {/* Last contact */}
                      <td style={tdStyle}>{fmtRelative(row.lastContactedAt)}</td>
                      {/* Going cold chip */}
                      <td style={tdStyle}>
                        {row.goingCold && (
                          <span
                            aria-label="Going cold"
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: 12,
                              background: "#fff7ed",
                              border: "1px solid #fed7aa",
                              color: "#ea580c",
                              fontSize: 11,
                              fontWeight: 600
                            }}
                          >
                            Going cold
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Table styles ──────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
