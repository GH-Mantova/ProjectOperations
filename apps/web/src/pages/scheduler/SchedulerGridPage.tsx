import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  addDaysUtc,
  emptyCellAmber,
  groupByJob,
  groupByResource,
  indexCells,
  isoDay,
  isSameUtcDay,
  isWeekend,
  parseIsoDay,
  visibleRange,
  workerDayMap,
  type GridCell,
  type GridOrientation,
  type GridView,
  type GroupedRows,
  type PublicHoliday
} from "./schedulerGridHelpers";

const TOUCH: CSSProperties = { minHeight: 44, minWidth: 44 };

type Project = { id: string; projectNumber: string; name: string };
type JobRole = { id: string; name: string; colour: string | null };
type EligibleWorker = {
  worker: { id: string; firstName: string; lastName: string; role: string | null };
  eligible: boolean;
  reasons: string[];
};

type WorkerSuggestion = {
  targetType: "WORKER";
  worker: { id: string; firstName: string; lastName: string; role: string | null };
  score: number;
  eligible: boolean;
  reasons: string[];
  breakdown: { roleFit: number; availability: number; proximity: number };
};

type DragState = {
  groupId: string;
  rowKey: string;
  startIndex: number;
  endIndex: number;
} | null;

type PickerState = {
  date: string;
  projectId: string;
  jobRoleId: string | null;
  rowKey?: string;
} | null;

export function SchedulerGridPage() {
  const { authFetch } = useAuth();
  const [view, setView] = useState<GridView>("month");
  const [orientation, setOrientation] = useState<GridOrientation>("project");
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  });
  const [hideEmpty, setHideEmpty] = useState(false);

  const [cells, setCells] = useState<GridCell[] | null>(null);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [picker, setPicker] = useState<PickerState>(null);
  const [pickerWorkers, setPickerWorkers] = useState<EligibleWorker[] | null>(null);
  const [pickerShowAll, setPickerShowAll] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerSuggestMode, setPickerSuggestMode] = useState(false);
  const [pickerSuggestions, setPickerSuggestions] = useState<WorkerSuggestion[] | null>(null);

  const [drag, setDrag] = useState<DragState>(null);
  const dragRowRef = useRef<DragState>(null);

  const { from, to, days } = useMemo(() => visibleRange(view, cursor), [view, cursor]);

  const load = useCallback(async () => {
    setCells(null);
    setError(null);
    try {
      const fromIso = isoDay(from);
      const toIso = isoDay(to);
      const [allocsRes, holRes, projRes, rolesRes] = await Promise.all([
        authFetch(`/scheduler/allocations?from=${fromIso}&to=${toIso}&orientation=${orientation}`),
        authFetch(`/public-holidays?region=QLD&from=${fromIso}&to=${toIso}`),
        authFetch("/projects?limit=200"),
        authFetch("/job-roles")
      ]);
      if (!allocsRes.ok) throw new Error("Could not load schedule allocations.");
      const allocsJson = (await allocsRes.json()) as { cells: GridCell[] };
      const cellsNorm: GridCell[] = allocsJson.cells.map((c) => ({
        ...c,
        date: typeof c.date === "string" ? c.date.slice(0, 10) : c.date
      }));
      setCells(cellsNorm);
      if (holRes.ok) {
        const holJson = (await holRes.json()) as PublicHoliday[];
        setHolidays(holJson.map((h) => ({ ...h, date: h.date.slice(0, 10) })));
      }
      if (projRes.ok) {
        const projJson = await projRes.json();
        const list: Project[] = Array.isArray(projJson) ? projJson : projJson.items ?? [];
        setProjects(list);
      }
      if (rolesRes.ok) {
        const rolesJson = (await rolesRes.json()) as JobRole[];
        setJobRoles(rolesJson);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, from, to, orientation]);

  useEffect(() => {
    void load();
  }, [load]);

  const holidaysByDate = useMemo(() => {
    const m = new Map<string, PublicHoliday>();
    for (const h of holidays) m.set(h.date, h);
    return m;
  }, [holidays]);

  const cellIndex = useMemo(() => indexCells(cells ?? []), [cells]);
  const byWorkerDate = useMemo(() => workerDayMap(cells ?? []), [cells]);

  const groups = useMemo<GroupedRows[]>(() => {
    if (!cells) return [];
    const base = orientation === "project" ? groupByJob(cells) : groupByResource(cells);
    // Project orientation: add a stub for every project the user can pick
    // (so empty rows are reachable when "hide empty" is off).
    if (orientation === "project" && !hideEmpty) {
      const have = new Set(base.map((g) => g.groupId));
      for (const p of projects) {
        if (!have.has(p.id)) {
          base.push({ groupId: p.id, groupLabel: p.projectNumber, groupSub: p.name, rows: [] });
        }
      }
    }
    if (hideEmpty) {
      return base.filter((g) => g.rows.length > 0);
    }
    return base.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
  }, [cells, orientation, hideEmpty, projects]);

  const rangeLabel = useMemo(() => {
    if (view === "week") {
      const first = days[0]!;
      const last = days[days.length - 1]!;
      const fmt = (d: Date) =>
        new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
      return `${fmt(first)} – ${fmt(last)}`;
    }
    return cursor.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  }, [days, cursor, view]);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }, []);

  const go = (dir: -1 | 1) => {
    if (view === "week") {
      setCursor((c) => addDaysUtc(c, dir * 7));
    } else {
      setCursor((c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + dir, 1)));
    }
  };

  const goToday = () => setCursor(today);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Per-day total headcount across visible cells, keyed by group+date for
  // group-header overlay totals (project orientation: workers on that project
  // per day; resource orientation: count of project-cells on that resource).
  const headcounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!cells) return map;
    for (const cell of cells) {
      const groupKey = orientation === "project" ? cell.projectId : cell.targetType === "WORKER" ? "workers" : "assets";
      const k = `${groupKey}|${cell.date}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [cells, orientation]);

  const openPickerForCell = (date: string, projectId: string, jobRoleId: string | null, rowKey?: string) => {
    setPickerError(null);
    setPickerShowAll(false);
    setPickerSuggestMode(false);
    setPickerSuggestions(null);
    setPicker({ date, projectId, jobRoleId, rowKey });
  };

  useEffect(() => {
    let alive = true;
    if (!picker || !picker.jobRoleId) {
      setPickerWorkers(null);
      return;
    }
    void (async () => {
      try {
        const r = await authFetch(
          `/scheduler/eligible-workers?jobRoleId=${encodeURIComponent(picker.jobRoleId!)}&date=${picker.date}&projectId=${encodeURIComponent(picker.projectId)}&showAll=${pickerShowAll}`
        );
        if (!alive) return;
        if (!r.ok) {
          setPickerError("Could not load workers.");
          setPickerWorkers([]);
          return;
        }
        const j = (await r.json()) as { workers: EligibleWorker[] };
        setPickerWorkers(j.workers);
      } catch {
        if (alive) setPickerError("Could not load workers.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [authFetch, picker, pickerShowAll]);

  useEffect(() => {
    let alive = true;
    if (!picker || !pickerSuggestMode || !picker.projectId) {
      setPickerSuggestions(null);
      return;
    }
    void (async () => {
      try {
        const params = new URLSearchParams({
          date: picker.date,
          projectId: picker.projectId,
          includeIneligible: pickerShowAll ? "true" : "false"
        });
        if (picker.jobRoleId) params.set("jobRoleId", picker.jobRoleId);
        const r = await authFetch(`/scheduler/suggestions?${params.toString()}`);
        if (!alive) return;
        if (!r.ok) {
          setPickerError("Could not load suggestions.");
          setPickerSuggestions([]);
          return;
        }
        const j = (await r.json()) as { suggestions: WorkerSuggestion[] };
        setPickerSuggestions(j.suggestions);
      } catch {
        if (alive) setPickerError("Could not load suggestions.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [authFetch, picker, pickerShowAll, pickerSuggestMode]);

  const upsertCell = async (
    date: string,
    projectId: string,
    workerProfileId: string,
    jobRoleId: string | null,
    overrideReason?: string
  ): Promise<{ ok: boolean; reasons?: string[]; needOverride?: boolean; message?: string }> => {
    const body = JSON.stringify({
      date,
      projectId,
      targetType: "WORKER",
      workerProfileId,
      jobRoleId,
      ...(overrideReason ? { override: { reason: overrideReason } } : {})
    });
    const res = await authFetch("/scheduler/allocations", { method: "POST", body });
    if (res.ok) return { ok: true };
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, needOverride: true, reasons: j?.reasons ?? [] };
    }
    return { ok: false, message: `Save failed (${res.status})` };
  };

  const handlePickWorker = async (worker: EligibleWorker) => {
    if (!picker) return;
    setPickerError(null);
    let result = await upsertCell(picker.date, picker.projectId, worker.worker.id, picker.jobRoleId);
    if (!result.ok && result.needOverride) {
      const reason = window.prompt(
        `This worker is not eligible (${(result.reasons ?? []).join(", ") || "unknown"}). Enter override reason to proceed:`
      );
      if (!reason || !reason.trim()) return;
      result = await upsertCell(picker.date, picker.projectId, worker.worker.id, picker.jobRoleId, reason.trim());
    }
    if (!result.ok) {
      setPickerError(result.message ?? "Could not assign worker.");
      return;
    }
    setPicker(null);
    void load();
  };

  const deleteCell = async (id: string) => {
    const res = await authFetch(`/scheduler/allocations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete cell.");
      return;
    }
    void load();
  };

  // Drag-to-range helpers (resource orientation; pointer events on cells).
  const onCellPointerDown = (groupId: string, rowKey: string, dayIndex: number) => {
    dragRowRef.current = { groupId, rowKey, startIndex: dayIndex, endIndex: dayIndex };
    setDrag(dragRowRef.current);
  };
  const onCellPointerEnter = (groupId: string, rowKey: string, dayIndex: number) => {
    const cur = dragRowRef.current;
    if (!cur || cur.groupId !== groupId || cur.rowKey !== rowKey) return;
    const next = { ...cur, endIndex: dayIndex };
    dragRowRef.current = next;
    setDrag(next);
  };

  const fillRange = async (
    projectId: string,
    workerProfileId: string,
    jobRoleId: string | null,
    fromDate: string,
    toDate: string
  ): Promise<void> => {
    const body = JSON.stringify({
      from: fromDate,
      to: toDate,
      projectId,
      targetType: "WORKER",
      workerProfileId,
      jobRoleId
    });
    const res = await authFetch("/scheduler/allocations/range", { method: "POST", body });
    if (!res.ok) {
      if (res.status === 409) {
        const reason = window.prompt("Range contains ineligible days. Enter override reason to fill anyway:");
        if (!reason || !reason.trim()) return;
        const body2 = JSON.stringify({
          from: fromDate,
          to: toDate,
          projectId,
          targetType: "WORKER",
          workerProfileId,
          jobRoleId,
          override: { reason: reason.trim() }
        });
        const res2 = await authFetch("/scheduler/allocations/range", { method: "POST", body: body2 });
        if (!res2.ok) {
          setError("Range fill failed.");
          return;
        }
      } else {
        setError("Range fill failed.");
        return;
      }
    }
    void load();
  };

  const clearRange = async (
    projectId: string,
    workerProfileId: string,
    jobRoleId: string | null,
    fromDate: string,
    toDate: string
  ): Promise<void> => {
    const body = JSON.stringify({
      from: fromDate,
      to: toDate,
      projectId,
      targetType: "WORKER",
      workerProfileId,
      jobRoleId,
      clear: true
    });
    const res = await authFetch("/scheduler/allocations/range", { method: "POST", body });
    if (!res.ok) {
      setError("Range clear failed.");
      return;
    }
    void load();
  };

  const onPointerUp = useCallback(async () => {
    const cur = dragRowRef.current;
    dragRowRef.current = null;
    setDrag(null);
    if (!cur) return;
    const a = Math.min(cur.startIndex, cur.endIndex);
    const b = Math.max(cur.startIndex, cur.endIndex);
    if (a === b) return; // single-click handled via onClick
    const fromDate = isoDay(days[a]!);
    const toDate = isoDay(days[b]!);
    // Decode rowKey: orientation === "resource" → "W|<workerId>" or "A|<assetId>";
    // For project orientation drag is per row inside a project group: rowKey = "<workerId>|<roleKey>".
    if (orientation === "project") {
      const [workerId, roleKey] = cur.rowKey.split("|");
      if (!workerId) return;
      await fillRange(
        cur.groupId,
        workerId,
        roleKey && roleKey !== "_" ? roleKey : null,
        fromDate,
        toDate
      );
    } else {
      const [kind, id] = cur.rowKey.split("|");
      if (kind !== "W" || !id) return;
      // Need a project context to fill — open picker for the first cell so the
      // user can choose which project. Fallback: no-op.
      openPickerForCell(fromDate, "", null, cur.rowKey);
    }
  }, [days, orientation]);

  useEffect(() => {
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerUp]);

  const loading = cells === null;

  return (
    <div className="sched-grid-page">
      <h1 className="s7-type-page-title" style={{ margin: "0 0 8px" }}>Scheduler grid</h1>
      <header className="sched-grid__head">
        <div className="sched-grid__nav">
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => go(-1)}
            aria-label="Previous"
            style={TOUCH}
          >
            ‹
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            onClick={goToday}
            style={TOUCH}
          >
            Today
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => go(1)}
            aria-label="Next"
            style={TOUCH}
          >
            ›
          </button>
          <span className="sched-grid__range" data-testid="grid-range-label">{rangeLabel}</span>
        </div>
        <div className="sched-grid__actions">
          <div className="tender-page__view-toggle" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={view === "week"}
              className={view === "week" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("week")}
            >
              Week
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "month"}
              className={view === "month" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("month")}
            >
              Month
            </button>
          </div>
          <div className="tender-page__view-toggle" role="tablist" aria-label="Orientation">
            <button
              type="button"
              role="tab"
              aria-selected={orientation === "project"}
              className={orientation === "project" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setOrientation("project")}
              data-testid="orient-by-job"
            >
              By job
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={orientation === "resource"}
              className={orientation === "resource" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setOrientation("resource")}
              data-testid="orient-by-resource"
            >
              By resource
            </button>
          </div>
          <label className="sched-grid__toggle">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
            />
            Hide empty
          </label>
        </div>
      </header>

      {error ? (
        <div className="tender-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="sched-grid__wrap" data-testid="scheduler-grid">
        <div
          className="sched-grid__table"
          style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(34px, 1fr))` }}
        >
          {/* Header row */}
          <div className="sched-grid__corner">Resource</div>
          {days.map((d) => {
            const iso = isoDay(d);
            const holiday = holidaysByDate.get(iso);
            const weekend = isWeekend(d);
            const isToday = isSameUtcDay(d, today);
            const classes = ["sched-grid__dayhead"];
            if (weekend) classes.push("sched-grid__dayhead--weekend");
            if (holiday) classes.push("sched-grid__dayhead--holiday");
            if (isToday) classes.push("sched-grid__dayhead--today");
            return (
              <div
                key={iso}
                className={classes.join(" ")}
                title={holiday ? `${holiday.name} (QLD)` : weekend ? "Weekend" : undefined}
                data-testid={`dayhead-${iso}`}
              >
                <span className="sched-grid__dayname">
                  {d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
                </span>
                <span className="sched-grid__daynum">{d.getUTCDate()}</span>
              </div>
            );
          })}

          {/* Loading skeleton */}
          {loading ? (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={`sk-${i}`} cols={days.length + 1} />
              ))}
            </>
          ) : groups.length === 0 ? (
            <div className="sched-grid__empty" style={{ gridColumn: `span ${days.length + 1}` }}>
              <EmptyState
                heading="No allocations"
                subtext="Add a worker or asset to a project to see it on the grid."
              />
            </div>
          ) : (
            groups.map((group) => {
              const collapsed = collapsedGroups.has(group.groupId);
              return (
                <GroupRows
                  key={group.groupId}
                  group={group}
                  collapsed={collapsed}
                  onToggle={() => toggleGroup(group.groupId)}
                  days={days}
                  cellIndex={cellIndex}
                  byWorkerDate={byWorkerDate}
                  orientation={orientation}
                  holidaysByDate={holidaysByDate}
                  today={today}
                  headcounts={headcounts}
                  drag={drag}
                  onCellPointerDown={onCellPointerDown}
                  onCellPointerEnter={onCellPointerEnter}
                  onCellClick={(rowKey, dayIso, cell) => {
                    if (cell) {
                      void deleteCell(cell.id);
                      return;
                    }
                    // Open picker for empty cell.
                    if (orientation === "project") {
                      const [workerId, roleKey] = rowKey.split("|");
                      const jobRoleId = roleKey && roleKey !== "_" ? roleKey : null;
                      if (workerId && jobRoleId) {
                        // Direct upsert (already known worker) — pick using
                        // first eligible role; here we re-add the existing
                        // worker by calling upsert directly.
                        void upsertCell(dayIso, group.groupId, workerId, jobRoleId).then(
                          (r) => (r.ok ? load() : null)
                        );
                        return;
                      }
                    }
                    openPickerForCell(dayIso, group.groupId, null, rowKey);
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Add-row picker per project group */}
      {orientation === "project" ? (
        <div className="sched-grid__addrow-bar">
          <span className="s7-type-label">Add to project:</span>
          {groups
            .filter((g) => g.groupId !== "workers" && g.groupId !== "assets")
            .map((g) => (
              <button
                key={g.groupId}
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => openPickerForCell(isoDay(days[0]!), g.groupId, null)}
              >
                + {g.groupLabel}
              </button>
            ))}
        </div>
      ) : null}

      {picker ? (
        <PickerModal
          picker={picker}
          projects={projects}
          jobRoles={jobRoles}
          workers={pickerWorkers}
          suggestions={pickerSuggestions}
          suggestMode={pickerSuggestMode}
          showAll={pickerShowAll}
          error={pickerError}
          onChangeRole={(jobRoleId) => setPicker((p) => (p ? { ...p, jobRoleId } : p))}
          onChangeProject={(projectId) => setPicker((p) => (p ? { ...p, projectId } : p))}
          onChangeDate={(date) => setPicker((p) => (p ? { ...p, date } : p))}
          onToggleShowAll={(v) => setPickerShowAll(v)}
          onToggleSuggestMode={(v) => setPickerSuggestMode(v)}
          onClose={() => setPicker(null)}
          onPick={handlePickWorker}
        />
      ) : null}
    </div>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="sched-grid__cell sched-grid__cell--skel">
          <Skeleton height={18} />
        </div>
      ))}
    </>
  );
}

type GroupRowsProps = {
  group: GroupedRows;
  collapsed: boolean;
  onToggle: () => void;
  days: Date[];
  cellIndex: Map<string, GridCell>;
  byWorkerDate: Map<string, Set<string>>;
  orientation: GridOrientation;
  holidaysByDate: Map<string, PublicHoliday>;
  today: Date;
  headcounts: Map<string, number>;
  drag: DragState;
  onCellPointerDown: (groupId: string, rowKey: string, dayIndex: number) => void;
  onCellPointerEnter: (groupId: string, rowKey: string, dayIndex: number) => void;
  onCellClick: (rowKey: string, dayIso: string, cell: GridCell | undefined) => void;
};

function GroupRows({
  group,
  collapsed,
  onToggle,
  days,
  cellIndex,
  byWorkerDate,
  orientation,
  holidaysByDate,
  today,
  headcounts,
  drag,
  onCellPointerDown,
  onCellPointerEnter,
  onCellClick
}: GroupRowsProps) {
  return (
    <>
      <div className="sched-grid__grouphead">
        <button
          type="button"
          className="sched-grid__group-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          style={TOUCH}
        >
          <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
          <strong>{group.groupLabel}</strong>
          {group.groupSub ? <span className="sched-grid__group-sub">{group.groupSub}</span> : null}
          <span className="sched-grid__group-count">{group.rows.length}</span>
        </button>
      </div>
      {days.map((d) => {
        const iso = isoDay(d);
        const count = headcounts.get(`${group.groupId}|${iso}`) ?? 0;
        return (
          <div key={`gh-${group.groupId}-${iso}`} className="sched-grid__groupcount" aria-hidden>
            {count > 0 ? count : ""}
          </div>
        );
      })}
      {collapsed
        ? null
        : group.rows.map((row) => (
            <ResourceRowRender
              key={row.key}
              groupId={group.groupId}
              row={row}
              days={days}
              cellIndex={cellIndex}
              byWorkerDate={byWorkerDate}
              orientation={orientation}
              holidaysByDate={holidaysByDate}
              today={today}
              drag={drag}
              onCellPointerDown={onCellPointerDown}
              onCellPointerEnter={onCellPointerEnter}
              onCellClick={onCellClick}
            />
          ))}
    </>
  );
}

function ResourceRowRender({
  groupId,
  row,
  days,
  cellIndex,
  byWorkerDate,
  orientation,
  holidaysByDate,
  today,
  drag,
  onCellPointerDown,
  onCellPointerEnter,
  onCellClick
}: Omit<GroupRowsProps, "group" | "collapsed" | "onToggle" | "headcounts"> & {
  groupId: string;
  row: GroupedRows["rows"][number];
}) {
  // rowKey decoding for cell lookups.
  // project orientation: rowKey = "<workerId>|<roleKey>" or "A|<assetId>"
  // resource orientation: rowKey = "W|<workerId>" or "A|<assetId>"
  const isWorker = row.kind === "WORKER";

  const cellKeyFor = (dayIso: string): string => {
    if (orientation === "project") {
      if (isWorker) {
        // We don't know the role here from row.key alone — row.key already has it.
        const [workerId, roleKey] = row.key.split("|");
        return `P|${groupId}|W|${workerId}|${roleKey ?? "_"}|${dayIso}`;
      }
      return `P|${groupId}|A|${row.id}|${dayIso}`;
    }
    return isWorker ? `R|W|${row.id}|${dayIso}` : `R|A|${row.id}|${dayIso}`;
  };

  return (
    <>
      <div className="sched-grid__rowhead" title={row.label}>
        <span className="sched-grid__rowlabel">{row.label}</span>
        {row.sub ? <span className="sched-grid__rowsub">{row.sub}</span> : null}
      </div>
      {days.map((d, dayIndex) => {
        const iso = isoDay(d);
        const cell = cellIndex.get(cellKeyFor(iso));
        const holiday = holidaysByDate.get(iso);
        const weekend = isWeekend(d);
        const isToday = isSameUtcDay(d, today);
        const inDrag =
          drag &&
          drag.groupId === groupId &&
          drag.rowKey === row.key &&
          dayIndex >= Math.min(drag.startIndex, drag.endIndex) &&
          dayIndex <= Math.max(drag.startIndex, drag.endIndex);
        const classes = ["sched-grid__cell"];
        if (weekend) classes.push("sched-grid__cell--weekend");
        if (holiday) classes.push("sched-grid__cell--holiday");
        if (isToday) classes.push("sched-grid__cell--today");
        if (inDrag) classes.push("sched-grid__cell--drag");
        if (cell) {
          classes.push("sched-grid__cell--filled");
          if (cell.conflict === "red") classes.push("sched-grid__cell--conflict-red");
        } else if (isWorker && emptyCellAmber(byWorkerDate, row.id, groupId, iso)) {
          classes.push("sched-grid__cell--conflict-amber");
        }
        const tip = cell
          ? cell.conflict === "red"
            ? `Double-booked: ${cell.project.projectNumber} ${cell.project.name}`
            : `${cell.project.projectNumber} ${cell.project.name}`
          : holiday
            ? `${holiday.name} (QLD)`
            : weekend
              ? "Weekend"
              : "Click to allocate";
        return (
          <button
            key={`${row.key}-${iso}`}
            type="button"
            className={classes.join(" ")}
            title={tip}
            data-testid={`gridcell-${groupId}-${row.key}-${iso}`}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              onCellPointerDown(groupId, row.key, dayIndex);
            }}
            onPointerEnter={() => onCellPointerEnter(groupId, row.key, dayIndex)}
            onClick={() => onCellClick(row.key, iso, cell)}
          >
            {cell ? (
              <span className="sched-grid__cellmark" aria-hidden>
                {cell.conflict === "red" ? "!" : "●"}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

type PickerModalProps = {
  picker: NonNullable<PickerState>;
  projects: Project[];
  jobRoles: JobRole[];
  workers: EligibleWorker[] | null;
  suggestions: WorkerSuggestion[] | null;
  suggestMode: boolean;
  showAll: boolean;
  error: string | null;
  onChangeProject: (id: string) => void;
  onChangeRole: (id: string) => void;
  onChangeDate: (date: string) => void;
  onToggleShowAll: (v: boolean) => void;
  onToggleSuggestMode: (v: boolean) => void;
  onClose: () => void;
  onPick: (worker: EligibleWorker) => void | Promise<void>;
};

function PickerModal({
  picker,
  projects,
  jobRoles,
  workers,
  suggestions,
  suggestMode,
  showAll,
  error,
  onChangeProject,
  onChangeRole,
  onChangeDate,
  onToggleShowAll,
  onToggleSuggestMode,
  onClose,
  onPick
}: PickerModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Allocate worker" onClick={onClose}>
      <div className="slide-over" onClick={(e) => e.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <p className="s7-type-label">{picker.date}</p>
            <h2 className="s7-type-section-heading" style={{ margin: "2px 0 0" }}>
              Allocate worker
            </h2>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close" style={TOUCH}>
            ×
          </button>
        </header>
        <div className="slide-over__body">
          <div className="sched-grid__picker-row">
            <label>
              <span className="s7-type-label">Project</span>
              <select
                className="s7-select"
                value={picker.projectId}
                onChange={(e) => onChangeProject(e.target.value)}
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectNumber} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="s7-type-label">Date</span>
              <input
                type="date"
                className="s7-input"
                value={picker.date}
                onChange={(e) => onChangeDate(e.target.value)}
              />
            </label>
            <label>
              <span className="s7-type-label">Role</span>
              <select
                className="s7-select"
                value={picker.jobRoleId ?? ""}
                onChange={(e) => onChangeRole(e.target.value)}
              >
                <option value="">Select role…</option>
                {jobRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="sched-grid__toggle" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => onToggleShowAll(e.target.checked)}
              data-testid="picker-showall"
            />
            Show all available (drop competency filter)
          </label>
          <label className="sched-grid__toggle" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={suggestMode}
              onChange={(e) => onToggleSuggestMode(e.target.checked)}
              data-testid="picker-suggest"
            />
            Suggest (rank by fit, availability, proximity)
          </label>
          {error ? (
            <div className="tender-page__error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            {suggestMode ? (
              !picker.projectId ? (
                <p style={{ color: "var(--text-muted)" }}>Pick a project to see ranked suggestions.</p>
              ) : suggestions === null ? (
                <Skeleton height={24} />
              ) : suggestions.length === 0 ? (
                <EmptyState
                  heading="No suggestions"
                  subtext="Toggle Show all to include ineligible candidates."
                />
              ) : (
                <ul className="sched-grid__picker-list" data-testid="picker-suggest-list">
                  {suggestions.map((s) => (
                    <li key={s.worker.id}>
                      <button
                        type="button"
                        className={`sched-grid__picker-item${s.eligible ? "" : " sched-grid__picker-item--ineligible"}`}
                        onClick={() =>
                          void onPick({
                            worker: s.worker,
                            eligible: s.eligible,
                            reasons: s.reasons.filter((r) => r.startsWith("blocker:")).map((r) => r.slice("blocker:".length))
                          })
                        }
                        style={TOUCH}
                        title={s.reasons.join(" • ")}
                      >
                        <span className="sched-resource__avatar">
                          {(s.worker.firstName[0] ?? "") + (s.worker.lastName[0] ?? "")}
                        </span>
                        <span className="sched-resource__meta">
                          <span className="sched-resource__name">
                            {s.worker.firstName} {s.worker.lastName}
                            <span className="s7-badge" style={{ marginLeft: 6 }}>{s.score}</span>
                          </span>
                          <span className="sched-resource__role">
                            fit {s.breakdown.roleFit} · avail {s.breakdown.availability} · prox {s.breakdown.proximity}
                          </span>
                        </span>
                        {!s.eligible ? <span className="s7-badge s7-badge--warning">Override</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : !picker.jobRoleId || !picker.projectId ? (
              <p style={{ color: "var(--text-muted)" }}>Pick a project and role to see eligible workers.</p>
            ) : workers === null ? (
              <Skeleton height={24} />
            ) : workers.length === 0 ? (
              <EmptyState
                heading="No eligible workers"
                subtext="Toggle Show all to relax competency filters."
              />
            ) : (
              <ul className="sched-grid__picker-list" data-testid="picker-list">
                {workers.map((w) => (
                  <li key={w.worker.id}>
                    <button
                      type="button"
                      className={`sched-grid__picker-item${w.eligible ? "" : " sched-grid__picker-item--ineligible"}`}
                      onClick={() => void onPick(w)}
                      style={TOUCH}
                    >
                      <span className="sched-resource__avatar">
                        {(w.worker.firstName[0] ?? "") + (w.worker.lastName[0] ?? "")}
                      </span>
                      <span className="sched-resource__meta">
                        <span className="sched-resource__name">
                          {w.worker.firstName} {w.worker.lastName}
                        </span>
                        <span className="sched-resource__role">
                          {w.eligible ? (w.worker.role ?? "Available") : w.reasons.join(", ")}
                        </span>
                      </span>
                      {!w.eligible ? <span className="s7-badge s7-badge--warning">Override</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Silence unused imports when tree-shaken builds — keep parseIsoDay exported
// via the helper module; the page only consumes it indirectly via visibleRange.
void parseIsoDay;
