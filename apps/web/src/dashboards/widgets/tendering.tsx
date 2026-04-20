import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { isComplianceTender, useTenders, type TenderForDashboard } from "../hooks";
import { periodStart, resolvePeriod, type WidgetProps } from "../types";
import { EmptyNote, KpiTile, PanelCard, formatCurrency } from "./shared";

const DAY = 86_400_000;
const TERMINAL = new Set(["LOST", "WITHDRAWN", "CONVERTED"]);
const ACTIVE = new Set(["DRAFT", "IN_PROGRESS", "SUBMITTED"]);
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IS_PALETTE = ["#FEAA6D", "#005B61", "#94A3B8", "#242424", "#FED7AA", "#22C55E"];

type Bucket = "hot" | "warm" | "cold" | "unknown";
function bucketFor(value: number | null | undefined): Bucket {
  if (value === null || value === undefined) return "unknown";
  if (value >= 70) return "hot";
  if (value >= 30) return "warm";
  return "cold";
}
const BUCKET_STYLE: Record<Bucket, { background: string; color: string }> = {
  hot: { background: "#FEAA6D", color: "#3E1C00" },
  warm: { background: "#FED7AA", color: "#3E2A00" },
  cold: { background: "#E2E8F0", color: "#0F172A" },
  unknown: { background: "rgba(0,0,0,0.08)", color: "#6B7280" }
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY);
}
function daysUntil(iso?: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return daysBetween(new Date(), new Date(iso));
}
function dueColor(days: number): string {
  if (days <= 2) return "#EF4444";
  if (days <= 5) return "#F59E0B";
  return "inherit";
}
function estimatorName(t: TenderForDashboard): string {
  return t.estimator ? `${t.estimator.firstName} ${t.estimator.lastName}` : "Unassigned";
}
function clientProject(t: TenderForDashboard): string {
  const client = t.tenderClients[0]?.client?.name ?? "No client";
  return `${client} — ${t.title}`;
}
function labelForStatus(status: string): string {
  switch (status) {
    case "DRAFT": return "Identified";
    case "IN_PROGRESS": return "Estimating";
    case "SUBMITTED": return "Submitted";
    case "AWARDED": return "Awarded";
    case "CONTRACT_ISSUED": return "Contract";
    case "CONVERTED": return "Converted";
    case "LOST": return "Lost";
    case "WITHDRAWN": return "Withdrawn";
    default: return status;
  }
}
function relativeDate(iso?: string | null): string {
  if (!iso) return "—";
  const target = new Date(iso);
  const diff = daysBetween(target, new Date());
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 30) return `${diff}d ago`;
  return target.toLocaleDateString();
}
function formatDueDate(iso?: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function useCleanTenders() {
  const { data, isLoading } = useTenders();
  return { tenders: (data ?? []).filter((t) => !isComplianceTender(t)), isLoading };
}

export function ActivePipelineKpi(_props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  if (isLoading) return <KpiTile label="Active pipeline" value="—" />;
  const total = tenders
    .filter((t) => !TERMINAL.has(t.status))
    .reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);
  return <KpiTile label="Active pipeline" value={formatCurrency(total)} />;
}

export function SubmittedMtdKpi(_props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  if (isLoading) return <KpiTile label="Submitted MTD" value="—" />;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const subset = tenders.filter((t) => t.submittedAt && new Date(t.submittedAt) >= monthStart);
  const value = subset.reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);
  return <KpiTile label="Submitted MTD" value={subset.length} subtitle={formatCurrency(value)} />;
}

export function WinRateYtdKpi(_props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  if (isLoading) return <KpiTile label="Win rate YTD" value="—" />;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const won = tenders.filter((t) => t.wonAt && new Date(t.wonAt) >= yearStart);
  const lost = tenders.filter((t) => t.lostAt && new Date(t.lostAt) >= yearStart);
  const resolved = won.length + lost.length;
  const rate = resolved > 0 ? (won.length / resolved) * 100 : 0;
  return <KpiTile label="Win rate YTD" value={`${rate.toFixed(0)}%`} subtitle={`${won.length}/${resolved}`} />;
}

export function AvgLeadTimeKpi(_props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  if (isLoading) return <KpiTile label="Avg lead time" value="—" />;
  const leadTimes = tenders
    .filter((t) => t.submittedAt && t.createdAt)
    .map((t) => daysBetween(new Date(t.createdAt!), new Date(t.submittedAt!)))
    .filter((days) => days > 0);
  if (leadTimes.length === 0) return <KpiTile label="Avg lead time" value="—" />;
  const avg = leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length;
  return <KpiTile label="Avg lead time" value={`${avg.toFixed(1)}d`} />;
}

export function DueThisWeekPanel(_props: WidgetProps) {
  const navigate = useNavigate();
  const { tenders, isLoading } = useCleanTenders();
  if (isLoading) return <Skeleton width="100%" height={180} />;
  const dueThisWeek = tenders
    .filter((t) => t.dueDate && ACTIVE.has(t.status) && daysUntil(t.dueDate) <= 7)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  return (
    <PanelCard title="Due this week">
      {dueThisWeek.length === 0 ? (
        <EmptyNote>Nothing due this week.</EmptyNote>
      ) : (
        <ul className="td-v2__rows">
          {dueThisWeek.map((t) => {
            const days = daysUntil(t.dueDate);
            const color = dueColor(days);
            return (
              <li key={t.id} className="td-v2__row" onClick={() => navigate(`/tenders/${t.id}`)}>
                <strong className="td-v2__tnum">{t.tenderNumber}</strong>
                <div className="td-v2__row-body">
                  <div className="td-v2__row-title">{clientProject(t)}</div>
                  <div className="td-v2__row-meta">{estimatorName(t)} · {labelForStatus(t.status)}</div>
                </div>
                <span style={{ color, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {days < 0
                    ? `${Math.abs(days)}d overdue`
                    : days === 0
                      ? "due today"
                      : days === 1
                        ? "due tomorrow"
                        : formatDueDate(t.dueDate)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

export function FollowUpQueuePanel(_props: WidgetProps) {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { tenders, isLoading } = useCleanTenders();
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);

  if (isLoading) return <Skeleton width="100%" height={180} />;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY);
  const queue = tenders
    .filter(
      (t) =>
        t.status === "SUBMITTED" &&
        t.submittedAt &&
        new Date(t.submittedAt) < sevenDaysAgo &&
        !t.wonAt &&
        !t.lostAt
    )
    .map((t) => {
      const notes = [...(t.tenderNotes ?? [])].sort((a, b) => {
        const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bT - aT;
      });
      return {
        tender: t,
        daysWaiting: t.submittedAt ? daysBetween(new Date(t.submittedAt), now) : 0,
        lastNote: notes[0]?.body ?? null
      };
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, 5);
  const totalValue = queue.reduce((sum, item) => sum + Number(item.tender.estimatedValue ?? 0), 0);

  const logCall = async (tenderId: string) => {
    const note = window.prompt("Log a call / follow-up note:");
    if (!note || !note.trim()) return;
    setPendingCallId(tenderId);
    try {
      const response = await authFetch(`/tenders/${tenderId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: `[Call logged] ${note.trim()}` })
      });
      if (!response.ok) throw new Error("Could not log call.");
    } finally {
      setPendingCallId(null);
    }
  };

  return (
    <PanelCard
      title="Follow-up queue"
      actions={
        queue.length > 0 ? (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {queue.length} · {formatCurrency(totalValue)}
          </span>
        ) : null
      }
    >
      {queue.length === 0 ? (
        <EmptyNote>No tenders awaiting follow-up.</EmptyNote>
      ) : (
        <ul className="td-v2__rows">
          {queue.map(({ tender, daysWaiting, lastNote }) => {
            const bucket = bucketFor(tender.probability);
            return (
              <li key={tender.id} className="td-v2__row td-v2__row--followup">
                <strong
                  className="td-v2__tnum"
                  onClick={() => navigate(`/tenders/${tender.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  {tender.tenderNumber}
                </strong>
                <div
                  className="td-v2__row-body"
                  onClick={() => navigate(`/tenders/${tender.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="td-v2__row-title">{clientProject(tender)}</div>
                  <div className="td-v2__row-meta">
                    Submitted {daysWaiting}d ago{lastNote ? ` · ${lastNote.slice(0, 80)}` : ""}
                  </div>
                </div>
                <span
                  className="s7-badge"
                  style={{ background: BUCKET_STYLE[bucket].background, color: BUCKET_STYLE[bucket].color }}
                >
                  {bucket === "unknown" ? "—" : bucket[0].toUpperCase() + bucket.slice(1)}
                </span>
                <strong style={{ whiteSpace: "nowrap" }}>{formatCurrency(Number(tender.estimatedValue ?? 0))}</strong>
                <button
                  type="button"
                  className="s7-btn s7-btn--secondary s7-btn--sm"
                  onClick={() => void logCall(tender.id)}
                  disabled={pendingCallId === tender.id}
                >
                  Log call
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

export function WinRateChart(_props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const now = new Date();
  const buckets: Array<{ monthKey: string; label: string; submitted: number; won: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_SHORT[d.getMonth()],
      submitted: 0,
      won: 0
    });
  }
  const byKey = new Map(buckets.map((b) => [b.monthKey, b]));
  for (const t of tenders) {
    if (t.submittedAt) {
      const d = new Date(t.submittedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = byKey.get(key);
      if (b) b.submitted += 1;
    }
    if (t.wonAt) {
      const d = new Date(t.wonAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = byKey.get(key);
      if (b) b.won += 1;
    }
  }
  return (
    <PanelCard title="Win rate — last 6 months">
      {isLoading ? (
        <Skeleton width="100%" height={220} />
      ) : (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, rgba(0,0,0,0.08))" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} allowDecimals={false} domain={[0, "auto"]} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="submitted" name="Submitted" fill="#94A3B8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="won" name="Won" fill="#FEAA6D" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

export function PipelineByEstimatorDonut(_props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const estimatorMap = new Map<string, { name: string; value: number }>();
  for (const t of tenders) {
    if (!ACTIVE.has(t.status)) continue;
    const value = Number(t.estimatedValue ?? 0);
    if (value <= 0) continue;
    const key = t.estimator?.id ?? "unassigned";
    const name = estimatorName(t);
    const entry = estimatorMap.get(key) ?? { name, value: 0 };
    entry.value += value;
    estimatorMap.set(key, entry);
  }
  const rows = Array.from(estimatorMap.values()).sort((a, b) => b.value - a.value);
  return (
    <PanelCard title="Pipeline by estimator">
      {isLoading ? (
        <Skeleton width="100%" height={220} />
      ) : rows.length === 0 ? (
        <EmptyNote>No active pipeline.</EmptyNote>
      ) : (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {rows.map((slice, index) => (
                  <Cell key={slice.name} fill={IS_PALETTE[index % IS_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

export function RecentWinsPanel(props: WidgetProps) {
  const navigate = useNavigate();
  const period = resolvePeriod(props.config, props.globalPeriod);
  const cutoff = periodStart(period);
  const { tenders, isLoading } = useCleanTenders();
  const wins = tenders
    .filter((t) => t.wonAt && new Date(t.wonAt) >= cutoff)
    .sort((a, b) => new Date(b.wonAt!).getTime() - new Date(a.wonAt!).getTime())
    .slice(0, 4);
  return (
    <PanelCard title="Recent wins">
      {isLoading ? (
        <Skeleton width="100%" height={120} />
      ) : wins.length === 0 ? (
        <EmptyNote>No wins in the selected period.</EmptyNote>
      ) : (
        <ul className="td-v2__rows">
          {wins.map((t) => (
            <li key={t.id} className="td-v2__row" onClick={() => navigate(`/tenders/${t.id}`)}>
              <div className="td-v2__row-body">
                <div className="td-v2__row-title">{clientProject(t)}</div>
                <div className="td-v2__row-meta">{estimatorName(t)} · {relativeDate(t.wonAt)}</div>
              </div>
              <strong style={{ color: "#FEAA6D", fontWeight: 500, whiteSpace: "nowrap" }}>
                {formatCurrency(Number(t.estimatedValue ?? 0))}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
