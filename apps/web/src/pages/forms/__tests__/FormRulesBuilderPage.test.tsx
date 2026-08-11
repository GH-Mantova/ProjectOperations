/**
 * F-2c — FormRulesBuilderPage pure-state tests.
 *
 * The web workspace has no jsdom / @testing-library, so these tests
 * cover the exported state helpers directly (same pattern as the
 * ErrorBoundary / performAdminResetPassword suites). Component wiring
 * is exercised manually via the smoke path in the PR body.
 */
import { describe, expect, it } from "vitest";
import type {
  ConditionGroup,
  FieldRule
} from "@project-ops/config/forms-rule-definition";
import {
  addAction,
  addCondition,
  addNestedGroup,
  emptyFieldRule,
  removeAction,
  removeChild,
  toggleLogic,
  updateAction,
  updateCondition
} from "../FormRulesBuilderPage";

function seedGroup(): ConditionGroup {
  return { logic: "AND", conditions: [] };
}

describe("FormRulesBuilderPage — condition group state", () => {
  it("adds a leaf condition row to the root group", () => {
    const before = seedGroup();
    const after = addCondition(before, []);
    expect(after.conditions).toHaveLength(1);
    expect(after.conditions[0]).toMatchObject({
      fieldKey: "",
      operator: "equals",
      value: ""
    });
    // The mutator returns a new tree — the input is not mutated.
    expect(before.conditions).toHaveLength(0);
  });

  it("appends a nested AND/OR group to the root", () => {
    const before = addCondition(seedGroup(), []);
    const after = addNestedGroup(before, [], "OR");
    expect(after.conditions).toHaveLength(2);
    const nested = after.conditions[1] as ConditionGroup;
    expect(nested.logic).toBe("OR");
    expect(nested.conditions).toHaveLength(0);
  });

  it("adds a condition inside a nested group by path", () => {
    let group = addNestedGroup(seedGroup(), [], "AND");
    group = addCondition(group, [0]);
    group = addCondition(group, [0]);
    const nested = group.conditions[0] as ConditionGroup;
    expect(nested.conditions).toHaveLength(2);
  });

  it("removes a child at the given index", () => {
    let group = addCondition(seedGroup(), []);
    group = addCondition(group, []);
    group = removeChild(group, [], 0);
    expect(group.conditions).toHaveLength(1);
  });

  it("toggles AND ↔ OR on the target group", () => {
    const anded = seedGroup();
    const ored = toggleLogic(anded, []);
    expect(ored.logic).toBe("OR");
    expect(toggleLogic(ored, []).logic).toBe("AND");
  });

  it("updates a leaf condition without touching siblings", () => {
    let group = addCondition(seedGroup(), []);
    group = addCondition(group, []);
    const updated = updateCondition(group, [0], {
      fieldKey: "risk_level",
      operator: "greater_than",
      value: 3
    });
    expect(updated.conditions[0]).toMatchObject({
      fieldKey: "risk_level",
      operator: "greater_than",
      value: 3
    });
    // Sibling untouched.
    expect(updated.conditions[1]).toMatchObject({ fieldKey: "" });
  });
});

describe("FormRulesBuilderPage — action list state", () => {
  it("scaffolds an empty on_submit rule", () => {
    const rule = emptyFieldRule("on_submit");
    expect(rule.trigger).toBe("on_submit");
    expect(rule.conditionGroup.logic).toBe("AND");
    expect(rule.actions).toEqual([]);
  });

  it("attaches a WARN action with a default message", () => {
    const rule = addAction(emptyFieldRule("on_submit"), "warn");
    expect(rule.actions).toHaveLength(1);
    expect(rule.actions[0].type).toBe("warn");
    expect(rule.actions[0].warnMessage).toMatch(/double-check/i);
  });

  it("attaches a BLOCK action with a default message", () => {
    const rule = addAction(emptyFieldRule("on_submit"), "block");
    expect(rule.actions).toHaveLength(1);
    expect(rule.actions[0].type).toBe("block");
    expect(rule.actions[0].blockMessage).toMatch(/not allowed/i);
  });

  it("patches an action by index", () => {
    let rule: FieldRule = addAction(emptyFieldRule(), "warn");
    rule = updateAction(rule, 0, { warnMessage: "Confirm high-risk work." });
    expect(rule.actions[0].warnMessage).toBe("Confirm high-risk work.");
  });

  it("removes an action by index", () => {
    let rule = addAction(emptyFieldRule(), "warn");
    rule = addAction(rule, "block");
    rule = removeAction(rule, 0);
    expect(rule.actions).toHaveLength(1);
    expect(rule.actions[0].type).toBe("block");
  });
});
