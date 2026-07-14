import { computeCalculation } from "../forms-engine.service";
import { RulesEngineService } from "../rules-engine.service";
import type { PrismaService } from "../../../prisma/prisma.service";

describe("computeCalculation (F-4 calculation reducer)", () => {
  it("returns null for zero operands so callers can persist an empty cell", () => {
    expect(computeCalculation("sum", [])).toBeNull();
  });

  it("sums, subtracts, multiplies, averages, and picks min/max as expected", () => {
    expect(computeCalculation("sum", [1, 2, 3])).toBe(6);
    expect(computeCalculation("difference", [10, 2, 3])).toBe(5);
    expect(computeCalculation("product", [2, 3, 4])).toBe(24);
    expect(computeCalculation("average", [2, 4, 6])).toBe(4);
    expect(computeCalculation("min", [5, 1, 3])).toBe(1);
    expect(computeCalculation("max", [5, 1, 3])).toBe(5);
  });

  it("rounds to the requested decimal places", () => {
    expect(computeCalculation("average", [1, 2], 2)).toBe(1.5);
    expect(computeCalculation("average", [1, 2, 2], 4)).toBe(1.6667);
    expect(computeCalculation("average", [1, 2, 2], 0)).toBe(2);
  });

  it("clamps decimals to [0, 6] to avoid floating-point garbage", () => {
    expect(computeCalculation("sum", [1.111111111], 20)).toBe(1.111111);
    expect(computeCalculation("sum", [1.5], -3)).toBe(2);
  });

  it("returns null for unknown operations rather than throwing", () => {
    expect(computeCalculation("modulus", [1, 2])).toBeNull();
  });
});

describe("RulesEngineService.validateValues — terms (F-4)", () => {
  const svc = new RulesEngineService({} as PrismaService);

  const tpl = {
    sections: [
      {
        fields: [
          {
            fieldKey: "consent",
            label: "Site rules",
            isRequired: true,
            fieldType: "terms"
          }
        ]
      }
    ]
  };

  it("rejects a required terms field the submitter never toggled", () => {
    const result = svc.validateValues(tpl, {});
    expect(result.valid).toBe(false);
    expect(result.errors.consent).toMatch(/required/i);
  });

  it("rejects a terms value that lacks accepted:true", () => {
    const result = svc.validateValues(tpl, { consent: { accepted: false, version: "1" } });
    expect(result.valid).toBe(false);
    expect(result.errors.consent).toMatch(/accepted/i);
  });

  it("accepts a properly-formed acceptance record", () => {
    const result = svc.validateValues(tpl, {
      consent: { accepted: true, version: "1", acceptedAt: new Date().toISOString() }
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("leaves optional terms alone when omitted", () => {
    const optionalTpl = {
      sections: [
        {
          fields: [
            {
              fieldKey: "consent",
              label: "Optional acknowledgement",
              isRequired: false,
              fieldType: "terms"
            }
          ]
        }
      ]
    };
    const result = svc.validateValues(optionalTpl, {});
    expect(result.valid).toBe(true);
  });
});
