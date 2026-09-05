/**
 * rate-step-evaluator.ts — CHARGE_STEP_PARITY_V1
 *
 * Server-side entry point for evaluating an ordered list of ChargeStep objects
 * against a map of named values (rate-table column names or numeric literals).
 *
 * The arithmetic, the comparison rule and the error taxonomy are NOT defined
 * here. They live in `@project-ops/config/charge-step-semantics`, which the
 * admin charge-step preview (`apps/web/src/pages/admin/ChargeStepsEditor.tsx`)
 * calls as well, so the number the editor previews and the number this
 * evaluator produces for the same stored rule and the same row cannot differ.
 * This file only adds the server's input-contract guards on top.
 *
 * Grammar of a ChargeStep:
 *
 *   start    { op: "start",    field: string | number }
 *   multiply { op: "multiply", field: string | number; when?: Condition }
 *   divide   { op: "divide",   field: string | number; when?: Condition }
 *   add      { op: "add",      field: string | number; when?: Condition }
 *   subtract { op: "subtract", field: string | number; when?: Condition }
 *   round    { op: "round",    direction: "nearest" | "up" | "down"; interval: number }
 *   floor    { op: "floor",    value: number; when?: Condition }
 *   cap      { op: "cap";      value: number; when?: Condition }
 *
 * Conditions (optional on multiply, divide, add, subtract, floor, cap):
 *   { field: string; cmp: "is" | "is not" | ">" | "<" | ">=" | "<="; value: string | number }
 *
 * Rules (all enforced by the shared module — see its header for the one-sentence
 * statements of the comparison rule and the error taxonomy):
 * - Steps are evaluated in order; the running total is passed along.
 * - `is` / `is not` compare as text with case ignored; `>` `<` `>=` `<=` coerce
 *   both sides with `Number`.
 * - A step whose condition is not met is SKIPPED and leaves the total alone.
 * - A step that cannot be worked out — an operand the row has no value for,
 *   text in an arithmetic slot, a divide by zero, a non-positive round interval
 *   — records a `ChargeStepIssue` naming the step, and the running total is
 *   `null` from that step onward rather than a guessed figure.
 * - `round nearest` uses standard Math.round semantics (ties go up).
 * - `floor` ensures the total is at least `value`; `cap` at most `value`.
 */

import {
  evaluateChargeSteps,
  type ChargeStepEvaluation,
  type ChargeStepIssue,
  type ChargeStepTrailEntry,
  type StepValues
} from "@project-ops/config/charge-step-semantics";

// Re-exported so the rest of the API keeps importing these from here, and so
// there is exactly one declaration of each behind it.
export type {
  AddStep,
  CapStep,
  ChargeStep,
  ChargeStepEvaluation,
  ChargeStepIssue,
  ChargeStepIssueCode,
  ChargeStepTrailEntry,
  Condition,
  ConditionCmp,
  DivideStep,
  FloorStep,
  MultiplyStep,
  RoundStep,
  StartStep,
  StepValue,
  StepValues,
  SubtractStep
} from "@project-ops/config/charge-step-semantics";

export {
  chargeStepIssue,
  chargeStepIssueMessage,
  compareStepCondition,
  describeChargeStepIssue,
  evaluateChargeSteps,
  resolveStepOperand,
  stepConditionMet
} from "@project-ops/config/charge-step-semantics";

import type { ChargeStep } from "@project-ops/config/charge-step-semantics";

/** One entry per step. Alias kept for existing call sites. */
export type TrailEntry = ChargeStepTrailEntry;

// ---------------------------------------------------------------------------
// evaluateSteps — public API
// ---------------------------------------------------------------------------

/**
 * Evaluate an ordered list of ChargeStep objects against a map of named
 * values.
 *
 * @param steps  Ordered step list. Must not be empty and must begin with
 *               `start` — both are input-contract guards, not arithmetic, and
 *               are the server's own (the editor reports the same two
 *               conditions through `validateSteps`).
 * @param values Map of field-name → numeric or string value. String values may
 *               appear in condition comparisons but not in arithmetic.
 *
 * @returns `{ total, trail, issues }` where `trail.length === steps.length`.
 *          `total` is `null` when any step could not be worked out; `issues`
 *          names each such step. Nothing is thrown for a step that fails —
 *          the reason is returned so the caller and the editor can report the
 *          same thing.
 *
 * @throws Error  when `steps` is empty or the first step is not `start`.
 */
export function evaluateSteps(
  steps: ChargeStep[],
  values: StepValues
): ChargeStepEvaluation {
  if (steps.length === 0) throw new Error("steps must not be empty");
  if (steps[0].op !== "start") throw new Error("first step must be op: start");

  return evaluateChargeSteps(steps, values);
}
