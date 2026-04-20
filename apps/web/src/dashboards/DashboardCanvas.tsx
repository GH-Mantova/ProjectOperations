import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { WIDGET_BY_TYPE } from "./widgetRegistry";
import type {
  UserDashboard,
  UserDashboardConfig,
  WidgetConfigEntry,
  WidgetFilters,
  WidgetMeta,
  WidgetPeriod,
  WidgetSubConfig
} from "./types";
import { CustomisePanel } from "./CustomisePanel";
import { DashboardSwitcher } from "./DashboardSwitcher";
import { WidgetSettingsPopover } from "./WidgetSettingsPopover";
import { useUserDashboardsActions } from "./userDashboards";

type Mode = "by-slug" | "by-id";

type Props = {
  mode?: Mode;
  dashboardSlug?: string;
  dashboardId?: string;
  defaultConfig?: UserDashboardConfig;
  defaultName?: string;
  title?: string;
  actions?: ReactNode;
};

const AUTO_SAVE_DEBOUNCE_MS = 500;

export function DashboardCanvas({
  mode = "by-slug",
  dashboardSlug,
  dashboardId,
  defaultConfig,
  defaultName,
  title,
  actions
}: Props) {
  const { authFetch } = useAuth();
  const { invalidate } = useUserDashboardsActions();
  const [dashboards, setDashboards] = useState<UserDashboard[] | null>(null);
  const [active, setActive] = useState<UserDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const loadBySlug = useCallback(
    async (slug: string) => {
      const response = await authFetch(`/user-dashboards?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error("Unable to load dashboards.");
      const list = (await response.json()) as UserDashboard[];
      setDashboards(list);
      const chosen =
        list.find((d) => d.isDefault) ?? list.find((d) => d.isSystem) ?? list[0] ?? null;
      if (chosen) {
        setActive(chosen);
        activeIdRef.current = chosen.id;
      } else if (defaultConfig) {
        const createResponse = await authFetch(`/user-dashboards`, {
          method: "POST",
          body: JSON.stringify({
            name: defaultName ?? title ?? "Dashboard",
            slug,
            config: defaultConfig
          })
        });
        if (!createResponse.ok) throw new Error("Could not create default dashboard.");
        const created = (await createResponse.json()) as UserDashboard;
        setDashboards([created]);
        setActive(created);
        activeIdRef.current = created.id;
        invalidate();
      } else {
        setActive(null);
      }
    },
    [authFetch, defaultConfig, defaultName, title, invalidate]
  );

  const loadById = useCallback(
    async (id: string) => {
      const response = await authFetch(`/user-dashboards/${id}`);
      if (!response.ok) throw new Error("Dashboard not found.");
      const record = (await response.json()) as UserDashboard;
      setActive(record);
      setDashboards([record]);
      activeIdRef.current = record.id;
    },
    [authFetch]
  );

  useEffect(() => {
    setError(null);
    (async () => {
      try {
        if (mode === "by-id" && dashboardId) await loadById(dashboardId);
        else if (mode === "by-slug" && dashboardSlug) await loadBySlug(dashboardSlug);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [mode, dashboardSlug, dashboardId, loadById, loadBySlug]);

  const persistConfig = useCallback(
    async (nextConfig: UserDashboardConfig, nextName?: string) => {
      const id = activeIdRef.current;
      if (!id) return;
      setSaving(true);
      try {
        const response = await authFetch(`/user-dashboards/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ config: nextConfig, ...(nextName ? { name: nextName } : {}) })
        });
        if (!response.ok) throw new Error("Could not save dashboard.");
        const updated = (await response.json()) as UserDashboard;
        activeIdRef.current = updated.id;
        setDashboards((prev) => (prev ? prev.map((d) => (d.id === updated.id ? updated : d)) : [updated]));
        invalidate();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [authFetch, invalidate]
  );

  const scheduleAutoSave = useCallback(
    (nextConfig: UserDashboardConfig) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void persistConfig(nextConfig);
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    [persistConfig]
  );

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  const updateConfig = (nextConfig: UserDashboardConfig, nextName?: string) => {
    setActive((prev) => (prev ? { ...prev, config: nextConfig, ...(nextName ? { name: nextName } : {}) } : prev));
    if (nextName !== undefined) {
      // Name changes save immediately (no debounce)
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      void persistConfig(nextConfig, nextName);
    } else {
      scheduleAutoSave(nextConfig);
    }
  };

  const saveFromPanel = (next: UserDashboardConfig, nextName?: string) => {
    updateConfig(next, nextName);
  };

  const updateWidgetConfig = (widgetId: string, nextSub: WidgetSubConfig) => {
    if (!active) return;
    const next: UserDashboardConfig = {
      ...active.config,
      widgets: active.config.widgets.map((w) => (w.id === widgetId ? { ...w, config: nextSub } : w))
    };
    updateConfig(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!active) return;
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const widgets = [...active.config.widgets].sort((a, b) => a.order - b.order);
    const oldIndex = widgets.findIndex((w) => w.id === dragged.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(widgets, oldIndex, newIndex).map((w, index) => ({ ...w, order: index }));
    updateConfig({ ...active.config, widgets: reordered });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const orderedWidgets = useMemo(() => {
    if (!active) return [] as WidgetConfigEntry[];
    return [...active.config.widgets].sort((a, b) => a.order - b.order);
  }, [active]);

  const visibleWidgets = useMemo(() => orderedWidgets.filter((w) => w.visible), [orderedWidgets]);

  return (
    <div className="td-v2">
      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      <header className="td-v2__header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="s7-type-label">Dashboard</p>
            <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>
              {active?.name ?? title ?? "Dashboard"}
            </h1>
          </div>
          {dashboardSlug && dashboards ? (
            <DashboardSwitcher
              slug={dashboardSlug}
              dashboards={dashboards}
              activeId={active?.id ?? null}
              onSelect={(d) => {
                setActive(d);
                activeIdRef.current = d.id;
              }}
              onListRefresh={() => void loadBySlug(dashboardSlug)}
            />
          ) : null}
          {saving ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</span> : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {actions}
          {active ? (
            <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => setCustomiseOpen(true)}>
              Customise
            </button>
          ) : null}
        </div>
      </header>

      {!active ? (
        <Skeleton width="100%" height={200} />
      ) : visibleWidgets.length === 0 ? (
        <EmptyState
          heading="No widgets enabled"
          subtext="Open Customise to turn widgets on."
          action={
            <button type="button" className="s7-btn s7-btn--primary" onClick={() => setCustomiseOpen(true)}>
              Customise
            </button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="td-canvas__widgets">
              {visibleWidgets.map((entry) => {
                const meta = WIDGET_BY_TYPE[entry.type];
                if (!meta) {
                  return (
                    <div key={entry.id} className="td-canvas__slot td-canvas__slot--half">
                      <div className="s7-card">
                        <p style={{ color: "var(--text-muted)" }}>Unknown widget: {entry.type}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <SortableWidget
                    key={entry.id}
                    entry={entry}
                    meta={meta}
                    globalPeriod={active.config.period as WidgetPeriod}
                    settingsOpen={openSettingsId === entry.id}
                    onOpenSettings={() =>
                      setOpenSettingsId((prev) => (prev === entry.id ? null : entry.id))
                    }
                    onCloseSettings={() => setOpenSettingsId(null)}
                    onConfigChange={(nextSub) => updateWidgetConfig(entry.id, nextSub)}
                    onFiltersChange={(nextFilters) =>
                      updateWidgetConfig(entry.id, { ...entry.config, filters: nextFilters })
                    }
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {active ? (
        <CustomisePanel
          open={customiseOpen}
          onClose={() => setCustomiseOpen(false)}
          dashboard={active}
          saving={saving}
          onSave={saveFromPanel}
        />
      ) : null}
    </div>
  );
}

function SortableWidget({
  entry,
  meta,
  globalPeriod,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  onConfigChange,
  onFiltersChange
}: {
  entry: WidgetConfigEntry;
  meta: WidgetMeta;
  globalPeriod: WidgetPeriod;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onConfigChange: (next: WidgetSubConfig) => void;
  onFiltersChange: (next: WidgetFilters) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: entry.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const classes = ["td-canvas__slot", `td-canvas__slot--${meta.size}`];
  if (isDragging) classes.push("td-canvas__slot--dragging");
  if (isOver && !isDragging) classes.push("td-canvas__slot--over");

  const WidgetComponent = meta.component;
  const hasSchema = meta.configSchema && meta.configSchema.length > 0;

  return (
    <div ref={setNodeRef} style={style} className={classes.join(" ")}>
      <div className="td-canvas__slot-chrome">
        {hasSchema ? (
          <button
            type="button"
            className="td-canvas__slot-icon"
            aria-label="Widget settings"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          className="td-canvas__slot-icon td-canvas__slot-icon--drag"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="5" cy="3" r="1.4" />
            <circle cx="5" cy="8" r="1.4" />
            <circle cx="5" cy="13" r="1.4" />
            <circle cx="11" cy="3" r="1.4" />
            <circle cx="11" cy="8" r="1.4" />
            <circle cx="11" cy="13" r="1.4" />
          </svg>
        </button>
      </div>

      {settingsOpen && hasSchema ? (
        <WidgetSettingsPopover
          schema={meta.configSchema!}
          initial={entry.config.filters ?? {}}
          onApply={(nextFilters) => onFiltersChange(nextFilters)}
          onClose={onCloseSettings}
        />
      ) : null}

      <WidgetComponent
        config={entry.config}
        globalPeriod={globalPeriod}
        onConfigChange={onConfigChange}
      />
    </div>
  );
}
