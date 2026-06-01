import { computeAdjustedCostLines } from "./client-quotes.service";

describe("computeAdjustedCostLines", () => {
  const twoLines = [
    { id: "line-1", price: 80000, overrideAmount: null },
    { id: "line-2", price: 20000, overrideAmount: null }
  ];

  it("returns base values unchanged when no adjustment", () => {
    const result = computeAdjustedCostLines({
      lines: twoLines,
      adjustmentPct: 0,
      adjustmentDollar: 0
    });
    expect(result.baseTotalCostLines).toBe(100000);
    expect(result.adjustmentAmount).toBe(0);
    expect(result.adjustedTotal).toBe(100000);
    expect(result.lineAllocations[0].displayed).toBe(80000);
    expect(result.lineAllocations[1].displayed).toBe(20000);
  });

  it("applies percentage-only adjustment proportionally", () => {
    const result = computeAdjustedCostLines({
      lines: twoLines,
      adjustmentPct: 10,
      adjustmentDollar: 0
    });
    expect(result.adjustedTotal).toBe(110000);
    expect(result.adjustmentAmount).toBe(10000);
    expect(result.lineAllocations[0].displayed).toBe(88000);
    expect(result.lineAllocations[1].displayed).toBe(22000);
  });

  it("applies dollar-only adjustment proportionally", () => {
    const result = computeAdjustedCostLines({
      lines: twoLines,
      adjustmentPct: 0,
      adjustmentDollar: 5000
    });
    expect(result.adjustedTotal).toBe(105000);
    expect(result.lineAllocations[0].displayed).toBe(84000);
    expect(result.lineAllocations[1].displayed).toBe(21000);
  });

  it("applies compound formula: base × (1 + pct/100) + dollar", () => {
    const result = computeAdjustedCostLines({
      lines: twoLines,
      adjustmentPct: 10,
      adjustmentDollar: 2000
    });
    // 100000 × 1.10 + 2000 = 112000
    expect(result.adjustedTotal).toBe(112000);
    expect(result.adjustmentAmount).toBe(12000);
    // 80% of 12000 = 9600 → line-1 displayed = 89600
    expect(result.lineAllocations[0].displayed).toBe(89600);
    // 20% of 12000 = 2400 → line-2 displayed = 22400
    expect(result.lineAllocations[1].displayed).toBe(22400);
  });

  it("handles negative adjustment (discount)", () => {
    const result = computeAdjustedCostLines({
      lines: twoLines,
      adjustmentPct: -5,
      adjustmentDollar: 0
    });
    expect(result.adjustedTotal).toBe(95000);
    expect(result.lineAllocations[0].displayed).toBe(76000);
    expect(result.lineAllocations[1].displayed).toBe(19000);
  });

  it("assigns remainder to the largest line on rounding", () => {
    const threeLines = [
      { id: "a", price: 33333.33, overrideAmount: null },
      { id: "b", price: 33333.33, overrideAmount: null },
      { id: "c", price: 33333.34, overrideAmount: null }
    ];
    const result = computeAdjustedCostLines({
      lines: threeLines,
      adjustmentPct: 10,
      adjustmentDollar: 0
    });
    const sum = result.lineAllocations.reduce((s, l) => s + l.displayed, 0);
    expect(Math.round(sum * 100) / 100).toBe(result.adjustedTotal);
  });

  it("respects overrideAmount — only allocates to non-overridden lines", () => {
    const lines = [
      { id: "line-1", price: 80000, overrideAmount: 75000 },
      { id: "line-2", price: 20000, overrideAmount: null }
    ];
    const result = computeAdjustedCostLines({
      lines,
      adjustmentPct: 10,
      adjustmentDollar: 0
    });
    // total adj = 10000; line-1 is overridden at 75000
    // line-2 absorbs all 10000 of the adjustment since it's the only allocatable line
    expect(result.lineAllocations[0].displayed).toBe(75000);
    expect(result.lineAllocations[1].displayed).toBe(30000);
  });

  it("handles empty lines array", () => {
    const result = computeAdjustedCostLines({
      lines: [],
      adjustmentPct: 10,
      adjustmentDollar: 500
    });
    expect(result.baseTotalCostLines).toBe(0);
    expect(result.adjustedTotal).toBe(500);
    expect(result.lineAllocations).toEqual([]);
  });

  describe("invariants", () => {
    const sumDisplayed = (allocations: Array<{ displayed: number }>): number =>
      allocations.reduce((s, l) => s + l.displayed, 0);

    describe("Invariant 1 — sum of displayed reconciles with adjustedTotal", () => {
      const fourLines = [
        { id: "L1", price: 100, overrideAmount: null },
        { id: "L2", price: 200, overrideAmount: null },
        { id: "L3", price: 300, overrideAmount: null },
        { id: "L4", price: 400, overrideAmount: null }
      ];
      const combos: Array<{ pct: number; dollar: number; label: string }> = [
        { pct: 15, dollar: 0, label: "pct only" },
        { pct: 0, dollar: 500, label: "dollar only" },
        { pct: 15, dollar: 500, label: "pct + dollar" },
        { pct: -10, dollar: 0, label: "negative pct" },
        { pct: 7.5, dollar: 123.45, label: "fractional pct + dollar" }
      ];

      combos.forEach(({ pct, dollar, label }) => {
        it(`reconciles for ${label} (pct=${pct}, dollar=${dollar})`, () => {
          const result = computeAdjustedCostLines({
            lines: fourLines,
            adjustmentPct: pct,
            adjustmentDollar: dollar
          });
          const sum = sumDisplayed(result.lineAllocations);
          expect(Math.abs(sum - result.adjustedTotal)).toBeLessThanOrEqual(0.01);
        });
      });
    });

    describe("Invariant 2 — zero adjustment is a no-op", () => {
      it("leaves every displayed equal to basePrice when pct=0 and dollar=0", () => {
        const lines = [
          { id: "a", price: 123.45, overrideAmount: null },
          { id: "b", price: 678.9, overrideAmount: null },
          { id: "c", price: 1000, overrideAmount: null }
        ];
        const result = computeAdjustedCostLines({
          lines,
          adjustmentPct: 0,
          adjustmentDollar: 0
        });
        expect(result.adjustmentAmount).toBe(0);
        result.lineAllocations.forEach((alloc, idx) => {
          expect(alloc.displayed).toBe(lines[idx].price);
          expect(alloc.baseValue).toBe(lines[idx].price);
        });
      });
    });

    describe("Invariant 3 — negative pct produces a discount that still reconciles", () => {
      it("distributes a negative adjustment proportionally and reconciles", () => {
        const lines = [
          { id: "a", price: 250, overrideAmount: null },
          { id: "b", price: 750, overrideAmount: null }
        ];
        const result = computeAdjustedCostLines({
          lines,
          adjustmentPct: -10,
          adjustmentDollar: 0
        });
        expect(result.adjustedTotal).toBe(900);
        expect(result.adjustmentAmount).toBe(-100);
        // Every line moved in the negative direction, none flipped sign.
        result.lineAllocations.forEach((alloc, idx) => {
          expect(alloc.displayed).toBeLessThan(lines[idx].price);
          expect(alloc.displayed).toBeGreaterThan(0);
        });
        const sum = sumDisplayed(result.lineAllocations);
        expect(Math.abs(sum - result.adjustedTotal)).toBeLessThanOrEqual(0.01);
      });
    });

    describe("Invariant 4 — rounding remainder lands on the largest-price line", () => {
      it("absorbs a negative remainder on the largest line ([$33,$66,$77] + $10)", () => {
        const lines = [
          { id: "small", price: 33, overrideAmount: null },
          { id: "mid", price: 66, overrideAmount: null },
          { id: "large", price: 77, overrideAmount: null }
        ];
        const result = computeAdjustedCostLines({
          lines,
          adjustmentPct: 0,
          adjustmentDollar: 10
        });
        // Per-line shares before remainder reconciliation:
        //   small: round2(10 * 33/176) = $1.88 → displayed $34.88
        //   mid:   round2(10 * 66/176) = $3.75 → displayed $69.75
        //   large: round2(10 * 77/176) = $4.38 → displayed $81.38
        // Sum-of-shares = $10.01, so remainder = -$0.01 lands on the largest line.
        expect(result.lineAllocations[0].displayed).toBe(34.88);
        expect(result.lineAllocations[1].displayed).toBe(69.75);
        expect(result.lineAllocations[2].displayed).toBe(81.37);
        const sum = sumDisplayed(result.lineAllocations);
        expect(Math.abs(sum - result.adjustedTotal)).toBeLessThanOrEqual(0.01);
      });

      it("absorbs a positive remainder on the largest line ([$10,$30,$60] + $0.04)", () => {
        const lines = [
          { id: "small", price: 10, overrideAmount: null },
          { id: "mid", price: 30, overrideAmount: null },
          { id: "large", price: 60, overrideAmount: null }
        ];
        const result = computeAdjustedCostLines({
          lines,
          adjustmentPct: 0,
          adjustmentDollar: 0.04
        });
        // Per-line shares before remainder reconciliation:
        //   small: round2(0.04 * 10/100) = $0.00 → displayed $10.00
        //   mid:   round2(0.04 * 30/100) = $0.01 → displayed $30.01
        //   large: round2(0.04 * 60/100) = $0.02 → displayed $60.02
        // Sum-of-shares = $0.03, so remainder = +$0.01 lands on the largest line.
        expect(result.lineAllocations[0].displayed).toBe(10);
        expect(result.lineAllocations[1].displayed).toBe(30.01);
        expect(result.lineAllocations[2].displayed).toBe(60.03);
        const sum = sumDisplayed(result.lineAllocations);
        expect(Math.abs(sum - result.adjustedTotal)).toBeLessThanOrEqual(0.01);
      });
    });

    describe("Invariant 5 — identical basePrices produce identical adjustments", () => {
      it("distributes evenly across 4 equal lines with no asymmetric rounding", () => {
        const lines = [
          { id: "a", price: 100, overrideAmount: null },
          { id: "b", price: 100, overrideAmount: null },
          { id: "c", price: 100, overrideAmount: null },
          { id: "d", price: 100, overrideAmount: null }
        ];
        const result = computeAdjustedCostLines({
          lines,
          adjustmentPct: 0,
          adjustmentDollar: 20
        });
        // Share = $20 * 100/400 = $5.00 exactly → no remainder, perfect symmetry.
        result.lineAllocations.forEach((alloc) => {
          expect(alloc.displayed).toBe(105);
        });
        const sum = sumDisplayed(result.lineAllocations);
        expect(sum).toBe(result.adjustedTotal);
      });
    });
  });
});
