import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type MaintenancePlan = {
  id: string;
  title: string;
  nextDueAt?: string | null;
  lastCompletedAt?: string | null;
  status: string;
};

type MaintenanceEvent = {
  id: string;
  eventType: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  status: string;
  notes?: string | null;
  maintenancePlanId?: string | null;
};

type Inspection = {
  id: string;
  inspectionType: string;
  inspectedAt: string;
  status: string;
  notes?: string | null;
};

type Breakdown = {
  id: string;
  reportedAt: string;
  resolvedAt?: string | null;
  severity: string;
  status: string;
  summary: string;
};

type MaintenanceAsset = {
  id: string;
  name: string;
  assetCode: string;
  status: string;
  homeBase?: string | null;
  category?: { id: string; name: string } | null;
  maintenancePlans: MaintenancePlan[];
  maintenanceEvents: MaintenanceEvent[];
  inspections: Inspection[];
  breakdowns: Breakdown[];
  maintenanceSummary?: {
    openBreakdown: boolean;
    overdueMaintenance: boolean;
    failedInspection: boolean;
  };
};

type MaintenanceResponse = {
  items: MaintenanceAsset[];
  total: number;
};

type UpcomingItem = {
  id: string;
  kind: "service" | "inspection" | "breakdown";
  title: string;
  subtitle: string;
  dueAt: Date;
  assetName: string;
  assetId: string;
  overdue: boolean;
};

const TYPE_CLASS: Record<UpcomingItem["kind"], string> = {
  service: "s7-badge s7-badge--info",
  inspection: "s7-badge s7-badge--warning",
  breakdown: "s7-badge s7-badge--danger"
};

const TYPE_LABEL: Record<UpcomingItem["kind"], string> = {
  service: "Scheduled",
  inspection: "Inspection",
  breakdown: "Breakdown"
};

function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MaintenancePage() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<MaintenanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [logOpen, setLogOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/maintenance/assets?page=1&pageSize=200");
      if (!response.ok) throw new Error("Could not load maintenance data.");
      setData((await response.json()) as MaintenanceResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch]);

  const upcoming = useMemo<UpcomingItem[]>(() => {
    if (!data) return [];
    const now = Date.now();
    const list: UpcomingItem[] = [];
    for (const asset of data.items) {
      for (const event of asset.maintenanceEvents) {
        if (event.status === "COMPLETED") continue;
        const at = event.scheduledAt;
        if (!at) continue;
        const dueAt = new Date(at);
        list.push({
          id: `event-${event.id}`,
          kind: "service",
          title: event.eventType,
          subtitle: event.notes ?? "Scheduled service",
          dueAt,
          assetName: asset.name,
          assetId: asset.id,
          overdue: dueAt.getTime() < now || event.status === "OVERDUE"
        });
      }
      for (const inspection of asset.inspections.slice(0, 3)) {
        const dueAt = new Date(inspection.inspectedAt);
        // Only show inspections scheduled for the future, not historical ones
        if (dueAt.getTime() < now - 7 * 24 * 60 * 60 * 1000) continue;
        list.push({
          id: `inspection-${inspection.id}`,
          kind: "inspection",
          title: inspection.inspectionType,
          subtitle: inspection.notes ?? `${inspection.status} inspection`,
          dueAt,
          assetName: asset.name,
          assetId: asset.id,
          overdue: false
        });
      }
      for (const breakdown of asset.breakdowns) {
        if (breakdown.status === "RESOLVED") continue;
        list.push({
          id: `breakdown-${breakdown.id}`,
          kind: "breakdown",
          title: breakdown.summary,
          subtitle: `Severity ${breakdown.severity} · ${breakdown.status}`,
          dueAt: new Date(breakdown.reportedAt),
          assetName: asset.name,
          assetId: asset.id,
          overdue: true
        });
      }
    }
    list.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });
    return list;
  }, [data]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const start = startOfWeek(monthStart);
    const nextMonth = addMonths(monthStart, 1);
    const cells: Date[] = [];
    let day = start;
    while (day < nextMonth || cells.length % 7 !== 0) {
      cells.push(day);
      day = addDays(day, 1);
    }
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, UpcomingItem[]>();
    for (const cell of calendarCells) {
      map.set(cell.toISOString().slice(0, 10), []);
    }
    for (const item of upcoming) {
      const key = item.dueAt.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [calendarCells, upcoming]);

  return (
    <div className="maint-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Operations</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Maintenance</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => setLogOpen(true)}>
            + Log event
          </button>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="maint-split">
        <section className="s7-card maint-upcoming">
          <header className="maint-upcoming__head">
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Upcoming &amp; overdue</h2>
            <span className="maint-upcoming__count">{upcoming.length}</span>
          </header>
          <div className="maint-upcoming__body">
            {loading ? (
              <Skeleton height={40} />
            ) : upcoming.length === 0 ? (
              <EmptyState heading="No maintenance due" subtext="When an asset has an upcoming service, inspection, or open breakdown, it'll appear here." />
            ) : (
              <ul className="maint-upcoming__list">
                {upcoming.map((item) => (
                  <li key={item.id} className={item.overdue ? "maint-upcoming__item maint-upcoming__item--overdue" : "maint-upcoming__item"}>
                    <div className="maint-upcoming__row">
                      <Link to={`/assets/${item.assetId}`} className="maint-upcoming__asset">
                        {item.assetName}
                      </Link>
                      <span className={TYPE_CLASS[item.kind]}>{TYPE_LABEL[item.kind]}</span>
                    </div>
                    <strong className="maint-upcoming__title">{item.title}</strong>
                    <p className="maint-upcoming__sub">{item.subtitle}</p>
                    <div className="maint-upcoming__due">
                      <span>Due {formatDate(item.dueAt)}</span>
                      {item.overdue ? <span className="maint-upcoming__overdue">Overdue</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="s7-card maint-calendar">
          <header className="maint-calendar__head">
            <div className="sched-main__nav">
              <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">‹</button>
              <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => setCursor(new Date())}>Today</button>
              <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">›</button>
              <span className="sched-main__range">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
            </div>
          </header>
          <div className="sched-month__headrow">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((label) => (
              <div key={label} className="sched-month__dayhead">{label}</div>
            ))}
          </div>
          <div className="sched-month__grid">
            {calendarCells.map((cell) => {
              const key = cell.toISOString().slice(0, 10);
              const items = eventsByDay.get(key) ?? [];
              const isToday = sameDay(cell, new Date());
              const inMonth = cell.getMonth() === cursor.getMonth();
              return (
                <div
                  key={key}
                  className={`sched-month__cell${isToday ? " sched-month__cell--today" : ""}${inMonth ? "" : " sched-month__cell--dim"}`}
                >
                  <span className="sched-month__daynum">{cell.getDate()}</span>
                  <div className="sched-month__cellbody">
                    {items.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        to={`/assets/${item.assetId}`}
                        className={`sched-pill sched-pill--compact ${
                          item.overdue ? "sched-pill--danger" : item.kind === "service" ? "sched-pill--warning" : item.kind === "inspection" ? "sched-pill--warning" : "sched-pill--danger"
                        }`}
                        style={{ textDecoration: "none" }}
                        title={`${item.assetName} · ${item.title}`}
                      >
                        <span className="sched-pill__title">{item.assetName}</span>
                      </Link>
                    ))}
                    {items.length > 3 ? <span className="sched-month__more">+{items.length - 3} more</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <LogEventSlideOver
        open={logOpen}
        onClose={() => setLogOpen(false)}
        assets={data?.items ?? []}
        onLogged={() => {
          setLogOpen(false);
          void reload();
        }}
      />
    </div>
  );
}

type LogEventSlideOverProps = {
  open: boolean;
  onClose: () => void;
  assets: MaintenanceAsset[];
  onLogged: () => void;
};

function LogEventSlideOver({ open, onClose, assets, onLogged }: LogEventSlideOverProps) {
  const { authFetch } = useAuth();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    assetId: "",
    kind: "service" as "service" | "inspection" | "breakdown",
    eventType: "SERVICE",
    scheduledAt: "",
    completedAt: "",
    status: "SCHEDULED",
    inspectionType: "ROUTINE",
    inspectedAt: "",
    inspectionStatus: "PASS",
    severity: "MEDIUM",
    summary: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.assetId) {
      setError("Choose an asset.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (form.kind === "service") {
        const response = await authFetch("/maintenance/events", {
          method: "POST",
          body: JSON.stringify({
            assetId: form.assetId,
            eventType: form.eventType,
            scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
            completedAt: form.completedAt ? new Date(form.completedAt).toISOString() : undefined,
            status: form.status,
            notes: form.notes || undefined
          })
        });
        if (!response.ok) throw new Error("Could not log event.");
      } else if (form.kind === "inspection") {
        if (!form.inspectedAt) {
          setError("Inspection date is required.");
          setSubmitting(false);
          return;
        }
        const response = await authFetch("/maintenance/inspections", {
          method: "POST",
          body: JSON.stringify({
            assetId: form.assetId,
            inspectionType: form.inspectionType,
            inspectedAt: new Date(form.inspectedAt).toISOString(),
            status: form.inspectionStatus,
            notes: form.notes || undefined
          })
        });
        if (!response.ok) throw new Error("Could not log inspection.");
      } else {
        if (!form.summary.trim()) {
          setError("Breakdown summary is required.");
          setSubmitting(false);
          return;
        }
        const response = await authFetch("/maintenance/breakdowns", {
          method: "POST",
          body: JSON.stringify({
            assetId: form.assetId,
            reportedAt: new Date().toISOString(),
            severity: form.severity,
            status: "OPEN",
            summary: form.summary.trim(),
            notes: form.notes || undefined
          })
        });
        if (!response.ok) throw new Error("Could not log breakdown.");
      }
      onLogged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Log maintenance event" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Log maintenance event</h2>
            <p className="slide-over__subtitle">Record a scheduled service, inspection, or breakdown.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={submit} className="slide-over__body tender-form">
          {error ? <div className="login-card__error" role="alert">{error}</div> : null}
          <div className="tender-page__view-toggle" role="tablist">
            {(["service","inspection","breakdown"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={form.kind === kind}
                className={form.kind === kind ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
                onClick={() => setForm({ ...form, kind })}
              >
                {kind.charAt(0).toUpperCase() + kind.slice(1)}
              </button>
            ))}
          </div>

          <label className="tender-form__field">
            <span className="s7-type-label">Asset</span>
            <select className="s7-select" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} required>
              <option value="">Select an asset</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.assetCode}</option>)}
            </select>
          </label>

          {form.kind === "service" ? (
            <>
              <label className="tender-form__field">
                <span className="s7-type-label">Event type</span>
                <input className="s7-input" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} placeholder="SERVICE" />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Scheduled at</span>
                <input className="s7-input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Completed at</span>
                <input className="s7-input" type="datetime-local" value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Status</span>
                <select className="s7-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
            </>
          ) : form.kind === "inspection" ? (
            <>
              <label className="tender-form__field">
                <span className="s7-type-label">Inspection type</span>
                <input className="s7-input" value={form.inspectionType} onChange={(e) => setForm({ ...form, inspectionType: e.target.value })} />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Inspected at</span>
                <input className="s7-input" type="datetime-local" value={form.inspectedAt} onChange={(e) => setForm({ ...form, inspectedAt: e.target.value })} required />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Result</span>
                <select className="s7-select" value={form.inspectionStatus} onChange={(e) => setForm({ ...form, inspectionStatus: e.target.value })}>
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="tender-form__field">
                <span className="s7-type-label">Summary</span>
                <input className="s7-input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} required />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Severity</span>
                <select className="s7-select" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
            </>
          )}

          <label className="tender-form__field">
            <span className="s7-type-label">Notes</span>
            <textarea className="s7-textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>

          <footer className="slide-over__footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Logging…" : "Log event"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
