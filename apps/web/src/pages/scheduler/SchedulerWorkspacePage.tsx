import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type SchedulerShift = {
  id: string;
  jobId: string;
  jobActivityId: string;
  jobStageId?: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  notes?: string | null;
  workInstructions?: string | null;
  lead?: { id: string; firstName: string; lastName: string } | null;
  workerAssignments: Array<{
    id: string;
    workerId: string;
    roleLabel?: string | null;
    worker: { id: string; firstName: string; lastName: string; resourceType?: { name: string } | null };
  }>;
  assetAssignments: Array<{
    id: string;
    assetId: string;
    asset: { id: string; name: string; assetCode: string; status: string };
  }>;
  conflicts: Array<{ id: string; severity: string; code: string; message: string }>;
};

type SchedulerJob = {
  id: string;
  jobNumber: string;
  name: string;
  client?: { id: string; name: string };
  site?: { id: string; name: string } | null;
  stages: Array<{
    id: string;
    name: string;
    stageOrder: number;
    activities: Array<{
      id: string;
      name: string;
      activityOrder: number;
      shifts: SchedulerShift[];
    }>;
  }>;
};

type SchedulerWorker = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  resourceType?: { name: string } | null;
  availabilityWindows: Array<{ id: string; startAt: string; endAt: string; status: string }>;
};

type SchedulerAsset = {
  id: string;
  name: string;
  assetCode: string;
  status: string;
  homeBase?: string | null;
  category?: { name: string } | null;
};

type WorkspaceResponse = {
  items: {
    jobs: SchedulerJob[];
    workers: SchedulerWorker[];
    assets: SchedulerAsset[];
    shifts: SchedulerShift[];
  };
};

type View = "week" | "month";
type ResourceTab = "workers" | "assets";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shiftStatusClass(shift: SchedulerShift): string {
  if (shift.conflicts.some((c) => c.severity === "RED")) return "sched-pill sched-pill--danger";
  if (shift.conflicts.some((c) => c.severity === "AMBER")) return "sched-pill sched-pill--warning";
  if (shift.status === "CONFIRMED") return "sched-pill sched-pill--success";
  return "sched-pill sched-pill--warning";
}

function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "??";
}

export function SchedulerWorkspacePage() {
  const { authFetch } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [resourceTab, setResourceTab] = useState<ResourceTab>("workers");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<
    { kind: "worker"; id: string } | { kind: "asset"; id: string } | null
  >(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [resourcePanelOpen, setResourcePanelOpen] = useState(true);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/scheduler/workspace?page=1&pageSize=100");
      if (!response.ok) throw new Error("Could not load scheduler workspace.");
      setWorkspace((await response.json()) as WorkspaceResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch]);

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      const d = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { rangeStart: start, rangeEnd: addDays(start, 7), days: d };
    }
    const start = startOfMonth(cursor);
    const weekStart = startOfWeek(start);
    const nextMonth = addMonths(start, 1);
    const cells: Date[] = [];
    let day = weekStart;
    while (day < nextMonth || cells.length % 7 !== 0) {
      cells.push(day);
      day = addDays(day, 1);
    }
    return { rangeStart: weekStart, rangeEnd: day, days: cells };
  }, [view, cursor]);

  const shifts = workspace?.items.shifts ?? [];

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const start = new Date(shift.startAt);
      if (start < rangeStart || start >= rangeEnd) return false;
      if (jobFilter && shift.jobId !== jobFilter) return false;
      return true;
    });
  }, [shifts, rangeStart, rangeEnd, jobFilter]);

  const selectedShift = useMemo(() => {
    if (!selectedShiftId) return null;
    return shifts.find((s) => s.id === selectedShiftId) ?? null;
  }, [shifts, selectedShiftId]);

  const highlightedShiftIds = useMemo(() => {
    if (!selectedResource) return new Set<string>();
    const ids = new Set<string>();
    for (const shift of shifts) {
      if (selectedResource.kind === "worker" && shift.workerAssignments.some((wa) => wa.workerId === selectedResource.id)) ids.add(shift.id);
      if (selectedResource.kind === "asset" && shift.assetAssignments.some((aa) => aa.assetId === selectedResource.id)) ids.add(shift.id);
    }
    return ids;
  }, [shifts, selectedResource]);

  // Local-time YYYY-MM-DD keys. Using toISOString here drops the local zone
  // (AEST is +10), so a Monday cell can index as Sunday and the month view
  // pills render to wrong cells / disappear. Use the cell's own local date
  // for both insertion and lookup to keep them aligned.
  const dayKey = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, SchedulerShift[]>();
    for (const day of days) {
      map.set(dayKey(day), []);
    }
    for (const shift of filteredShifts) {
      const key = dayKey(new Date(shift.startAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(shift);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
    return map;
  }, [days, filteredShifts]);

  const rangeLabel = view === "week"
    ? `${days[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6]?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const go = (dir: -1 | 1) => {
    setCursor((current) => (view === "week" ? addDays(current, dir * 7) : addMonths(current, dir)));
  };

  const today = () => setCursor(new Date());

  const shiftWorkerCount = (workerId: string) =>
    shifts.filter((shift) => shift.workerAssignments.some((wa) => wa.workerId === workerId)).length;

  const availabilityStatus = (worker: SchedulerWorker): "ok" | "leave" => {
    const now = new Date();
    const onLeave = worker.availabilityWindows.some((window) => {
      const start = new Date(window.startAt);
      const end = new Date(window.endAt);
      return window.status === "UNAVAILABLE" && start <= now && now <= end;
    });
    if (worker.status === "ON_LEAVE" || onLeave) return "leave";
    return "ok";
  };

  const assignWorker = async (shiftId: string, workerId: string) => {
    const response = await authFetch(`/scheduler/shifts/${shiftId}/workers`, {
      method: "POST",
      body: JSON.stringify({ workerId })
    });
    if (!response.ok) {
      setError("Could not assign worker.");
      return;
    }
    void reload();
  };

  const unassignWorker = async (shiftId: string, workerId: string) => {
    const response = await authFetch(`/scheduler/shifts/${shiftId}/workers/${workerId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not remove worker.");
      return;
    }
    void reload();
  };

  const assignAsset = async (shiftId: string, assetId: string) => {
    const response = await authFetch(`/scheduler/shifts/${shiftId}/assets`, {
      method: "POST",
      body: JSON.stringify({ assetId })
    });
    if (!response.ok) {
      setError("Could not assign asset.");
      return;
    }
    void reload();
  };

  const unassignAsset = async (shiftId: string, assetId: string) => {
    const response = await authFetch(`/scheduler/shifts/${shiftId}/assets/${assetId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not remove asset.");
      return;
    }
    void reload();
  };

  return (
    <div className={`sched-page${resourcePanelOpen ? "" : " sched-page--resource-collapsed"}`}>
      <aside className="sched-hierarchy">
        <header className="sched-hierarchy__head">
          <span className="s7-type-label">Jobs</span>
        </header>
        <div className="sched-hierarchy__body">
          {loading ? (
            <Skeleton height={16} />
          ) : !workspace || workspace.items.jobs.length === 0 ? (
            <EmptyState heading="No jobs" subtext="Create jobs to start scheduling." />
          ) : (
            <ul className="sched-hierarchy__list">
              <li>
                <button
                  type="button"
                  className={jobFilter === "" ? "sched-hierarchy__job sched-hierarchy__job--active" : "sched-hierarchy__job"}
                  onClick={() => setJobFilter("")}
                >
                  <strong>All jobs</strong>
                  <span className="sched-hierarchy__count">{shifts.length}</span>
                </button>
              </li>
              {workspace.items.jobs.map((job) => {
                const jobShifts = shifts.filter((s) => s.jobId === job.id).length;
                return (
                  <li key={job.id}>
                    <button
                      type="button"
                      className={jobFilter === job.id ? "sched-hierarchy__job sched-hierarchy__job--active" : "sched-hierarchy__job"}
                      onClick={() => setJobFilter(job.id)}
                      title={job.name}
                    >
                      <strong>{job.jobNumber}</strong>
                      <span className="sched-hierarchy__job-name">{job.name}</span>
                      <span className="sched-hierarchy__count">{jobShifts}</span>
                    </button>
                    {jobFilter === job.id ? (
                      <ul className="sched-hierarchy__stages">
                        {job.stages.map((stage) => (
                          <li key={stage.id}>
                            <span className="sched-hierarchy__stage-title">
                              {stage.stageOrder}. {stage.name}
                            </span>
                            <ul className="sched-hierarchy__activities">
                              {stage.activities.map((activity) => (
                                <li key={activity.id} className="sched-hierarchy__activity">
                                  {activity.activityOrder}. {activity.name}
                                  <span className="sched-hierarchy__count">{activity.shifts.length}</span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="sched-main">
        <header className="sched-main__head">
          <div className="sched-main__nav">
            <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => go(-1)} aria-label="Previous">‹</button>
            <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={today}>Today</button>
            <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => go(1)} aria-label="Next">›</button>
            <span className="sched-main__range">{rangeLabel}</span>
          </div>
          <div className="sched-main__actions">
            <div className="tender-page__view-toggle" role="tablist" aria-label="View">
              <button type="button" role="tab" aria-selected={view === "week"} className={view === "week" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"} onClick={() => setView("week")}>Week</button>
              <button type="button" role="tab" aria-selected={view === "month"} className={view === "month" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"} onClick={() => setView("month")}>Month</button>
            </div>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => setResourcePanelOpen((current) => !current)}
              aria-expanded={resourcePanelOpen}
            >
              {resourcePanelOpen ? "Hide resources" : "Show resources"}
            </button>
          </div>
        </header>

        {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

        {view === "week" ? (
          <div className="sched-week">
            {days.map((day) => {
              const key = dayKey(day);
              const daySh = shiftsByDay.get(key) ?? [];
              const isToday = sameDay(day, new Date());
              return (
                <div key={key} className={isToday ? "sched-week__col sched-week__col--today" : "sched-week__col"}>
                  <header className="sched-week__colhead">
                    <span className="sched-week__day">{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className={isToday ? "sched-week__date sched-week__date--today" : "sched-week__date"}>
                      {day.getDate()}
                    </span>
                  </header>
                  <div className="sched-week__body">
                    {loading ? (
                      <Skeleton height={32} />
                    ) : daySh.length === 0 ? (
                      <span className="sched-week__empty">—</span>
                    ) : (
                      daySh.map((shift) => (
                        <ShiftPill
                          key={shift.id}
                          shift={shift}
                          highlighted={highlightedShiftIds.has(shift.id)}
                          dimmed={selectedResource !== null && !highlightedShiftIds.has(shift.id)}
                          onClick={() => setSelectedShiftId(shift.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="sched-month">
            <div className="sched-month__headrow">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((label) => (
                <div key={label} className="sched-month__dayhead">{label}</div>
              ))}
            </div>
            <div className="sched-month__grid">
              {days.map((day) => {
                const key = dayKey(day);
                const daySh = shiftsByDay.get(key) ?? [];
                const isToday = sameDay(day, new Date());
                const inMonth = day.getMonth() === cursor.getMonth();
                return (
                  <div
                    key={key}
                    className={`sched-month__cell${isToday ? " sched-month__cell--today" : ""}${inMonth ? "" : " sched-month__cell--dim"}`}
                  >
                    <span className="sched-month__daynum">{day.getDate()}</span>
                    <div className="sched-month__cellbody">
                      {daySh.slice(0, 3).map((shift) => (
                        <ShiftPill
                          key={shift.id}
                          shift={shift}
                          compact
                          highlighted={highlightedShiftIds.has(shift.id)}
                          dimmed={selectedResource !== null && !highlightedShiftIds.has(shift.id)}
                          onClick={() => setSelectedShiftId(shift.id)}
                        />
                      ))}
                      {daySh.length > 3 ? (
                        <span className="sched-month__more">+{daySh.length - 3} more</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {resourcePanelOpen ? (
        <aside className="sched-resources">
          <header className="sched-resources__head">
            <div className="tender-page__view-toggle" role="tablist" aria-label="Resources">
              <button type="button" role="tab" aria-selected={resourceTab === "workers"} className={resourceTab === "workers" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"} onClick={() => { setResourceTab("workers"); setSelectedResource(null); }}>Workers</button>
              <button type="button" role="tab" aria-selected={resourceTab === "assets"} className={resourceTab === "assets" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"} onClick={() => { setResourceTab("assets"); setSelectedResource(null); }}>Assets</button>
            </div>
          </header>
          <div className="sched-resources__body">
            {loading ? (
              <Skeleton height={28} />
            ) : resourceTab === "workers" ? (
              (workspace?.items.workers ?? []).length === 0 ? (
                <EmptyState heading="No workers" subtext="Workers will appear here once seeded." />
              ) : (
                <ul className="sched-resources__list">
                  {workspace!.items.workers.map((worker) => {
                    const active = selectedResource?.kind === "worker" && selectedResource.id === worker.id;
                    const avail = availabilityStatus(worker);
                    return (
                      <li key={worker.id}>
                        <button
                          type="button"
                          className={active ? "sched-resource sched-resource--active" : "sched-resource"}
                          onClick={() => setSelectedResource(active ? null : { kind: "worker", id: worker.id })}
                        >
                          <span className="sched-resource__avatar">{initials(worker.firstName, worker.lastName)}</span>
                          <span className="sched-resource__meta">
                            <span className="sched-resource__name">{worker.firstName} {worker.lastName}</span>
                            <span className="sched-resource__role">{worker.resourceType?.name ?? "—"}</span>
                          </span>
                          <span className={`sched-resource__dot sched-resource__dot--${avail}`} title={avail === "leave" ? "On leave" : "Available"} aria-hidden />
                          <span
                            className="sched-resource__shifts"
                            title={`${shiftWorkerCount(worker.id)} shift${shiftWorkerCount(worker.id) === 1 ? "" : "s"} this period`}
                          >
                            {shiftWorkerCount(worker.id)} shifts
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (workspace?.items.assets ?? []).length === 0 ? (
              <EmptyState heading="No assets" subtext="Assets will appear here once seeded." />
            ) : (
              <ul className="sched-resources__list">
                {workspace!.items.assets.map((asset) => {
                  const active = selectedResource?.kind === "asset" && selectedResource.id === asset.id;
                  return (
                    <li key={asset.id}>
                      <button
                        type="button"
                        className={active ? "sched-resource sched-resource--active" : "sched-resource"}
                        onClick={() => setSelectedResource(active ? null : { kind: "asset", id: asset.id })}
                      >
                        <span className="sched-resource__meta sched-resource__meta--full">
                          <span className="sched-resource__name">{asset.name}</span>
                          <span className="sched-resource__role">{asset.category?.name ?? "—"}{asset.homeBase ? ` · ${asset.homeBase}` : ""}</span>
                        </span>
                        <span className={asset.status === "MAINTENANCE" ? "s7-badge s7-badge--warning" : asset.status === "OUT_OF_SERVICE" ? "s7-badge s7-badge--danger" : "s7-badge s7-badge--active"}>
                          {asset.status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      ) : null}

      {selectedShift ? (
        <ShiftDetailSlideOver
          shift={selectedShift}
          workers={workspace?.items.workers ?? []}
          assets={workspace?.items.assets ?? []}
          onClose={() => setSelectedShiftId(null)}
          onAssignWorker={(workerId) => assignWorker(selectedShift.id, workerId)}
          onUnassignWorker={(workerId) => unassignWorker(selectedShift.id, workerId)}
          onAssignAsset={(assetId) => assignAsset(selectedShift.id, assetId)}
          onUnassignAsset={(assetId) => unassignAsset(selectedShift.id, assetId)}
        />
      ) : null}
    </div>
  );
}

type ShiftPillProps = {
  shift: SchedulerShift;
  highlighted?: boolean;
  dimmed?: boolean;
  compact?: boolean;
  onClick: () => void;
};

function ShiftPill({ shift, highlighted, dimmed, compact, onClick }: ShiftPillProps) {
  const cls = [shiftStatusClass(shift)];
  if (highlighted) cls.push("sched-pill--highlight");
  if (dimmed) cls.push("sched-pill--dim");
  if (compact) cls.push("sched-pill--compact");
  const conflictCount = shift.conflicts.length;
  return (
    <button
      type="button"
      className={cls.join(" ")}
      onClick={onClick}
      title={shift.title}
    >
      <span className="sched-pill__time">{formatHour(shift.startAt)}–{formatHour(shift.endAt)}</span>
      <span className="sched-pill__title">{shift.title}</span>
      {conflictCount > 0 ? (
        <span
          className="sched-pill__conflict"
          title={shift.conflicts.map((c) => `${c.severity}: ${c.message}`).join("\n")}
          aria-label={`${conflictCount} conflict${conflictCount > 1 ? "s" : ""}`}
        >
          {conflictCount}
        </span>
      ) : null}
    </button>
  );
}

type ShiftDetailSlideOverProps = {
  shift: SchedulerShift;
  workers: SchedulerWorker[];
  assets: SchedulerAsset[];
  onClose: () => void;
  onAssignWorker: (workerId: string) => Promise<void> | void;
  onUnassignWorker: (workerId: string) => Promise<void> | void;
  onAssignAsset: (assetId: string) => Promise<void> | void;
  onUnassignAsset: (assetId: string) => Promise<void> | void;
};

function ShiftDetailSlideOver({
  shift,
  workers,
  assets,
  onClose,
  onAssignWorker,
  onUnassignWorker,
  onAssignAsset,
  onUnassignAsset
}: ShiftDetailSlideOverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [addWorkerId, setAddWorkerId] = useState("");
  const [addAssetId, setAddAssetId] = useState("");

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const assignedWorkerIds = new Set(shift.workerAssignments.map((wa) => wa.workerId));
  const assignedAssetIds = new Set(shift.assetAssignments.map((aa) => aa.assetId));
  const unassignedWorkers = workers.filter((w) => !assignedWorkerIds.has(w.id));
  const unassignedAssets = assets.filter((a) => !assignedAssetIds.has(a.id));

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Shift detail" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <p className="s7-type-label">{new Date(shift.startAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
            <h2 className="s7-type-section-heading" style={{ margin: "2px 0 0" }}>{shift.title}</h2>
            <p className="slide-over__subtitle">
              {formatHour(shift.startAt)}–{formatHour(shift.endAt)} · {shift.status}
            </p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <div className="slide-over__body">
          {shift.conflicts.length ? (
            <section className="sched-detail__section">
              <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Conflicts</h3>
              <ul className="sched-detail__conflicts">
                {shift.conflicts.map((conflict) => (
                  <li key={conflict.id} className={`sched-detail__conflict sched-detail__conflict--${conflict.severity.toLowerCase()}`}>
                    <span className={`s7-badge ${conflict.severity === "RED" ? "s7-badge--danger" : conflict.severity === "AMBER" ? "s7-badge--warning" : "s7-badge--neutral"}`}>
                      {conflict.severity}
                    </span>
                    <div>
                      <strong>{conflict.code}</strong>
                      <p>{conflict.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="sched-detail__section">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Workers ({shift.workerAssignments.length})</h3>
            {shift.workerAssignments.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No workers assigned yet.</p>
            ) : (
              <ul className="sched-detail__list">
                {shift.workerAssignments.map((wa) => (
                  <li key={wa.id}>
                    <span className="sched-resource__avatar">{initials(wa.worker.firstName, wa.worker.lastName)}</span>
                    <span className="sched-resource__meta">
                      <span className="sched-resource__name">{wa.worker.firstName} {wa.worker.lastName}</span>
                      <span className="sched-resource__role">{wa.worker.resourceType?.name ?? wa.roleLabel ?? "—"}</span>
                    </span>
                    <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void onUnassignWorker(wa.workerId)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="sched-detail__assign">
              <select className="s7-select" value={addWorkerId} onChange={(event) => setAddWorkerId(event.target.value)}>
                <option value="">Assign worker…</option>
                {unassignedWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.firstName} {worker.lastName} · {worker.resourceType?.name ?? "—"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                disabled={!addWorkerId}
                onClick={async () => {
                  if (!addWorkerId) return;
                  await onAssignWorker(addWorkerId);
                  setAddWorkerId("");
                }}
              >
                Add
              </button>
            </div>
          </section>

          <section className="sched-detail__section">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Assets ({shift.assetAssignments.length})</h3>
            {shift.assetAssignments.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No assets assigned.</p>
            ) : (
              <ul className="sched-detail__list">
                {shift.assetAssignments.map((aa) => (
                  <li key={aa.id}>
                    <span className="sched-resource__meta sched-resource__meta--full">
                      <span className="sched-resource__name">{aa.asset.name}</span>
                      <span className="sched-resource__role">{aa.asset.assetCode} · {aa.asset.status}</span>
                    </span>
                    <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void onUnassignAsset(aa.assetId)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="sched-detail__assign">
              <select className="s7-select" value={addAssetId} onChange={(event) => setAddAssetId(event.target.value)}>
                <option value="">Assign asset…</option>
                {unassignedAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {asset.assetCode}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                disabled={!addAssetId}
                onClick={async () => {
                  if (!addAssetId) return;
                  await onAssignAsset(addAssetId);
                  setAddAssetId("");
                }}
              >
                Add
              </button>
            </div>
          </section>

          {shift.notes || shift.workInstructions ? (
            <section className="sched-detail__section">
              <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Notes</h3>
              {shift.notes ? <p>{shift.notes}</p> : null}
              {shift.workInstructions ? (
                <>
                  <h4 className="s7-type-card-title">Work instructions</h4>
                  <p>{shift.workInstructions}</p>
                </>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
