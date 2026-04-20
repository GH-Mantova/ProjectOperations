import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { WIDGET_BY_TYPE } from "./widgetRegistry";
import type {
  UserDashboard,
  UserDashboardConfig,
  WidgetConfigEntry,
  WidgetPeriod,
  WidgetSubConfig
} from "./types";
import { CustomisePanel } from "./CustomisePanel";
import { DashboardSwitcher } from "./DashboardSwitcher";

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
  const [dashboards, setDashboards] = useState<UserDashboard[] | null>(null);
  const [active, setActive] = useState<UserDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
      } else {
        setActive(null);
      }
    },
    [authFetch, defaultConfig, defaultName, title]
  );

  const loadById = useCallback(
    async (id: string) => {
      const response = await authFetch(`/user-dashboards/${id}`);
      if (!response.ok) throw new Error("Dashboard not found.");
      const record = (await response.json()) as UserDashboard;
      setActive(record);
      setDashboards([record]);
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

  const saveConfig = async (next: UserDashboardConfig, nextName?: string) => {
    if (!active) return;
    setSaving(true);
    try {
      const response = await authFetch(`/user-dashboards/${active.id}`, {
        method: "PATCH",
        body: JSON.stringify({ config: next, ...(nextName ? { name: nextName } : {}) })
      });
      if (!response.ok) throw new Error("Could not save dashboard.");
      const updated = (await response.json()) as UserDashboard;
      setActive(updated);
      setDashboards((prev) => (prev ? prev.map((d) => (d.id === updated.id ? updated : d)) : [updated]));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateWidgetConfig = (widgetId: string, nextSub: WidgetSubConfig) => {
    if (!active) return;
    const next: UserDashboardConfig = {
      ...active.config,
      widgets: active.config.widgets.map((w) => (w.id === widgetId ? { ...w, config: nextSub } : w))
    };
    void saveConfig(next);
  };

  const visibleWidgets = useMemo(() => {
    if (!active) return [] as WidgetConfigEntry[];
    return [...active.config.widgets].filter((w) => w.visible).sort((a, b) => a.order - b.order);
  }, [active]);

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
              onSelect={(d) => setActive(d)}
              onListRefresh={() => void loadBySlug(dashboardSlug)}
            />
          ) : null}
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
        <div className="td-canvas__widgets">
          {visibleWidgets.map((entry) => {
            const meta = WIDGET_BY_TYPE[entry.type];
            if (!meta) {
              return (
                <div key={entry.id} className="s7-card">
                  <p style={{ color: "var(--text-muted)" }}>Unknown widget: {entry.type}</p>
                </div>
              );
            }
            const WidgetComponent = meta.component;
            return (
              <div key={entry.id} className={`td-canvas__slot td-canvas__slot--${categoryClassName(meta.category)}`}>
                <WidgetComponent
                  config={entry.config}
                  globalPeriod={active.config.period as WidgetPeriod}
                  onConfigChange={(nextSub) => updateWidgetConfig(entry.id, nextSub)}
                />
              </div>
            );
          })}
        </div>
      )}

      {active ? (
        <CustomisePanel
          open={customiseOpen}
          onClose={() => setCustomiseOpen(false)}
          dashboard={active}
          saving={saving}
          onSave={(nextConfig, nextName) => saveConfig(nextConfig, nextName)}
        />
      ) : null}
    </div>
  );
}

function categoryClassName(category: string): string {
  return category;
}
