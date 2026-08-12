/**
 * CFX-2 — Admin screen to configure client/vendor field definitions.
 *
 * Three tabs (CLIENT / VENDOR / BOTH).
 * Table columns: Sort, Label, Key, Group, Visible, Required, Source, Actions.
 *
 * Rules:
 *  - BUILTIN fields: visible toggle enabled (hide = the "delete" path),
 *    required toggle enabled, label/group inline editable.
 *    Remove button DISABLED with tooltip "Hide built-in fields instead of deleting them."
 *  - CUSTOM fields: full CRUD; Remove button triggers confirm modal then DELETE.
 *  - "Add custom field" button opens a modal (key, label, group, appliesTo, required).
 *
 * Same table + modal pattern as RatesListsAdminPage — no new UI library.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";
import { readApiErrorMessage } from "../../lib/api-errors";
import { NoAccess } from "../../components/NoAccess";

// ── Types ──────────────────────────────────────────────────────────────────

export type FieldAppliesTo = "CLIENT" | "VENDOR" | "BOTH";
export type FieldSource = "BUILTIN" | "CUSTOM";

export type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  group: string | null;
  sortOrder: number;
  visible: boolean;
  required: boolean;
  appliesTo: FieldAppliesTo;
  source: FieldSource;
};

export type CreateFieldDto = {
  key: string;
  label: string;
  group?: string;
  appliesTo: FieldAppliesTo;
  required: boolean;
  source: "CUSTOM";
};

// ── Pure helpers (exported so tests can cover them without DOM) ────────────

/**
 * Returns true when the Remove button should be disabled for this field.
 * BUILTIN fields cannot be deleted — only hidden.
 */
export function isRemoveDisabled(field: Pick<FieldDefinition, "source">): boolean {
  return field.source === "BUILTIN";
}

/**
 * Tooltip text for the Remove button of a BUILTIN field (matches the spec copy).
 */
export const BUILTIN_REMOVE_TOOLTIP = "Hide built-in fields instead of deleting them.";

/**
 * Validates a kebab-slug key. Returns null on success or an error string.
 */
export function validateKey(key: string): string | null {
  if (!key || key.trim().length === 0) return "Key is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key.trim())) {
    return "Key must be a kebab-slug: lowercase letters, digits, and hyphens only (e.g. my-field-name).";
  }
  return null;
}

/**
 * Validates the Add Custom Field form. Returns an error message or null.
 */
export function validateAddForm(form: {
  key: string;
  label: string;
  appliesTo: string;
}): string | null {
  const keyError = validateKey(form.key);
  if (keyError) return keyError;
  if (!form.label || form.label.trim().length === 0) return "Label is required.";
  if (!form.appliesTo) return "Applies to is required.";
  return null;
}

/**
 * Sorts fields by sortOrder ascending, then label alphabetically.
 */
export function sortFields(fields: FieldDefinition[]): FieldDefinition[] {
  return [...fields].sort((fieldA, fieldB) => {
    if (fieldA.sortOrder !== fieldB.sortOrder) return fieldA.sortOrder - fieldB.sortOrder;
    return fieldA.label.localeCompare(fieldB.label);
  });
}

// ── Tab type ───────────────────────────────────────────────────────────────

type TabKey = FieldAppliesTo;

// ── Main page ──────────────────────────────────────────────────────────────

export function FieldDefinitionAdminPage() {
  const { user, authFetch } = useAuth();

  if (!user) return null;
  if (user.isSuperUser !== true) {
    return (
      <NoAccess required="super-user" title="Field definitions requires super-user access" />
    );
  }

  return <FieldDefinitionAdminContent authFetch={authFetch} />;
}

type AuthFetch = ReturnType<typeof useAuth>["authFetch"];

function FieldDefinitionAdminContent({ authFetch }: { authFetch: AuthFetch }) {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabKey>("CLIENT");
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadFields = useCallback(
    async (tab: TabKey) => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(
          tab === "BOTH"
            ? "/field-definitions?appliesTo=BOTH"
            : `/field-definitions?appliesTo=${tab}`
        );
        if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load field definitions."));
        const data = (await res.json()) as FieldDefinition[];
        setFields(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    void loadFields(activeTab);
  }, [activeTab, loadFields]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setFields([]);
  };

  const handlePatch = useCallback(
    async (id: string, patch: Partial<Pick<FieldDefinition, "label" | "group" | "sortOrder" | "visible" | "required">>) => {
      setError(null);
      try {
        const res = await authFetch(`/field-definitions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to update field."));
        const updated = (await res.json()) as FieldDefinition;
        setFields((prev) => prev.map((fd) => (fd.id === id ? updated : fd)));
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch]
  );

  const handleMoveSortOrder = useCallback(
    async (field: FieldDefinition, direction: "up" | "down") => {
      const sorted = sortFields(fields);
      const idx = sorted.findIndex((fd) => fd.id === field.id);
      const newOrder = direction === "up" ? idx - 1 : idx + 1;
      if (newOrder < 0 || newOrder >= sorted.length) return;
      await handlePatch(field.id, { sortOrder: newOrder });
    },
    [fields, handlePatch]
  );

  const handleDelete = useCallback(
    async (field: FieldDefinition) => {
      const confirmed = await confirm({
        title: "Remove custom field",
        message: `Remove "${field.label}" (${field.key})? This cannot be undone.`,
        confirmLabel: "Remove",
        variant: "danger"
      });
      if (!confirmed) return;
      setError(null);
      try {
        const res = await authFetch(`/field-definitions/${field.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to remove field."));
        setFields((prev) => prev.filter((fd) => fd.id !== field.id));
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, confirm]
  );

  const handleCreate = useCallback(
    async (dto: CreateFieldDto) => {
      setError(null);
      try {
        const res = await authFetch("/field-definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto)
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to create field."));
        const created = (await res.json()) as FieldDefinition;
        setAddOpen(false);
        // Only add to the current tab's list if it belongs here
        if (created.appliesTo === activeTab || created.appliesTo === "BOTH" || activeTab === "BOTH") {
          setFields((prev) => sortFields([...prev, created]));
        }
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, activeTab]
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: "CLIENT", label: "Client" },
    { key: "VENDOR", label: "Vendor" },
    { key: "BOTH", label: "Both" }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 className="s7-type-page-heading" style={{ marginTop: 0, marginBottom: 4 }}>
            Field definitions
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Configure which fields appear on client and vendor records. BUILTIN fields can be hidden
            but not deleted; CUSTOM fields can be fully managed.
          </p>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => setAddOpen(true)}
          style={{ flexShrink: 0, marginTop: 4 }}
        >
          Add custom field
        </button>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Field definition groups"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          marginBottom: 20
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              minHeight: 44,
              padding: "0 20px",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.key
                  ? "3px solid var(--brand-primary, #005B61)"
                  : "3px solid transparent",
              color: activeTab === tab.key ? "var(--brand-primary, #005B61)" : "var(--text)",
              fontWeight: activeTab === tab.key ? 600 : 500,
              cursor: "pointer",
              fontSize: 14
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 6,
            background: "var(--surface-danger, #fef2f2)",
            color: "var(--text-danger, #b91c1c)",
            border: "1px solid var(--border-danger, #fca5a5)"
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      )}

      {!loading && (
        <FieldDefinitionsTable
          fields={sortFields(fields)}
          onPatch={handlePatch}
          onDelete={handleDelete}
          onMoveSort={handleMoveSortOrder}
        />
      )}

      {addOpen && (
        <AddCustomFieldModal
          onSubmit={handleCreate}
          onClose={() => setAddOpen(false)}
          error={error}
        />
      )}
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────────────

function FieldDefinitionsTable({
  fields,
  onPatch,
  onDelete,
  onMoveSort
}: {
  fields: FieldDefinition[];
  onPatch: (id: string, patch: Partial<FieldDefinition>) => Promise<void>;
  onDelete: (field: FieldDefinition) => Promise<void>;
  onMoveSort: (field: FieldDefinition, direction: "up" | "down") => Promise<void>;
}) {
  if (fields.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)" }}>
        No field definitions found for this group.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14
        }}
      >
        <thead>
          <tr>
            {["Sort", "Label", "Key", "Group", "Visible", "Required", "Source", "Actions"].map(
              (col) => (
                <th
                  key={col}
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    borderBottom: "2px solid var(--border, #e5e7eb)",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    whiteSpace: "nowrap"
                  }}
                >
                  {col}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {fields.map((field, idx) => (
            <FieldRow
              key={field.id}
              field={field}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
              onPatch={onPatch}
              onDelete={onDelete}
              onMoveSort={onMoveSort}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  isFirst,
  isLast,
  onPatch,
  onDelete,
  onMoveSort
}: {
  field: FieldDefinition;
  isFirst: boolean;
  isLast: boolean;
  onPatch: (id: string, patch: Partial<FieldDefinition>) => Promise<void>;
  onDelete: (field: FieldDefinition) => Promise<void>;
  onMoveSort: (field: FieldDefinition, direction: "up" | "down") => Promise<void>;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState(field.group ?? "");
  const labelInputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);

  const disabled = isRemoveDisabled(field);

  const commitLabel = async () => {
    setEditingLabel(false);
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== field.label) {
      await onPatch(field.id, { label: trimmed });
    } else {
      setLabelDraft(field.label);
    }
  };

  const commitGroup = async () => {
    setEditingGroup(false);
    const trimmed = groupDraft.trim();
    if (trimmed !== (field.group ?? "")) {
      await onPatch(field.id, { group: trimmed || undefined });
    } else {
      setGroupDraft(field.group ?? "");
    }
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border, #e5e7eb)",
    verticalAlign: "middle"
  };

  return (
    <tr>
      {/* Sort column */}
      <td style={tdStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button
            type="button"
            aria-label="Move up"
            disabled={isFirst}
            onClick={() => void onMoveSort(field, "up")}
            style={{
              background: "none",
              border: "none",
              cursor: isFirst ? "default" : "pointer",
              color: isFirst ? "var(--text-muted)" : "var(--text)",
              padding: "2px 4px",
              fontSize: 10
            }}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={isLast}
            onClick={() => void onMoveSort(field, "down")}
            style={{
              background: "none",
              border: "none",
              cursor: isLast ? "default" : "pointer",
              color: isLast ? "var(--text-muted)" : "var(--text)",
              padding: "2px 4px",
              fontSize: 10
            }}
          >
            ▼
          </button>
        </div>
      </td>

      {/* Label — inline editable */}
      <td style={tdStyle}>
        {editingLabel ? (
          <input
            ref={labelInputRef}
            type="text"
            value={labelDraft}
            onChange={(ev: ChangeEvent<HTMLInputElement>) => setLabelDraft(ev.target.value)}
            onBlur={() => void commitLabel()}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") void commitLabel();
              if (ev.key === "Escape") {
                setLabelDraft(field.label);
                setEditingLabel(false);
              }
            }}
            style={{
              border: "1px solid var(--brand-primary, #005B61)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 14,
              width: "100%",
              minWidth: 120
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setLabelDraft(field.label);
              setEditingLabel(true);
              setTimeout(() => labelInputRef.current?.select(), 0);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              padding: 0,
              fontSize: 14,
              color: "var(--text)"
            }}
            title="Click to edit"
          >
            {field.label}
          </button>
        )}
      </td>

      {/* Key — read-only */}
      <td style={tdStyle}>
        <code
          style={{
            fontSize: 12,
            background: "var(--surface-2, #f3f4f6)",
            padding: "2px 6px",
            borderRadius: 4
          }}
        >
          {field.key}
        </code>
      </td>

      {/* Group — inline editable */}
      <td style={tdStyle}>
        {editingGroup ? (
          <input
            ref={groupInputRef}
            type="text"
            value={groupDraft}
            onChange={(ev: ChangeEvent<HTMLInputElement>) => setGroupDraft(ev.target.value)}
            onBlur={() => void commitGroup()}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") void commitGroup();
              if (ev.key === "Escape") {
                setGroupDraft(field.group ?? "");
                setEditingGroup(false);
              }
            }}
            style={{
              border: "1px solid var(--brand-primary, #005B61)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 14,
              width: "100%",
              minWidth: 100
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setGroupDraft(field.group ?? "");
              setEditingGroup(true);
              setTimeout(() => groupInputRef.current?.select(), 0);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              padding: 0,
              fontSize: 14,
              color: field.group ? "var(--text)" : "var(--text-muted)"
            }}
            title="Click to edit"
          >
            {field.group ?? "—"}
          </button>
        )}
      </td>

      {/* Visible toggle */}
      <td style={tdStyle}>
        <ToggleSwitch
          checked={field.visible}
          label={`Toggle visible for ${field.label}`}
          onChange={(checked) => void onPatch(field.id, { visible: checked })}
        />
      </td>

      {/* Required toggle */}
      <td style={tdStyle}>
        <ToggleSwitch
          checked={field.required}
          label={`Toggle required for ${field.label}`}
          onChange={(checked) => void onPatch(field.id, { required: checked })}
        />
      </td>

      {/* Source badge */}
      <td style={tdStyle}>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 12,
            background:
              field.source === "BUILTIN"
                ? "var(--surface-info, #dbeafe)"
                : "var(--surface-2, #f0fdf4)",
            color:
              field.source === "BUILTIN"
                ? "var(--text-info, #1d4ed8)"
                : "var(--text-success, #15803d)"
          }}
        >
          {field.source}
        </span>
      </td>

      {/* Actions */}
      <td style={tdStyle}>
        {disabled ? (
          <span title={BUILTIN_REMOVE_TOOLTIP}>
            <button
              type="button"
              disabled
              aria-label={`Remove ${field.label}`}
              aria-disabled="true"
              style={{
                padding: "4px 12px",
                fontSize: 13,
                borderRadius: 4,
                border: "1px solid var(--border, #e5e7eb)",
                background: "var(--surface-disabled, #f3f4f6)",
                color: "var(--text-muted)",
                cursor: "not-allowed"
              }}
            >
              Remove
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Remove ${field.label}`}
            onClick={() => void onDelete(field)}
            style={{
              padding: "4px 12px",
              fontSize: 13,
              borderRadius: 4,
              border: "1px solid var(--border-danger, #fca5a5)",
              background: "var(--surface-danger-subtle, #fff5f5)",
              color: "var(--text-danger, #b91c1c)",
              cursor: "pointer"
            }}
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Toggle switch ──────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? "var(--brand-primary, #005B61)" : "var(--border, #d1d5db)",
        border: "none",
        cursor: "pointer",
        padding: 2,
        transition: "background 0.15s"
      }}
    >
      <span
        style={{
          display: "block",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transform: checked ? "translateX(16px)" : "translateX(0)",
          transition: "transform 0.15s"
        }}
      />
    </button>
  );
}

// ── Add custom field modal ─────────────────────────────────────────────────

type AddFormState = {
  key: string;
  label: string;
  group: string;
  appliesTo: FieldAppliesTo;
  required: boolean;
};

function AddCustomFieldModal({
  onSubmit,
  onClose,
  error
}: {
  onSubmit: (dto: CreateFieldDto) => Promise<void>;
  onClose: () => void;
  error: string | null;
}) {
  const [form, setForm] = useState<AddFormState>({
    key: "",
    label: "",
    group: "",
    appliesTo: "CLIENT",
    required: false
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof AddFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationError(null);
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const err = validateAddForm(form);
    if (err) {
      setValidationError(err);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        key: form.key.trim(),
        label: form.label.trim(),
        group: form.group.trim() || undefined,
        appliesTo: form.appliesTo,
        required: form.required,
        source: "CUSTOM"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = validationError ?? error;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add custom field"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000
      }}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface-base, #fff)",
          borderRadius: 8,
          padding: 24,
          width: 480,
          maxWidth: "calc(100vw - 32px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.16)"
        }}
      >
        <h2
          className="s7-type-section-heading"
          style={{ margin: "0 0 16px" }}
        >
          Add custom field
        </h2>

        {displayError && (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 6,
              background: "var(--surface-danger, #fef2f2)",
              color: "var(--text-danger, #b91c1c)",
              border: "1px solid var(--border-danger, #fca5a5)",
              fontSize: 13
            }}
          >
            {displayError}
          </div>
        )}

        <form onSubmit={(ev) => void handleSubmit(ev)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>
                Key <span style={{ color: "var(--text-danger, #b91c1c)" }}>*</span>
              </span>
              <input
                type="text"
                value={form.key}
                placeholder="e.g. purchase-order-number"
                onChange={(ev) => handleChange("key", ev.target.value)}
                style={{
                  border: "1px solid var(--border, #d1d5db)",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 14
                }}
                required
              />
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Kebab-slug format: lowercase letters, digits, hyphens. Immutable after creation.
              </span>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>
                Label <span style={{ color: "var(--text-danger, #b91c1c)" }}>*</span>
              </span>
              <input
                type="text"
                value={form.label}
                placeholder="e.g. Purchase Order Number"
                onChange={(ev) => handleChange("label", ev.target.value)}
                style={{
                  border: "1px solid var(--border, #d1d5db)",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 14
                }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>Group</span>
              <input
                type="text"
                value={form.group}
                placeholder="e.g. Finance"
                onChange={(ev) => handleChange("group", ev.target.value)}
                style={{
                  border: "1px solid var(--border, #d1d5db)",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 14
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>
                Applies to <span style={{ color: "var(--text-danger, #b91c1c)" }}>*</span>
              </span>
              <select
                value={form.appliesTo}
                onChange={(ev) => handleChange("appliesTo", ev.target.value as FieldAppliesTo)}
                style={{
                  border: "1px solid var(--border, #d1d5db)",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 14
                }}
              >
                <option value="CLIENT">Client</option>
                <option value="VENDOR">Vendor</option>
                <option value="BOTH">Both</option>
              </select>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={form.required}
                onChange={(ev) => handleChange("required", ev.target.checked)}
              />
              <span>Required</span>
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 20
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="s7-btn"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="s7-btn s7-btn--primary"
              disabled={submitting}
            >
              {submitting ? "Adding…" : "Add field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
