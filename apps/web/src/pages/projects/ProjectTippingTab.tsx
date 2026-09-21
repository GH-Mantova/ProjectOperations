/**
 * ProjectTippingTab
 *
 * Displays accepted tip recommendations for a project, including rows planned
 * at tender stage (source = "tender") and rows planned after award (source = "job").
 * All figures are read-only snapshots -- the log never recalculates.
 *
 * Matches the ops-m2b mock-up exactly:
 *   - Three summary tiles: Planned loads / Planned tonnes / Planned tipping cost
 *   - Table: Accepted, Facility, Waste type, Tonnes, Distance, Disposal fee, Travel, Total,
 *     Planned at (Tender / Job chip), By
 *   - Total row
 *   - Empty state verbatim from the mock-up
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// ---- Types -----------------------------------------------------------------

type TippingRow = {
  id: string;
  createdAt: string;
  facilityName: string;
  wasteTypeCode: string;
  loadTonnes: string;
  distanceKm: string;
  disposalFee: string;
  travelCost: string;
  totalCost: string;
  source: "tender" | "job";
  createdBy: { firstName: string; lastName: string } | null;
};

type TippingSummary = {
  rows: TippingRow[];
  loads: number;
  tonnes: string;
  disposal: string;
  travel: string;
  total: string;
};

// ---- Helpers ---------------------------------------------------------------

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function fmtCurrency(s: string): string {
  const n = Number(s);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(n)
    : s;
}

function fmtTonnes(s: string): string {
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(3) : s;
}

// ---- Chip ------------------------------------------------------------------

function SourceChip({ source }: { source: "tender" | "job" }) {
  const isTender = source === "tender";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10.5,
        fontWeight: 700,
        padding: "1px 7px",
        borderRadius: 4,
        border: `1px solid ${isTender ? "var(--brand-accent-dark)" : "var(--brand-primary)"}`,
        color: isTender ? "var(--brand-accent-dark)" : "var(--brand-primary)",
        background: isTender ? "color-mix(in srgb, var(--status-warning) 12%, transparent)" : "var(--brand-primary-light)"
      }}
    >
      {isTender ? "Tender" : "Job"}
    </span>
  );
}

// ---- Main component --------------------------------------------------------

export function ProjectTippingTab({ projectId }: { projectId: string }) {
  const { authFetch } = useAuth();
  const [summary, setSummary] = useState<TippingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/waste/recommendations?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Could not load tipping data.");
      }
      setSummary((await res.json()) as TippingSummary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Loading tipping data...</p>;
  }

  if (error) {
    return <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p>;
  }

  if (!summary) return null;

  const { rows, loads, tonnes, disposal, travel, total } = summary;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Summary tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10
        }}
      >
        {/* Tile: Planned loads */}
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "10px 12px"
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Planned loads
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {loads}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            accepted tip recommendations
          </div>
        </div>

        {/* Tile: Planned tonnes */}
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "10px 12px"
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Planned tonnes
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtTonnes(tonnes)} t
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {rows.length === 0
              ? "no waste types"
              : `across ${new Set(rows.map((r) => r.wasteTypeCode)).size} waste type${
                  new Set(rows.map((r) => r.wasteTypeCode)).size === 1 ? "" : "s"
                }`}
          </div>
        </div>

        {/* Tile: Planned tipping cost */}
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "10px 12px"
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Planned tipping cost
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {fmtCurrency(total)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            disposal {fmtCurrency(disposal)} &middot; travel {fmtCurrency(travel)}
          </div>
        </div>
      </div>

      {/* Table or empty state */}
      {rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          No tipping planned for this job yet. Use Tip Finder to pick a facility &mdash; accepted
          picks appear here.
        </p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-default)", borderRadius: 8 }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: 12.5,
              minWidth: 820
            }}
          >
            <thead>
              <tr>
                {["Accepted", "Facility", "Waste type", "Tonnes", "Distance", "Disposal fee", "Travel", "Total", "Planned at", "By"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        background: "var(--surface-subtle)",
                        textAlign: ["Tonnes", "Distance", "Disposal fee", "Travel", "Total"].includes(h)
                          ? "right"
                          : "left",
                        fontSize: 10.5,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        padding: "7px 10px",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: "7px 10px", borderTop: "1px solid var(--surface-subtle)", whiteSpace: "nowrap" }}>
                    {fmtDate(row.createdAt)}
                  </td>
                  <td style={{ padding: "7px 10px", borderTop: "1px solid var(--surface-subtle)" }}>
                    {row.facilityName}
                  </td>
                  <td style={{ padding: "7px 10px", borderTop: "1px solid var(--surface-subtle)" }}>
                    {row.wasteTypeCode}
                  </td>
                  <td
                    style={{
                      padding: "7px 10px",
                      borderTop: "1px solid var(--surface-subtle)",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {fmtTonnes(row.loadTonnes)}
                  </td>
                  <td
                    style={{
                      padding: "7px 10px",
                      borderTop: "1px solid var(--surface-subtle)",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {Number(row.distanceKm).toFixed(1)} km
                  </td>
                  <td
                    style={{
                      padding: "7px 10px",
                      borderTop: "1px solid var(--surface-subtle)",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {fmtCurrency(row.disposalFee)}
                  </td>
                  <td
                    style={{
                      padding: "7px 10px",
                      borderTop: "1px solid var(--surface-subtle)",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {fmtCurrency(row.travelCost)}
                  </td>
                  <td
                    style={{
                      padding: "7px 10px",
                      borderTop: "1px solid var(--surface-subtle)",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {fmtCurrency(row.totalCost)}
                  </td>
                  <td style={{ padding: "7px 10px", borderTop: "1px solid var(--surface-subtle)", whiteSpace: "nowrap" }}>
                    <SourceChip source={row.source} />
                  </td>
                  <td style={{ padding: "7px 10px", borderTop: "1px solid var(--surface-subtle)", whiteSpace: "nowrap" }}>
                    {row.createdBy
                      ? `${row.createdBy.firstName[0] ?? ""}. ${row.createdBy.lastName}`
                      : "-"}
                  </td>
                </tr>
              ))}

              {/* Total row */}
              <tr>
                <td
                  colSpan={3}
                  style={{
                    padding: "7px 10px",
                    borderTop: "1px solid var(--border-default)",
                    fontWeight: 700,
                    background: "var(--surface-subtle)"
                  }}
                >
                  Planned tipping cost
                </td>
                <td
                  style={{
                    padding: "7px 10px",
                    borderTop: "1px solid var(--border-default)",
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    background: "var(--surface-subtle)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {fmtTonnes(tonnes)}
                </td>
                <td
                  style={{
                    padding: "7px 10px",
                    borderTop: "1px solid var(--border-default)",
                    background: "var(--surface-subtle)"
                  }}
                />
                <td
                  style={{
                    padding: "7px 10px",
                    borderTop: "1px solid var(--border-default)",
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    background: "var(--surface-subtle)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {fmtCurrency(disposal)}
                </td>
                <td
                  style={{
                    padding: "7px 10px",
                    borderTop: "1px solid var(--border-default)",
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    background: "var(--surface-subtle)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {fmtCurrency(travel)}
                </td>
                <td
                  style={{
                    padding: "7px 10px",
                    borderTop: "1px solid var(--border-default)",
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    background: "var(--surface-subtle)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {fmtCurrency(total)}
                </td>
                <td
                  colSpan={2}
                  style={{
                    padding: "7px 10px",
                    borderTop: "1px solid var(--border-default)",
                    background: "var(--surface-subtle)"
                  }}
                />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
        Read-only. Each row is a tip recommendation someone accepted, with the price as it stood
        that day &mdash; the log never recalculates. <strong>Tender</strong> rows were planned while
        this job was still a tender; <strong>Job</strong> rows were planned after award.
      </p>
    </div>
  );
}
