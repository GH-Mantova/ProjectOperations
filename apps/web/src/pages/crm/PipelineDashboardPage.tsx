import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// CRM-6: Pipeline + win/loss dashboard.
// Read-only surface over TenderOutcome (win/loss capture) and
// Opportunity/Account roll-ups. No mutation happens here.

type Stage = "open" | "new" | "qualified" | "quoting";

type StageBucket = {
  stage: Stage;
  count: number;
  grossValue: number;
  weightedValue: number;
};

type StageBlock = {
  buckets: StageBucket[];
  totals: { count: number; grossValue: number; weightedValue: number };
};

type WinRateRow = {
  key: string;
  label: string;
  won: number;
  lost: number;
  noBid: number;
  total: number;
  winRate: number;
  wonValue: number;
};

type StalledRow = {
  id: string;
  title: string;
  stage: string;
  clientId: string;
  clientName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  estimatedValue: number;
  weightedValue: number;
  nextActionAt: string | null;
  updatedAt: string;
  daysSinceUpdate: number;
};

type CoverageSummary = {
  totalAccounts: number;
  activeAccounts: number;
  prospectAccounts: number;
  pastAccounts: number;
  accountsWithPrimaryContact: number;
  accountsWithoutPrimaryContact: number;
  primaryContactCoverageRate: number;
};

type DashboardPayload = {
  byStage: StageBlock;
  winRates: {
    byClient: WinRateRow[];
    bySector: WinRateRow[];
    bySource: WinRateRow[];
    byEstimator: WinRateRow[];
  };
  stalled: { thresholdDays: number; items: StalledRow[]; count: number };
  relationshipCoverage: CoverageSummary;
};

type GroupBy = "client" | "sector" | "source" | "estimator";

const STAGE_LABELS: Record<Stage, string> = {
  open: "Open",
  new: "New",
  qualified: "Qualified",
  quoting: "Quoting"
};

const GROUP_BY_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "client", label: "Client" },
  { key: "sector", label: "Sector" },
  { key: "source", label: "Source" },
  { key: "estimator", label: "Estimator" }
];

function fmtMoney(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

export function PipelineDashboardPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stalledDays, setStalledDays] = useState<number>(14);
  const [groupBy, setGroupBy] = useState<GroupBy>("client");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/crm/pipeline/dashboard?stalledDays=${stalledDays}`);
      if (!res.ok) throw new Error(`Failed to load dashboard: ${await res.text()}`);
      const payload = (await res.json()) as DashboardPayload;
      setData(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, stalledDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeWinRateRows = useMemo<WinRateRow[]>(() => {
    if (!data) return [];
    switch (groupBy) {
      case "client":
        return data.winRates.byClient;
      case "sector":
        return data.winRates.bySector;
      case "source":
        return data.winRates.bySource;
      case "estimator":
        return data.winRates.byEstimator;
    }
  }, [data, groupBy]);

  return (
    <div style={{ padding: "24px 32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16
        }}
      >
        <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: 0 }}>
          Pipeline &amp; win/loss dashboard
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

      {loading && (
        <p style={{ color: "var(--text-muted, #666)" }}>Loading dashboard…</p>
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

      {!loading && !error && data && (
        <>
          <PipelineByStageCard block={data.byStage} />

          <div style={{ marginTop: 20 }}>
            <SectionHeader
              title="Win rate"
              right={
                <div style={{ display: "flex", gap: 4 }}>
                  {GROUP_BY_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setGroupBy(opt.key)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 4,
                        border: "1px solid #ccc",
                        background: groupBy === opt.key ? "#f0f9ff" : "#fff",
                        cursor: "pointer",
                        fontWeight: groupBy === opt.key ? 600 : 400,
                        minHeight: 32
                      }}
                    >
                      By {opt.label.toLowerCase()}
                    </button>
                  ))}
                </div>
              }
            />
            <WinRateTable rows={activeWinRateRows} />
          </div>

          <div style={{ marginTop: 20 }}>
            <SectionHeader
              title={`Stalled opportunities (${data.stalled.count})`}
              right={
                <label
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted, #666)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  Threshold days
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={stalledDays}
                    onChange={(e) => setStalledDays(Number(e.target.value) || 14)}
                    style={{
                      width: 70,
                      padding: "6px 8px",
                      borderRadius: 4,
                      border: "1px solid #ccc"
                    }}
                  />
                </label>
              }
            />
            <StalledTable rows={data.stalled.items} onOpen={(id) => navigate(`/crm/opportunities/${id}`)} />
          </div>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Relationship coverage" />
            <CoverageCard summary={data.relationshipCoverage} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8
      }}
    >
      <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, margin: 0 }}>
        {title}
      </h2>
      {right}
    </div>
  );
}

function PipelineByStageCard({ block }: { block: StageBlock }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12
        }}
      >
        <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, margin: 0 }}>
          Open pipeline by stage
        </h2>
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <span style={{ color: "var(--text-muted, #666)" }}>
            Opportunities:{" "}
            <strong style={{ color: "#000" }}>{block.totals.count}</strong>
          </span>
          <span style={{ color: "var(--text-muted, #666)" }}>
            Gross:{" "}
            <strong style={{ color: "#000" }}>{fmtMoney(block.totals.grossValue)}</strong>
          </span>
          <span style={{ color: "var(--text-muted, #666)" }}>
            Weighted:{" "}
            <strong style={{ color: "var(--color-teal, #005B61)" }}>
              {fmtMoney(block.totals.weightedValue)}
            </strong>
          </span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${block.buckets.length}, 1fr)`, gap: 8 }}>
        {block.buckets.map((b) => (
          <div key={b.stage} style={{ background: "#f6f6f6", borderRadius: 6, padding: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {STAGE_LABELS[b.stage] ?? b.stage}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted, #666)" }}>
              {b.count} · {fmtMoney(b.grossValue)}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-teal, #005B61)", fontWeight: 600, marginTop: 4 }}>
              Weighted {fmtMoney(b.weightedValue)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinRateTable({ rows }: { rows: WinRateRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          textAlign: "center",
          color: "var(--text-muted, #888)"
        }}
      >
        No outcomes captured yet.
      </div>
    );
  }
  return (
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
            <th style={th}>Label</th>
            <th style={thNum}>Won</th>
            <th style={thNum}>Lost</th>
            <th style={thNum}>No bid</th>
            <th style={thNum}>Total</th>
            <th style={thNum}>Win rate</th>
            <th style={thNum}>Won value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: "1px solid #eee" }}>
              <td style={td}>{r.label}</td>
              <td style={tdNum}>{r.won}</td>
              <td style={tdNum}>{r.lost}</td>
              <td style={tdNum}>{r.noBid}</td>
              <td style={tdNum}>{r.total}</td>
              <td style={tdNum}>{r.total > 0 ? fmtPct(r.winRate) : "—"}</td>
              <td style={tdNum}>{fmtMoney(r.wonValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StalledTable({
  rows,
  onOpen
}: {
  rows: StalledRow[];
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          textAlign: "center",
          color: "var(--text-muted, #888)"
        }}
      >
        No stalled opportunities. Nice.
      </div>
    );
  }
  return (
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
            <th style={th}>Opportunity</th>
            <th style={th}>Client</th>
            <th style={th}>Owner</th>
            <th style={th}>Stage</th>
            <th style={th}>Next action</th>
            <th style={thNum}>Days since update</th>
            <th style={thNum}>Weighted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r.id)}
              style={{ borderTop: "1px solid #eee", cursor: "pointer" }}
            >
              <td style={td}>{r.title}</td>
              <td style={td}>{r.clientName ?? "—"}</td>
              <td style={td}>{r.ownerName ?? "—"}</td>
              <td style={td}>{r.stage}</td>
              <td style={td}>{fmtDate(r.nextActionAt)}</td>
              <td style={tdNum}>{r.daysSinceUpdate}</td>
              <td style={tdNum}>{fmtMoney(r.weightedValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoverageCard({ summary }: { summary: CoverageSummary }) {
  const items: { label: string; value: string }[] = [
    { label: "Total accounts", value: String(summary.totalAccounts) },
    { label: "Active", value: String(summary.activeAccounts) },
    { label: "Prospect", value: String(summary.prospectAccounts) },
    { label: "Past", value: String(summary.pastAccounts) },
    {
      label: "With primary contact",
      value: `${summary.accountsWithPrimaryContact} (${fmtPct(summary.primaryContactCoverageRate)})`
    },
    {
      label: "Missing primary contact",
      value: String(summary.accountsWithoutPrimaryContact)
    }
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 8
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 12
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-muted, #666)" }}>{it.label}</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Table styles ─────────────────────────────────────────────────────────────

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "10px 12px" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right" };
