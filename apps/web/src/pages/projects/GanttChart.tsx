import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export type GanttTask = {
  id: string;
  title: string;
  discipline: string | null;
  startDate: string;
  endDate: string;
  progress: number;
  colour: string | null;
  dependencies: string[];
  assignedToId: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  sortOrder: number;
};

type GanttChartProps = {
  projectId: string;
  tasks: GanttTask[];
  zoom: "week" | "month" | "quarter";
  canManage: boolean;
  onChanged: () => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 28;
const LABEL_WIDTH = 200;
const FALLBACK_COLOUR = "#005B61";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

function pxPerDay(zoom: GanttChartProps["zoom"]): number {
  if (zoom === "week") return 36;
  if (zoom === "month") return 14;
  return 6; // quarter
}

export function GanttChart({ projectId, tasks, zoom, canManage, onChanged }: GanttChartProps) {
  const { authFetch } = useAuth();
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);

  const range = useMemo(() => {
    if (tasks.length === 0) {
      const today = startOfDay(new Date());
      return { start: today, end: new Date(today.getTime() + 30 * DAY_MS), days: 31 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const t of tasks) {
      min = Math.min(min, new Date(t.startDate).getTime());
      max = Math.max(max, new Date(t.endDate).getTime());
    }
    const start = startOfDay(new Date(min - 2 * DAY_MS));
    const end = startOfDay(new Date(max + 5 * DAY_MS));
    const days = Math.max(7, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
    return { start, end, days };
  }, [tasks]);

  const dpx = pxPerDay(zoom);
  const totalWidth = range.days * dpx;
  const todayOffset = Math.max(0, (Date.now() - range.start.getTime()) / DAY_MS) * dpx;

  // Date strip: ticks every 7 days (week zoom) / month start (month zoom) / month start (quarter zoom).
  const ticks = useMemo(() => {
    const out: Array<{ x: number; label: string }> = [];
    if (zoom === "week") {
      for (let i = 0; i <= range.days; i += 7) {
        const d = new Date(range.start.getTime() + i * DAY_MS);
        out.push({ x: i * dpx, label: fmtShort(d) });
      }
    } else {
      const cursor = new Date(range.start);
      cursor.setDate(1);
      while (cursor.getTime() <= range.end.getTime()) {
        const offset = (cursor.getTime() - range.start.getTime()) / DAY_MS;
        if (offset >= 0) {
          out.push({
            x: offset * dpx,
            label: cursor.toLocaleDateString("en-AU", { month: "short", year: "2-digit" })
          });
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    return out;
  }, [range, zoom, dpx]);

  const patchDates = async (id: string, startDate: Date, endDate: Date) => {
    if (!canManage) return;
    const r = await authFetch(`/projects/${projectId}/gantt/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })
    });
    if (r.ok) onChanged();
  };

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border, #e5e7eb)", borderRadius: 6 }}>
      <div style={{ width: LABEL_WIDTH + totalWidth, position: "relative" }}>
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "var(--surface-muted, #f6f6f6)",
            display: "flex",
            height: HEADER_HEIGHT,
            borderBottom: "1px solid var(--border, #e5e7eb)"
          }}
        >
          <div style={{ width: LABEL_WIDTH, padding: "4px 8px", fontSize: 11, fontWeight: 600 }}>
            Task
          </div>
          <div style={{ position: "relative", height: HEADER_HEIGHT, width: totalWidth }}>
            {ticks.map((t) => (
              <div
                key={t.x}
                style={{
                  position: "absolute",
                  left: t.x,
                  top: 0,
                  bottom: 0,
                  paddingLeft: 4,
                  fontSize: 10,
                  color: "var(--text-muted)",
                  borderLeft: "1px solid var(--border, #e5e7eb)",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Today line */}
        {todayOffset > 0 && todayOffset < totalWidth ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: LABEL_WIDTH + todayOffset,
              top: HEADER_HEIGHT,
              bottom: 0,
              width: 0,
              borderLeft: "2px dashed #dc2626",
              zIndex: 3
            }}
          />
        ) : null}

        {/* Body */}
        <div style={{ position: "relative" }}>
          {tasks.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-muted)" }}>
              No tasks yet. Use "Generate from scope" or "+ Add task" to start the schedule.
            </div>
          ) : null}
          {tasks.map((task, i) => {
            const start = new Date(task.startDate);
            const end = new Date(task.endDate);
            const offsetDays = (start.getTime() - range.start.getTime()) / DAY_MS;
            const durationDays = Math.max(1, (end.getTime() - start.getTime()) / DAY_MS);
            const colour = task.colour ?? FALLBACK_COLOUR;
            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid var(--border, #e5e7eb)",
                  background: i % 2 === 0 ? "var(--surface-card, #fff)" : "var(--surface-subtle, rgba(0,0,0,0.02))"
                }}
              >
                <div
                  style={{
                    width: LABEL_WIDTH,
                    padding: "0 8px",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis"
                  }}
                  title={task.title}
                >
                  {task.discipline ? (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        background: colour,
                        flexShrink: 0
                      }}
                    />
                  ) : null}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</span>
                </div>
                <div style={{ position: "relative", flex: 1, height: ROW_HEIGHT }}>
                  <button
                    type="button"
                    onClick={() => setEditingTask(task)}
                    style={{
                      position: "absolute",
                      left: offsetDays * dpx,
                      top: 4,
                      bottom: 4,
                      width: durationDays * dpx,
                      background: colour,
                      borderRadius: 4,
                      border: "none",
                      padding: 0,
                      cursor: canManage ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      overflow: "hidden"
                    }}
                    title={`${task.title} · ${fmtShort(start)} → ${fmtShort(end)} · ${task.progress}%${
                      task.assignedTo ? ` · ${task.assignedTo.firstName} ${task.assignedTo.lastName}` : ""
                    }`}
                    aria-label={`Edit ${task.title}`}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${task.progress}%`,
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: 4
                      }}
                    />
                    <span
                      style={{
                        position: "relative",
                        fontSize: 10,
                        color: "#fff",
                        padding: "0 6px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {durationDays * dpx > 60 ? `${task.progress}%` : ""}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingTask ? (
        <EditTaskModal
          projectId={projectId}
          task={editingTask}
          canManage={canManage}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            onChanged();
          }}
          onDelete={async () => {
            if (!window.confirm(`Delete "${editingTask.title}"?`)) return;
            const r = await authFetch(`/projects/${projectId}/gantt/${editingTask.id}`, {
              method: "DELETE"
            });
            if (r.ok) {
              setEditingTask(null);
              onChanged();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function EditTaskModal({
  projectId,
  task,
  canManage,
  onClose,
  onSaved,
  onDelete
}: {
  projectId: string;
  task: GanttTask;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    title: task.title,
    startDate: task.startDate.slice(0, 10),
    endDate: task.endDate.slice(0, 10),
    progress: task.progress,
    colour: task.colour ?? FALLBACK_COLOUR
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await authFetch(`/projects/${projectId}/gantt/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title.trim(),
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          progress: Number(form.progress),
          colour: form.colour
        })
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1100,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="s7-card"
        style={{ padding: 20, width: "min(480px, 90vw)" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>
          {task.title}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 12, gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Title</span>
            <input
              className="s7-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={!canManage}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Start</span>
            <input
              type="date"
              className="s7-input"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              disabled={!canManage}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>End</span>
            <input
              type="date"
              className="s7-input"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              disabled={!canManage}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Progress %</span>
            <input
              type="range"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
              disabled={!canManage}
            />
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{form.progress}%</span>
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Colour</span>
            <input
              type="color"
              value={form.colour}
              onChange={(e) => setForm({ ...form, colour: e.target.value })}
              disabled={!canManage}
            />
          </label>
        </div>
        {err ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{err}</p> : null}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Close</button>
          {canManage ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={onDelete}
                style={{ color: "var(--status-danger)" }}
              >
                Delete
              </button>
              <button type="submit" className="s7-btn s7-btn--primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
