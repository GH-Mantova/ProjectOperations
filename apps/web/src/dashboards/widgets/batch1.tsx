import { BarChartWidget, DonutChartWidget, Skeleton } from "@project-ops/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { WidgetProps } from "../types";
import { EmptyNote, KpiTile, PanelCard } from "./shared";
import {
  assetsByStatus,
  countPendingLeave,
  currentWeekBounds,
  daysSinceIncident,
  isoDate,
  shapeActivity,
  summariseXeroHealth,
  topProjectsByHours,
  whoIsAwayThisWeek,
  type AssetRow,
  type AuditRow,
  type LeaveRow,
  type ProjectHoursRow,
  type UnavailabilityRow,
  type XeroStatusResponse,
  type XeroSyncLogRow
} from "./batch1.helpers";

// ── H1 Days since last incident ─────────────────────────────────────

type Incident = { id: string; incidentDate: string | null };

export function DaysSinceLastIncidentKpi(_props: WidgetProps) {
  const { authFetch } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "days-since-incident"],
    queryFn: async () => {
      const res = await authFetch("/safety/incidents?limit=1");
      if (!res.ok) return null;
      const body = await res.json();
      const items = (body.items ?? body ?? []) as Incident[];
      return items[0] ?? null;
    },
    staleTime: 60_000
  });

  if (isLoading) return <KpiTile label="Days since last incident" value="—" />;
  const days = daysSinceIncident(data?.incidentDate);
  const value = days === null ? "—" : days;
  const subtitle = days === null ? "No incidents recorded" : days === 0 ? "Reported today" : "Keep it going";
  const accent = days === null ? "#94A3B8" : days === 0 ? "#EF4444" : days < 7 ? "#F59E0B" : "#22C55E";
  return (
    <Link to="/safety" style={{ textDecoration: "none", color: "inherit", height: "100%", display: "block" }}>
      <KpiTile label="Days since last incident" value={value} subtitle={subtitle} accent={accent} />
    </Link>
  );
}

// ── W1 Who's away this week ─────────────────────────────────────────

function useLeavesAndUnavailability() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "away-this-week"],
    queryFn: async () => {
      const [leavesRes, unavailRes] = await Promise.all([
        authFetch("/workers/leaves"),
        authFetch("/workers/unavailability")
      ]);
      const leaves = leavesRes.ok ? ((await leavesRes.json()) as LeaveRow[]) : [];
      const unavail = unavailRes.ok ? ((await unavailRes.json()) as UnavailabilityRow[]) : [];
      return { leaves, unavailability: unavail };
    },
    staleTime: 60_000
  });
}

export function WhoIsAwayThisWeekWidget(_props: WidgetProps) {
  const { data, isLoading } = useLeavesAndUnavailability();
  if (isLoading) {
    return (
      <PanelCard title="Who's away this week">
        <Skeleton width="100%" height={120} />
      </PanelCard>
    );
  }
  const rows = whoIsAwayThisWeek(data?.leaves ?? [], data?.unavailability ?? []);
  return (
    <PanelCard
      title="Who's away this week"
      actions={
        <Link to="/scheduler" style={{ fontSize: 11 }}>
          View scheduler
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyNote>Everyone's on deck for the next 7 days.</EmptyNote>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 220,
            overflow: "auto"
          }}
        >
          {rows.map((r) => (
            <li
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 12,
                alignItems: "baseline"
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>{r.workerName}</strong> · {r.reason}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  background: r.kind === "leave" ? "#005B61" : "#94A3B8",
                  color: "#fff",
                  borderRadius: 999,
                  textTransform: "uppercase"
                }}
              >
                {r.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

// ── W2 Leave requests pending approval ──────────────────────────────

export function LeavePendingKpi(_props: WidgetProps) {
  const { data, isLoading } = useLeavesAndUnavailability();
  if (isLoading) return <KpiTile label="Leave pending" value="—" />;
  const { count, oldestRequestDate } = countPendingLeave(data?.leaves ?? []);
  const subtitle =
    oldestRequestDate != null
      ? `Oldest ${new Date(oldestRequestDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
      : count === 0
        ? "Nothing waiting"
        : undefined;
  return (
    <Link to="/scheduler" style={{ textDecoration: "none", color: "inherit", height: "100%", display: "block" }}>
      <KpiTile
        label="Leave pending"
        value={count}
        subtitle={subtitle}
        accent={count === 0 ? "#22C55E" : "#F59E0B"}
      />
    </Link>
  );
}

// ── W3 Hours by project this week ───────────────────────────────────

type TimesheetSummary = {
  totalHours: number;
  byProject: ProjectHoursRow[];
};

export function HoursByProjectWeekBar(_props: WidgetProps) {
  const { authFetch } = useAuth();
  const { from, to } = currentWeekBounds();
  const query = `?dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`;
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "hours-by-project", isoDate(from), isoDate(to)],
    queryFn: async () => {
      const res = await authFetch(`/field/timesheets/summary${query}`);
      if (!res.ok) return null;
      return (await res.json()) as TimesheetSummary;
    },
    staleTime: 60_000
  });
  if (isLoading) return <Skeleton width="100%" height={240} />;
  const points = topProjectsByHours(data?.byProject ?? []);
  if (points.length === 0) {
    return (
      <PanelCard title="Hours by project this week">
        <EmptyNote>No approved timesheets yet this week.</EmptyNote>
      </PanelCard>
    );
  }
  return <BarChartWidget title="Hours by project this week" data={points} unit="hrs" color="#005B61" />;
}

// ── W4 Assets by status donut ───────────────────────────────────────

export function AssetsByStatusDonut(_props: WidgetProps) {
  const { authFetch } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "assets-by-status"],
    queryFn: async () => {
      const PAGE_SIZE = 100;
      const all: AssetRow[] = [];
      let page = 1;
      while (true) {
        const res = await authFetch(`/assets?page=${page}&pageSize=${PAGE_SIZE}`);
        if (!res.ok) return all;
        const body = await res.json();
        const items = (body.items ?? body ?? []) as AssetRow[];
        all.push(...items);
        const total = typeof body?.total === "number" ? body.total : all.length;
        if (all.length >= total || items.length < PAGE_SIZE) break;
        page += 1;
        if (page > 50) break;
      }
      return all;
    },
    staleTime: 60_000
  });
  if (isLoading) return <Skeleton width="100%" height={240} />;
  const points = assetsByStatus(data ?? []);
  if (points.length === 0) {
    return (
      <PanelCard title="Assets by status">
        <EmptyNote>No assets recorded.</EmptyNote>
      </PanelCard>
    );
  }
  return <DonutChartWidget title="Assets by status" data={points} />;
}

// ── P1 Xero sync health ─────────────────────────────────────────────

export function XeroSyncHealthKpi(_props: WidgetProps) {
  const { authFetch } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "xero-health"],
    queryFn: async () => {
      const [statusRes, logsRes] = await Promise.all([
        authFetch("/xero/status"),
        authFetch("/xero/sync-logs?limit=1")
      ]);
      const status = statusRes.ok ? ((await statusRes.json()) as XeroStatusResponse) : null;
      const logs = logsRes.ok ? ((await logsRes.json()) as XeroSyncLogRow[]) : [];
      return { status, logs };
    },
    staleTime: 60_000
  });
  if (isLoading) return <KpiTile label="Xero sync" value="—" />;
  const health = summariseXeroHealth(data?.status, data?.logs);
  const accent =
    health.tone === "danger"
      ? "#EF4444"
      : health.tone === "warning"
        ? "#F59E0B"
        : health.tone === "ok"
          ? "#22C55E"
          : "#94A3B8";
  return (
    <Link to="/admin/xero" style={{ textDecoration: "none", color: "inherit", height: "100%", display: "block" }}>
      <KpiTile label="Xero sync" value={health.headline} subtitle={health.detail} accent={accent} />
    </Link>
  );
}

// ── P2 Recent activity feed ─────────────────────────────────────────

export function RecentActivityList(_props: WidgetProps) {
  const { authFetch } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: async () => {
      const res = await authFetch("/audit-logs?page=1&pageSize=10");
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      return (body.items ?? []) as AuditRow[];
    },
    staleTime: 60_000,
    retry: false
  });
  return (
    <PanelCard title="Recent activity">
      {isLoading ? (
        <Skeleton width="100%" height={140} />
      ) : error ? (
        <EmptyNote>Audit view requires admin permission.</EmptyNote>
      ) : (
        (() => {
          const rows = shapeActivity(data ?? []);
          if (rows.length === 0) return <EmptyNote>No recent activity.</EmptyNote>;
          return (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 220,
                overflow: "auto"
              }}
            >
              {rows.map((r) => (
                <li key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{r.who}</strong> · {r.what}
                  </span>
                  <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{r.when}</span>
                </li>
              ))}
            </ul>
          );
        })()
      )}
    </PanelCard>
  );
}

// ── Static annotation widgets (Smartsheet pattern) ──────────────────

function textOf(config: WidgetProps["config"], key: string): string {
  const raw = config.filters?.[key];
  return typeof raw === "string" ? raw : "";
}

export function StaticHeadingWidget(props: WidgetProps) {
  const text = textOf(props.config, "text") || "Section heading";
  return (
    <div
      className="s7-card"
      style={{
        padding: 14,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start"
      }}
    >
      <h3 className="s7-type-section-heading" style={{ margin: 0, fontSize: 20 }}>
        {text}
      </h3>
    </div>
  );
}

export function StaticNoteWidget(props: WidgetProps) {
  const text = textOf(props.config, "text");
  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", overflow: "auto" }}>
      {text ? (
        <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", color: "var(--text-default, #242424)" }}>
          {text}
        </p>
      ) : (
        <EmptyNote>Add a note in the widget settings.</EmptyNote>
      )}
    </div>
  );
}
