import { useEffect, useMemo, useRef, useState } from "react";
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
import { useTenders } from "./hooks";
import { useAuth } from "../auth/AuthContext";
import { resolveVisibleFields } from "./types";
import type { ConfigField, WidgetConfigEntry, WidgetFilters, WidgetMeta } from "./types";

type Props = {
  meta: WidgetMeta;
  entry: WidgetConfigEntry;
  onApplyFilters: (next: WidgetFilters) => void;
  onApplyFields: (fields: string[]) => void;
  onClose: () => void;
};

export function WidgetSettingsPopover({ meta, entry, onApplyFilters, onApplyFields, onClose }: Props) {
  const [draftFilters, setDraftFilters] = useState<WidgetFilters>(entry.config.filters ?? {});
  const [draftFields, setDraftFields] = useState<string[]>(() => resolveVisibleFields(meta, entry));
  const ref = useRef<HTMLDivElement | null>(null);
  const hasFieldSchema = Boolean(meta.fieldSchema && meta.fieldSchema.length > 0);
  const schema = meta.configSchema ?? [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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
    if (schema.length > 0) onApplyFilters(draftFilters);
    if (hasFieldSchema) onApplyFields(draftFields);
    onClose();
  };

  // Build the sortable items in "draft order for visible, then hidden appended at the end"
  const allKeys = useMemo(() => {
    if (!meta.fieldSchema) return [] as string[];
    const hidden = meta.fieldSchema.map((f) => f.key).filter((k) => !draftFields.includes(k));
    return [...draftFields, ...hidden];
  }, [draftFields, meta.fieldSchema]);

  return (
    <div ref={ref} className="widget-settings-popover" role="dialog" aria-label="Widget settings">
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
    </div>
  );
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
  if (field.type === "select" || field.type === "period") {
    return (
      <div className="widget-settings-popover__field">
        <span className="widget-settings-popover__field-label">{field.label}</span>
        <select
          className="s7-input s7-input--sm"
          value={typeof value === "string" ? value : String(field.defaultValue ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((opt) => (
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
      <MultiSelectField field={field} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
    );
  }

  return null;
}

function MultiSelectField({
  field,
  value,
  onChange
}: {
  field: ConfigField;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const options = useDynamicOptions(field);
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

function useDynamicOptions(field: ConfigField): Array<{ value: string; label: string }> {
  const { data: tenders } = useTenders();
  const formTemplates = useFormTemplates(field.dynamicOptions === "formTemplates");

  if (field.options) return field.options;

  if (field.dynamicOptions === "estimators") {
    const map = new Map<string, string>();
    for (const t of tenders ?? []) {
      if (!t.estimator) continue;
      map.set(t.estimator.id, `${t.estimator.firstName} ${t.estimator.lastName}`);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  if (field.dynamicOptions === "formTemplates") {
    return formTemplates;
  }

  return [];
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
