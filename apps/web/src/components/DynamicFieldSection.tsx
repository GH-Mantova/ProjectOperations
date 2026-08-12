import { useState } from "react";
import { useFieldDefinitions, type FieldDefinition } from "../hooks/useFieldDefinitions";

export type { FieldDefinition };

export type DynamicFieldSectionProps = {
  appliesTo: "CLIENT" | "VENDOR";
  record: Record<string, unknown> & { customFields?: Record<string, unknown> };
  onChange: (patch: Record<string, unknown>) => void;
  errors?: Record<string, string>;
};

// ─── Pure helpers (exported for tests) ────────────────────────────────────────

/** Returns only the definitions with `visible: true`. */
export function filterVisible(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.filter((fd) => fd.visible);
}

/**
 * Groups fields by their `group` property, preserving first-appearance order.
 * Within each group the order matches the input (caller is responsible for
 * sorting by `sortOrder` before calling this).
 */
export function buildGroupOrder(fields: FieldDefinition[]): {
  groupOrder: string[];
  grouped: Map<string, FieldDefinition[]>;
} {
  const groupOrder: string[] = [];
  const grouped = new Map<string, FieldDefinition[]>();
  for (const fd of fields) {
    if (!grouped.has(fd.group)) {
      groupOrder.push(fd.group);
      grouped.set(fd.group, []);
    }
    grouped.get(fd.group)!.push(fd);
  }
  return { groupOrder, grouped };
}

/**
 * Returns `true` when every field in the group has `source === "CUSTOM"`.
 * CUSTOM groups are collapsed by default; BUILTIN groups are expanded.
 */
export function isCustomGroup(fields: FieldDefinition[]): boolean {
  return fields.every((fd) => fd.source === "CUSTOM");
}

/**
 * Resolves the current display value for a field from the record.
 * BUILTIN fields bind to `record[key]`; CUSTOM fields bind to
 * `record.customFields?.[key]`. Returns `""` when the value is absent or null.
 */
export function resolveValue(
  key: string,
  source: "BUILTIN" | "CUSTOM",
  record: Record<string, unknown> & { customFields?: Record<string, unknown> }
): string {
  const raw =
    source === "CUSTOM"
      ? (record.customFields ?? {})[key]
      : record[key];
  return raw === null || raw === undefined ? "" : String(raw);
}

/**
 * Builds the onChange patch for a BUILTIN field: `{ [key]: value }`.
 */
export function buildBuiltinPatch(key: string, value: string | null): Record<string, unknown> {
  return { [key]: value };
}

/**
 * Builds the onChange patch for a CUSTOM field:
 * `{ customFields: { ...existing, [key]: value } }`.
 */
export function buildCustomPatch(
  key: string,
  value: string | null,
  existingCustomFields: Record<string, unknown> | undefined
): Record<string, unknown> {
  return {
    customFields: {
      ...(existingCustomFields ?? {}),
      [key]: value
    }
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders BUILTIN + CUSTOM field definitions for a client or vendor record.
 *
 * Behaviour:
 *  - Fetches definitions via `useFieldDefinitions(appliesTo)`.
 *  - Skips definitions with `visible: false`.
 *  - Groups definitions by `group` (group order = first appearance in the
 *    sorted list; within group, order by `sortOrder`).
 *  - BUILTIN fields bind to `record[key]`; onChange fires `{ [key]: value }`.
 *  - CUSTOM fields bind to `record.customFields?.[key]`; onChange fires
 *    `{ customFields: { ...record.customFields, [key]: value } }`.
 *  - Required fields render with `*`; `errors[key]` surfaces the error message.
 *  - CUSTOM-field groups are collapsed by default; BUILTIN groups are expanded.
 *  - All fields render as a string `<input>` in this slice (type-specific
 *    widgets are deferred). The `source` and `key` are passed as data attrs
 *    so a future slice can swap in a typed widget without a prop change.
 */
export function DynamicFieldSection({ appliesTo, record, onChange, errors = {} }: DynamicFieldSectionProps) {
  const { definitions, loading, error } = useFieldDefinitions(appliesTo);

  if (loading) {
    return <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading fields…</p>;
  }
  if (error) {
    return <p style={{ fontSize: 12, color: "var(--status-danger)" }}>Could not load fields: {error}</p>;
  }

  // Filter visible fields.
  const visible = filterVisible(definitions);

  // Group by `group`, preserving first-appearance order from the already-sorted list.
  const { groupOrder, grouped } = buildGroupOrder(visible);

  if (groupOrder.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groupOrder.map((grp) => {
        const fields = grouped.get(grp)!;
        return (
          <FieldGroup
            key={grp}
            title={grp}
            defaultCollapsed={isCustomGroup(fields)}
            fields={fields}
            record={record}
            onChange={onChange}
            errors={errors}
          />
        );
      })}
    </div>
  );
}

// ─── FieldGroup ──────────────────────────────────────────────────────────────

function FieldGroup({
  title,
  defaultCollapsed,
  fields,
  record,
  onChange,
  errors
}: {
  title: string;
  defaultCollapsed: boolean;
  fields: FieldDefinition[];
  record: DynamicFieldSectionProps["record"];
  onChange: DynamicFieldSectionProps["onChange"];
  errors: Record<string, string>;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 0 4px",
          fontSize: 10,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          letterSpacing: 0.4,
          width: "100%",
          textAlign: "left"
        }}
        aria-expanded={!collapsed}
      >
        <span style={{ fontSize: 10 }}>{collapsed ? "▶" : "▼"}</span>
        {title}
      </button>

      {!collapsed && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
            paddingTop: 4
          }}
        >
          {fields.map((fd) => (
            <FieldInput
              key={fd.id}
              definition={fd}
              record={record}
              onChange={onChange}
              error={errors[fd.key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FieldInput ──────────────────────────────────────────────────────────────

function FieldInput({
  definition,
  record,
  onChange,
  error
}: {
  definition: FieldDefinition;
  record: DynamicFieldSectionProps["record"];
  onChange: DynamicFieldSectionProps["onChange"];
  error?: string;
}) {
  const { key, label, required, source } = definition;

  const value = resolveValue(key, source, record);

  const handleChange = (newValue: string) => {
    if (source === "CUSTOM") {
      onChange(buildCustomPatch(key, newValue || null, record.customFields));
    } else {
      onChange(buildBuiltinPatch(key, newValue || null));
    }
  };

  return (
    <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
      <span>
        {label}
        {required ? <span style={{ color: "var(--status-danger)", marginLeft: 2 }}>*</span> : null}
      </span>
      <input
        className="s7-input"
        data-field-key={key}
        data-field-source={source}
        value={value}
        required={required}
        onChange={(e) => handleChange(e.target.value)}
      />
      {error ? (
        <span style={{ color: "var(--status-danger)", fontSize: 11 }}>{error}</span>
      ) : null}
    </label>
  );
}
