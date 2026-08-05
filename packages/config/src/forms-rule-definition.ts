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
  | "remove_repeating_row";

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
