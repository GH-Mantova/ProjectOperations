import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTenders, type TenderForDashboard } from "./hooks";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../hooks/useConfirm";
import { resolveVisibleFields } from "./types";
import type { ConfigField, WidgetConfigEntry, WidgetFilters, WidgetMeta } from "./types";

type ApplyPayload = {
  filters?: WidgetFilters;
  fields?: string[];
};

type Props = {
  meta: WidgetMeta;
  entry: WidgetConfigEntry;
  /** Element the popover anchors to (the widget slot). The popover renders in
   *  a portal so the slot's overflow:hidden can't clip it — see S3-005. */
  anchor: HTMLElement | null;
  onApply: (next: ApplyPayload) => void;
  onClose: () => void;
  /** Optional destructive action rendered at the bottom of the popover; when
   *  provided the caller is responsible for the actual remove side effect. */
  onRemove?: () => void;
};

const POPOVER_WIDTH = 320;
const VIEWPORT_GUTTER = 8;

export function WidgetSettingsPopover({ meta, entry, anchor, onApply, onClose, onRemove }: Props) {
  const confirm = useConfirm();
  const [draftFilters, setDraftFilters] = useState<WidgetFilters>(entry.config.filters ?? {});
  const [draftFields, setDraftFields] = useState<string[]>(() => resolveVisibleFields(meta, entry));
  const ref = useRef<HTMLDivElement | null>(null);
  const hasFieldSchema = Boolean(meta.fieldSchema && meta.fieldSchema.length > 0);
  const schema = meta.configSchema ?? [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2);
      const left = Math.max(
        VIEWPORT_GUTTER,
        Math.min(rect.right - width - 10, window.innerWidth - width - VIEWPORT_GUTTER)
      );
      // Preferred top: just below the widget header. Clamp so top + maxHeight fits
      // within the viewport, otherwise the bottom of the popover ends up
      // off-screen and its Apply/toggle buttons become unreachable in headless
      // Chromium (Playwright can't scrollIntoView across a fixed container's
      // own edge — see batch9a-forms-widgets timeouts fixed here).
      const preferredTop = Math.max(VIEWPORT_GUTTER, rect.top + 42);
      const minHeight = 200;
      const availableBelow = window.innerHeight - preferredTop - VIEWPORT_GUTTER;
      const top =
        availableBelow >= minHeight
          ? preferredTop
          : Math.max(VIEWPORT_GUTTER, window.innerHeight - minHeight - VIEWPORT_GUTTER);
      const maxHeight = Math.max(
        minHeight,
        window.innerHeight - top - VIEWPORT_GUTTER
      );
      setPosition({ top, left, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useEffect(() => {
    setDraftFilters(entry.config.filters ?? {});
    setDraftFields(resolveVisibleFields(meta, entry));
  }, [entry, meta]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) onClose();
    };
    // Delay to avoid immediate close from the opening click
    const id = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  const setField = (key: string, value: unknown) => setDraftFilters((prev) => ({ ...prev, [key]: value }));

  const toggleField = (key: string) => {
    setDraftFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draftFields.findIndex((k) => k === active.id);
    const newIndex = draftFields.findIndex((k) => k === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setDraftFields(arrayMove(draftFields, oldIndex, newIndex));
  };

  const resetFields = () => {
    if (!meta.fieldSchema) return;
    setDraftFields(meta.fieldSchema.filter((f) => f.defaultVisible).map((f) => f.key));
  };

  const apply = () => {
    const payload: ApplyPayload = {};
    if (schema.length > 0) payload.filters = draftFilters;
    if (hasFieldSchema) payload.fields = draftFields;
    onApply(payload);
    onClose();
  };

  const handleRemove = () => {
    if (!onRemove) return;
    void confirm({
      title: "Remove widget",
      message: "Remove this widget from the dashboard? You can add it back from Add widget.",
      confirmLabel: "Remove",
      variant: "danger"
    }).then((ok) => {
      if (!ok) return;
      onRemove();
      onClose();
    });
  };

  // Build the sortable items in "draft order for visible, then hidden appended at the end"
  const allKeys = useMemo(() => {
    if (!meta.fieldSchema) return [] as string[];
    const hidden = meta.fieldSchema.map((f) => f.key).filter((k) => !draftFields.includes(k));
    return [...draftFields, ...hidden];
  }, [draftFields, meta.fieldSchema]);

  const popover = (
    <div
      ref={ref}
      className="widget-settings-popover"
      role="dialog"
      aria-label="Widget settings"
      style={
        position
          ? {
              position: "fixed",
              top: position.top,
              left: position.left,
              right: "auto",
              maxHeight: position.maxHeight
            }
          : undefined
      }
    >
      {schema.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={draftFilters[field.key]}
          onChange={(value) => setField(field.key, value)}
        />
      ))}

      {hasFieldSchema ? (
        <div className="widget-settings-popover__field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="widget-settings-popover__field-label">Visible columns</span>
            <button
              type="button"
              onClick={resetFields}
              style={{ background: "none", border: 0, color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}
            >
              Reset to defaults
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
            <SortableContext items={allKeys} strategy={verticalListSortingStrategy}>
              <ul className="widget-field-list">
                {allKeys.map((key) => {
                  const field = meta.fieldSchema!.find((f) => f.key === key)!;
                  const on = draftFields.includes(key);
                  return (
                    <SortableFieldRow
                      key={key}
                      id={key}
                      label={field.label}
                      on={on}
                      onToggle={() => toggleField(key)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      <button
        type="button"
        className="s7-btn s7-btn--primary s7-btn--sm widget-settings-popover__apply"
        onClick={apply}
      >
        Apply
      </button>

      {onRemove ? (
        <button
          type="button"
          className="s7-btn s7-btn--danger s7-btn--sm widget-settings-popover__remove"
          data-testid="widget-settings-remove"
          onClick={handleRemove}
        >
          Remove from dashboard
        </button>
      ) : null}
    </div>
  );

  // Portal to body — inside the slot the popover inherits the grid slot's
  // overflow:hidden + chrome padding rules, which clipped it to an unusable
  // double-scrollbox (S3-005).
  return createPortal(popover, document.body);
}

function SortableFieldRow({
  id,
  label,
  on,
  onToggle
}: {
  id: string;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <li ref={setNodeRef} style={style} className="widget-field-list__row">
      <span className="widget-field-list__handle" {...attributes} {...listeners} aria-label="Drag to reorder">
        ⋮⋮
      </span>
      <span className="widget-field-list__label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={on ? "toggle-pill on" : "toggle-pill"}
        data-testid={`widget-field-toggle-${id.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`}
        onClick={onToggle}
      />
    </li>
  );
}

function FieldRenderer({
  field,
  value,
  onChange
}: {
  field: ConfigField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  // Resolve options up-front so the hook call is unconditional (Rules of Hooks)
  // and so the select/period branch honours `dynamicOptions: "sites"` etc. —
  // previously the branch inlined `field.options?.map(...)` and dropped any
  // dynamically-fetched options, which is what broke the Site weather widget's
  // site picker.
  const resolvedOptions = useDynamicOptions(field);

  if (field.type === "select" || field.type === "period") {
    return (
      <div className="widget-settings-popover__field">
        <span className="widget-settings-popover__field-label">{field.label}</span>
        <select
          className="s7-input s7-input--sm"
          data-testid={`widget-setting-${field.key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`}
          value={typeof value === "string" ? value : String(field.defaultValue ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {resolvedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="widget-settings-popover__field">
        <span className="widget-settings-popover__field-label">{field.label}</span>
        <input
          type="number"
          className="s7-input s7-input--sm"
          data-testid={`widget-setting-${field.key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={typeof value === "number" ? value : (field.defaultValue as number | undefined) ?? 0}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(Number.isFinite(next) ? next : 0);
          }}
        />
      </div>
    );
  }

  if (field.type === "multiselect") {
    return (
      <MultiSelectField
        field={field}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
        options={resolvedOptions}
      />
    );
  }

  if (field.type === "text") {
    return (
      <div className="widget-settings-popover__field">
        <span className="widget-settings-popover__field-label">{field.label}</span>
        <input
          type="text"
          className="s7-input s7-input--sm"
          placeholder={field.placeholder}
          data-testid={`widget-setting-${field.key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`}
          value={typeof value === "string" ? value : (field.defaultValue as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="widget-settings-popover__field">
        <span className="widget-settings-popover__field-label">{field.label}</span>
        <textarea
          className="s7-input s7-input--sm"
          rows={4}
          placeholder={field.placeholder}
          data-testid={`widget-setting-${field.key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`}
          value={typeof value === "string" ? value : (field.defaultValue as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return null;
}

function MultiSelectField({
  field,
  value,
  onChange,
  options
}: {
  field: ConfigField;
  value: string[];
  onChange: (next: string[]) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (optValue: string) => {
    const next = new Set(selected);
    if (next.has(optValue)) next.delete(optValue);
    else next.add(optValue);
    onChange(Array.from(next));
  };
  return (
    <div className="widget-settings-popover__field">
      <span className="widget-settings-popover__field-label">
        {field.label} {value.length > 0 ? `· ${value.length}` : ""}
      </span>
      <div className="widget-settings-popover__multiselect">
        {options.length === 0 ? (
          <p style={{ margin: 6, fontSize: 12, color: "var(--text-muted)" }}>No options available.</p>
        ) : (
          options.map((opt) => (
            <label key={opt.value}>
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export type DynamicOptionSources = {
  tenders: TenderForDashboard[] | undefined;
  formTemplates: Array<{ value: string; label: string }>;
  sites: Array<{ value: string; label: string }>;
};

/** Pure resolver — turns a ConfigField plus already-loaded sources into the
 *  option list the popover should render. Exposed for unit tests; the hook
 *  version below wires in the actual data sources. */
export function resolveDynamicOptions(
  field: ConfigField,
  sources: DynamicOptionSources
): Array<{ value: string; label: string }> {
  if (field.options) return field.options;

  if (field.dynamicOptions === "estimators") {
    const map = new Map<string, string>();
    for (const t of sources.tenders ?? []) {
      if (!t.estimator) continue;
      map.set(t.estimator.id, `${t.estimator.firstName} ${t.estimator.lastName}`);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  if (field.dynamicOptions === "formTemplates") {
    return sources.formTemplates;
  }

  if (field.dynamicOptions === "sites") {
    return sources.sites;
  }

  return [];
}

function useDynamicOptions(field: ConfigField): Array<{ value: string; label: string }> {
  const { data: tenders } = useTenders();
  const formTemplates = useFormTemplates(field.dynamicOptions === "formTemplates");
  const sites = useSites(field.dynamicOptions === "sites");
  return resolveDynamicOptions(field, { tenders, formTemplates, sites });
}

type SiteRow = { id: string; name: string };

/** Convention across the app: every other /master-data/sites caller uses
 *  pageSize=100 (see pages/jobs/JobsListPage, pages/JobsPage,
 *  pages/master-data/MasterDataWorkspacePage). The shared PaginationQueryDto
 *  on the API caps pageSize at 100, so pageSize=200 fails validation with 400
 *  and the picker rendered empty — see rev-527-fix2-ready.md. Exported so the
 *  regression test can assert we haven't drifted back above the cap. */
export const SITES_OPTIONS_URL = "/master-data/sites?page=1&pageSize=100";

/** Fetches site options for the widget picker. Extracted so a unit test can
 *  assert the URL requested without needing a jsdom/hook harness (the web
 *  workspace runs tests in the default node environment — see
 *  widgetSettingsPopover.test.ts header). */
export async function fetchSiteOptions(
  authFetch: (input: string) => Promise<Response>
): Promise<{ ok: true; options: Array<{ value: string; label: string }> } | { ok: false }> {
  const response = await authFetch(SITES_OPTIONS_URL);
  if (!response.ok) return { ok: false };
  const body = await response.json();
  const items = (body.items ?? body ?? []) as SiteRow[];
  return {
    ok: true,
    options: items
      .map((item) => ({ value: item.id, label: item.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
  };
}

function useSites(enabled: boolean): Array<{ value: string; label: string }> {
  const { authFetch } = useAuth();
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchSiteOptions(authFetch);
        if (cancelled) return;
        if (result.ok) {
          setOptions(result.options);
        } else {
          // Fail loudly (bounded): surface the loader failure to devtools so a
          // future backend regression like the pageSize=200 → HTTP 400 that
          // motivated rev-527-fix2 doesn't silently present as "no sites".
          // TODO(rev-527 follow-up): thread this through the picker UI so
          //   end users see "Couldn't load sites" instead of an empty menu —
          //   that requires touching useDynamicOptions()'s shared contract.
          console.error("[widget-settings] failed to load site options");
        }
      } catch (err) {
        console.error("[widget-settings] site options request threw", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, enabled]);
  return options;
}

type FormTemplateRow = { id: string; name: string };

function useFormTemplates(enabled: boolean): Array<{ value: string; label: string }> {
  const { authFetch } = useAuth();
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch("/forms/templates?page=1&pageSize=100");
        if (!response.ok) return;
        const body = await response.json();
        const items = (body.items ?? body ?? []) as FormTemplateRow[];
        if (!cancelled) {
          setOptions(items.map((item) => ({ value: item.id, label: item.name })));
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, enabled]);
  return options;
}
