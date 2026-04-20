import { useEffect, useMemo, useRef, useState } from "react";
import { useTenders } from "./hooks";
import { useAuth } from "../auth/AuthContext";
import type { ConfigField, WidgetFilters } from "./types";

type Props = {
  schema: ConfigField[];
  initial: WidgetFilters;
  onApply: (next: WidgetFilters) => void;
  onClose: () => void;
};

export function WidgetSettingsPopover({ schema, initial, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<WidgetFilters>(initial);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setDraft(initial), [initial]);

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

  const setField = (key: string, value: unknown) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div ref={ref} className="widget-settings-popover" role="dialog" aria-label="Widget settings">
      {schema.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={draft[field.key]}
          onChange={(value) => setField(field.key, value)}
        />
      ))}
      <button
        type="button"
        className="s7-btn s7-btn--primary s7-btn--sm widget-settings-popover__apply"
        onClick={() => {
          onApply(draft);
          onClose();
        }}
      >
        Apply
      </button>
    </div>
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
