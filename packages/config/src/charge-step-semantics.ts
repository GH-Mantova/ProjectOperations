/**
 * charge-step-semantics.ts — CHARGE_STEP_PARITY_V1
 *
 * The single source of truth for what a stored ChargeStep list evaluates to.
 * Both the server evaluator (`apps/api/src/modules/rates/rate-step-evaluator.ts`)
 * and the admin preview (`apps/web/src/pages/admin/ChargeStepsEditor.tsx`) call
 * `evaluateChargeSteps` here, so the price the editor previews and the price the
 * server would produce for the same stored rule and the same row cannot differ.
 *
 * Modelled on `forms-rule-definition.ts`, which exists for the same reason: the
 * form rules engine must not drift between client and server.
 *
 * THE COMPARISON RULE, IN ONE SENTENCE:
 *   `is` compares the two operands as text with case ignored, so 150 matches
 *   "150" and "Inverted" matches "inverted", and `is not` is exactly its
 *   negation — while `>` `<` `>=` `<=` keep coercing both sides with `Number`,
 *   which yields false whenever either side is not a number.
 *
 * THE ERROR TAXONOMY, IN ONE SENTENCE:
 *   A step that cannot be worked out returns a `ChargeStepIssue` naming the
 *   step rather than guessing a number, and from that step onward the running
 *   total is `null` — never a plausible-looking figure.
 *
 * A missing operand used to resolve to 0 on the server and to a silent no-op in
 * the preview; text in an arithmetic slot used to throw on the server and be a
 * silent no-op in the preview; divide-by-zero used to throw on the server and
 * be silently skipped in the preview. All three are now the same named issue on
 * both sides.
 */

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

/** Comparison operators a step condition may use. */
export type ConditionCmp = "is" | "is not" | ">" | "<" | ">=" | "<=";

/** `when` clause carried by a conditional step. */
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
  /** Field name (looked up in `values`) or a numeric literal. */
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

/** A single cell value a step may read: a number, or text from a TEXT column. */
export type StepValue = number | string;

/** Field name → cell value for the row a step list is evaluated against. */
export type StepValues = Record<string, StepValue>;

// ---------------------------------------------------------------------------
// The error taxonomy
// ---------------------------------------------------------------------------

/**
 * Every way a step can fail to produce a number. These are returned, never
 * guessed at, so both sides report the same thing about the same step.
 */
export type ChargeStepIssueCode =
  /** The operand names a field the row has no value for. */
  | "missing-operand"
  /** The operand names a field whose value is text; text is not arithmetic. */
  | "text-operand"
  /** The divisor resolved to zero. */
  | "divide-by-zero"
  /** A `round` step carries an interval that is not greater than zero. */
  | "bad-round-interval";

export interface ChargeStepIssue {
  code: ChargeStepIssueCode;
  /** Zero-based index of the step that could not be worked out. */
  stepIndex: number;
  /** Operand field name, when the issue is about an operand. */
  field?: string;
  /** The offending text, when the issue is `text-operand`. */
  text?: string;
  /** One sentence, without a step number. See `describeChargeStepIssue`. */
  message: string;
}

/**
 * The message for each issue code. Defined once so the editor and the server
 * say the same words about the same failure.
 */
export function chargeStepIssueMessage(
  code: ChargeStepIssueCode,
  field?: string
): string {
  switch (code) {
    case "missing-operand":
      return `"${field ?? ""}" has no value in this row, so this step cannot be worked out.`;
    case "text-operand":
      return "Text belongs in the 'only when' part of a step, not in the sum.";
    case "divide-by-zero":
      return "Cannot divide by zero.";
    case "bad-round-interval":
      return "Round interval must be greater than zero.";
    default: {
      const _exhaustive: never = code;
      return String(_exhaustive);
    }
  }
}

/** Build an issue. The message is always derived from the code. */
export function chargeStepIssue(
  code: ChargeStepIssueCode,
  stepIndex: number,
  detail?: { field?: string; text?: string }
): ChargeStepIssue {
  const issue: ChargeStepIssue = {
    code,
    stepIndex,
    message: chargeStepIssueMessage(code, detail?.field)
  };
  if (detail?.field !== undefined) issue.field = detail.field;
  if (detail?.text !== undefined) issue.text = detail.text;
  return issue;
}

/** Render an issue against the step it belongs to: `Step 3: …` (1-based). */
export function describeChargeStepIssue(issue: ChargeStepIssue): string {
  return `Step ${issue.stepIndex + 1}: ${issue.message}`;
}

// ---------------------------------------------------------------------------
// The comparison rule — ONE implementation of `is` / `is not`
// ---------------------------------------------------------------------------

/**
 * `is` / `is not` compare as text with case ignored. A field with no value in
 * the row never `is` anything (and therefore always `is not`).
 */
function textEquals(lhs: StepValue | null | undefined, rhs: string | number): boolean {
  if (lhs === null || lhs === undefined) return false;
  return String(lhs).toLowerCase() === String(rhs).toLowerCase();
}

/**
 * Compare one condition operand pair. This is the only implementation of the
 * step comparison rule in the repository.
 *
 * An unknown comparator is unreachable through the types and can only arrive
 * from corrupt stored data; it counts as "not met", so the step is skipped
 * rather than applied on a comparison nobody defined.
 */
export function compareStepCondition(
  cmp: ConditionCmp,
  lhs: StepValue | null | undefined,
  rhs: string | number
): boolean {
  switch (cmp) {
    case "is":
      return textEquals(lhs, rhs);
    case "is not":
      return !textEquals(lhs, rhs);
    case ">":
      return Number(lhs) > Number(rhs);
    case "<":
      return Number(lhs) < Number(rhs);
    case ">=":
      return Number(lhs) >= Number(rhs);
    case "<=":
      return Number(lhs) <= Number(rhs);
    default:
      return false;
  }
}

/** True when the step should execute. A step with no `when` always executes. */
export function stepConditionMet(
  when: Condition | undefined,
  values: StepValues
): boolean {
  if (!when) return true;
  return compareStepCondition(when.cmp, values[when.field], when.value);
}

// ---------------------------------------------------------------------------
// Operand resolution — ONE implementation
// ---------------------------------------------------------------------------

export type StepOperandResult =
  | { ok: true; value: number }
  | { ok: false; code: "missing-operand" | "text-operand"; field: string; text?: string };

/**
 * Resolve a step operand to a number.
 *
 * A numeric literal resolves to itself. A field name is looked up in `values`:
 * an absent (or null) value is `missing-operand`; a text value is
 * `text-operand` even when the text happens to look like a number, because a
 * TEXT column is not an arithmetic column.
 */
export function resolveStepOperand(
  field: string | number,
  values: StepValues
): StepOperandResult {
  if (typeof field === "number") return { ok: true, value: field };
  const raw = values[field];
  if (raw === undefined || raw === null) {
    return { ok: false, code: "missing-operand", field };
  }
  if (typeof raw === "string") {
    return { ok: false, code: "text-operand", field, text: raw };
  }
  return { ok: true, value: raw };
}

// ---------------------------------------------------------------------------
// Rounding — ONE implementation
// ---------------------------------------------------------------------------

function applyRound(
  value: number,
  direction: RoundStep["direction"],
  interval: number
): number {
  const quotient = value / interval;
  switch (direction) {
    case "nearest":
      return Math.round(quotient) * interval;
    case "up":
      return Math.ceil(quotient) * interval;
    case "down":
      return Math.floor(quotient) * interval;
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// evaluateChargeSteps — the shared engine
// ---------------------------------------------------------------------------

export interface ChargeStepTrailEntry {
  /** Zero-based index of this step in the step list. */
  index: number;
  op: ChargeStep["op"];
  /**
   * Running total AFTER this step (unchanged when skipped), or `null` when the
   * total is no longer knowable — this step, or an earlier one, could not be
   * worked out. `null` must never be rendered as a figure.
   */
  runningTotal: number | null;
  /** True when the step's condition was evaluated and was not met. */
  skipped: boolean;
  /** The reason this step could not be worked out, or `null`. */
  issue: ChargeStepIssue | null;
}

export interface ChargeStepEvaluation {
  /** Final total, or `null` when any step could not be worked out. */
  total: number | null;
  /** One entry per step, in order. */
  trail: ChargeStepTrailEntry[];
  /** Every issue found, in step order. */
  issues: ChargeStepIssue[];
}

/**
 * Evaluate an ordered ChargeStep list against a row of values.
 *
 * Steps run in order and the running total is passed along. A step whose
 * condition is not met is skipped and leaves the total untouched. A step that
 * cannot be worked out records a `ChargeStepIssue` and makes the running total
 * `null` from that point on; later steps are still inspected so every problem
 * in the list is reported at once.
 *
 * This function makes no assumptions about the shape of the list — an empty
 * list, or one that does not begin with `start`, is a caller-contract matter,
 * not an arithmetic one.
 */
export function evaluateChargeSteps(
  steps: readonly ChargeStep[],
  values: StepValues
): ChargeStepEvaluation {
  const trail: ChargeStepTrailEntry[] = [];
  const issues: ChargeStepIssue[] = [];
  let running: number | null = steps.length === 0 ? null : 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    const push = (issue: ChargeStepIssue | null, skipped: boolean): void => {
      if (issue) issues.push(issue);
      trail.push({ index: i, op: step.op, runningTotal: running, skipped, issue });
    };

    const fail = (issue: ChargeStepIssue): void => {
      running = null;
      push(issue, false);
    };

    // Condition first: a skipped step neither computes nor complains.
    const when = (step as { when?: Condition }).when;
    if (when && !stepConditionMet(when, values)) {
      push(null, true);
      continue;
    }

    switch (step.op) {
      case "start":
      case "multiply":
      case "divide":
      case "add":
      case "subtract": {
        const operand = resolveStepOperand(step.field, values);
        if (!operand.ok) {
          fail(
            chargeStepIssue(operand.code, i, { field: operand.field, text: operand.text })
          );
          break;
        }
        if (step.op === "divide" && operand.value === 0) {
          fail(chargeStepIssue("divide-by-zero", i, { field: String(step.field) }));
          break;
        }
        if (step.op === "start") {
          // `start` seeds the total, so it is the one step that can recover a
          // total an earlier broken step made unknowable.
          running = operand.value;
          push(null, false);
          break;
        }
        if (running === null) {
          push(null, false);
          break;
        }
        if (step.op === "multiply") running = running * operand.value;
        else if (step.op === "divide") running = running / operand.value;
        else if (step.op === "add") running = running + operand.value;
        else running = running - operand.value;
        push(null, false);
        break;
      }
      case "round": {
        if (!(step.interval > 0) || !Number.isFinite(step.interval)) {
          fail(chargeStepIssue("bad-round-interval", i));
          break;
        }
        if (running === null) {
          push(null, false);
          break;
        }
        running = applyRound(running, step.direction, step.interval);
        push(null, false);
        break;
      }
      case "floor": {
        if (running !== null) running = Math.max(running, step.value);
        push(null, false);
        break;
      }
      case "cap": {
        if (running !== null) running = Math.min(running, step.value);
        push(null, false);
        break;
      }
      default: {
        // Unknown op from corrupt stored data: leave the total alone.
        push(null, false);
        break;
      }
    }
  }

  return { total: running, trail, issues };
}
