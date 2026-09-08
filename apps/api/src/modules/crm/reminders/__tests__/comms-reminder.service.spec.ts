// Mock-based unit tests for CommsReminderService (TR-2).
//
// Mirrors the house pattern in claim-draft-reminder.service.spec.ts: Prisma is
// a plain object of jest.fn()s built per-test by `buildService`, the service is
// instantiated directly with `as never` casts, and the reference date is
// injected into `scanAndNotify(today)` so nothing depends on the wall clock.
//
// The three things these tests exist to prove, beyond the per-track thresholds:
//
//   1. IDEMPOTENCY — running the sweep twice does not double-send, because the
//      second run sees the TenderReminderLog rows the first run wrote. Proven
//      end-to-end by feeding run 2 exactly the rows run 1 upserted.
//   2. A SWEEP THAT MATCHED NOTHING IS LOUD — `status: "clean"` plus non-zero
//      `scanned` counts, asserted with toStrictEqual over the whole result so
//      an added or renamed field cannot slip through (house fact: toEqual
//      treats an undefined property as absent).
//   3. NOTHING IS LOST — a notification that throws leaves NO log row, is
//      recorded in `failures`, flips the sweep to `degraded`, and does not
//      abort the rest of the sweep.

import { Prisma } from "@prisma/client";
import { CommsReminderService } from "../comms-reminder.service";
import type { ReminderSweepResult } from "../comms-reminder.types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Tuesday. Every date below is chosen relative to this and stated in UTC. */
const TODAY = new Date(Date.UTC(2026, 8, 8)); // 2026-09-08 (Tue)

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

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

const tender = (overrides: Record<string, unknown> = {}) => ({
  id: "tender-1",
  tenderNumber: "T260901-ACME-Rev1",
  title: "Acme demolition",
  dueDate: utc(2026, 9, 13), // Sunday, 5 calendar days out
  estimatorUserId: "user-est-1",
  submittedAt: null,
  ...overrides
});

const commTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Call the PM about the RFI",
  entityType: "TENDER",
  entityId: "tender-1",
  assigneeId: "user-assignee-1",
  dueAt: utc(2026, 9, 7),
  ...overrides
});

// ─── Builder ──────────────────────────────────────────────────────────────────

type Fixtures = {
  preDueTenders?: unknown[];
  submittedTenders?: unknown[];
  fallbackTenders?: unknown[];
  opportunities?: unknown[];
  threads?: unknown[];
  tasks?: unknown[];
  reminderLogs?: Array<{ subjectType: string; subjectId: string; triggerKey: string }>;
  policy?: Record<string, unknown>;
};

function buildService(fixtures: Fixtures = {}) {
  const {
    preDueTenders = [],
    submittedTenders = [],
    fallbackTenders = [],
    opportunities = [],
    threads = [],
    tasks = [],
    reminderLogs = [],
    policy = POLICY
  } = fixtures;

  // `tender.findMany` is called by three different call sites in one sweep.
  // Routing on the `where` clause (rather than mockResolvedValueOnce ordering)
  // keeps each test's fixtures readable and stops a reordered implementation
  // from silently handing a track the wrong rows.
  const tenderFindMany = jest.fn(async (args: { where?: Record<string, unknown> }) => {
    const where = args?.where ?? {};
    if (where.id) return fallbackTenders;
    if (where.status === "SUBMITTED") return submittedTenders;
    return preDueTenders;
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

  // The TASK track has no in-memory threshold — the WHERE clause IS the
  // threshold — so this mock applies the status/dueAt filter the database
  // would. A mock that returned every fixture regardless would make the track
  // untestable in the "nothing is due" direction.
  const commTaskFindMany = jest.fn(
    async (args: { where?: { status?: string; dueAt?: { lte?: Date } } }) => {
      const where = args?.where ?? {};
      return (tasks as Array<{ status?: string; dueAt: Date | null }>).filter((task) => {
        if (where.status && (task.status ?? "OPEN") !== where.status) return false;
        if (where.dueAt?.lte && (task.dueAt === null || task.dueAt > where.dueAt.lte)) return false;
        return true;
      });
    }
  );

  const prisma = {
    tender: { findMany: tenderFindMany },
    opportunity: { findMany: jest.fn().mockResolvedValue(opportunities) },
    commThread: { findMany: jest.fn().mockResolvedValue(threads) },
    commTask: { findMany: commTaskFindMany },
    tenderReminderLog: {
      findMany: jest.fn().mockResolvedValue(reminderLogs),
      upsert: reminderLogUpsert
    }
  };

  const notificationCreate = jest.fn().mockResolvedValue({ id: "notif-1" });
  const policyService = { getPolicy: jest.fn().mockResolvedValue(policy) };

  const service = new CommsReminderService(
    prisma as never,
    policyService as never,
    { create: notificationCreate } as never
  );

  return { service, prisma, notificationCreate, reminderLogUpsert, upserted, policyService };
}

/** Every trigger key the sweep wrote to the log, in order. */
const keysOf = (upserted: Array<{ triggerKey: string }>) => upserted.map((row) => row.triggerKey);

// ─── PRE-DUE track ────────────────────────────────────────────────────────────

describe("CommsReminderService — PRE-DUE track", () => {
  it("fires pre_due_7 for a tender due inside the window and not for one outside it", async () => {
    const { service, notificationCreate, upserted } = buildService({
      preDueTenders: [
        tender({ id: "tender-near", dueDate: utc(2026, 9, 13) }), // 5 days out
        tender({
          id: "tender-far",
          tenderNumber: "T260902-FAR-Rev1",
          dueDate: utc(2026, 9, 18), // 10 days out (a Friday — no adjustment)
          estimatorUserId: "user-est-2"
        })
      ]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(result.scanned.preDueCandidates).toBe(2);
    expect(result.triggered.preDue).toBe(1);
    expect(result.triggered.total).toBe(1);
    expect(result.status).toBe("fired");
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-est-1",
        title: "Quote due soon — T260901-ACME-Rev1",
        severity: "MEDIUM",
        linkUrl: "/tenders/tender-near"
      })
    );
    expect(upserted).toStrictEqual([
      { subjectType: "Tender", subjectId: "tender-near", triggerKey: "pre_due_7" }
    ]);
  });

  it("measures the window from the preceding workday when the due date is a weekend", async () => {
    const { service, notificationCreate } = buildService({
      // Sunday 2026-09-13 rolls back to Friday 2026-09-11 — 3 working-adjusted
      // days from Tuesday 2026-09-08, not the 5 raw calendar days.
      preDueTenders: [tender({ dueDate: utc(2026, 9, 13) })]
    });

    await service.scanAndNotify(TODAY);

    const body = notificationCreate.mock.calls[0][0].body as string;
    expect(body).toContain("2026-09-11");
    expect(body).toContain("3 working-adjusted day(s)");
  });

  it("adds pre_due_0 for an overdue tender only when policy.dueDayOf is on", async () => {
    const overdue = [tender({ dueDate: utc(2026, 9, 1) })]; // 7 days past

    const on = buildService({ preDueTenders: overdue });
    await on.service.scanAndNotify(TODAY);
    expect(keysOf(on.upserted)).toStrictEqual(["pre_due_7", "pre_due_0"]);

    const off = buildService({
      preDueTenders: overdue,
      policy: { ...POLICY, dueDayOf: false }
    });
    await off.service.scanAndNotify(TODAY);
    expect(keysOf(off.upserted)).toStrictEqual(["pre_due_7"]);
  });

  it("queries only the statuses where a quote is still being priced", async () => {
    const { service, prisma } = buildService({ preDueTenders: [] });

    await service.scanAndNotify(TODAY);

    const where = (prisma.tender.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toStrictEqual({ in: ["DRAFT", "IN_PROGRESS"] });
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe("CommsReminderService — idempotency", () => {
  it("does not re-notify when a TenderReminderLog row already exists for the trigger key", async () => {
    const { service, notificationCreate, reminderLogUpsert } = buildService({
      preDueTenders: [tender()],
      reminderLogs: [
        { subjectType: "Tender", subjectId: "tender-1", triggerKey: "pre_due_7" },
        { subjectType: "Tender", subjectId: "tender-1", triggerKey: "pre_due_0" }
      ]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(reminderLogUpsert).not.toHaveBeenCalled();
    expect(result.suppressed.alreadyLogged).toBe(1);
    expect(result.triggered.total).toBe(0);
    // Ran, looked at a real candidate, nothing was due.
    expect(result.scanned.preDueCandidates).toBe(1);
    expect(result.status).toBe("clean");
  });

  it("running the sweep twice sends exactly once — run 2 sees run 1's log rows", async () => {
    const first = buildService({ preDueTenders: [tender()] });
    const firstResult = await first.service.scanAndNotify(TODAY);

    expect(first.notificationCreate).toHaveBeenCalledTimes(1);
    expect(firstResult.triggered.total).toBe(1);

    // The ONLY thing carried between runs is what run 1 wrote to the log.
    const second = buildService({
      preDueTenders: [tender()],
      reminderLogs: first.upserted
    });
    const secondResult = await second.service.scanAndNotify(TODAY);

    expect(second.notificationCreate).not.toHaveBeenCalled();
    expect(secondResult.triggered.total).toBe(0);
    expect(secondResult.suppressed.alreadyLogged).toBe(1);
    expect(secondResult.status).toBe("clean");
  });

  it("treats a P2002 on the log write as the unique index doing its job, not a failure", async () => {
    const { service, prisma, notificationCreate } = buildService({
      preDueTenders: [tender()]
    });
    (prisma.tenderReminderLog.upsert as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test"
      })
    );

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(result.suppressed.racedOnUniqueIndex).toBe(1);
    expect(result.recorded).toBe(0);
    expect(result.failures).toStrictEqual([]);
    expect(result.status).toBe("fired");
  });

  it("never fires the same (subject, trigger) twice inside one sweep", async () => {
    // The same tender surfacing twice from the same query must still produce
    // one notification and one log row.
    const { service, notificationCreate, upserted } = buildService({
      preDueTenders: [tender(), tender()]
    });

    await service.scanAndNotify(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(upserted).toStrictEqual([
      { subjectType: "Tender", subjectId: "tender-1", triggerKey: "pre_due_7" }
    ]);
  });
});

// ─── POST-SUBMISSION track ────────────────────────────────────────────────────

describe("CommsReminderService — POST-SUBMISSION track", () => {
  it("chases a tender submitted 20 days ago with no outcome and no logged contact", async () => {
    const { service, notificationCreate, upserted } = buildService({
      submittedTenders: [
        tender({ id: "tender-sub", submittedAt: utc(2026, 8, 19), dueDate: null })
      ]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(result.scanned.postSubmissionCandidates).toBe(1);
    expect(result.triggered.postSubmission).toBe(1);
    expect(upserted).toStrictEqual([
      { subjectType: "Tender", subjectId: "tender-sub", triggerKey: "post_sub_14" }
    ]);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Chase submitted tender — T260901-ACME-Rev1" })
    );
  });

  it("does not chase when a logged_contact thread was created inside the cadence window", async () => {
    const { service, notificationCreate, reminderLogUpsert } = buildService({
      submittedTenders: [
        tender({ id: "tender-sub", submittedAt: utc(2026, 8, 19), dueDate: null })
      ],
      threads: [{ entityId: "tender-sub", createdAt: utc(2026, 9, 5) }] // 3 days ago
    });

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(reminderLogUpsert).not.toHaveBeenCalled();
    expect(result.triggered.postSubmission).toBe(0);
    // Ran, considered a real submitted tender, decided a human was on it.
    expect(result.scanned.postSubmissionCandidates).toBe(1);
    expect(result.status).toBe("clean");
  });

  it("does not chase before postSubmissionChaseDays has elapsed", async () => {
    const { service, notificationCreate } = buildService({
      submittedTenders: [
        tender({ id: "tender-sub", submittedAt: utc(2026, 9, 1), dueDate: null }) // 7 days
      ]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(result.triggered.postSubmission).toBe(0);
    // The scanned count is asserted alongside the negative: a test that only
    // checks "nothing fired" also passes against a service that does nothing.
    expect(result.scanned.postSubmissionCandidates).toBe(1);
  });

  it("buckets the trigger key by cadence so a later chase gets its own key", async () => {
    const { service, upserted } = buildService({
      submittedTenders: [
        tender({ id: "tender-sub", submittedAt: utc(2026, 8, 5), dueDate: null }) // 34 days
      ]
    });

    await service.scanAndNotify(TODAY);

    expect(keysOf(upserted)).toStrictEqual(["post_sub_28"]);
  });

  it("scans logged_contact threads by createdAt, not updatedAt", async () => {
    const { service, prisma } = buildService({
      submittedTenders: [
        tender({ id: "tender-sub", submittedAt: utc(2026, 8, 19), dueDate: null })
      ]
    });

    await service.scanAndNotify(TODAY);

    const where = (prisma.commThread.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.kind).toBe("logged_contact");
    expect(where.entityType).toBe("TENDER");
    expect(Object.keys(where)).toContain("createdAt");
    expect(Object.keys(where)).not.toContain("updatedAt");
    expect(where.createdAt.gte).toStrictEqual(utc(2026, 8, 25)); // today − 14 days
  });
});

// ─── TASK track ───────────────────────────────────────────────────────────────

describe("CommsReminderService — TASK track", () => {
  it("fires task_due to the assignee of an overdue open task", async () => {
    const { service, notificationCreate, upserted } = buildService({
      tasks: [commTask()]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(result.scanned.openTasks).toBe(1);
    expect(result.triggered.task).toBe(1);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-assignee-1",
        title: "Follow-up due — Call the PM about the RFI",
        linkUrl: "/crm/register"
      })
    );
    expect(upserted).toStrictEqual([
      { subjectType: "CommTask", subjectId: "task-1", triggerKey: "task_due" }
    ]);
  });

  it("falls back to the tender estimator when the task has no assignee", async () => {
    const { service, notificationCreate } = buildService({
      tasks: [commTask({ assigneeId: null })],
      fallbackTenders: [{ id: "tender-1", estimatorUserId: "user-est-1" }]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(result.suppressed.noRecipient).toBe(0);
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-est-1" })
    );
  });

  it("falls back to the opportunity owner for an OPPORTUNITY task", async () => {
    const { service, notificationCreate } = buildService({
      tasks: [
        commTask({ assigneeId: null, entityType: "OPPORTUNITY", entityId: "opp-1" })
      ],
      opportunities: [{ id: "opp-1", ownerId: "user-owner-1" }]
    });

    await service.scanAndNotify(TODAY);

    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-owner-1" })
    );
  });

  it("skips with a warning — no throw, no log row — when no user can be resolved", async () => {
    const { service, notificationCreate, reminderLogUpsert } = buildService({
      tasks: [
        commTask({ assigneeId: null, entityType: "ACCOUNT", entityId: "account-1" })
      ]
    });
    const loggerWarn = jest
      .spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, "warn")
      .mockImplementation(() => undefined);

    const result = await service.scanAndNotify(TODAY);

    expect(result.suppressed.noRecipient).toBe(1);
    expect(result.triggered.task).toBe(0);
    expect(result.status).toBe("clean");
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(reminderLogUpsert).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(loggerWarn.mock.calls[0][0]).toContain("resolves to no user");
    loggerWarn.mockRestore();
  });

  it("bounds the task scan by dueAt within policy.daysBefore, and only OPEN tasks", async () => {
    const { service, prisma } = buildService({ tasks: [] });

    await service.scanAndNotify(TODAY);

    const where = (prisma.commTask.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe("OPEN");
    expect(where.dueAt.not).toBeNull();
    // End of 2026-09-15 = today + daysBefore(7).
    expect(where.dueAt.lte).toStrictEqual(new Date(Date.UTC(2026, 8, 15, 23, 59, 59, 999)));
  });
});

// ─── Digest ───────────────────────────────────────────────────────────────────

describe("CommsReminderService — digest", () => {
  it("folds several triggers for one user into a single notification", async () => {
    const { service, notificationCreate, upserted } = buildService({
      preDueTenders: [tender({ id: "tender-a", dueDate: utc(2026, 9, 13) })],
      submittedTenders: [
        tender({
          id: "tender-b",
          tenderNumber: "T260902-BETA-Rev1",
          submittedAt: utc(2026, 8, 19),
          dueDate: null
        })
      ],
      tasks: [commTask({ assigneeId: "user-est-1" })]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(result.triggered.total).toBe(3);
    expect(result.notified).toStrictEqual({ digests: 1, recipients: 1 });
    expect(notificationCreate).toHaveBeenCalledTimes(1);

    const payload = notificationCreate.mock.calls[0][0];
    expect(payload.userId).toBe("user-est-1");
    expect(payload.title).toBe("3 CRM reminders need your attention");
    expect((payload.body as string).split("\n")).toHaveLength(3);
    // Every event is still logged individually — the digest is a delivery
    // optimisation, not a coarsening of the idempotency key.
    expect(upserted).toHaveLength(3);
    expect(keysOf(upserted)).toStrictEqual(["pre_due_7", "post_sub_14", "task_due"]);
  });

  it("gives two different users two notifications", async () => {
    const { service, notificationCreate } = buildService({
      preDueTenders: [
        tender({ id: "tender-a", dueDate: utc(2026, 9, 13), estimatorUserId: "user-1" }),
        tender({ id: "tender-b", dueDate: utc(2026, 9, 13), estimatorUserId: "user-2" })
      ]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(2);
    expect(result.notified).toStrictEqual({ digests: 2, recipients: 2 });
  });
});

// ─── A sweep that matched nothing vs a sweep that did not run ─────────────────

describe("CommsReminderService — sweep observability", () => {
  it("reports a fully-populated 'clean' result when nothing was due", async () => {
    const { service, notificationCreate } = buildService({
      // Real rows, none of them due: the counts prove the queries ran.
      preDueTenders: [tender({ dueDate: utc(2026, 9, 18) })], // 10 days out
      submittedTenders: [
        tender({ id: "tender-sub", submittedAt: utc(2026, 9, 1), dueDate: null }) // 7 days
      ],
      // Outside the 7-day horizon: the query drops it, so `openTasks` is 0
      // while the other two tracks show they had real rows to weigh.
      tasks: [commTask({ dueAt: utc(2026, 9, 30) })]
    });

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).not.toHaveBeenCalled();
    // toStrictEqual, not toEqual: an added or renamed field must break this.
    const expected: ReminderSweepResult = {
      ranAt: "2026-09-08T00:00:00.000Z",
      status: "clean",
      policy: {
        daysBefore: 7,
        dueDayOf: true,
        postSubmissionChaseDays: 14,
        postSubmissionCadenceDays: 14
      },
      scanned: { preDueCandidates: 1, postSubmissionCandidates: 1, openTasks: 0 },
      triggered: { preDue: 0, postSubmission: 0, task: 0, total: 0 },
      suppressed: { alreadyLogged: 0, noRecipient: 0, racedOnUniqueIndex: 0 },
      notified: { digests: 0, recipients: 0 },
      recorded: 0,
      failures: []
    };
    expect(result).toStrictEqual(expected);
  });

  it("still returns a result — never undefined — when every table is empty", async () => {
    const { service } = buildService();

    const result = await service.scanAndNotify(TODAY);

    expect(result.status).toBe("clean");
    expect(result.scanned).toStrictEqual({
      preDueCandidates: 0,
      postSubmissionCandidates: 0,
      openTasks: 0
    });
    // An empty sweep is reported as such rather than being indistinguishable
    // from a cron that never fired — the summary line is what says so.
    expect(service.summarise(result)).toContain("crm-comms-reminders clean");
    expect(service.summarise(result)).toContain("scanned 0 pre-due / 0 submitted / 0 tasks");
  });

  it("summarises a firing sweep with its per-track counts", async () => {
    const { service } = buildService({ preDueTenders: [tender()] });

    const line = service.summarise(await service.scanAndNotify(TODAY));

    expect(line).toContain("crm-comms-reminders fired");
    expect(line).toContain("triggered 1 (pre-due 1, post-sub 0, task 0)");
    expect(line).toContain("recorded 1");
    expect(line).toContain("failures 0");
  });
});

// ─── Failure handling: recorded, not lost ─────────────────────────────────────

describe("CommsReminderService — failures are recorded, not lost", () => {
  it("writes no log row when the notification throws, so the next sweep retries", async () => {
    const { service, notificationCreate, reminderLogUpsert } = buildService({
      preDueTenders: [tender()]
    });
    notificationCreate.mockRejectedValueOnce(new Error("notification backend down"));
    const loggerWarn = jest
      .spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, "warn")
      .mockImplementation(() => undefined);

    const result = await service.scanAndNotify(TODAY);

    expect(reminderLogUpsert).not.toHaveBeenCalled();
    expect(result.recorded).toBe(0);
    expect(result.status).toBe("degraded");
    expect(result.failures).toStrictEqual([
      {
        stage: "notify",
        userId: "user-est-1",
        triggerKeys: ["pre_due_7"],
        message: "notification backend down"
      }
    ]);
    loggerWarn.mockRestore();
  });

  it("one failing recipient does not stop the sweep for the others", async () => {
    const { service, notificationCreate, upserted } = buildService({
      preDueTenders: [
        tender({ id: "tender-a", dueDate: utc(2026, 9, 13), estimatorUserId: "user-1" }),
        tender({ id: "tender-b", dueDate: utc(2026, 9, 13), estimatorUserId: "user-2" })
      ]
    });
    notificationCreate.mockRejectedValueOnce(new Error("first recipient blew up"));
    const loggerWarn = jest
      .spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, "warn")
      .mockImplementation(() => undefined);

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(2);
    expect(result.failures).toHaveLength(1);
    expect(result.status).toBe("degraded");
    // The surviving recipient's reminder was still delivered AND recorded.
    expect(upserted).toStrictEqual([
      { subjectType: "Tender", subjectId: "tender-b", triggerKey: "pre_due_7" }
    ]);
  });

  it("records a non-P2002 log-write failure without throwing", async () => {
    const { service, prisma, notificationCreate } = buildService({
      preDueTenders: [tender()]
    });
    (prisma.tenderReminderLog.upsert as jest.Mock).mockRejectedValueOnce(
      new Error("connection reset")
    );
    const loggerWarn = jest
      .spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, "warn")
      .mockImplementation(() => undefined);

    const result = await service.scanAndNotify(TODAY);

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("degraded");
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].stage).toBe("record");
    loggerWarn.mockRestore();
  });
});

// ─── Cron wrapper ─────────────────────────────────────────────────────────────

describe("CommsReminderService.runCommsReminders", () => {
  it("logs the sweep summary on success", async () => {
    const { service } = buildService({ preDueTenders: [] });
    const loggerLog = jest
      .spyOn((service as unknown as { logger: { log: (m: string) => void } }).logger, "log")
      .mockImplementation(() => undefined);

    await service.runCommsReminders();

    expect(loggerLog).toHaveBeenCalledTimes(1);
    expect(loggerLog.mock.calls[0][0]).toContain("crm-comms-reminders clean");
    loggerLog.mockRestore();
  });

  it("swallows a scan failure into a warning rather than crashing the scheduler", async () => {
    const { service, policyService } = buildService();
    policyService.getPolicy.mockRejectedValueOnce(new Error("policy table unreachable"));
    const loggerWarn = jest
      .spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, "warn")
      .mockImplementation(() => undefined);

    await expect(service.runCommsReminders()).resolves.toBeUndefined();

    expect(loggerWarn).toHaveBeenCalledWith(
      "crm-comms-reminders failed: policy table unreachable"
    );
    loggerWarn.mockRestore();
  });
});
