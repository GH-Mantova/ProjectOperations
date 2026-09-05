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
 */

import { describe, expect, it } from "vitest";
import {
  describeChargeStepIssue,
  evaluateChargeSteps
} from "@project-ops/config/charge-step-semantics";
import {
  stepSentence,
  stepsToFormula,
  validateSteps,
  evaluateStepsClient,
  numericFieldOptions,
  allFieldOptions,
  type RateColumnMeta
} from "../ChargeStepsEditor";
import type { ChargeStep } from "../../../lib/chargeStepTypes";

// ── Fixtures ───────────────────────────────────────────────────────────────

const COLS: RateColumnMeta[] = [
  { id: "c1", name: "Depth", dataType: "NUMBER", role: "KEY" },
  { id: "c2", name: "Rate", dataType: "NUMBER", role: "VALUE" },
  { id: "c3", name: "Material", dataType: "TEXT", role: "KEY" },
  { id: "c4", name: "Area", dataType: "NUMBER", role: "VALUE" }
];

const COL_NAMES = COLS.map((c) => c.name);

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
    expect(stepSentence({ op: "round", direction: "nearest", interval: 0.5 }, 5)).toBe(
      "6. Round nearest to nearest 0.5"
    );
  });

  it("renders round up", () => {
    expect(stepSentence({ op: "round", direction: "up", interval: 1 }, 0)).toBe(
      "1. Round up to nearest 1"
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
    const next = [...steps, newStep];
    expect(next).toHaveLength(4);
    expect(next[3]).toEqual(newStep);
  });

  it("remove step drops correct index", () => {
    const steps = makeSteps();
    const next = steps.filter((_, i) => i !== 1);
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ op: "add", field: 10 });
  });

  it("move step up swaps with previous", () => {
    const steps = makeSteps();
    const next = [...steps];
    [next[0], next[1]] = [next[1], next[0]];
    expect(next[0].op).toBe("multiply");
    expect(next[1].op).toBe("start");
  });

  it("move step down swaps with next", () => {
    const steps = makeSteps();
    const next = [...steps];
    [next[1], next[2]] = [next[2], next[1]];
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
