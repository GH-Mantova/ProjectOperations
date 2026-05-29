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
});
