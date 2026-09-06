/**
 * rate-step-evaluator.spec.ts
 *
 * Unit-tests for the pure evaluateSteps() function and its supporting types.
 *
 * Three "real shape" suites are included that mirror pricing patterns used in
 * the cutting/core-hole rate module. The expected numbers are derived directly
 * from the worked example in the slice spec and from the arithmetic in
 * apps/api/src/modules/tendering/scope-redesign.service.ts (core-hole formula:
 *   total = ratePerHole * (depthMm / 10) * qty * elevationMultiplier)
 * and the grammar description in the PR.
 *
 * Shape names follow the conventions used in the rates-migration docs:
 *   - core-holes   : depth-scaled per-hole with elevation multiplier
 *   - per-unit-with-floor : flat rate per quantity, minimum charge enforced
 *   - banded       : rate varies by quantity band (add steps conditioned on >=)
 */

import {
  evaluateSteps,
  type ChargeStep,
  type ChargeStepIssue,
  type TrailEntry,
} from "../rate-step-evaluator";
import {
  buildStepValues,
  type RateLineField
} from "@project-ops/config/charge-step-semantics";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function totalOf(
  steps: ChargeStep[],
  values: Record<string, number | string>
): number | null {
  return evaluateSteps(steps, values).total;
}

function trailOf(steps: ChargeStep[], values: Record<string, number | string>): TrailEntry[] {
  return evaluateSteps(steps, values).trail;
}

function issuesOf(
  steps: ChargeStep[],
  values: Record<string, number | string>
): ChargeStepIssue[] {
  return evaluateSteps(steps, values).issues;
}

// ---------------------------------------------------------------------------
// 1. start
// ---------------------------------------------------------------------------

describe("start", () => {
  it("resolves a field name", () => {
    const steps: ChargeStep[] = [{ op: "start", field: "Depth" }];
    expect(totalOf(steps, { Depth: 50 })).toBe(50);
  });

  it("resolves a numeric literal", () => {
    const steps: ChargeStep[] = [{ op: "start", field: 100 }];
    expect(totalOf(steps, {})).toBe(100);
  });

  it("reports a missing field instead of silently resolving it to 0", () => {
    const steps: ChargeStep[] = [{ op: "start", field: "Missing" }];
    // Before CHARGE_STEP_PARITY_V1 this resolved to 0 on the server and to a
    // silent no-op in the editor preview. Now both name the step.
    expect(totalOf(steps, {})).toBeNull();
    const issues = issuesOf(steps, {});
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("missing-operand");
    expect(issues[0].stepIndex).toBe(0);
    expect(issues[0].field).toBe("Missing");
  });
});

// ---------------------------------------------------------------------------
// 2. multiply
// ---------------------------------------------------------------------------

describe("multiply", () => {
  const base: ChargeStep[] = [{ op: "start", field: 10 }];

  it("multiplies running total by a literal", () => {
    const steps: ChargeStep[] = [...base, { op: "multiply", field: 3 }];
    expect(totalOf(steps, {})).toBe(30);
  });

  it("multiplies running total by a field value", () => {
    const steps: ChargeStep[] = [...base, { op: "multiply", field: "Rate" }];
    expect(totalOf(steps, { Rate: 4 })).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// 3. divide
// ---------------------------------------------------------------------------

describe("divide", () => {
  const base: ChargeStep[] = [{ op: "start", field: 100 }];

  it("divides running total by a literal", () => {
    const steps: ChargeStep[] = [...base, { op: "divide", field: 4 }];
    expect(totalOf(steps, {})).toBe(25);
  });

  it("divides running total by a field value", () => {
    const steps: ChargeStep[] = [...base, { op: "divide", field: "Divisor" }];
    expect(totalOf(steps, { Divisor: 5 })).toBe(20);
  });

  it("reports divide-by-zero against the step rather than throwing", () => {
    const steps: ChargeStep[] = [...base, { op: "divide", field: 0 }];
    expect(() => totalOf(steps, {})).not.toThrow();
    expect(totalOf(steps, {})).toBeNull();
    const issues = issuesOf(steps, {});
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("divide-by-zero");
    expect(issues[0].stepIndex).toBe(1);
    expect(issues[0].message).toBe("Cannot divide by zero.");
  });

  it("reports divide-by-zero when the divisor field resolves to zero", () => {
    const steps: ChargeStep[] = [...base, { op: "divide", field: "Divisor" }];
    const issues = issuesOf(steps, { Divisor: 0 });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("divide-by-zero");
    expect(totalOf(steps, { Divisor: 0 })).toBeNull();
  });

  it("treats negative zero as zero", () => {
    const steps: ChargeStep[] = [...base, { op: "divide", field: "Divisor" }];
    expect(issuesOf(steps, { Divisor: -0 })[0].code).toBe("divide-by-zero");
  });
});

// ---------------------------------------------------------------------------
// 4. add
// ---------------------------------------------------------------------------

describe("add", () => {
  it("adds a literal to the running total", () => {
    const steps: ChargeStep[] = [{ op: "start", field: 10 }, { op: "add", field: 5 }];
    expect(totalOf(steps, {})).toBe(15);
  });

  it("adds a field value to the running total", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "add", field: "Surcharge" },
    ];
    expect(totalOf(steps, { Surcharge: 7 })).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// 5. subtract
// ---------------------------------------------------------------------------

describe("subtract", () => {
  it("subtracts a literal from the running total", () => {
    const steps: ChargeStep[] = [{ op: "start", field: 20 }, { op: "subtract", field: 3 }];
    expect(totalOf(steps, {})).toBe(17);
  });

  it("subtracts a field value from the running total", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 20 },
      { op: "subtract", field: "Discount" },
    ];
    expect(totalOf(steps, { Discount: 4 })).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// 6. round
// ---------------------------------------------------------------------------

describe("round nearest", () => {
  it("rounds to nearest interval (down)", () => {
    // 14 / 10 = 1.4 -> nearest 1 -> 1
    const steps: ChargeStep[] = [
      { op: "start", field: 14 },
      { op: "divide", field: 10 },
      { op: "round", direction: "nearest", interval: 1 },
    ];
    expect(totalOf(steps, {})).toBe(1);
  });

  it("rounds to nearest interval (up, tie rounds up)", () => {
    // 15 / 10 = 1.5 -> nearest 1 -> 2 (Math.round rounds 0.5 up)
    const steps: ChargeStep[] = [
      { op: "start", field: 15 },
      { op: "divide", field: 10 },
      { op: "round", direction: "nearest", interval: 1 },
    ];
    expect(totalOf(steps, {})).toBe(2);
  });

  it("rounds to a fractional interval", () => {
    // 1.7 / 0.5 = 3.4 -> Math.round(3.4) = 3 -> 3 * 0.5 = 1.5
    const steps: ChargeStep[] = [
      { op: "start", field: 1.7 },
      { op: "round", direction: "nearest", interval: 0.5 },
    ];
    expect(totalOf(steps, {})).toBeCloseTo(1.5);
  });
});

describe("round up", () => {
  it("rounds up to the next interval", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 11 },
      { op: "round", direction: "up", interval: 5 },
    ];
    expect(totalOf(steps, {})).toBe(15);
  });

  it("does not change a value already on the interval boundary", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "round", direction: "up", interval: 5 },
    ];
    expect(totalOf(steps, {})).toBe(10);
  });
});

describe("round down", () => {
  it("rounds down to the previous interval", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 19 },
      { op: "round", direction: "down", interval: 5 },
    ];
    expect(totalOf(steps, {})).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// 7. floor
// ---------------------------------------------------------------------------

describe("floor", () => {
  it("clamps running total up to the floor value", () => {
    // 0.3 depth-units is below 1 -> floored to 1
    const steps: ChargeStep[] = [
      { op: "start", field: 3 },
      { op: "divide", field: 10 },
      { op: "floor", value: 1 },
    ];
    expect(totalOf(steps, {})).toBe(1);
  });

  it("leaves running total unchanged when already above floor", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 50 },
      { op: "floor", value: 10 },
    ];
    expect(totalOf(steps, {})).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 8. cap
// ---------------------------------------------------------------------------

describe("cap", () => {
  it("clamps running total down to the cap value", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 200 },
      { op: "cap", value: 100 },
    ];
    expect(totalOf(steps, {})).toBe(100);
  });

  it("leaves running total unchanged when already below cap", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 50 },
      { op: "cap", value: 100 },
    ];
    expect(totalOf(steps, {})).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 9. conditions
// ---------------------------------------------------------------------------

describe("condition: met", () => {
  it("applies step when condition is met (is)", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
    ];
    expect(totalOf(steps, { Elevation: "Inverted" })).toBe(20);
  });

  it("applies step when condition is met (>)", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 100 },
      { op: "add", field: 50, when: { field: "Qty", cmp: ">", value: 5 } },
    ];
    expect(totalOf(steps, { Qty: 10 })).toBe(150);
  });
});

describe("condition: not met", () => {
  it("skips step when condition is not met", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
    ];
    // Elevation is "Floor", not "Inverted" -> multiply is skipped
    expect(totalOf(steps, { Elevation: "Floor" })).toBe(10);
  });

  it("skips step when condition is 'is not' and matches", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 100 },
      { op: "add", field: 50, when: { field: "Type", cmp: "is not", value: "standard" } },
    ];
    // Type IS standard -> "is not" fails -> skip
    expect(totalOf(steps, { Type: "standard" })).toBe(100);
  });

  it("applies step when 'is not' condition is met (value differs)", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 100 },
      { op: "add", field: 50, when: { field: "Type", cmp: "is not", value: "standard" } },
    ];
    expect(totalOf(steps, { Type: "premium" })).toBe(150);
  });

  it("evaluates <= correctly", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 50 },
      { op: "subtract", field: 10, when: { field: "Qty", cmp: "<=", value: 5 } },
    ];
    expect(totalOf(steps, { Qty: 3 })).toBe(40);
    expect(totalOf(steps, { Qty: 6 })).toBe(50);
  });

  it("evaluates >= correctly", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 50 },
      { op: "add", field: 20, when: { field: "Qty", cmp: ">=", value: 10 } },
    ];
    expect(totalOf(steps, { Qty: 10 })).toBe(70);
    expect(totalOf(steps, { Qty: 9 })).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 10. text-in-arithmetic rejection
// ---------------------------------------------------------------------------

describe("text-in-arithmetic rejection", () => {
  const TEXT_MESSAGE = "Text belongs in the 'only when' part of a step, not in the sum.";

  it("names the step when start uses a text field", () => {
    const steps: ChargeStep[] = [{ op: "start", field: "Elevation" }];
    const issues = issuesOf(steps, { Elevation: "Inverted" });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("text-operand");
    expect(issues[0].stepIndex).toBe(0);
    expect(issues[0].field).toBe("Elevation");
    expect(issues[0].text).toBe("Inverted");
    expect(issues[0].message).toBe(TEXT_MESSAGE);
    expect(totalOf(steps, { Elevation: "Inverted" })).toBeNull();
  });

  it("names the step when multiply uses a text field", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: "Elevation" },
    ];
    const issues = issuesOf(steps, { Elevation: "Inverted" });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("text-operand");
    expect(issues[0].stepIndex).toBe(1);
    expect(totalOf(steps, { Elevation: "Inverted" })).toBeNull();
  });

  it("rejects a numeric-looking string in an arithmetic slot (a TEXT column is not arithmetic)", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: "Grade" },
    ];
    // The preview used to coerce "150" with Number() and multiply by 150 while
    // the server threw. Both now report the same issue.
    const issues = issuesOf(steps, { Grade: "150" });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("text-operand");
    expect(totalOf(steps, { Grade: "150" })).toBeNull();
  });

  it("treats an empty-string cell as text, not as zero", () => {
    const steps: ChargeStep[] = [{ op: "start", field: "Note" }];
    expect(issuesOf(steps, { Note: "" })[0].code).toBe("text-operand");
  });

  it("does NOT complain when a text field appears only in a condition", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
    ];
    expect(issuesOf(steps, { Elevation: "Inverted" })).toHaveLength(0);
    expect(totalOf(steps, { Elevation: "Inverted" })).toBe(20);
  });

  it("does NOT complain about a step whose condition is not met, even with a broken operand", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: "Gone", when: { field: "Elevation", cmp: "is", value: "Inverted" } },
    ];
    expect(issuesOf(steps, { Elevation: "Floor" })).toHaveLength(0);
    expect(totalOf(steps, { Elevation: "Floor" })).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 10b. Unresolvable steps poison the running total (CHARGE_STEP_PARITY_V1)
// ---------------------------------------------------------------------------

describe("unresolvable steps", () => {
  it("start Depth / multiply Holes with Holes absent yields no total at all", () => {
    // The worked example from the slice: the editor used to keep printing a
    // running total as if the multiply had multiplied by 1, and the server
    // used to multiply by 0. Neither number was real.
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Holes" },
    ];
    const { total, trail, issues } = evaluateSteps(steps, { Depth: 150 });
    expect(trail[0].runningTotal).toBe(150);
    expect(trail[1].runningTotal).toBeNull();
    expect(total).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("missing-operand");
    expect(issues[0].stepIndex).toBe(1);
    expect(issues[0].field).toBe("Holes");
  });

  it("every step after the broken one also reports no running total", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Holes" },
      { op: "add", field: 5 },
      { op: "round", direction: "nearest", interval: 1 },
      { op: "floor", value: 10 },
      { op: "cap", value: 1000 },
    ];
    const { trail, total } = evaluateSteps(steps, { Depth: 150 });
    expect(total).toBeNull();
    for (const entry of trail.slice(1)) {
      expect(entry.runningTotal).toBeNull();
    }
  });

  it("reports every broken step in the list, in step order", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Depth" },
      { op: "multiply", field: "Holes" },
      { op: "divide", field: 0 },
      { op: "subtract", field: "Note" },
    ];
    const issues = issuesOf(steps, { Depth: 1, Note: "n/a" });
    expect(issues.map((i) => i.code)).toEqual([
      "missing-operand",
      "divide-by-zero",
      "text-operand",
    ]);
    expect(issues.map((i) => i.stepIndex)).toEqual([1, 2, 3]);
  });

  it("a later start re-seeds a total an earlier broken step made unknowable", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Gone" },
      { op: "start", field: 42 },
      { op: "multiply", field: 2 },
    ];
    expect(totalOf(steps, {})).toBe(84);
  });

  it("rejects a round interval of zero instead of producing NaN", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "round", direction: "nearest", interval: 0 },
    ];
    const issues = issuesOf(steps, {});
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("bad-round-interval");
    expect(issues[0].stepIndex).toBe(1);
    expect(totalOf(steps, {})).toBeNull();
  });

  it("rejects a negative round interval", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "round", direction: "up", interval: -5 },
    ];
    expect(issuesOf(steps, {})[0].code).toBe("bad-round-interval");
  });
});

// ---------------------------------------------------------------------------
// 10c. The comparison rule (CHARGE_STEP_PARITY_V1)
// ---------------------------------------------------------------------------

describe("comparison rule: is / is not", () => {
  const withCondition = (cmp: "is" | "is not", value: string | number): ChargeStep[] => [
    { op: "start", field: 100 },
    { op: "add", field: 50, when: { field: "Grade", cmp, value } },
  ];

  it("matches a TEXT cell holding 150 against the numeric condition value 150", () => {
    // AddStepForm stores a numeric-looking condition value with Number(), while
    // the scenario map holds a TEXT cell as a string. Before parity this matched
    // in the preview (200) and never on the server (100).
    expect(totalOf(withCondition("is", 150), { Grade: "150" })).toBe(150);
  });

  it("matches a NUMBER cell holding 150 against the string condition value \"150\"", () => {
    expect(totalOf(withCondition("is", "150"), { Grade: 150 })).toBe(150);
  });

  it("ignores case: cell Inverted matches the condition value inverted", () => {
    expect(totalOf(withCondition("is", "inverted"), { Grade: "Inverted" })).toBe(150);
  });

  it("still matches when the case is identical", () => {
    expect(totalOf(withCondition("is", "Inverted"), { Grade: "Inverted" })).toBe(150);
  });

  it("does not match a genuinely different value", () => {
    expect(totalOf(withCondition("is", "Inverted"), { Grade: "Floor" })).toBe(100);
  });

  it("a field with no value in the row never `is` anything", () => {
    expect(totalOf(withCondition("is", "Inverted"), {})).toBe(100);
  });

  it("`is not` is exactly the negation of `is` (case)", () => {
    expect(totalOf(withCondition("is not", "inverted"), { Grade: "Inverted" })).toBe(100);
  });

  it("`is not` is exactly the negation of `is` (cross-type)", () => {
    expect(totalOf(withCondition("is not", 150), { Grade: "150" })).toBe(100);
  });

  it("`is not` applies when the field has no value in the row", () => {
    expect(totalOf(withCondition("is not", "Inverted"), {})).toBe(150);
  });

  it("does not match on a substring", () => {
    expect(totalOf(withCondition("is", "Invert"), { Grade: "Inverted" })).toBe(100);
  });

  it("does not treat surrounding whitespace as equal", () => {
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
    { op: "add", field: 50, when: { field: "Qty", cmp, value } },
  ];

  it("coerces a numeric string on the left with Number", () => {
    expect(totalOf(withCondition(">", 5), { Qty: "10" })).toBe(150);
  });

  it("coerces a numeric string on the right with Number", () => {
    expect(totalOf(withCondition(">=", "10"), { Qty: 10 })).toBe(150);
  });

  it("is false when the cell is not a number", () => {
    expect(totalOf(withCondition(">", 5), { Qty: "heavy" })).toBe(100);
    expect(totalOf(withCondition("<", 5), { Qty: "heavy" })).toBe(100);
    expect(totalOf(withCondition(">=", 5), { Qty: "heavy" })).toBe(100);
    expect(totalOf(withCondition("<=", 5), { Qty: "heavy" })).toBe(100);
  });

  it("is false when the field has no value in the row", () => {
    expect(totalOf(withCondition(">", 5), {})).toBe(100);
    expect(totalOf(withCondition("<=", 5), {})).toBe(100);
  });

  it("handles negative and zero boundaries", () => {
    expect(totalOf(withCondition(">=", 0), { Qty: 0 })).toBe(150);
    expect(totalOf(withCondition(">", 0), { Qty: 0 })).toBe(100);
    expect(totalOf(withCondition("<", 0), { Qty: -1 })).toBe(150);
  });
});

// 11. trail length equals step count
// ---------------------------------------------------------------------------

describe("trail length equals step count", () => {
  it("trail has exactly one entry per step (no skips)", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 5 },
      { op: "multiply", field: 2 },
      { op: "add", field: 1 },
    ];
    const trail = trailOf(steps, {});
    expect(trail).toHaveLength(3);
  });

  it("trail has exactly one entry per step even when steps are skipped", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 5 },
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
      { op: "add", field: 10 },
    ];
    // Elevation is Floor -> multiply is skipped, trail still has 3 entries
    const trail = trailOf(steps, { Elevation: "Floor" });
    expect(trail).toHaveLength(3);
    expect(trail[1].skipped).toBe(true);
    expect(trail[1].runningTotal).toBe(5); // unchanged
  });

  it("skipped entry carries unchanged running total", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 100 },
      { op: "add", field: 50, when: { field: "Bonus", cmp: "is", value: "yes" } },
    ];
    const trail = trailOf(steps, { Bonus: "no" });
    expect(trail[1].skipped).toBe(true);
    expect(trail[1].runningTotal).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 12. Three real shapes
//
//   Shape A — core-holes (worked example from spec):
//     start Depth -> divide 10 -> round nearest 1 -> floor 1
//       -> multiply Rate -> multiply 2 when Elevation is Inverted -> multiply Holes
//
//   Shape B — per-unit-with-floor:
//     start Qty -> multiply Rate -> floor MinCharge
//
//   Shape C — banded:
//     start Qty -> multiply BaseRate -> add BandSurcharge when Qty >= BandThreshold
//       -> add PremiumSurcharge when Qty >= PremiumThreshold
// ---------------------------------------------------------------------------

describe("Shape A: core-holes (spec worked example)", () => {
  const coreHoleSteps: ChargeStep[] = [
    { op: "start",    field: "Depth" },
    { op: "divide",   field: 10 },
    { op: "round",    direction: "nearest", interval: 1 },
    { op: "floor",    value: 1 },
    { op: "multiply", field: "Rate" },
    { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
    { op: "multiply", field: "Holes" },
  ];

  it("Depth=150mm, Rate=25, Elevation=Floor, Holes=3 -> 150/10=15 depth-units * 25 * 1 * 3 = 1125", () => {
    const values = { Depth: 150, Rate: 25, Elevation: "Floor", Holes: 3 };
    // 150 / 10 = 15 -> round nearest 1 -> 15 -> floor(15,1)=15 -> *25=375 -> Elevation not Inverted -> *3=1125
    expect(totalOf(coreHoleSteps, values)).toBe(1125);
  });

  it("Depth=7mm, Rate=25, Elevation=Floor, Holes=1 -> floored to 1 depth-unit -> 25", () => {
    const values = { Depth: 7, Rate: 25, Elevation: "Floor", Holes: 1 };
    // 7 / 10 = 0.7 -> round nearest 1 -> 1 -> floor(1,1)=1 -> *25=25 -> *1=25
    expect(totalOf(coreHoleSteps, values)).toBe(25);
  });

  it("Depth=50mm, Rate=30, Elevation=Inverted, Holes=2 -> 5 depth-units * 30 * 2 * 2 = 600", () => {
    const values = { Depth: 50, Rate: 30, Elevation: "Inverted", Holes: 2 };
    // 50 / 10 = 5 -> round nearest 1 -> 5 -> floor(5,1)=5 -> *30=150 -> Inverted: *2=300 -> *2=600
    expect(totalOf(coreHoleSteps, values)).toBe(600);
  });

  it("trail length is 7 (one per step)", () => {
    const values = { Depth: 150, Rate: 25, Elevation: "Floor", Holes: 3 };
    const trail = trailOf(coreHoleSteps, values);
    expect(trail).toHaveLength(7);
  });

  it("trail records skipped=true for the Inverted multiply when Elevation is Floor", () => {
    const values = { Depth: 150, Rate: 25, Elevation: "Floor", Holes: 3 };
    const trail = trailOf(coreHoleSteps, values);
    // Step index 5 is the conditional multiply
    expect(trail[5].skipped).toBe(true);
    expect(trail[5].runningTotal).toBe(375); // unchanged from *Rate step
  });
});

describe("Shape B: per-unit-with-floor", () => {
  // Pricing: qty * rate, but minimum charge of $50.
  const perUnitSteps: ChargeStep[] = [
    { op: "start",    field: "Qty" },
    { op: "multiply", field: "Rate" },
    { op: "floor",    value: 50 },
  ];

  it("normal case: 5 units at $20 = $100 (above floor)", () => {
    expect(totalOf(perUnitSteps, { Qty: 5, Rate: 20 })).toBe(100);
  });

  it("minimum charge applies: 1 unit at $10 = $10 -> floored to $50", () => {
    expect(totalOf(perUnitSteps, { Qty: 1, Rate: 10 })).toBe(50);
  });

  it("exactly on the floor: 2.5 units at $20 = $50", () => {
    expect(totalOf(perUnitSteps, { Qty: 2.5, Rate: 20 })).toBe(50);
  });

  it("trail length is 3", () => {
    const trail = trailOf(perUnitSteps, { Qty: 5, Rate: 20 });
    expect(trail).toHaveLength(3);
    expect(trail[2].skipped).toBe(false);
  });
});

describe("Shape C: banded pricing", () => {
  // Rate structure:
  //   $10/unit for all units
  //   + $5/unit surcharge when Qty >= 10  (i.e. add 5 * Qty when Qty >= 10)
  //   + $3/unit premium when Qty >= 20
  //
  // Implemented as:
  //   start Qty -> multiply BaseRate -> add BandSurcharge when Qty >= BandThreshold
  //     -> add PremiumSurcharge when Qty >= PremiumThreshold
  //
  // NB: surcharges here are flat amounts, not per-unit — to keep
  // the step grammar simple (one add per band).
  const bandedSteps: ChargeStep[] = [
    { op: "start",    field: "Qty" },
    { op: "multiply", field: "BaseRate" },
    { op: "add",      field: "BandSurcharge",    when: { field: "Qty", cmp: ">=", value: 10 } },
    { op: "add",      field: "PremiumSurcharge",  when: { field: "Qty", cmp: ">=", value: 20 } },
  ];

  it("Qty=5: below both bands -> 5 * 10 = 50", () => {
    const values = { Qty: 5, BaseRate: 10, BandSurcharge: 30, PremiumSurcharge: 20 };
    // 5 * 10 = 50, both adds skipped
    expect(totalOf(bandedSteps, values)).toBe(50);
  });

  it("Qty=10: first band applies -> 10 * 10 + 30 = 130", () => {
    const values = { Qty: 10, BaseRate: 10, BandSurcharge: 30, PremiumSurcharge: 20 };
    // 10 * 10 = 100 + 30 = 130, premium skipped
    expect(totalOf(bandedSteps, values)).toBe(130);
  });

  it("Qty=20: both bands apply -> 20 * 10 + 30 + 20 = 250", () => {
    const values = { Qty: 20, BaseRate: 10, BandSurcharge: 30, PremiumSurcharge: 20 };
    // 20 * 10 = 200 + 30 + 20 = 250
    expect(totalOf(bandedSteps, values)).toBe(250);
  });

  it("trail length is 4 and records which adds were skipped", () => {
    const values = { Qty: 5, BaseRate: 10, BandSurcharge: 30, PremiumSurcharge: 20 };
    const trail = trailOf(bandedSteps, values);
    expect(trail).toHaveLength(4);
    expect(trail[2].skipped).toBe(true);
    expect(trail[3].skipped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 13. Guard: empty steps / non-start first step
// ---------------------------------------------------------------------------

describe("guard rails", () => {
  it("throws when steps is empty", () => {
    expect(() => evaluateSteps([], {})).toThrow("steps must not be empty");
  });

  it("throws when first step is not start", () => {
    const steps: ChargeStep[] = [{ op: "multiply", field: 2 }];
    expect(() => evaluateSteps(steps, {})).toThrow("first step must be op: start");
  });
});

// ---------------------------------------------------------------------------
// 14. RATE_LINE_FIELDS_V1 — line fields resolve through the SAME values map
// ---------------------------------------------------------------------------
//
// `rate-step-evaluator.ts` is deliberately unchanged by the line-fields slice:
// `resolveStepOperand` and `stepConditionMet` key off `values` by name, so a
// line field resolves the moment `buildStepValues` puts it in the map. These
// tests prove that, and pin the four worked examples from the approved mock-up.
//
// The client preview calls `buildStepValues` too (ChargeStepsEditor.tsx), so
// the figures asserted here are the figures the card shows — one builder, one
// evaluator, one number.

describe("RATE_LINE_FIELDS_V1 — buildStepValues + evaluateSteps", () => {
  const CORE_COLUMNS = [
    { id: "c-diameter", name: "Diameter" },
    { id: "c-rate", name: "Rate" }
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

  it("mock-up example 1 — Core holes: Diameter 32 / Rate 1.70 totals 81.60", () => {
    const values = buildStepValues(
      CORE_COLUMNS,
      { "c-diameter": 32, "c-rate": 1.7 },
      CORE_LINE_FIELDS
    );
    expect(values).toEqual({
      Diameter: 32,
      Rate: 1.7,
      Depth: 18,
      Elevation: "Inverted",
      Holes: 12
    });

    const { total, trail } = evaluateSteps(CORE_STEPS, values);
    expect(trail.map((t) => t.runningTotal)).toEqual([18, 1.8, 2, 2, 3.4, 6.8, 81.6]);
    expect(total).toBeCloseTo(81.6, 10);
  });

  it("mock-up example 2 — Saw cuts by depth band: Rate 18.95 x Metres 24 = 454.80", () => {
    const values = buildStepValues(
      [{ id: "c-rate", name: "Rate" }],
      { "c-rate": 18.95 },
      [{ name: "Metres", kind: "number", unit: "m", sample: 24 }]
    );
    const steps: ChargeStep[] = [
      { op: "start", field: "Rate" },
      { op: "multiply", field: "Metres" }
    ];
    expect(evaluateSteps(steps, values).total).toBeCloseTo(454.8, 10);
  });

  it("mock-up example 3 — Saw cuts by the millimetre: floor 18 then x Metres = 691.20", () => {
    const values = buildStepValues([{ id: "c-rate", name: "Rate" }], { "c-rate": 18 }, [
      { name: "Depth", kind: "number", unit: "mm", sample: 40 },
      { name: "Metres", kind: "number", unit: "m", sample: 24 }
    ]);
    const steps: ChargeStep[] = [
      { op: "start", field: "Rate" },
      { op: "multiply", field: "Depth" },
      { op: "divide", field: 25 },
      { op: "floor", value: 18 },
      { op: "multiply", field: "Metres" }
    ];
    const { total, trail } = evaluateSteps(steps, values);
    expect(trail.map((t) => t.runningTotal)).toEqual([18, 720, 28.8, 28.8, 691.2]);
    expect(total).toBeCloseTo(691.2, 10);
  });

  it("mock-up example 4 — Labour day rates: 600 x 3 men x 6 days = 10800", () => {
    const values = buildStepValues([{ id: "c-day", name: "Day rate" }], { "c-day": 600 }, [
      { name: "Men", kind: "number", sample: 3 },
      { name: "Days", kind: "number", sample: 6 }
    ]);
    const steps: ChargeStep[] = [
      { op: "start", field: "Day rate" },
      { op: "multiply", field: "Men" },
      { op: "multiply", field: "Days" }
    ];
    expect(evaluateSteps(steps, values).total).toBe(10800);
  });

  it("an entered line value beats the sample; the sample is only the stand-in", () => {
    const values = buildStepValues(CORE_COLUMNS, { "c-rate": 1.7 }, CORE_LINE_FIELDS, {
      Depth: 150,
      Elevation: "Floor",
      Holes: 1
    });
    expect(values.Depth).toBe(150);
    // 150 -> 15 -> 15 -> 15 -> 25.50, elevation step skipped, x 1
    expect(evaluateSteps(CORE_STEPS, values).total).toBeCloseTo(25.5, 10);
  });

  it("a line field with no value and no sample is `missing-operand` — the column rule", () => {
    const values = buildStepValues([], {}, [{ name: "Depth", kind: "number" }]);
    expect(values).toEqual({});
    const { total, issues } = evaluateSteps([{ op: "start", field: "Depth" }], values);
    expect(total).toBeNull();
    expect(issues[0].code).toBe("missing-operand");
  });

  it("a text line field in the sum is `text-operand` — the TEXT column rule", () => {
    const values = buildStepValues(CORE_COLUMNS, { "c-rate": 1.7 }, CORE_LINE_FIELDS);
    const { total, issues } = evaluateSteps(
      [
        { op: "start", field: "Rate" },
        { op: "multiply", field: "Elevation" }
      ],
      values
    );
    expect(total).toBeNull();
    expect(issues[0].code).toBe("text-operand");
  });

  it("a column WINS a name clash, so a column-only step list is untouched", () => {
    const values = buildStepValues(
      [{ id: "c-depth", name: "Depth" }],
      { "c-depth": 150 },
      [{ name: "Depth", kind: "number", sample: 18 }]
    );
    expect(values.Depth).toBe(150);
  });

  it("declaring no line fields leaves the map exactly as it was", () => {
    const before = buildStepValues(CORE_COLUMNS, { "c-diameter": 32, "c-rate": 1.7 }, []);
    expect(before).toEqual({ Diameter: 32, Rate: 1.7 });
    expect(evaluateSteps(
      [
        { op: "start", field: "Rate" },
        { op: "multiply", field: "Diameter" }
      ],
      before
    ).total).toBe(54.4);
  });
});
