import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WIDGET_BY_TYPE } from "./widgetRegistry";
import { PERIOD_LABELS, PERIOD_ORDER, type UserDashboard, type UserDashboardConfig, type WidgetConfigEntry, type WidgetPeriod } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  dashboard: UserDashboard;
  saving: boolean;
  onSave: (config: UserDashboardConfig, name?: string) => void;
};

export function CustomisePanel({ open, onClose, dashboard, saving, onSave }: Props) {
  const [draft, setDraft] = useState<UserDashboardConfig>(dashboard.config);
  const [name, setName] = useState(dashboard.name);

  useEffect(() => {
    setDraft(dashboard.config);
    setName(dashboard.name);
  }, [dashboard.id, dashboard.config, dashboard.name]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (!open) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.widgets.findIndex((w) => w.id === active.id);
    const newIndex = draft.widgets.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(draft.widgets, oldIndex, newIndex).map((w, index) => ({ ...w, order: index }));
    setDraft({ ...draft, widgets: reordered });
  };

  const toggleVisible = (widgetId: string) => {
    setDraft({
      ...draft,
      widgets: draft.widgets.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w))
    });
  };

  const setWidgetPeriod = (widgetId: string, period: WidgetPeriod | null) => {
    setDraft({
      ...draft,
      widgets: draft.widgets.map((w) =>
        w.id === widgetId ? { ...w, config: { ...w.config, period } } : w
      )
    });
  };

  const resetToDefaults = () => {
    if (!window.confirm("Reset widgets to the default layout for this dashboard?")) return;
    // Use the widget list from registry for this dashboard's slug as the default
    const slugDefaults = defaultsForSlug(dashboard.slug);
    setDraft({
      period: "30d",
      widgets: slugDefaults.map((type, index) => ({
        id: `${type}-default`,
        type,
        visible: true,
        order: index,
        config: { period: null, filters: {} }
      }))
    });
  };

  const save = () => {
    onSave(draft, name !== dashboard.name ? name : undefined);
    onClose();
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-label="Customise dashboard" aria-modal="true" onClick={onClose}>
      <div className="slide-over" onClick={(e) => e.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Customise dashboard</h2>
            <p className="slide-over__subtitle">Drag to reorder, toggle visibility, or override the period per widget.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="slide-over__body">
          <label className="estimate-editor__field" style={{ marginBottom: 16 }}>
            <span>Dashboard name</span>
            <input
              className="s7-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={dashboard.isSystem}
              readOnly={dashboard.isSystem}
            />
            {dashboard.isSystem ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>System dashboards can't be renamed.</span>
            ) : null}
          </label>

          <label className="estimate-editor__field" style={{ marginBottom: 16 }}>
            <span>Global period</span>
            <select
              className="s7-input"
              value={draft.period}
              onChange={(e) => setDraft({ ...draft, period: e.target.value as WidgetPeriod })}
            >
              {PERIOD_ORDER.map((p) => (
                <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
              ))}
            </select>
          </label>

          <h3 className="s7-type-section-heading" style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Widgets</h3>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={draft.widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <ul className="customise-panel__widgets">
                {draft.widgets.map((widget) => (
                  <CustomiseRow
                    key={widget.id}
                    widget={widget}
                    globalPeriod={draft.period as WidgetPeriod}
                    onToggleVisible={() => toggleVisible(widget.id)}
                    onSetPeriod={(period) => setWidgetPeriod(widget.id, period)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        <footer className="slide-over__footer">
          <button type="button" className="s7-btn s7-btn--ghost" onClick={resetToDefaults}>Reset to defaults</button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CustomiseRow({
  widget,
  globalPeriod,
  onToggleVisible,
  onSetPeriod
}: {
  widget: WidgetConfigEntry;
  globalPeriod: WidgetPeriod;
  onToggleVisible: () => void;
  onSetPeriod: (period: WidgetPeriod | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const meta = WIDGET_BY_TYPE[widget.type];
  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1
    }),
    [transform, transition, isDragging]
  );

  const effectivePeriod = widget.config.period ?? globalPeriod;
  const isOverridden = widget.config.period != null && widget.config.period !== globalPeriod;

  return (
    <li ref={setNodeRef} style={style} className="customise-panel__row">
      <div className="customise-panel__row-main">
        <button
          type="button"
          className="customise-panel__drag"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>
        <div className="customise-panel__row-info">
          <div className="customise-panel__row-title">{meta?.name ?? widget.type}</div>
          <div className="customise-panel__row-meta">{meta?.category ?? "unknown"}</div>
        </div>
        <PeriodPill
          period={effectivePeriod}
          overridden={isOverridden}
          globalPeriod={globalPeriod}
          onChange={onSetPeriod}
        />
        <button
          type="button"
          role="switch"
          aria-checked={widget.visible}
          aria-label={widget.visible ? "Visible (click to hide)" : "Hidden (click to show)"}
          className={widget.visible ? "toggle-pill on" : "toggle-pill"}
          onClick={onToggleVisible}
        />
      </div>
      {meta?.description ? (
        <p className="customise-panel__row-description">{meta.description}</p>
      ) : null}
    </li>
  );
}

function PeriodPill({
  period,
  overridden,
  globalPeriod,
  onChange
}: {
  period: WidgetPeriod;
  overridden: boolean;
  globalPeriod: WidgetPeriod;
  onChange: (period: WidgetPeriod | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (next: WidgetPeriod | null) => {
    onChange(next === globalPeriod ? null : next);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="period-pill-wrap">
      <button
        type="button"
        className={overridden ? "period-pill period-pill--overridden" : "period-pill"}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Period: {period}
        <span aria-hidden style={{ marginLeft: 4, fontSize: 9 }}>▾</span>
      </button>
      {open ? (
        <div role="menu" className="period-pill__menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => select(null)}
            className="period-pill__menu-item"
          >
            Use global ({globalPeriod})
          </button>
          {PERIOD_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              onClick={() => select(p)}
              className={
                p === period
                  ? "period-pill__menu-item period-pill__menu-item--active"
                  : "period-pill__menu-item"
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function defaultsForSlug(slug: string): string[] {
  if (slug === "operations") {
    return [
      "ops_active_jobs_kpi",
      "ops_tender_pipeline_kpi",
      "ops_open_issues_kpi",
      "ops_upcoming_maintenance_kpi",
      "ops_jobs_by_status_donut",
      "ops_tender_pipeline_donut",
      "ops_monthly_revenue_line",
      "ops_form_submissions_bar",
      "ops_maintenance_bar"
    ];
  }
  if (slug === "tendering") {
    return [
      "ten_active_pipeline_kpi",
      "ten_submitted_mtd_kpi",
      "ten_win_rate_kpi",
      "ten_avg_lead_time_kpi",
      "ten_due_this_week",
      "ten_follow_up_queue",
      "ten_win_rate_chart",
      "ten_pipeline_by_estimator",
      "ten_recent_wins"
    ];
  }
  return [];
}
