/**
 * ChargeStepsEditor — card showing how the selected rate table turns a rate
 * into money as a numbered list of plain sentences, not a formula.
 *
 * Layout (within RateTableDetail, between Columns and Rows cards):
 *   - Scenario picker: select a row to drive the running-total preview
 *   - Numbered step list: each step is a four-part row — number, body,
 *     running total, actions — and the body holds live controls
 *   - Steps whose condition is not met render greyed
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
 *   - CHARGE_STEP_GUARDS_V1: step 1 is pinned. A reorder into slot 0 keeps
 *     `start` there, step 1 has no remove control (and `removeStep` refuses
 *     index 0), and a non-empty list is never offered a second `start`. The
 *     validation rules are untouched — the state they reject is simply no
 *     longer reachable from the card.
 *   - RATE_LINE_FIELDS_V1: a step may name a LINE FIELD — a value the estimator
 *     enters on the line — as well as a rate-table column. Both kinds land in
 *     ONE values map, built by `buildStepValues` in the shared semantics module
 *     so the preview and the server cannot disagree about what a name resolves
 *     to. They are offered in the operand picker below and previewed from
 *     their declared `sample`; declaring one and the real scenario inputs are
 *     slices 3 and 4.
 *   - CHARGE_STEP_INPLACE_V1: the step row IS the editor. A saved step used to
 *     render as a read-only sentence, and the only way to change one was to
 *     remove every step below it and retype them in order — which is why a
 *     three-times-a-year edit was the riskiest thing this card could be asked
 *     to do. Now every control writes straight into the step at that index
 *     through `replaceStepAt`, and one OPERAND PICKER offers both kinds of
 *     field — rate-table columns and estimate-line fields, grouped and
 *     labelled so a reader can tell which is which — plus `a number…` for a
 *     literal. The condition is a pill on the row. There is no add-step form:
 *     `+ Add a step` appends a step in the same shape every row already edits,
 *     so there is exactly one implementation of each control. The step-1
 *     guards are expressed in those controls rather than duplicated beside
 *     them, and neither validation rule moved.
 *   - "+ Add a step" button below the list
 *   - Collapsed "Show as formula" disclosure (read-only)
 *   - Impact line: open tender count + snapshot note
 *
 * Reference tables (isReference) show an explanation instead of the editor.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  buildStepValues,
  describeChargeStepIssue,
  evaluateChargeSteps,
  numericLineFieldNames,
  textLineFieldNames,
  type ChargeStepTrailEntry,
  type RateLineField
} from "@project-ops/config/charge-step-semantics";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import type { ChargeStep, Condition, ConditionCmp } from "../../lib/chargeStepTypes";

// ── Re-exported helpers (tested in ChargeStepsEditor.test.tsx) ────────────

export type { ChargeStep, Condition };
export type {
  ChargeStepIssue,
  ChargeStepTrailEntry,
  RateLineField
} from "@project-ops/config/charge-step-semantics";

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

/**
 * Names an arithmetic operand may use.
 *
 * RATE_LINE_FIELDS_V1 — a step operand names a value, and a value comes either
 * from the rate table (a column) or from the estimate line (a line field). Both
 * are offered here; text is offered by neither, which is the rule this function
 * already applied to TEXT and LIST_REF columns and now applies to a `text` line
 * field as well.
 */
export function numericFieldOptions(
  columns: RateColumnMeta[],
  lineFields: readonly RateLineField[] = []
): string[] {
  return [
    ...columns.filter((c) => c.dataType !== "TEXT" && c.dataType !== "LIST_REF").map((c) => c.name),
    ...numericLineFieldNames(lineFields)
  ];
}

/**
 * Every name available as a CONDITION field — columns and line fields alike,
 * text included, because "only when Elevation is Inverted" is exactly what a
 * text field is for.
 */
export function allFieldOptions(
  columns: RateColumnMeta[],
  lineFields: readonly RateLineField[] = []
): string[] {
  return [
    ...columns.map((c) => c.name),
    ...numericLineFieldNames(lineFields),
    ...textLineFieldNames(lineFields)
  ];
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
  /** Every name a step may use anywhere: columns plus declared line fields. */
  columnNames: string[],
  /**
   * RATE_LINE_FIELDS_V1 — the subset of those names that is TEXT, so it may be
   * used in a condition but never in the sum. Mirrors the server rule in
   * `rate-tables.service.ts`, including keeping the two messages distinct.
   */
  textFieldNames: string[] = []
): StepValidationError[] {
  const errors: StepValidationError[] = [];
  const colSet = new Set(columnNames);
  const textSet = new Set(textFieldNames);

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
        errors.push({
          index: i,
          message: `Field "${field}" is not a column or line field on this table.`
        });
      } else if (typeof field === "string" && textSet.has(field)) {
        errors.push({
          index: i,
          message: `Field "${field}" is text, so it can only be used in an "only when" condition, not in the sum.`
        });
      }
    }

    const when = (step as { when?: Condition }).when;
    if (when) {
      if (typeof when.field === "string" && !colSet.has(when.field)) {
        errors.push({
          index: i,
          message: `Condition field "${when.field}" is not a column or line field on this table.`
        });
      }
    }
  }
  return errors;
}

// ── CHARGE_STEP_GUARDS_V1: step 1 is pinned ───────────────────────────────
//
// `validateSteps` above (and the identical rule in
// `apps/api/src/modules/rates/rate-tables.service.ts`) says the first step
// must have op "start". Neither rule is relaxed here. These helpers make the
// state they reject UNREACHABLE from the card: every mutator that can write
// index 0 goes through one of them, and each returns the list it was given —
// by identity — when the move it was asked for would break the rule.

/**
 * Steps that can lead the list. Only the arithmetic ops carry an operand
 * (`field`), and only an operand can seed a running total — `round`, `floor`
 * and `cap` adjust a total that, in slot 0, does not exist yet.
 */
export function canLeadStepList(
  step: ChargeStep
): step is Extract<ChargeStep, { field: string | number }> {
  return ARITHMETIC_OPS.includes(step.op as StepOp);
}

/**
 * The operations the add form may offer, given how many steps the list
 * already has.
 *
 * An empty list can only take a `start`, because any other first step is the
 * error above. A non-empty list can take anything BUT a `start`: a second
 * `start` passes both validators (each only looks at index 0) and then
 * silently discards everything computed before it, because the `start` case
 * assigns the running total rather than combining with it.
 */
export function addableOps(stepCount: number): StepOp[] {
  // ONE rule, asked about the slot a new step would land in.
  return KNOWN_OPS.filter((o) => isOpOfferableAt(o, stepCount));
}

/** Step 1 has no remove control: removing it is the one move that cannot be undone. */
export function canRemoveStep(index: number): boolean {
  return index > 0;
}

/**
 * Remove a step. Index 0 is refused: `appendStep` only ever appends, so once
 * the `start` is gone there is no way to put one back at the front, and the
 * list cannot be saved empty either (`canSave` requires `steps.length > 0`).
 * To change step 1, add the replacement and move it to the top — the reorder
 * below makes it the `start` — then remove the old one.
 */
export function removeStepAt(steps: ChargeStep[], index: number): ChargeStep[] {
  if (!canRemoveStep(index)) return steps;
  return steps.filter((_, i) => i !== index);
}

/** Append a step, refusing what `addableOps` does not offer for this list. */
export function appendStep(steps: ChargeStep[], step: ChargeStep): ChargeStep[] {
  if (!addableOps(steps.length).includes(step.op as StepOp)) return steps;
  return [...steps, step];
}

/** Build an arithmetic step of a known op — the union needs one literal each. */
function operandStep(
  op: "multiply" | "divide" | "add" | "subtract",
  field: string | number
): ChargeStep {
  switch (op) {
    case "multiply":
      return { op: "multiply", field };
    case "divide":
      return { op: "divide", field };
    case "add":
      return { op: "add", field };
    default:
      return { op: "subtract", field };
  }
}

/**
 * Swap two adjacent steps, keeping `start` in slot 0.
 *
 * A plain swap is what the card used to do, and it is what makes the list
 * unsaveable: move a "Multiply by" to the top and index 0 is no longer a
 * `start`. So when a swap touches slot 0 the two steps exchange OPERANDS and
 * slot 0 keeps its operator: `1 Start with Depth, 2 Multiply by Holes`
 * becomes `1 Start with Holes, 2 Multiply by Depth` — the same arithmetic,
 * still saveable, and with no second `start` left behind.
 *
 * A step with no operand (`round`, `floor`, `cap`) cannot lead the list, so a
 * swap that would put one in slot 0 is refused and the original list is
 * returned; the matching control is disabled, so nothing offers the move.
 */
export function reorderSteps(steps: ChargeStep[], from: number, to: number): ChargeStep[] {
  if (from === to) return steps;
  if (from < 0 || to < 0 || from >= steps.length || to >= steps.length) return steps;

  const next = [...steps];
  [next[from], next[to]] = [next[to], next[from]];

  // Slot 0 untouched: an ordinary swap, and index 0 is whatever it already was.
  if (from !== 0 && to !== 0) return next;

  const other = from === 0 ? to : from;
  const incoming = next[0];
  const displaced = next[other];
  if (!canLeadStepList(incoming)) return steps;

  next[0] = { op: "start", field: incoming.field };
  if (displaced.op === "start") {
    // The step leaving slot 0 takes the incoming step's operator, so the list
    // keeps its arithmetic and gains no second `start`.
    next[other] = operandStep(incoming.op === "start" ? "multiply" : incoming.op, displaced.field);
  }
  return next;
}

// ── CHARGE_STEP_INPLACE_V1: one operand picker, and an editable row ────────
//
// A saved step used to render as a read-only sentence, and the only way to
// change one was to remove every step below it and retype them in order. The
// row IS the editor now: each control writes straight into the step at that
// index through `replaceStepAt`, which is where the step-1 guards live, so
// editing in place cannot reach a state the list could not be saved from.

/** The two places a value can come from, named the way the mock-up names them. */
export type FieldSource = "table" | "line";

/**
 * How the picker labels each source. These are the mock-up's own words from
 * its Fields table's `From` column, so the picker and that table (slice 3)
 * cannot end up calling the same thing two different names.
 */
export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  table: "the rate table",
  line: "the estimate line"
};

/** The final option of the operand picker, which reveals a numeric input. */
export const OPERAND_NUMBER_LABEL = "a number…";

/** Its `<option value>`. Field options carry `f:<name>`; this one carries `n`. */
export const OPERAND_NUMBER_VALUE = "n";

/** One name a step can use, with everything the picker needs to draw it. */
export type FieldChoice = {
  name: string;
  source: FieldSource;
  unit?: string | null;
  /** Text is legible in a condition and meaningless in the sum. */
  text: boolean;
};

/** A labelled group of choices — one `<optgroup>`. */
export type FieldGroup = { source: FieldSource; label: string; choices: FieldChoice[] };

/**
 * Every name a step can use, in the order `allFieldOptions` lists them, with
 * its source and whether it is text. This is the ONE list both pickers are
 * built from: the operand picker drops the text choices, the condition field
 * picker keeps them, and neither invents an ordering of its own.
 */
export function fieldChoices(
  columns: RateColumnMeta[],
  lineFields: readonly RateLineField[] = []
): FieldChoice[] {
  const isTextColumn = (dataType: string) => dataType === "TEXT" || dataType === "LIST_REF";
  return [
    ...columns.map((c) => ({
      name: c.name,
      source: "table" as const,
      unit: c.unit ?? null,
      text: isTextColumn(c.dataType)
    })),
    ...lineFields
      .filter((f) => f.kind !== "text")
      .map((f) => ({ name: f.name, source: "line" as const, unit: f.unit ?? null, text: false })),
    ...lineFields
      .filter((f) => f.kind === "text")
      .map((f) => ({ name: f.name, source: "line" as const, unit: f.unit ?? null, text: true }))
  ];
}

/** Split choices into labelled groups, dropping a group with nothing in it. */
export function fieldGroups(choices: FieldChoice[]): FieldGroup[] {
  const sources: FieldSource[] = ["table", "line"];
  return sources
    .map((source) => ({
      source,
      label: FIELD_SOURCE_LABELS[source],
      choices: choices.filter((c) => c.source === source)
    }))
    .filter((g) => g.choices.length > 0);
}

/**
 * The groups the ONE operand picker offers. Number-kind only: text is not
 * arithmetic, which is the rule `numericFieldOptions` and the server's
 * `validateChargeSteps` both already apply.
 */
export function operandGroups(
  columns: RateColumnMeta[],
  lineFields: readonly RateLineField[] = []
): FieldGroup[] {
  return fieldGroups(fieldChoices(columns, lineFields).filter((c) => !c.text));
}

/** The groups the condition field picker offers — both kinds, text included. */
export function conditionFieldGroups(
  columns: RateColumnMeta[],
  lineFields: readonly RateLineField[] = []
): FieldGroup[] {
  return fieldGroups(fieldChoices(columns, lineFields));
}

/** How one choice reads in a menu: its name, and its unit when it has one. */
export function fieldChoiceLabel(choice: FieldChoice): string {
  return choice.unit ? `${choice.name} (${choice.unit})` : choice.name;
}

/** The `<option value>` for a named field. */
export function operandFieldValue(name: string): string {
  return `f:${name}`;
}

/** Read an operand `<option value>` back. */
export function parseOperandValue(value: string): { field: string } | { number: true } {
  return value === OPERAND_NUMBER_VALUE ? { number: true } : { field: value.slice(2) };
}

/**
 * The operand picker's full rendered option list, group labels included, in
 * the order a reader sees them. Exported so a test can assert the whole menu
 * rather than a sample of it.
 */
export function operandOptionList(
  columns: RateColumnMeta[],
  lineFields: readonly RateLineField[] = []
): string[] {
  const out: string[] = [];
  for (const group of operandGroups(columns, lineFields)) {
    out.push(group.label);
    for (const choice of group.choices) out.push(fieldChoiceLabel(choice));
  }
  out.push(OPERAND_NUMBER_LABEL);
  return out;
}

/**
 * The value control for a condition on this field: a closed list when the
 * field DECLARES one, otherwise free text.
 *
 * Only a declared list counts. A TEXT column's values could be gathered from
 * whatever rows the table happens to hold today, but a list built that way
 * silently loses any value no row carries yet — which would make a condition
 * on a new value untypeable. Free text stays the safe default there.
 */
export function conditionValueOptions(
  field: string,
  lineFields: readonly RateLineField[] = []
): string[] | null {
  const declared = lineFields.find((f) => f.name === field)?.options;
  return declared && declared.length > 0 ? declared : null;
}

/** A condition value typed by hand: a number when it reads as one, else text. */
export function coerceConditionValue(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed === "" || Number.isNaN(Number(trimmed))) return raw;
  return Number(trimmed);
}

/**
 * The condition a step gets when someone clicks `+ only when…`.
 *
 * A text field is preferred, because a closed list is the case the pill was
 * built for and its first option is a valid answer straight away. With no
 * text field the first field of any kind is used, compared against 0 — a
 * condition that is false until it is edited, which the skipped-step styling
 * says out loud.
 */
export function defaultCondition(
  columns: RateColumnMeta[],
  lineFields: readonly RateLineField[] = []
): Condition | null {
  const choices = fieldChoices(columns, lineFields);
  const field = choices.find((c) => c.text) ?? choices[0];
  if (!field) return null;
  const options = conditionValueOptions(field.name, lineFields);
  return { field: field.name, cmp: "is", value: options ? options[0] : 0 };
}

// ── CHARGE_STEP_INPLACE_V1: writing a step, one op at a time ──────────────

/** Ops whose operand is a literal `value`, never a field. */
export const FIXED_VALUE_OPS: StepOp[] = ["floor", "cap"];

/**
 * Everything one step carries that a step of another op might keep. Changing
 * `Multiply by Rate` to `Divide by` should not lose `Rate`, and neither
 * should it lose the condition hanging off it.
 */
export type StepCarry = {
  field?: string | number;
  value?: number;
  direction?: "nearest" | "up" | "down";
  interval?: number;
  when?: Condition;
};

/** Read the carry off a step. */
export function stepCarry(step: ChargeStep): StepCarry {
  const carry: StepCarry = {};
  if ("field" in step) carry.field = step.field;
  if ("value" in step) carry.value = step.value;
  if (step.op === "round") {
    carry.direction = step.direction;
    carry.interval = step.interval;
  }
  if ("when" in step && step.when) carry.when = step.when;
  return carry;
}

/**
 * Build a step of `op` from a carry — the ONE place that says what a step of
 * each op looks like. The row's operation menu, the operand picker and the
 * `+ Add a step` button all come through here, so a step built by one of them
 * is shaped exactly like a step built by another.
 *
 * `when` is spread conditionally, never written as `undefined`: a step with an
 * explicit `when: undefined` and a step with no `when` are the same step to
 * `toEqual` and different objects to `JSON.stringify`, and the second is what
 * goes over the wire.
 */
export function buildStepOfOp(
  op: StepOp,
  carry: StepCarry,
  fallbackField: string | number
): ChargeStep {
  const operand =
    carry.field ?? (typeof carry.value === "number" ? carry.value : fallbackField);
  const when = carry.when;

  switch (op) {
    // `start` seeds the total; it takes no condition, because skipping it
    // would leave every later step with nothing to work from.
    case "start":
      return { op: "start", field: operand };
    case "multiply":
      return when ? { op: "multiply", field: operand, when } : { op: "multiply", field: operand };
    case "divide":
      return when ? { op: "divide", field: operand, when } : { op: "divide", field: operand };
    case "add":
      return when ? { op: "add", field: operand, when } : { op: "add", field: operand };
    case "subtract":
      return when ? { op: "subtract", field: operand, when } : { op: "subtract", field: operand };
    case "round":
      return {
        op: "round",
        direction: carry.direction ?? "nearest",
        interval: carry.interval ?? 1
      };
    default: {
      // floor / cap — a literal, never a field. A number operand carries over
      // (`Multiply by 2` to `Never less than 2`); a named field cannot, so the
      // limit starts at 0 and the running total says so immediately.
      const value = carry.value ?? (typeof carry.field === "number" ? carry.field : 0);
      return op === "floor"
        ? when
          ? { op: "floor", value, when }
          : { op: "floor", value }
        : when
          ? { op: "cap", value, when }
          : { op: "cap", value };
    }
  }
}

/** Change a step's operation, keeping what the new op can still use. */
export function changeStepOp(
  step: ChargeStep,
  op: StepOp,
  fallbackField: string | number
): ChargeStep {
  if (step.op === op) return step;
  return buildStepOfOp(op, stepCarry(step), fallbackField);
}

/** Point an arithmetic step at another field, or at a numeric literal. */
export function setStepOperand(step: ChargeStep, field: string | number): ChargeStep {
  if (!ARITHMETIC_OPS.includes(step.op as StepOp)) return step;
  if ("field" in step && step.field === field) return step;
  return buildStepOfOp(step.op as StepOp, { ...stepCarry(step), field }, field);
}

/** Set the literal a `floor` or a `cap` holds. */
export function setStepFixedValue(step: ChargeStep, value: number): ChargeStep {
  if (!FIXED_VALUE_OPS.includes(step.op as StepOp)) return step;
  if ("value" in step && step.value === value) return step;
  return buildStepOfOp(step.op as StepOp, { ...stepCarry(step), value }, value);
}

/** Set a `round` step's direction and/or interval. */
export function setStepRound(
  step: ChargeStep,
  patch: { direction?: "nearest" | "up" | "down"; interval?: number }
): ChargeStep {
  if (step.op !== "round") return step;
  return buildStepOfOp("round", { ...stepCarry(step), ...patch }, 1);
}

/** Attach a condition to a step, or take it off with `undefined`. */
export function setStepCondition(step: ChargeStep, when?: Condition): ChargeStep {
  if (!CONDITIONAL_OPS.includes(step.op as StepOp)) return step;
  const carry = stepCarry(step);
  if (when) carry.when = when;
  else delete carry.when;
  return buildStepOfOp(step.op as StepOp, carry, 1);
}

/**
 * CHARGE_STEP_GUARDS_V1 — whether an operation may sit at this index. ONE
 * rule, two readers: the row's operation menu disables what it says no to, and
 * `addableOps` below is this same predicate asked about the slot a new step
 * would land in.
 *
 * Slot 0 takes `start` and nothing else — any other first step is
 * `First step must have op "start".` Every other slot takes anything but
 * `start`, because a second `start` passes both validators (each only looks at
 * index 0) and then silently discards everything computed before it.
 */
export function isOpOfferableAt(op: StepOp, index: number): boolean {
  return index === 0 ? op === "start" : op !== "start";
}

/**
 * Write a step in place, refusing what `isOpOfferableAt` does not offer.
 *
 * Every in-place edit goes through here, so the guards hold for the row
 * controls exactly as they hold for reorder, remove and append. A refusal
 * returns the list by identity, so nothing changes and the card is not even
 * marked dirty.
 */
export function replaceStepAt(steps: ChargeStep[], index: number, next: ChargeStep): ChargeStep[] {
  if (index < 0 || index >= steps.length) return steps;
  if (!isOpOfferableAt(next.op as StepOp, index)) return steps;
  if (next === steps[index]) return steps;
  const out = [...steps];
  out[index] = next;
  return out;
}

/**
 * Whether a reorder is available, asked of the mutator that would perform it.
 *
 * CHARGE_STEP_GUARDS_V1 — the control is disabled exactly when `reorderSteps`
 * would refuse the move, so there is no second copy of the rule to drift.
 */
export function canMoveStep(steps: ChargeStep[], from: number, to: number): boolean {
  return reorderSteps(steps, from, to) !== steps;
}

/**
 * The operand a new step points at: the first field the picker offers, or the
 * literal 1 when the table declares no number field at all.
 */
export function defaultOperand(numericCols: string[]): string | number {
  return numericCols[0] ?? 1;
}

/**
 * The step `+ Add a step` appends: a `start` while the list is empty, a
 * `Multiply by` on the first available field once it is not — the same shape
 * every row already edits, so there is nothing to learn twice.
 */
export function newStepFor(steps: ChargeStep[], numericCols: string[]): ChargeStep {
  const op = addableOps(steps.length)[0];
  return buildStepOfOp(op, {}, defaultOperand(numericCols));
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

/** Stable identity, so the default prop does not re-run every memo each render. */
const EMPTY_LINE_FIELDS: readonly RateLineField[] = [];

export function ChargeStepsEditor({
  tableId,
  tableName,
  isReference,
  columns,
  rows,
  lineFields = EMPTY_LINE_FIELDS,
  onSaved
}: {
  tableId: string;
  tableName: string;
  isReference: boolean;
  columns: RateColumnMeta[];
  rows: RateRowShape[];
  /**
   * RATE_LINE_FIELDS_V1 — the line fields declared on this table. Read-only
   * here: this card offers them as operands and previews them from their
   * `sample`, and does not send them back on save, so a PATCH from this card
   * cannot clear a declaration it has no UI to edit.
   */
  lineFields?: readonly RateLineField[];
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

  // RATE_LINE_FIELDS_V1 — ONE values map, built once, by the same function any
  // server caller would use (`@project-ops/config/charge-step-semantics`). The
  // column half is the matched row's cells; the line-field half is each field's
  // declared `sample`, until slice 4 builds the real scenario inputs.
  const scenarioValues = useMemo<Record<string, number | string>>(() => {
    const row = rows.find((r) => r.id === scenarioRowId);
    return buildStepValues(columns, row?.cells, lineFields);
  }, [rows, scenarioRowId, columns, lineFields]);

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

  // Every name a step may use, and the subset of it that is text — the same two
  // sets `validateChargeSteps` builds on the server.
  const columnNames = useMemo(
    () => allFieldOptions(columns, lineFields),
    [columns, lineFields]
  );
  const textFieldNames = useMemo(() => textLineFieldNames(lineFields), [lineFields]);
  const validationErrors = useMemo(
    () => validateSteps(steps, columnNames, textFieldNames),
    [steps, columnNames, textFieldNames]
  );

  const canSave = dirty && validationErrors.length === 0 && steps.length > 0;

  // ── Mutators ──────────────────────────────────────────────────────────

  const updateSteps = (next: ChargeStep[]) => {
    setSteps(next);
    setDirty(true);
  };

  // CHARGE_STEP_GUARDS_V1 — every mutator that can write index 0 delegates to
  // a guard above. Each returns the same list by identity when it refuses, so
  // a refused move changes nothing and does not even mark the card dirty.

  const moveUp = (index: number) => {
    const next = reorderSteps(steps, index, index - 1);
    if (next !== steps) updateSteps(next);
  };

  const moveDown = (index: number) => {
    const next = reorderSteps(steps, index, index + 1);
    if (next !== steps) updateSteps(next);
  };

  const removeStep = (index: number) => {
    const next = removeStepAt(steps, index);
    if (next !== steps) updateSteps(next);
  };

  const addStep = (step: ChargeStep) => {
    const next = appendStep(steps, step);
    if (next !== steps) updateSteps(next);
  };

  // CHARGE_STEP_INPLACE_V1 — every control on every row lands here. It is the
  // fifth guarded delegation, not a fifth way to write the list.
  const editStep = (index: number, step: ChargeStep) => {
    const next = replaceStepAt(steps, index, step);
    if (next !== steps) updateSteps(next);
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

  const numericCols = numericFieldOptions(columns, lineFields);
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
          No steps yet. Add the first step below — it starts the running total.
        </p>
      ) : (
        <ol style={stepListStyle} aria-label="Charge step list">
          {steps.map((step, i) => (
            <ChargeStepRow
              key={i}
              step={step}
              index={i}
              columns={columns}
              lineFields={lineFields}
              trailEntry={trail[i]}
              presentation={presentations[i] ?? MEASUREMENT}
              invalid={validationErrors.some((e) => e.index === i)}
              canMoveUp={canMoveStep(steps, i, i - 1)}
              canMoveDown={canMoveStep(steps, i, i + 1)}
              onChange={(next) => editStep(i, next)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
              onRemove={() => removeStep(i)}
            />
          ))}
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

      {/* CHARGE_STEP_INPLACE_V1 — one button, not a parallel form. It appends
          a step in the same editable shape every row already uses, so there is
          exactly one operand control and one condition control in this file. */}
      {!loading ? (
        <div style={addStepRowStyle}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => addStep(newStepFor(steps, numericCols))}
            style={{ minHeight: 34 }}
            data-testid="add-step-btn"
          >
            + Add a step
          </button>
          <span style={addStepNoteStyle}>
            A step can multiply, divide, add, subtract, round, or hold a floor or a cap — and any
            of them can apply only when a condition is met.
          </span>
        </div>
      ) : null}

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

// ── CHARGE_STEP_INPLACE_V1: the controls ──────────────────────────────────
//
// One implementation of each control, used by every row. There is no second
// copy in an add form, because there is no add form: `+ Add a step` appends a
// step in the same editable shape the rows already use.

/**
 * A number that is only written to the step when what is typed is a number.
 *
 * The input holds a draft while it is being edited, so a half-typed value
 * ("", "-", "1.") never lands in the step as `NaN` and never silently becomes
 * 0. Blur drops the draft, and the field snaps back to what the step actually
 * holds.
 */
function NumberField({
  value,
  onChange,
  label,
  wide = false,
  positive = false
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  wide?: boolean;
  positive?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="s7-input"
      inputMode="decimal"
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = Number(raw);
        if (raw.trim() === "" || Number.isNaN(parsed)) return;
        if (positive && parsed <= 0) return;
        onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
      style={wide ? numberFieldWideStyle : numberFieldStyle}
    />
  );
}

/**
 * A `<select>` over grouped field choices, with the step's own name kept
 * offerable even when the table no longer declares it.
 *
 * A step saved against a column that has since been renamed must still SHOW
 * that name. Dropping it would make the select fall to its first option and
 * quietly misreport the step; `validateSteps` already marks the row, and this
 * keeps the row telling the truth about what it holds.
 */
function GroupedFieldSelect({
  groups,
  value,
  label,
  style,
  onChange
}: {
  groups: FieldGroup[];
  value: string;
  label: string;
  style: CSSProperties;
  onChange: (name: string) => void;
}) {
  const known = groups.some((g) => g.choices.some((c) => c.name === value));
  return (
    <select
      className="s7-select"
      style={style}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {known ? null : <option value={value}>{value}</option>}
      {groups.map((group) => (
        <optgroup key={group.source} label={group.label}>
          {group.choices.map((choice) => (
            <option key={choice.name} value={choice.name}>
              {fieldChoiceLabel(choice)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * THE operand picker — one control offering both kinds of field and saying
 * which is which, plus `a number…` for a literal.
 *
 * It replaces the Mode / Column / Value trio the add form used to carry: after
 * line fields there are two SOURCES of operand, and three controls to choose
 * between them is one more decision than the person is actually making. The
 * `<optgroup>` labels are the words the mock-up's Fields table uses in its
 * `From` column — "the rate table" and "the estimate line" — so a reader can
 * tell a column from a line field without leaving the picker.
 *
 * Number-kind fields only. Text is offered by the CONDITION picker instead,
 * which is the rule slice 1 put on the server and `numericFieldOptions`
 * already encodes here.
 */
export function OperandPicker({
  step,
  index,
  columns,
  lineFields,
  onChange
}: {
  step: ChargeStep;
  index: number;
  columns: RateColumnMeta[];
  lineFields: readonly RateLineField[];
  onChange: (next: ChargeStep) => void;
}) {
  const groups = useMemo(() => operandGroups(columns, lineFields), [columns, lineFields]);
  const field = "field" in step ? step.field : 0;
  const isLiteral = typeof field === "number";
  const known = groups.some((g) => g.choices.some((c) => c.name === field));

  return (
    <>
      <select
        className="s7-select"
        style={rowSelectStyle}
        aria-label={`Step ${index + 1} operand`}
        value={isLiteral ? OPERAND_NUMBER_VALUE : operandFieldValue(field)}
        onChange={(e) => {
          const parsed = parseOperandValue(e.target.value);
          if ("number" in parsed) {
            onChange(setStepOperand(step, isLiteral ? field : 1));
          } else {
            onChange(setStepOperand(step, parsed.field));
          }
        }}
      >
        {isLiteral || known ? null : (
          <option value={operandFieldValue(field)}>{field}</option>
        )}
        {groups.map((group) => (
          <optgroup key={group.source} label={group.label}>
            {group.choices.map((choice) => (
              <option key={choice.name} value={operandFieldValue(choice.name)}>
                {fieldChoiceLabel(choice)}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OPERAND_NUMBER_VALUE}>{OPERAND_NUMBER_LABEL}</option>
      </select>
      {isLiteral ? (
        <NumberField
          wide
          value={field}
          label={`Step ${index + 1} number`}
          onChange={(next) => onChange(setStepOperand(step, next))}
        />
      ) : null}
    </>
  );
}

/**
 * THE condition control — `only when <field> <comparator> <value>` as a pill
 * on the row, and `+ only when…` on a step that has none.
 *
 * Where the chosen field DECLARES an option list the value control is a select
 * over it, which is the difference between `Inverted` matching and `inverted`
 * being typed by hand — the comparison is case-insensitive, but a typo is not.
 */
export function ConditionPill({
  step,
  index,
  columns,
  lineFields,
  onChange
}: {
  step: ChargeStep;
  index: number;
  columns: RateColumnMeta[];
  lineFields: readonly RateLineField[];
  onChange: (next: ChargeStep) => void;
}) {
  const groups = useMemo(() => conditionFieldGroups(columns, lineFields), [columns, lineFields]);
  const when = "when" in step ? step.when : undefined;

  if (!when) {
    const seed = defaultCondition(columns, lineFields);
    if (!seed) return null;
    return (
      <button
        type="button"
        style={addConditionStyle}
        data-testid={`add-condition-${index}`}
        onClick={() => onChange(setStepCondition(step, seed))}
      >
        + only when…
      </button>
    );
  }

  const options = conditionValueOptions(when.field, lineFields);
  const shown = String(when.value);

  return (
    <span style={conditionPillStyle} data-testid={`condition-pill-${index}`}>
      <span style={conditionLabelStyle}>only when</span>
      <GroupedFieldSelect
        groups={groups}
        value={when.field}
        label={`Step ${index + 1} condition field`}
        style={conditionControlStyle}
        onChange={(name) => {
          const next = conditionValueOptions(name, lineFields);
          onChange(
            setStepCondition(step, {
              field: name,
              cmp: when.cmp,
              // A field with a declared list gets its first option, because the
              // value it replaces is not one of them. Otherwise the value
              // stands: changing which field is compared is not a reason to
              // throw away what it is compared against.
              value: next ? next[0] : when.value
            })
          );
        }}
      />
      <select
        className="s7-select"
        style={conditionControlStyle}
        aria-label={`Step ${index + 1} condition comparator`}
        value={when.cmp}
        onChange={(e) =>
          onChange(setStepCondition(step, { ...when, cmp: e.target.value as ConditionCmp }))
        }
      >
        {CONDITION_CMPS.map((cmp) => (
          <option key={cmp} value={cmp}>
            {CMP_LABELS[cmp]}
          </option>
        ))}
      </select>
      {options ? (
        <select
          className="s7-select"
          style={conditionControlStyle}
          aria-label={`Step ${index + 1} condition value`}
          value={shown}
          onChange={(e) => onChange(setStepCondition(step, { ...when, value: e.target.value }))}
        >
          {options.includes(shown) ? null : <option value={shown}>{shown}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="s7-input"
          style={conditionControlStyle}
          aria-label={`Step ${index + 1} condition value`}
          value={shown}
          onChange={(e) =>
            onChange(setStepCondition(step, { ...when, value: coerceConditionValue(e.target.value) }))
          }
        />
      )}
      <button
        type="button"
        style={conditionRemoveStyle}
        aria-label={`Remove the condition on step ${index + 1}`}
        data-testid={`remove-condition-${index}`}
        onClick={() => onChange(setStepCondition(step, undefined))}
      >
        ×
      </button>
    </span>
  );
}

/**
 * ONE step, as the mock-up draws it: number, body, running total, actions.
 *
 * The body holds live controls, not a sentence. Every one of them writes
 * straight into the step at this index, and the sentence survives as the row's
 * accessible name so the list still reads aloud as English.
 *
 * CHARGE_STEP_GUARDS_V1 is expressed in the controls themselves, which is how
 * the mock-up does it: `start` is disabled in the operation menu at every
 * index above 0, every other op is disabled at index 0, a reorder the guard
 * would refuse is disabled rather than offered, and step 1's remove control is
 * a spacer.
 */
export function ChargeStepRow({
  step,
  index,
  columns,
  lineFields,
  trailEntry,
  presentation,
  invalid,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove
}: {
  step: ChargeStep;
  index: number;
  columns: RateColumnMeta[];
  lineFields: readonly RateLineField[];
  trailEntry?: ChargeStepTrailEntry;
  presentation: TotalPresentation;
  invalid: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: ChargeStep) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const skipped = trailEntry?.skipped ?? false;
  const runningTotal = trailEntry?.runningTotal ?? null;
  const stepIssue = trailEntry?.issue ?? null;
  const tinted = stepIssue !== null || invalid;
  const numericCols = numericFieldOptions(columns, lineFields);

  return (
    <li
      data-testid={`step-row-${index}`}
      aria-label={stepSentence(step, index)}
      style={{
        ...stepRowStyle,
        ...(tinted ? stepRowInvalidStyle : null),
        opacity: skipped ? 0.55 : 1
      }}
    >
      <span style={stepNumberStyle} aria-hidden="true">
        {index + 1}
      </span>

      <span style={stepBodyStyle}>
        {/* Operation. Every known op is listed at every index and the ones the
            guards refuse are disabled, so the menu keeps its shape and says
            WHY a move is not available instead of hiding it. */}
        <select
          className="s7-select"
          style={rowSelectStyle}
          aria-label={`Step ${index + 1} operation`}
          value={step.op}
          onChange={(e) =>
            onChange(
              changeStepOp(step, e.target.value as StepOp, defaultOperand(numericCols))
            )
          }
        >
          {KNOWN_OPS.map((op) => (
            <option key={op} value={op} disabled={!isOpOfferableAt(op, index)}>
              {OP_LABELS[op]}
            </option>
          ))}
        </select>

        {step.op === "round" ? (
          <>
            <select
              className="s7-select"
              style={rowSelectStyle}
              aria-label={`Step ${index + 1} round direction`}
              value={step.direction}
              onChange={(e) =>
                onChange(
                  setStepRound(step, {
                    direction: e.target.value as "nearest" | "up" | "down"
                  })
                )
              }
            >
              <option value="nearest">to the nearest</option>
              <option value="up">up to the next</option>
              <option value="down">down to the last</option>
            </select>
            <NumberField
              positive
              value={step.interval}
              label={`Step ${index + 1} round interval`}
              onChange={(interval) => onChange(setStepRound(step, { interval }))}
            />
            {step.interval === 1 ? <span style={rowHintStyle}>whole number</span> : null}
          </>
        ) : FIXED_VALUE_OPS.includes(step.op as StepOp) ? (
          // floor / cap keep their literal `value`. The operand picker is not
          // offered for them: a floor that moves with a field is a different
          // rule, and this slice is not the place to invent it.
          <NumberField
            wide
            value={"value" in step ? step.value : 0}
            label={`Step ${index + 1} value`}
            onChange={(value) => onChange(setStepFixedValue(step, value))}
          />
        ) : (
          <OperandPicker
            step={step}
            index={index}
            columns={columns}
            lineFields={lineFields}
            onChange={onChange}
          />
        )}

        {CONDITIONAL_OPS.includes(step.op as StepOp) ? (
          <ConditionPill
            step={step}
            index={index}
            columns={columns}
            lineFields={lineFields}
            onChange={onChange}
          />
        ) : null}
      </span>

      {/* Running total — or, when the step could not be worked out, the reason.
          CHARGE_STEP_PARITY_V1: never a plausible-looking figure instead. */}
      <span style={stepTotalStyle}>
        {stepIssue ? (
          <span role="note" data-testid={`step-issue-${index}`} style={stepIssueStyle}>
            {describeChargeStepIssue(stepIssue)}
          </span>
        ) : runningTotal !== null ? (
          <>
            {skipped ? <span style={rowHintStyle}>skipped </span> : null}
            <b>{formatStepTotal(runningTotal, presentation)}</b>
          </>
        ) : (
          <span style={rowHintStyle}>—</span>
        )}
      </span>

      <span style={stepActionsStyle}>
        <button
          type="button"
          aria-label={`Move step ${index + 1} up`}
          disabled={!canMoveUp}
          onClick={onMoveUp}
          style={iconBtnStyle}
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Move step ${index + 1} down`}
          disabled={!canMoveDown}
          onClick={onMoveDown}
          style={iconBtnStyle}
        >
          ▼
        </button>
        {/* CHARGE_STEP_GUARDS_V1: step 1 gets no remove control — removing it
            is the one move that cannot be undone. The spacer holds the column
            open so the list stays aligned. */}
        {canRemoveStep(index) ? (
          <button
            type="button"
            aria-label={`Remove step ${index + 1}`}
            onClick={onRemove}
            style={iconBtnStyle}
            data-testid={`remove-step-${index}`}
          >
            ×
          </button>
        ) : (
          <span aria-hidden="true" style={iconSpacerStyle} />
        )}
      </span>
    </li>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

// ── CHARGE_STEP_INPLACE_V1 styles ─────────────────────────────────────────
//
// The mock-up's step: a four-part grid — number, body, running total, actions.
// Every colour is a token from apps/web/src/styles/tokens.css, so the row
// flips with the theme; there is no hex literal and no raw rgba below.
// `--surface-override` and `--brand-dark` are the two tokens that deliberately
// do NOT flip: the pill's fill is the same amber in both themes, so the text
// on it has to be the same near-black in both themes too.

const stepListStyle: CSSProperties = {
  margin: "0 0 12px",
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 6
};

const stepRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "26px minmax(0,1fr) auto 74px",
  gap: 10,
  alignItems: "center",
  padding: "9px 11px",
  borderRadius: "var(--radius-md)",
  background: "var(--surface-card)",
  border: "1px solid var(--border-default)"
};

const stepRowInvalidStyle: CSSProperties = {
  border: "1px solid var(--status-danger)",
  background: "var(--surface-subtle)"
};

const stepNumberStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  background: "var(--brand-primary-light)",
  color: "var(--text-primary)",
  fontSize: 11,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontVariantNumeric: "tabular-nums"
};

const stepBodyStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
  minWidth: 0
};

/** Overrides `.s7-select`'s full width and 36px height for a control on a row. */
const rowSelectStyle: CSSProperties = {
  width: "auto",
  height: 32,
  padding: "4px 8px",
  fontSize: 13,
  borderRadius: "var(--radius-sm)"
};

const numberFieldStyle: CSSProperties = {
  width: 58,
  height: 32,
  padding: "4px 8px",
  fontSize: 13,
  textAlign: "right",
  borderRadius: "var(--radius-sm)",
  fontVariantNumeric: "tabular-nums"
};

const numberFieldWideStyle: CSSProperties = {
  ...numberFieldStyle,
  width: 74,
  textAlign: "left"
};

const rowHintStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)"
};

const conditionPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 8px 3px 9px",
  borderRadius: 99,
  background: "var(--surface-override)",
  color: "var(--brand-dark)"
};

const conditionLabelStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: "var(--brand-dark)",
  whiteSpace: "nowrap"
};

const conditionControlStyle: CSSProperties = {
  width: "auto",
  height: 26,
  padding: "2px 6px",
  fontSize: 12,
  borderRadius: "var(--radius-sm)",
  borderColor: "var(--brand-accent-dark)"
};

const conditionRemoveStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--brand-dark)",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
  padding: "0 2px"
};

const addConditionStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--brand-accent-dark)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  padding: "3px 4px",
  whiteSpace: "nowrap"
};

const stepTotalStyle: CSSProperties = {
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  fontSize: 13,
  color: "var(--text-secondary)"
};

const stepIssueStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--status-danger)",
  display: "inline-block",
  maxWidth: 260,
  whiteSpace: "normal",
  textAlign: "right"
};

const stepActionsStyle: CSSProperties = {
  display: "inline-flex",
  gap: 2,
  justifyContent: "flex-end"
};

const iconBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "none",
  color: "var(--text-muted)",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontSize: 11,
  lineHeight: 1
};

/** CHARGE_STEP_GUARDS_V1 — holds the remove column open on step 1, which has
 *  no remove control. */
const iconSpacerStyle: CSSProperties = {
  display: "inline-block",
  width: 24,
  height: 24
};

const addStepRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 14
};

const addStepNoteStyle: CSSProperties = {
  flex: 1,
  minWidth: 240,
  margin: 0,
  fontSize: 12,
  color: "var(--text-secondary)"
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
