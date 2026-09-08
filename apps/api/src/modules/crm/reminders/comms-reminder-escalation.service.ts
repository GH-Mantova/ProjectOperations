import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CommTaskStatus, CommThreadKind, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../platform/notifications.service";
import { ReminderPolicyService } from "./reminder-policy.service";

// ── PERMISSION CHOICE (recorded per TR-3 §Context) ───────────────────────────
//
// The permissions registry lives at
// `apps/api/src/common/permissions/permission-registry.ts` — NOT
// `apps/api/src/common/auth/permissions.registry.ts` as the TR-3 prompt says;
// `common/auth/` holds the guard and decorator only.
//
// That registry was grepped for a CRM-admin key. The CRM module owns exactly
// two codes:
//
//   crm.view    — View CRM leads, opportunities and forecast
//   crm.manage  — Manage CRM leads and opportunities
//
// There is NO `crm.admin`. `crm.manage` is therefore the most specific
// existing key for "a person who owns the CRM surface", and it is already the
// key TR-1 chose for the reminder-policy write routes (see the note at the top
// of `reminder-policy.controller.ts`). Escalation targets the holders of that
// key.
//
// The `tenders.manage` fallback the prompt names is deliberately NOT used: it
// exists, but it is a Tendering-module key, and TR_SCOPE_CRM moved this whole
// cluster to the CRM surface. No new permission or role concept is invented
// here — the escalation reads the existing Role → RolePermission → Permission
// graph, the same way `compliance.service.ts` finds its admins.
const MANAGER_PERMISSION = "crm.manage";

/**
 * Every escalation trigger key is the primary key with this prefix. It is also
 * the marker that stops the pass eating its own tail: a row whose triggerKey
 * starts with `esc_` is never itself a candidate for escalation.
 */
const ESCALATION_PREFIX = "esc_";

/**
 * `CommThread.entityType` / `CommTask.entityType` are the UPPERCASE
 * `COMM_ENTITY_TYPES` vocabulary (`crm/comms/comms.service.ts`), which is NOT
 * the mixed-case `TenderReminderLog.subjectType` vocabulary ("Tender",
 * "CommTask"). The TR-3 prompt uses `'Tender'` for both; the stored data does
 * not. Conflating them would make the "has it been actioned?" thread lookup
 * silently match nothing and escalate everything.
 */
const ENTITY_TYPE_TENDER = "TENDER";
const ENTITY_TYPE_OPPORTUNITY = "OPPORTUNITY";
const ENTITY_TYPE_ACCOUNT = "ACCOUNT";

/**
 * `Tender.status` values that mean the tender is finished with, so a stale
 * reminder against it is moot.
 *
 * There is no `stage` column on `Tender` — the column is `status: String`
 * (the TR-3 prompt calls it a "stage"). These are the three terminal names the
 * prompt lists; `LOST` / `WITHDRAWN` also exist in the live vocabulary and are
 * treated as actioned for the same reason.
 */
const TERMINAL_TENDER_STATUSES = new Set([
  "AWARDED",
  "CONTRACT_ISSUED",
  "CONVERTED",
  "LOST",
  "WITHDRAWN"
]);

/** `CommTask.status` values that mean the task no longer needs chasing. */
const CLOSED_TASK_STATUSES = new Set<string>([CommTaskStatus.DONE, CommTaskStatus.CANCELLED]);

const MS_PER_DAY = 86_400_000;

// ── Date helpers (UTC only — the cron is registered with timeZone "UTC") ──────

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcEndOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Whole calendar days from `from` to `to`, both normalised to UTC midnight. */
function wholeDaysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to).getTime() - utcMidnight(from).getTime()) / MS_PER_DAY);
}

/** `subjectType|subjectId|triggerKey` — the shape of the unique index. */
function logKey(subjectType: string, subjectId: string, triggerKey: string): string {
  return `${subjectType}|${subjectId}|${triggerKey}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

/** One `TenderReminderLog` row the escalation pass is considering. */
type CandidateLog = {
  subjectType: string;
  subjectId: string;
  triggerKey: string;
  firedAt: Date;
};

/** A step of the pass that did not do what it set out to do. */
export type EscalationFailure = {
  stage: "notify" | "record";
  subjectType: string;
  subjectId: string;
  triggerKey: string;
  message: string;
};

/**
 * What one escalation pass did.
 *
 * Same contract as TR-2's `ReminderSweepResult`: a pass that matched nothing
 * is DISTINGUISHABLE from a pass that never ran. `status: "clean"` with a
 * non-zero `scanned` is a positive statement ("I ran, I looked at N overdue
 * log rows, all of them had been actioned"); a pass that did not run emits
 * nothing at all.
 */
export type EscalationSweepResult = {
  /** ISO timestamp of the reference date the pass was run for. */
  ranAt: string;
  /**
   * `escalated` — at least one manager notification was delivered.
   * `clean`     — the pass completed and nothing needed escalating.
   * `degraded`  — the pass completed but at least one send or record failed.
   */
  status: "escalated" | "clean" | "degraded";
  /** The window actually in force for this pass, from the policy row. */
  escalationWindowDays: number;
  /** The permission code whose holders were notified. */
  managerPermission: string;
  /** How many users held that permission at pass time. */
  managers: number;
  /** Overdue, non-escalation log rows pulled out of the database. */
  scanned: number;
  /** Subjects that produced at least one delivered manager notification. */
  escalated: number;
  /** Notifications actually created (one per manager per escalated subject). */
  notified: number;
  /** `esc_` log rows written (or confirmed present) by this pass. */
  recorded: number;
  /** Candidates that were dropped, and why. */
  suppressed: {
    /** The subject has been actioned since `firedAt`. */
    actioned: number;
    /** An `esc_` log row already exists for this subject + trigger. */
    alreadyEscalated: number;
    /** The Tender / CommTask the log row names no longer exists. */
    subjectMissing: number;
    /** Nobody holds the manager permission — warned, never thrown. */
    noManagers: number;
    /** A concurrent pass wrote the same `esc_` row first (P2002). */
    racedOnUniqueIndex: number;
    /** A log row whose triggerKey already starts with `esc_` (defence in depth). */
    ownEscalation: number;
  };
  failures: EscalationFailure[];
};

/** A subject that survived every filter and is ready to be escalated. */
type DueEscalation = {
  subjectType: string;
  subjectId: string;
  /** The ORIGINAL trigger key. The `esc_` prefix is added when writing. */
  triggerKey: string;
  firedAt: Date;
  ageDays: number;
  title: string;
  body: string;
  linkUrl: string;
};

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * TR-3: the manager escalation pass over unactioned CRM reminders.
 *
 * TR-2's `CommsReminderService` tells the person who owns the work. This
 * service is what happens when that person does nothing: `policy
 * .escalationWindowDays` after a reminder fired, if the subject still has not
 * moved, the holders of `crm.manage` are told.
 *
 * ── WHY A SEPARATE @Cron RATHER THAN A CALL FROM scanAndNotify ─────────────
 * The TR-3 prompt offers both. A separate cron is the one that keeps both
 * services independently testable, which is the criterion the prompt itself
 * names, and it is the only one that does not change `CommsReminderService`:
 *
 *   - `scanAndNotify` returns `ReminderSweepResult`, which TR-2's spec asserts
 *     with `toStrictEqual` over the WHOLE object. Folding an escalation
 *     summary into that return value breaks those assertions.
 *   - Injecting this service into `CommsReminderService` changes its
 *     constructor arity, which breaks every direct `new CommsReminderService(
 *     a, b, c)` in the existing spec.
 *
 * Both of those files are the primary reminder engine's, not this slice's, and
 * a slice that has to rewrite the previous slice's tests to compile is a slice
 * that chose the wrong seam.
 *
 * The schedule is 21:30 UTC — THIRTY MINUTES AFTER the 21:00 primary sweep,
 * deliberately not the same minute. Nothing depends on the ordering (this pass
 * only ever looks at rows at least `escalationWindowDays` old, so rows the
 * primary sweep writes tonight are invisible to it for days), but two crons
 * hammering the same three tables in the same second for no reason is a
 * needless race to leave lying around.
 *
 * ── IDEMPOTENCY ────────────────────────────────────────────────────────────
 * An escalation writes its own `TenderReminderLog` row, keyed
 * `{ subjectType, subjectId, "esc_" + originalTriggerKey }`, on the same
 * UNIQUE index TR-1 created. That row is what makes a second pass a no-op, and
 * it is also why the pass can never escalate its own output: candidates are
 * selected with `NOT triggerKey startsWith "esc_"` in SQL and filtered again
 * in memory.
 *
 * ── ORDERING: SEND, THEN RECORD ────────────────────────────────────────────
 * Inherited verbatim from TR-2, for the same reason. The `esc_` row is written
 * only after at least one manager notification has succeeded. A pass that
 * crashes between the two re-sends tomorrow (annoying); the reverse order
 * would mark an escalation delivered that never left the building (the exact
 * failure this slice exists to prevent).
 */
@Injectable()
export class CommsReminderEscalationService {
  private readonly logger = new Logger(CommsReminderEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: ReminderPolicyService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Nightly at 21:30 UTC = 7:30am AEST (UTC+10), half an hour behind the
   * primary sweep. `timeZone: "UTC"` per house convention.
   *
   * The result is logged at INFO on every completed pass, including a pass
   * that escalated nothing — that line is the only difference between "ran,
   * nothing was overdue" and "did not run".
   */
  @Cron("30 21 * * *", { name: "crm-comms-reminder-escalation", timeZone: "UTC" })
  async runEscalations() {
    try {
      const result = await this.scanAndEscalate(new Date());
      this.logger.log(this.summarise(result));
    } catch (err) {
      this.logger.warn(`crm-comms-reminder-escalation failed: ${(err as Error).message}`);
    }
  }

  /** One-line, greppable rendering of an escalation result. */
  summarise(result: EscalationSweepResult): string {
    const { suppressed } = result;
    return (
      `crm-comms-reminder-escalation ${result.status} @ ${result.ranAt} — ` +
      `window ${result.escalationWindowDays}d; scanned ${result.scanned} overdue log row(s); ` +
      `escalated ${result.escalated} to ${result.managers} ${result.managerPermission} ` +
      `holder(s) via ${result.notified} notification(s); recorded ${result.recorded}; ` +
      `suppressed ${suppressed.actioned} actioned, ${suppressed.alreadyEscalated} already-escalated, ` +
      `${suppressed.subjectMissing} subject-missing, ${suppressed.noManagers} no-manager, ` +
      `${suppressed.racedOnUniqueIndex} raced, ${suppressed.ownEscalation} own-escalation; ` +
      `failures ${result.failures.length}`
    );
  }

  /**
   * The testable core. Finds primary reminders that fired at least
   * `policy.escalationWindowDays` ago, drops the ones that have since been
   * actioned or already escalated, and tells the managers about the rest.
   *
   * Never throws for a per-item problem (a missing subject, no managers at
   * all, a failed send, a raced log write) — those are counted into the
   * returned result. It only propagates if the policy read or the candidate
   * query fails, i.e. if the pass genuinely could not run.
   *
   * @param today - reference date, injected so tests can pin the clock
   */
  async scanAndEscalate(today: Date): Promise<EscalationSweepResult> {
    const policy = await this.policyService.getPolicy();
    const windowDays = policy.escalationWindowDays;

    // END of the day `windowDays` before `today`, so "fired 3 days ago" means
    // any moment on that calendar day. A midnight cutoff would silently add a
    // fourth day to every escalation window, because reminders are written by
    // a 21:00 cron and would never be `<=` the midnight that opens their day.
    const cutoff = utcEndOfDay(addDays(utcMidnight(today), -windowDays));

    const rows = await this.prisma.tenderReminderLog.findMany({
      where: {
        firedAt: { lte: cutoff },
        NOT: { triggerKey: { startsWith: ESCALATION_PREFIX } }
      },
      select: { subjectType: true, subjectId: true, triggerKey: true, firedAt: true },
      orderBy: { firedAt: "asc" }
    });

    const result = this.emptyResult(today, windowDays);
    result.scanned = rows.length;
    if (rows.length === 0) return result;

    // Defence in depth: the SQL predicate above is the primary guard, but the
    // rule "an escalation is never itself escalated" is load-bearing enough to
    // be enforced twice. A collation or provider quirk in `startsWith` must not
    // be able to produce `esc_esc_task_due`.
    const candidates: CandidateLog[] = [];
    for (const row of rows) {
      if (row.triggerKey.startsWith(ESCALATION_PREFIX)) {
        result.suppressed.ownEscalation += 1;
        continue;
      }
      candidates.push(row);
    }
    if (candidates.length === 0) return result;

    const alreadyLogged = await this.loadLoggedKeys(candidates);
    const [tenders, tasks] = await Promise.all([
      this.loadTenderSubjects(candidates),
      this.loadCommTaskSubjects(candidates)
    ]);

    const due: DueEscalation[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const escalationKey = `${ESCALATION_PREFIX}${candidate.triggerKey}`;
      const key = logKey(candidate.subjectType, candidate.subjectId, escalationKey);

      // In-memory guard as well as the database one: two log rows must never
      // produce the same escalation twice inside a single pass.
      if (seen.has(key)) continue;
      seen.add(key);

      if (alreadyLogged.has(key)) {
        result.suppressed.alreadyEscalated += 1;
        continue;
      }

      const item = this.describe(candidate, today, tenders, tasks, windowDays);
      if (item === "missing") {
        result.suppressed.subjectMissing += 1;
        continue;
      }
      if (item === "actioned") {
        result.suppressed.actioned += 1;
        continue;
      }
      due.push(item);
    }

    if (due.length === 0) return result;

    const managers = await this.findManagers();
    result.managers = managers.length;

    // A misconfigured installation (nobody holds `crm.manage`) must not crash
    // the cron and must not silently swallow the fact that N escalations had
    // nowhere to go. No log row is written, so the next pass retries.
    if (managers.length === 0) {
      result.suppressed.noManagers = due.length;
      this.logger.warn(
        `crm-comms-reminder-escalation: ${due.length} reminder(s) are past the ` +
          `${windowDays}-day escalation window but NO user holds "${MANAGER_PERMISSION}" — ` +
          `nothing escalated, nothing logged, will retry next pass.`
      );
      return result;
    }

    for (const item of due) {
      const delivered = await this.deliver(item, managers, result);
      if (delivered === 0) continue;
      result.escalated += 1;
      result.notified += delivered;
      await this.record(item, today, result);
    }

    if (result.failures.length > 0) result.status = "degraded";
    else if (result.escalated > 0) result.status = "escalated";

    return result;
  }

  // ── Subject resolution ─────────────────────────────────────────────────────

  /**
   * Tenders named by the candidate log rows, plus everything needed to decide
   * whether each has been actioned: its terminal-status check, whether an
   * outcome was recorded, and the `logged_contact` threads anchored to it.
   *
   * `outcomes: { take: 1 }` rather than a count — the question is "is there at
   * least one?", and a count would make the database sum a set nobody reads.
   */
  private async loadTenderSubjects(candidates: CandidateLog[]) {
    const ids = [...new Set(candidates.filter((c) => c.subjectType === "Tender").map((c) => c.subjectId))];
    const map = new Map<string, TenderSubject>();
    if (ids.length === 0) return map;

    const tenders = await this.prisma.tender.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        status: true,
        outcomes: { select: { id: true }, take: 1 }
      }
    });

    const threads = await this.prisma.commThread.findMany({
      where: {
        kind: CommThreadKind.logged_contact,
        entityType: ENTITY_TYPE_TENDER,
        entityId: { in: ids },
        archivedAt: null
      },
      select: { entityId: true, createdAt: true }
    });

    for (const tender of tenders) {
      map.set(tender.id, {
        id: tender.id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        status: tender.status,
        hasOutcome: (tender.outcomes ?? []).length > 0,
        loggedContactAt: threads
          .filter((thread) => thread.entityId === tender.id)
          .map((thread) => thread.createdAt)
      });
    }

    return map;
  }

  /**
   * CommTasks named by the candidate log rows, plus the `createdAt` of every
   * message on each task's thread — CRM-S8's second definition of "actioned"
   * ("somebody has since said something about it").
   */
  private async loadCommTaskSubjects(candidates: CandidateLog[]) {
    const ids = [
      ...new Set(candidates.filter((c) => c.subjectType === "CommTask").map((c) => c.subjectId))
    ];
    const map = new Map<string, CommTaskSubject>();
    if (ids.length === 0) return map;

    const tasks = await this.prisma.commTask.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        status: true,
        threadId: true,
        entityType: true,
        entityId: true
      }
    });

    const threadIds = tasks
      .map((task) => task.threadId)
      .filter((threadId): threadId is string => Boolean(threadId));

    const messages =
      threadIds.length > 0
        ? await this.prisma.commMessage.findMany({
            where: { threadId: { in: threadIds } },
            select: { threadId: true, createdAt: true }
          })
        : [];

    for (const task of tasks) {
      map.set(task.id, {
        id: task.id,
        title: task.title,
        status: task.status,
        threadId: task.threadId,
        entityType: task.entityType,
        entityId: task.entityId,
        messageAt: task.threadId
          ? messages.filter((message) => message.threadId === task.threadId).map((m) => m.createdAt)
          : []
      });
    }

    return map;
  }

  /**
   * Turn one candidate log row into the escalation it deserves, or say why it
   * gets none.
   *
   * `"missing"` and `"actioned"` are deliberately different answers: a deleted
   * subject is a data-shape fact worth counting separately from a subject that
   * a human dealt with.
   */
  private describe(
    candidate: CandidateLog,
    today: Date,
    tenders: Map<string, TenderSubject>,
    tasks: Map<string, CommTaskSubject>,
    windowDays: number
  ): DueEscalation | "missing" | "actioned" {
    // The prompt's body copy says the reminder "was sent ${escalationWindowDays}
    // days ago". That is only true on the FIRST pass that could have escalated
    // it — a reminder that sat unactioned through a fortnight of failed sends
    // is fourteen days old, not three. The real age is reported and the window
    // is named alongside it, so the manager reads a fact rather than a
    // configuration value.
    const ageDays = wholeDaysBetween(candidate.firedAt, today);
    const window = `escalation window ${windowDays} day(s)`;

    if (candidate.subjectType === "Tender") {
      const tender = tenders.get(candidate.subjectId);
      if (!tender) return "missing";
      if (TERMINAL_TENDER_STATUSES.has(tender.status)) return "actioned";
      if (tender.hasOutcome) return "actioned";
      if (tender.loggedContactAt.some((at) => at > candidate.firedAt)) return "actioned";

      const label = `${tender.tenderNumber} — ${tender.title}`;
      return {
        subjectType: candidate.subjectType,
        subjectId: candidate.subjectId,
        triggerKey: candidate.triggerKey,
        firedAt: candidate.firedAt,
        ageDays,
        title: `Tender ${tender.tenderNumber} — reminder unactioned (escalation)`,
        body:
          `A reminder for ${label} was sent ${ageDays} day(s) ago (${window}) and has not ` +
          `been actioned. Escalating to manager.`,
        linkUrl: `/tenders/${tender.id}`
      };
    }

    if (candidate.subjectType === "CommTask") {
      const task = tasks.get(candidate.subjectId);
      if (!task) return "missing";
      if (CLOSED_TASK_STATUSES.has(task.status)) return "actioned";
      if (task.messageAt.some((at) => at > candidate.firedAt)) return "actioned";

      return {
        subjectType: candidate.subjectType,
        subjectId: candidate.subjectId,
        triggerKey: candidate.triggerKey,
        firedAt: candidate.firedAt,
        ageDays,
        title: `Follow-up "${task.title}" — reminder unactioned (escalation)`,
        body:
          `A reminder for "${task.title}" (${task.entityType} ${task.entityId}) was sent ` +
          `${ageDays} day(s) ago (${window}) and has not been actioned. ` +
          `Escalating to manager.`,
        linkUrl: anchorLink(task.entityType, task.entityId)
      };
    }

    // An unknown subjectType is a schema change nobody told this service
    // about. Counting it as "missing" is the honest answer — there is nothing
    // to resolve and nothing to say about it.
    return "missing";
  }

  // ── Managers, idempotency, delivery ────────────────────────────────────────

  /**
   * Active users who hold {@link MANAGER_PERMISSION} through any role.
   *
   * Same traversal as `compliance.service.ts:findComplianceAdmins` — the
   * existing Role → RolePermission → Permission graph. No new role concept.
   */
  private async findManagers(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              rolePermissions: { some: { permission: { code: MANAGER_PERMISSION } } }
            }
          }
        }
      },
      select: { id: true }
    });
    return users.map((user) => user.id);
  }

  /**
   * The keys of every `TenderReminderLog` row that already exists for the
   * subjects this pass is considering — escalation rows included, which is the
   * whole point.
   *
   * One query per subject type rather than one per candidate: the table is
   * indexed on `[subjectType, subjectId]`.
   */
  private async loadLoggedKeys(candidates: CandidateLog[]): Promise<Set<string>> {
    const keys = new Set<string>();
    if (candidates.length === 0) return keys;

    const bySubjectType = new Map<string, Set<string>>();
    for (const candidate of candidates) {
      const ids = bySubjectType.get(candidate.subjectType) ?? new Set<string>();
      ids.add(candidate.subjectId);
      bySubjectType.set(candidate.subjectType, ids);
    }

    for (const [subjectType, ids] of bySubjectType) {
      const rows = await this.prisma.tenderReminderLog.findMany({
        where: { subjectType, subjectId: { in: [...ids] } },
        select: { subjectType: true, subjectId: true, triggerKey: true }
      });
      for (const row of rows) {
        keys.add(logKey(row.subjectType, row.subjectId, row.triggerKey));
      }
    }

    return keys;
  }

  /**
   * Notify every manager about one unactioned subject.
   *
   * Returns the number of notifications that actually landed. A manager whose
   * send throws is counted into `failures` and does not stop the others; if
   * EVERY manager fails, zero is returned and the caller writes no log row, so
   * the whole escalation is retried by the next pass.
   */
  private async deliver(
    item: DueEscalation,
    managers: string[],
    result: EscalationSweepResult
  ): Promise<number> {
    let delivered = 0;

    for (const managerId of managers) {
      try {
        await this.notifications.create({
          userId: managerId,
          title: item.title,
          body: item.body,
          severity: "HIGH",
          linkUrl: item.linkUrl
        });
        delivered += 1;
      } catch (err) {
        const message = (err as Error).message;
        result.failures.push({
          stage: "notify",
          subjectType: item.subjectType,
          subjectId: item.subjectId,
          triggerKey: `${ESCALATION_PREFIX}${item.triggerKey}`,
          message
        });
        this.logger.warn(
          `crm-comms-reminder-escalation: escalation notice for manager ${managerId} on ` +
            `${item.subjectType} ${item.subjectId} failed (${message}).`
        );
      }
    }

    return delivered;
  }

  /**
   * Write the `esc_` row that stops this escalation firing again.
   *
   * `upsert` with an empty `update` on the compound unique key: a row already
   * there (a concurrent pass beat us to it) keeps its original `firedAt`.
   * Nothing is ever overwritten or deleted, and a P2002 racing the insert is
   * the unique index doing its job, not a failure.
   */
  private async record(
    item: DueEscalation,
    today: Date,
    result: EscalationSweepResult
  ): Promise<void> {
    const triggerKey = `${ESCALATION_PREFIX}${item.triggerKey}`;
    try {
      await this.prisma.tenderReminderLog.upsert({
        where: {
          subjectType_subjectId_triggerKey: {
            subjectType: item.subjectType,
            subjectId: item.subjectId,
            triggerKey
          }
        },
        update: {},
        create: {
          subjectType: item.subjectType,
          subjectId: item.subjectId,
          triggerKey,
          firedAt: today
        }
      });
      result.recorded += 1;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        result.suppressed.racedOnUniqueIndex += 1;
        this.logger.warn(
          `crm-comms-reminder-escalation: ${item.subjectType} ${item.subjectId} / ${triggerKey} ` +
            `was recorded by a concurrent pass — not re-recorded.`
        );
        return;
      }
      const message = (err as Error).message;
      result.failures.push({
        stage: "record",
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        triggerKey,
        message
      });
      this.logger.warn(
        `crm-comms-reminder-escalation: failed to log ${item.subjectType} ${item.subjectId} / ` +
          `${triggerKey} (${message}) — the escalation WAS delivered and may repeat next pass.`
      );
    }
  }

  private emptyResult(today: Date, windowDays: number): EscalationSweepResult {
    return {
      ranAt: today.toISOString(),
      status: "clean",
      escalationWindowDays: windowDays,
      managerPermission: MANAGER_PERMISSION,
      managers: 0,
      scanned: 0,
      escalated: 0,
      notified: 0,
      recorded: 0,
      suppressed: {
        actioned: 0,
        alreadyEscalated: 0,
        subjectMissing: 0,
        noManagers: 0,
        racedOnUniqueIndex: 0,
        ownEscalation: 0
      },
      failures: []
    };
  }
}

// ── Local subject shapes ─────────────────────────────────────────────────────

type TenderSubject = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  hasOutcome: boolean;
  loggedContactAt: Date[];
};

type CommTaskSubject = {
  id: string;
  title: string;
  status: string;
  threadId: string | null;
  entityType: string;
  entityId: string;
  messageAt: Date[];
};

/**
 * The CRM surface a `CommTask` anchor actually resolves to.
 *
 * The TR-3 prompt names `/crm/tenders?tenderId=…`. **That route does not
 * exist** — `apps/web/src/App.tsx` mounts `/crm`, `/crm/accounts`,
 * `/crm/accounts/:id`, `/crm/opportunities/:id`, `/crm/register`, `/crm/comms`
 * and a `/crm/*` catch-all that redirects anything else to `/crm/accounts`. A
 * link built to the prompt's spelling would silently land the manager on the
 * Accounts list. These are the real routes; `/crm/register` (the Tenders
 * landing that carries CRM-S8's Follow-ups tab) is the fallback for anchors
 * with no detail page of their own.
 */
function anchorLink(entityType: string, entityId: string): string {
  if (entityType === ENTITY_TYPE_TENDER) return `/tenders/${entityId}`;
  if (entityType === ENTITY_TYPE_OPPORTUNITY) return `/crm/opportunities/${entityId}`;
  if (entityType === ENTITY_TYPE_ACCOUNT) return `/crm/accounts/${entityId}`;
  return "/crm/register";
}
