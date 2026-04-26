import { useMemo, useState } from "react";
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
import { LIST_ROW_HEIGHT_PX, GRID_ROW_HEIGHT_PX, periodStart, resolvePeriod, type AggregationOp, type WidgetProps } from "../types";
import { EmptyNote, KpiTile, PanelCard, formatCompactCurrency, formatCurrency } from "./shared";

function aggregationFrom(config: WidgetProps["config"]): AggregationOp {
  const raw = config.filters?.aggregation;
  if (raw === "Sum" || raw === "Count" || raw === "Average" || raw === "Max" || raw === "Min") return raw;
  return "Sum";
}

function applyAggregation(values: number[], op: AggregationOp): number {
  if (values.length === 0) return 0;
  if (op === "Count") return values.length;
  if (op === "Sum") return values.reduce((sum, v) => sum + v, 0);
  if (op === "Average") return values.reduce((sum, v) => sum + v, 0) / values.length;
  if (op === "Max") return Math.max(...values);
  if (op === "Min") return Math.min(...values);
  return 0;
}

function labelForAggregation(op: AggregationOp, raw: number, formatted: string): string {
  switch (op) {
    case "Count": return `${Math.round(raw)} tender${Math.round(raw) === 1 ? "" : "s"}`;
    case "Average": return `${formatted} avg`;
    case "Max": return `${formatted} max`;
    case "Min": return `${formatted} min`;
    case "Sum":
    default:
      return formatted;
  }
}

function availableRowsFor(rowSpan: number | undefined, headerPx = 72): number {
  const span = Math.max(1, rowSpan ?? 2);
  return Math.max(1, Math.floor((span * GRID_ROW_HEIGHT_PX - headerPx) / LIST_ROW_HEIGHT_PX));
}

function fieldSet(config: WidgetProps["config"], defaultVisible: string[]): Set<string> {
  const fields = config.fields && config.fields.length > 0 ? config.fields : defaultVisible;
  return new Set(fields);
}

const DAY = 86_400_000;
const TERMINAL = new Set(["LOST", "WITHDRAWN", "CONVERTED"]);
const ACTIVE = new Set(["DRAFT", "IN_PROGRESS", "SUBMITTED"]);
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IS_PALETTE = ["#FEAA6D", "#005B61", "#94A3B8", "#242424", "#FED7AA", "#22C55E"];

function filterStrings(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const clean = raw.filter((v): v is string => typeof v === "string");
  return clean.length > 0 ? clean : null;
}

function filterNumber(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function filterString(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.length > 0 ? raw : fallback;
}

function matchesEstimator(t: TenderForDashboard, estimatorIds: string[] | null): boolean {
  if (!estimatorIds) return true;
  return t.estimator != null && estimatorIds.includes(t.estimator.id);
}

function periodToCutoff(period: string): Date {
  const now = Date.now();
  switch (period) {
    case "30d": return new Date(now - 30 * DAY);
    case "60d": return new Date(now - 60 * DAY);
    case "90d": return new Date(now - 90 * DAY);
    case "3m": {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    case "6m": {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return d;
    }
    case "12m": {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    default:
      return new Date(now - 90 * DAY);
  }
}

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

export function ActivePipelineKpi(props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const stageFilter = filterStrings(props.config.filters?.stages);
  const op = aggregationFrom(props.config);
  if (isLoading) return <KpiTile label="Active pipeline" value="—" />;
  const values = tenders
    .filter((t) => {
      if (TERMINAL.has(t.status)) return false;
      if (stageFilter && !stageFilter.includes(t.status)) return false;
      return true;
    })
    .map((t) => Number(t.estimatedValue ?? 0));
  const raw = applyAggregation(values, op);
  const display = labelForAggregation(op, raw, formatCurrency(raw));
  return <KpiTile label="Active pipeline" value={display} />;
}

export function SubmittedMtdKpi(props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const op = aggregationFrom(props.config);
  if (isLoading) return <KpiTile label="Submitted MTD" value="—" />;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const subset = tenders.filter((t) => t.submittedAt && new Date(t.submittedAt) >= monthStart);
  const values = subset.map((t) => Number(t.estimatedValue ?? 0));
  const raw = applyAggregation(values, op);
  const display = labelForAggregation(op, raw, formatCurrency(raw));
  const subtitle = op === "Count" ? formatCurrency(applyAggregation(values, "Sum")) : `${subset.length} submitted`;
  return <KpiTile label="Submitted MTD" value={op === "Count" ? subset.length : display} subtitle={subtitle} />;
}

export function WinRateYtdKpi(props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const op = aggregationFrom(props.config);
  if (isLoading) return <KpiTile label="Win rate YTD" value="—" />;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const won = tenders.filter((t) => t.wonAt && new Date(t.wonAt) >= yearStart);
  const lost = tenders.filter((t) => t.lostAt && new Date(t.lostAt) >= yearStart);
  const resolved = won.length + lost.length;
  const rate = resolved > 0 ? (won.length / resolved) * 100 : 0;
  if (op === "Count") {
    return <KpiTile label="Win rate YTD" value={`${won.length} won`} subtitle={`${resolved} resolved`} />;
  }
  return <KpiTile label="Win rate YTD" value={`${rate.toFixed(0)}%`} subtitle={`${won.length}/${resolved}`} />;
}

export function AvgLeadTimeKpi(props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const op = aggregationFrom(props.config);
  if (isLoading) return <KpiTile label="Avg lead time" value="—" />;
  // Lead time = submitted - invited/created. Use absolute value so seed data
  // where the synthetic createdAt is post-submitted (because backfill stamps
  // submittedAt in the past while the row was created "now") still produces
  // a positive metric. Real production data always has createdAt < submittedAt.
  const leadTimes = tenders
    .filter((t) => t.submittedAt && t.createdAt)
    .map((t) => Math.abs(daysBetween(new Date(t.createdAt!), new Date(t.submittedAt!))))
    .filter((days) => days > 0);
  if (leadTimes.length === 0) return <KpiTile label="Avg lead time" value="—" />;
  const raw = applyAggregation(leadTimes, op === "Sum" ? "Average" : op);
  const label = op === "Count" ? `${leadTimes.length} tenders` : `${raw.toFixed(1)}d`;
  const subtitle = op === "Average" || op === "Sum" ? "average" : op.toLowerCase();
  return <KpiTile label="Avg lead time" value={label} subtitle={subtitle} />;
}

const DUE_DEFAULT_FIELDS = ["tenderNumber", "clientName", "projectName", "estimator", "status", "dueDate"];

export function DueThisWeekPanel(props: WidgetProps) {
  const navigate = useNavigate();
  const { tenders, isLoading } = useCleanTenders();
  const daysAhead = filterNumber(props.config.filters?.daysAhead, 7);
  const visible = useMemo(() => fieldSet(props.config, DUE_DEFAULT_FIELDS), [props.config]);
  const availableRows = availableRowsFor(props.rowSpan);
  if (isLoading) return <Skeleton width="100%" height={180} />;
  const dueThisWeek = tenders
    .filter((t) => t.dueDate && ACTIVE.has(t.status) && daysUntil(t.dueDate) <= daysAhead)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, availableRows);
  return (
    <PanelCard title="Due this week">
      {dueThisWeek.length === 0 ? (
        <EmptyNote>Nothing due this week.</EmptyNote>
      ) : (
        <ul className="td-v2__rows">
          {dueThisWeek.map((t) => {
            const days = daysUntil(t.dueDate);
            const color = dueColor(days);
            const client = t.tenderClients[0]?.client?.name ?? "No client";
            const metaBits: string[] = [];
            if (visible.has("estimator")) metaBits.push(estimatorName(t));
            if (visible.has("status")) metaBits.push(labelForStatus(t.status));
            const titleBits: string[] = [];
            if (visible.has("clientName")) titleBits.push(client);
            if (visible.has("projectName")) titleBits.push(t.title);
            return (
              <li key={t.id} className="td-v2__row" onClick={() => navigate(`/tenders/${t.id}`)}>
                {visible.has("tenderNumber") ? (
                  <strong className="td-v2__tnum">{t.tenderNumber}</strong>
                ) : null}
                <div className="td-v2__row-body">
                  <div className="td-v2__row-title">{titleBits.join(" — ") || t.title}</div>
                  {metaBits.length > 0 ? (
                    <div className="td-v2__row-meta">{metaBits.join(" · ")}</div>
                  ) : null}
                </div>
                {visible.has("daysUntilDue") ? (
                  <span style={{ color, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`}
                  </span>
                ) : null}
                {visible.has("dueDate") ? (
                  <span style={{ color, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                        ? "due today"
                        : days === 1
                          ? "due tomorrow"
                          : formatDueDate(t.dueDate)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

const FOLLOW_UP_DEFAULT_FIELDS = [
  "tenderNumber",
  "clientName",
  "projectName",
  "daysWaiting",
  "probability",
  "value",
  "logCall"
];

export function FollowUpQueuePanel(props: WidgetProps) {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { tenders, isLoading } = useCleanTenders();
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);
  const daysThreshold = filterNumber(props.config.filters?.daysThreshold, 7);
  const configuredMax = filterNumber(props.config.filters?.maxRows, 5);
  const availableRows = availableRowsFor(props.rowSpan);
  const maxRows = Math.min(configuredMax, Math.max(configuredMax, availableRows));
  const visible = useMemo(() => fieldSet(props.config, FOLLOW_UP_DEFAULT_FIELDS), [props.config]);

  if (isLoading) return <Skeleton width="100%" height={180} />;
  const now = new Date();
  const thresholdCutoff = new Date(now.getTime() - daysThreshold * DAY);
  const queue = tenders
    .filter(
      (t) =>
        t.status === "SUBMITTED" &&
        t.submittedAt &&
        new Date(t.submittedAt) < thresholdCutoff &&
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
        lastNote: notes[0]?.body ?? null,
        lastActivity: notes[0]?.createdAt ?? t.updatedAt ?? null
      };
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, maxRows);
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
            {queue.length} · {formatCompactCurrency(totalValue)}
          </span>
        ) : null
      }
    >
      {queue.length === 0 ? (
        <EmptyNote>No tenders awaiting follow-up.</EmptyNote>
      ) : (
        <ul className="td-v2__rows">
          {queue.map(({ tender, daysWaiting, lastNote, lastActivity }) => {
            const bucket = bucketFor(tender.probability);
            const client = tender.tenderClients[0]?.client?.name ?? "No client";
            const titleBits: string[] = [];
            if (visible.has("clientName")) titleBits.push(client);
            if (visible.has("projectName")) titleBits.push(tender.title);
            const metaBits: string[] = [];
            if (visible.has("daysWaiting")) metaBits.push(`Submitted ${daysWaiting}d ago`);
            if (visible.has("estimator")) metaBits.push(estimatorName(tender));
            if (visible.has("lastActivity") && lastActivity) metaBits.push(`Last activity ${relativeDate(lastActivity)}`);
            if (visible.has("logCall") === false && lastNote) metaBits.push(lastNote.slice(0, 60));
            return (
              <li key={tender.id} className="td-v2__row td-v2__row--followup">
                {visible.has("tenderNumber") ? (
                  <strong
                    className="td-v2__tnum"
                    onClick={() => navigate(`/tenders/${tender.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    {tender.tenderNumber}
                  </strong>
                ) : null}
                <div
                  className="td-v2__row-body"
                  onClick={() => navigate(`/tenders/${tender.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="td-v2__row-title">{titleBits.join(" — ") || tender.title}</div>
                  {metaBits.length > 0 ? <div className="td-v2__row-meta">{metaBits.join(" · ")}</div> : null}
                </div>
                {visible.has("probability") ? (
                  <span
                    className="s7-badge"
                    style={{ background: BUCKET_STYLE[bucket].background, color: BUCKET_STYLE[bucket].color }}
                  >
                    {bucket === "unknown" ? "—" : bucket[0].toUpperCase() + bucket.slice(1)}
                  </span>
                ) : null}
                {visible.has("value") ? (
                  // Compact format ($1.2M / $125K) so the value column never
                  // truncates inside the follow-up queue cell.
                  <strong
                    style={{ whiteSpace: "nowrap" }}
                    title={formatCurrency(Number(tender.estimatedValue ?? 0))}
                  >
                    {formatCompactCurrency(Number(tender.estimatedValue ?? 0))}
                  </strong>
                ) : null}
                {visible.has("logCall") ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--secondary s7-btn--sm"
                    onClick={() => void logCall(tender.id)}
                    disabled={pendingCallId === tender.id}
                  >
                    Log call
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

export function WinRateChart(props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const period = filterString(props.config.filters?.period, "6m");
  const groupBy = filterString(props.config.filters?.groupBy, "month");
  const estimatorIds = filterStrings(props.config.filters?.estimatorIds);
  const now = new Date();

  const monthsBack = period === "3m" ? 3 : period === "12m" ? 12 : 6;
  const buckets: Array<{ bucketKey: string; label: string; submitted: number; won: number }> = [];

  if (groupBy === "quarter") {
    const quartersBack = Math.ceil(monthsBack / 3);
    for (let i = quartersBack - 1; i >= 0; i -= 1) {
      const base = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
      const q = Math.floor(base.getMonth() / 3) + 1;
      buckets.push({
        bucketKey: `${base.getFullYear()}-Q${q}`,
        label: `Q${q} ${String(base.getFullYear()).slice(2)}`,
        submitted: 0,
        won: 0
      });
    }
  } else {
    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        bucketKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: MONTH_SHORT[d.getMonth()],
        submitted: 0,
        won: 0
      });
    }
  }
  const byKey = new Map(buckets.map((b) => [b.bucketKey, b]));

  const bucketKeyFor = (date: Date): string => {
    if (groupBy === "quarter") {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${q}`;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  for (const t of tenders) {
    if (!matchesEstimator(t, estimatorIds)) continue;
    if (t.submittedAt) {
      const b = byKey.get(bucketKeyFor(new Date(t.submittedAt)));
      if (b) b.submitted += 1;
    }
    if (t.wonAt) {
      const b = byKey.get(bucketKeyFor(new Date(t.wonAt)));
      if (b) b.won += 1;
    }
  }
  const title = period === "3m" ? "Win rate — last 3 months" : period === "12m" ? "Win rate — last 12 months" : "Win rate — last 6 months";
  return (
    <PanelCard title={title}>
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

export function PipelineByEstimatorDonut(props: WidgetProps) {
  const { tenders, isLoading } = useCleanTenders();
  const estimatorIds = filterStrings(props.config.filters?.estimatorIds);
  const metric = filterString(props.config.filters?.metric, "value");
  const estimatorMap = new Map<string, { name: string; value: number }>();
  for (const t of tenders) {
    if (!ACTIVE.has(t.status)) continue;
    if (!matchesEstimator(t, estimatorIds)) continue;
    const amount = metric === "count" ? 1 : Number(t.estimatedValue ?? 0);
    if (metric !== "count" && amount <= 0) continue;
    const key = t.estimator?.id ?? "unassigned";
    const name = estimatorName(t);
    const entry = estimatorMap.get(key) ?? { name, value: 0 };
    entry.value += amount;
    estimatorMap.set(key, entry);
  }
  const rows = Array.from(estimatorMap.values()).sort((a, b) => b.value - a.value);
  const formatSlice = (value: number) => (metric === "count" ? `${value} tender${value === 1 ? "" : "s"}` : formatCurrency(value));
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
              <Tooltip formatter={(value) => formatSlice(Number(value))} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

const RECENT_WINS_DEFAULT_FIELDS = ["clientName", "projectName", "value", "estimator", "wonDate"];

export function RecentWinsPanel(props: WidgetProps) {
  const navigate = useNavigate();
  const periodFilter = filterString(props.config.filters?.period, "");
  const configuredMax = filterNumber(props.config.filters?.maxRows, 4);
  const availableRows = availableRowsFor(props.rowSpan);
  const maxRows = Math.min(configuredMax, Math.max(configuredMax, availableRows));
  const estimatorIds = filterStrings(props.config.filters?.estimatorIds);
  const cutoff = periodFilter ? periodToCutoff(periodFilter) : periodStart(resolvePeriod(props.config, props.globalPeriod));
  const visible = useMemo(() => fieldSet(props.config, RECENT_WINS_DEFAULT_FIELDS), [props.config]);
  const { tenders, isLoading } = useCleanTenders();
  const wins = tenders
    .filter((t) => t.wonAt && new Date(t.wonAt) >= cutoff && matchesEstimator(t, estimatorIds))
    .sort((a, b) => new Date(b.wonAt!).getTime() - new Date(a.wonAt!).getTime())
    .slice(0, maxRows);
  return (
    <PanelCard title="Recent wins">
      {isLoading ? (
        <Skeleton width="100%" height={120} />
      ) : wins.length === 0 ? (
        <EmptyNote>No wins in the selected period.</EmptyNote>
      ) : (
        <ul className="td-v2__rows">
          {wins.map((t) => {
            const client = t.tenderClients[0]?.client?.name ?? "No client";
            const titleBits: string[] = [];
            if (visible.has("clientName")) titleBits.push(client);
            if (visible.has("projectName")) titleBits.push(t.title);
            const metaBits: string[] = [];
            if (visible.has("tenderNumber")) metaBits.push(t.tenderNumber);
            if (visible.has("estimator")) metaBits.push(estimatorName(t));
            if (visible.has("wonDate")) metaBits.push(relativeDate(t.wonAt));
            return (
              <li key={t.id} className="td-v2__row" onClick={() => navigate(`/tenders/${t.id}`)}>
                <div className="td-v2__row-body">
                  <div className="td-v2__row-title">{titleBits.join(" — ") || t.title}</div>
                  {metaBits.length > 0 ? <div className="td-v2__row-meta">{metaBits.join(" · ")}</div> : null}
                </div>
                {visible.has("value") ? (
                  <strong style={{ color: "#FEAA6D", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {formatCurrency(Number(t.estimatedValue ?? 0))}
                  </strong>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
