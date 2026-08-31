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
  StepArithmeticTypeError,
  type ChargeStep,
  type TrailEntry,
} from "../rate-step-evaluator";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function totalOf(steps: ChargeStep[], values: Record<string, number | string>): number {
  return evaluateSteps(steps, values).total;
}

function trailOf(steps: ChargeStep[], values: Record<string, number | string>): TrailEntry[] {
  return evaluateSteps(steps, values).trail;
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

  it("treats missing field as 0", () => {
    const steps: ChargeStep[] = [{ op: "start", field: "Missing" }];
    expect(totalOf(steps, {})).toBe(0);
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

  it("throws on divide-by-zero", () => {
    const steps: ChargeStep[] = [...base, { op: "divide", field: 0 }];
    expect(() => totalOf(steps, {})).toThrow("divide by zero");
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
  it("throws StepArithmeticTypeError naming the field when start uses a string field", () => {
    const steps: ChargeStep[] = [{ op: "start", field: "Elevation" }];
    let caught: unknown;
    try {
      totalOf(steps, { Elevation: "Inverted" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StepArithmeticTypeError);
    expect((caught as StepArithmeticTypeError).fieldName).toBe("Elevation");
  });

  it("throws StepArithmeticTypeError naming the field when multiply uses a string field", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: "Elevation" },
    ];
    let caught: unknown;
    try {
      totalOf(steps, { Elevation: "Inverted" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StepArithmeticTypeError);
    expect((caught as StepArithmeticTypeError).fieldName).toBe("Elevation");
    expect((caught as StepArithmeticTypeError).message).toContain('"Elevation"');
  });

  it("does NOT throw when a string field appears only in a condition (not the operand)", () => {
    // Condition references "Elevation" (string), but the multiply operand is a literal.
    const steps: ChargeStep[] = [
      { op: "start", field: 10 },
      { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
    ];
    expect(() => totalOf(steps, { Elevation: "Inverted" })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
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
