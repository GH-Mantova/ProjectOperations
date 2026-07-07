import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { WIDGET_BY_TYPE } from "./widgetRegistry";
import {
  GRID_ROW_HEIGHT_PX,
  PERIOD_LABELS,
  PERIOD_ORDER,
  canDeleteDashboard,
  canRenameDashboard,
  resolveSpan,
  type UserDashboard,
  type UserDashboardConfig,
  type WidgetConfigEntry,
  type WidgetFilters,
  type WidgetMeta,
  type WidgetPeriod,
  type WidgetSubConfig
} from "./types";
import { CustomisePanel } from "./CustomisePanel";
import { WidgetGalleryModal } from "./WidgetGalleryModal";
import { insertWidgetAt } from "./widgetGallery";
import { DashboardSwitcher } from "./DashboardSwitcher";
import { DeleteDashboardModal } from "./DeleteDashboardModal";
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
  const { authFetch, user } = useAuth();
  const isAdmin = Boolean(user?.isSuperUser || user?.permissions.includes("platform.admin"));
  const { invalidate, remove } = useUserDashboardsActions();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<UserDashboard[] | null>(null);
  const [active, setActive] = useState<UserDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Placement mode — explicit state, never derived from sibling state.
  const [placementActive, setPlacementActive] = useState(false);
  const [pendingWidget, setPendingWidget] = useState<WidgetConfigEntry | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const confirmDeleteActive = async () => {
    if (!active || !canDeleteDashboard(active)) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await remove(active.id);
      setIsDeleteConfirmOpen(false);
      if (mode === "by-id") {
        // The deleted dashboard's route no longer exists — land on the
        // default (Operations) dashboard.
        navigate("/");
      } else if (dashboardSlug) {
        await loadBySlug(dashboardSlug);
      }
    } catch (err) {
      setDeleteError((err as Error).message || "Could not delete dashboard.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const updateWidgetConfig = (widgetId: string, nextSub: WidgetSubConfig) => {
    if (!active) return;
    const next: UserDashboardConfig = {
      ...active.config,
      widgets: active.config.widgets.map((w) => (w.id === widgetId ? { ...w, config: nextSub } : w))
    };
    updateConfig(next);
  };

  // Apply filters + fields in a single merged write. Two separate updates would
  // race the React 18 batch on a stale closure of `active.config` and lose the
  // first write — see PR #391 widget-settings stale-closure bug.
  const applyWidgetSettings = (
    widgetId: string,
    payload: { filters?: WidgetFilters; fields?: string[] }
  ) => {
    if (!active) return;
    const next: UserDashboardConfig = {
      ...active.config,
      widgets: active.config.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const mergedConfig: WidgetSubConfig = {
          ...w.config,
          ...(payload.filters !== undefined ? { filters: payload.filters } : {}),
          ...(payload.fields !== undefined ? { fields: payload.fields } : {})
        };
        return { ...w, config: mergedConfig };
      })
    };
    updateConfig(next);
  };

  // Gallery hand-off: close the modal and enter placement mode. When the
  // dashboard has no visible widgets there is nowhere to choose, so append
  // immediately — the configured widget is never discarded.
  const beginPlacement = (entry: WidgetConfigEntry) => {
    setGalleryOpen(false);
    if (!active || active.config.widgets.filter((w) => w.visible).length === 0) {
      placeEntry(entry, null);
      return;
    }
    setPendingWidget(entry);
    setPlacementActive(true);
  };

  /** Insert at `index` within the order-sorted list; null appends to the end. */
  const placeEntry = (entry: WidgetConfigEntry, index: number | null) => {
    if (!active) return;
    const next: UserDashboardConfig = {
      ...active.config,
      widgets: insertWidgetAt(active.config.widgets, entry, index)
    };
    setPendingWidget(null);
    setPlacementActive(false);
    updateConfig(next);
  };

  // Escape or a click outside a drop slot appends the pending widget to the
  // end — placement can be dismissed but the configured widget is kept.
  useEffect(() => {
    if (!placementActive || !pendingWidget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") placeEntry(pendingWidget, null);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".td-canvas__dropslot")) return;
      placeEntry(pendingWidget, null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [placementActive, pendingWidget, active]);

  const updateWidgetSpan = (widgetId: string, colSpan: number, rowSpan: number) => {
    if (!active) return;
    const next: UserDashboardConfig = {
      ...active.config,
      widgets: active.config.widgets.map((w) => (w.id === widgetId ? { ...w, colSpan, rowSpan } : w))
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
            {active && canRenameDashboard(active, { isAdmin }) ? (
              <InlineDashboardName
                name={active.name}
                onSave={(next) => {
                  if (next.trim() && next !== active.name) {
                    updateConfig(active.config, next.trim());
                  }
                }}
              />
            ) : active ? (
              <h1
                className="s7-type-page-title"
                style={{ margin: "4px 0 0" }}
                title="Only admins can rename system dashboards"
              >
                {active.name}
              </h1>
            ) : (
              <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>
                {title ?? "Dashboard"}
              </h1>
            )}
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
            <>
              <button
                type="button"
                className="s7-btn s7-btn--secondary s7-btn--sm"
                onClick={() => setGalleryOpen(true)}
                data-testid="add-widget-button"
              >
                + Add widget
              </button>
              <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => setCustomiseOpen(true)}>
                Customise
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--danger s7-btn--sm"
                onClick={() => {
                  setDeleteError(null);
                  setIsDeleteConfirmOpen(true);
                }}
                disabled={!canDeleteDashboard(active)}
                title={canDeleteDashboard(active) ? undefined : "System dashboards cannot be deleted"}
                data-testid="delete-dashboard-button"
              >
                Delete
              </button>
            </>
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
          {placementActive && pendingWidget ? (
            <div className="td-canvas__placement-banner" role="status">
              Placing <b>{WIDGET_BY_TYPE[pendingWidget.type]?.name ?? pendingWidget.type}</b> — click a highlighted
              slot, or press Escape to add it at the end.
            </div>
          ) : null}
          <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className={placementActive ? "td-canvas__widgets td-canvas__widgets--placement" : "td-canvas__widgets"}>
              {visibleWidgets.map((entry, visibleIndex) => {
                const meta = WIDGET_BY_TYPE[entry.type];
                const dropSlot =
                  placementActive && pendingWidget ? (
                    <DropSlot
                      key={`slot-${entry.id}`}
                      pending={pendingWidget}
                      onPlace={() => placeEntry(pendingWidget, orderedWidgets.indexOf(entry))}
                      testId={`dropslot-${visibleIndex}`}
                    />
                  ) : null;
                if (!meta) {
                  return (
                    <Fragment key={entry.id}>
                      {dropSlot}
                      <div className="td-canvas__slot td-canvas__slot--half">
                        <div className="s7-card">
                          <p style={{ color: "var(--text-muted)" }}>Unknown widget: {entry.type}</p>
                        </div>
                      </div>
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={entry.id}>
                    {dropSlot}
                    <SortableWidget
                      entry={entry}
                      meta={meta}
                      globalPeriod={active.config.period as WidgetPeriod}
                      settingsOpen={openSettingsId === entry.id}
                      onOpenSettings={() =>
                        setOpenSettingsId((prev) => (prev === entry.id ? null : entry.id))
                      }
                      onCloseSettings={() => setOpenSettingsId(null)}
                      onConfigChange={(nextSub) => updateWidgetConfig(entry.id, nextSub)}
                      onApplySettings={(payload) => applyWidgetSettings(entry.id, payload)}
                      onResize={(colSpan, rowSpan) => updateWidgetSpan(entry.id, colSpan, rowSpan)}
                    />
                  </Fragment>
                );
              })}
              {placementActive && pendingWidget ? (
                <DropSlot
                  pending={pendingWidget}
                  onPlace={() => placeEntry(pendingWidget, null)}
                  testId="dropslot-end"
                  end
                />
              ) : null}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {active ? (
        <CustomisePanel
          open={customiseOpen}
          onClose={() => setCustomiseOpen(false)}
          dashboard={active}
          canRename={canRenameDashboard(active, { isAdmin })}
          saving={saving}
          onSave={saveFromPanel}
        />
      ) : null}

      {active && galleryOpen ? (
        <WidgetGalleryModal
          globalPeriod={active.config.period as WidgetPeriod}
          onClose={() => setGalleryOpen(false)}
          onAdd={beginPlacement}
        />
      ) : null}

      {active && isDeleteConfirmOpen ? (
        <DeleteDashboardModal
          dashboard={active}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => void confirmDeleteActive()}
        />
      ) : null}
    </div>
  );
}

// Placement-mode drop zone — dashed accent slot per the approved Concept B
// mockup. Click to land the configured widget at this position.
function DropSlot({
  pending,
  onPlace,
  testId,
  end = false
}: {
  pending: WidgetConfigEntry;
  onPlace: () => void;
  testId: string;
  end?: boolean;
}) {
  const meta = WIDGET_BY_TYPE[pending.type];
  // In-between slots stay 1 column wide so the existing grid keeps its
  // shape; only the end slot previews the widget's real width.
  const { colSpan } = resolveSpan(meta, pending);
  return (
    <button
      type="button"
      className="td-canvas__dropslot"
      style={{ gridColumn: `span ${end ? colSpan : 1}` }}
      onClick={onPlace}
      data-testid={testId}
    >
      <span className="td-canvas__dropslot-glyph" aria-hidden>
        ⬇
      </span>
      {end ? "Place at end" : "Place here"}
      {end ? (
        <span className="td-canvas__dropslot-sub">
          “{meta?.name ?? pending.type}” will appear in this slot
        </span>
      ) : null}
    </button>
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
  onApplySettings,
  onResize
}: {
  entry: WidgetConfigEntry;
  meta: WidgetMeta;
  globalPeriod: WidgetPeriod;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onConfigChange: (next: WidgetSubConfig) => void;
  onApplySettings: (payload: { filters?: WidgetFilters; fields?: string[] }) => void;
  onResize: (colSpan: number, rowSpan: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: entry.id
  });
  const { colSpan, rowSpan } = resolveSpan(meta, entry);
  const minCol = meta.minColSpan ?? 1;
  const maxCol = meta.maxColSpan ?? 4;
  const minRow = meta.minRowSpan ?? 1;
  const maxRow = meta.maxRowSpan ?? 4;

  const [ghost, setGhost] = useState<{ colSpan: number; rowSpan: number } | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
    minHeight: rowSpan * GRID_ROW_HEIGHT_PX
  };
  const classes = ["td-canvas__slot"];
  if (isDragging) classes.push("td-canvas__slot--dragging");
  if (isOver && !isDragging) classes.push("td-canvas__slot--over");

  const WidgetComponent = meta.component;
  const hasSchema = (meta.configSchema && meta.configSchema.length > 0) || (meta.fieldSchema && meta.fieldSchema.length > 0);

  const startResize = (axis: "col" | "row" | "both") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = slotRef.current?.closest<HTMLElement>(".td-canvas__widgets");
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const startRect = slotRef.current!.getBoundingClientRect();
    const colWidth = canvasRect.width / 4;
    const rowHeight = GRID_ROW_HEIGHT_PX;
    const startX = e.clientX;
    const startY = e.clientY;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let nextCol = colSpan;
      let nextRow = rowSpan;
      if (axis === "col" || axis === "both") {
        const pxWidth = startRect.width + dx;
        nextCol = Math.round(pxWidth / colWidth);
        nextCol = Math.max(minCol, Math.min(maxCol, nextCol));
      }
      if (axis === "row" || axis === "both") {
        const pxHeight = startRect.height + dy;
        nextRow = Math.round(pxHeight / rowHeight);
        nextRow = Math.max(minRow, Math.min(maxRow, nextRow));
      }
      setGhost({ colSpan: nextCol, rowSpan: nextRow });
    };

    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      setGhost((current) => {
        if (current && (current.colSpan !== colSpan || current.rowSpan !== rowSpan)) {
          onResize(current.colSpan, current.rowSpan);
        }
        return null;
      });
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        slotRef.current = node;
      }}
      style={style}
      className={classes.join(" ")}
      data-testid={`widget-${entry.type.replace(/_/g, "-")}`}
    >
      <div className="td-canvas__slot-chrome">
        <PeriodOverridePill
          override={entry.config.period as WidgetPeriod | null | undefined}
          globalPeriod={globalPeriod}
          onChange={(next) =>
            onConfigChange({ ...(entry.config ?? { period: null, filters: {} }), period: next ?? null })
          }
        />
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
          meta={meta}
          entry={entry}
          anchor={slotRef.current}
          onApply={onApplySettings}
          onClose={onCloseSettings}
        />
      ) : null}

      <WidgetComponent
        config={entry.config}
        globalPeriod={globalPeriod}
        onConfigChange={onConfigChange}
        colSpan={colSpan}
        rowSpan={rowSpan}
      />

      {ghost ? (
        <div
          className="td-canvas__resize-ghost"
          aria-hidden
          style={{
            width: `calc(${(ghost.colSpan / colSpan) * 100}% + ${(ghost.colSpan - colSpan) * 16}px)`,
            height: `${ghost.rowSpan * GRID_ROW_HEIGHT_PX + (ghost.rowSpan - rowSpan) * 16}px`
          }}
        >
          <span>
            {ghost.colSpan} × {ghost.rowSpan}
          </span>
        </div>
      ) : null}

      <button
        type="button"
        className="td-canvas__resize td-canvas__resize--col"
        aria-label="Resize horizontally"
        onPointerDown={startResize("col")}
      />
      <button
        type="button"
        className="td-canvas__resize td-canvas__resize--row"
        aria-label="Resize vertically"
        onPointerDown={startResize("row")}
      />
      <button
        type="button"
        className="td-canvas__resize td-canvas__resize--corner"
        aria-label="Resize"
        onPointerDown={startResize("both")}
      />
    </div>
  );
}

// Period override pill — shows the widget's effective period. Orange when the
// widget overrides the global dashboard period, muted grey when inheriting.
// Click to pick a period, "Use dashboard" reverts to inherit (period: null).
function PeriodOverridePill({
  override,
  globalPeriod,
  onChange
}: {
  override: WidgetPeriod | null | undefined;
  globalPeriod: WidgetPeriod;
  onChange: (next: WidgetPeriod | null) => void;
}) {
  const effective = (override ?? globalPeriod) as WidgetPeriod;
  const isOverride = Boolean(override) && override !== globalPeriod;
  return (
    <select
      aria-label="Widget period"
      value={override ?? "__inherit__"}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "__inherit__" ? null : (v as WidgetPeriod));
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        height: 22,
        padding: "0 8px",
        fontSize: 11,
        fontWeight: 600,
        border: "1px solid",
        borderRadius: 999,
        cursor: "pointer",
        maxWidth: 130,
        textOverflow: "ellipsis",
        background: isOverride ? "#FEAA6D" : "var(--surface-card, white)",
        color: isOverride ? "#242424" : "var(--text-muted, #6B7280)",
        borderColor: isOverride ? "#FEAA6D" : "var(--border-subtle, rgba(0,0,0,0.12))"
      }}
    >
      <option value="__inherit__">{PERIOD_LABELS[effective]} · dashboard</option>
      {PERIOD_ORDER.map((p) => (
        <option key={p} value={p}>
          {PERIOD_LABELS[p]}
        </option>
      ))}
    </select>
  );
}

// Click-to-edit dashboard name. Enter saves, Escape cancels, blur saves.
function InlineDashboardName({
  name,
  onSave
}: {
  name: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => {
    setDraft(name);
  }, [name]);

  if (!editing) {
    return (
      <h1
        className="s7-type-page-title"
        style={{ margin: "4px 0 0", cursor: "text" }}
        title="Click to rename"
        onClick={() => setEditing(true)}
      >
        {name}
      </h1>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSave(draft);
          setEditing(false);
        } else if (e.key === "Escape") {
          setDraft(name);
          setEditing(false);
        }
      }}
      onBlur={() => {
        onSave(draft);
        setEditing(false);
      }}
      className="s7-input"
      style={{
        fontSize: "1.5rem",
        fontWeight: 600,
        padding: "2px 6px",
        margin: "4px 0 0",
        minWidth: 240
      }}
    />
  );
}
