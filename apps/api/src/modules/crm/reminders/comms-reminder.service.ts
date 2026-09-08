import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CommTaskStatus, CommThreadKind, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../platform/notifications.service";
import { adjustToPrecedingWorkday } from "../../contracts/public-holidays";
import { ReminderPolicyService } from "./reminder-policy.service";
import type {
  DigestGroup,
  ReminderEvent,
  ReminderSweepFailure,
  ReminderSweepResult
} from "./comms-reminder.types";

// ── Vocabulary ───────────────────────────────────────────────────────────────

/**
 * The tender statuses a PRE-DUE quote reminder may fire against.
 *
 * The TR-2 prompt phrased this as `stage NOT IN ['AWARDED', 'CONTRACT_ISSUED',
 * 'CONVERTED', 'SUBMITTED']`. It is written here as the equivalent POSITIVE
 * list for a measured reason: **there is no `stage` column on `Tender`**. The
 * column is `status: String`, and its live vocabulary is wider than the
 * six-value `TenderingStage` union that `TENDERING_STAGE_KEYS` mirrors — it
 * also carries `LOST` and `WITHDRAWN` (see
 * `tendering/capacity.service.ts:TERMINAL_STATUSES`).
 *
 * Over the six stage names the two formulations are identical. Over the real
 * column they are not: a NOT-IN list would chase the estimator about the quote
 * due date on a tender that was LOST or WITHDRAWN weeks ago. An allow-list
 * cannot make that mistake, and a status added later fails CLOSED (no
 * reminder) rather than OPEN (a wrong reminder).
 */
const PRE_DUE_STATUSES = ["DRAFT", "IN_PROGRESS"] as const;

/** The `Tender.status` value the POST-SUBMISSION chase track anchors on. */
const SUBMITTED_STATUS = "SUBMITTED";

/**
 * `CommTask.entityType` / `CommThread.entityType` values, which are UPPERCASE
 * (`COMM_ENTITY_TYPES` in `crm/comms/comms.service.ts`) — NOT the mixed-case
 * `TenderReminderLog.subjectType` vocabulary. The prompt used `'Tender'` for
 * both; the stored data uses `'TENDER'` for this one.
 */
const ENTITY_TYPE_TENDER = "TENDER";
const ENTITY_TYPE_OPPORTUNITY = "OPPORTUNITY";

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

function formatDate(date: Date): string {
  return utcMidnight(date).toISOString().slice(0, 10);
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * TR-2: the CRM scheduled reminder engine.
 *
 * Runs one nightly sweep over three tracks and notifies internal staff:
 *
 *   PRE-DUE          — a quote due date is approaching or has passed.
 *   POST-SUBMISSION   — a submitted tender has gone un-chased.
 *   TASK              — an open `CommTask` is due (CRM-S8's next-action store).
 *
 * Mirrors `contracts/claim-draft-reminder.service.ts`: the `@Cron` wrapper is
 * a try/catch around a date-injected testable core (`scanAndNotify(today)`).
 *
 * ── IDEMPOTENCY ────────────────────────────────────────────────────────────
 * Every delivered reminder writes exactly one `TenderReminderLog` row keyed
 * `{ subjectType, subjectId, triggerKey }`, which TR-1 covered with a UNIQUE
 * index. The index is load-bearing twice over:
 *
 *   1. Before sending, the sweep reads the existing log rows for the subjects
 *      it is about to consider and drops any candidate whose key is already
 *      present. This is what makes a SECOND run of the sweep a no-op.
 *   2. When writing, the sweep upserts on that same compound key and treats a
 *      P2002 as success-by-someone-else (`suppressed.racedOnUniqueIndex`), so
 *      two sweeps overlapping in time can never produce two log rows and can
 *      never crash the run.
 *
 * ── ORDERING: SEND, THEN RECORD ────────────────────────────────────────────
 * The log row is written AFTER the notification succeeds, never before. That
 * ordering is a deliberate choice between two failure modes:
 *
 *   record-then-send — a failed send leaves a log row saying it fired. The
 *                      reminder is then never retried. The reminder is LOST.
 *   send-then-record — a crash between the two re-sends next sweep. The
 *                      reminder is DUPLICATED.
 *
 * A duplicate reminder is an annoyance; a dropped reminder is the failure this
 * whole slice exists to prevent, so delivery is at-least-once. A send that
 * throws writes NO log row, is counted in `failures`, flips the sweep to
 * `degraded`, and is retried by the next sweep. Nothing is deleted, ever.
 *
 * ── CLOCKS ─────────────────────────────────────────────────────────────────
 * Every threshold reads a column that MEANS the event it is measuring:
 * `Tender.dueDate` (pre-due), `Tender.submittedAt` (post-submission),
 * `CommTask.dueAt` (task), `CommThread.createdAt` (was this chased already).
 * `Tender.updatedAt` is deliberately NOT used anywhere — it is reset by any
 * edit, so "idle for N days" measured against it silently resets every time
 * somebody opens and saves the record.
 */
@Injectable()
export class CommsReminderService {
  private readonly logger = new Logger(CommsReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: ReminderPolicyService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Nightly at 21:00 UTC = 7am AEST (UTC+10). `timeZone: "UTC"` per house
   * convention (same as the contracts crons).
   *
   * The result is logged at INFO on every completed sweep — including a sweep
   * that matched nothing. That line is the only difference between "ran,
   * nothing was due" and "did not run"; a silent success would be
   * indistinguishable from a cron that never fired.
   */
  @Cron("0 21 * * *", { name: "crm-comms-reminders", timeZone: "UTC" })
  async runCommsReminders() {
    try {
      const result = await this.scanAndNotify(new Date());
      this.logger.log(this.summarise(result));
    } catch (err) {
      this.logger.warn(`crm-comms-reminders failed: ${(err as Error).message}`);
    }
  }

  /** One-line, greppable rendering of a sweep result. */
  summarise(result: ReminderSweepResult): string {
    const { scanned, triggered, suppressed, notified } = result;
    return (
      `crm-comms-reminders ${result.status} @ ${result.ranAt} — ` +
      `scanned ${scanned.preDueCandidates} pre-due / ` +
      `${scanned.postSubmissionCandidates} submitted / ${scanned.openTasks} tasks; ` +
      `triggered ${triggered.total} (pre-due ${triggered.preDue}, ` +
      `post-sub ${triggered.postSubmission}, task ${triggered.task}); ` +
      `notified ${notified.digests} digest(s) to ${notified.recipients} user(s); ` +
      `recorded ${result.recorded}; ` +
      `suppressed ${suppressed.alreadyLogged} already-logged, ` +
      `${suppressed.noRecipient} no-recipient, ${suppressed.racedOnUniqueIndex} raced; ` +
      `failures ${result.failures.length}`
    );
  }

  /**
   * The testable core. Scans all three tracks against `today`, folds the
   * resulting events into one notification per recipient, delivers them, and
   * records what was delivered.
   *
   * Never throws for a per-item problem (an unresolvable recipient, a failed
   * send, a raced log write) — those are counted into the returned result so
   * the caller can see them. It only propagates if the policy read or one of
   * the three scan queries fails, i.e. if the sweep genuinely could not run.
   *
   * @param today - reference date, injected so tests can pin the clock
   */
  async scanAndNotify(today: Date): Promise<ReminderSweepResult> {
    const policy = await this.policyService.getPolicy();

    const preDue = await this.collectPreDue(today, policy.daysBefore, policy.dueDayOf);
    const postSubmission = await this.collectPostSubmission(
      today,
      policy.postSubmissionChaseDays,
      policy.postSubmissionCadenceDays
    );
    const task = await this.collectTaskDue(today, policy.daysBefore);

    const candidates = [...preDue.events, ...postSubmission.events, ...task.events];
    const noRecipient = preDue.noRecipient + postSubmission.noRecipient + task.noRecipient;

    // ── Idempotency filter: drop anything the log already knows about. ──────
    const alreadyLogged = await this.loadLoggedKeys(candidates);
    const fresh: ReminderEvent[] = [];
    const seen = new Set<string>();
    let suppressedAlreadyLogged = 0;
    for (const event of candidates) {
      const key = logKey(event.subjectType, event.subjectId, event.triggerKey);
      // In-memory guard as well as the database one: two tracks must never
      // produce the same (subject, trigger) twice inside a single sweep.
      if (seen.has(key)) continue;
      seen.add(key);
      if (alreadyLogged.has(key)) {
        suppressedAlreadyLogged += 1;
        continue;
      }
      fresh.push(event);
    }

    const failures: ReminderSweepFailure[] = [];
    let digests = 0;
    let recorded = 0;
    let raced = 0;

    for (const group of this.groupByUser(fresh)) {
      const delivered = await this.deliver(group, failures);
      if (!delivered) continue;
      digests += 1;
      for (const event of group.events) {
        const outcome = await this.record(event, today, failures);
        if (outcome === "recorded") recorded += 1;
        if (outcome === "raced") raced += 1;
      }
    }

    const triggeredPreDue = fresh.filter((e) => e.track === "PRE_DUE").length;
    const triggeredPostSub = fresh.filter((e) => e.track === "POST_SUBMISSION").length;
    const triggeredTask = fresh.filter((e) => e.track === "TASK").length;

    return {
      ranAt: today.toISOString(),
      status: failures.length > 0 ? "degraded" : fresh.length > 0 ? "fired" : "clean",
      policy: {
        daysBefore: policy.daysBefore,
        dueDayOf: policy.dueDayOf,
        postSubmissionChaseDays: policy.postSubmissionChaseDays,
        postSubmissionCadenceDays: policy.postSubmissionCadenceDays
      },
      scanned: {
        preDueCandidates: preDue.scanned,
        postSubmissionCandidates: postSubmission.scanned,
        openTasks: task.scanned
      },
      triggered: {
        preDue: triggeredPreDue,
        postSubmission: triggeredPostSub,
        task: triggeredTask,
        total: fresh.length
      },
      suppressed: {
        alreadyLogged: suppressedAlreadyLogged,
        noRecipient,
        racedOnUniqueIndex: raced
      },
      notified: { digests, recipients: digests },
      recorded,
      failures
    };
  }

  // ── Track 1: PRE-DUE ───────────────────────────────────────────────────────

  /**
   * Tenders still being priced whose quote due date is inside the warning
   * window, or already past.
   *
   * The due date is rolled back with `adjustToPrecedingWorkday` before the day
   * count is taken, so a Saturday deadline is measured from the Friday the
   * estimator can actually act on — the same business-day treatment the
   * contracts crons apply.
   */
  private async collectPreDue(today: Date, daysBefore: number, dueDayOf: boolean) {
    const tenders = await this.prisma.tender.findMany({
      where: {
        status: { in: [...PRE_DUE_STATUSES] },
        dueDate: { not: null },
        estimatorUserId: { not: null }
      },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        dueDate: true,
        estimatorUserId: true
      }
    });

    const events: ReminderEvent[] = [];
    let noRecipient = 0;

    for (const tender of tenders) {
      if (!tender.dueDate) continue;
      if (!tender.estimatorUserId) {
        noRecipient += 1;
        continue;
      }

      const actionableDue = adjustToPrecedingWorkday(utcMidnight(tender.dueDate));
      const daysUntilDue = wholeDaysBetween(today, actionableDue);
      const label = `${tender.tenderNumber} — ${tender.title}`;
      const linkUrl = `/tenders/${tender.id}`;

      if (daysUntilDue <= daysBefore) {
        events.push({
          track: "PRE_DUE",
          subjectType: "Tender",
          subjectId: tender.id,
          triggerKey: `pre_due_${daysBefore}`,
          userId: tender.estimatorUserId,
          headline: `Quote due soon — ${tender.tenderNumber}`,
          detail:
            `${label} is due ${formatDate(actionableDue)} ` +
            `(${daysUntilDue} working-adjusted day(s) from today).`,
          linkUrl
        });
      }

      // `dueDayOf` is the policy field TR-1 created for exactly this trigger
      // ("Fire an additional reminder on the due day itself"). Honouring it
      // means an installation that turns it off is not chased past the date.
      if (dueDayOf && daysUntilDue <= 0) {
        events.push({
          track: "PRE_DUE",
          subjectType: "Tender",
          subjectId: tender.id,
          triggerKey: "pre_due_0",
          userId: tender.estimatorUserId,
          headline: `Quote due date reached — ${tender.tenderNumber}`,
          detail: `${label} was due ${formatDate(actionableDue)} and has not been submitted.`,
          linkUrl
        });
      }
    }

    return { scanned: tenders.length, events, noRecipient };
  }

  // ── Track 2: POST-SUBMISSION ───────────────────────────────────────────────

  /**
   * Submitted tenders with no recorded outcome that nobody has chased inside
   * the current cadence window.
   *
   * The "somebody is already on it" test reads `CommThread.createdAt` for a
   * `logged_contact` thread — when the contact was LOGGED. `updatedAt` would
   * be the wrong clock: editing a thread subject a month later would
   * indefinitely suppress the chase.
   */
  private async collectPostSubmission(today: Date, chaseDays: number, cadenceDays: number) {
    const tenders = await this.prisma.tender.findMany({
      where: {
        status: SUBMITTED_STATUS,
        submittedAt: { not: null },
        outcomes: { none: {} }
      },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        submittedAt: true,
        estimatorUserId: true
      }
    });

    const events: ReminderEvent[] = [];
    let noRecipient = 0;
    if (tenders.length === 0) return { scanned: 0, events, noRecipient };

    const windowStart = addDays(utcMidnight(today), -cadenceDays);
    const threads = await this.prisma.commThread.findMany({
      where: {
        kind: CommThreadKind.logged_contact,
        entityType: ENTITY_TYPE_TENDER,
        entityId: { in: tenders.map((t) => t.id) },
        createdAt: { gte: windowStart },
        archivedAt: null
      },
      select: { entityId: true, createdAt: true }
    });

    for (const tender of tenders) {
      if (!tender.submittedAt) continue;

      const chasedInWindow = threads.some(
        (thread) =>
          thread.entityId === tender.id &&
          tender.submittedAt !== null &&
          thread.createdAt > tender.submittedAt
      );
      if (chasedInWindow) continue;

      const daysSinceSubmitted = wholeDaysBetween(tender.submittedAt, today);
      if (daysSinceSubmitted < chaseDays) continue;

      if (!tender.estimatorUserId) {
        this.logger.warn(
          `crm-comms-reminders: tender ${tender.id} is due a post-submission chase but has no estimator — skipped.`
        );
        noRecipient += 1;
        continue;
      }

      const bucket = Math.floor(daysSinceSubmitted / cadenceDays) * cadenceDays;
      events.push({
        track: "POST_SUBMISSION",
        subjectType: "Tender",
        subjectId: tender.id,
        triggerKey: `post_sub_${bucket}`,
        userId: tender.estimatorUserId,
        headline: `Chase submitted tender — ${tender.tenderNumber}`,
        detail:
          `${tender.tenderNumber} — ${tender.title} was submitted ${daysSinceSubmitted} ` +
          `day(s) ago with no outcome recorded and no contact logged in the last ` +
          `${cadenceDays} day(s).`,
        linkUrl: `/tenders/${tender.id}`
      });
    }

    return { scanned: tenders.length, events, noRecipient };
  }

  // ── Track 3: TASK ──────────────────────────────────────────────────────────

  /**
   * Open `CommTask` rows due inside the warning window.
   *
   * The trigger key is a bare `"task_due"` keyed by the CommTask id, so a task
   * fires exactly ONE due-reminder for its whole lifetime — the unique index
   * makes that a database-level guarantee rather than a convention.
   */
  private async collectTaskDue(today: Date, daysBefore: number) {
    const horizon = utcEndOfDay(addDays(utcMidnight(today), daysBefore));
    const tasks = await this.prisma.commTask.findMany({
      where: {
        status: CommTaskStatus.OPEN,
        dueAt: { not: null, lte: horizon }
      },
      select: {
        id: true,
        title: true,
        entityType: true,
        entityId: true,
        assigneeId: true,
        dueAt: true
      }
    });

    const events: ReminderEvent[] = [];
    let noRecipient = 0;
    if (tasks.length === 0) return { scanned: 0, events, noRecipient };

    const fallbacks = await this.resolveTaskFallbackUsers(tasks);

    for (const task of tasks) {
      const userId = task.assigneeId ?? fallbacks.get(`${task.entityType}|${task.entityId}`) ?? null;
      if (!userId) {
        this.logger.warn(
          `crm-comms-reminders: CommTask ${task.id} (${task.entityType} ${task.entityId}) is due ` +
            `but resolves to no user — skipped.`
        );
        noRecipient += 1;
        continue;
      }

      events.push({
        track: "TASK",
        subjectType: "CommTask",
        subjectId: task.id,
        triggerKey: "task_due",
        userId,
        headline: `Follow-up due — ${task.title}`,
        detail: task.dueAt
          ? `"${task.title}" is due ${formatDate(task.dueAt)}.`
          : `"${task.title}" is due.`,
        linkUrl: "/crm/register"
      });
    }

    return { scanned: tasks.length, events, noRecipient };
  }

  /**
   * Owner lookups for unassigned tasks, keyed `entityType|entityId`.
   *
   * Only `TENDER` (→ `estimatorUserId`) and `OPPORTUNITY` (→ `ownerId`) can
   * resolve a person. `ACCOUNT` / `JOB` / `CONTRACT` tasks with no assignee
   * fall through to the warn-and-skip path rather than being silently dropped
   * or thrown on.
   */
  private async resolveTaskFallbackUsers(
    tasks: Array<{ entityType: string; entityId: string; assigneeId: string | null }>
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unassigned = tasks.filter((t) => !t.assigneeId);
    if (unassigned.length === 0) return map;

    const tenderIds = unassigned
      .filter((t) => t.entityType === ENTITY_TYPE_TENDER)
      .map((t) => t.entityId);
    const opportunityIds = unassigned
      .filter((t) => t.entityType === ENTITY_TYPE_OPPORTUNITY)
      .map((t) => t.entityId);

    if (tenderIds.length > 0) {
      const tenders = await this.prisma.tender.findMany({
        where: { id: { in: tenderIds } },
        select: { id: true, estimatorUserId: true }
      });
      for (const tender of tenders) {
        if (tender.estimatorUserId) {
          map.set(`${ENTITY_TYPE_TENDER}|${tender.id}`, tender.estimatorUserId);
        }
      }
    }

    if (opportunityIds.length > 0) {
      const opportunities = await this.prisma.opportunity.findMany({
        where: { id: { in: opportunityIds } },
        select: { id: true, ownerId: true }
      });
      for (const opportunity of opportunities) {
        if (opportunity.ownerId) {
          map.set(`${ENTITY_TYPE_OPPORTUNITY}|${opportunity.id}`, opportunity.ownerId);
        }
      }
    }

    return map;
  }

  // ── Idempotency, digest, delivery ──────────────────────────────────────────

  /**
   * The keys of every `TenderReminderLog` row that already exists for the
   * subjects this sweep is considering.
   *
   * One query per subject type rather than one per candidate: the table is
   * indexed on `[subjectType, subjectId]`, and a sweep must not issue N round
   * trips to decide N booleans.
   */
  private async loadLoggedKeys(candidates: ReminderEvent[]): Promise<Set<string>> {
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
   * Fold events into one group per recipient, preserving encounter order so a
   * digest reads pre-due, then post-submission, then tasks.
   */
  private groupByUser(events: ReminderEvent[]): DigestGroup[] {
    const groups = new Map<string, DigestGroup>();
    for (const event of events) {
      const existing = groups.get(event.userId);
      if (existing) existing.events.push(event);
      else groups.set(event.userId, { userId: event.userId, events: [event] });
    }
    return [...groups.values()];
  }

  /**
   * Send one notification for one recipient's whole group.
   *
   * Returns `false` — without writing any log row — when the send throws, so
   * the next sweep retries the whole group. A failed recipient never aborts
   * the sweep for the other recipients.
   */
  private async deliver(group: DigestGroup, failures: ReminderSweepFailure[]): Promise<boolean> {
    const single = group.events.length === 1 ? group.events[0] : null;
    const title = single
      ? single.headline
      : `${group.events.length} CRM reminders need your attention`;
    const body = single
      ? single.detail
      : group.events.map((event) => `• ${event.detail}`).join("\n");
    const linkUrl = single ? single.linkUrl : "/crm/register";

    try {
      await this.notifications.create({ userId: group.userId, title, body, severity: "MEDIUM", linkUrl });
      return true;
    } catch (err) {
      const message = (err as Error).message;
      failures.push({
        stage: "notify",
        userId: group.userId,
        triggerKeys: group.events.map((event) => event.triggerKey),
        message
      });
      this.logger.warn(
        `crm-comms-reminders: notification for ${group.userId} failed (${message}) — ` +
          `${group.events.length} reminder(s) NOT logged, will retry next sweep.`
      );
      return false;
    }
  }

  /**
   * Write the `TenderReminderLog` row that stops this trigger firing again.
   *
   * `upsert` on the compound unique key with an empty `update` is deliberate:
   * if a row is already there (a concurrent sweep beat us to it) its `firedAt`
   * is left exactly as it was. No reminder state is ever overwritten or
   * deleted. A P2002 racing the upsert's own insert is the unique index doing
   * its job and is reported as `raced`, not as a failure.
   */
  private async record(
    event: ReminderEvent,
    today: Date,
    failures: ReminderSweepFailure[]
  ): Promise<"recorded" | "raced" | "failed"> {
    try {
      await this.prisma.tenderReminderLog.upsert({
        where: {
          subjectType_subjectId_triggerKey: {
            subjectType: event.subjectType,
            subjectId: event.subjectId,
            triggerKey: event.triggerKey
          }
        },
        update: {},
        create: {
          subjectType: event.subjectType,
          subjectId: event.subjectId,
          triggerKey: event.triggerKey,
          firedAt: today
        }
      });
      return "recorded";
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        this.logger.warn(
          `crm-comms-reminders: ${event.subjectType} ${event.subjectId} / ${event.triggerKey} ` +
            `was recorded by a concurrent sweep — not re-recorded.`
        );
        return "raced";
      }
      const message = (err as Error).message;
      failures.push({
        stage: "record",
        userId: event.userId,
        triggerKeys: [event.triggerKey],
        message
      });
      this.logger.warn(
        `crm-comms-reminders: failed to log ${event.subjectType} ${event.subjectId} / ` +
          `${event.triggerKey} (${message}) — the reminder was DELIVERED and may repeat next sweep.`
      );
      return "failed";
    }
  }
}
