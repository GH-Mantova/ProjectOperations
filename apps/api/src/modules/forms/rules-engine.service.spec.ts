import { RulesEngineService, type Condition, type ConditionGroup } from "./rules-engine.service";
import type { PrismaService } from "../../prisma/prisma.service";

// PrismaService is only consumed by checkComplianceGates; the rest of the
// engine is pure. We stub Prisma with a thin mock that lets us exercise the
// asbestos-qualification gate and otherwise stays out of the way.

function makeService(qualifications: Array<{ qualType: string; expiryDate: Date | null }> = []) {
  const prismaMock = {
    workerProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: "worker-1",
        internalUserId: "user-1",
        qualifications
      })
    }
  } as unknown as PrismaService;
  return new RulesEngineService(prismaMock);
}

describe("RulesEngineService — evaluateConditionGroup", () => {
  const svc = makeService();

  it("AND group with both true is true", () => {
    const group: ConditionGroup = {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        { fieldKey: "b", operator: "equals", value: 2 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(true);
  });

  it("AND group with one false is false", () => {
    const group: ConditionGroup = {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        { fieldKey: "b", operator: "equals", value: 99 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(false);
  });

  it("OR group with one true is true", () => {
    const group: ConditionGroup = {
      logic: "OR",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 99 } as Condition,
        { fieldKey: "b", operator: "equals", value: 2 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(true);
  });

  it("OR group with both false is false", () => {
    const group: ConditionGroup = {
      logic: "OR",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 99 } as Condition,
        { fieldKey: "b", operator: "equals", value: 99 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(false);
  });

  it("nested A AND (B OR C)", () => {
    const group: ConditionGroup = {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        {
          logic: "OR",
          conditions: [
            { fieldKey: "b", operator: "equals", value: 99 } as Condition,
            { fieldKey: "c", operator: "equals", value: 3 } as Condition
          ]
        } as ConditionGroup
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2, c: 3 })).toBe(true);
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2, c: 99 })).toBe(false);
  });

  it("empty group is true (no constraint)", () => {
    expect(svc.evaluateConditionGroup({ logic: "AND", conditions: [] }, {})).toBe(true);
  });

  it("operator coverage", () => {
    const v = { n: 5, s: "hello world", arr: ["a", "b"], blank: "", missing: undefined };
    const cases: Array<[Condition, boolean]> = [
      [{ fieldKey: "n", operator: "equals", value: 5 }, true],
      [{ fieldKey: "n", operator: "not_equals", value: 4 }, true],
      [{ fieldKey: "s", operator: "contains", value: "world" }, true],
      [{ fieldKey: "s", operator: "not_contains", value: "zzz" }, true],
      [{ fieldKey: "n", operator: "greater_than", value: 1 }, true],
      [{ fieldKey: "n", operator: "less_than", value: 10 }, true],
      [{ fieldKey: "n", operator: "between", value: 1, value2: 10 }, true],
      [{ fieldKey: "n", operator: "between", value: 100, value2: 200 }, false],
      [{ fieldKey: "blank", operator: "is_empty" }, true],
      [{ fieldKey: "n", operator: "is_not_empty" }, true],
      [{ fieldKey: "missing", operator: "is_empty" }, true],
      [{ fieldKey: "arr", operator: "contains", value: "a" }, true],
      [{ fieldKey: "n", operator: "is_one_of", value: [1, 5, 10] }, true],
      [{ fieldKey: "n", operator: "is_not_one_of", value: [2, 3, 4] }, true]
    ];
    for (const [cond, expected] of cases) {
      expect(svc.evaluateCondition(cond, v as never)).toBe(expected);
    }
  });
});

describe("RulesEngineService — validateValues", () => {
  const svc = makeService();

  it("required field empty → error", () => {
    const tpl = {
      sections: [
        {
          fields: [
            { fieldKey: "name", label: "Name", isRequired: true, fieldType: "short_text" }
          ]
        }
      ]
    };
    const result = svc.validateValues(tpl, {});
    expect(result.valid).toBe(false);
    expect(result.errors.name).toMatch(/required/i);
  });

  it("required field filled → pass", () => {
    const tpl = {
      sections: [
        {
          fields: [{ fieldKey: "name", label: "Name", isRequired: true, fieldType: "short_text" }]
        }
      ]
    };
    expect(svc.validateValues(tpl, { name: "Marco" }).valid).toBe(true);
  });

  it("email validation rejects invalid value", () => {
    const tpl = {
      sections: [
        {
          fields: [{ fieldKey: "e", label: "Email", isRequired: false, fieldType: "email" }]
        }
      ]
    };
    expect(svc.validateValues(tpl, { e: "not-an-email" }).valid).toBe(false);
    expect(svc.validateValues(tpl, { e: "good@example.com" }).valid).toBe(true);
  });

  it("number min/max custom validations", () => {
    const tpl = {
      sections: [
        {
          fields: [
            {
              fieldKey: "n",
              label: "Quantity",
              isRequired: false,
              fieldType: "number",
              validations: [
                { type: "min", value: 1, message: "Quantity must be at least 1." },
                { type: "max", value: 100 }
              ]
            }
          ]
        }
      ]
    };
    expect(svc.validateValues(tpl, { n: 5 }).valid).toBe(true);
    expect(svc.validateValues(tpl, { n: 0 }).errors.n).toBe("Quantity must be at least 1.");
    expect(svc.validateValues(tpl, { n: 200 }).errors.n).toBeDefined();
  });

  it("conditional required: condition met + empty → error", () => {
    const tpl = {
      sections: [
        {
          fields: [
            { fieldKey: "trigger", label: "Trigger", isRequired: false, fieldType: "toggle" },
            {
              fieldKey: "details",
              label: "Details",
              isRequired: false,
              fieldType: "long_text",
              conditions: [
                {
                  trigger: "on_change",
                  conditionGroup: {
                    logic: "AND",
                    conditions: [{ fieldKey: "trigger", operator: "equals", value: true }]
                  },
                  actions: [{ type: "require" }]
                }
              ]
            }
          ]
        }
      ]
    };
    expect(svc.validateValues(tpl, { trigger: true }).errors.details).toBeDefined();
    expect(svc.validateValues(tpl, { trigger: false }).valid).toBe(true);
    expect(svc.validateValues(tpl, { trigger: true, details: "..." }).valid).toBe(true);
  });
});

describe("RulesEngineService — checkComplianceGates", () => {
  it("asbestos category + valid asbestos_b qualification → passes", async () => {
    const svc = makeService([
      { qualType: "asbestos_b", expiryDate: new Date("2099-01-01") }
    ]);
    const result = await svc.checkComplianceGates(
      { category: "asbestos" },
      "user-1"
    );
    expect(result.passed).toBe(true);
  });

  it("asbestos category + no qualification → fails with message", async () => {
    const svc = makeService([]);
    const result = await svc.checkComplianceGates(
      { category: "asbestos" },
      "user-1"
    );
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toMatch(/asbestos/i);
  });

  it("asbestos category + expired qualification → fails", async () => {
    const svc = makeService([
      { qualType: "asbestos_a", expiryDate: new Date("2000-01-01") }
    ]);
    const result = await svc.checkComplianceGates(
      { category: "asbestos" },
      "user-1"
    );
    expect(result.passed).toBe(false);
  });

  it("non-asbestos category → no gate applies", async () => {
    const svc = makeService([]);
    const result = await svc.checkComplianceGates({ category: "daily" }, "user-1");
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

describe("RulesEngineService — collectOnSubmitActions", () => {
  const svc = makeService();

  it("returns matching on_submit actions only when conditions hold", () => {
    const tpl = {
      sections: [
        {
          fields: [
            {
              actions: [
                {
                  trigger: "on_submit",
                  conditionGroup: {
                    logic: "AND",
                    conditions: [{ fieldKey: "severity", operator: "equals", value: "critical" }]
                  },
                  actions: [
                    {
                      type: "send_notification",
                      notificationTarget: "safety.admin",
                      notificationMessage: "Critical incident reported"
                    }
                  ]
                },
                {
                  trigger: "on_change",
                  conditionGroup: { logic: "AND", conditions: [] },
                  actions: [{ type: "show", target: "details" }]
                }
              ]
            }
          ]
        }
      ]
    };
    const collected = svc.collectOnSubmitActions(tpl, { severity: "critical" });
    expect(collected).toHaveLength(1);
    expect(collected[0].type).toBe("send_notification");

    const noMatch = svc.collectOnSubmitActions(tpl, { severity: "low" });
    expect(noMatch).toHaveLength(0);
  });
});
