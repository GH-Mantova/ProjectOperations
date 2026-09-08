import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, type TenderReminderPolicy } from "@prisma/client";
import { AuditService } from "../../audit/audit.service";
import { PrismaService } from "../../../prisma/prisma.service";

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * TR-1: fixed id for the singleton policy row.
 *
 * Both the seed (`apps/api/prisma/seed.ts`) and the lazy create in
 * {@link ReminderPolicyService.getPolicy} use this id, so a seeded dev database
 * and a production database that only ever ran `prisma migrate deploy` end up
 * with the SAME row rather than two competing "singletons".
 */
export const REMINDER_POLICY_SINGLETON_ID = "trp-default";

/**
 * The six tendering stages the idle-threshold JSON objects are keyed by.
 *
 * There is no `TenderingStage` enum in the Prisma schema — the type is a
 * TypeScript union in `apps/web/src/pages/tendering-page-helpers.ts`. This
 * literal list mirrors it, and is the thing `updatePolicy` validates against so
 * a partial threshold object can never be stored.
 */
export const TENDERING_STAGE_KEYS = [
  "DRAFT",
  "IN_PROGRESS",
  "SUBMITTED",
  "AWARDED",
  "CONTRACT_ISSUED",
  "CONVERTED"
] as const;

export type TenderingStageKey = (typeof TENDERING_STAGE_KEYS)[number];

export type StageThresholds = Record<TenderingStageKey, number>;

/**
 * Seed values for `watchIdleThresholds` — identical to the `watch` half of
 * `stageIdleThresholds` in `apps/web/src/pages/tendering-page-helpers.ts`.
 *
 * NOTE (TR-1 §8): nothing reads these yet. They are carried on the policy row
 * so a later slice can wire the Tendering attention state to admin-editable
 * config without a second migration. The web helper is deliberately NOT
 * changed in this slice.
 */
export const DEFAULT_WATCH_IDLE_THRESHOLDS: StageThresholds = {
  DRAFT: 3,
  IN_PROGRESS: 4,
  SUBMITTED: 2,
  AWARDED: 3,
  CONTRACT_ISSUED: 5,
  CONVERTED: 999
};

/** Seed values for `rottingIdleThresholds` — the `rotting` half of the same map. */
export const DEFAULT_ROTTING_IDLE_THRESHOLDS: StageThresholds = {
  DRAFT: 7,
  IN_PROGRESS: 8,
  SUBMITTED: 5,
  AWARDED: 6,
  CONTRACT_ISSUED: 10,
  CONVERTED: 999
};

/**
 * Default policy values. These match the `@default(...)` values on
 * `model TenderReminderPolicy`, and are what the seed writes, so "the seeded
 * default" and "the lazily-created default" are the same row content.
 */
export const DEFAULT_REMINDER_POLICY = {
  daysBefore: 7,
  dueDayOf: true,
  postSubmissionChaseDays: 14,
  postSubmissionCadenceDays: 14,
  escalationWindowDays: 3,
  watchIdleThresholds: DEFAULT_WATCH_IDLE_THRESHOLDS,
  rottingIdleThresholds: DEFAULT_ROTTING_IDLE_THRESHOLDS
} as const;

/** The numeric policy fields, all of which must be positive integers. */
const NUMERIC_POLICY_FIELDS = [
  "daysBefore",
  "postSubmissionChaseDays",
  "postSubmissionCadenceDays",
  "escalationWindowDays"
] as const;

type NumericPolicyField = (typeof NUMERIC_POLICY_FIELDS)[number];

// ── Types ────────────────────────────────────────────────────────────────────

export type UpdateReminderPolicyInput = Partial<{
  daysBefore: number;
  dueDayOf: boolean;
  postSubmissionChaseDays: number;
  postSubmissionCadenceDays: number;
  escalationWindowDays: number;
  watchIdleThresholds: Record<string, unknown>;
  rottingIdleThresholds: Record<string, unknown>;
}>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertPositiveInteger(field: NumericPolicyField, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new BadRequestException(
      `${field} must be a positive integer (received ${JSON.stringify(value)}).`
    );
  }
  return value;
}

/**
 * A threshold object is only valid if it carries ALL six stage keys with
 * positive-integer day counts and nothing else. A partially-specified object
 * would leave the cron reading `undefined` for a stage at runtime, which is
 * exactly the silent failure this validation exists to prevent.
 */
function assertStageThresholds(field: string, value: unknown): StageThresholds {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object keyed by tendering stage.`);
  }

  const record = value as Record<string, unknown>;
  const missing = TENDERING_STAGE_KEYS.filter((key) => !(key in record));
  if (missing.length > 0) {
    throw new BadRequestException(
      `${field} is missing required stage key(s): ${missing.join(", ")}.`
    );
  }

  const unknownKeys = Object.keys(record).filter(
    (key) => !(TENDERING_STAGE_KEYS as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `${field} has unknown stage key(s): ${unknownKeys.join(", ")}.`
    );
  }

  const result = {} as StageThresholds;
  for (const key of TENDERING_STAGE_KEYS) {
    const dayCount = record[key];
    if (typeof dayCount !== "number" || !Number.isInteger(dayCount) || dayCount < 1) {
      throw new BadRequestException(
        `${field}.${key} must be a positive integer (received ${JSON.stringify(dayCount)}).`
      );
    }
    result[key] = dayCount;
  }
  return result;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * TR-1: read/write surface for the singleton `TenderReminderPolicy` row.
 *
 * This is the primary artifact of the slice — TR-2's cron calls `getPolicy()`
 * to learn its timings, and TR-3's escalation pass reads
 * `escalationWindowDays` from the same row.
 *
 * CRM surface (TR_SCOPE_CRM): this lives under `modules/crm/reminders/`, a
 * sibling of `modules/crm/comms/`. It deliberately does not live in `comms/`
 * — reminders cron over `CommTask`, they do not create threads.
 */
@Injectable()
export class ReminderPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Return the installation's reminder policy, creating the default row on
   * first read if none exists.
   *
   * The lazy create is NOT decoration. `prisma migrate deploy` runs on
   * production without the seed, so production starts with an empty
   * `tender_reminder_policy` table; without this, TR-2's cron would find no
   * policy and either crash or silently skip every tick.
   *
   * Race safety: the create is an upsert on the fixed singleton id, and a
   * concurrent-insert unique violation (P2002) is caught and resolved by
   * re-reading, so two simultaneous first-reads cannot 500 or produce two rows.
   */
  async getPolicy(): Promise<TenderReminderPolicy> {
    const existing = await this.prisma.tenderReminderPolicy.findFirst({
      orderBy: { updatedAt: "asc" }
    });
    if (existing) return existing;

    try {
      return await this.prisma.tenderReminderPolicy.upsert({
        where: { id: REMINDER_POLICY_SINGLETON_ID },
        update: {},
        create: {
          id: REMINDER_POLICY_SINGLETON_ID,
          daysBefore: DEFAULT_REMINDER_POLICY.daysBefore,
          dueDayOf: DEFAULT_REMINDER_POLICY.dueDayOf,
          postSubmissionChaseDays: DEFAULT_REMINDER_POLICY.postSubmissionChaseDays,
          postSubmissionCadenceDays: DEFAULT_REMINDER_POLICY.postSubmissionCadenceDays,
          escalationWindowDays: DEFAULT_REMINDER_POLICY.escalationWindowDays,
          watchIdleThresholds: DEFAULT_REMINDER_POLICY.watchIdleThresholds,
          rottingIdleThresholds: DEFAULT_REMINDER_POLICY.rottingIdleThresholds
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const raced = await this.prisma.tenderReminderPolicy.findFirst({
          orderBy: { updatedAt: "asc" }
        });
        if (raced) return raced;
      }
      throw err;
    }
  }

  /**
   * Update the singleton policy and record who changed it.
   *
   * Only the fields present on the input are written — an omitted field keeps
   * its stored value, so a partial PUT can never silently reset a timing to a
   * default. Every accepted call writes an `AuditLog` entry carrying the
   * before/after of the fields that actually changed.
   */
  async updatePolicy(
    input: UpdateReminderPolicyInput,
    actorId: string
  ): Promise<TenderReminderPolicy> {
    const current = await this.getPolicy();
    const data: Prisma.TenderReminderPolicyUpdateInput = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    for (const field of NUMERIC_POLICY_FIELDS) {
      if (input[field] === undefined) continue;
      const value = assertPositiveInteger(field, input[field]);
      data[field] = value;
      if (current[field] !== value) changed[field] = { from: current[field], to: value };
    }

    if (input.dueDayOf !== undefined) {
      if (typeof input.dueDayOf !== "boolean") {
        throw new BadRequestException("dueDayOf must be a boolean.");
      }
      data.dueDayOf = input.dueDayOf;
      if (current.dueDayOf !== input.dueDayOf) {
        changed.dueDayOf = { from: current.dueDayOf, to: input.dueDayOf };
      }
    }

    if (input.watchIdleThresholds !== undefined) {
      const thresholds = assertStageThresholds("watchIdleThresholds", input.watchIdleThresholds);
      data.watchIdleThresholds = thresholds;
      changed.watchIdleThresholds = { from: current.watchIdleThresholds, to: thresholds };
    }

    if (input.rottingIdleThresholds !== undefined) {
      const thresholds = assertStageThresholds(
        "rottingIdleThresholds",
        input.rottingIdleThresholds
      );
      data.rottingIdleThresholds = thresholds;
      changed.rottingIdleThresholds = { from: current.rottingIdleThresholds, to: thresholds };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("No updatable reminder-policy fields supplied.");
    }

    data.updatedBy = { connect: { id: actorId } };

    const updated = await this.prisma.tenderReminderPolicy.update({
      where: { id: current.id },
      data
    });

    await this.auditService.write({
      actorId,
      action: "crm.reminderPolicy.update",
      entityType: "TenderReminderPolicy",
      entityId: current.id,
      metadata: { changed } as Prisma.InputJsonValue
    });

    return updated;
  }
}
