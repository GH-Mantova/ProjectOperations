import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// ── Types ────────────────────────────────────────────────────────────────
// These mirror the JSON shapes stored in FormField.conditions / .actions /
// .validations, FormSection.conditions, and FormTemplate.settings. The engine
// is shape-agnostic at evaluation time; consumers can layer DTO-validation on
// top if they want stricter input checking.

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
  recordType?: "safety_incident" | "hazard_observation" | "maintenance_job";
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

/** Per-field validation constraint stored in FormField.validations. */
export interface ValidationRule {
  type: "min" | "max" | "min_length" | "max_length" | "regex" | "email" | "phone";
  value?: unknown;
  message?: string;
}

type ValueMap = Record<string, unknown>;

function isGroup(node: Condition | ConditionGroup): node is ConditionGroup {
  return (node as ConditionGroup).conditions !== undefined;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Stateless evaluator for the JSON form-rule contract.
 *
 * Contract: rules are FieldRule objects (trigger + ConditionGroup +
 * RuleAction[]) stored as JSON on fields/sections. Condition groups are
 * all-pass for AND and any-pass for OR (evaluated eagerly, no
 * short-circuit); an empty/missing group evaluates to true. Comparisons
 * are deliberately loose ("5" == 5) because values originate from text
 * inputs; unknown operators log a warning and evaluate false. The only
 * DB access is checkComplianceGates (worker qualification lookups).
 */
@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Evaluation ─────────────────────────────────────────────────────────

  /**
   * Evaluate one Condition against the current value map.
   *
   * Equality is loose (==) by design; numeric operators coerce both sides
   * and return false when either side is not a finite number.
   *
   * @param condition - the comparison to run
   * @param values - fieldKey to current value map
   * @returns true when the condition holds; false for unknown operators (with a warning log)
   */
  evaluateCondition(condition: Condition, values: ValueMap): boolean {
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
        return isEmpty(actual);
      case "is_not_empty":
        return !isEmpty(actual);
      case "is_one_of":
        return Array.isArray(expected) && expected.includes(actual as never);
      case "is_not_one_of":
        return Array.isArray(expected) && !expected.includes(actual as never);
      default:
        this.logger.warn(`Unknown operator: ${condition.operator as string}`);
        return false;
    }
  }

  /**
   * Recursively evaluate a ConditionGroup.
   *
   * AND requires every child to pass, OR requires at least one. All
   * children are evaluated eagerly (no short-circuit). An empty or
   * missing group means "no constraint" and returns true.
   *
   * @returns the boolean result of the group
   */
  evaluateConditionGroup(group: ConditionGroup, values: ValueMap): boolean {
    if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) {
      // Empty group ≡ no constraint ≡ true. This matches the natural reading
      // of "show this field if [no conditions]" — the field stays shown.
      return true;
    }
    const evals = group.conditions.map((node) =>
      isGroup(node) ? this.evaluateConditionGroup(node, values) : this.evaluateCondition(node, values)
    );
    return group.logic === "OR" ? evals.some(Boolean) : evals.every(Boolean);
  }

  /**
   * Decide whether a field is visible given its rules and current values.
   *
   * Rules are scanned in order; the first matched rule containing a
   * "hide" action hides the field, the first containing "show" keeps it
   * visible (short-circuit on first show/hide hit). Default is visible.
   *
   * @param fieldConditions - FieldRule[] from FormField.conditions; undefined/empty means always visible
   * @returns true when the field should be rendered
   */
  evaluateFieldVisibility(
    fieldConditions: FieldRule[] | undefined,
    values: ValueMap
  ): boolean {
    if (!Array.isArray(fieldConditions) || fieldConditions.length === 0) return true;
    // A visibility rule is one whose actions include show/hide. If any matching
    // rule says "hide", the field is hidden; "show" rules pass through. Default
    // is visible.
    for (const rule of fieldConditions) {
      const matched = this.evaluateConditionGroup(rule.conditionGroup, values);
      if (!matched) continue;
      for (const action of rule.actions) {
        if (action.type === "hide") return false;
        if (action.type === "show") return true;
      }
    }
    return true;
  }

  /**
   * Decide whether a field is required given its base flag and rules.
   *
   * Unlike visibility, ALL matched rules are applied in order — a later
   * "unrequire" overrides an earlier "require" and vice versa (no
   * short-circuit). Starts from the field's static isRequired flag.
   *
   * @param isRequiredBase - the field's static isRequired flag
   * @param fieldConditions - FieldRule[] from FormField.conditions
   * @returns the final required state
   */
  evaluateFieldRequired(
    isRequiredBase: boolean,
    fieldConditions: FieldRule[] | undefined,
    values: ValueMap
  ): boolean {
    if (!Array.isArray(fieldConditions) || fieldConditions.length === 0) return isRequiredBase;
    let required = isRequiredBase;
    for (const rule of fieldConditions) {
      if (!this.evaluateConditionGroup(rule.conditionGroup, values)) continue;
      for (const action of rule.actions) {
        if (action.type === "require") required = true;
        else if (action.type === "unrequire") required = false;
      }
    }
    return required;
  }

  // ── Form-wide on_submit collection ─────────────────────────────────────

  /**
   * Gather every action from on_submit-triggered rules whose condition
   * group matches the submitted values, across all sections/fields.
   *
   * @param template - template version with sections/fields (field.actions holds FieldRule[])
   * @returns a flat RuleAction[] in document order; empty when nothing matches
   */
  collectOnSubmitActions(
    template: { sections?: Array<{ fields?: Array<{ actions?: unknown }> }> },
    values: ValueMap
  ): RuleAction[] {
    const actions: RuleAction[] = [];
    const sections = template.sections ?? [];
    for (const section of sections) {
      for (const field of section.fields ?? []) {
        const rules = (field.actions ?? []) as FieldRule[];
        if (!Array.isArray(rules)) continue;
        for (const rule of rules) {
          if (rule.trigger !== "on_submit") continue;
          if (!this.evaluateConditionGroup(rule.conditionGroup, values)) continue;
          for (const action of rule.actions ?? []) {
            actions.push(action);
          }
        }
      }
    }
    return actions;
  }

  // ── Validation ─────────────────────────────────────────────────────────

  /**
   * Validate submitted values against required state, field types and
   * per-field ValidationRules.
   *
   * Hidden fields are skipped entirely. At most one error is reported per
   * field (first failure wins). Invalid regex patterns in validations are
   * silently ignored.
   *
   * @returns `{ valid, errors }` where errors maps fieldKey to a human-readable message
   */
  validateValues(
    template: {
      sections?: Array<{
        fields?: Array<{
          fieldKey: string;
          label: string;
          isRequired: boolean;
          conditions?: unknown;
          validations?: unknown;
          fieldType: string;
        }>;
      }>;
    },
    values: ValueMap
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    for (const section of template.sections ?? []) {
      for (const field of section.fields ?? []) {
        const visible = this.evaluateFieldVisibility(
          (field.conditions as FieldRule[]) ?? [],
          values
        );
        if (!visible) continue;
        const required = this.evaluateFieldRequired(
          field.isRequired,
          (field.conditions as FieldRule[]) ?? [],
          values
        );
        const value = values[field.fieldKey];
        if (required && isEmpty(value)) {
          errors[field.fieldKey] = `${field.label} is required.`;
          continue;
        }
        // Type-specific validation
        if (!isEmpty(value)) {
          if (field.fieldType === "number" || field.fieldType === "currency" || field.fieldType === "percentage") {
            if (toNumber(value) === null) {
              errors[field.fieldKey] = `${field.label} must be a number.`;
              continue;
            }
          }
          if (field.fieldType === "email") {
            if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              errors[field.fieldKey] = `${field.label} must be a valid email.`;
              continue;
            }
          }
        }
        // Custom validations
        const validations = (field.validations as ValidationRule[]) ?? [];
        for (const v of validations) {
          if (isEmpty(value)) break;
          if (v.type === "min" && toNumber(value) !== null && toNumber(value)! < toNumber(v.value)!) {
            errors[field.fieldKey] = v.message ?? `${field.label} is below the minimum.`;
            break;
          }
          if (v.type === "max" && toNumber(value) !== null && toNumber(value)! > toNumber(v.value)!) {
            errors[field.fieldKey] = v.message ?? `${field.label} is above the maximum.`;
            break;
          }
          if (v.type === "min_length" && typeof value === "string" && value.length < (v.value as number)) {
            errors[field.fieldKey] = v.message ?? `${field.label} is too short.`;
            break;
          }
          if (v.type === "max_length" && typeof value === "string" && value.length > (v.value as number)) {
            errors[field.fieldKey] = v.message ?? `${field.label} is too long.`;
            break;
          }
          if (v.type === "regex" && typeof value === "string" && typeof v.value === "string") {
            try {
              if (!new RegExp(v.value).test(value)) {
                errors[field.fieldKey] = v.message ?? `${field.label} format is invalid.`;
                break;
              }
            } catch {
              // bad regex — ignore
            }
          }
        }
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  // ── Compliance gates ───────────────────────────────────────────────────
  // IS-specific business rules that block submission until satisfied. The
  // most common one is "asbestos work plan can only be submitted by someone
  // holding a current asbestos_a or asbestos_b worker qualification".

  /**
   * Run Initial Services business gates that can block a submission.
   *
   * Currently: templates in the "asbestos" category require the submitter
   * to hold a current (unexpired) asbestos_a or asbestos_b qualification.
   * Anonymous submitters (null submittedById) pass unconditionally.
   *
   * @param template - template category plus optional settings payload
   * @param submittedById - user id of the submitter, or null
   * @returns `{ passed, failures }` — failures lists human-readable gate messages
   */
  async checkComplianceGates(
    template: { category: string; settings?: unknown },
    submittedById: string | null
  ): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];
    if (!submittedById) {
      // Anonymous submitter — gate behaviour deferred to caller.
      return { passed: true, failures };
    }

    if (template.category === "asbestos") {
      // Look up worker profile for this user, then their qualifications.
      const worker = await this.prisma.workerProfile.findUnique({
        where: { internalUserId: submittedById },
        include: {
          qualifications: {
            where: {
              qualType: { in: ["asbestos_a", "asbestos_b"] }
            }
          }
        }
      });
      const validQuals = (worker?.qualifications ?? []).filter((q) => {
        if (!q.expiryDate) return true;
        return new Date(q.expiryDate) > new Date();
      });
      if (validQuals.length === 0) {
        failures.push(
          "Asbestos work requires a current Class A or Class B asbestos qualification on the submitter's worker profile."
        );
      }
    }

    // Settings can carry additional template-defined gates — extend here as
    // the catalogue grows (SWMS-on-file, prior-permit-approved, etc.).

    return { passed: failures.length === 0, failures };
  }
}
