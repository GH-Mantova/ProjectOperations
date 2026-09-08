import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_REMINDER_POLICY,
  DEFAULT_ROTTING_IDLE_THRESHOLDS,
  DEFAULT_WATCH_IDLE_THRESHOLDS,
  REMINDER_POLICY_SINGLETON_ID,
  ReminderPolicyService,
  TENDERING_STAGE_KEYS
} from "../reminder-policy.service";

// ── Mock Prisma / Audit ───────────────────────────────────────────────────────
// Mirrors the mock-Prisma pattern in crm/comms/__tests__/comms.service.spec.ts.

type MockPrisma = {
  tenderReminderPolicy: {
    findFirst: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
  };
};

type MockAudit = { write: jest.Mock };

function makePrisma(): MockPrisma {
  return {
    tenderReminderPolicy: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      update: jest.fn()
    }
  };
}

function makeAudit(): MockAudit {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

function makeService(prisma: MockPrisma, audit: MockAudit) {
  return new ReminderPolicyService(prisma as never, audit as never);
}

const POLICY_STUB = {
  id: REMINDER_POLICY_SINGLETON_ID,
  daysBefore: 7,
  dueDayOf: true,
  postSubmissionChaseDays: 14,
  postSubmissionCadenceDays: 14,
  watchIdleThresholds: DEFAULT_WATCH_IDLE_THRESHOLDS,
  rottingIdleThresholds: DEFAULT_ROTTING_IDLE_THRESHOLDS,
  escalationWindowDays: 3,
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedById: null
};

// ── Defaults ─────────────────────────────────────────────────────────────────

describe("ReminderPolicyService defaults", () => {
  it("seeds the exact per-stage thresholds currently hardcoded in the web helper", () => {
    // These literals are the contract with
    // apps/web/src/pages/tendering-page-helpers.ts `stageIdleThresholds`.
    // If someone edits one side, this test is the thing that notices.
    expect(DEFAULT_WATCH_IDLE_THRESHOLDS).toStrictEqual({
      DRAFT: 3,
      IN_PROGRESS: 4,
      SUBMITTED: 2,
      AWARDED: 3,
      CONTRACT_ISSUED: 5,
      CONVERTED: 999
    });
    expect(DEFAULT_ROTTING_IDLE_THRESHOLDS).toStrictEqual({
      DRAFT: 7,
      IN_PROGRESS: 8,
      SUBMITTED: 5,
      AWARDED: 6,
      CONTRACT_ISSUED: 10,
      CONVERTED: 999
    });
  });

  it("covers every tendering stage key in both threshold maps", () => {
    for (const key of TENDERING_STAGE_KEYS) {
      expect(Object.keys(DEFAULT_WATCH_IDLE_THRESHOLDS)).toContain(key);
      expect(Object.keys(DEFAULT_ROTTING_IDLE_THRESHOLDS)).toContain(key);
    }
    expect(Object.keys(DEFAULT_WATCH_IDLE_THRESHOLDS)).toHaveLength(TENDERING_STAGE_KEYS.length);
    expect(Object.keys(DEFAULT_ROTTING_IDLE_THRESHOLDS)).toHaveLength(TENDERING_STAGE_KEYS.length);
  });
});

// ── getPolicy ────────────────────────────────────────────────────────────────

describe("ReminderPolicyService.getPolicy", () => {
  it("returns the existing row when one exists and does not create another", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);

    const result = await makeService(prisma, audit).getPolicy();

    expect(result).toStrictEqual(POLICY_STUB);
    expect(prisma.tenderReminderPolicy.upsert).not.toHaveBeenCalled();
  });

  it("creates and returns the default row when none exists", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(null);
    prisma.tenderReminderPolicy.upsert.mockResolvedValue(POLICY_STUB);

    const result = await makeService(prisma, audit).getPolicy();

    expect(result).toStrictEqual(POLICY_STUB);
    expect(prisma.tenderReminderPolicy.upsert).toHaveBeenCalledTimes(1);

    const args = prisma.tenderReminderPolicy.upsert.mock.calls[0][0];
    expect(args.where).toStrictEqual({ id: REMINDER_POLICY_SINGLETON_ID });
    // update: {} — a concurrent first-read must never overwrite a row that
    // an admin has already tuned.
    expect(args.update).toStrictEqual({});
    expect(args.create).toStrictEqual({
      id: REMINDER_POLICY_SINGLETON_ID,
      daysBefore: DEFAULT_REMINDER_POLICY.daysBefore,
      dueDayOf: DEFAULT_REMINDER_POLICY.dueDayOf,
      postSubmissionChaseDays: DEFAULT_REMINDER_POLICY.postSubmissionChaseDays,
      postSubmissionCadenceDays: DEFAULT_REMINDER_POLICY.postSubmissionCadenceDays,
      escalationWindowDays: DEFAULT_REMINDER_POLICY.escalationWindowDays,
      watchIdleThresholds: DEFAULT_WATCH_IDLE_THRESHOLDS,
      rottingIdleThresholds: DEFAULT_ROTTING_IDLE_THRESHOLDS
    });
  });

  it("re-reads instead of throwing when a concurrent create wins the race (P2002)", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(POLICY_STUB);
    prisma.tenderReminderPolicy.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test"
      })
    );

    const result = await makeService(prisma, audit).getPolicy();

    expect(result).toStrictEqual(POLICY_STUB);
    expect(prisma.tenderReminderPolicy.findFirst).toHaveBeenCalledTimes(2);
  });
});

// ── updatePolicy ─────────────────────────────────────────────────────────────

describe("ReminderPolicyService.updatePolicy", () => {
  it("updates the row and writes an audit entry naming what changed", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);
    prisma.tenderReminderPolicy.update.mockResolvedValue({ ...POLICY_STUB, daysBefore: 10 });

    const result = await makeService(prisma, audit).updatePolicy({ daysBefore: 10 }, "user-1");

    expect(result.daysBefore).toBe(10);
    expect(prisma.tenderReminderPolicy.update).toHaveBeenCalledTimes(1);

    const updateArgs = prisma.tenderReminderPolicy.update.mock.calls[0][0];
    expect(updateArgs.where).toStrictEqual({ id: REMINDER_POLICY_SINGLETON_ID });
    expect(updateArgs.data).toStrictEqual({
      daysBefore: 10,
      updatedBy: { connect: { id: "user-1" } }
    });

    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "crm.reminderPolicy.update",
      entityType: "TenderReminderPolicy",
      entityId: REMINDER_POLICY_SINGLETON_ID,
      metadata: { changed: { daysBefore: { from: 7, to: 10 } } }
    });
  });

  it("writes only the supplied fields — an omitted timing keeps its stored value", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);
    prisma.tenderReminderPolicy.update.mockResolvedValue(POLICY_STUB);

    await makeService(prisma, audit).updatePolicy({ dueDayOf: false }, "user-1");

    const updateArgs = prisma.tenderReminderPolicy.update.mock.calls[0][0];
    expect(Object.keys(updateArgs.data).sort()).toStrictEqual(["dueDayOf", "updatedBy"]);
    expect(updateArgs.data.dueDayOf).toBe(false);
  });

  it("creates the default row first when updating an installation that has none", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(null);
    prisma.tenderReminderPolicy.upsert.mockResolvedValue(POLICY_STUB);
    prisma.tenderReminderPolicy.update.mockResolvedValue({ ...POLICY_STUB, daysBefore: 5 });

    await makeService(prisma, audit).updatePolicy({ daysBefore: 5 }, "user-1");

    expect(prisma.tenderReminderPolicy.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.tenderReminderPolicy.update).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 1.5, "7", null])(
    "rejects a non-positive-integer numeric field (%p) without touching the row",
    async (bad) => {
      const prisma = makePrisma();
      const audit = makeAudit();
      prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);

      await expect(
        makeService(prisma, audit).updatePolicy({ daysBefore: bad as never }, "user-1")
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.tenderReminderPolicy.update).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    }
  );

  it("rejects a threshold object that is missing a tendering stage key", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);

    const partial = { ...DEFAULT_WATCH_IDLE_THRESHOLDS } as Record<string, number>;
    delete partial.CONVERTED;

    await expect(
      makeService(prisma, audit).updatePolicy({ watchIdleThresholds: partial }, "user-1")
    ).rejects.toThrow(/CONVERTED/);

    expect(prisma.tenderReminderPolicy.update).not.toHaveBeenCalled();
  });

  it("rejects a threshold object carrying an unknown stage key", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);

    await expect(
      makeService(prisma, audit).updatePolicy(
        { rottingIdleThresholds: { ...DEFAULT_ROTTING_IDLE_THRESHOLDS, LOST: 4 } },
        "user-1"
      )
    ).rejects.toThrow(/LOST/);

    expect(prisma.tenderReminderPolicy.update).not.toHaveBeenCalled();
  });

  it("accepts a complete six-key threshold object", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);
    prisma.tenderReminderPolicy.update.mockResolvedValue(POLICY_STUB);

    const next = { ...DEFAULT_WATCH_IDLE_THRESHOLDS, DRAFT: 9 };
    await makeService(prisma, audit).updatePolicy({ watchIdleThresholds: next }, "user-1");

    const updateArgs = prisma.tenderReminderPolicy.update.mock.calls[0][0];
    expect(updateArgs.data.watchIdleThresholds).toStrictEqual(next);
  });

  it("rejects an empty payload rather than writing a no-op audit entry", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.tenderReminderPolicy.findFirst.mockResolvedValue(POLICY_STUB);

    await expect(makeService(prisma, audit).updatePolicy({}, "user-1")).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(prisma.tenderReminderPolicy.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
});
