/**
 * Canonical type definitions for the FormRule / FieldRule JSON contract.
 *
 * These types are the single source of truth for the rule-definition shape
 * used by both the server (RulesEngineService) and the client (FormFillPage).
 * Ported verbatim from rules-engine.service.ts — no behavioural change is
 * intended here; this file only provides the shared export so duplicate
 * declarations can be removed from each consumer.
 *
 * F-2a — FormRule storage expansion + shared rule-definition type.
 */

/** Comparison operators a single Condition may use against a field value. */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "between"
  | "is_empty"
  | "is_not_empty"
  | "is_one_of"
  | "is_not_one_of";

/**
 * A single comparison: the stored value at `fieldKey` is tested with
 * `operator` against `value` (and `value2` for the "between" operator).
 */
export interface Condition {
  id?: string;
  fieldKey: string;
  operator: ConditionOperator;
  value?: unknown;
  value2?: unknown;
}

/** Recursive AND/OR grouping of Conditions and nested ConditionGroups. */
export interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: Array<Condition | ConditionGroup>;
}

/** Action kinds a matched rule may emit (UI effects plus server-side record creation/notifications). */
export type RuleActionType =
  | "show"
  | "hide"
  | "require"
  | "unrequire"
  | "set_value"
  | "clear_value"
  | "lock"
  | "unlock"
  | "jump_to_section"
  | "submit_form"
  | "send_notification"
  | "create_record"
  | "add_repeating_row"
  | "remove_repeating_row"
  // F-2c submit-time gates. `warn` requires the submitter to acknowledge the
  // message before the submission proceeds; `block` hard-stops it and returns
  // a validation error. Both are only meaningful on `on_submit`-triggered
  // FieldRules and are enforced by FormsEngineService.submitForm.
  | "warn"
  | "block";

/**
 * One effect emitted by a matched rule. UI action types are interpreted by
 * the client; `create_record` and `send_notification` are executed
 * server-side by FormsEngineService after submit.
 */
export interface RuleAction {
  type: RuleActionType;
  target?: string;
  value?: unknown;
  recordType?: "safety_incident" | "hazard_observation" | "maintenance_job" | "corrective_action";
  correctiveActionTitle?: string;
  correctiveActionDescription?: string;
  correctiveActionPriority?: "low" | "medium" | "high" | "critical";
  correctiveActionAssignToRole?: string;
  notificationTarget?: string; // role or userId
  notificationMessage?: string;
  // F-2c — human-readable copy shown on `warn` / `block` actions. Both fall
  // back to a generic message when omitted so a rule author who forgets to
  // set one still gets a functioning gate.
  warnMessage?: string;
  blockMessage?: string;
}

/**
 * The rule shape stored on FormField.conditions / .actions: when
 * `conditionGroup` evaluates true for the given trigger, every action in
 * `actions` applies.
 */
export interface FieldRule {
  id?: string;
  trigger: "on_change" | "on_load" | "on_submit";
  conditionGroup: ConditionGroup;
  actions: RuleAction[];
}

// ── Pure evaluation (shared by API RulesEngineService and web FormFillPage) ──
// F-2b — one evaluator. Ported verbatim from RulesEngineService so server and
// client cannot silently drift. See __tests__/formRulesContract in the web app
// for the contract test that pins the two consumers to identical results.

/** Map of fieldKey → current stored value used during evaluation. */
export type RuleValueMap = Record<string, unknown>;

/** Type guard: node is a nested ConditionGroup rather than a leaf Condition. */
export function isConditionGroup(node: Condition | ConditionGroup): node is ConditionGroup {
  return (node as ConditionGroup).conditions !== undefined;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Evaluate one Condition against the current value map.
 *
 * Equality is loose (==) by design; numeric operators coerce both sides and
 * return false when either side is not a finite number. Unknown operators
 * return false silently — callers may log if they need diagnostics.
 */
export function evaluateCondition(condition: Condition, values: RuleValueMap): boolean {
  const actual = values[condition.fieldKey];
  const expected = condition.value;
  switch (condition.operator) {
    case "equals":
      // Loose equality so "5" == 5 holds — submission values come from
      // text inputs and still need to match number rules.
      return actual == expected;
    case "not_equals":
      return actual != expected;
    case "contains":
      if (Array.isArray(actual)) return actual.includes(expected as never);
      return String(actual ?? "").includes(String(expected ?? ""));
    case "not_contains":
      if (Array.isArray(actual)) return !actual.includes(expected as never);
      return !String(actual ?? "").includes(String(expected ?? ""));
    case "greater_than": {
      const a = toNumber(actual);
      const b = toNumber(expected);
      return a !== null && b !== null && a > b;
    }
    case "less_than": {
      const a = toNumber(actual);
      const b = toNumber(expected);
      return a !== null && b !== null && a < b;
    }
    case "between": {
      const a = toNumber(actual);
      const lo = toNumber(expected);
      const hi = toNumber(condition.value2);
      return a !== null && lo !== null && hi !== null && a >= lo && a <= hi;
    }
    case "is_empty":
      return isEmptyValue(actual);
    case "is_not_empty":
      return !isEmptyValue(actual);
    case "is_one_of":
      return Array.isArray(expected) && expected.includes(actual as never);
    case "is_not_one_of":
      return Array.isArray(expected) && !expected.includes(actual as never);
    default:
      return false;
  }
}

/**
 * Recursively evaluate a ConditionGroup.
 *
 * AND requires every child to pass, OR requires at least one. Children are
 * evaluated eagerly (no short-circuit). An empty/missing group means "no
 * constraint" and returns true.
 */
export function evaluateConditionGroup(group: ConditionGroup, values: RuleValueMap): boolean {
  if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) {
    // Empty group ≡ no constraint ≡ true. Matches the natural reading of
    // "show this field if [no conditions]" — the field stays shown.
    return true;
  }
  const evals = group.conditions.map((node) =>
    isConditionGroup(node) ? evaluateConditionGroup(node, values) : evaluateCondition(node, values)
  );
  return group.logic === "OR" ? evals.some(Boolean) : evals.every(Boolean);
}
