/**
 * ChargeStepsEditor unit tests (vitest, no jsdom required).
 *
 * Covered:
 *  1. stepSentence — plain-sentence rendering for each op
 *  2. stepsToFormula — formula string from step list
 *  3. validateSteps — client-side validation rules
 *  4. evaluateStepsClient — running-total preview logic
 *  5. numericFieldOptions / allFieldOptions — column filtering helpers
 *  6. Add / remove / reorder step mutations (pure array operations)
 *  7. Condition add/remove — steps with and without conditions
 *  8. Invalid-list save guard — canSave is false for an invalid list
 *  9. CHARGE_STEP_PARITY_V1 — the comparison rule and the error taxonomy the
 *     preview now shares with apps/api/src/modules/rates/rate-step-evaluator.ts.
 *     Every expected number below is the number that file's spec asserts for
 *     the same input.
 * 10. CHARGE_STEP_CARD_V2 — what the card PUTS ON SCREEN: the line total, the
 *     measurement-then-money rule, units, decimal places, the spoken menu
 *     labels, the round wording and the formula tokens. Presentation only —
 *     every figure asserted below is the figure CHARGE_STEP_PARITY_V1 already
 *     produced for the same input.
 * 11. CHARGE_STEP_GUARDS_V1 — the three guards that pin step 1: a reorder
 *     into slot 0 keeps `start` there, step 1 has no remove control and
 *     `removeStep` refuses index 0, and a non-empty list is never offered a
 *     second `start`. Neither validation rule moved; the state they reject is
 *     simply not reachable from the card, which the search at the end of this
 *     file walks exhaustively.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildStepValues,
  describeChargeStepIssue,
  evaluateChargeSteps,
  type ChargeStepTrailEntry,
  type RateLineField
} from "@project-ops/config/charge-step-semantics";
import {
  stepSentence,
  stepsToFormula,
  validateSteps,
  evaluateStepsClient,
  numericFieldOptions,
  allFieldOptions,
  formatStepTotal,
  stepTotalPresentations,
  CMP_LABELS,
  CONDITION_CMPS,
  CONDITIONAL_OPS,
  FORMULA_TOTAL,
  KNOWN_OPS,
  LINE_TOTAL_LABEL,
  LINE_TOTAL_UNKNOWN,
  MEASUREMENT,
  OP_LABELS,
  addableOps,
  appendStep,
  canLeadStepList,
  canMoveStep,
  canRemoveStep,
  removeStepAt,
  reorderSteps,
  // CHARGE_STEP_INPLACE_V1
  ChargeStepRow,
  FIELD_SOURCE_LABELS,
  FIXED_VALUE_OPS,
  OPERAND_NUMBER_LABEL,
  OPERAND_NUMBER_VALUE,
  buildStepOfOp,
  changeStepOp,
  coerceConditionValue,
  conditionFieldGroups,
  conditionValueOptions,
  defaultCondition,
  defaultOperand,
  fieldChoiceLabel,
  fieldChoices,
  isOpOfferableAt,
  newStepFor,
  operandFieldValue,
  operandGroups,
  operandOptionList,
  parseOperandValue,
  replaceStepAt,
  setStepCondition,
  setStepFixedValue,
  setStepOperand,
  setStepRound,
  stepCarry,
  type RateColumnMeta,
  type StepOp,
  type TotalPresentation
} from "../ChargeStepsEditor";
import type { ChargeStep } from "../../../lib/chargeStepTypes";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARD_SRC = readFileSync(resolve(__dirname, "..", "ChargeStepsEditor.tsx"), "utf-8");
const MOUNT_SRC = readFileSync(resolve(__dirname, "..", "RatesListsAdminPage.tsx"), "utf-8");

// ── Fixtures ───────────────────────────────────────────────────────────────

const COLS: RateColumnMeta[] = [
  { id: "c1", name: "Depth", dataType: "NUMBER", role: "KEY" },
  { id: "c2", name: "Rate", dataType: "NUMBER", role: "VALUE" },
  { id: "c3", name: "Material", dataType: "TEXT", role: "KEY" },
  { id: "c4", name: "Area", dataType: "NUMBER", role: "VALUE" }
];

const COL_NAMES = COLS.map((c) => c.name);

// ── CHARGE_STEP_INPLACE_V1 fixtures and rendering helpers ─────────────────
//
// apps/web has no jsdom and no testing-library; the house pattern is to render
// a component to static markup and assert on the string. The controls ARE the
// product of this slice, so a source grep would prove nothing about what a
// person actually sees — these render the real row.

/** The mock-up's Core holes table: two columns, one of them text. */
const INPLACE_COLS: RateColumnMeta[] = [
  { id: "ic1", name: "Diameter", dataType: "NUMBER", role: "KEY", unit: "mm" },
  { id: "ic2", name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "$ / hole per 10 mm" },
  { id: "ic3", name: "Material", dataType: "TEXT", role: "KEY" }
];

/** Its line fields: two numbers and one text with a declared option list. */
const INPLACE_LINE_FIELDS: RateLineField[] = [
  { name: "Depth", kind: "number", unit: "mm", sample: 18 },
  { name: "Elevation", kind: "text", options: ["Floor", "Wall", "Inverted"], sample: "Inverted" },
  { name: "Holes", kind: "number", sample: 12 }
];

const noop = () => {};

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** The markup one step row renders. */
function rowMarkup(
  step: ChargeStep,
  index: number,
  opts: {
    columns?: RateColumnMeta[];
    lineFields?: readonly RateLineField[];
    trailEntry?: ChargeStepTrailEntry;
    presentation?: TotalPresentation;
    invalid?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
  } = {}
): string {
  return renderToStaticMarkup(
    <ul>
      <ChargeStepRow
        step={step}
        index={index}
        columns={opts.columns ?? INPLACE_COLS}
        lineFields={opts.lineFields ?? INPLACE_LINE_FIELDS}
        trailEntry={opts.trailEntry}
        presentation={opts.presentation ?? MEASUREMENT}
        invalid={opts.invalid ?? false}
        canMoveUp={opts.canMoveUp ?? index > 0}
        canMoveDown={opts.canMoveDown ?? true}
        onChange={noop}
        onMoveUp={noop}
        onMoveDown={noop}
        onRemove={noop}
      />
    </ul>
  );
}

/** The markup a whole list renders, wired the way the card wires it. */
function listMarkup(
  steps: ChargeStep[],
  columns: RateColumnMeta[] = INPLACE_COLS,
  lineFields: readonly RateLineField[] = INPLACE_LINE_FIELDS
): string {
  return renderToStaticMarkup(
    <ul>
      {steps.map((step, i) => (
        <ChargeStepRow
          key={i}
          step={step}
          index={i}
          columns={columns}
          lineFields={lineFields}
          presentation={MEASUREMENT}
          invalid={false}
          canMoveUp={canMoveStep(steps, i, i - 1)}
          canMoveDown={canMoveStep(steps, i, i + 1)}
          onChange={noop}
          onMoveUp={noop}
          onMoveDown={noop}
          onRemove={noop}
        />
      ))}
    </ul>
  );
}

/**
 * The markup of the ONE element carrying this aria-label, when it is a
 * `<select>`. Returns "" when the label names an `<input>` instead — which is
 * exactly the distinction the condition value control turns on.
 */
function selectBlock(html: string, ariaLabel: string): string {
  const at = html.indexOf(`aria-label="${ariaLabel}"`);
  if (at < 0) return "";
  const open = html.lastIndexOf("<", at);
  if (!html.startsWith("<select", open)) return "";
  const close = html.indexOf("</select>", at);
  return html.slice(open, close);
}

/** The `<option>` labels of one named select, in render order. */
function optionsOf(html: string, ariaLabel: string): string[] {
  return Array.from(
    selectBlock(html, ariaLabel).matchAll(/<option[^>]*>([^<]*)<\/option>/g)
  ).map((m) => m[1]);
}

/** The `<option>` values that carry `disabled` on one named select. */
function disabledOptionsOf(html: string, ariaLabel: string): string[] {
  return Array.from(
    selectBlock(html, ariaLabel).matchAll(/<option value="([^"]*)"[^>]*\bdisabled\b/g)
  ).map((m) => m[1]);
}

/** Text as React writes it into markup. */
const asMarkup = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── 1. stepSentence ────────────────────────────────────────────────────────

describe("stepSentence", () => {
  it("renders start with column field", () => {
    const step: ChargeStep = { op: "start", field: "Depth" };
    expect(stepSentence(step, 0)).toBe("1. Start with Depth");
  });

  it("renders start with numeric literal", () => {
    const step: ChargeStep = { op: "start", field: 100 };
    expect(stepSentence(step, 0)).toBe("1. Start with 100");
  });

  it("renders multiply without condition", () => {
    const step: ChargeStep = { op: "multiply", field: "Rate" };
    expect(stepSentence(step, 1)).toBe("2. Multiply by Rate");
  });

  it("renders multiply with condition", () => {
    const step: ChargeStep = {
      op: "multiply",
      field: "Rate",
      when: { field: "Material", cmp: "is", value: "concrete" }
    };
    expect(stepSentence(step, 1)).toBe("2. Multiply by Rate when Material is concrete");
  });

  it("renders add", () => {
    expect(stepSentence({ op: "add", field: "Area" }, 2)).toBe("3. Add Area");
  });

  it("renders subtract", () => {
    expect(stepSentence({ op: "subtract", field: 5 }, 3)).toBe("4. Subtract 5");
  });

  it("renders divide", () => {
    expect(stepSentence({ op: "divide", field: "Depth" }, 4)).toBe("5. Divide by Depth");
  });

  it("renders round nearest", () => {
    // CHARGE_STEP_CARD_V2 — was "6. Round nearest to nearest 0.5".
    expect(stepSentence({ op: "round", direction: "nearest", interval: 0.5 }, 5)).toBe(
      "6. Round to the nearest 0.5"
    );
  });

  it("renders round up", () => {
    // CHARGE_STEP_CARD_V2 — was "1. Round up to nearest 1", which contradicts
    // itself: rounding up does not go to the nearest anything.
    expect(stepSentence({ op: "round", direction: "up", interval: 1 }, 0)).toBe(
      "1. Round up to the next 1"
    );
  });

  it("renders floor", () => {
    expect(stepSentence({ op: "floor", value: 10 }, 0)).toBe("1. Floor at 10");
  });

  it("renders cap with condition", () => {
    const step: ChargeStep = {
      op: "cap",
      value: 500,
      when: { field: "Material", cmp: "is not", value: "timber" }
    };
    expect(stepSentence(step, 0)).toBe("1. Cap at 500 when Material is not timber");
  });
});

// ── 2. stepsToFormula ──────────────────────────────────────────────────────

describe("stepsToFormula", () => {
  it("returns (empty) for no steps", () => {
    expect(stepsToFormula([])).toBe("(empty)");
  });

  it("builds a formula from a simple start + multiply", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Rate" }
    ];
    expect(stepsToFormula(steps)).toBe("Depth × Rate");
  });

  it("includes conditional multiply", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      {
        op: "multiply",
        field: "Rate",
        when: { field: "Material", cmp: "is", value: "concrete" }
      }
    ];
    expect(stepsToFormula(steps)).toContain("IF(Material is concrete");
  });
});

// ── 3. validateSteps ──────────────────────────────────────────────────────

describe("validateSteps", () => {
  it("returns no errors for an empty list", () => {
    expect(validateSteps([], COL_NAMES)).toHaveLength(0);
  });

  it("errors when first step is not start", () => {
    const steps: ChargeStep[] = [{ op: "multiply", field: "Rate" }];
    const errs = validateSteps(steps, COL_NAMES);
    expect(errs.some((e) => e.index === 0 && e.message.includes("start"))).toBe(true);
  });

  it("errors when field references non-existent column", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "NonExistentCol" }
    ];
    const errs = validateSteps(steps, COL_NAMES);
    expect(errs.some((e) => e.message.includes("NonExistentCol"))).toBe(true);
  });

  it("accepts numeric literals without checking column names", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 42 },
      { op: "multiply", field: 3.14 }
    ];
    expect(validateSteps(steps, COL_NAMES)).toHaveLength(0);
  });

  it("errors when condition references non-existent column", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Rate", when: { field: "BadCol", cmp: "is", value: "x" } }
    ];
    const errs = validateSteps(steps, COL_NAMES);
    expect(errs.some((e) => e.message.includes("BadCol"))).toBe(true);
  });

  it("passes a valid multi-step list", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Rate" },
      { op: "add", field: 10 },
      { op: "round", direction: "nearest", interval: 0.5 },
      { op: "floor", value: 0 }
    ];
    expect(validateSteps(steps, COL_NAMES)).toHaveLength(0);
  });
});

// ── 4. evaluateStepsClient ─────────────────────────────────────────────────

describe("evaluateStepsClient", () => {
  const VALUES: Record<string, number | string> = {
    Depth: 18,
    Rate: 2.5,
    Material: "concrete",
    Area: 3
  };

  it("computes start correctly", () => {
    const trail = evaluateStepsClient([{ op: "start", field: "Depth" }], VALUES);
    expect(trail[0].runningTotal).toBe(18);
    expect(trail[0].skipped).toBe(false);
  });

  it("multiplies running total", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Rate" }
    ];
    const trail = evaluateStepsClient(steps, VALUES);
    expect(trail[1].runningTotal).toBe(45); // 18 * 2.5
  });

  it("skips step when condition is not met", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      {
        op: "multiply",
        field: "Rate",
        when: { field: "Material", cmp: "is", value: "timber" }
      }
    ];
    const trail = evaluateStepsClient(steps, VALUES);
    expect(trail[1].skipped).toBe(true);
    expect(trail[1].runningTotal).toBe(18); // unchanged
  });

  it("applies step when condition is met", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      {
        op: "multiply",
        field: "Rate",
        when: { field: "Material", cmp: "is", value: "concrete" }
      }
    ];
    const trail = evaluateStepsClient(steps, VALUES);
    expect(trail[1].skipped).toBe(false);
    expect(trail[1].runningTotal).toBe(45);
  });

  it("handles round nearest", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 18.3 },
      { op: "round", direction: "nearest", interval: 1 }
    ];
    const trail = evaluateStepsClient(steps, {});
    expect(trail[1].runningTotal).toBe(18);
  });

  it("handles floor", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 5 },
      { op: "floor", value: 10 }
    ];
    const trail = evaluateStepsClient(steps, {});
    expect(trail[1].runningTotal).toBe(10);
  });

  it("handles cap", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 100 },
      { op: "cap", value: 50 }
    ];
    const trail = evaluateStepsClient(steps, {});
    expect(trail[1].runningTotal).toBe(50);
  });
});

// ── 5. numericFieldOptions / allFieldOptions ───────────────────────────────

describe("numericFieldOptions", () => {
  it("excludes TEXT and LIST_REF columns", () => {
    const result = numericFieldOptions(COLS);
    expect(result).toContain("Depth");
    expect(result).toContain("Rate");
    expect(result).not.toContain("Material"); // TEXT
  });
});

describe("allFieldOptions", () => {
  it("includes all columns including TEXT", () => {
    const result = allFieldOptions(COLS);
    expect(result).toContain("Material");
    expect(result).toContain("Depth");
  });
});

// ── 6. Add / remove / reorder (pure array operations) ─────────────────────

describe("step array mutations", () => {
  const makeSteps = (): ChargeStep[] => [
    { op: "start", field: "Depth" },
    { op: "multiply", field: "Rate" },
    { op: "add", field: 10 }
  ];

  it("add step appends to end", () => {
    const steps = makeSteps();
    const newStep: ChargeStep = { op: "floor", value: 0 };
    const next = appendStep(steps, newStep);
    expect(next).toHaveLength(4);
    expect(next[3]).toEqual(newStep);
  });

  it("remove step drops correct index", () => {
    const steps = makeSteps();
    const next = removeStepAt(steps, 1);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ op: "add", field: 10 });
  });

  it("move step up swaps with previous", () => {
    // CHARGE_STEP_GUARDS_V1 — the swap used to hand slot 0 to the multiply,
    // which is the state the card could not be saved from. The operands trade
    // instead, so slot 0 is still a `start`.
    const next = reorderSteps(makeSteps(), 1, 0);
    expect(next[0]).toEqual({ op: "start", field: "Rate" });
    expect(next[1]).toEqual({ op: "multiply", field: "Depth" });
  });

  it("move step down swaps with next", () => {
    const next = reorderSteps(makeSteps(), 1, 2);
    expect(next[1].op).toBe("add");
    expect(next[2].op).toBe("multiply");
  });
});

// ── 7. Condition add/remove ────────────────────────────────────────────────

describe("condition on step", () => {
  it("step with condition includes when clause in sentence", () => {
    const step: ChargeStep = {
      op: "multiply",
      field: "Rate",
      when: { field: "Material", cmp: "is", value: "concrete" }
    };
    expect(stepSentence(step, 0)).toContain("when Material is concrete");
  });

  it("removing condition from step omits clause", () => {
    const step: ChargeStep = { op: "multiply", field: "Rate" };
    expect(stepSentence(step, 0)).not.toContain("when");
  });

  it("validateSteps passes step with valid condition field", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Rate", when: { field: "Material", cmp: "is", value: "concrete" } }
    ];
    expect(validateSteps(steps, COL_NAMES)).toHaveLength(0);
  });
});

// ── 8. Invalid-list save guard (canSave logic) ─────────────────────────────

describe("canSave guard", () => {
  it("is false when steps are empty", () => {
    const dirty = true;
    const steps: ChargeStep[] = [];
    const errors = validateSteps(steps, COL_NAMES);
    const canSave = dirty && errors.length === 0 && steps.length > 0;
    expect(canSave).toBe(false);
  });

  it("is false when validation errors exist", () => {
    const dirty = true;
    const steps: ChargeStep[] = [{ op: "multiply", field: "Rate" }]; // first step not start
    const errors = validateSteps(steps, COL_NAMES);
    const canSave = dirty && errors.length === 0 && steps.length > 0;
    expect(canSave).toBe(false);
  });

  it("is false when not dirty", () => {
    const dirty = false;
    const steps: ChargeStep[] = [{ op: "start", field: "Depth" }];
    const errors = validateSteps(steps, COL_NAMES);
    const canSave = dirty && errors.length === 0 && steps.length > 0;
    expect(canSave).toBe(false);
  });

  it("is true when dirty, no errors, and non-empty steps", () => {
    const dirty = true;
    const steps: ChargeStep[] = [{ op: "start", field: "Depth" }];
    const errors = validateSteps(steps, COL_NAMES);
    const canSave = dirty && errors.length === 0 && steps.length > 0;
    expect(canSave).toBe(true);
  });
});

// ── 9. CHARGE_STEP_PARITY_V1 ──────────────────────────────────────────────
//
// The preview and the server evaluator now call one function. These pin the
// preview side of every divergence the parity slice closed; the matching
// server-side assertions live in
// apps/api/src/modules/rates/__tests__/rate-step-evaluator.spec.ts.

describe("comparison rule: is / is not", () => {
  const withCondition = (cmp: "is" | "is not", value: string | number): ChargeStep[] => [
    { op: "start", field: 100 },
    { op: "add", field: 50, when: { field: "Grade", cmp, value } }
  ];

  const totalOf = (steps: ChargeStep[], values: Record<string, number | string>) =>
    evaluateStepsClient(steps, values).at(-1)?.runningTotal ?? null;

  it("TEXT cell 150 against numeric condition value 150 applies the step", () => {
    // AddStepForm stores a numeric-looking condition value with Number(); the
    // scenario map holds a TEXT cell as a string. This used to match here and
    // never on the server.
    expect(totalOf(withCondition("is", 150), { Grade: "150" })).toBe(150);
  });

  it("NUMBER cell 150 against string condition value \"150\" applies the step", () => {
    expect(totalOf(withCondition("is", "150"), { Grade: 150 })).toBe(150);
  });

  it("ignores case: cell Inverted matches condition value inverted", () => {
    expect(totalOf(withCondition("is", "inverted"), { Grade: "Inverted" })).toBe(150);
  });

  it("does not match a genuinely different value", () => {
    expect(totalOf(withCondition("is", "Inverted"), { Grade: "Floor" })).toBe(100);
  });

  it("a field with no value in the row never `is` anything", () => {
    expect(totalOf(withCondition("is", "Inverted"), {})).toBe(100);
  });

  it("`is not` is the exact negation of `is` (case)", () => {
    expect(totalOf(withCondition("is not", "inverted"), { Grade: "Inverted" })).toBe(100);
  });

  it("`is not` is the exact negation of `is` (cross-type)", () => {
    expect(totalOf(withCondition("is not", 150), { Grade: "150" })).toBe(100);
  });

  it("`is not` applies when the field has no value in the row", () => {
    expect(totalOf(withCondition("is not", "Inverted"), {})).toBe(150);
  });

  it("does not match on a substring or on surrounding whitespace", () => {
    expect(totalOf(withCondition("is", "Invert"), { Grade: "Inverted" })).toBe(100);
    expect(totalOf(withCondition("is", "Inverted"), { Grade: " Inverted" })).toBe(100);
  });

  it("0 and \"0\" are equal, and neither matches an empty cell", () => {
    expect(totalOf(withCondition("is", 0), { Grade: "0" })).toBe(150);
    expect(totalOf(withCondition("is", 0), { Grade: "" })).toBe(100);
  });
});

describe("comparison rule: ordering comparators are unchanged", () => {
  const withCondition = (
    cmp: ">" | "<" | ">=" | "<=",
    value: string | number
  ): ChargeStep[] => [
    { op: "start", field: 100 },
    { op: "add", field: 50, when: { field: "Qty", cmp, value } }
  ];

  const totalOf = (steps: ChargeStep[], values: Record<string, number | string>) =>
    evaluateStepsClient(steps, values).at(-1)?.runningTotal ?? null;

  it("coerces numeric strings with Number on either side", () => {
    expect(totalOf(withCondition(">", 5), { Qty: "10" })).toBe(150);
    expect(totalOf(withCondition(">=", "10"), { Qty: 10 })).toBe(150);
  });

  it("is false for non-numeric cells and for absent fields", () => {
    expect(totalOf(withCondition(">", 5), { Qty: "heavy" })).toBe(100);
    expect(totalOf(withCondition("<", 5), { Qty: "heavy" })).toBe(100);
    expect(totalOf(withCondition(">=", 5), {})).toBe(100);
    expect(totalOf(withCondition("<=", 5), {})).toBe(100);
  });

  it("handles negative and zero boundaries", () => {
    expect(totalOf(withCondition(">=", 0), { Qty: 0 })).toBe(150);
    expect(totalOf(withCondition(">", 0), { Qty: 0 })).toBe(100);
    expect(totalOf(withCondition("<", 0), { Qty: -1 })).toBe(150);
  });
});

describe("error taxonomy: an unresolvable step prints no running total", () => {
  it("missing operand: start Depth / multiply Holes with Holes absent", () => {
    // The preview used to keep printing 150 beside the multiply, as if the
    // step had multiplied by 1. The server would have multiplied by 0.
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Holes" }
    ];
    const trail = evaluateStepsClient(steps, { Depth: 150 });
    expect(trail[0].runningTotal).toBe(150);
    expect(trail[1].runningTotal).toBeNull();
    expect(trail[1].issue?.code).toBe("missing-operand");
    expect(trail[1].issue?.field).toBe("Holes");
    expect(describeChargeStepIssue(trail[1].issue!)).toBe(
      'Step 2: "Holes" has no value in this row, so this step cannot be worked out.'
    );
  });

  it("every step after the broken one also prints no running total", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Holes" },
      { op: "add", field: 5 },
      { op: "round", direction: "nearest", interval: 1 },
      { op: "floor", value: 10 },
      { op: "cap", value: 1000 }
    ];
    const trail = evaluateStepsClient(steps, { Depth: 150 });
    for (const entry of trail.slice(1)) {
      expect(entry.runningTotal).toBeNull();
    }
  });

  it("text in an arithmetic slot carries the mock-up's message", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: "Material" }
    ];
    const trail = evaluateStepsClient(steps, { Material: "concrete" });
    expect(trail[1].runningTotal).toBeNull();
    expect(trail[1].issue?.code).toBe("text-operand");
    expect(trail[1].issue?.message).toBe(
      "Text belongs in the 'only when' part of a step, not in the sum."
    );
    expect(trail[1].issue?.stepIndex).toBe(1);
  });

  it("a numeric-looking string in an arithmetic slot is still text", () => {
    // The preview used to coerce "150" with Number() and multiply by it.
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: "Grade" }
    ];
    const trail = evaluateStepsClient(steps, { Grade: "150" });
    expect(trail[1].runningTotal).toBeNull();
    expect(trail[1].issue?.code).toBe("text-operand");
  });

  it("divide by zero is named, not silently skipped", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 100 },
      { op: "divide", field: 0 }
    ];
    const trail = evaluateStepsClient(steps, {});
    expect(trail[1].runningTotal).toBeNull();
    expect(trail[1].issue?.code).toBe("divide-by-zero");
    expect(trail[1].issue?.message).toBe("Cannot divide by zero.");
    expect(describeChargeStepIssue(trail[1].issue!)).toBe("Step 2: Cannot divide by zero.");
  });

  it("divide by a field that resolves to zero, including negative zero", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 100 },
      { op: "divide", field: "Divisor" }
    ];
    expect(evaluateStepsClient(steps, { Divisor: 0 })[1].issue?.code).toBe("divide-by-zero");
    expect(evaluateStepsClient(steps, { Divisor: -0 })[1].issue?.code).toBe("divide-by-zero");
  });

  it("a round interval of zero is named instead of producing NaN", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "round", direction: "nearest", interval: 0 }
    ];
    const trail = evaluateStepsClient(steps, {});
    expect(trail[1].runningTotal).toBeNull();
    expect(trail[1].issue?.code).toBe("bad-round-interval");
  });

  it("a skipped step with a broken operand reports nothing", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: "Gone", when: { field: "Material", cmp: "is", value: "timber" } }
    ];
    const trail = evaluateStepsClient(steps, { Material: "concrete" });
    expect(trail[1].skipped).toBe(true);
    expect(trail[1].issue).toBeNull();
    expect(trail[1].runningTotal).toBe(10);
  });

  it("an empty step list yields an empty trail", () => {
    expect(evaluateStepsClient([], {})).toHaveLength(0);
  });

  it("trail has one entry per step and preserves step order", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "add", field: 5 },
      { op: "multiply", field: 2 }
    ];
    const trail = evaluateStepsClient(steps, {});
    expect(trail.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(trail.map((e) => e.op)).toEqual(["start", "add", "multiply"]);
    // (10 + 5) * 2 = 30 — reordering the last two would give 10 + 5*2 = 20.
    expect(trail[2].runningTotal).toBe(30);
    const reordered: ChargeStep[] = [steps[0], steps[2], steps[1]];
    expect(evaluateStepsClient(reordered, {})[2].runningTotal).toBe(25);
  });

  it("zero and negative operands still compute", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 0 },
      { op: "add", field: -5 },
      { op: "multiply", field: -2 }
    ];
    expect(evaluateStepsClient(steps, {})[2].runningTotal).toBe(10);
  });
});

describe("parity with the server evaluator", () => {
  // Same steps, same values, same numbers on both sides. The server-side
  // assertions for these exact inputs are in rate-step-evaluator.spec.ts.
  const coreHoleSteps: ChargeStep[] = [
    { op: "start", field: "Depth" },
    { op: "divide", field: 10 },
    { op: "round", direction: "nearest", interval: 1 },
    { op: "floor", value: 1 },
    { op: "multiply", field: "Rate" },
    { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
    { op: "multiply", field: "Holes" }
  ];

  it("Depth=150, Rate=25, Elevation=Floor, Holes=3 -> 1125", () => {
    const values = { Depth: 150, Rate: 25, Elevation: "Floor", Holes: 3 };
    const trail = evaluateStepsClient(coreHoleSteps, values);
    expect(trail[6].runningTotal).toBe(1125);
    expect(trail[5].skipped).toBe(true);
    expect(evaluateChargeSteps(coreHoleSteps, values).total).toBe(1125);
  });

  it("Depth=50, Rate=30, Elevation=inverted (lower case), Holes=2 -> 600", () => {
    // Case-insensitive now, so the lower-cased cell applies the Inverted
    // multiply on both sides. Before parity neither side applied it.
    const values = { Depth: 50, Rate: 30, Elevation: "inverted", Holes: 2 };
    expect(evaluateStepsClient(coreHoleSteps, values)[6].runningTotal).toBe(600);
  });

  it("Holes missing -> no total, and the multiply step names itself", () => {
    const values = { Depth: 150, Rate: 25, Elevation: "Floor" };
    const trail = evaluateStepsClient(coreHoleSteps, values);
    expect(trail[6].runningTotal).toBeNull();
    expect(trail[6].issue?.code).toBe("missing-operand");
    expect(evaluateChargeSteps(coreHoleSteps, values).total).toBeNull();
  });
});

// ── 10. CHARGE_STEP_CARD_V2 ───────────────────────────────────────────────
//
// This slice changes what the card SHOWS, not what it computes. Every figure
// asserted here is first taken from the shared evaluator, then written down —
// the tests pin the writing down.

const CARD_COLS: RateColumnMeta[] = [
  { id: "k1", name: "Depth", dataType: "NUMBER", role: "KEY", unit: "mm" },
  { id: "k2", name: "Holes", dataType: "NUMBER", role: "KEY" },
  { id: "v1", name: "Price", dataType: "CURRENCY", role: "VALUE", unit: "each" },
  { id: "v2", name: "Area", dataType: "NUMBER", role: "VALUE", unit: "m2" }
];

/** What the card prints beside each step, for a step list and a row. */
function cardFigures(
  steps: ChargeStep[],
  values: Record<string, number | string>,
  columns: RateColumnMeta[] = CARD_COLS
): Array<string | null> {
  const trail = evaluateStepsClient(steps, values);
  const presentations = stepTotalPresentations(steps, columns, trail);
  return trail.map((entry, i) =>
    entry.runningTotal === null
      ? null
      : formatStepTotal(entry.runningTotal, presentations[i] ?? MEASUREMENT)
  );
}

/** What the LINE TOTAL row prints — the last trail entry, never a second sum. */
function lineTotalFigure(
  steps: ChargeStep[],
  values: Record<string, number | string>,
  columns: RateColumnMeta[] = CARD_COLS
): string {
  const trail = evaluateStepsClient(steps, values);
  const presentations = stepTotalPresentations(steps, columns, trail);
  const last = trail.length > 0 ? trail[trail.length - 1].runningTotal : null;
  return last === null
    ? LINE_TOTAL_UNKNOWN
    : formatStepTotal(last, presentations[presentations.length - 1] ?? MEASUREMENT);
}

describe("CHARGE_STEP_CARD_V2: the line total closes the list", () => {
  const steps: ChargeStep[] = [
    { op: "start", field: "Depth" },
    { op: "multiply", field: "Holes" },
    { op: "multiply", field: "Price" }
  ];
  const values = { Depth: 18, Holes: 3, Price: 12 };

  it("is the last running total, not a second sum", () => {
    const trail = evaluateStepsClient(steps, values);
    expect(trail.map((e) => e.runningTotal)).toEqual([18, 54, 648]);
    // Same number the shared evaluator calls the total — one arithmetic path.
    expect(evaluateChargeSteps(steps, values).total).toBe(648);
    expect(lineTotalFigure(steps, values)).toBe("$648.00");
  });

  it("prints no figure when a step above could not be worked out", () => {
    const broken: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Missing" }
    ];
    const trail = evaluateStepsClient(broken, { Depth: 18 });
    expect(trail[1].runningTotal).toBeNull();
    expect(lineTotalFigure(broken, { Depth: 18 })).toBe(LINE_TOTAL_UNKNOWN);
    expect(LINE_TOTAL_UNKNOWN).not.toMatch(/[0-9]/);
    // ...and the step itself still names the reason.
    expect(describeChargeStepIssue(trail[1].issue!)).toBe(
      'Step 2: "Missing" has no value in this row, so this step cannot be worked out.'
    );
  });

  it("is labelled as the mock-up labels it", () => {
    expect(LINE_TOTAL_LABEL).toBe("LINE TOTAL");
  });
});

describe("CHARGE_STEP_CARD_V2: decimal places", () => {
  it("prints two, not four", () => {
    // Was `18.3333` (toFixed(4)); now `18.33`.
    expect(formatStepTotal(18.3333, MEASUREMENT)).toBe("18.33");
    expect(formatStepTotal(18.3333, { money: true })).toBe("$18.33");
  });

  it("leaves a whole number whole", () => {
    expect(formatStepTotal(18, MEASUREMENT)).toBe("18");
    expect(formatStepTotal(18, { money: false, unit: "mm" })).toBe("18 mm");
  });
});

describe("CHARGE_STEP_CARD_V2: a running total says what it is", () => {
  it("carries the operand column's unit while it is still that measurement", () => {
    // Was `18`; now `18 mm`, because Depth is measured in millimetres.
    expect(cardFigures([{ op: "start", field: "Depth" }], { Depth: 18 })).toEqual(["18 mm"]);
  });

  it("has no unit when the column has none", () => {
    expect(cardFigures([{ op: "start", field: "Holes" }], { Holes: 3 })).toEqual(["3"]);
  });

  it("keeps the unit through round, floor and cap", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "round", direction: "up", interval: 10 },
      { op: "floor", value: 5 },
      { op: "cap", value: 1000 }
    ];
    expect(cardFigures(steps, { Depth: 18 })).toEqual(["18 mm", "20 mm", "20 mm", "20 mm"]);
  });

  it("drops the unit once the total stops being that measurement", () => {
    // A depth times a count is no longer a depth.
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Holes" }
    ];
    expect(cardFigures(steps, { Depth: 18, Holes: 3 })).toEqual(["18 mm", "54"]);
  });

  it("keeps the unit when multiplying by a dimensionless literal", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: 2 }
    ];
    expect(cardFigures(steps, { Depth: 18 })).toEqual(["18 mm", "36 mm"]);
  });
});

describe("CHARGE_STEP_CARD_V2: money only once a price has entered", () => {
  // Four steps, CURRENCY entering at step 3.
  const steps: ChargeStep[] = [
    { op: "start", field: "Depth" },
    { op: "add", field: 4.5 },
    { op: "multiply", field: "Price" },
    { op: "multiply", field: 1.1 }
  ];
  const values = { Depth: 18, Price: 12 };

  it("steps 1-2 are measurements, steps 3-4 are money", () => {
    expect(cardFigures(steps, values)).toEqual(["18 mm", "22.50 mm", "$270.00", "$297.00"]);
    const presentations = stepTotalPresentations(steps, CARD_COLS, evaluateStepsClient(steps, values));
    expect(presentations.map((p) => p.money)).toEqual([false, false, true, true]);
  });

  it("the arithmetic is unchanged by the presentation", () => {
    expect(evaluateStepsClient(steps, values).map((e) => e.runningTotal)).toEqual([
      18, 22.5, 270, 297
    ]);
  });

  it("a skipped currency step does not turn the total into money", () => {
    const conditional: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Price", when: { field: "Holes", cmp: ">", value: 5 } }
    ];
    const withValues = { Depth: 18, Holes: 1, Price: 12 };
    expect(evaluateStepsClient(conditional, withValues)[1].skipped).toBe(true);
    expect(cardFigures(conditional, withValues)).toEqual(["18 mm", "18 mm"]);
  });

  it("a start on a CURRENCY column is money from step 1", () => {
    expect(cardFigures([{ op: "start", field: "Price" }], { Price: 12 })).toEqual(["$12.00"]);
  });

  it("uses the same en-AU formatter as the rows table", () => {
    expect(CARD_SRC).toContain('new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })');
    expect(MOUNT_SRC).toContain('new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })');
    expect(formatStepTotal(1234.5, { money: true })).toBe("$1,234.50");
  });
});

describe("CHARGE_STEP_CARD_V2: menus speak, storage keys stay", () => {
  it("the operation menu reads as the mock-up reads", () => {
    expect(KNOWN_OPS.map((o) => OP_LABELS[o])).toEqual([
      "Start with",
      "Multiply by",
      "Divide by",
      "Add",
      "Subtract",
      "Round",
      "Never less than",
      "Never more than"
    ]);
  });

  it("the comparator menu reads as the mock-up reads", () => {
    expect(CONDITION_CMPS.map((c) => CMP_LABELS[c])).toEqual([
      "is",
      "is not",
      "is more than",
      "is less than",
      "is at least",
      "is at most"
    ]);
  });

  it("the option value attributes are still the stored keys", () => {
    // Asserted on the markup the row actually renders, not on the source that
    // produces it: the menu SPEAKS the label and STORES the key.
    const html = rowMarkup(
      { op: "multiply", field: "Rate", when: { field: "Elevation", cmp: ">=", value: 2 } },
      1
    );
    for (const op of KNOWN_OPS) {
      expect(html).toContain(`value="${op}"`);
      expect(html).toContain(`>${OP_LABELS[op]}</option>`);
    }
    for (const cmp of CONDITION_CMPS) {
      expect(html).toContain(`>${CMP_LABELS[cmp]}</option>`);
    }
    // `>=` and `<=` are escaped in an attribute, and are still the stored key.
    expect(html).toContain('value="&gt;="');
    expect(html).toContain('value="&lt;="');
  });

  it("a saved step still stores the key, never the label", () => {
    const saved: ChargeStep = {
      op: "cap",
      value: 500,
      when: { field: "Depth", cmp: ">=", value: 100 }
    };
    expect(JSON.stringify(saved)).toBe(
      '{"op":"cap","value":500,"when":{"field":"Depth","cmp":">=","value":100}}'
    );
  });
});

describe("CHARGE_STEP_CARD_V2: round wording", () => {
  it("says one thing per direction", () => {
    expect(stepSentence({ op: "round", direction: "nearest", interval: 10 }, 0)).toBe(
      "1. Round to the nearest 10"
    );
    expect(stepSentence({ op: "round", direction: "up", interval: 10 }, 0)).toBe(
      "1. Round up to the next 10"
    );
    expect(stepSentence({ op: "round", direction: "down", interval: 10 }, 0)).toBe(
      "1. Round down to the last 10"
    );
  });

  it("never says the self-contradictory old wording", () => {
    for (const direction of ["nearest", "up", "down"] as const) {
      const sentence = stepSentence({ op: "round", direction, interval: 10 }, 0);
      expect(sentence).not.toContain("up to nearest");
      expect(sentence).not.toContain("down to nearest");
    }
  });
});

describe("CHARGE_STEP_CARD_V2: the formula is spreadsheet-shaped", () => {
  const steps: ChargeStep[] = [
    { op: "start", field: "Depth" },
    { op: "multiply", field: "Price" },
    { op: "round", direction: "up", interval: 10 },
    { op: "floor", value: 100 },
    { op: "cap", value: 500 }
  ];

  it("emits real functions for round, floor and cap", () => {
    expect(stepsToFormula(steps)).toBe(
      "Depth × Price ROUNDUP(TOTAL, 10) MAX(TOTAL, 100) MIN(TOTAL, 500)"
    );
  });

  it("emits ROUND / ROUNDUP / ROUNDDOWN per direction", () => {
    expect(stepsToFormula([{ op: "round", direction: "nearest", interval: 5 }])).toBe(
      "ROUND(TOTAL, 5)"
    );
    expect(stepsToFormula([{ op: "round", direction: "down", interval: 5 }])).toBe(
      "ROUNDDOWN(TOTAL, 5)"
    );
  });

  it("keeps the IF(...) shape for conditions", () => {
    const conditional: ChargeStep[] = [
      { op: "floor", value: 100, when: { field: "Depth", cmp: ">=", value: 50 } }
    ];
    expect(stepsToFormula(conditional)).toBe("MAX(TOTAL, IF(Depth >= 50, 100, TOTAL))");
  });

  it("emits none of the tokens no spreadsheet accepts", () => {
    const formula = stepsToFormula(steps);
    expect(formula).not.toContain("[round");
    expect(formula).not.toContain("max(");
    expect(formula).not.toContain("min(");
    expect(formula).not.toContain("·");
    expect(FORMULA_TOTAL).toBe("TOTAL");
  });
});

describe("CHARGE_STEP_CARD_V2: the card itself", () => {
  it("carries the marker", () => {
    expect(CARD_SRC).toContain("CHARGE_STEP_CARD_V2");
  });

  it("keeps CHARGE_STEP_PARITY_V1 and the shared evaluator", () => {
    expect(CARD_SRC).toContain("CHARGE_STEP_PARITY_V1");
    expect(CARD_SRC).toContain('from "@project-ops/config/charge-step-semantics"');
    // No second copy of any rule: the editor still has no checkCondition.
    expect(CARD_SRC).not.toContain("function checkCondition");
  });

  it("renders the line-total row between the step list and the add control", () => {
    const lineTotal = CARD_SRC.indexOf('data-testid="line-total"');
    const addStep = CARD_SRC.indexOf('data-testid="add-step-btn"');
    const list = CARD_SRC.indexOf('aria-label="Charge step list"');
    expect(list).toBeGreaterThan(-1);
    expect(addStep).toBeGreaterThan(-1);
    expect(lineTotal).toBeGreaterThan(list);
    expect(lineTotal).toBeLessThan(addStep);
  });

  it("still prints the issue, and no figure, for an unresolvable step", () => {
    const step: ChargeStep = { op: "multiply", field: "Nowhere" };
    const trail = evaluateStepsClient(
      [{ op: "start", field: "Depth" }, step],
      { Depth: 2 }
    );
    expect(trail[1].issue?.code).toBe("missing-operand");
    const html = rowMarkup(step, 1, { trailEntry: trail[1] });
    expect(html).toContain('data-testid="step-issue-1"');
    expect(html).toContain(asMarkup(describeChargeStepIssue(trail[1].issue!)));
    // No figure in the running-total slot, and no stray em dash pretending
    // to be one either — the reason is what stands there.
    expect(html).not.toContain("<b>");
  });

  it("takes every new colour from a token, with no hex literal", () => {
    const styles = CARD_SRC.slice(CARD_SRC.indexOf("const lineTotalRowStyle"));
    expect(styles).toContain('background: "var(--surface-subtle)"');
    expect(styles).toContain('borderTop: "2px solid var(--border-default)"');
    expect(styles).toContain('color: "var(--text-primary)"');
    expect(styles).toContain('color: "var(--status-danger)"');
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("passes the column unit through at the mount point", () => {
    expect(MOUNT_SRC).toContain("unit: c.unit");
  });

  it("no longer formats a total to four decimal places", () => {
    expect(CARD_SRC).not.toContain("toFixed(4)");
  });
});

// ── 11. CHARGE_STEP_GUARDS_V1 ─────────────────────────────────────────────
//
// The card used to be walkable into a state it could not be saved from, and
// in one case could not be walked back out of. These pin the three guards
// that close it. Neither validation rule moved: `validateSteps` above and the
// 400 in apps/api/src/modules/rates/rate-tables.service.ts still reject a
// first step that is not a `start` — the point is that nothing the card
// offers can produce one.

const PINNED_COLS: RateColumnMeta[] = [
  { id: "g1", name: "Depth", dataType: "NUMBER", role: "KEY", unit: "mm" },
  { id: "g2", name: "Holes", dataType: "NUMBER", role: "KEY" },
  { id: "g3", name: "Fee", dataType: "CURRENCY", role: "VALUE" }
];
const PINNED_COL_NAMES = PINNED_COLS.map((c) => c.name);

/** The prompt's list: 1 Start with Depth, 2 Multiply by Holes, 3 Add Fee. */
const pinnedSteps = (): ChargeStep[] => [
  { op: "start", field: "Depth" },
  { op: "multiply", field: "Holes" },
  { op: "add", field: "Fee" }
];

const SCENARIO = { Depth: 2, Holes: 3, Fee: 10 };
const sentences = (steps: ChargeStep[]) => steps.map((s, i) => stepSentence(s, i));
const finalTotal = (steps: ChargeStep[]) => {
  const trail = evaluateStepsClient(steps, SCENARIO);
  return trail[trail.length - 1].runningTotal;
};

describe("CHARGE_STEP_GUARDS_V1: a reorder into slot 0 keeps the start there", () => {
  it("moving step 2 to the top leaves a saveable list", () => {
    const before = pinnedSteps();
    const after = reorderSteps(before, 1, 0);

    expect(sentences(after)).toEqual([
      "1. Start with Holes",
      "2. Multiply by Depth",
      "3. Add Fee"
    ]);

    // The red panel renders when there is at least one validation error, and
    // Save is enabled on `dirty && no errors && steps.length > 0`.
    const errors = validateSteps(after, PINNED_COL_NAMES);
    expect(errors).toEqual([]);
    const redPanelShown = errors.length > 0;
    expect(redPanelShown).toBe(false);
    const dirty = true;
    const canSave = dirty && errors.length === 0 && after.length > 0;
    expect(canSave).toBe(true);
  });

  it("the swap trades operands, so the arithmetic is the one the list already had", () => {
    const before = pinnedSteps();
    const after = reorderSteps(before, 1, 0);
    // 2 × 3 + 10 both ways.
    expect(finalTotal(before)).toBe(16);
    expect(finalTotal(after)).toBe(16);
  });

  it("leaves no second start behind", () => {
    const after = reorderSteps(pinnedSteps(), 1, 0);
    expect(after.filter((s) => s.op === "start")).toHaveLength(1);
    expect(after[0].op).toBe("start");
  });

  it("moving step 1 down is the same move and lands the same way", () => {
    expect(reorderSteps(pinnedSteps(), 0, 1)).toEqual(reorderSteps(pinnedSteps(), 1, 0));
  });

  it("the plain swap this replaced is what made the list unsaveable", () => {
    const swapped = pinnedSteps();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(validateSteps(swapped, PINNED_COL_NAMES)).toContainEqual({
      index: 0,
      message: 'First step must have op "start".'
    });
  });

  it("refuses to put a step with no operand in slot 0, and changes nothing", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "round", direction: "nearest", interval: 10 }
    ];
    expect(reorderSteps(steps, 1, 0)).toBe(steps);
    expect(reorderSteps(steps, 0, 1)).toBe(steps);
    expect(canLeadStepList(steps[1])).toBe(false);
    expect(canLeadStepList(steps[0])).toBe(true);
  });

  it("a swap that does not touch slot 0 is an ordinary swap", () => {
    const after = reorderSteps(pinnedSteps(), 1, 2);
    expect(sentences(after)).toEqual([
      "1. Start with Depth",
      "2. Add Fee",
      "3. Multiply by Holes"
    ]);
  });

  it("refuses an out-of-range or no-op move", () => {
    const steps = pinnedSteps();
    expect(reorderSteps(steps, 0, 0)).toBe(steps);
    expect(reorderSteps(steps, 2, 3)).toBe(steps);
    expect(reorderSteps(steps, 0, -1)).toBe(steps);
  });
});

describe("CHARGE_STEP_GUARDS_V1: step 1 has no remove control", () => {
  it("renders one fewer remove control than there are steps", () => {
    const steps = pinnedSteps();
    const rendered = steps.filter((_, i) => canRemoveStep(i));
    // Was one per step: 3 -> 2. Step 1 ("Start with Depth") is the one that
    // loses it.
    expect(steps).toHaveLength(3);
    expect(rendered).toHaveLength(2);
    expect(canRemoveStep(0)).toBe(false);
    expect(stepSentence(steps[0], 0)).toBe("1. Start with Depth");
  });

  it("removeStep(0) removes nothing", () => {
    const steps = pinnedSteps();
    const next = removeStepAt(steps, 0);
    expect(next).toHaveLength(3);
    expect(next).toBe(steps);
  });

  it("removeStep on any other index still drops that step", () => {
    const next = removeStepAt(pinnedSteps(), 1);
    expect(next).toHaveLength(2);
    expect(sentences(next)).toEqual(["1. Start with Depth", "2. Add Fee"]);
  });

  it("the list renders one fewer remove control than it has steps", () => {
    const html = listMarkup(pinnedSteps(), PINNED_COLS, []);
    expect(count(html, 'data-testid="remove-step-')).toBe(2);
    expect(html).not.toContain('data-testid="remove-step-0"');
    expect(html).toContain('data-testid="remove-step-1"');
    expect(html).toContain('data-testid="remove-step-2"');
    // Step 1 keeps its column: the control is replaced by a spacer, not
    // dropped, so the actions stay aligned down the list.
    expect(CARD_SRC).toContain("{canRemoveStep(index) ? (");
    expect(CARD_SRC).toContain("style={iconSpacerStyle}");
  });

  it("step 1 can still be replaced: add, move to the top, remove the old one", () => {
    const added = appendStep(pinnedSteps(), { op: "multiply", field: 2 });
    const promoted = reorderSteps(reorderSteps(reorderSteps(added, 3, 2), 2, 1), 1, 0);
    const cleaned = removeStepAt(promoted, 1);
    expect(promoted[0]).toEqual({ op: "start", field: 2 });
    expect(cleaned).toHaveLength(3);
    expect(validateSteps(cleaned, PINNED_COL_NAMES)).toEqual([]);
  });
});

describe("CHARGE_STEP_GUARDS_V1: no second start", () => {
  it("offers start only while the list is empty", () => {
    expect(addableOps(0).map((o) => OP_LABELS[o])).toEqual(["Start with"]);
    expect(addableOps(3).map((o) => OP_LABELS[o])).toEqual([
      "Multiply by",
      "Divide by",
      "Add",
      "Subtract",
      "Round",
      "Never less than",
      "Never more than"
    ]);
    expect(addableOps(3)).not.toContain("start");
    expect(addableOps(3)).toHaveLength(KNOWN_OPS.length - 1);
  });

  it("defaults the form to the first op that can be added", () => {
    expect(addableOps(0)[0]).toBe("start");
    expect(addableOps(3)[0]).toBe("multiply");
    expect(OP_LABELS[addableOps(3)[0]]).toBe("Multiply by");
  });

  it("the guard is now in the row's own menu, and there is no add form left", () => {
    // CHARGE_STEP_INPLACE_V1 removed the parallel form. The rule did not move
    // with it: `addableOps` and the row menu ask the SAME predicate.
    expect(CARD_SRC).not.toContain("function AddStepForm");
    expect(CARD_SRC).toContain("return KNOWN_OPS.filter((o) => isOpOfferableAt(o, stepCount));");
    expect(CARD_SRC).toContain("disabled={!isOpOfferableAt(op, index)}");
    for (const count of [0, 1, 3, 7]) {
      expect(addableOps(count)).toEqual(KNOWN_OPS.filter((o) => isOpOfferableAt(o, count)));
    }
  });

  it("refuses a second start even if one is handed to it", () => {
    const steps = pinnedSteps();
    expect(appendStep(steps, { op: "start", field: "Fee" })).toBe(steps);
  });

  it("refuses a first step that is not a start", () => {
    const empty: ChargeStep[] = [];
    expect(appendStep(empty, { op: "multiply", field: "Holes" })).toBe(empty);
    expect(appendStep(empty, { op: "start", field: "Depth" })).toEqual([
      { op: "start", field: "Depth" }
    ]);
  });

  it("still appends anything else to the end", () => {
    const next = appendStep(pinnedSteps(), { op: "floor", value: 0 });
    expect(next).toHaveLength(4);
    expect(next[3]).toEqual({ op: "floor", value: 0 });
  });
});

describe("CHARGE_STEP_GUARDS_V1: the error is unreachable, not tolerated", () => {
  const SAMPLES: Record<StepOp, ChargeStep> = {
    start: { op: "start", field: "Depth" },
    multiply: { op: "multiply", field: "Holes" },
    divide: { op: "divide", field: "Holes" },
    add: { op: "add", field: "Fee" },
    subtract: { op: "subtract", field: "Fee" },
    round: { op: "round", direction: "nearest", interval: 10 },
    floor: { op: "floor", value: 5 },
    cap: { op: "cap", value: 100 }
  };

  /** Every list one card action can produce from this one. */
  const successors = (steps: ChargeStep[]): ChargeStep[][] => {
    const out: ChargeStep[][] = [];
    for (let i = 1; i < steps.length; i++) out.push(reorderSteps(steps, i, i - 1));
    for (let i = 0; i < steps.length - 1; i++) out.push(reorderSteps(steps, i, i + 1));
    for (let i = 0; i < steps.length; i++) out.push(removeStepAt(steps, i));
    if (steps.length < 4) {
      for (const op of addableOps(steps.length)) out.push(appendStep(steps, SAMPLES[op]));
    }
    return out;
  };

  it("no sequence of card actions reaches a first step that is not a start", () => {
    const seen = new Set<string>();
    const queue: ChargeStep[][] = [[], pinnedSteps()];
    for (const s of queue) seen.add(JSON.stringify(s));

    while (queue.length > 0) {
      const state = queue.shift() as ChargeStep[];
      // The rule the API and validateSteps both enforce, checked on every
      // state the card can be in.
      if (state.length > 0) {
        expect(state[0].op).toBe("start");
        expect(state.filter((s) => s.op === "start")).toHaveLength(1);
      }
      expect(
        validateSteps(state, PINNED_COL_NAMES).some(
          (e) => e.message === 'First step must have op "start".'
        )
      ).toBe(false);

      for (const next of successors(state)) {
        const key = JSON.stringify(next);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push(next);
      }
    }

    // Every list reachable from an empty card and from the prompt's list, up
    // to four steps. The figure is the size of the search, not a target.
    expect(seen.size).toBe(7401);
  });

  it("every mutator that writes the list goes through a guard", () => {
    // The only two writers of `steps` state are `load` (server data) and
    // `updateSteps`; every call of the latter is a guarded delegation.
    expect(CARD_SRC.match(/setSteps\(/g)).toHaveLength(2);
    // Five now: CHARGE_STEP_INPLACE_V1 added `editStep`, which is a fifth
    // guarded delegation, not a fifth way to write the list.
    expect(CARD_SRC.match(/updateSteps\(/g)).toHaveLength(5);
    expect(CARD_SRC.match(/if \(next !== steps\) updateSteps\(next\);/g)).toHaveLength(5);
    expect(CARD_SRC).toContain("const next = reorderSteps(steps, index, index - 1);");
    expect(CARD_SRC).toContain("const next = reorderSteps(steps, index, index + 1);");
    expect(CARD_SRC).toContain("const next = removeStepAt(steps, index);");
    expect(CARD_SRC).toContain("const next = appendStep(steps, step);");
    expect(CARD_SRC).toContain("const next = replaceStepAt(steps, index, step);");
  });

  it("neither validation rule was relaxed", () => {
    expect(validateSteps([{ op: "multiply", field: "Holes" }], PINNED_COL_NAMES)).toContainEqual({
      index: 0,
      message: 'First step must have op "start".'
    });
    expect(CARD_SRC).toContain(
      `errors.push({ index: 0, message: 'First step must have op "start".' });`
    );
  });

  it("carries the marker", () => {
    expect(CARD_SRC).toContain("CHARGE_STEP_GUARDS_V1");
  });
});

// ── RATE_LINE_FIELDS_V1 ───────────────────────────────────────────────────
//
// A charge step can now name a value the ESTIMATOR enters as well as one the
// rate table stores. These tests pin the mock-up's four worked examples on the
// client side; the server side of the same four is in
// apps/api/src/modules/rates/__tests__/rate-step-evaluator.spec.ts, and both
// build their values map with the SAME function, so a divergence fails here.

const CORE_COLS: RateColumnMeta[] = [
  { id: "c-diameter", name: "Diameter", dataType: "NUMBER", role: "KEY", unit: "mm" },
  { id: "c-rate", name: "Rate", dataType: "CURRENCY", role: "VALUE" }
];

const CORE_LINE_FIELDS: RateLineField[] = [
  { name: "Depth", kind: "number", unit: "mm", sample: 18 },
  { name: "Elevation", kind: "text", options: ["Floor", "Wall", "Inverted"], sample: "Inverted" },
  { name: "Holes", kind: "number", sample: 12 }
];

const CORE_STEPS: ChargeStep[] = [
  { op: "start", field: "Depth" },
  { op: "divide", field: 10 },
  { op: "round", direction: "nearest", interval: 1 },
  { op: "floor", value: 1 },
  { op: "multiply", field: "Rate" },
  { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
  { op: "multiply", field: "Holes" }
];

describe("RATE_LINE_FIELDS_V1: the operand pickers offer line fields", () => {
  it("a number line field is offered as an arithmetic operand", () => {
    const result = numericFieldOptions(CORE_COLS, CORE_LINE_FIELDS);
    expect(result).toEqual(["Diameter", "Rate", "Depth", "Holes"]);
  });

  it("a text line field is NOT offered as an arithmetic operand", () => {
    expect(numericFieldOptions(CORE_COLS, CORE_LINE_FIELDS)).not.toContain("Elevation");
  });

  it("a text line field IS offered as a condition field", () => {
    expect(allFieldOptions(CORE_COLS, CORE_LINE_FIELDS)).toContain("Elevation");
  });

  it("declaring no line fields leaves both lists exactly as they were", () => {
    expect(numericFieldOptions(COLS, [])).toEqual(numericFieldOptions(COLS));
    expect(allFieldOptions(COLS, [])).toEqual(allFieldOptions(COLS));
  });
});

describe("RATE_LINE_FIELDS_V1: validateSteps knows the two mistakes apart", () => {
  const NAMES = allFieldOptions(CORE_COLS, CORE_LINE_FIELDS);
  const TEXT_NAMES = ["Elevation"];

  it("accepts the mock-up's Core holes rule", () => {
    expect(validateSteps(CORE_STEPS, NAMES, TEXT_NAMES)).toEqual([]);
  });

  it("a name that exists nowhere and text in the sum say different things", () => {
    const unknown = validateSteps(
      [{ op: "start", field: "Depht" }],
      NAMES,
      TEXT_NAMES
    );
    const textInSum = validateSteps(
      [{ op: "start", field: "Elevation" }],
      NAMES,
      TEXT_NAMES
    );
    expect(unknown[0].message).toBe(
      'Field "Depht" is not a column or line field on this table.'
    );
    expect(textInSum[0].message).toBe(
      'Field "Elevation" is text, so it can only be used in an "only when" condition, not in the sum.'
    );
    expect(unknown[0].message).not.toBe(textInSum[0].message);
  });

  it("the first-step-must-be-start rule is untouched", () => {
    expect(validateSteps([{ op: "multiply", field: "Depth" }], NAMES, TEXT_NAMES)).toContainEqual({
      index: 0,
      message: 'First step must have op "start".'
    });
  });
});

describe("RATE_LINE_FIELDS_V1: buildStepValues is the one values map", () => {
  it("merges the matched row's cells with the declared line fields", () => {
    expect(
      buildStepValues(CORE_COLS, { "c-diameter": 32, "c-rate": 1.7 }, CORE_LINE_FIELDS)
    ).toEqual({ Diameter: 32, Rate: 1.7, Depth: 18, Elevation: "Inverted", Holes: 12 });
  });

  it("mock-up example 1 — Core holes previews 81.60, the figure the server produces", () => {
    const values = buildStepValues(
      CORE_COLS,
      { "c-diameter": 32, "c-rate": 1.7 },
      CORE_LINE_FIELDS
    );
    const trail = evaluateStepsClient(CORE_STEPS, values);
    expect(trail.map((t) => t.runningTotal)).toEqual([18, 1.8, 2, 2, 3.4, 6.8, 81.6]);
    expect(evaluateChargeSteps(CORE_STEPS, values).total).toBeCloseTo(81.6, 10);
    expect(
      formatStepTotal(trail[6].runningTotal as number, { money: true })
    ).toBe("$81.60");
  });

  it("mock-up example 2 — Saw cuts by depth band previews 454.80", () => {
    const values = buildStepValues(
      [{ id: "c-rate", name: "Rate", dataType: "CURRENCY", role: "VALUE" }],
      { "c-rate": 18.95 },
      [{ name: "Metres", kind: "number", unit: "m", sample: 24 }]
    );
    const steps: ChargeStep[] = [
      { op: "start", field: "Rate" },
      { op: "multiply", field: "Metres" }
    ];
    expect(evaluateStepsClient(steps, values).at(-1)?.runningTotal).toBeCloseTo(454.8, 10);
  });

  it("mock-up example 3 — Saw cuts by the millimetre previews 691.20", () => {
    const values = buildStepValues(
      [{ id: "c-rate", name: "Rate", dataType: "CURRENCY", role: "VALUE" }],
      { "c-rate": 18 },
      [
        { name: "Depth", kind: "number", unit: "mm", sample: 40 },
        { name: "Metres", kind: "number", unit: "m", sample: 24 }
      ]
    );
    const steps: ChargeStep[] = [
      { op: "start", field: "Rate" },
      { op: "multiply", field: "Depth" },
      { op: "divide", field: 25 },
      { op: "floor", value: 18 },
      { op: "multiply", field: "Metres" }
    ];
    expect(evaluateStepsClient(steps, values).map((t) => t.runningTotal)).toEqual([
      18, 720, 28.8, 28.8, 691.2
    ]);
  });

  it("mock-up example 4 — Labour day rates previews 10800", () => {
    const values = buildStepValues(
      [{ id: "c-day", name: "Day rate", dataType: "CURRENCY", role: "VALUE" }],
      { "c-day": 600 },
      [
        { name: "Men", kind: "number", sample: 3 },
        { name: "Days", kind: "number", sample: 6 }
      ]
    );
    const steps: ChargeStep[] = [
      { op: "start", field: "Day rate" },
      { op: "multiply", field: "Men" },
      { op: "multiply", field: "Days" }
    ];
    expect(evaluateStepsClient(steps, values).at(-1)?.runningTotal).toBe(10800);
  });

  it("a line field with no value follows the column rule: missing-operand", () => {
    const values = buildStepValues(CORE_COLS, { "c-rate": 1.7 }, [
      { name: "Depth", kind: "number" }
    ]);
    const trail = evaluateStepsClient([{ op: "start", field: "Depth" }], values);
    expect(trail[0].runningTotal).toBeNull();
    expect(trail[0].issue?.code).toBe("missing-operand");
  });

  it("a column-only table produces exactly the map the card built before", () => {
    // The pre-slice builder: cells by column id, numbers kept, everything else
    // stringified, null and undefined skipped.
    const cells = { c1: 150, c2: 25, c3: "concrete", c4: null };
    const legacy: Record<string, number | string> = {};
    for (const col of COLS) {
      const raw = (cells as Record<string, unknown>)[col.id];
      if (raw === null || raw === undefined) continue;
      legacy[col.name] = typeof raw === "number" ? raw : String(raw);
    }
    expect(buildStepValues(COLS, cells, [])).toEqual(legacy);
  });
});

describe("RATE_LINE_FIELDS_V1: the card and its mount are wired for line fields", () => {
  it("the card takes lineFields and builds its values map with the shared builder", () => {
    expect(CARD_SRC).toContain("lineFields?: readonly RateLineField[];");
    expect(CARD_SRC).toContain("return buildStepValues(columns, row?.cells, lineFields);");
    // Exactly one implementation of the map, on this side of the wire.
    expect(CARD_SRC.match(/buildStepValues\(/g)).toHaveLength(1);
  });

  it("the card does not send lineFields back — it has no UI to edit them yet", () => {
    expect(CARD_SRC).toContain("body: JSON.stringify({ steps })");
  });

  it("the mount passes the table's declared line fields", () => {
    expect(MOUNT_SRC).toContain("lineFields={table.lineFields ?? []}");
    expect(MOUNT_SRC).toContain("lineFields?: RateLineField[] | null;");
  });

  it("carries the marker", () => {
    expect(CARD_SRC).toContain("RATE_LINE_FIELDS_V1");
  });
});

// ── CHARGE_STEP_INPLACE_V1 ────────────────────────────────────────────────
//
// The step row IS the editor, and there is ONE control for choosing an
// operand. Before this slice, changing step 2 of a five-step rule meant
// removing steps 2 to 5 and retyping four of them in order — and the first
// thing removed was the step being corrected. These pin the row's controls,
// the one operand picker, the condition pill, and the fact that the step-1
// guards moved INTO those controls rather than being copied beside them.

describe("CHARGE_STEP_INPLACE_V1: one operand picker, both sources labelled", () => {
  it("renders the whole menu: two labelled groups, then a number", () => {
    expect(operandOptionList(INPLACE_COLS, INPLACE_LINE_FIELDS)).toEqual([
      "the rate table",
      "Diameter (mm)",
      "Rate ($ / hole per 10 mm)",
      "the estimate line",
      "Depth (mm)",
      "Holes",
      "a number…"
    ]);
  });

  it("labels the two sources the way the mock-up's Fields table does", () => {
    expect(FIELD_SOURCE_LABELS).toStrictEqual({
      table: "the rate table",
      line: "the estimate line"
    });
    const groups = operandGroups(INPLACE_COLS, INPLACE_LINE_FIELDS);
    expect(groups.map((g) => g.label)).toEqual(["the rate table", "the estimate line"]);
    expect(groups[0].choices.map((c) => c.name)).toEqual(["Diameter", "Rate"]);
    expect(groups[1].choices.map((c) => c.name)).toEqual(["Depth", "Holes"]);
  });

  it("offers exactly what numericFieldOptions offers, in that order", () => {
    const offered = operandGroups(INPLACE_COLS, INPLACE_LINE_FIELDS).flatMap((g) =>
      g.choices.map((c) => c.name)
    );
    expect(offered).toEqual(numericFieldOptions(INPLACE_COLS, INPLACE_LINE_FIELDS));
  });

  it("the condition picker offers what allFieldOptions offers, text included", () => {
    const offered = conditionFieldGroups(INPLACE_COLS, INPLACE_LINE_FIELDS).flatMap((g) =>
      g.choices.map((c) => c.name)
    );
    expect(offered).toEqual(allFieldOptions(INPLACE_COLS, INPLACE_LINE_FIELDS));
  });

  it("a text field is in the condition picker and out of the operand picker", () => {
    // Material is a TEXT COLUMN; Elevation is a TEXT LINE FIELD. Neither is
    // arithmetic, and both are legible in an "only when".
    const html = rowMarkup(
      { op: "multiply", field: "Rate", when: { field: "Elevation", cmp: "is", value: "Inverted" } },
      1
    );
    expect(optionsOf(html, "Step 2 operand")).toEqual([
      "Diameter (mm)",
      "Rate ($ / hole per 10 mm)",
      "Depth (mm)",
      "Holes",
      "a number…"
    ]);
    expect(optionsOf(html, "Step 2 operand")).not.toContain("Material");
    expect(optionsOf(html, "Step 2 condition field")).toContain("Material");
    expect(optionsOf(html, "Step 2 condition field")).toContain("Elevation");
  });

  it("draws the groups as optgroups, so the sources are separable on screen", () => {
    const html = rowMarkup({ op: "multiply", field: "Rate" }, 1);
    expect(html).toContain('<optgroup label="the rate table">');
    expect(html).toContain('<optgroup label="the estimate line">');
  });

  it("is ONE component, used once, and the old three-control trio is gone", () => {
    expect(count(CARD_SRC, "export function OperandPicker(")).toBe(1);
    expect(count(CARD_SRC, "<OperandPicker")).toBe(1);
    // The add form's Mode / Column / Value arrangement no longer exists.
    expect(CARD_SRC).not.toContain('aria-label="Field input mode"');
    expect(CARD_SRC).not.toContain('aria-label="Field column"');
    expect(CARD_SRC).not.toContain('<option value="column">Column</option>');
  });

  it("the number option reveals a numeric input, and stores a number", () => {
    const html = rowMarkup({ op: "multiply", field: 2 }, 1);
    expect(html).toContain(`<option value="${OPERAND_NUMBER_VALUE}" selected="">${OPERAND_NUMBER_LABEL}</option>`);
    expect(html).toContain('aria-label="Step 2 number"');
    expect(html).toContain('value="2"');
    // A field operand shows no numeric input at all.
    expect(rowMarkup({ op: "multiply", field: "Rate" }, 1)).not.toContain('aria-label="Step 2 number"');
  });

  it("round its own thing, and neither floor nor cap is offered a field", () => {
    expect(FIXED_VALUE_OPS).toEqual(["floor", "cap"]);
    for (const step of [
      { op: "floor", value: 18 } as ChargeStep,
      { op: "cap", value: 500 } as ChargeStep
    ]) {
      const html = rowMarkup(step, 1);
      expect(html).not.toContain('aria-label="Step 2 operand"');
      expect(html).toContain('aria-label="Step 2 value"');
    }
    const round = rowMarkup({ op: "round", direction: "nearest", interval: 1 }, 2);
    expect(round).not.toContain('aria-label="Step 3 operand"');
    expect(optionsOf(round, "Step 3 round direction")).toEqual([
      "to the nearest",
      "up to the next",
      "down to the last"
    ]);
    expect(round).toContain("whole number");
  });

  it("keeps a step's own name offerable after the table stops declaring it", () => {
    // A column rename must not make the row lie about what the step holds.
    const html = rowMarkup({ op: "multiply", field: "Widthh" }, 1);
    expect(html).toContain(`<option value="${operandFieldValue("Widthh")}" selected="">Widthh</option>`);
    expect(optionsOf(html, "Step 2 operand")[0]).toBe("Widthh");
  });

  it("round-trips an option value", () => {
    expect(parseOperandValue(operandFieldValue("Day rate"))).toStrictEqual({ field: "Day rate" });
    expect(parseOperandValue(OPERAND_NUMBER_VALUE)).toStrictEqual({ number: true });
  });

  it("names a field with its unit, and without one when it has none", () => {
    const choices = fieldChoices(INPLACE_COLS, INPLACE_LINE_FIELDS);
    expect(choices.map(fieldChoiceLabel)).toEqual([
      "Diameter (mm)",
      "Rate ($ / hole per 10 mm)",
      "Material",
      "Depth (mm)",
      "Holes",
      "Elevation"
    ]);
    expect(choices.filter((c) => c.text).map((c) => c.name)).toEqual(["Material", "Elevation"]);
    expect(choices.filter((c) => c.source === "line").map((c) => c.name)).toEqual([
      "Depth",
      "Holes",
      "Elevation"
    ]);
  });
});

describe("CHARGE_STEP_INPLACE_V1: a step is edited where it sits", () => {
  /** The prompt's list: 1 Start with Depth, 2 Multiply by Holes, 3 Add Fee. */
  const threeSteps = (): ChargeStep[] => [
    { op: "start", field: "Depth" },
    { op: "multiply", field: "Holes" },
    { op: "add", field: "Fee" }
  ];

  it("changing step 2's operand is ONE write, and the other steps are untouched", () => {
    const before = threeSteps();
    const after = replaceStepAt(before, 1, setStepOperand(before[1], "Rate"));
    expect(after.map((st, i) => stepSentence(st, i))).toEqual([
      "1. Start with Depth",
      "2. Multiply by Rate",
      "3. Add Fee"
    ]);
    // Steps 1 and 3 are the SAME objects: nothing was removed and retyped.
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(after).toHaveLength(3);
  });

  it("changing the operation keeps the operand and the condition", () => {
    const step: ChargeStep = {
      op: "multiply",
      field: "Rate",
      when: { field: "Elevation", cmp: "is", value: "Inverted" }
    };
    expect(changeStepOp(step, "divide", "Depth")).toStrictEqual({
      op: "divide",
      field: "Rate",
      when: { field: "Elevation", cmp: "is", value: "Inverted" }
    });
  });

  it("changing to round or back keeps what the new op can use", () => {
    const multiply: ChargeStep = { op: "multiply", field: "Holes" };
    const round = changeStepOp(multiply, "round", "Depth");
    expect(round).toStrictEqual({ op: "round", direction: "nearest", interval: 1 });
    // Coming back, `round` carries no operand, so the fallback is used.
    expect(changeStepOp(round, "multiply", "Depth")).toStrictEqual({
      op: "multiply",
      field: "Depth"
    });
  });

  it("a numeric operand carries into a floor; a named field cannot", () => {
    expect(changeStepOp({ op: "multiply", field: 2 }, "floor", "Depth")).toStrictEqual({
      op: "floor",
      value: 2
    });
    expect(changeStepOp({ op: "multiply", field: "Rate" }, "cap", "Depth")).toStrictEqual({
      op: "cap",
      value: 0
    });
  });

  it("start drops a condition, because a skipped start leaves nothing to work from", () => {
    const conditional: ChargeStep = {
      op: "multiply",
      field: "Depth",
      when: { field: "Elevation", cmp: "is", value: "Inverted" }
    };
    const started = changeStepOp(conditional, "start", "Depth");
    expect(started).toStrictEqual({ op: "start", field: "Depth" });
    expect("when" in started).toBe(false);
  });

  it("changing to the op it already has changes nothing at all", () => {
    const step: ChargeStep = { op: "multiply", field: "Holes" };
    expect(changeStepOp(step, "multiply", "Depth")).toBe(step);
    expect(setStepOperand(step, "Holes")).toBe(step);
    expect(setStepFixedValue({ op: "cap", value: 5 }, 5).op).toBe("cap");
  });

  it("never writes an explicit `when: undefined`, which JSON would carry", () => {
    const step: ChargeStep = {
      op: "multiply",
      field: "Holes",
      when: { field: "Elevation", cmp: "is", value: "Inverted" }
    };
    const bare = setStepCondition(step, undefined);
    expect(bare).toStrictEqual({ op: "multiply", field: "Holes" });
    expect(Object.prototype.hasOwnProperty.call(bare, "when")).toBe(false);
    expect(JSON.stringify(bare)).toBe('{"op":"multiply","field":"Holes"}');
    // Which is what the card sends: the PATCH body is the steps, verbatim.
    expect(CARD_SRC).toContain("body: JSON.stringify({ steps })");
  });

  it("stepCarry reads only what a step actually holds", () => {
    expect(stepCarry({ op: "start", field: "Depth" })).toStrictEqual({ field: "Depth" });
    expect(stepCarry({ op: "round", direction: "up", interval: 10 })).toStrictEqual({
      direction: "up",
      interval: 10
    });
    expect(stepCarry({ op: "floor", value: 18 })).toStrictEqual({ value: 18 });
  });

  it("setStepRound changes one part and keeps the other", () => {
    const step: ChargeStep = { op: "round", direction: "up", interval: 10 };
    expect(setStepRound(step, { interval: 25 })).toStrictEqual({
      op: "round",
      direction: "up",
      interval: 25
    });
    expect(setStepRound(step, { direction: "down" })).toStrictEqual({
      op: "round",
      direction: "down",
      interval: 10
    });
  });

  it("every control writes through the ONE builder", () => {
    // `buildStepOfOp` is the only place that says what a step of each op looks
    // like, so a step the row builds is shaped like a step the button builds.
    for (const op of KNOWN_OPS) {
      const built = buildStepOfOp(op, {}, "Depth");
      expect(built.op).toBe(op);
      expect(validateSteps([{ op: "start", field: "Depth" }, built], ["Depth"])).toEqual(
        op === "start"
          ? [{ index: 1, message: 'First step must have op "start".' }].slice(0, 0)
          : []
      );
    }
  });
});

describe("CHARGE_STEP_INPLACE_V1: the condition is a pill on the row", () => {
  it("a step without one offers `+ only when…`", () => {
    const html = rowMarkup({ op: "multiply", field: "Rate" }, 1);
    expect(html).toContain("+ only when…");
    expect(html).toContain('data-testid="add-condition-1"');
    expect(html).not.toContain('data-testid="condition-pill-1"');
  });

  it("a step with one renders `only when <field> <comparator> <value>` and a remove", () => {
    const html = rowMarkup(
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
      1
    );
    expect(html).toContain('data-testid="condition-pill-1"');
    expect(html).toContain(">only when</span>");
    expect(html).toContain('data-testid="remove-condition-1"');
    expect(html).not.toContain("+ only when…");
  });

  it("a declared option list becomes a select, not a free-text input", () => {
    // The difference between `Inverted` matching and `inverted` being typed.
    const html = rowMarkup(
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
      1
    );
    expect(optionsOf(html, "Step 2 condition value")).toEqual(["Floor", "Wall", "Inverted"]);
    expect(html).toContain('<option value="Inverted" selected="">Inverted</option>');
  });

  it("a field with no declared list keeps a free-text input", () => {
    const html = rowMarkup(
      { op: "multiply", field: 2, when: { field: "Diameter", cmp: ">=", value: 100 } },
      1
    );
    expect(optionsOf(html, "Step 2 condition value")).toEqual([]);
    expect(html).toContain('aria-label="Step 2 condition value" value="100"');
  });

  it("only a DECLARED list counts — a text column keeps free text", () => {
    // Material's values could be gathered from whatever rows exist today, and
    // a list built that way silently loses any value no row carries yet.
    expect(conditionValueOptions("Elevation", INPLACE_LINE_FIELDS)).toEqual([
      "Floor",
      "Wall",
      "Inverted"
    ]);
    expect(conditionValueOptions("Material", INPLACE_LINE_FIELDS)).toBeNull();
    expect(conditionValueOptions("Depth", INPLACE_LINE_FIELDS)).toBeNull();
  });

  it("adding one in place produces exactly the step the mock-up describes", () => {
    const step: ChargeStep = { op: "multiply", field: 2 };
    const seed = defaultCondition(INPLACE_COLS, INPLACE_LINE_FIELDS);
    expect(seed).toStrictEqual({ field: "Material", cmp: "is", value: 0 });

    // Choosing Elevation gives its first declared option; choosing Inverted
    // gives the mock-up's rule.
    const withElevation = setStepCondition(step, { field: "Elevation", cmp: "is", value: "Floor" });
    const done = setStepCondition(withElevation, {
      field: "Elevation",
      cmp: "is",
      value: "Inverted"
    });
    expect(done).toStrictEqual({
      op: "multiply",
      field: 2,
      when: { field: "Elevation", cmp: "is", value: "Inverted" }
    });
    expect(JSON.stringify(done)).toBe(
      '{"op":"multiply","field":2,"when":{"field":"Elevation","cmp":"is","value":"Inverted"}}'
    );
  });

  it("prefers a text field, and its first declared option, when seeding one", () => {
    expect(defaultCondition([], INPLACE_LINE_FIELDS)).toStrictEqual({
      field: "Elevation",
      cmp: "is",
      value: "Floor"
    });
    expect(
      defaultCondition([{ id: "n", name: "Depth", dataType: "NUMBER", role: "KEY" }], [])
    ).toStrictEqual({ field: "Depth", cmp: "is", value: 0 });
    expect(defaultCondition([], [])).toBeNull();
  });

  it("a value typed by hand becomes a number only when it reads as one", () => {
    expect(coerceConditionValue("100")).toBe(100);
    expect(coerceConditionValue(" 2.5 ")).toBe(2.5);
    expect(coerceConditionValue("Inverted")).toBe("Inverted");
    expect(coerceConditionValue("")).toBe("");
  });

  it("is offered on every op that can carry one, and on no other", () => {
    for (const op of KNOWN_OPS) {
      const step = buildStepOfOp(op, {}, "Depth");
      const html = rowMarkup(step, 1);
      const offered = html.includes("+ only when…") || html.includes('data-testid="condition-pill-1"');
      expect(offered).toBe(CONDITIONAL_OPS.includes(op));
    }
  });

  it("is ONE component, and there is no second copy of the comparator menu", () => {
    expect(count(CARD_SRC, "export function ConditionPill(")).toBe(1);
    expect(count(CARD_SRC, "<ConditionPill")).toBe(1);
    expect(count(CARD_SRC, "CONDITION_CMPS.map(")).toBe(1);
  });
});

describe("CHARGE_STEP_INPLACE_V1: the guards live in the controls", () => {
  const GUARD_COLS: RateColumnMeta[] = [
    { id: "g1", name: "Depth", dataType: "NUMBER", role: "KEY", unit: "mm" },
    { id: "g2", name: "Holes", dataType: "NUMBER", role: "KEY" },
    { id: "g3", name: "Fee", dataType: "CURRENCY", role: "VALUE" }
  ];
  const guardSteps = (): ChargeStep[] => [
    { op: "start", field: "Depth" },
    { op: "multiply", field: "Holes" },
    { op: "add", field: "Fee" }
  ];

  it("the operation menu at index 0 offers start and disables everything else", () => {
    const html = listMarkup(guardSteps(), GUARD_COLS, []);
    expect(optionsOf(html, "Step 1 operation")).toEqual([
      "Start with",
      "Multiply by",
      "Divide by",
      "Add",
      "Subtract",
      "Round",
      "Never less than",
      "Never more than"
    ]);
    expect(disabledOptionsOf(html, "Step 1 operation")).toEqual([
      "multiply",
      "divide",
      "add",
      "subtract",
      "round",
      "floor",
      "cap"
    ]);
  });

  it("the operation menu at index 2 offers the same list and disables start", () => {
    const html = listMarkup(guardSteps(), GUARD_COLS, []);
    expect(optionsOf(html, "Step 3 operation")).toEqual(optionsOf(html, "Step 1 operation"));
    expect(disabledOptionsOf(html, "Step 3 operation")).toEqual(["start"]);
  });

  it("a reorder the guard would refuse is disabled, not offered", () => {
    // canMoveStep asks the mutator, so the control cannot drift from the rule.
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "round", direction: "nearest", interval: 10 }
    ];
    expect(canMoveStep(steps, 1, 0)).toBe(false);
    expect(canMoveStep(steps, 0, 1)).toBe(false);
    expect(canMoveStep(guardSteps(), 1, 0)).toBe(true);
    expect(canMoveStep(guardSteps(), 0, -1)).toBe(false);
    const html = listMarkup(steps, GUARD_COLS, []);
    expect(count(html, 'aria-label="Move step 2 up" disabled=""')).toBe(1);
  });

  it("moving step 2 to the top leaves step 1 a start, no red panel, Save enabled", () => {
    const after = reorderSteps(guardSteps(), 1, 0);
    expect(after[0].op).toBe("start");
    expect(after.map((st, i) => stepSentence(st, i))).toEqual([
      "1. Start with Holes",
      "2. Multiply by Depth",
      "3. Add Fee"
    ]);
    const errors = validateSteps(after, GUARD_COLS.map((c) => c.name));
    expect(errors).toEqual([]);
    expect(errors.length > 0).toBe(false);
    expect(true && errors.length === 0 && after.length > 0).toBe(true);
  });

  it("replaceStepAt refuses a non-start at slot 0, and a second start elsewhere", () => {
    const steps = guardSteps();
    expect(replaceStepAt(steps, 0, { op: "multiply", field: "Holes" })).toBe(steps);
    expect(replaceStepAt(steps, 1, { op: "start", field: "Fee" })).toBe(steps);
    expect(replaceStepAt(steps, 9, { op: "add", field: "Fee" })).toBe(steps);
    expect(replaceStepAt(steps, -1, { op: "add", field: "Fee" })).toBe(steps);
    expect(replaceStepAt(steps, 1, steps[1])).toBe(steps);
    // And it does write when the guard allows it.
    expect(replaceStepAt(steps, 1, { op: "divide", field: "Holes" })[1]).toStrictEqual({
      op: "divide",
      field: "Holes"
    });
  });

  it("no in-place edit reaches `First step must have op \"start\".`", () => {
    // The edit surface, walked exhaustively: every step of every shape, at
    // every index, changed to every op, plus every operand and condition
    // change. The op menu is the only control that can touch `op` at all.
    const shapes: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Holes" },
      { op: "divide", field: 10 },
      { op: "round", direction: "nearest", interval: 1 },
      { op: "floor", value: 1 },
      { op: "cap", value: 500 },
      { op: "add", field: "Fee", when: { field: "Depth", cmp: ">", value: 2 } }
    ];
    const names = GUARD_COLS.map((c) => c.name);
    let checked = 0;

    for (const shape of shapes) {
      for (const index of [0, 1, 2]) {
        if (!isOpOfferableAt(shape.op as StepOp, index)) continue;
        const list = guardSteps();
        list[index] = shape;
        for (const op of KNOWN_OPS) {
          const edits: ChargeStep[] = [
            changeStepOp(list[index], op, "Depth"),
            setStepOperand(list[index], "Fee"),
            setStepOperand(list[index], 3),
            setStepFixedValue(list[index], 99),
            setStepRound(list[index], { direction: "up", interval: 5 }),
            setStepCondition(list[index], { field: "Depth", cmp: "<", value: 1 }),
            setStepCondition(list[index], undefined)
          ];
          for (const edit of edits) {
            const next = replaceStepAt(list, index, edit);
            expect(next[0].op).toBe("start");
            expect(next.filter((st) => st.op === "start")).toHaveLength(1);
            expect(
              validateSteps(next, names).some(
                (e) => e.message === 'First step must have op "start".'
              )
            ).toBe(false);
            checked++;
          }
        }
      }
    }
    // The size of the search, not a target.
    expect(checked).toBe(728);
  });

  it("there is exactly ONE implementation of each of the three guards", () => {
    // 1. The reorder coercion.
    expect(count(CARD_SRC, "export function reorderSteps(")).toBe(1);
    expect(count(CARD_SRC, "reorderSteps(steps, from, to)")).toBe(1); // canMoveStep asks it
    // 2. Step 1 has no remove control.
    expect(count(CARD_SRC, "export function canRemoveStep(")).toBe(1);
    expect(count(CARD_SRC, "export function removeStepAt(")).toBe(1);
    expect(count(CARD_SRC, "canRemoveStep(")).toBe(3); // definition, removeStepAt, the row
    // 3. `start` is offerable only in slot 0.
    expect(count(CARD_SRC, "export function isOpOfferableAt(")).toBe(1);
    expect(count(CARD_SRC, "index === 0 ? op === \"start\" : op !== \"start\"")).toBe(1);
    // ...and everything that needs the rule asks that one function.
    expect(CARD_SRC).toContain("return KNOWN_OPS.filter((o) => isOpOfferableAt(o, stepCount));");
    expect(CARD_SRC).toContain("if (!isOpOfferableAt(next.op as StepOp, index)) return steps;");
    expect(CARD_SRC).toContain("disabled={!isOpOfferableAt(op, index)}");
  });

  it("neither validation rule was relaxed", () => {
    expect(
      validateSteps([{ op: "multiply", field: "Holes" }], GUARD_COLS.map((c) => c.name))
    ).toContainEqual({ index: 0, message: 'First step must have op "start".' });
    expect(CARD_SRC).toContain(
      `errors.push({ index: 0, message: 'First step must have op "start".' });`
    );
  });
});

describe("CHARGE_STEP_INPLACE_V1: + Add a step, and no parallel form", () => {
  it("appends a start on an empty list and a multiply on a list that has one", () => {
    const cols = numericFieldOptions(INPLACE_COLS, INPLACE_LINE_FIELDS);
    expect(newStepFor([], cols)).toStrictEqual({ op: "start", field: "Diameter" });
    expect(newStepFor([{ op: "start", field: "Depth" }], cols)).toStrictEqual({
      op: "multiply",
      field: "Diameter"
    });
    // A table with no number field at all still gets a usable step.
    expect(newStepFor([], [])).toStrictEqual({ op: "start", field: 1 });
    expect(defaultOperand([])).toBe(1);
  });

  it("appends through the guard, so it can never add a second start", () => {
    const steps: ChargeStep[] = [{ op: "start", field: "Depth" }];
    const next = appendStep(steps, newStepFor(steps, ["Depth"]));
    expect(next).toHaveLength(2);
    expect(next.filter((st) => st.op === "start")).toHaveLength(1);
    expect(CARD_SRC).toContain("addStep(newStepFor(steps, numericCols))");
  });

  it("the step it adds is the same shape a row already edits", () => {
    const added = newStepFor([{ op: "start", field: "Depth" }], ["Depth"]);
    expect(rowMarkup(added, 1)).toContain('aria-label="Step 2 operand"');
  });

  it("the add-step form and every duplicate control it carried are gone", () => {
    expect(CARD_SRC).not.toContain("function AddStepForm");
    expect(CARD_SRC).not.toContain('data-testid="add-step-form"');
    expect(CARD_SRC).not.toContain('data-testid="condition-fields"');
    expect(CARD_SRC).not.toContain("Add condition (only apply this step when…)");
    expect(CARD_SRC).toContain("+ Add a step");
  });
});

describe("CHARGE_STEP_INPLACE_V1: nothing about what a step computes changed", () => {
  const CORE_CELLS = { "c-diameter": 32, "c-rate": 1.7 };
  const coreValues = () => buildStepValues(CORE_COLS, CORE_CELLS, CORE_LINE_FIELDS);
  const totalOf = (steps: ChargeStep[]) =>
    evaluateStepsClient(steps, coreValues()).at(-1)?.runningTotal ?? null;

  it("the mock-up's Core holes rule still prices at 81.60", () => {
    expect(formatStepTotal(totalOf(CORE_STEPS) as number, { money: true })).toBe("$81.60");
  });

  it("editing step 5's operand to a number and back returns to 81.60", () => {
    // Step 5 is `Multiply by Rate`, and Rate is 1.70 on the matched row.
    const toNumber = replaceStepAt(CORE_STEPS, 4, setStepOperand(CORE_STEPS[4], 1.7));
    expect(toNumber[4]).toStrictEqual({ op: "multiply", field: 1.7 });
    expect(formatStepTotal(totalOf(toNumber) as number, { money: true })).toBe("$81.60");

    const backToRate = replaceStepAt(toNumber, 4, setStepOperand(toNumber[4], "Rate"));
    expect(backToRate).toStrictEqual(CORE_STEPS);
    expect(formatStepTotal(totalOf(backToRate) as number, { money: true })).toBe("$81.60");
  });

  it("changing an operand changes the total, and only because the step changed", () => {
    const doubled = replaceStepAt(CORE_STEPS, 4, setStepOperand(CORE_STEPS[4], 3.4));
    expect(totalOf(doubled)).toBeCloseTo(163.2, 10);
    // The evaluator is untouched: the same steps against the same values give
    // the same trail the parity suite already pinned.
    expect(evaluateStepsClient(CORE_STEPS, coreValues()).map((t) => t.runningTotal)).toEqual([
      18, 1.8, 2, 2, 3.4, 6.8, 81.6
    ]);
  });

  it("the card still runs the shared evaluator and holds no rule of its own", () => {
    expect(count(CARD_SRC, "evaluateChargeSteps(")).toBe(1);
    expect(count(CARD_SRC, "buildStepValues(")).toBe(1);
    expect(CARD_SRC).not.toContain("function checkCondition");
  });
});

describe("CHARGE_STEP_INPLACE_V1: every colour is a token", () => {
  it("the new styles carry no hex literal and no raw rgba", () => {
    const styles = CARD_SRC.slice(CARD_SRC.indexOf("const stepListStyle"));
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(styles).not.toMatch(/rgba?\(/);
  });

  it("the pill uses the two tokens that deliberately do not flip with the theme", () => {
    // --surface-override is the same amber in both themes, so the text on it
    // has to be the same near-black in both themes.
    const html = rowMarkup(
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
      1
    );
    expect(html).toContain("background:var(--surface-override)");
    expect(html).toContain("color:var(--brand-dark)");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("the row itself paints from tokens in both themes", () => {
    const html = rowMarkup({ op: "start", field: "Depth" }, 0);
    expect(html).toContain("background:var(--surface-card)");
    expect(html).toContain("border:1px solid var(--border-default)");
    expect(html).toContain("background:var(--brand-primary-light)");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("an invalid row is marked with the danger token, not a literal", () => {
    const html = rowMarkup({ op: "multiply", field: "Nowhere" }, 1, { invalid: true });
    expect(html).toContain("border:1px solid var(--status-danger)");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("carries the marker", () => {
    expect(CARD_SRC).toContain("CHARGE_STEP_INPLACE_V1");
  });
});
