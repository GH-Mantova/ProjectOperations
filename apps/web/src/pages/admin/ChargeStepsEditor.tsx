/**
 * ChargeStepsEditor — card showing how the selected rate table turns a rate
 * into money as a numbered list of plain sentences, not a formula.
 *
 * Layout (within RateTableDetail, between Columns and Rows cards):
 *   - Scenario picker: select a row to drive the running-total preview
 *   - Numbered step list with up/down reorder, running total beside each step
 *   - Steps whose condition is not met render greyed with "not applied"
 *   - CHARGE_STEP_PARITY_V1: the preview runs the SAME evaluator as the server
 *     (`@project-ops/config/charge-step-semantics`), so it cannot show a price
 *     the server would not produce. A step that cannot be worked out shows the
 *     reason in place of a running total — never a plausible-looking figure.
 *   - CHARGE_STEP_CARD_V2: the list closes with a LINE TOTAL row, and every
 *     figure on the card is presented the way the rows table presents a cell —
 *     two decimal places, the operand column's unit while the total is still a
 *     measurement, and en-AU dollars from the step where a CURRENCY column
 *     first enters the sum. Presentation only: what the card computes is
 *     CHARGE_STEP_PARITY_V1's and is untouched here.
 *   - "Add step" form below the list
 *   - Collapsed "Show as formula" disclosure (read-only)
 *   - Impact line: open tender count + snapshot note
 *
 * Reference tables (isReference) show an explanation instead of the editor.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  describeChargeStepIssue,
  evaluateChargeSteps,
  type ChargeStepTrailEntry
} from "@project-ops/config/charge-step-semantics";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import type { ChargeStep, Condition, ConditionCmp } from "../../lib/chargeStepTypes";

// ── Re-exported helpers (tested in ChargeStepsEditor.test.tsx) ────────────

export type { ChargeStep, Condition };
export type { ChargeStepIssue, ChargeStepTrailEntry } from "@project-ops/config/charge-step-semantics";

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

/**
 * CHARGE_STEP_CARD_V2 — how an op and a comparator are SPOKEN. Label only: the
 * stored `op` and `cmp` values are the keys above and are what the `<option>`
 * value attributes carry, so nothing about a saved step changes.
 */
export const OP_LABELS: Record<StepOp, string> = {
  start: "Start with",
  multiply: "Multiply by",
  divide: "Divide by",
  add: "Add",
  subtract: "Subtract",
  round: "Round",
  floor: "Never less than",
  cap: "Never more than"
};

export const CMP_LABELS: Record<ConditionCmp, string> = {
  is: "is",
  "is not": "is not",
  ">": "is more than",
  "<": "is less than",
  ">=": "is at least",
  "<=": "is at most"
};

export type RateColumnMeta = {
  id: string;
  name: string;
  dataType: string;
  role: string;
  /**
   * CHARGE_STEP_CARD_V2 — unit of measure ("mm", "m2"), when the column has
   * one. The card needs it to say what a running total is measured in. Null
   * as well as absent, because that is how `RateColumn` carries "no unit".
   */
  unit?: string | null;
};

/** Numeric field options for arithmetic operands (excludes TEXT/LIST_REF columns) */
export function numericFieldOptions(columns: RateColumnMeta[]): string[] {
  return columns.filter((c) => c.dataType !== "TEXT" && c.dataType !== "LIST_REF").map((c) => c.name);
}

/** All column names available as condition fields (including text) */
export function allFieldOptions(columns: RateColumnMeta[]): string[] {
  return columns.map((c) => c.name);
}

// ── CHARGE_STEP_CARD_V2: what a running total IS ──────────────────────────

/**
 * How one figure on the card should be presented.
 *
 * The rule, in one sentence: a running total is only money once a price has
 * entered it — before that it is still a measurement, and showing it as
 * dollars misleads.
 */
export type TotalPresentation = { money: boolean; unit?: string };

/** A plain, unitless measurement — the presentation before any step runs. */
export const MEASUREMENT: TotalPresentation = { money: false };

/**
 * Presentation for the running total after each step, in step order.
 *
 * `money` turns on at the step where a CURRENCY column first enters the sum
 * and stays on. `unit` is the unit the figure is still measured in: `start`
 * takes it from its operand column, `round` / `floor` / `cap` keep it (they do
 * not change what the total measures), and any operand that changes the
 * dimension drops it — a depth times a rate is no longer a depth.
 *
 * The trail is read for one thing only: `skipped`. A step that did not run put
 * nothing into the sum, so a skipped multiply by a price does not make the
 * total money. NO ARITHMETIC HAPPENS HERE — the figures are
 * CHARGE_STEP_PARITY_V1's, and this decides only how they are written down.
 */
export function stepTotalPresentations(
  steps: ChargeStep[],
  columns: RateColumnMeta[],
  trail: ChargeStepTrailEntry[]
): TotalPresentation[] {
  const byName = new Map(columns.map((c) => [c.name, c]));
  const operandColumn = (field: string | number): RateColumnMeta | undefined =>
    typeof field === "string" ? byName.get(field) : undefined;

  let money = false;
  let unit: string | undefined;
  const out: TotalPresentation[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (trail[i]?.skipped) {
      out.push({ money, unit });
      continue;
    }

    switch (step.op) {
      case "start": {
        // `start` seeds the total, so it also resets what the total IS.
        const col = operandColumn(step.field);
        money = col?.dataType === "CURRENCY";
        unit = money ? undefined : (col?.unit ?? undefined);
        break;
      }
      case "add":
      case "subtract": {
        const col = operandColumn(step.field);
        if (col?.dataType === "CURRENCY") {
          money = true;
          unit = undefined;
        } else if (col && (col.unit ?? undefined) !== unit) {
          // Adding a different measure: the sum is in neither unit.
          unit = undefined;
        }
        break;
      }
      case "multiply":
      case "divide": {
        const col = operandColumn(step.field);
        if (col?.dataType === "CURRENCY") {
          money = true;
          unit = undefined;
        } else if (col) {
          // A product or quotient of two quantities is measured in neither.
          unit = undefined;
        }
        // A numeric literal is dimensionless and leaves the unit alone.
        break;
      }
      case "round":
      case "floor":
      case "cap":
        break;
    }

    out.push({ money, unit });
  }

  return out;
}

/**
 * en-AU dollars — the same formatter `renderCellDisplay` uses for a CURRENCY
 * cell in `RatesListsAdminPage`, so the card and the rows table below it never
 * disagree about what a dollar looks like.
 */
const MONEY_FORMAT = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

/**
 * Write one figure the way the card shows it: dollars once a price has entered
 * the sum, otherwise a plain measurement to two decimal places carrying its
 * unit. Whole numbers keep their whole-number form ("18 mm", not "18.00 mm").
 */
export function formatStepTotal(value: number, presentation: TotalPresentation): string {
  if (presentation.money) return MONEY_FORMAT.format(value);
  const figure = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return presentation.unit ? `${figure} ${presentation.unit}` : figure;
}

/** The label on the row that closes the step list. */
export const LINE_TOTAL_LABEL = "LINE TOTAL";

/** Shown in place of the line total when a step above could not be worked out. */
export const LINE_TOTAL_UNKNOWN = "No total — a step above could not be worked out";

/**
 * The running total's name inside the formula view. The shipped card used a
 * middle dot, which no spreadsheet accepts as an operand.
 */
export const FORMULA_TOTAL = "TOTAL";

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
      return `${prefix} ${roundPhrase(step.direction, step.interval)}`;
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

/**
 * CHARGE_STEP_CARD_V2 — directional round wording. "Round up to nearest 10"
 * contradicts itself: rounding up does not go to the nearest anything.
 */
function roundPhrase(direction: "nearest" | "up" | "down", interval: number): string {
  switch (direction) {
    case "up":
      return `Round up to the next ${interval}`;
    case "down":
      return `Round down to the last ${interval}`;
    default:
      return `Round to the nearest ${interval}`;
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
      case "round": {
        // Real spreadsheet functions: the disclosure exists so an estimator can
        // read the rule as arithmetic, and `[round up to 10]` is not arithmetic.
        const fn =
          step.direction === "up" ? "ROUNDUP" : step.direction === "down" ? "ROUNDDOWN" : "ROUND";
        parts.push(`${fn}(${FORMULA_TOTAL}, ${step.interval})`);
        break;
      }
      case "floor":
        parts.push(
          step.when
            ? `MAX(${FORMULA_TOTAL}, IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${step.value}, ${FORMULA_TOTAL}))`
            : `MAX(${FORMULA_TOTAL}, ${step.value})`
        );
        break;
      case "cap":
        parts.push(
          step.when
            ? `MIN(${FORMULA_TOTAL}, IF(${step.when.field} ${step.when.cmp} ${step.when.value}, ${step.value}, ${FORMULA_TOTAL}))`
            : `MIN(${FORMULA_TOTAL}, ${step.value})`
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

/**
 * Evaluate steps against a values map and return the per-step trail.
 *
 * CHARGE_STEP_PARITY_V1 — this is a thin call into
 * `@project-ops/config/charge-step-semantics`, the same function the server
 * evaluator (`apps/api/src/modules/rates/rate-step-evaluator.ts`) calls. The
 * preview cannot show a number the server would not produce, and a step that
 * cannot be worked out carries an `issue` and a `runningTotal` of `null`
 * instead of a plausible-looking figure.
 */
export function evaluateStepsClient(
  steps: ChargeStep[],
  values: Record<string, number | string>
): ChargeStepTrailEntry[] {
  return evaluateChargeSteps(steps, values).trail;
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

  // ── CHARGE_STEP_CARD_V2: presentation of those totals ─────────────────
  // How each figure is written down. The figures themselves come from the
  // trail above and are not recomputed here.

  const presentations = useMemo(
    () => stepTotalPresentations(steps, columns, trail),
    [steps, columns, trail]
  );

  // The line total IS the last running total — read from the trail, never
  // summed a second time.
  const lineTotal = trail.length > 0 ? trail[trail.length - 1].runningTotal : null;
  const lineTotalPresentation = presentations[presentations.length - 1] ?? MEASUREMENT;

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
            const stepIssue = trailEntry?.issue ?? null;
            const valError = validationErrors.find((e) => e.index === i);
            const tinted = stepIssue !== null || valError !== undefined;

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
                    : tinted
                      ? "rgba(239,68,68,0.06)"
                      : "var(--surface-raised, #f8fafc)",
                  opacity: skipped ? 0.6 : 1,
                  border: tinted
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

                {/* Why this step could not be worked out — shown instead of a
                    running total, so the editor never prints a figure the
                    server would not produce. */}
                {stepIssue ? (
                  <span
                    role="note"
                    data-testid={`step-issue-${i}`}
                    style={{
                      fontSize: 11,
                      color: "var(--status-danger, #ef4444)",
                      textAlign: "right",
                      maxWidth: 260
                    }}
                  >
                    {describeChargeStepIssue(stepIssue)}
                  </span>
                ) : null}

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
                    = {formatStepTotal(runningTotal, presentations[i] ?? MEASUREMENT)}
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

      {/* CHARGE_STEP_CARD_V2 — the number the card exists to produce. It is
          the last entry of the trail above; when that entry has no number,
          the row says so rather than printing a figure nobody can stand
          behind. */}
      {!loading && steps.length > 0 ? (
        <div style={lineTotalRowStyle} data-testid="line-total">
          <span style={lineTotalLabelStyle}>{LINE_TOTAL_LABEL}</span>
          {lineTotal === null ? (
            <span role="note" data-testid="line-total-value" style={lineTotalUnknownStyle}>
              {LINE_TOTAL_UNKNOWN}
            </span>
          ) : (
            <span data-testid="line-total-value" style={lineTotalValueStyle}>
              {formatStepTotal(lineTotal, lineTotalPresentation)}
            </span>
          )}
        </div>
      ) : null}

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
              <option key={o} value={o}>{OP_LABELS[o]}</option>
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
              {CONDITION_CMPS.map((c) => (
                <option key={c} value={c}>{CMP_LABELS[c]}</option>
              ))}
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

// CHARGE_STEP_CARD_V2 — the row that closes the step list. Colours come from
// real tokens in apps/web/src/styles/tokens.css, so the row flips with the
// theme instead of relying on a light-only fallback.

const lineTotalRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 10px",
  margin: "0 0 12px",
  borderRadius: 6,
  borderTop: "2px solid var(--border-default)",
  background: "var(--surface-subtle)"
};

const lineTotalLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: "var(--text-muted)"
};

const lineTotalValueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
  color: "var(--text-primary)"
};

const lineTotalUnknownStyle: CSSProperties = {
  fontSize: 12,
  textAlign: "right",
  color: "var(--status-danger)"
};
