import { Skeleton } from "@project-ops/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { WidgetProps } from "../types";
import { EmptyNote, KpiTile, PanelCard, formatCompactCurrency } from "./shared";
import {
  countMyDay,
  isImagePhoto,
  myDayHeadline,
  preStartsSubtitle,
  relativeDue,
  type ApprovalsWaitingResponse,
  type DraftsSummaryResponse,
  type MyDayResponse,
  type PreStartsTodayResponse,
  type RecentPhotosResponse
} from "./batch2.helpers";

const LIST_BOX_STYLE = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  maxHeight: 220,
  overflow: "auto"
};

// ── C1 Form approvals waiting ───────────────────────────────────────

function useApprovalsWaiting() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "approvals-waiting"],
    queryFn: async () => {
      const res = await authFetch("/forms/approvals-waiting?limit=5");
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as ApprovalsWaitingResponse;
    },
    staleTime: 60_000,
    retry: false
  });
}

export function FormApprovalsWaitingKpi(_props: WidgetProps) {
  const { data, isLoading, error } = useApprovalsWaiting();
  if (isLoading) return <KpiTile label="Approvals waiting" value="—" />;
  if (error) return <KpiTile label="Approvals waiting" value="—" subtitle="Requires forms.approve" />;
  const total = data?.total ?? 0;
  const overdue = data?.overdue ?? 0;
  const subtitle = overdue > 0 ? `${overdue} overdue` : total === 0 ? "Nothing waiting" : undefined;
  const accent = overdue > 0 ? "#EF4444" : total === 0 ? "#22C55E" : "#F59E0B";
  return (
    <Link to="/forms" style={{ textDecoration: "none", color: "inherit", height: "100%", display: "block" }}>
      <KpiTile label="Approvals waiting" value={total} subtitle={subtitle} accent={accent} />
    </Link>
  );
}

export function FormApprovalsWaitingWidget(_props: WidgetProps) {
  const { data, isLoading, error } = useApprovalsWaiting();
  if (isLoading) {
    return (
      <PanelCard title="Approvals waiting">
        <Skeleton width="100%" height={140} />
      </PanelCard>
    );
  }
  if (error) {
    return (
      <PanelCard title="Approvals waiting">
        <EmptyNote>Requires forms.approve permission.</EmptyNote>
      </PanelCard>
    );
  }
  const total = data?.total ?? 0;
  const overdue = data?.overdue ?? 0;
  const items = data?.items ?? [];
  return (
    <PanelCard
      title="Approvals waiting"
      actions={
        <Link to="/forms" style={{ fontSize: 11 }}>
          Open queue
        </Link>
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
        <span>
          <strong>{total}</strong> pending
        </span>
        {overdue > 0 ? (
          <span style={{ color: "#EF4444" }}>
            <strong>{overdue}</strong> overdue
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyNote>Nothing waiting on an approval.</EmptyNote>
      ) : (
        <ul style={LIST_BOX_STYLE}>
          {items.map((r) => (
            <li key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>{r.templateName}</strong>
                {r.assignedToName ? ` · ${r.assignedToName}` : r.assignedToRole ? ` · ${r.assignedToRole}` : ""}
              </span>
              <span style={{ color: r.overdue ? "#EF4444" : "var(--text-muted)", flexShrink: 0 }}>
                {relativeDue(r.dueAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

// ── C2 Quotes drafted, not sent ─────────────────────────────────────

function useDraftsSummary() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "quotes-drafts-summary"],
    queryFn: async () => {
      const res = await authFetch("/client-quotes/drafts-summary?limit=5");
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as DraftsSummaryResponse;
    },
    staleTime: 60_000,
    retry: false
  });
}

export function QuoteDraftsKpi(_props: WidgetProps) {
  const { data, isLoading, error } = useDraftsSummary();
  if (isLoading) return <KpiTile label="Draft quotes" value="—" />;
  if (error) return <KpiTile label="Draft quotes" value="—" subtitle="Requires tenders.view" />;
  const total = data?.totalValue ?? 0;
  const count = data?.count ?? 0;
  const subtitle = count === 0 ? "Nothing drafted" : `${count} quote${count === 1 ? "" : "s"} · money on the table`;
  const accent = count === 0 ? "#94A3B8" : "#005B61";
  return (
    <Link to="/tenders" style={{ textDecoration: "none", color: "inherit", height: "100%", display: "block" }}>
      <KpiTile label="Draft quotes" value={formatCompactCurrency(total)} subtitle={subtitle} accent={accent} />
    </Link>
  );
}

export function QuoteDraftsWidget(_props: WidgetProps) {
  const { data, isLoading, error } = useDraftsSummary();
  if (isLoading) {
    return (
      <PanelCard title="Draft quotes">
        <Skeleton width="100%" height={140} />
      </PanelCard>
    );
  }
  if (error) {
    return (
      <PanelCard title="Draft quotes">
        <EmptyNote>Requires tenders.view permission.</EmptyNote>
      </PanelCard>
    );
  }
  const items = data?.items ?? [];
  return (
    <PanelCard
      title="Draft quotes"
      actions={
        <Link to="/tenders" style={{ fontSize: 11 }}>
          Open tenders
        </Link>
      }
    >
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <strong>{data?.count ?? 0}</strong> drafted · {formatCompactCurrency(data?.totalValue ?? 0)} total
      </div>
      {items.length === 0 ? (
        <EmptyNote>No draft quotes waiting to be sent.</EmptyNote>
      ) : (
        <ul style={LIST_BOX_STYLE}>
          {items.map((r) => (
            <li key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>{r.quoteRef}</strong> · {r.clientName}
              </span>
              <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{formatCompactCurrency(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

// ── C3 Pre-starts submitted today ───────────────────────────────────

export function PreStartsTodayKpi(_props: WidgetProps) {
  const { authFetch } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "prestarts-today"],
    queryFn: async () => {
      const res = await authFetch("/forms/pre-starts-today");
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as PreStartsTodayResponse;
    },
    staleTime: 60_000,
    retry: false
  });
  if (isLoading) return <KpiTile label="Prestarts today" value="—" />;
  if (error) return <KpiTile label="Prestarts today" value="—" subtitle="Requires forms.view" />;
  const count = data?.count ?? 0;
  return (
    <Link to="/forms" style={{ textDecoration: "none", color: "inherit", height: "100%", display: "block" }}>
      <KpiTile
        label="Prestarts today"
        value={count}
        subtitle={preStartsSubtitle(data)}
        accent={count === 0 ? "#94A3B8" : "#005B61"}
      />
    </Link>
  );
}

// ── C4 Recent site photos ───────────────────────────────────────────

export function RecentSitePhotosWidget(props: WidgetProps) {
  const { authFetch } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "recent-photos"],
    queryFn: async () => {
      const res = await authFetch("/documents/recent-photos?limit=12");
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as RecentPhotosResponse;
    },
    staleTime: 60_000,
    retry: false
  });
  if (isLoading) {
    return (
      <PanelCard title="Recent site photos">
        <Skeleton width="100%" height={140} />
      </PanelCard>
    );
  }
  if (error) {
    return (
      <PanelCard title="Recent site photos">
        <EmptyNote>Requires documents.view permission.</EmptyNote>
      </PanelCard>
    );
  }
  const items = (data?.items ?? []).filter(isImagePhoto);
  const colSpan = props.colSpan ?? 2;
  const gridCols = Math.max(2, Math.min(4, colSpan * 2));
  return (
    <PanelCard
      title="Recent site photos"
      actions={
        <Link to="/documents" style={{ fontSize: 11 }}>
          Open documents
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyNote>No image documents uploaded yet.</EmptyNote>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            gap: 8,
            maxHeight: 240,
            overflow: "auto"
          }}
        >
          {items.map((p) => {
            const href = p.webUrl ?? `/documents/${p.id}`;
            const alt = p.title || p.fileName || "Site photo";
            return (
              <a
                key={p.id}
                href={href}
                target={p.webUrl ? "_blank" : undefined}
                rel={p.webUrl ? "noreferrer" : undefined}
                style={{
                  display: "block",
                  aspectRatio: "1 / 1",
                  minWidth: 44,
                  minHeight: 44,
                  background: "var(--surface-muted, #F1F5F9)",
                  borderRadius: 6,
                  overflow: "hidden",
                  position: "relative",
                  textDecoration: "none",
                  color: "inherit"
                }}
                aria-label={alt}
                title={alt}
              >
                {p.webUrl ? (
                  <img
                    src={p.webUrl}
                    alt={alt}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "var(--text-muted)"
                    }}
                  >
                    {p.fileName ?? "Photo"}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}

// ── C5 My day ───────────────────────────────────────────────────────

export function MyDayWidget(_props: WidgetProps) {
  const { authFetch } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "my-day"],
    queryFn: async () => {
      const res = await authFetch("/dashboards/my-day");
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as MyDayResponse;
    },
    staleTime: 60_000,
    retry: false
  });
  if (isLoading) {
    return (
      <PanelCard title="My day">
        <Skeleton width="100%" height={200} />
      </PanelCard>
    );
  }
  if (error) {
    return (
      <PanelCard title="My day">
        <EmptyNote>Could not load — try refreshing.</EmptyNote>
      </PanelCard>
    );
  }
  const counts = countMyDay(data);
  const anyContent = counts.allocations + counts.approvals + counts.formsDue > 0;
  return (
    <PanelCard title="My day">
      <div style={{ fontSize: 13, marginBottom: 10, color: "var(--text-default, #242424)" }}>
        {myDayHeadline(counts)}
      </div>
      {!anyContent ? (
        <EmptyNote>Nothing scheduled — no approvals or forms waiting on you.</EmptyNote>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 240, overflow: "auto" }}>
          {counts.allocations > 0 ? (
            <MyDaySection title="Today's allocations" href="/scheduler">
              {data!.allocations.map((a) => (
                <li key={a.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{a.projectNumber}</strong> · {a.projectName}
                    {a.jobRoleName ? ` · ${a.jobRoleName}` : ""}
                  </span>
                </li>
              ))}
            </MyDaySection>
          ) : null}
          {counts.approvals > 0 ? (
            <MyDaySection title="Approvals on you" href="/forms">
              {data!.approvals.map((r) => (
                <li key={r.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{r.templateName}</strong>
                    {r.submittedByName ? ` · ${r.submittedByName}` : ""}
                  </span>
                  <span style={{ color: r.overdue ? "#EF4444" : "var(--text-muted)", flexShrink: 0 }}>
                    {relativeDue(r.dueAt)}
                  </span>
                </li>
              ))}
            </MyDaySection>
          ) : null}
          {counts.formsDue > 0 ? (
            <MyDaySection title="Forms due" href="/forms">
              {data!.formsDue.map((f) => (
                <li key={f.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{f.templateName}</strong>
                  </span>
                  <span style={{ color: f.overdue ? "#EF4444" : "var(--text-muted)", flexShrink: 0 }}>
                    {f.overdue ? "Overdue" : "Due today"}
                  </span>
                </li>
              ))}
            </MyDaySection>
          ) : null}
        </div>
      )}
    </PanelCard>
  );
}

function MyDaySection({
  title,
  href,
  children
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{title}</span>
        <Link to={href} style={{ fontSize: 11 }}>
          Open
        </Link>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {children}
      </ul>
    </div>
  );
}
