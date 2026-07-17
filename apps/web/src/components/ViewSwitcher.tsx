/**
 * ViewSwitcher — reusable view-type toggle with localStorage persistence.
 *
 * A list page declares which views it supports via the `views` prop. The user
 * toggles between them with a segmented-button strip. The active choice is
 * remembered per list in localStorage, keyed by `listId`.
 *
 * Supported view types (extendable via the registry):
 *   grid, kanban, calendar, map, gantt
 *
 * Usage:
 *   const [view, setView] = useViewSwitcher("jobs-list", ["grid", "kanban", "calendar"]);
 *   <ViewSwitcher listId="jobs-list" views={["grid","kanban","calendar"]} value={view} onChange={setView} />
 */

import { useState } from "react";

// ---------------------------------------------------------------------------
// Registry — canonical view type definitions
// ---------------------------------------------------------------------------

export type ViewType = "grid" | "kanban" | "calendar" | "map" | "gantt" | "table";

export type ViewDefinition = {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
};

const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const KanbanIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="5" height="18" rx="1" />
    <rect x="10" y="3" width="5" height="12" rx="1" />
    <rect x="17" y="3" width="5" height="15" rx="1" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const MapIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const GanttIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
    <rect x="3" y="4" width="9" height="4" rx="1" />
    <rect x="8" y="10" width="13" height="4" rx="1" />
    <rect x="5" y="16" width="11" height="4" rx="1" />
  </svg>
);

const TableIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="9" x2="9" y2="21" />
  </svg>
);

export const VIEW_REGISTRY: Record<ViewType, ViewDefinition> = {
  grid: { id: "grid", label: "Grid", icon: <GridIcon /> },
  kanban: { id: "kanban", label: "Kanban", icon: <KanbanIcon /> },
  calendar: { id: "calendar", label: "Calendar", icon: <CalendarIcon /> },
  map: { id: "map", label: "Map", icon: <MapIcon /> },
  gantt: { id: "gantt", label: "Gantt", icon: <GanttIcon /> },
  table: { id: "table", label: "Table", icon: <TableIcon /> }
};

// ---------------------------------------------------------------------------
// localStorage hook
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "view-switcher:";

export function useViewSwitcher<V extends ViewType>(
  listId: string,
  views: readonly V[],
  defaultView?: V
): [V, (next: V) => void] {
  const storageKey = `${STORAGE_PREFIX}${listId}`;
  const fallback = defaultView ?? views[0];

  const readStorage = (): V => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && (views as readonly string[]).includes(stored)) {
        return stored as V;
      }
    } catch {
      // localStorage may be unavailable in some environments
    }
    return fallback;
  };

  const [active, setActive] = useState<V>(readStorage);

  const handleChange = (next: V) => {
    setActive(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // non-fatal
    }
  };

  return [active, handleChange];
}

// ---------------------------------------------------------------------------
// ViewSwitcher component
// ---------------------------------------------------------------------------

type ViewSwitcherProps<V extends ViewType> = {
  listId: string;
  views: readonly V[];
  value: V;
  onChange: (next: V) => void;
  /** Optional label for the aria-label on the wrapping role="tablist" */
  ariaLabel?: string;
};

export function ViewSwitcher<V extends ViewType>({
  views,
  value,
  onChange,
  ariaLabel = "View"
}: ViewSwitcherProps<V>) {
  return (
    <div className="view-switcher" role="tablist" aria-label={ariaLabel}>
      {views.map((viewType) => {
        const def = VIEW_REGISTRY[viewType];
        const isActive = viewType === value;
        return (
          <button
            key={viewType}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={def.label}
            title={def.label}
            className={isActive ? "view-switcher__btn view-switcher__btn--active" : "view-switcher__btn"}
            onClick={() => onChange(viewType)}
          >
            {def.icon}
            <span className="view-switcher__label">{def.label}</span>
          </button>
        );
      })}
    </div>
  );
}
