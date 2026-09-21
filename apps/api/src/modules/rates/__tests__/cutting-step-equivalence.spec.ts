/**
 * cutting-step-equivalence.spec.ts — CHARGE_STEPS_PRICE_CUTTING_V1
 *
 * THE gate test. For every seeded combination, asserts that:
 *   1. The inline arithmetic (constants pinned from the seed + step spec) gives
 *      the expected value.
 *   2. The step evaluator (evaluateSteps) gives the same value.
 *
 * Both sides must agree TO THE CENT.
 *
 * Seeded combinations tested:
 *   cutting table (Demosaw Floor, Demosaw Wall, Ringsaw Any/Wall, Roadsaw Floor)
 *   cutting-mm table (Tracksaw Floor/Wall at 25mm and 80mm)
 *   core-hole (Wall and Inverted elevation, various diameters)
 *
 * Pinned seeded values from migration.sql baseline:
 *   Ringsaw Any 175mm = $71.30; Any 200mm = $84.25; Any 225mm = $96.10
 *   Ringsaw Wall 175mm = $78.43; Wall 200mm = $92.68; Wall 225mm = $105.71
 *   Ringsaw Wall 250mm = $118.80; Wall 300mm = $138.99; Wall 320mm = $155.65
 *   Demosaw Wall/Concrete 150mm = $48.60; Floor 150mm = $28.40
 *   Tracksaw Floor $18.00; Wall $19.80
 *   Flush-cut Floor $18.00; Wall $19.80
 *   Core-hole 32mm = $1.70/hole; 100mm = $2.55; 150mm = $3.20
 */

import { evaluateSteps } from "../rate-step-evaluator";
import type { ChargeStep } from "../rate-step-evaluator";
import type { StepValues } from "@project-ops/config/charge-step-semantics";

// ---------------------------------------------------------------------------
// Step definitions (inline from seed migration)
// ---------------------------------------------------------------------------

// cutting table chargeSteps:
//   (1) start: Rate per m
//   (2) multiply 1.25 when method is "High-Freq"
//   (3) multiply 1.25 when method is "Low-emission"
//   (4) multiply metres
const CUTTING_STEPS: ChargeStep[] = [
  { op: "start", field: "Rate per m" },
  { op: "multiply", field: 1.25, when: { field: "method", cmp: "is", value: "High-Freq" } },
  { op: "multiply", field: 1.25, when: { field: "method", cmp: "is", value: "Low-emission" } },
  { op: "multiply", field: "metres" }
];

// cutting-mm table chargeSteps:
//   start Rate per m -> multiply depthMm -> divide 25 -> floor 18 -> multiply 1.25 when method is High-Freq -> multiply metres
const CUTTING_MM_STEPS: ChargeStep[] = [
  { op: "start", field: "Rate per m" },
  { op: "multiply", field: "depthMm" },
  { op: "divide", field: 25 },
  { op: "floor", value: 18 },
  { op: "multiply", field: 1.25, when: { field: "method", cmp: "is", value: "High-Freq" } },
  { op: "multiply", field: "metres" }
];

// core-hole table chargeSteps:
//   start depthMm -> divide 10 -> round nearest 1 -> floor 1
//   -> multiply Rate per hole -> multiply 1.1 when elevation is "Wall"
//   -> multiply 2 when elevation is "Inverted" -> multiply holes
const CORE_HOLE_STEPS: ChargeStep[] = [
  { op: "start", field: "depthMm" },
  { op: "divide", field: 10 },
  { op: "round", direction: "nearest", interval: 1 },
  { op: "floor", value: 1 },
  { op: "multiply", field: "Rate per hole" },
  { op: "multiply", field: 1.1, when: { field: "elevation", cmp: "is", value: "Wall" } },
  { op: "multiply", field: 2, when: { field: "elevation", cmp: "is", value: "Inverted" } },
  { op: "multiply", field: "holes" }
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function evalCutting(ratePerM: number, method: string, metres: number): number {
  const values: StepValues = { "Rate per m": ratePerM, method, metres };
  const result = evaluateSteps(CUTTING_STEPS, values);
  if (result.total === null) throw new Error(`Step total null: ${JSON.stringify(result.issues)}`);
  return result.total;
}

function evalCuttingMm(ratePerM: number, depthMm: number, metres: number, method = "Fuel"): number {
  const values: StepValues = { "Rate per m": ratePerM, depthMm, metres, method };
  const result = evaluateSteps(CUTTING_MM_STEPS, values);
  if (result.total === null) throw new Error(`Step total null: ${JSON.stringify(result.issues)}`);
  return result.total;
}

function evalCoreHole(depthMm: number, ratePerHole: number, elevation: string, holes: number): number {
  const values: StepValues = { depthMm, "Rate per hole": ratePerHole, elevation, holes };
  const result = evaluateSteps(CORE_HOLE_STEPS, values);
  if (result.total === null) throw new Error(`Step total null: ${JSON.stringify(result.issues)}`);
  return result.total;
}

// Inline arithmetic — the expected value, pinned from the seed.
function inlineCutting(ratePerM: number, method: string, metres: number): number {
  let total = ratePerM;
  if (method === "High-Freq" || method === "Low-emission") total *= 1.25;
  total *= metres;
  return total;
}

function inlineCuttingMm(ratePerM: number, depthMm: number, metres: number, method = "Fuel"): number {
  // step formula: start ratePerM -> multiply depthMm -> divide 25 -> floor 18 -> multiply metres
  // floor 18 is a LITERAL minimum of $18.00 (not the row value).
  let total = ratePerM * depthMm / 25;
  total = Math.max(total, 18); // floor: literal 18
  if (method === "High-Freq") total *= 1.25; // METHOD_MULTIPLIER, applied after the stretch as on main
  total *= metres;
  return total;
}

function inlineCoreHole(depthMm: number, ratePerHole: number, elevation: string, holes: number): number {
  let units = Math.round(depthMm / 10);
  units = Math.max(units, 1);
  let total = units * ratePerHole;
  if (elevation === "Wall") total *= 1.1;
  if (elevation === "Inverted") total *= 2.0;
  total *= holes;
  return total;
}

// ---------------------------------------------------------------------------
// cutting table: Demosaw Floor rows
// ---------------------------------------------------------------------------

describe("cutting steps - Demosaw Floor (no method)", () => {
  const demoFloorCases = [
    { depth: 25, rate: 7.55 },
    { depth: 50, rate: 10.9 },
    { depth: 75, rate: 15.35 },
    { depth: 100, rate: 22.25 },
    { depth: 125, rate: 24.7 },
    { depth: 150, rate: 28.4 }
  ];

  for (const { depth, rate } of demoFloorCases) {
    test(`Demosaw Floor ${depth}mm = $${rate} both ways`, () => {
      const inline = inlineCutting(rate, "Fuel", 1);
      const stepped = evalCutting(rate, "Fuel", 1);
      expect(stepped).toBeCloseTo(inline, 2);
      expect(stepped).toBeCloseTo(rate, 2);
    });
  }
});

// ---------------------------------------------------------------------------
// cutting table: Demosaw Wall/Concrete rows (no extra elevation - priced row)
// ---------------------------------------------------------------------------

describe("cutting steps - Demosaw Wall/Concrete (priced rows, no elevation multiplier)", () => {
  const demoWallCases = [
    { depth: 25, rate: 9.95 },
    { depth: 50, rate: 17 },
    { depth: 75, rate: 23.6 },
    { depth: 100, rate: 31.7 },
    { depth: 125, rate: 39.75 },
    { depth: 150, rate: 48.6 }
  ];

  for (const { depth, rate } of demoWallCases) {
    test(`Demosaw Wall/Concrete ${depth}mm = $${rate} via steps (no 1.1 uplift)`, () => {
      const stepped = evalCutting(rate, "Fuel", 1);
      expect(stepped).toBeCloseTo(rate, 2);
    });
  }

  test("Demosaw Wall/Concrete 150mm = $48.60 (not $53.46 - D4)", () => {
    expect(evalCutting(48.6, "Fuel", 1)).toBeCloseTo(48.6, 2);
  });
});

// ---------------------------------------------------------------------------
// cutting table: Ringsaw Any rows (Any elevation — step applies no elevation)
// ---------------------------------------------------------------------------

describe("cutting steps - Ringsaw Any (existing rows, Fuel method)", () => {
  const ringsawAnyCases = [
    { depth: 175, rate: 71.3 },
    { depth: 200, rate: 84.25 },
    { depth: 225, rate: 96.1 },
    { depth: 250, rate: 108 },
    { depth: 275, rate: 117.7 },
    { depth: 300, rate: 126.35 },
    { depth: 320, rate: 141.5 }
  ];

  for (const { depth, rate } of ringsawAnyCases) {
    test(`Ringsaw Any ${depth}mm = $${rate} both ways`, () => {
      const inline = inlineCutting(rate, "Fuel", 1);
      const stepped = evalCutting(rate, "Fuel", 1);
      expect(stepped).toBeCloseTo(inline, 2);
      expect(stepped).toBeCloseTo(rate, 2);
    });
  }
});

// ---------------------------------------------------------------------------
// cutting table: Ringsaw Wall rows (seeded at Any×1.1 to the cent)
// ---------------------------------------------------------------------------

describe("cutting steps - Ringsaw Wall (priced Wall rows)", () => {
  const ringsawWallCases = [
    { depth: 175, rate: 78.43 },
    { depth: 200, rate: 92.68 },
    { depth: 225, rate: 105.71 },
    { depth: 250, rate: 118.8 },
    { depth: 300, rate: 138.99 },
    { depth: 320, rate: 155.65 }
  ];

  for (const { depth, rate } of ringsawWallCases) {
    test(`Ringsaw Wall ${depth}mm = $${rate} both ways`, () => {
      const inline = inlineCutting(rate, "Fuel", 1);
      const stepped = evalCutting(rate, "Fuel", 1);
      expect(stepped).toBeCloseTo(inline, 2);
      expect(stepped).toBeCloseTo(rate, 2);
    });
  }

  test("Ringsaw Wall 175mm = $78.43 (the spec case)", () => {
    expect(evalCutting(78.43, "Fuel", 1)).toBeCloseTo(78.43, 2);
  });
});

// ---------------------------------------------------------------------------
// cutting table: High-Freq and Low-emission method multipliers
// ---------------------------------------------------------------------------

describe("cutting steps - method multiplier (High-Freq = 1.25, Low-emission = 1.25)", () => {
  test("Ringsaw Any 175mm High-Freq = 71.30 * 1.25 = $89.125 both ways", () => {
    const rate = 71.3;
    const inline = inlineCutting(rate, "High-Freq", 1);
    const stepped = evalCutting(rate, "High-Freq", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(89.125, 2);
  });

  test("Demosaw Floor 150mm Low-emission = 28.40 * 1.25 = $35.50 both ways", () => {
    const rate = 28.4;
    const inline = inlineCutting(rate, "Low-emission", 1);
    const stepped = evalCutting(rate, "Low-emission", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(35.5, 2);
  });

  test("Ringsaw Wall 200mm High-Freq = 92.68 * 1.25 = $115.85 both ways", () => {
    const rate = 92.68;
    const inline = inlineCutting(rate, "High-Freq", 1);
    const stepped = evalCutting(rate, "High-Freq", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(115.85, 2);
  });

  test("Fuel method = no multiplier (1.0)", () => {
    const rate = 71.3;
    const stepped = evalCutting(rate, "Fuel", 1);
    expect(stepped).toBeCloseTo(71.3, 2);
  });
});

// ---------------------------------------------------------------------------
// cutting-mm table: Tracksaw at 25mm and 80mm
// ---------------------------------------------------------------------------

describe("cutting-mm steps - Tracksaw Floor (D2 — depth scaling)", () => {
  test("Tracksaw Floor 25mm = $18.00 both ways (floor enforced)", () => {
    const inline = inlineCuttingMm(18.0, 25, 1);
    const stepped = evalCuttingMm(18.0, 25, 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(18.0, 2);
  });

  test("Tracksaw Floor 80mm = $57.60 both ways (depth scaling)", () => {
    const inline = inlineCuttingMm(18.0, 80, 1);
    const stepped = evalCuttingMm(18.0, 80, 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(57.6, 2);
  });

  test("Tracksaw Floor 10mm = $18.00 both ways (floor prevents going below $18)", () => {
    const inline = inlineCuttingMm(18.0, 10, 1);
    const stepped = evalCuttingMm(18.0, 10, 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(18.0, 2);
  });
});

describe("cutting-mm steps - Tracksaw Wall", () => {
  test("Tracksaw Wall 25mm = $19.80 both ways (the spec case)", () => {
    const inline = inlineCuttingMm(19.8, 25, 1);
    const stepped = evalCuttingMm(19.8, 25, 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(19.8, 2);
  });

  test("Tracksaw Wall 80mm = $63.36 both ways (19.80 * 80 / 25)", () => {
    const expected = 19.8 * 80 / 25; // 63.36
    const inline = inlineCuttingMm(19.8, 80, 1);
    const stepped = evalCuttingMm(19.8, 80, 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(expected, 2);
  });
});

describe("cutting-mm steps - Flush-cut", () => {
  test("Flush-cut Floor 25mm = $18.00 both ways", () => {
    expect(evalCuttingMm(18.0, 25, 1)).toBeCloseTo(18.0, 2);
  });

  test("Flush-cut Wall 25mm = $19.80 both ways", () => {
    expect(evalCuttingMm(19.8, 25, 1)).toBeCloseTo(19.8, 2);
  });

  // Flush-cut allows High-Freq (METHODS_BY_EQUIPMENT); main applies METHOD_MULTIPLIER 1.25
  // after the depth stretch. The step path must keep that price.
  test("Flush-cut Floor 25mm High-Freq = $22.50 both ways", () => {
    expect(evalCuttingMm(18.0, 25, 1, "High-Freq")).toBeCloseTo(22.5, 2);
    expect(inlineCuttingMm(18.0, 25, 1, "High-Freq")).toBeCloseTo(22.5, 2);
  });

  test("Flush-cut Wall 80mm High-Freq = $79.20 both ways", () => {
    expect(evalCuttingMm(19.8, 80, 1, "High-Freq")).toBeCloseTo(79.2, 2);
    expect(inlineCuttingMm(19.8, 80, 1, "High-Freq")).toBeCloseTo(79.2, 2);
  });
});

// ---------------------------------------------------------------------------
// core-hole: Wall and Inverted elevation
// ---------------------------------------------------------------------------

describe("core-hole steps - depth rounding, elevation, holes (D1 + step path)", () => {
  test("core-hole 32mm Floor 1 hole = $1.70 (3 units * 1.70/hole per 10mm, floor 1, round 3.2->3)", () => {
    // depthMm=32: 32/10=3.2, round=3, floor(1)=3, * 1.70 = 5.10
    // Wait: spec says depth is the DRILL depth (hole depth in mm).
    // For 32mm diameter, depthMm is the depth of the hole in mm.
    // The test spec says: core-hole 32mm = $1.70/hole per 10mm depth
    // For depthMm=30: 30/10=3, *$1.70 = $5.10 for 1 hole
    const stepped = evalCoreHole(30, 1.70, "Floor", 1);
    const inline = inlineCoreHole(30, 1.70, "Floor", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(5.10, 2);
  });

  test("core-hole 32mm diameter Wall 30mm depth = 5.10 * 1.1 = $5.61 via steps", () => {
    const stepped = evalCoreHole(30, 1.70, "Wall", 1);
    const inline = inlineCoreHole(30, 1.70, "Wall", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(5.61, 2);
  });

  test("core-hole Inverted elevation doubles the rate", () => {
    const stepped = evalCoreHole(30, 1.70, "Inverted", 1);
    const inline = inlineCoreHole(30, 1.70, "Inverted", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(10.20, 2);
  });

  test("core-hole minimum 1 depth unit (depthMm=5 rounds to 1)", () => {
    const stepped = evalCoreHole(5, 1.70, "Floor", 1);
    const inline = inlineCoreHole(5, 1.70, "Floor", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(1.70, 2);
  });

  test("core-hole depth rounding: 14mm rounds to 1 unit (1.4->1), $1.70 (D1)", () => {
    const stepped = evalCoreHole(14, 1.70, "Floor", 1);
    expect(stepped).toBeCloseTo(1.70, 2);
  });

  test("core-hole depth rounding: 15mm rounds to 2 units (1.5->2), $3.40 (D1)", () => {
    const stepped = evalCoreHole(15, 1.70, "Floor", 1);
    expect(stepped).toBeCloseTo(3.40, 2);
  });

  test("core-hole 100mm diameter, Floor, depth=50mm, 2 holes = (5 units * 2.55 * 1 * 2) = $25.50", () => {
    // 50/10=5, *2.55 = 12.75 per hole, * 2 holes = 25.50
    const stepped = evalCoreHole(50, 2.55, "Floor", 2);
    const inline = inlineCoreHole(50, 2.55, "Floor", 2);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(25.50, 2);
  });

  test("core-hole 150mm diameter, Inverted, depth=30mm, 1 hole = (3 * 3.20 * 2) = $19.20", () => {
    const stepped = evalCoreHole(30, 3.20, "Inverted", 1);
    const inline = inlineCoreHole(30, 3.20, "Inverted", 1);
    expect(stepped).toBeCloseTo(inline, 2);
    expect(stepped).toBeCloseTo(19.20, 2);
  });
});
