/**
 * ChargeStepsEditor — card showing how the selected rate table turns a rate
 * into money as a numbered list of plain sentences, not a formula.
 *
 * Layout (within RateTableDetail, between Columns and Rows cards):
 *   - Scenario picker: select a row to drive the running-total preview
 *   - Numbered step list with up/down reorder, running total beside each step
 *   - Steps whose condition is not met render greyed with "not applied"
 *   - "Add step" form below the list
 *   - Collapsed "Show as formula" disclosure (read-only)
 *   - Impact line: open tender count + snapshot note
 *
 * Reference tables (isReference) show an explanation instead of the editor.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import type { ChargeStep, Condition, ConditionCmp } from "../../lib/chargeStepTypes";

// ── Re-exported helpers (tested in ChargeStepsEditor.test.tsx) ────────────

export type { ChargeStep, Condition };

export const KNOWN_OPS = [
  "start",
  "multiply",
  "divide",
  "add",
  "subtract",
  "round",
  "floor",
  "cap"
] as const;

export type StepOp = (typeof KNOWN_OPS)[number];

export const ARITHMETIC_OPS: StepOp[] = ["start", "multiply", "divide", "add", "subtract"];
export const CONDITIONAL_OPS: StepOp[] = ["multiply", "divide", "add", "subtract", "floor", "cap"];
export const CONDITION_CMPS: ConditionCmp[] = ["is", "is not", ">", "<", ">=", "<="];

export type RateColumnMeta = {
  id: string;
  name: string;
  dataType: string;
  role: string;
};

/** Numeric field options for arithmetic operands (excludes TEXT/LIST_REF columns) */
export function numericFieldOptions(columns: RateColumnMeta[]): string[] {
  return columns.filter((c) => c.dataType !== "TEXT" && c.dataType !== "LIST_REF").map((c) => c.name);
}

/** All column names available as condition fields (including text) */
export function allFieldOptions(columns: RateColumnMeta[]): string[] {
  return columns.map((c) => c.name);
}

/** Build a plain-sentence description for one step */
export function stepSentence(step: ChargeStep, index: number): string {
  const prefix = `${index + 1}.`;
  switch (step.op) {
    case "start":
      return `${prefix} Start with ${fieldLabel(step.field)}`;
    case "multiply":
      return `${prefix} Multiply by ${fieldLabel(step.field)}${conditionClause(step.when)}`;
    case "divide":
      return `${prefix} Divide by ${fieldLabel(step.field)}${conditionClause(step.when)}`;
    case "add":
      return `${prefix} Add ${fieldLabel(step.field)}${conditionClause(step.when)}`;
    case "subtract":
      return `${prefix} Subtract ${fieldLabel(step.field)}${conditionClause(step.when)}`;
    case "round":
      return `${prefix} Round ${step.direction} to nearest ${step.interval}`;
    case "floor":
      return `${prefix} Floor at ${step.value}${conditionClause(step.when)}`;
    case "cap":
      return `${prefix} Cap at ${step.value}${conditionClause(step.when)}`;
    default: {
      const _exhaustive: never = step;
      return `${prefix} Unknown step (${String((_exhaustive as { op: string }).op)})`;
    }
  }
}

function fieldLabel(field: string | number): string {
  return typeof field === "number" ? String(field) : field;
}

function conditionClause(when?: Condition): string {
  if (!when) return "";
  return ` when ${when.field} ${when.cmp} ${when.value}`;
}

/** Build a read-only formula string from the full step list */
export function stepsToFormula(steps: ChargeStep[]): string {
  if (steps.length === 0) return "(empty)";
  const parts: string[] = [];
  for (const step of steps) {
    switch (step.op) {
      case "start":
        parts.push(fieldLabel(step.field));
        break;
      case "multiply":
        parts.push(
          step.when
            ? `× IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${fieldLabel(step.field)}, 1)`
            : `× ${fieldLabel(step.field)}`
        );
        break;
      case "divide":
        parts.push(
          step.when
            ? `÷ IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${fieldLabel(step.field)}, 1)`
            : `÷ ${fieldLabel(step.field)}`
        );
        break;
      case "add":
        parts.push(
          step.when
            ? `+ IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${fieldLabel(step.field)}, 0)`
            : `+ ${fieldLabel(step.field)}`
        );
        break;
      case "subtract":
        parts.push(
          step.when
            ? `− IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${fieldLabel(step.field)}, 0)`
            : `− ${fieldLabel(step.field)}`
        );
        break;
      case "round":
        parts.push(`[round ${step.direction} to ${step.interval}]`);
        break;
      case "floor":
        parts.push(
          step.when
            ? `max(·, IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${step.value}, ·))`
            : `max(·, ${step.value})`
        );
        break;
      case "cap":
        parts.push(
          step.when
            ? `min(·, IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${step.value}, ·))`
            : `min(·, ${step.value})`
        );
        break;
    }
  }
  return parts.join(" ");
}

/** Client-side validation of a step list (mirrors the server rules). */
export type StepValidationError = { index: number; message: string };

export function validateSteps(
  steps: ChargeStep[],
  columnNames: string[]
): StepValidationError[] {
  const errors: StepValidationError[] = [];
  const colSet = new Set(columnNames);

  if (steps.length === 0) return errors;

  if (steps[0].op !== "start") {
    errors.push({ index: 0, message: 'First step must have op "start".' });
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (ARITHMETIC_OPS.includes(step.op as StepOp)) {
      const field = (step as { field?: string | number }).field;
      if (field === undefined) {
        errors.push({ index: i, message: '"field" is required.' });
      } else if (typeof field === "string" && !colSet.has(field)) {
        errors.push({ index: i, message: `Field "${field}" is not a column on this table.` });
      }
    }

    const when = (step as { when?: Condition }).when;
    if (when) {
      if (typeof when.field === "string" && !colSet.has(when.field)) {
        errors.push({
          index: i,
          message: `Condition field "${when.field}" is not a column on this table.`
        });
      }
    }
  }
  return errors;
}

/** Evaluate steps against a values map and return per-step running totals. */
export function evaluateStepsClient(
  steps: ChargeStep[],
  values: Record<string, number | string>
): Array<{ runningTotal: number | null; skipped: boolean }> {
  const result: Array<{ runningTotal: number | null; skipped: boolean }> = [];
  let running: number = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const condOk = checkCondition((step as { when?: Condition }).when, values);

    if (!condOk) {
      result.push({ runningTotal: running, skipped: true });
      continue;
    }

    try {
      switch (step.op) {
        case "start": {
          const val = resolveNum(step.field, values);
          running = val ?? 0;
          break;
        }
        case "multiply": {
          const val = resolveNum(step.field, values);
          if (val !== null) running *= val;
          break;
        }
        case "divide": {
          const val = resolveNum(step.field, values);
          if (val !== null && val !== 0) running /= val;
          break;
        }
        case "add": {
          const val = resolveNum(step.field, values);
          if (val !== null) running += val;
          break;
        }
        case "subtract": {
          const val = resolveNum(step.field, values);
          if (val !== null) running -= val;
          break;
        }
        case "round":
          if (step.direction === "nearest") running = Math.round(running / step.interval) * step.interval;
          else if (step.direction === "up") running = Math.ceil(running / step.interval) * step.interval;
          else running = Math.floor(running / step.interval) * step.interval;
          break;
        case "floor":
          running = Math.max(running, step.value);
          break;
        case "cap":
          running = Math.min(running, step.value);
          break;
      }
      result.push({ runningTotal: running, skipped: false });
    } catch {
      result.push({ runningTotal: null, skipped: false });
    }
  }
  return result;
}

function resolveNum(
  field: string | number,
  values: Record<string, number | string>
): number | null {
  if (typeof field === "number") return field;
  const val = values[field];
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function checkCondition(
  when: Condition | undefined,
  values: Record<string, number | string>
): boolean {
  if (!when) return true;
  const lhs = values[when.field];
  const rhs = when.value;
  switch (when.cmp) {
    case "is": return lhs === rhs || String(lhs) === String(rhs);
    case "is not": return lhs !== rhs && String(lhs) !== String(rhs);
    case ">": return Number(lhs) > Number(rhs);
    case "<": return Number(lhs) < Number(rhs);
    case ">=": return Number(lhs) >= Number(rhs);
    case "<=": return Number(lhs) <= Number(rhs);
    default: return true;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

type RateRowShape = {
  id: string;
  cells: Record<string, unknown>;
};

export function ChargeStepsEditor({
  tableId,
  tableName,
  isReference,
  columns,
  rows,
  onSaved
}: {
  tableId: string;
  tableName: string;
  isReference: boolean;
  columns: RateColumnMeta[];
  rows: RateRowShape[];
  onSaved?: () => void;
}) {
  const { authFetch } = useAuth();
  const [steps, setSteps] = useState<ChargeStep[]>([]);
  const [openTenderCount, setOpenTenderCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarioRowId, setScenarioRowId] = useState<string>("");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/rates/tables/${tableId}/charge-steps`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load charge steps."));
      const body = (await res.json()) as { chargeSteps: ChargeStep[] | null; openTenderCount: number };
      setSteps(body.chargeSteps ?? []);
      setOpenTenderCount(body.openTenderCount);
      setDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tableId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pick first row as scenario when rows load
  useEffect(() => {
    if (rows.length > 0 && !scenarioRowId) {
      setScenarioRowId(rows[0].id);
    }
  }, [rows, scenarioRowId]);

  // ── Scenario values ───────────────────────────────────────────────────

  const scenarioValues = useMemo<Record<string, number | string>>(() => {
    const row = rows.find((r) => r.id === scenarioRowId);
    if (!row) return {};
    const out: Record<string, number | string> = {};
    for (const col of columns) {
      const raw = row.cells[col.id];
      if (raw === null || raw === undefined) continue;
      out[col.name] = typeof raw === "number" ? raw : String(raw);
    }
    return out;
  }, [rows, scenarioRowId, columns]);

  // ── Running totals ────────────────────────────────────────────────────

  const trail = useMemo(
    () => evaluateStepsClient(steps, scenarioValues),
    [steps, scenarioValues]
  );

  // ── Validation ────────────────────────────────────────────────────────

  const columnNames = useMemo(() => columns.map((c) => c.name), [columns]);
  const validationErrors = useMemo(() => validateSteps(steps, columnNames), [steps, columnNames]);

  const canSave = dirty && validationErrors.length === 0 && steps.length > 0;

  // ── Mutators ──────────────────────────────────────────────────────────

  const updateSteps = (next: ChargeStep[]) => {
    setSteps(next);
    setDirty(true);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...steps];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    updateSteps(next);
  };

  const moveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const next = [...steps];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    updateSteps(next);
  };

  const removeStep = (index: number) => {
    updateSteps(steps.filter((_, i) => i !== index));
  };

  const addStep = (step: ChargeStep) => {
    updateSteps([...steps, step]);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/rates/tables/${tableId}/charge-steps`, {
        method: "PATCH",
        body: JSON.stringify({ steps })
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "Save failed."));
      setDirty(false);
      onSaved?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Reference table guard ─────────────────────────────────────────────

  if (isReference) {
    return (
      <div className="s7-card">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Charge steps</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          This is a reference table — its values are factors and quantities, not prices.
          Charge steps apply to rate tables whose VALUE columns produce a monetary amount.
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────

  const numericCols = numericFieldOptions(columns);
  const allCols = allFieldOptions(columns);
  const formula = stepsToFormula(steps);

  return (
    <div className="s7-card" data-testid="charge-steps-editor">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Charge steps</h3>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {dirty ? (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Unsaved changes</span>
          ) : null}
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            disabled={!canSave || saving}
            onClick={() => void save()}
            style={{ minHeight: 36 }}
          >
            {saving ? "Saving…" : "Save steps"}
          </button>
        </div>
      </div>

      {/* Impact line */}
      {openTenderCount !== null ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginBottom: 12,
            padding: "6px 10px",
            background: "var(--surface-raised, #f8fafc)",
            borderRadius: 6
          }}
        >
          {openTenderCount === 0
            ? "No open tenders price against this table."
            : `${openTenderCount} tender${openTenderCount === 1 ? "" : "s"} price against this table — a change applies to new lines only; tenders with locked rates keep their snapshot.`}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: 10,
            borderRadius: 6,
            background: "rgba(239,68,68,0.08)",
            borderLeft: "3px solid var(--status-danger, #ef4444)",
            color: "var(--status-danger, #ef4444)",
            fontSize: 13,
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 8
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Scenario picker */}
      {rows.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Preview with row:
          </label>
          <select
            className="s7-select"
            value={scenarioRowId}
            onChange={(e) => setScenarioRowId(e.target.value)}
            style={{ fontSize: 12, minHeight: 32 }}
            aria-label="Scenario row for running-total preview"
          >
            {rows.map((r, i) => (
              <option key={r.id} value={r.id}>
                Row {i + 1}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Add rows to this table to preview running totals against real values.
        </p>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 ? (
        <div
          style={{
            padding: 8,
            borderRadius: 6,
            background: "rgba(239,68,68,0.08)",
            borderLeft: "3px solid var(--status-danger, #ef4444)",
            fontSize: 12,
            marginBottom: 12
          }}
        >
          {validationErrors.map((ve) => (
            <div key={ve.index}>
              Step {ve.index + 1}: {ve.message}
            </div>
          ))}
        </div>
      ) : null}

      {/* Step list */}
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : steps.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No steps yet. Add a &ldquo;start&rdquo; step below to begin.
        </p>
      ) : (
        <ol
          style={{ margin: "0 0 12px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}
          aria-label="Charge step list"
        >
          {steps.map((step, i) => {
            const trailEntry = trail[i];
            const skipped = trailEntry?.skipped ?? false;
            const runningTotal = trailEntry?.runningTotal ?? null;
            const valError = validationErrors.find((e) => e.index === i);

            return (
              <li
                key={i}
                data-testid={`step-row-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: skipped
                    ? "rgba(148,163,184,0.07)"
                    : valError
                      ? "rgba(239,68,68,0.06)"
                      : "var(--surface-raised, #f8fafc)",
                  opacity: skipped ? 0.6 : 1,
                  border: valError
                    ? "1px solid rgba(239,68,68,0.25)"
                    : "1px solid var(--border, #e5e7eb)"
                }}
              >
                {/* Up/Down */}
                <span style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
                  <button
                    type="button"
                    aria-label={`Move step ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => moveUp(i)}
                    style={reorderBtnStyle}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === steps.length - 1}
                    onClick={() => moveDown(i)}
                    style={reorderBtnStyle}
                  >
                    ▼
                  </button>
                </span>

                {/* Sentence */}
                <span style={{ flex: 1, fontSize: 13 }}>
                  {stepSentence(step, i)}
                  {skipped ? (
                    <span
                      style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}
                    >
                      not applied
                    </span>
                  ) : null}
                </span>

                {/* Running total */}
                {runningTotal !== null ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 60,
                      textAlign: "right"
                    }}
                    title="Running total after this step"
                  >
                    = {formatTotal(runningTotal)}
                  </span>
                ) : null}

                {/* Remove */}
                <button
                  type="button"
                  aria-label={`Remove step ${i + 1}`}
                  onClick={() => removeStep(i)}
                  style={removeBtnStyle}
                  data-testid={`remove-step-${i}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* Add step form */}
      <AddStepForm
        numericCols={numericCols}
        allCols={allCols}
        onAdd={addStep}
      />

      {/* Formula disclosure */}
      <details
        open={formulaOpen}
        onToggle={(e) => setFormulaOpen((e.target as HTMLDetailsElement).open)}
        style={{ marginTop: 12 }}
      >
        <summary
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          Show this as a formula
        </summary>
        <div
          style={{
            marginTop: 6,
            padding: "8px 10px",
            background: "var(--surface-raised, #f8fafc)",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
            wordBreak: "break-all",
            color: "var(--text)"
          }}
          aria-label="Formula view"
        >
          {formula}
        </div>
      </details>
    </div>
  );
}

// ── AddStepForm ───────────────────────────────────────────────────────────

function AddStepForm({
  numericCols,
  allCols,
  onAdd
}: {
  numericCols: string[];
  allCols: string[];
  onAdd: (step: ChargeStep) => void;
}) {
  const [op, setOp] = useState<StepOp>("start");
  const [fieldMode, setFieldMode] = useState<"column" | "number">("column");
  const [fieldCol, setFieldCol] = useState(numericCols[0] ?? "");
  const [fieldNum, setFieldNum] = useState("");
  const [direction, setDirection] = useState<"nearest" | "up" | "down">("nearest");
  const [interval, setIntervalVal] = useState("1");
  const [fixedValue, setFixedValue] = useState("");
  const [hasCondition, setHasCondition] = useState(false);
  const [condField, setCondField] = useState(allCols[0] ?? "");
  const [condCmp, setCondCmp] = useState<ConditionCmp>("is");
  const [condValue, setCondValue] = useState("");

  const needsField = ARITHMETIC_OPS.includes(op);
  const needsRound = op === "round";
  const needsFixed = op === "floor" || op === "cap";
  const canHaveCond = CONDITIONAL_OPS.includes(op);

  const canAdd = (() => {
    if (needsField) {
      if (fieldMode === "column" && !fieldCol) return false;
      if (fieldMode === "number") {
        const n = Number(fieldNum);
        if (fieldNum.trim() === "" || isNaN(n)) return false;
      }
    }
    if (needsRound) {
      const n = Number(interval);
      if (interval.trim() === "" || isNaN(n) || n <= 0) return false;
    }
    if (needsFixed) {
      if (fixedValue.trim() === "" || isNaN(Number(fixedValue))) return false;
    }
    if (hasCondition) {
      if (!condField || !condValue.trim()) return false;
    }
    return true;
  })();

  const handleAdd = () => {
    if (!canAdd) return;

    const field: string | number =
      fieldMode === "number" ? Number(fieldNum) : fieldCol;

    const when: Condition | undefined =
      hasCondition && canHaveCond
        ? { field: condField, cmp: condCmp, value: isNaN(Number(condValue)) ? condValue : Number(condValue) }
        : undefined;

    let step: ChargeStep;
    if (needsRound) {
      step = { op: "round", direction, interval: Number(interval) };
    } else if (op === "floor") {
      step = when ? { op: "floor", value: Number(fixedValue), when } : { op: "floor", value: Number(fixedValue) };
    } else if (op === "cap") {
      step = when ? { op: "cap", value: Number(fixedValue), when } : { op: "cap", value: Number(fixedValue) };
    } else if (op === "start") {
      step = { op: "start", field };
    } else if (op === "multiply") {
      step = when ? { op: "multiply", field, when } : { op: "multiply", field };
    } else if (op === "divide") {
      step = when ? { op: "divide", field, when } : { op: "divide", field };
    } else if (op === "add") {
      step = when ? { op: "add", field, when } : { op: "add", field };
    } else {
      step = when ? { op: "subtract", field, when } : { op: "subtract", field };
    }

    onAdd(step);

    // Reset condition but keep op for convenience
    setHasCondition(false);
    setCondValue("");
    setFieldNum("");
    setFixedValue("");
  };

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 6,
        border: "1px dashed var(--border, #e5e7eb)",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
      data-testid="add-step-form"
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Add step</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        {/* Op selector */}
        <label style={fieldLabelStyle}>
          <span style={labelTextStyle}>Operation</span>
          <select
            className="s7-select"
            value={op}
            onChange={(e) => setOp(e.target.value as StepOp)}
            style={selectStyle}
            aria-label="Step operation"
          >
            {KNOWN_OPS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>

        {/* Field operand (for arithmetic ops) */}
        {needsField ? (
          <>
            <label style={fieldLabelStyle}>
              <span style={labelTextStyle}>Mode</span>
              <select
                className="s7-select"
                value={fieldMode}
                onChange={(e) => setFieldMode(e.target.value as "column" | "number")}
                style={selectStyle}
                aria-label="Field input mode"
              >
                <option value="column">Column</option>
                <option value="number">Number</option>
              </select>
            </label>
            {fieldMode === "column" ? (
              <label style={fieldLabelStyle}>
                <span style={labelTextStyle}>Column</span>
                <select
                  className="s7-select"
                  value={fieldCol}
                  onChange={(e) => setFieldCol(e.target.value)}
                  style={selectStyle}
                  aria-label="Field column"
                >
                  {numericCols.length === 0 ? (
                    <option value="">— no numeric columns —</option>
                  ) : (
                    numericCols.map((c) => <option key={c} value={c}>{c}</option>)
                  )}
                </select>
              </label>
            ) : (
              <label style={fieldLabelStyle}>
                <span style={labelTextStyle}>Value</span>
                <input
                  className="s7-input"
                  type="number"
                  value={fieldNum}
                  onChange={(e) => setFieldNum(e.target.value)}
                  style={{ ...selectStyle, width: 80 }}
                  aria-label="Numeric literal"
                />
              </label>
            )}
          </>
        ) : null}

        {/* Round controls */}
        {needsRound ? (
          <>
            <label style={fieldLabelStyle}>
              <span style={labelTextStyle}>Direction</span>
              <select
                className="s7-select"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "nearest" | "up" | "down")}
                style={selectStyle}
                aria-label="Round direction"
              >
                <option value="nearest">Nearest</option>
                <option value="up">Up</option>
                <option value="down">Down</option>
              </select>
            </label>
            <label style={fieldLabelStyle}>
              <span style={labelTextStyle}>Interval</span>
              <input
                className="s7-input"
                type="number"
                value={interval}
                onChange={(e) => setIntervalVal(e.target.value)}
                style={{ ...selectStyle, width: 80 }}
                aria-label="Round interval"
                min={0.0001}
                step="any"
              />
            </label>
          </>
        ) : null}

        {/* Fixed value (floor/cap) */}
        {needsFixed ? (
          <label style={fieldLabelStyle}>
            <span style={labelTextStyle}>Value</span>
            <input
              className="s7-input"
              type="number"
              value={fixedValue}
              onChange={(e) => setFixedValue(e.target.value)}
              style={{ ...selectStyle, width: 80 }}
              aria-label="Fixed value"
              step="any"
            />
          </label>
        ) : null}
      </div>

      {/* Condition toggle */}
      {canHaveCond ? (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hasCondition}
            onChange={(e) => setHasCondition(e.target.checked)}
            aria-label="Add condition"
          />
          Add condition (only apply this step when…)
        </label>
      ) : null}

      {/* Condition fields */}
      {hasCondition && canHaveCond ? (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", paddingLeft: 16 }}
          data-testid="condition-fields"
        >
          <label style={fieldLabelStyle}>
            <span style={labelTextStyle}>Field</span>
            <select
              className="s7-select"
              value={condField}
              onChange={(e) => setCondField(e.target.value)}
              style={selectStyle}
              aria-label="Condition field"
            >
              {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={fieldLabelStyle}>
            <span style={labelTextStyle}>Is</span>
            <select
              className="s7-select"
              value={condCmp}
              onChange={(e) => setCondCmp(e.target.value as ConditionCmp)}
              style={selectStyle}
              aria-label="Condition comparator"
            >
              {CONDITION_CMPS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={fieldLabelStyle}>
            <span style={labelTextStyle}>Value</span>
            <input
              className="s7-input"
              value={condValue}
              onChange={(e) => setCondValue(e.target.value)}
              style={{ ...selectStyle, width: 100 }}
              aria-label="Condition value"
            />
          </label>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={!canAdd}
          onClick={handleAdd}
          style={{ minHeight: 36 }}
          data-testid="add-step-btn"
        >
          + Add step
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const reorderBtnStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 9,
  color: "var(--text-muted)",
  padding: "0 2px",
  lineHeight: 1
};

const removeBtnStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  color: "var(--text-muted)",
  padding: "0 4px",
  lineHeight: 1
};

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2
};

const labelTextStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)"
};

const selectStyle: CSSProperties = {
  fontSize: 12,
  minHeight: 32
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTotal(n: number): string {
  // Plain measurement — no $ sign, to nearest 4dp
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/\.?0+$/, "");
}
