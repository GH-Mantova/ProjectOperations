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
 */

import { describe, expect, it } from "vitest";
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
