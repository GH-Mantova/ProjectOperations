/**
 * TR-2: shared types for the CRM scheduled reminder engine.
 *
 * Split out of `comms-reminder.service.ts` so the service file stays readable
 * and so the sweep RESULT shape — the thing that makes a run observable — has
 * one documented home rather than being an inline return type.
 */

/** The three independent scans a single sweep performs. */
export type ReminderTrack = "PRE_DUE" | "POST_SUBMISSION" | "TASK";

/**
 * The polymorphic subject vocabulary written into `TenderReminderLog`.
 *
 * These are the values TR-1's schema comment names ("Tender" / "CommTask").
 * They are deliberately NOT the same vocabulary as `CommTask.entityType`,
 * which is the uppercase `COMM_ENTITY_TYPES` tuple ("TENDER", "OPPORTUNITY",
 * …). Two different columns, two different vocabularies; conflating them
 * would silently mis-key the idempotency log.
 */
export type ReminderSubjectType = "Tender" | "CommTask";

/**
 * One thing that wants to be said to one person.
 *
 * An event is NOT a notification — several events for the same `userId` are
 * folded into a single digest notification before anything is sent.
 */
export type ReminderEvent = {
  track: ReminderTrack;
  subjectType: ReminderSubjectType;
  subjectId: string;
  /** e.g. `"pre_due_7"`, `"pre_due_0"`, `"post_sub_14"`, `"task_due"`. */
  triggerKey: string;
  /** Recipient. An event is never created without one — see `noRecipient`. */
  userId: string;
  /** Single-line summary used as the notification title when alone. */
  headline: string;
  /** Sentence used as the notification body / digest bullet. */
  detail: string;
  linkUrl: string;
};

/** All events for one recipient, folded into one notification. */
export type DigestGroup = {
  userId: string;
  events: ReminderEvent[];
};

/**
 * A step of the sweep that did not do what it set out to do.
 *
 * A failure NEVER aborts the sweep and NEVER silently disappears: it is
 * counted here, warned to the logger, and — for `stage: "notify"` — leaves the
 * `TenderReminderLog` rows UNWRITTEN so the next nightly sweep retries.
 */
export type ReminderSweepFailure = {
  stage: "notify" | "record";
  userId: string | null;
  triggerKeys: string[];
  message: string;
};

/**
 * What one sweep did.
 *
 * The whole point of this object is that **a sweep that matched nothing is
 * distinguishable from a sweep that never ran**. `status: "clean"` is a
 * positive statement — "I ran, I looked at `scanned` rows, none of them were
 * due" — and it is emitted on the logger at info level by the cron wrapper.
 * A sweep that did not run emits nothing at all, and no result object exists.
 *
 * `scanned` matters as much as `triggered`: a clean sweep over 40 candidate
 * tenders is healthy; a clean sweep over 0 candidate tenders means the query
 * (or the database) is wrong, and the counts are what let a reader tell those
 * two apart without opening a console.
 */
export type ReminderSweepResult = {
  /** ISO timestamp of the reference date the sweep was run for. */
  ranAt: string;
  /**
   * `fired`    — at least one reminder was triggered and delivered.
   * `clean`    — the sweep completed and nothing was due. Not an error.
   * `degraded` — the sweep completed but at least one send or record failed.
   */
  status: "fired" | "clean" | "degraded";
  /** The policy timings actually in force for this sweep. */
  policy: {
    daysBefore: number;
    dueDayOf: boolean;
    postSubmissionChaseDays: number;
    postSubmissionCadenceDays: number;
  };
  /** Rows each track pulled out of the database and considered. */
  scanned: {
    preDueCandidates: number;
    postSubmissionCandidates: number;
    openTasks: number;
  };
  /** Events that passed their track's threshold AND had no prior log row. */
  triggered: {
    preDue: number;
    postSubmission: number;
    task: number;
    total: number;
  };
  /** Candidates that were dropped, and why. */
  suppressed: {
    /** A `TenderReminderLog` row already existed for the trigger key. */
    alreadyLogged: number;
    /** No user could be resolved to notify — warned and skipped, never thrown. */
    noRecipient: number;
    /**
     * The log write hit the `@@unique([subjectType, subjectId, triggerKey])`
     * index (P2002), i.e. a concurrent sweep recorded the same trigger first.
     */
    racedOnUniqueIndex: number;
  };
  notified: {
    /** Notifications actually created (one per recipient, not per event). */
    digests: number;
    recipients: number;
  };
  /** `TenderReminderLog` rows written (or confirmed present) by this sweep. */
  recorded: number;
  failures: ReminderSweepFailure[];
};
