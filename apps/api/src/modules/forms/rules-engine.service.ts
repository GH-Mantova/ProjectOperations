import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  evaluateCondition as sharedEvaluateCondition,
  evaluateConditionGroup as sharedEvaluateConditionGroup
} from "@project-ops/config/forms-rule-definition";
import type {
  Condition,
  ConditionGroup,
  ConditionOperator,
  FieldRule,
  RuleAction,
  RuleActionType
} from "@project-ops/config/forms-rule-definition";

// Re-export the shared types so existing imports from this module still work
// (e.g. the spec file: `import type { Condition, ConditionGroup } from "./rules-engine.service"`).
export type {
  Condition,
  ConditionGroup,
  ConditionOperator,
  FieldRule,
  RuleAction,
  RuleActionType
} from "@project-ops/config/forms-rule-definition";

/** Per-field validation constraint stored in FormField.validations. */
export interface ValidationRule {
  type: "min" | "max" | "min_length" | "max_length" | "regex" | "email" | "phone";
  value?: unknown;
  message?: string;
}

type ValueMap = Record<string, unknown>;

// Local helpers used by validateValues; the condition/group evaluators live in
// @project-ops/config/forms-rule-definition so server and client cannot drift.

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
   * Thin wrapper over the shared pure evaluator in
   * `@project-ops/config/forms-rule-definition` — keeps the public method
   * signature stable while adding the server-only warning for unknown
   * operators (the shared evaluator returns false silently).
   */
  evaluateCondition(condition: Condition, values: ValueMap): boolean {
    const result = sharedEvaluateCondition(condition, values);
    // The shared evaluator returns false for unknown operators without logging;
    // keep the server-side warning so misconfigured templates surface in logs.
    const known: ConditionOperator[] = [
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "greater_than",
      "less_than",
      "between",
      "is_empty",
      "is_not_empty",
      "is_one_of",
      "is_not_one_of"
    ];
    if (!known.includes(condition.operator)) {
      this.logger.warn(`Unknown operator: ${condition.operator as string}`);
    }
    return result;
  }

  /**
   * Recursively evaluate a ConditionGroup.
   *
   * Delegates to the shared pure evaluator; kept as an instance method so
   * existing NestJS callers (FormsEngineService) don't need to change.
   */
  evaluateConditionGroup(group: ConditionGroup, values: ValueMap): boolean {
    return sharedEvaluateConditionGroup(group, values);
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

  // F-2c — submit-time gate splitters. Given the on_submit action list
  // produced by collectOnSubmitActions, partition it into the three
  // categories the engine cares about at submit time:
  //   BLOCK  → hard-stop; return a validation-style 422 with the message list
  //   WARN   → soft-stop; the submitter must acknowledge each warning before
  //            the submit proceeds. Each warning is identified by a stable
  //            hash of its message so client-side ACKs can be matched back.
  //   OTHER  → the existing side-effect actions (create_record,
  //            send_notification, …) — passed through to executeServerActions.

  /** Extract every `block` action from an on_submit action list. */
  collectBlockingActions(actions: RuleAction[]): RuleAction[] {
    return actions.filter((a) => a.type === "block");
  }

  /** Extract every `warn` action from an on_submit action list. */
  collectWarningActions(actions: RuleAction[]): RuleAction[] {
    return actions.filter((a) => a.type === "warn");
  }

  /**
   * Discard the WARN/BLOCK gate actions so the remainder can be passed to
   * the server-side executor (create_record, send_notification, …). Keeps
   * F-2c gate logic separate from the pre-existing side-effect pipeline.
   */
  stripGateActions(actions: RuleAction[]): RuleAction[] {
    return actions.filter((a) => a.type !== "warn" && a.type !== "block");
  }

  /**
   * Stable key for a WARN action — clients acknowledge warnings by echoing
   * this key back on submit. Uses the message text (or a fallback) so a
   * template author can reword copy without invalidating any in-flight
   * drafts. Two warnings with identical copy share one ACK by design.
   */
  warnActionKey(action: RuleAction): string {
    const msg = action.warnMessage ?? "";
    // Simple, deterministic hash — good enough for a form-scoped ACK map.
    let hash = 0;
    for (let i = 0; i < msg.length; i++) {
      hash = (hash << 5) - hash + msg.charCodeAt(i);
      hash |= 0;
    }
    return `warn:${Math.abs(hash).toString(36)}`;
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
          if (field.fieldType === "terms") {
            // Terms are only "filled" when accepted:true. A raw truthy JSON
            // blob without accepted:true (e.g. legacy or malformed client
            // state) is treated as missing.
            const accepted =
              typeof value === "object" && value !== null && (value as { accepted?: unknown }).accepted === true;
            if (!accepted) {
              if (required) errors[field.fieldKey] = `${field.label} must be accepted to continue.`;
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
