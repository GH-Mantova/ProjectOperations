import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type {
  Condition,
  ConditionGroup,
  ConditionOperator,
  FieldRule,
  RuleAction,
  RuleActionType
} from "@project-ops/config/forms-rule-definition";

/**
 * F-2c — full-screen visual builder for FieldRule[] attached to one
 * FormTemplateVersion. Loads the template, lets the author pick a target
 * field, edit its rules (trigger + ConditionGroup + RuleAction[]), and
 * publish a new version with the updated rules preserved on every field.
 *
 * Conditions are form-value only (F-2c scope) — system-value conditions
 * (current user role, date/time, worker qualifications) are F-10 and
 * deliberately not modelled here.
 */

// ── Types shared with the template GET response ──────────────────────────

type LoadedField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  optionsJson?: unknown;
  config?: Record<string, unknown> | null;
  snippetCode?: string | null;
  conditions?: unknown;
  actions?: unknown;
};

type LoadedSection = {
  id: string;
  title: string;
  description?: string | null;
  sectionOrder: number;
  fields: LoadedField[];
};

type LoadedVersion = {
  id: string;
  versionNumber: number;
  status: string;
  sections: LoadedSection[];
};

type LoadedTemplate = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  settings?: unknown;
  versions: LoadedVersion[];
};

// ── Pure state helpers (exported for tests) ──────────────────────────────

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  greater_than: "greater than",
  less_than: "less than",
  between: "between",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  is_one_of: "is one of",
  is_not_one_of: "is not one of",
  has_any_entry_where: "has any entry where…",
  entry_count: "entry count equals",
  column_total: "column total equals"
};

export const ACTION_TYPE_LABELS: Record<RuleActionType, string> = {
  show: "Show field",
  hide: "Hide field",
  require: "Make required",
  unrequire: "Make optional",
  set_value: "Set value",
  clear_value: "Clear value",
  lock: "Lock",
  unlock: "Unlock",
  jump_to_section: "Jump to section",
  submit_form: "Submit form",
  send_notification: "Send notification",
  create_record: "Create record",
  add_repeating_row: "Add repeating row",
  remove_repeating_row: "Remove repeating row",
  warn: "WARN on submit (requires acknowledgement)",
  block: "BLOCK submit"
};

/** Return an empty FieldRule scaffolded for a specific trigger. */
export function emptyFieldRule(trigger: FieldRule["trigger"] = "on_submit"): FieldRule {
  return {
    trigger,
    conditionGroup: { logic: "AND", conditions: [] },
    actions: []
  };
}

/** Append a new leaf Condition to the group at `path`. */
export function addCondition(root: ConditionGroup, path: number[]): ConditionGroup {
  return mutateGroup(root, path, (group) => ({
    ...group,
    conditions: [...group.conditions, { fieldKey: "", operator: "equals", value: "" }]
  }));
}

/** Append a new nested ConditionGroup to the group at `path`. */
export function addNestedGroup(
  root: ConditionGroup,
  path: number[],
  logic: "AND" | "OR" = "AND"
): ConditionGroup {
  return mutateGroup(root, path, (group) => ({
    ...group,
    conditions: [...group.conditions, { logic, conditions: [] }]
  }));
}

/** Remove the child at index `childIndex` from the group at `path`. */
export function removeChild(
  root: ConditionGroup,
  path: number[],
  childIndex: number
): ConditionGroup {
  return mutateGroup(root, path, (group) => ({
    ...group,
    conditions: group.conditions.filter((_, i) => i !== childIndex)
  }));
}

/** Toggle a group's logic (AND ↔ OR) at `path`. */
export function toggleLogic(root: ConditionGroup, path: number[]): ConditionGroup {
  return mutateGroup(root, path, (group) => ({
    ...group,
    logic: group.logic === "AND" ? "OR" : "AND"
  }));
}

/** Patch a single Condition (identified by absolute path) with new fields. */
export function updateCondition(
  root: ConditionGroup,
  path: number[],
  patch: Partial<Condition>
): ConditionGroup {
  if (path.length === 0) return root;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  return mutateGroup(root, parentPath, (group) => ({
    ...group,
    conditions: group.conditions.map((child, i) => {
      if (i !== idx) return child;
      // Only leaf Conditions accept this patch; nested groups pass through.
      if ((child as ConditionGroup).conditions !== undefined) return child;
      return { ...(child as Condition), ...patch };
    })
  }));
}

/** Append a new RuleAction (default type `warn`) to the rule's action list. */
export function addAction(rule: FieldRule, type: RuleActionType = "warn"): FieldRule {
  const action: RuleAction = { type };
  if (type === "warn") action.warnMessage = "Please double-check before submitting.";
  if (type === "block") action.blockMessage = "This submission is not allowed.";
  return { ...rule, actions: [...rule.actions, action] };
}

/** Patch a RuleAction at `index` on the rule with new fields. */
export function updateAction(rule: FieldRule, index: number, patch: Partial<RuleAction>): FieldRule {
  return {
    ...rule,
    actions: rule.actions.map((a, i) => (i === index ? { ...a, ...patch } : a))
  };
}

/** Remove the RuleAction at `index`. */
export function removeAction(rule: FieldRule, index: number): FieldRule {
  return { ...rule, actions: rule.actions.filter((_, i) => i !== index) };
}

// Internal — walk to `path`, apply `mutator`, rebuild the tree top-down.
function mutateGroup(
  root: ConditionGroup,
  path: number[],
  mutator: (group: ConditionGroup) => ConditionGroup
): ConditionGroup {
  if (path.length === 0) return mutator(root);
  const [head, ...tail] = path;
  return {
    ...root,
    conditions: root.conditions.map((child, i) => {
      if (i !== head) return child;
      if ((child as ConditionGroup).conditions === undefined) return child;
      return mutateGroup(child as ConditionGroup, tail, mutator);
    })
  };
}

// ── Component ────────────────────────────────────────────────────────────

type RulesByField = Record<string, FieldRule[]>;

export function FormRulesBuilderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const { authFetch } = useAuth();
  const [template, setTemplate] = useState<LoadedTemplate | null>(null);
  const [rulesByField, setRulesByField] = useState<RulesByField>({});
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const [selectedRuleIndex, setSelectedRuleIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/forms/templates/${templateId}`);
        if (!res.ok) throw new Error("Template not found.");
        const data = (await res.json()) as LoadedTemplate;
        if (cancelled) return;
        setTemplate(data);
        const latest =
          data.versions.find((v) => v.status === "ACTIVE") ?? data.versions[0] ?? null;
        const seed: RulesByField = {};
        for (const section of latest?.sections ?? []) {
          for (const field of section.fields ?? []) {
            const arr = Array.isArray(field.actions) ? (field.actions as FieldRule[]) : [];
            seed[field.fieldKey] = arr;
          }
        }
        setRulesByField(seed);
        const firstFieldKey = latest?.sections?.[0]?.fields?.[0]?.fieldKey ?? null;
        setSelectedFieldKey(firstFieldKey);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, templateId]);

  const latestVersion = useMemo(() => {
    if (!template) return null;
    return template.versions.find((v) => v.status === "ACTIVE") ?? template.versions[0] ?? null;
  }, [template]);

  const allFields = useMemo(() => {
    if (!latestVersion) return [] as LoadedField[];
    return latestVersion.sections.flatMap((s) => s.fields);
  }, [latestVersion]);

  const selectedField = allFields.find((f) => f.fieldKey === selectedFieldKey) ?? null;
  const selectedRules = selectedFieldKey ? rulesByField[selectedFieldKey] ?? [] : [];
  const selectedRule = selectedRules[selectedRuleIndex] ?? null;

  const updateSelectedRule = (patch: (rule: FieldRule) => FieldRule) => {
    if (!selectedFieldKey || !selectedRule) return;
    setRulesByField((prev) => {
      const arr = prev[selectedFieldKey] ?? [];
      const next = arr.map((r, i) => (i === selectedRuleIndex ? patch(r) : r));
      return { ...prev, [selectedFieldKey]: next };
    });
  };

  const handleAddRule = () => {
    if (!selectedFieldKey) return;
    setRulesByField((prev) => {
      const arr = prev[selectedFieldKey] ?? [];
      const next = [...arr, emptyFieldRule("on_submit")];
      setSelectedRuleIndex(next.length - 1);
      return { ...prev, [selectedFieldKey]: next };
    });
  };

  const handleDeleteRule = () => {
    if (!selectedFieldKey || !selectedRule) return;
    setRulesByField((prev) => {
      const arr = prev[selectedFieldKey] ?? [];
      return { ...prev, [selectedFieldKey]: arr.filter((_, i) => i !== selectedRuleIndex) };
    });
    setSelectedRuleIndex(0);
  };

  const publish = async () => {
    if (!templateId || !template || !latestVersion) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: template.name,
        code: template.code,
        description: template.description ?? undefined,
        status: "ACTIVE",
        sections: latestVersion.sections.map((section) => ({
          title: section.title,
          description: section.description ?? undefined,
          sectionOrder: section.sectionOrder,
          fields: section.fields.map((field) => ({
            fieldKey: field.fieldKey,
            label: field.label,
            fieldType: field.fieldType,
            fieldOrder: field.fieldOrder,
            isRequired: field.isRequired,
            placeholder: field.placeholder ?? undefined,
            helpText: field.helpText ?? undefined,
            optionsJson: field.optionsJson ?? undefined,
            config: field.config ?? undefined,
            snippetCode: field.snippetCode ?? undefined,
            // conditions is left undefined so the server preserves the
            // prior visibility/required rules. actions carries the current
            // rule builder state — explicit array means "replace".
            actions: rulesByField[field.fieldKey] ?? []
          }))
        })),
        rules: []
      };
      const res = await authFetch(`/forms/templates/${templateId}/versions`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Could not save rules.");
      }
      const updated = (await res.json()) as LoadedTemplate;
      setTemplate(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</div>;
  if (error && !template) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--status-danger)" }}>{error}</p>
        <Link to={`/forms/designer/${templateId}`} className="s7-btn s7-btn--ghost">
          ← Back to designer
        </Link>
      </div>
    );
  }
  if (!template || !latestVersion) return null;

  return (
    <div className="fv2-builder" data-testid="rules-builder">
      <Link to={`/forms/designer/${templateId}`} className="fv2-builder__back">
        ← Back to designer
      </Link>
      <div className="fv2-topbar">
        <span className="fv2-topbar__name">Rules · {template.name}</span>
        <span className="fv2-chip">v{latestVersion.versionNumber}</span>
        <button
          type="button"
          className="fv2-tbtn fv2-tbtn--primary"
          onClick={() => void publish()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save rules"}
        </button>
      </div>

      {error ? (
        <div className="tender-page__error" role="alert" style={{ maxWidth: 1280, margin: "8px auto" }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 16, padding: 16 }}>
        {/* Left: field picker */}
        <aside style={{ width: 240, borderRight: "1px solid var(--border)", paddingRight: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Fields
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="rules-builder-fields">
            {allFields.map((f) => {
              const count = (rulesByField[f.fieldKey] ?? []).length;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFieldKey(f.fieldKey);
                      setSelectedRuleIndex(0);
                    }}
                    className={`fv2-fld ${selectedFieldKey === f.fieldKey ? "fv2-fld--active" : ""}`}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 8px",
                      background: selectedFieldKey === f.fieldKey ? "var(--surface-hover)" : "transparent",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    {f.label} <span style={{ color: "var(--text-muted)" }}>({count})</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Center: rule editor */}
        <main style={{ flex: 1 }}>
          {selectedField ? (
            <>
              <header style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>{selectedField.label}</h2>
                <button type="button" className="s7-btn" onClick={handleAddRule}>
                  + Add rule
                </button>
              </header>
              {selectedRules.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No rules yet. Click “Add rule” to create one.</p>
              ) : (
                <>
                  <nav style={{ display: "flex", gap: 4, marginBottom: 12 }} data-testid="rule-tabs">
                    {selectedRules.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedRuleIndex(i)}
                        style={{
                          padding: "4px 8px",
                          border: "1px solid var(--border)",
                          background: i === selectedRuleIndex ? "var(--surface-hover)" : "transparent",
                          cursor: "pointer"
                        }}
                      >
                        Rule {i + 1}
                      </button>
                    ))}
                  </nav>
                  {selectedRule ? (
                    <RuleEditor
                      rule={selectedRule}
                      fields={allFields}
                      onChange={updateSelectedRule}
                      onDelete={handleDeleteRule}
                    />
                  ) : null}
                </>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Select a field on the left to edit its rules.</p>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function RuleEditor(props: {
  rule: FieldRule;
  fields: LoadedField[];
  onChange: (patch: (rule: FieldRule) => FieldRule) => void;
  onDelete: () => void;
}) {
  const { rule, fields, onChange, onDelete } = props;
  return (
    <section data-testid="rule-editor" style={{ border: "1px solid var(--border)", padding: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label>
          Trigger:
          <select
            value={rule.trigger}
            onChange={(e) =>
              onChange((r) => ({ ...r, trigger: e.target.value as FieldRule["trigger"] }))
            }
            data-testid="trigger-select"
          >
            <option value="on_change">on_change</option>
            <option value="on_load">on_load</option>
            <option value="on_submit">on_submit</option>
          </select>
        </label>
        <button type="button" className="s7-btn" onClick={onDelete}>
          Delete rule
        </button>
      </div>

      <h4 style={{ margin: "12px 0 6px" }}>When</h4>
      <GroupEditor
        group={rule.conditionGroup}
        path={[]}
        fields={fields}
        onChange={(next) => onChange((r) => ({ ...r, conditionGroup: next(r.conditionGroup) }))}
      />

      <h4 style={{ margin: "16px 0 6px" }}>Then</h4>
      <ActionListEditor
        actions={rule.actions}
        onAdd={(type) => onChange((r) => addAction(r, type))}
        onUpdate={(i, patch) => onChange((r) => updateAction(r, i, patch))}
        onRemove={(i) => onChange((r) => removeAction(r, i))}
      />
    </section>
  );
}

function GroupEditor(props: {
  group: ConditionGroup;
  path: number[];
  fields: LoadedField[];
  onChange: (mutator: (root: ConditionGroup) => ConditionGroup) => void;
}) {
  const { group, path, fields, onChange } = props;
  return (
    <div
      data-testid={path.length === 0 ? "group-root" : "group-nested"}
      style={{ border: "1px dashed var(--border)", padding: 8, marginBottom: 8 }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <button
          type="button"
          onClick={() => onChange((root) => toggleLogic(root, path))}
          data-testid={`logic-toggle-${path.join(".")}`}
        >
          {group.logic}
        </button>
        <button
          type="button"
          onClick={() => onChange((root) => addCondition(root, path))}
          data-testid={`add-condition-${path.join(".")}`}
        >
          + condition
        </button>
        <button
          type="button"
          onClick={() => onChange((root) => addNestedGroup(root, path))}
          data-testid={`add-group-${path.join(".")}`}
        >
          + nested group
        </button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {group.conditions.map((child, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {(child as ConditionGroup).conditions !== undefined ? (
              <GroupEditor
                group={child as ConditionGroup}
                path={[...path, i]}
                fields={fields}
                onChange={onChange}
              />
            ) : (
              <ConditionRow
                condition={child as Condition}
                fields={fields}
                onChange={(patch) =>
                  onChange((root) => updateCondition(root, [...path, i], patch))
                }
                onRemove={() => onChange((root) => removeChild(root, path, i))}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConditionRow(props: {
  condition: Condition;
  fields: LoadedField[];
  onChange: (patch: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const { condition, fields, onChange, onRemove } = props;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }} data-testid="condition-row">
      <select
        value={condition.fieldKey}
        onChange={(e) => onChange({ fieldKey: e.target.value })}
      >
        <option value="">— field —</option>
        {fields.map((f) => (
          <option key={f.id} value={f.fieldKey}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value as ConditionOperator })}
      >
        {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={String(condition.value ?? "")}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="value"
      />
      {condition.operator === "between" ? (
        <input
          type="text"
          value={String(condition.value2 ?? "")}
          onChange={(e) => onChange({ value2: e.target.value })}
          placeholder="upper bound"
        />
      ) : null}
      <button type="button" onClick={onRemove} aria-label="Remove condition">
        ✕
      </button>
    </div>
  );
}

function ActionListEditor(props: {
  actions: RuleAction[];
  onAdd: (type: RuleActionType) => void;
  onUpdate: (index: number, patch: Partial<RuleAction>) => void;
  onRemove: (index: number) => void;
}) {
  const { actions, onAdd, onUpdate, onRemove } = props;
  const [pending, setPending] = useState<RuleActionType>("warn");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <select
          value={pending}
          onChange={(e) => setPending(e.target.value as RuleActionType)}
          data-testid="new-action-type"
        >
          {(Object.keys(ACTION_TYPE_LABELS) as RuleActionType[]).map((t) => (
            <option key={t} value={t}>
              {ACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onAdd(pending)} data-testid="add-action">
          + action
        </button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid="action-list">
        {actions.map((a, i) => (
          <li
            key={i}
            style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0" }}
            data-testid={`action-${a.type}`}
          >
            <strong>{ACTION_TYPE_LABELS[a.type]}</strong>
            {a.type === "warn" ? (
              <input
                type="text"
                value={a.warnMessage ?? ""}
                onChange={(e) => onUpdate(i, { warnMessage: e.target.value })}
                placeholder="Warning message"
                style={{ flex: 1 }}
              />
            ) : null}
            {a.type === "block" ? (
              <input
                type="text"
                value={a.blockMessage ?? ""}
                onChange={(e) => onUpdate(i, { blockMessage: e.target.value })}
                placeholder="Block message"
                style={{ flex: 1 }}
              />
            ) : null}
            <button type="button" onClick={() => onRemove(i)} aria-label="Remove action">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
