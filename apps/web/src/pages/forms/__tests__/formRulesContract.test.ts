import { describe, expect, it } from "vitest";
import {
  evaluateConditionGroup,
  type Condition,
  type ConditionGroup,
  type RuleValueMap
} from "@project-ops/config/forms-rule-definition";
import { RulesEngineService } from "../../../../../api/src/modules/forms/rules-engine.service";
import type { PrismaService } from "../../../../../api/src/prisma/prisma.service";

// F-2b — contract test: pins the client-side evaluator that FormFillPage
// calls (shared evaluateConditionGroup from @project-ops/config) to the
// server-side RulesEngineService.evaluateConditionGroup. Both should now
// delegate to the same shared implementation; this test proves they never
// silently drift. If a future change inlines evaluation back into either
// consumer, at least one operator or nesting case here will diverge and
// this test will fail.

// checkComplianceGates is the only Prisma consumer inside RulesEngineService;
// nothing under evaluation touches the DB, so a bare stub is enough.
const prismaStub = {} as unknown as PrismaService;
const svc = new RulesEngineService(prismaStub);

type Case = { name: string; group: ConditionGroup; values: RuleValueMap; expected: boolean };

const cases: Case[] = [
  // ── equals / not_equals (loose equality is intentional) ──
  {
    name: "equals — loose match string vs number",
    group: { logic: "AND", conditions: [{ fieldKey: "n", operator: "equals", value: 5 }] },
    values: { n: "5" },
    expected: true
  },
  {
    name: "equals — no match",
    group: { logic: "AND", conditions: [{ fieldKey: "n", operator: "equals", value: 5 }] },
    values: { n: 6 },
    expected: false
  },
  {
    name: "not_equals — different values",
    group: { logic: "AND", conditions: [{ fieldKey: "n", operator: "not_equals", value: 5 }] },
    values: { n: 6 },
    expected: true
  },
  {
    name: "not_equals — loose equal returns false",
    group: { logic: "AND", conditions: [{ fieldKey: "n", operator: "not_equals", value: 5 }] },
    values: { n: "5" },
    expected: false
  },

  // ── contains / not_contains (string + array) ──
  {
    name: "contains — substring",
    group: { logic: "AND", conditions: [{ fieldKey: "s", operator: "contains", value: "world" }] },
    values: { s: "hello world" },
    expected: true
  },
  {
    name: "contains — array includes",
    group: { logic: "AND", conditions: [{ fieldKey: "arr", operator: "contains", value: "b" }] },
    values: { arr: ["a", "b", "c"] },
    expected: true
  },
  {
    name: "contains — missing substring is false",
    group: { logic: "AND", conditions: [{ fieldKey: "s", operator: "contains", value: "zzz" }] },
    values: { s: "hello world" },
    expected: false
  },
  {
    name: "not_contains — string",
    group: { logic: "AND", conditions: [{ fieldKey: "s", operator: "not_contains", value: "zzz" }] },
    values: { s: "hello" },
    expected: true
  },
  {
    name: "not_contains — array does not include",
    group: { logic: "AND", conditions: [{ fieldKey: "arr", operator: "not_contains", value: "z" }] },
    values: { arr: ["a", "b"] },
    expected: true
  },

  // ── greater_than / less_than (numeric coercion, null-safe) ──
  {
    name: "greater_than — numeric strings coerce",
    group: { logic: "AND", conditions: [{ fieldKey: "n", operator: "greater_than", value: "3" }] },
    values: { n: "10" },
    expected: true
  },
  {
    name: "greater_than — non-numeric actual is false",
    group: { logic: "AND", conditions: [{ fieldKey: "n", operator: "greater_than", value: 1 }] },
    values: { n: "abc" },
    expected: false
  },
  {
    name: "less_than — happy path",
    group: { logic: "AND", conditions: [{ fieldKey: "n", operator: "less_than", value: 100 }] },
    values: { n: 42 },
    expected: true
  },

  // ── between (inclusive bounds) ──
  {
    name: "between — inside inclusive range",
    group: {
      logic: "AND",
      conditions: [{ fieldKey: "n", operator: "between", value: 1, value2: 10 }]
    },
    values: { n: 5 },
    expected: true
  },
  {
    name: "between — outside range",
    group: {
      logic: "AND",
      conditions: [{ fieldKey: "n", operator: "between", value: 1, value2: 10 }]
    },
    values: { n: 50 },
    expected: false
  },
  {
    name: "between — missing value2 (hi=null) is false",
    group: {
      logic: "AND",
      conditions: [{ fieldKey: "n", operator: "between", value: 1 }]
    },
    values: { n: 5 },
    expected: false
  },

  // ── is_empty / is_not_empty ──
  {
    name: "is_empty — undefined value",
    group: { logic: "AND", conditions: [{ fieldKey: "x", operator: "is_empty" }] },
    values: {},
    expected: true
  },
  {
    name: "is_empty — whitespace-only string is empty",
    group: { logic: "AND", conditions: [{ fieldKey: "x", operator: "is_empty" }] },
    values: { x: "   " },
    expected: true
  },
  {
    name: "is_empty — empty array",
    group: { logic: "AND", conditions: [{ fieldKey: "x", operator: "is_empty" }] },
    values: { x: [] },
    expected: true
  },
  {
    name: "is_empty — number 0 is NOT empty",
    group: { logic: "AND", conditions: [{ fieldKey: "x", operator: "is_empty" }] },
    values: { x: 0 },
    expected: false
  },
  {
    name: "is_not_empty — populated string",
    group: { logic: "AND", conditions: [{ fieldKey: "x", operator: "is_not_empty" }] },
    values: { x: "value" },
    expected: true
  },
  {
    name: "is_not_empty — undefined is false",
    group: { logic: "AND", conditions: [{ fieldKey: "x", operator: "is_not_empty" }] },
    values: {},
    expected: false
  },

  // ── is_one_of / is_not_one_of ──
  {
    name: "is_one_of — actual in list",
    group: {
      logic: "AND",
      conditions: [{ fieldKey: "role", operator: "is_one_of", value: ["admin", "editor"] }]
    },
    values: { role: "editor" },
    expected: true
  },
  {
    name: "is_one_of — actual missing",
    group: {
      logic: "AND",
      conditions: [{ fieldKey: "role", operator: "is_one_of", value: ["admin", "editor"] }]
    },
    values: { role: "viewer" },
    expected: false
  },
  {
    name: "is_one_of — non-array value is false",
    group: {
      logic: "AND",
      conditions: [{ fieldKey: "role", operator: "is_one_of", value: "admin" }]
    },
    values: { role: "admin" },
    expected: false
  },
  {
    name: "is_not_one_of — actual not in list",
    group: {
      logic: "AND",
      conditions: [{ fieldKey: "role", operator: "is_not_one_of", value: ["admin", "editor"] }]
    },
    values: { role: "viewer" },
    expected: true
  },

  // ── AND / OR / nested groups ──
  {
    name: "empty AND group is true (no constraint)",
    group: { logic: "AND", conditions: [] },
    values: {},
    expected: true
  },
  {
    name: "empty OR group is true (no constraint)",
    group: { logic: "OR", conditions: [] },
    values: {},
    expected: true
  },
  {
    name: "AND — both true",
    group: {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        { fieldKey: "b", operator: "equals", value: 2 } as Condition
      ]
    },
    values: { a: 1, b: 2 },
    expected: true
  },
  {
    name: "AND — one false",
    group: {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        { fieldKey: "b", operator: "equals", value: 99 } as Condition
      ]
    },
    values: { a: 1, b: 2 },
    expected: false
  },
  {
    name: "OR — first true, second false",
    group: {
      logic: "OR",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        { fieldKey: "b", operator: "equals", value: 99 } as Condition
      ]
    },
    values: { a: 1, b: 2 },
    expected: true
  },
  {
    name: "OR — both false",
    group: {
      logic: "OR",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 99 } as Condition,
        { fieldKey: "b", operator: "equals", value: 99 } as Condition
      ]
    },
    values: { a: 1, b: 2 },
    expected: false
  },
  {
    name: "nested — A AND (B OR C) with C match",
    group: {
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
    },
    values: { a: 1, b: 2, c: 3 },
    expected: true
  },
  {
    name: "nested — A AND (B OR C) with neither inner match",
    group: {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        {
          logic: "OR",
          conditions: [
            { fieldKey: "b", operator: "equals", value: 99 } as Condition,
            { fieldKey: "c", operator: "equals", value: 99 } as Condition
          ]
        } as ConditionGroup
      ]
    },
    values: { a: 1, b: 2, c: 3 },
    expected: false
  },
  {
    name: "deeply nested — (A OR (B AND C)) OR D",
    group: {
      logic: "OR",
      conditions: [
        {
          logic: "OR",
          conditions: [
            { fieldKey: "a", operator: "equals", value: 99 } as Condition,
            {
              logic: "AND",
              conditions: [
                { fieldKey: "b", operator: "equals", value: 2 } as Condition,
                { fieldKey: "c", operator: "equals", value: 3 } as Condition
              ]
            } as ConditionGroup
          ]
        } as ConditionGroup,
        { fieldKey: "d", operator: "equals", value: 99 } as Condition
      ]
    },
    values: { a: 1, b: 2, c: 3, d: 4 },
    expected: true
  }
];

describe("form rules — contract between shared evaluator and RulesEngineService", () => {
  for (const { name, group, values, expected } of cases) {
    it(name, () => {
      const shared = evaluateConditionGroup(group, values);
      const server = svc.evaluateConditionGroup(group, values);
      expect(shared).toBe(expected);
      expect(server).toBe(expected);
      // Belt-and-braces: they must agree even if the fixture expectation
      // were wrong — drift is the real thing we're guarding against.
      expect(server).toBe(shared);
    });
  }
});
