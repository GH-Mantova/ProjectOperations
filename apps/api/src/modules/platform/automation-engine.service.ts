import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AUTOMATION_ACTION_TYPES } from "./dto/automation.dto";

// A single dispatched event. `payload` is the object the rule matches against
// (shape depends on the entity — the engine only reads keys named in the rule's
// conditions, so extra fields are ignored).
export type AutomationEvent = {
  entity: string;
  event: string;
  entityId?: string | null;
  payload: Record<string, unknown>;
  actorId?: string | null;
  // Marker set by engine-generated side effects (e.g. the `notify` handler)
  // so a rule cannot cascade into itself. Domain services never set this.
  fromAutomation?: boolean;
};

type StoredAction = { type: string; config: Record<string, unknown> };

type ActionResult = { detail?: Record<string, unknown> };
type ActionHandler = (action: StoredAction, event: AutomationEvent) => Promise<ActionResult>;

/**
 * The automation engine (MVP slice 1).
 *
 * Domain services publish events via `dispatch(event)`. The engine loads
 * enabled rules matching `(entity, event)`, tests each against the payload,
 * runs the WHITELISTED actions in ACTION_HANDLERS, and records a run row.
 *
 * The whitelist is the safety guarantee — a rule config can never invoke
 * anything not registered here, so operator-configured rules cannot exec
 * arbitrary code, hit webhooks, or fan out beyond declared side effects.
 */
@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  private readonly actionHandlers: Record<string, ActionHandler> = {
    notify: this.handleNotify.bind(this),
    "create-note": this.handleCreateNote.bind(this),
    "set-field": this.handleSetField.bind(this)
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Fire an event through the engine. Never throws — a rule failure is
   * captured in the run log so the calling domain service is unaffected.
   */
  async dispatch(event: AutomationEvent): Promise<void> {
    if (event.fromAutomation) return;

    const rules = await this.prisma.automationRule.findMany({
      where: {
        enabled: true,
        triggerEntity: event.entity,
        triggerEvent: event.event
      }
    });

    if (rules.length === 0) return;

    for (const rule of rules) {
      const matched = this.evaluateConditions(rule.conditions, event.payload);
      if (!matched) {
        await this.recordRun(rule.id, event, false, true, null, []);
        continue;
      }

      const actions = this.parseActions(rule.actions);
      const ran: Array<{ type: string; detail?: Record<string, unknown> }> = [];
      let firstError: string | null = null;

      for (const action of actions) {
        const handler = this.actionHandlers[action.type];
        if (!handler) {
          firstError = `Unknown action type "${action.type}"`;
          break;
        }
        try {
          const result = await handler(action, { ...event, fromAutomation: true });
          ran.push({ type: action.type, detail: result.detail });
        } catch (err) {
          firstError = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Rule ${rule.id} action "${action.type}" failed: ${firstError}`
          );
          break;
        }
      }

      await this.recordRun(rule.id, event, true, firstError === null, firstError, ran);

      if (firstError === null) {
        await this.auditService.write({
          actorId: event.actorId ?? null,
          action: "automation.rule.fired",
          entityType: "AutomationRule",
          entityId: rule.id,
          metadata: {
            entity: event.entity,
            event: event.event,
            entityId: event.entityId ?? null,
            actionsRun: ran.map((r) => r.type)
          }
        });
      }
    }
  }

  // ── Condition evaluation ──────────────────────────────────────────────

  private evaluateConditions(raw: Prisma.JsonValue | null, payload: Record<string, unknown>) {
    if (raw === null || raw === undefined) return true;
    if (!Array.isArray(raw)) return true;
    if (raw.length === 0) return true;

    for (const entry of raw) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const record = entry as Record<string, unknown>;
      const field = typeof record.field === "string" ? record.field : null;
      const op = typeof record.op === "string" ? record.op : "eq";
      const expected = record.value;
      if (!field) return false;
      const actual = payload[field];
      if (!this.matchOne(op, actual, expected)) return false;
    }
    return true;
  }

  private matchOne(op: string, actual: unknown, expected: unknown) {
    switch (op) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "in":
        return Array.isArray(expected) && expected.includes(actual as never);
      case "contains":
        return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
      case "exists":
        return actual !== undefined && actual !== null;
      default:
        return false;
    }
  }

  // ── Action handlers (whitelisted) ─────────────────────────────────────

  private async handleNotify(action: StoredAction, event: AutomationEvent) {
    const cfg = action.config ?? {};
    const userId = typeof cfg.userId === "string" ? cfg.userId : null;
    const title = typeof cfg.title === "string" ? cfg.title : null;
    const body = typeof cfg.body === "string" ? cfg.body : null;
    const severity = typeof cfg.severity === "string" ? cfg.severity : "LOW";
    if (!userId || !title || !body) {
      throw new Error("notify action requires userId, title, and body");
    }
    // Write directly through Prisma (bypassing NotificationsService) so the
    // dispatch call site in NotificationsService.create cannot cascade back.
    await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        severity,
        linkUrl: typeof cfg.linkUrl === "string" ? cfg.linkUrl : null,
        metadata: {
          kind: "AUTOMATION",
          sourceEntity: event.entity,
          sourceEntityId: event.entityId ?? null,
          sourceEvent: event.event
        } satisfies Prisma.InputJsonValue
      }
    });
    return { detail: { userId } };
  }

  private async handleCreateNote(action: StoredAction, event: AutomationEvent) {
    const cfg = action.config ?? {};
    const userId = typeof cfg.userId === "string" ? cfg.userId : null;
    const body = typeof cfg.body === "string" ? cfg.body : null;
    if (!userId || !body) {
      throw new Error("create-note action requires userId and body");
    }
    await this.prisma.notification.create({
      data: {
        userId,
        title: typeof cfg.title === "string" ? cfg.title : "Automation note",
        body,
        severity: "LOW",
        metadata: {
          kind: "AUTOMATION_NOTE",
          sourceEntity: event.entity,
          sourceEntityId: event.entityId ?? null,
          sourceEvent: event.event
        } satisfies Prisma.InputJsonValue
      }
    });
    return {};
  }

  private async handleSetField(_action: StoredAction, _event: AutomationEvent): Promise<ActionResult> {
    // Placeholder — set-field needs per-entity awareness (which tables can be
    // written, which fields are safe). Kept as a validation-time-accepted type
    // so rules can be drafted, but rejected at run time until slice 2 wires
    // per-entity setters.
    throw new Error("set-field is accepted by the schema but not yet executable in slice 1");
  }

  // ── Persistence ───────────────────────────────────────────────────────

  private parseActions(raw: Prisma.JsonValue): StoredAction[] {
    if (!Array.isArray(raw)) return [];
    const parsed: StoredAction[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      const type = typeof record.type === "string" ? record.type : null;
      if (!type || !AUTOMATION_ACTION_TYPES.includes(type as never)) continue;
      const config =
        record.config && typeof record.config === "object" && !Array.isArray(record.config)
          ? (record.config as Record<string, unknown>)
          : {};
      parsed.push({ type, config });
    }
    return parsed;
  }

  private async recordRun(
    ruleId: string,
    event: AutomationEvent,
    matched: boolean,
    succeeded: boolean,
    error: string | null,
    actionsRun: Array<{ type: string; detail?: Record<string, unknown> }>
  ) {
    try {
      await this.prisma.automationRuleRun.create({
        data: {
          ruleId,
          entity: event.entity,
          entityId: event.entityId ?? null,
          event: event.event,
          matched,
          succeeded,
          error,
          actionsRun: actionsRun as unknown as Prisma.InputJsonValue
        }
      });
    } catch (err) {
      // Never let the run-log write kill the dispatch loop.
      this.logger.error(`Failed to record automation run for rule ${ruleId}: ${String(err)}`);
    }
  }
}
