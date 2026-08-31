/**
 * rate-step-evaluator.ts
 *
 * Pure function that evaluates an ordered list of ChargeStep objects against
 * a map of named values (field names or numeric literals) and returns a
 * running total plus a per-step trail.
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
 * Rules:
 * - Steps are evaluated in order. The running total is passed from one step
 *   to the next.
 * - When a condition is present and not met the step is SKIPPED: the running
 *   total is unchanged, and the trail records { skipped: true }.
 * - Text values in `values` may only appear in conditions. Attempting to use
 *   a field whose value is a string in an arithmetic operand throws
 *   `StepArithmeticTypeError`.
 * - `round nearest` rounds to the nearest multiple of `interval`
 *   (ties round to nearest-even / banker's rounding is NOT used — standard
 *   Math.round semantics: ties go up).
 * - `floor` ensures the total is at least `value`.
 * - `cap`   ensures the total is at most  `value`.
 */

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

export type ConditionCmp = "is" | "is not" | ">" | "<" | ">=" | "<=";

export interface Condition {
  field: string;
  cmp: ConditionCmp;
  value: string | number;
}

// ---------------------------------------------------------------------------
// ChargeStep union
// ---------------------------------------------------------------------------

export interface StartStep {
  op: "start";
  /** Field name (looks up in values) or a numeric literal. */
  field: string | number;
}

export interface MultiplyStep {
  op: "multiply";
  field: string | number;
  when?: Condition;
}

export interface DivideStep {
  op: "divide";
  field: string | number;
  when?: Condition;
}

export interface AddStep {
  op: "add";
  field: string | number;
  when?: Condition;
}

export interface SubtractStep {
  op: "subtract";
  field: string | number;
  when?: Condition;
}

export interface RoundStep {
  op: "round";
  direction: "nearest" | "up" | "down";
  interval: number;
}

export interface FloorStep {
  op: "floor";
  value: number;
  when?: Condition;
}

export interface CapStep {
  op: "cap";
  value: number;
  when?: Condition;
}

export type ChargeStep =
  | StartStep
  | MultiplyStep
  | DivideStep
  | AddStep
  | SubtractStep
  | RoundStep
  | FloorStep
  | CapStep;

// ---------------------------------------------------------------------------
// Trail
// ---------------------------------------------------------------------------

export interface TrailEntry {
  /** Zero-based index of this step in the steps array. */
  index: number;
  op: ChargeStep["op"];
  /** Running total AFTER this step applied (unchanged if skipped). */
  runningTotal: number;
  /** True when the step's condition was evaluated and was not met. */
  skipped: boolean;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class StepArithmeticTypeError extends Error {
  constructor(public readonly fieldName: string, public readonly fieldValue: string) {
    super(
      `Field "${fieldName}" has a string value ("${fieldValue}") and cannot be used in arithmetic. ` +
        `Text values may only appear in conditions.`
    );
    this.name = "StepArithmeticTypeError";
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a step operand: if it is a number, return it directly;
 * if it is a string, look it up in `values` and return the numeric value.
 * Throws StepArithmeticTypeError when the resolved value is a string.
 */
function resolveNumeric(
  field: string | number,
  values: Record<string, number | string>
): number {
  if (typeof field === "number") return field;
  const resolved = values[field];
  if (resolved === undefined) return 0;
  if (typeof resolved === "string") {
    throw new StepArithmeticTypeError(field, resolved);
  }
  return resolved;
}

/**
 * Evaluate a condition against the values map.
 * Returns true when the condition is met (step should execute).
 * Returns false when the condition is not met (step should be skipped).
 */
function evaluateCondition(
  condition: Condition,
  values: Record<string, number | string>
): boolean {
  const lhs = values[condition.field];
  const rhs = condition.value;

  switch (condition.cmp) {
    case "is":
      // String equality (case-sensitive) or numeric equality.
      return lhs === rhs;
    case "is not":
      return lhs !== rhs;
    case ">":
      return Number(lhs) > Number(rhs);
    case "<":
      return Number(lhs) < Number(rhs);
    case ">=":
      return Number(lhs) >= Number(rhs);
    case "<=":
      return Number(lhs) <= Number(rhs);
    default: {
      // Exhaustive-check guard — TypeScript should catch this at compile time.
      const _exhaustive: never = condition.cmp;
      throw new Error(`Unknown condition cmp: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Round `value` to the nearest multiple of `interval` (ties round up).
 */
function roundNearest(value: number, interval: number): number {
  if (interval <= 0) throw new RangeError("round interval must be > 0");
  return Math.round(value / interval) * interval;
}

/**
 * Round `value` UP to the next multiple of `interval`.
 */
function roundUp(value: number, interval: number): number {
  if (interval <= 0) throw new RangeError("round interval must be > 0");
  return Math.ceil(value / interval) * interval;
}

/**
 * Round `value` DOWN to the previous multiple of `interval`.
 */
function roundDown(value: number, interval: number): number {
  if (interval <= 0) throw new RangeError("round interval must be > 0");
  return Math.floor(value / interval) * interval;
}

// ---------------------------------------------------------------------------
// evaluateSteps — public API
// ---------------------------------------------------------------------------

/**
 * Evaluate an ordered list of ChargeStep objects against a map of named
 * values.
 *
 * @param steps  Ordered step list. Must not be empty.
 * @param values Map of field-name → numeric or string value. String values
 *               may appear in condition comparisons but not in arithmetic.
 *
 * @returns `{ total, trail }` where `trail.length === steps.length`.
 *
 * @throws StepArithmeticTypeError  when a field with a string value is used
 *         as an arithmetic operand.
 * @throws Error  when `steps` is empty or the first step is not `start`.
 */
export function evaluateSteps(
  steps: ChargeStep[],
  values: Record<string, number | string>
): { total: number; trail: TrailEntry[] } {
  if (steps.length === 0) throw new Error("steps must not be empty");
  if (steps[0].op !== "start") throw new Error("first step must be op: start");

  const trail: TrailEntry[] = [];
  let running = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Helper to push a non-skipped trail entry.
    const pushApplied = (newTotal: number): void => {
      running = newTotal;
      trail.push({ index: i, op: step.op, runningTotal: running, skipped: false });
    };

    // Helper to push a skipped trail entry.
    const pushSkipped = (): void => {
      trail.push({ index: i, op: step.op, runningTotal: running, skipped: true });
    };

    // Helper to check a condition (if present). Returns true = proceed.
    const conditionMet = (when: Condition | undefined): boolean => {
      if (!when) return true;
      return evaluateCondition(when, values);
    };

    switch (step.op) {
      case "start": {
        const val = resolveNumeric(step.field, values);
        pushApplied(val);
        break;
      }
      case "multiply": {
        if (!conditionMet(step.when)) { pushSkipped(); break; }
        const val = resolveNumeric(step.field, values);
        pushApplied(running * val);
        break;
      }
      case "divide": {
        if (!conditionMet(step.when)) { pushSkipped(); break; }
        const val = resolveNumeric(step.field, values);
        if (val === 0) throw new Error("divide by zero at step " + i);
        pushApplied(running / val);
        break;
      }
      case "add": {
        if (!conditionMet(step.when)) { pushSkipped(); break; }
        const val = resolveNumeric(step.field, values);
        pushApplied(running + val);
        break;
      }
      case "subtract": {
        if (!conditionMet(step.when)) { pushSkipped(); break; }
        const val = resolveNumeric(step.field, values);
        pushApplied(running - val);
        break;
      }
      case "round": {
        switch (step.direction) {
          case "nearest":
            pushApplied(roundNearest(running, step.interval));
            break;
          case "up":
            pushApplied(roundUp(running, step.interval));
            break;
          case "down":
            pushApplied(roundDown(running, step.interval));
            break;
          default: {
            const _exhaustive: never = step.direction;
            throw new Error(`Unknown round direction: ${String(_exhaustive)}`);
          }
        }
        break;
      }
      case "floor": {
        if (!conditionMet(step.when)) { pushSkipped(); break; }
        pushApplied(Math.max(running, step.value));
        break;
      }
      case "cap": {
        if (!conditionMet(step.when)) { pushSkipped(); break; }
        pushApplied(Math.min(running, step.value));
        break;
      }
      default: {
        const _exhaustive: never = step;
        throw new Error(`Unknown step op: ${String((_exhaustive as ChargeStep).op)}`);
      }
    }
  }

  return { total: running, trail };
}
