// Mock-based unit tests for CommsReminderEscalationService (TR-3).
//
// Same house pattern as comms-reminder.service.spec.ts: Prisma is a plain
// object of jest.fn()s built per-test by `buildService`, the service is
// instantiated directly with `as never` casts, and the reference date is
// injected into `scanAndEscalate(today)` so nothing depends on the wall clock.
//
// The things these tests exist to prove:
//
//   1. "ACTIONED" IS HONOURED — a subject a human has since dealt with is not
//      escalated, by every one of the definitions CRM-S7/S8 gave the word
//      (terminal tender status, recorded outcome, a later logged_contact
//      thread, a closed CommTask, a later message on the task's thread).
//   2. AN ESCALATION NEVER ESCALATES ITSELF — `esc_`-prefixed log rows are
//      excluded in SQL *and* in memory.
//   3. IDEMPOTENCY — an existing `esc_<key>` log row stops a second notice.
//   4. A MISCONFIGURED INSTALLATION IS LOUD, NOT FATAL — no `crm.manage`
//      holders means a warning and a counted result, never a throw, and never
//      a log row that would suppress the retry.

import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CommsReminderEscalationService } from "../comms-reminder-escalation.service";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Tuesday. Every date below is chosen relative to this and stated in UTC. */
const TODAY = new Date(Date.UTC(2026, 8, 8)); // 2026-09-08 (Tue)

const utc = (y: number, m: number, d: number, h = 0) =>
  new Date(Date.UTC(y, m - 1, d, h));

const POLICY = {
  id: "trp-default",
  daysBefore: 7,
  dueDayOf: true,
  postSubmissionChaseDays: 14,
  postSubmissionCadenceDays: 14,
  escalationWindowDays: 3,
  watchIdleThresholds: {},
  rottingIdleThresholds: {},
  updatedAt: TODAY,
  updatedById: null
};

/** 2026-09-03 21:00 UTC — five days before TODAY, comfortably past the window. */
const FIRED_AT = utc(2026, 9, 3, 21);

const tenderLog = (overrides: Record<string, unknown> = {}) => ({
  subjectType: "Tender",
  subjectId: "tender-1",
  triggerKey: "pre_due_7",
  firedAt: FIRED_AT,
  ...overrides
});

const taskLog = (overrides: Record<string, unknown> = {}) => ({
  subjectType: "CommTask",
  subjectId: "task-1",
  triggerKey: "task_due",
  firedAt: FIRED_AT,
  ...overrides
});

const tender = (overrides: Record<string, unknown> = {}) => ({
  id: "tender-1",
  tenderNumber: "T260901-ACME-Rev1",
  title: "Acme demolition",
  status: "IN_PROGRESS",
  outcomes: [],
  ...overrides
});

const commTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Call the PM about the RFI",
  status: "OPEN",
  threadId: null,
  entityType: "TENDER",
  entityId: "tender-1",
  ...overrides
});

// ─── Builder ──────────────────────────────────────────────────────────────────

type Fixtures = {
  /** Rows the candidate query returns (already filtered by the DB, in real life). */
  candidateLogs?: Array<Record<string, unknown>>;
  /** Every row that exists for the candidate subjects — including `esc_` rows. */
  existingLogs?: Array<{ subjectType: string; subjectId: string; triggerKey: string }>;
  tenders?: unknown[];
  threads?: unknown[];
  tasks?: unknown[];
  messages?: unknown[];
  managers?: Array<{ id: string }>;
  policy?: Record<string, unknown>;
};

function buildService(fixtures: Fixtures = {}) {
  const {
    candidateLogs = [],
    existingLogs = [],
    tenders = [],
    threads = [],
    tasks = [],
    messages = [],
    managers = [{ id: "user-mgr-1" }],
    policy = POLICY
  } = fixtures;

  // `tenderReminderLog.findMany` is called twice per pass with different
  // shapes: once for the overdue candidates (a `firedAt` predicate), once for
  // the existing keys on those subjects (a `subjectId` predicate). Routing on
  // the WHERE clause rather than call ordering keeps the fixtures readable and
  // stops a reordered implementation from being handed the wrong rows.
  const reminderLogFindMany = jest.fn(async (args: { where?: Record<string, unknown> }) => {
    const where = args?.where ?? {};
    if (where.firedAt) return candidateLogs;
    return existingLogs.filter((row) => row.subjectType === where.subjectType);
  });

  const upserted: Array<{ subjectType: string; subjectId: string; triggerKey: string }> = [];
  const reminderLogUpsert = jest.fn(
    async (args: { create: { subjectType: string; subjectId: string; triggerKey: string } }) => {
      upserted.push({
        subjectType: args.create.subjectType,
        subjectId: args.create.subjectId,
        triggerKey: args.create.triggerKey
      });
      return args.create;
    }
  );

  const prisma = {
    tenderReminderLog: { findMany: reminderLogFindMany, upsert: reminderLogUpsert },
    tender: { findMany: jest.fn().mockResolvedValue(tenders) },
    commThread: { findMany: jest.fn().mockResolvedValue(threads) },
    commTask: { findMany: jest.fn().mockResolvedValue(tasks) },
    commMessage: { findMany: jest.fn().mockResolvedValue(messages) },
    user: { findMany: jest.fn().mockResolvedValue(managers) }
  };

  const notificationCreate = jest.fn().mockResolvedValue({ id: "notif-1" });
  const policyService = { getPolicy: jest.fn().mockResolvedValue(policy) };

  const service = new CommsReminderEscalationService(
    prisma as never,
    policyService as never,
    { create: notificationCreate } as never
  );

  return { service, prisma, notificationCreate, reminderLogUpsert, upserted, policyService };
}

// ─── Tender subject ───────────────────────────────────────────────────────────

describe("CommsReminderEscalationService — Tender subjects", () => {
  it("escalates an overdue tender reminder with no subsequent logged_contact thread", async () => {
    const { service, notificationCreate, upserted } = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(result.scanned).toBe(1);
    expect(result.escalated).toBe(1);
    expect(result.notified).toBe(1);
    expect(result.status).toBe("escalated");
    expect(result.managerPermission).toBe("crm.manage");
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-mgr-1",
        title: "Tender T260901-ACME-Rev1 — reminder unactioned (escalation)",
        severity: "HIGH",
        linkUrl: "/tenders/tender-1"
      })
    );
    // The age reported is the REAL age of the reminder (5 days), with the
    // configured window named alongside it — not the window restated as if it
    // were the age.
    const body = notificationCreate.mock.calls[0][0].body as string;
    expect(body).toContain("was sent 5 day(s) ago");
    expect(body).toContain("escalation window 3 day(s)");
    expect(upserted).toStrictEqual([
      { subjectType: "Tender", subjectId: "tender-1", triggerKey: "esc_pre_due_7" }
    ]);
  });

  it("does NOT escalate when a logged_contact thread was created after firedAt", async () => {
    const { service, notificationCreate, reminderLogUpsert } = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()],
      threads: [{ entityId: "tender-1", createdAt: utc(2026, 9, 5) }]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(reminderLogUpsert).not.toHaveBeenCalled();
    expect(result.suppressed.actioned).toBe(1);
    expect(result.escalated).toBe(0);
    // Ran, looked at a real candidate, it had been dealt with.
    expect(result.scanned).toBe(1);
    expect(result.status).toBe("clean");
  });

  it("still escalates when the only logged_contact thread predates firedAt", async () => {
    const { service, notificationCreate } = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()],
      threads: [{ entityId: "tender-1", createdAt: utc(2026, 9, 1) }]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(result.escalated).toBe(1);
  });

  it("does NOT escalate a tender that reached a terminal status or recorded an outcome", async () => {
    const terminal = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender({ status: "AWARDED" })]
    });
    const terminalResult = await terminal.service.scanAndEscalate(TODAY);
    expect(terminal.notificationCreate).not.toHaveBeenCalled();
    expect(terminalResult.suppressed.actioned).toBe(1);

    const outcome = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender({ outcomes: [{ id: "outcome-1" }] })]
    });
    const outcomeResult = await outcome.service.scanAndEscalate(TODAY);
    expect(outcome.notificationCreate).not.toHaveBeenCalled();
    expect(outcomeResult.suppressed.actioned).toBe(1);
  });

  it("counts a log row whose tender no longer exists as subject-missing, not actioned", async () => {
    const { service, notificationCreate } = buildService({
      candidateLogs: [tenderLog()],
      tenders: []
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(result.suppressed.subjectMissing).toBe(1);
    expect(result.suppressed.actioned).toBe(0);
  });
});

// ─── CommTask subject ─────────────────────────────────────────────────────────

describe("CommsReminderEscalationService — CommTask subjects", () => {
  it("escalates an overdue open task, linking at the anchor record", async () => {
    const { service, notificationCreate, upserted } = buildService({
      candidateLogs: [taskLog()],
      tasks: [commTask()]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(result.escalated).toBe(1);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-mgr-1",
        title: 'Follow-up "Call the PM about the RFI" — reminder unactioned (escalation)',
        severity: "HIGH",
        // The prompt's `/crm/tenders?tenderId=…` is not a route this app
        // mounts; a TENDER-anchored task resolves to the tender detail page.
        linkUrl: "/tenders/tender-1"
      })
    );
    expect(upserted).toStrictEqual([
      { subjectType: "CommTask", subjectId: "task-1", triggerKey: "esc_task_due" }
    ]);
  });

  it("does NOT escalate a task that is now DONE or CANCELLED", async () => {
    for (const status of ["DONE", "CANCELLED"]) {
      const { service, notificationCreate } = buildService({
        candidateLogs: [taskLog()],
        tasks: [commTask({ status })]
      });

      const result = await service.scanAndEscalate(TODAY);

      expect(notificationCreate).not.toHaveBeenCalled();
      expect(result.suppressed.actioned).toBe(1);
      expect(result.status).toBe("clean");
    }
  });

  it("does NOT escalate when a newer CommMessage exists on the task's thread", async () => {
    const { service, notificationCreate } = buildService({
      candidateLogs: [taskLog()],
      tasks: [commTask({ threadId: "thread-1" })],
      messages: [{ threadId: "thread-1", createdAt: utc(2026, 9, 6) }]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(result.suppressed.actioned).toBe(1);
  });

  it("still escalates when every message on the thread predates firedAt", async () => {
    const { service, notificationCreate } = buildService({
      candidateLogs: [taskLog()],
      tasks: [commTask({ threadId: "thread-1" })],
      messages: [{ threadId: "thread-1", createdAt: utc(2026, 9, 2) }]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(result.escalated).toBe(1);
  });

  it("routes an OPPORTUNITY-anchored task at the opportunity detail page", async () => {
    const { service, notificationCreate } = buildService({
      candidateLogs: [taskLog()],
      tasks: [commTask({ entityType: "OPPORTUNITY", entityId: "opp-9" })]
    });

    await service.scanAndEscalate(TODAY);

    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ linkUrl: "/crm/opportunities/opp-9" })
    );
  });
});

// ─── Idempotency and self-escalation ──────────────────────────────────────────

describe("CommsReminderEscalationService — idempotency", () => {
  it("does not re-notify when an esc_ log row already exists for the trigger key", async () => {
    const { service, notificationCreate, reminderLogUpsert } = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()],
      existingLogs: [
        { subjectType: "Tender", subjectId: "tender-1", triggerKey: "pre_due_7" },
        { subjectType: "Tender", subjectId: "tender-1", triggerKey: "esc_pre_due_7" }
      ]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(reminderLogUpsert).not.toHaveBeenCalled();
    expect(result.suppressed.alreadyEscalated).toBe(1);
    expect(result.escalated).toBe(0);
    expect(result.status).toBe("clean");
  });

  it("running the pass twice escalates exactly once — run 2 sees run 1's esc_ row", async () => {
    const first = buildService({ candidateLogs: [tenderLog()], tenders: [tender()] });
    await first.service.scanAndEscalate(TODAY);
    expect(first.notificationCreate).toHaveBeenCalledTimes(1);

    // The ONLY thing carried between runs is what run 1 wrote to the log.
    const second = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()],
      existingLogs: first.upserted
    });
    const secondResult = await second.service.scanAndEscalate(TODAY);

    expect(second.notificationCreate).not.toHaveBeenCalled();
    expect(secondResult.suppressed.alreadyEscalated).toBe(1);
    expect(secondResult.status).toBe("clean");
  });

  it("excludes esc_ rows in SQL and drops any that reach it anyway", async () => {
    const { service, prisma, notificationCreate } = buildService({
      // A row the SQL predicate should never have returned. If a provider
      // quirk ever lets one through, it must still not become esc_esc_*.
      candidateLogs: [tenderLog({ triggerKey: "esc_pre_due_7" })],
      tenders: [tender()]
    });

    const result = await service.scanAndEscalate(TODAY);

    const where = (prisma.tenderReminderLog.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.NOT).toStrictEqual({ triggerKey: { startsWith: "esc_" } });
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(result.suppressed.ownEscalation).toBe(1);
    expect(result.escalated).toBe(0);
  });

  it("never escalates the same (subject, trigger) twice inside one pass", async () => {
    const { service, notificationCreate, upserted } = buildService({
      candidateLogs: [tenderLog(), tenderLog()],
      tenders: [tender()]
    });

    await service.scanAndEscalate(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(upserted).toStrictEqual([
      { subjectType: "Tender", subjectId: "tender-1", triggerKey: "esc_pre_due_7" }
    ]);
  });

  it("treats a P2002 on the esc_ log write as the unique index doing its job", async () => {
    const { service, prisma, notificationCreate } = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()]
    });
    (prisma.tenderReminderLog.upsert as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test"
      })
    );

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(result.suppressed.racedOnUniqueIndex).toBe(1);
    expect(result.recorded).toBe(0);
    expect(result.failures).toStrictEqual([]);
    expect(result.status).toBe("escalated");
  });
});

// ─── Window, managers, failure handling ───────────────────────────────────────

describe("CommsReminderEscalationService — window and managers", () => {
  it("asks the database only for rows at least escalationWindowDays old", async () => {
    const { service, prisma } = buildService({ policy: { ...POLICY, escalationWindowDays: 4 } });

    const result = await service.scanAndEscalate(TODAY);

    const where = (prisma.tenderReminderLog.findMany as jest.Mock).mock.calls[0][0].where;
    // End of 2026-09-04, i.e. "fired four days ago" counts from any moment on
    // that calendar day — a midnight cutoff would add a silent fifth day.
    expect((where.firedAt.lte as Date).toISOString()).toBe("2026-09-04T23:59:59.999Z");
    expect(result.escalationWindowDays).toBe(4);
    expect(result.status).toBe("clean");
    expect(result.scanned).toBe(0);
  });

  it("notifies every manager who holds crm.manage, and queries by permission code", async () => {
    const { service, prisma, notificationCreate, upserted } = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()],
      managers: [{ id: "user-mgr-1" }, { id: "user-mgr-2" }]
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(2);
    expect(result.managers).toBe(2);
    expect(result.notified).toBe(2);
    // One subject escalated, one log row — not one row per manager.
    expect(result.escalated).toBe(1);
    expect(upserted).toHaveLength(1);

    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.userRoles.some.role.rolePermissions.some.permission.code).toBe("crm.manage");
  });

  it("warns and returns without throwing when no manager users are found", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { service, notificationCreate, reminderLogUpsert } = buildService({
      candidateLogs: [tenderLog()],
      tenders: [tender()],
      managers: []
    });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    // Nothing logged, so the next pass retries once a manager exists.
    expect(reminderLogUpsert).not.toHaveBeenCalled();
    expect(result.suppressed.noManagers).toBe(1);
    expect(result.managers).toBe(0);
    expect(result.failures).toStrictEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a failed send leaves NO log row, is recorded as a failure, and degrades the pass", async () => {
    const { service, notificationCreate, reminderLogUpsert, upserted } = buildService({
      candidateLogs: [tenderLog(), taskLog()],
      tenders: [tender()],
      tasks: [commTask()]
    });
    notificationCreate.mockRejectedValueOnce(new Error("notification channel down"));

    const result = await service.scanAndEscalate(TODAY);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toStrictEqual({
      stage: "notify",
      subjectType: "Tender",
      subjectId: "tender-1",
      triggerKey: "esc_pre_due_7",
      message: "notification channel down"
    });
    expect(result.status).toBe("degraded");
    // The failed subject wrote nothing; the other one still went out.
    expect(upserted).toStrictEqual([
      { subjectType: "CommTask", subjectId: "task-1", triggerKey: "esc_task_due" }
    ]);
    expect(reminderLogUpsert).toHaveBeenCalledTimes(1);
    expect(result.escalated).toBe(1);
  });

  it("is a no-op that still reports it ran when nothing is overdue", async () => {
    const { service, prisma, notificationCreate } = buildService({ candidateLogs: [] });

    const result = await service.scanAndEscalate(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(result.status).toBe("clean");
    expect(result.scanned).toBe(0);
    expect(result.ranAt).toBe(TODAY.toISOString());
    // No subject or manager lookups are issued when there is nothing to chase.
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.tender.findMany).not.toHaveBeenCalled();
  });

  it("summarise renders a one-line, greppable result", async () => {
    const { service } = buildService({ candidateLogs: [tenderLog()], tenders: [tender()] });

    const result = await service.scanAndEscalate(TODAY);

    expect(service.summarise(result)).toContain("crm-comms-reminder-escalation escalated");
    expect(service.summarise(result)).toContain("escalated 1 to 1 crm.manage holder(s)");
  });
});
