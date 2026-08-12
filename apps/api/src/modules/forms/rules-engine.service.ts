import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import { EmailService } from "../email/email.service";
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
  RuleActionType,
  SectionEntriesMap
} from "@project-ops/config/forms-rule-definition";
import type { SystemContextSnapshot } from "./system-context-resolver.service";
import type { ComplianceService } from "../compliance/compliance.service";
import type { PushExecutorService } from "./push-executor.service";

// Re-export the shared types so existing imports from this module still work
// (e.g. the spec file: `import type { Condition, ConditionGroup } from "./rules-engine.service"`).
export type {
  Condition,
  ConditionGroup,
  ConditionOperator,
  FieldRule,
  RuleAction,
  RuleActionType,
  SectionEntriesMap
} from "@project-ops/config/forms-rule-definition";

/** Per-field validation constraint stored in FormField.validations. */
export interface ValidationRule {
  type: "min" | "max" | "min_length" | "max_length" | "regex" | "email" | "phone";
  value?: unknown;
  message?: string;
}

type ValueMap = Record<string, unknown>;

// ── System-context condition / action extensions (server-only) ─────────────
//
// The shared @project-ops/config/forms-rule-definition package defines the
// core condition operators and action types used by both server and client.
// The following types extend the contract for server-only system-context
// evaluation — they are evaluated against the SystemContextSnapshot resolved
// at submit time and are never sent to the client for local evaluation.

/**
 * System-context condition types evaluated server-side from the snapshot.
 * These are stored in FormRule.definition alongside the standard field
 * conditions and are only evaluated by the server.
 */
export type SystemConditionType =
  | "asset_reading_km_above"
  | "asset_reading_hours_above"
  | "competency_expiring_within_days"
  | "competency_expired"
  | "site_attribute_equals"
  | "weather_temperature_above"
  | "weather_temperature_below"
  | "timesheet_hours_7d_above"
  | "role_equals";

/** A system-context condition node stored as part of a FormRule definition. */
export interface SystemCondition {
  systemType: SystemConditionType;
  /** asset id for asset reading conditions. */
  assetId?: string;
  /** competency id or code for competency conditions. */
  competencyId?: string;
  /** site attribute key for site_attribute_equals. */
  attributeKey?: string;
  /** comparison value (numeric threshold, string value, etc.). */
  value?: unknown;
}

/**
 * Server-only action types extending the shared RuleActionType.
 * These are dispatched by executeSystemActions in FormsEngineService.
 */
export type ServerActionType =
  | "alert"           // in-app + email notification with answer tokens
  | "approval_chain_modify"  // mutate FormApproval chain
  | "push"            // passthrough into PushExecutorService
  | "deadline_task";  // WorkSafe-clock corrective action via ComplianceService

/**
 * Extended server-only action for system-context rules.
 * Stored in FormRule.definition as a JSON blob.
 */
export interface SystemAction {
  type: ServerActionType;
  // --- alert ---
  /** Recipients for alert: role names or user ids. */
  alertTargets?: string[];
  /** Message template; {fieldKey} tokens are replaced with the submitted value. */
  alertMessage?: string;
  alertSubject?: string;
  // --- approval_chain_modify ---
  /** Step to insert/remove/reassign (by stepNumber). */
  approvalStep?: {
    op: "insert" | "remove" | "reassign";
    stepNumber: number;
    assignToUserId?: string;
    assignToRole?: string;
    dueHours?: number;
  };
  // --- push ---
  /** Binding id to execute (delegates to PushExecutorService). */
  pushBindingId?: string;
  // --- deadline_task ---
  deadlineTaskTitle?: string;
  deadlineTaskDescription?: string;
  deadlineHours?: number;
  deadlineAssignToRole?: string;
}

/** Dependencies injected into RulesEngineService by FormsEngineService for system actions. */
export interface SystemActionDeps {
  notifications: NotificationsService;
  email: EmailService;
  compliance: ComplianceService;
  pushExecutor: PushExecutorService;
}

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  // ── Evaluation ─────────────────────────────────────────────────────────

  /**
   * Evaluate one Condition against the current value map.
   *
   * Thin wrapper over the shared pure evaluator in
   * `@project-ops/config/forms-rule-definition` — keeps the public method
   * signature stable while adding the server-only warning for unknown
   * operators (the shared evaluator returns false silently).
   */
  evaluateCondition(
    condition: Condition,
    values: ValueMap,
    sectionEntries?: SectionEntriesMap
  ): boolean {
    const result = sharedEvaluateCondition(condition, values, sectionEntries);
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
      "is_not_one_of",
      "has_any_entry_where",
      "entry_count",
      "column_total"
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
  evaluateConditionGroup(
    group: ConditionGroup,
    values: ValueMap,
    sectionEntries?: SectionEntriesMap
  ): boolean {
    return sharedEvaluateConditionGroup(group, values, sectionEntries);
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
    values: ValueMap,
    sectionEntries?: SectionEntriesMap
  ): boolean {
    if (!Array.isArray(fieldConditions) || fieldConditions.length === 0) return true;
    // A visibility rule is one whose actions include show/hide. If any matching
    // rule says "hide", the field is hidden; "show" rules pass through. Default
    // is visible.
    for (const rule of fieldConditions) {
      const matched = this.evaluateConditionGroup(rule.conditionGroup, values, sectionEntries);
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
    values: ValueMap,
    sectionEntries?: SectionEntriesMap
  ): boolean {
    if (!Array.isArray(fieldConditions) || fieldConditions.length === 0) return isRequiredBase;
    let required = isRequiredBase;
    for (const rule of fieldConditions) {
      if (!this.evaluateConditionGroup(rule.conditionGroup, values, sectionEntries)) continue;
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
    values: ValueMap,
    sectionEntries?: SectionEntriesMap
  ): RuleAction[] {
    const actions: RuleAction[] = [];
    const sections = template.sections ?? [];
    for (const section of sections) {
      for (const field of section.fields ?? []) {
        const rules = (field.actions ?? []) as FieldRule[];
        if (!Array.isArray(rules)) continue;
        for (const rule of rules) {
          if (rule.trigger !== "on_submit") continue;
          if (!this.evaluateConditionGroup(rule.conditionGroup, values, sectionEntries)) continue;
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
        isRepeating?: boolean;
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
    values: ValueMap,
    sectionEntries?: SectionEntriesMap
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    for (const section of template.sections ?? []) {
      // F-3: fields inside a repeating section are validated per-entry, not
      // against the top-level `values` map. Per-entry validation is deferred
      // to a later slice — this one just ships the storage + UI plumbing.
      if (section.isRepeating) continue;
      for (const field of section.fields ?? []) {
        const visible = this.evaluateFieldVisibility(
          (field.conditions as FieldRule[]) ?? [],
          values,
          sectionEntries
        );
        if (!visible) continue;
        const required = this.evaluateFieldRequired(
          field.isRequired,
          (field.conditions as FieldRule[]) ?? [],
          values,
          sectionEntries
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

  // ── System-context condition evaluation ────────────────────────────────

  /**
   * Evaluate a SystemCondition against a resolved SystemContextSnapshot.
   *
   * Called server-side at submit time (re-resolved fresh — never trusts the
   * client snapshot for BLOCK decisions). Returns false for unknown condition
   * types so misconfigured rules fail safe.
   */
  evaluateSystemCondition(
    cond: SystemCondition,
    snapshot: SystemContextSnapshot
  ): boolean {
    switch (cond.systemType) {
      case "asset_reading_km_above": {
        const threshold = typeof cond.value === "number" ? cond.value : Number(cond.value);
        if (!Number.isFinite(threshold)) return false;
        const asset = cond.assetId
          ? snapshot.assetReadings.find((a) => a.assetId === cond.assetId)
          : null;
        if (!asset || asset.currentKm == null) return false;
        return asset.currentKm > threshold;
      }
      case "asset_reading_hours_above": {
        const threshold = typeof cond.value === "number" ? cond.value : Number(cond.value);
        if (!Number.isFinite(threshold)) return false;
        const asset = cond.assetId
          ? snapshot.assetReadings.find((a) => a.assetId === cond.assetId)
          : null;
        if (!asset || asset.currentHours == null) return false;
        return asset.currentHours > threshold;
      }
      case "competency_expiring_within_days": {
        const days = typeof cond.value === "number" ? cond.value : Number(cond.value);
        if (!Number.isFinite(days)) return false;
        const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        return snapshot.competencies.some((c) => {
          if (cond.competencyId && c.competencyId !== cond.competencyId) return false;
          if (!c.expiresAt) return false;
          return new Date(c.expiresAt) <= cutoff;
        });
      }
      case "competency_expired": {
        return snapshot.competencies.some((c) => {
          if (cond.competencyId && c.competencyId !== cond.competencyId) return false;
          return c.isExpired;
        });
      }
      case "site_attribute_equals": {
        if (!cond.attributeKey || !snapshot.site) return false;
        const siteAttr = (snapshot.site as Record<string, unknown>)[cond.attributeKey];
        return String(siteAttr ?? "") === String(cond.value ?? "");
      }
      case "weather_temperature_above": {
        if (!snapshot.weather || snapshot.weather.unavailable) return false;
        const temp = snapshot.weather.current?.temperatureC;
        if (temp == null) return false;
        const threshold = typeof cond.value === "number" ? cond.value : Number(cond.value);
        return Number.isFinite(threshold) && temp > threshold;
      }
      case "weather_temperature_below": {
        if (!snapshot.weather || snapshot.weather.unavailable) return false;
        const temp = snapshot.weather.current?.temperatureC;
        if (temp == null) return false;
        const threshold = typeof cond.value === "number" ? cond.value : Number(cond.value);
        return Number.isFinite(threshold) && temp < threshold;
      }
      case "timesheet_hours_7d_above": {
        if (snapshot.timesheetHours7d == null) return false;
        const threshold = typeof cond.value === "number" ? cond.value : Number(cond.value);
        return Number.isFinite(threshold) && snapshot.timesheetHours7d > threshold;
      }
      case "role_equals": {
        if (!snapshot.fillerRole) return false;
        return snapshot.fillerRole === String(cond.value ?? "");
      }
      default:
        this.logger.warn(`Unknown system condition type: ${(cond as SystemCondition).systemType}`);
        return false;
    }
  }

  // ── System action executors ────────────────────────────────────────────

  /**
   * Execute a list of server-only system actions produced by matching
   * FormRule.definition nodes.
   *
   * Called by FormsEngineService after submit/approval. Failures are logged
   * and swallowed — the submission save is never rolled back.
   *
   * @param actions - system action nodes from FormRule.definition
   * @param submission - the committed submission (id + context + submittedById)
   * @param values - flat field-value map for token substitution
   * @param snapshot - freshly re-resolved server snapshot (BLOCK-safe)
   * @param deps - services injected by FormsEngineService (avoids circular DI)
   */
  async executeSystemActions(
    actions: SystemAction[],
    submission: {
      id: string;
      submittedById: string | null;
      context: unknown;
    },
    values: ValueMap,
    snapshot: SystemContextSnapshot,
    deps: SystemActionDeps
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "alert":
            await this.executeAlertAction(action, submission, values, deps);
            break;
          case "approval_chain_modify":
            await this.executeApprovalChainModify(action, submission.id);
            break;
          case "push":
            await this.executePushAction(action, submission.id, deps);
            break;
          case "deadline_task":
            await this.executeDeadlineTask(action, submission, snapshot, deps);
            break;
          default:
            this.logger.warn(
              `Unknown system action type: ${(action as SystemAction).type}`
            );
        }
      } catch (err) {
        this.logger.warn(
          `System action ${action.type} failed for submission ${submission.id}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  private resolveTokens(template: string, values: ValueMap): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const val = values[key];
      return val != null ? String(val) : "";
    });
  }

  private async executeAlertAction(
    action: SystemAction,
    submission: { id: string; submittedById: string | null },
    values: ValueMap,
    deps: SystemActionDeps
  ): Promise<void> {
    const message = action.alertMessage
      ? this.resolveTokens(action.alertMessage, values)
      : "A form rule alert was triggered.";
    const subject = action.alertSubject
      ? this.resolveTokens(action.alertSubject, values)
      : "Form alert";

    const targets = action.alertTargets ?? [];
    if (targets.length === 0) {
      this.logger.debug(`alert action on ${submission.id} has no targets — skipped`);
      return;
    }

    const recipientIds: string[] = [];
    for (const target of targets) {
      if (target === "supervisor" || target === "project_manager" || target === "safety_admin") {
        // Resolve from submission context
        const ctx = (submission as { id: string; submittedById: string | null; context?: unknown })
          .context as Record<string, string | undefined> | undefined ?? {};
        if (target === "supervisor" && ctx.supervisorId) recipientIds.push(ctx.supervisorId);
        else if (target === "project_manager" && ctx.projectManagerId)
          recipientIds.push(ctx.projectManagerId);
        else if (target === "safety_admin") {
          const admins = await this.prisma.user.findMany({
            where: {
              userRoles: {
                some: {
                  role: { rolePermissions: { some: { permission: { code: "safety.admin" } } } }
                }
              }
            },
            select: { id: true }
          });
          recipientIds.push(...admins.map((u) => u.id));
        }
      } else {
        // Treat as a literal user id
        const user = await this.prisma.user.findUnique({
          where: { id: target },
          select: { id: true }
        });
        if (user) recipientIds.push(user.id);
      }
    }

    const unique = Array.from(new Set(recipientIds));
    for (const userId of unique) {
      void deps.notifications
        .create(
          {
            userId,
            title: subject,
            body: message,
            severity: "warning",
            linkUrl: `/forms/submissions/${submission.id}`
          },
          submission.submittedById ?? undefined
        )
        .catch(() => undefined);
    }

    // Email alert (fire-and-forget — email failures must never block a submission)
    void deps.email
      .sendNotificationEmail({
        trigger: "forms.rule.alert",
        subject,
        html: `<p>${message}</p><p><a href="/forms/submissions/${submission.id}">View submission</a></p>`,
        text: `${message}\n\nView at /forms/submissions/${submission.id}`
      })
      .catch(() => undefined);
  }

  private async executeApprovalChainModify(
    action: SystemAction,
    submissionId: string
  ): Promise<void> {
    const step = action.approvalStep;
    if (!step) {
      this.logger.debug(
        `approval_chain_modify on ${submissionId} has no step config — skipped`
      );
      return;
    }
    if (step.op === "insert") {
      const existing = await this.prisma.formApproval.findFirst({
        where: { submissionId, stepNumber: step.stepNumber }
      });
      if (!existing) {
        await this.prisma.formApproval.create({
          data: {
            submissionId,
            stepNumber: step.stepNumber,
            assignedToId: step.assignToUserId ?? null,
            assignedToRole: step.assignToRole ?? null,
            status: "pending",
            dueAt: step.dueHours
              ? new Date(Date.now() + step.dueHours * 60 * 60 * 1000)
              : null
          }
        });
      }
    } else if (step.op === "remove") {
      await this.prisma.formApproval.deleteMany({
        where: { submissionId, stepNumber: step.stepNumber, status: "pending" }
      });
    } else if (step.op === "reassign") {
      await this.prisma.formApproval.updateMany({
        where: { submissionId, stepNumber: step.stepNumber, status: "pending" },
        data: {
          assignedToId: step.assignToUserId ?? null,
          assignedToRole: step.assignToRole ?? null
        }
      });
    }
  }

  private async executePushAction(
    action: SystemAction,
    submissionId: string,
    deps: SystemActionDeps
  ): Promise<void> {
    if (!action.pushBindingId) {
      this.logger.debug(`push action on ${submissionId} has no pushBindingId — skipped`);
      return;
    }
    // Delegate to the existing PushExecutorService; use "submit" as the applyOn
    // stage so it picks up the binding if enabled. The executor is idempotent —
    // a FormTriggeredRecord dedup guard prevents double-writes.
    await deps.pushExecutor.executePushes(submissionId, "submit");
  }

  private async executeDeadlineTask(
    action: SystemAction,
    submission: { id: string; submittedById: string | null; context: unknown },
    snapshot: SystemContextSnapshot,
    deps: SystemActionDeps
  ): Promise<void> {
    const ctx = (submission.context ?? {}) as Record<string, string | undefined>;
    const title = action.deadlineTaskTitle ?? "WorkSafe deadline task";
    const deadlineHours = action.deadlineHours ?? 24;

    // Resolve assignee: prefer explicit role mapping from context
    let assignedToId: string | null = null;
    if (action.deadlineAssignToRole === "supervisor" && ctx.supervisorId) {
      assignedToId = ctx.supervisorId;
    } else if (action.deadlineAssignToRole === "project_manager" && ctx.projectManagerId) {
      assignedToId = ctx.projectManagerId;
    }

    await deps.compliance.createDeadlineTask({
      submissionId: submission.id,
      title,
      description: action.deadlineTaskDescription ?? null,
      deadlineHours,
      assignedToId
    });

    // Suppress unused snapshot lint — kept for future condition-driven assignment
    void snapshot;
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
