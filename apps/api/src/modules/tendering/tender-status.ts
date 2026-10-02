// ─── Tender status vocabulary ─────────────────────────────────────────────────
// Single source of truth for Tender.status set membership.
//
// Live vocabulary (values the app currently writes):
//   DRAFT, IN_PROGRESS, SUBMITTED, AWARDED, CONTRACT_ISSUED, CONVERTED, LOST, WITHDRAWN
//
// Legacy values no longer written but still present in older rows:
//   WON, CLOSED, NO_BID
//
// "WON" is a TenderOutcome.resultType, NOT a status.
// OutcomeCaptureModal maps AWARDED / CONTRACT_ISSUED / CONVERTED → WON outcome.

/** Marker for premise grep. */
export const TENDER_STATUS_VOCAB_V1 = "tender-status-vocab-s1";

// ─── Core sets ────────────────────────────────────────────────────────────────
// Declared as ReadonlySet<string> so callers can pass any string to .has()
// without a cast, which is the correct behaviour for a membership check.

/** Statuses that represent a won tender (written by OutcomeCaptureModal / status flow). */
export const WON_TENDER_STATUSES: ReadonlySet<string> = new Set([
  "AWARDED",
  "CONTRACT_ISSUED",
  "CONVERTED"
]);

/** Statuses that represent a lost tender. */
export const LOST_TENDER_STATUSES: ReadonlySet<string> = new Set([
  "LOST"
]);

/**
 * Legacy status values the product no longer writes, but historical rows may carry.
 * Kept so no historical row changes meaning (data integrity: do not remove).
 */
export const LEGACY_CLOSED_TENDER_STATUSES: ReadonlySet<string> = new Set([
  "WON",
  "CLOSED",
  "NO_BID"
]);

/**
 * All statuses where a tender has reached a terminal state — no longer open work.
 * = WON_TENDER_STATUSES ∪ LOST_TENDER_STATUSES ∪ { WITHDRAWN } ∪ LEGACY_CLOSED_TENDER_STATUSES
 *
 * Uses notIn in Prisma queries so new active statuses are included automatically.
 */
export const TERMINAL_TENDER_STATUSES: ReadonlySet<string> = new Set([
  ...WON_TENDER_STATUSES,
  ...LOST_TENDER_STATUSES,
  "WITHDRAWN",
  ...LEGACY_CLOSED_TENDER_STATUSES
]);

/**
 * Statuses that represent a tender with a result (won or lost), suitable for
 * informing win-likelihood cohorts.
 * = WON_TENDER_STATUSES ∪ LOST_TENDER_STATUSES ∪ LEGACY_CLOSED_TENDER_STATUSES
 *
 * WITHDRAWN is excluded: a withdrawn tender has no result outcome.
 */
export const HISTORY_TENDER_STATUSES: ReadonlySet<string> = new Set([
  ...WON_TENDER_STATUSES,
  ...LOST_TENDER_STATUSES,
  ...LEGACY_CLOSED_TENDER_STATUSES
]);

// ─── Array exports for Prisma `in` / `notIn` ─────────────────────────────────

export const WON_TENDER_STATUSES_ARRAY: string[] = [...WON_TENDER_STATUSES];
export const LOST_TENDER_STATUSES_ARRAY: string[] = [...LOST_TENDER_STATUSES];
export const LEGACY_CLOSED_TENDER_STATUSES_ARRAY: string[] = [...LEGACY_CLOSED_TENDER_STATUSES];
export const TERMINAL_TENDER_STATUSES_ARRAY: string[] = [...TERMINAL_TENDER_STATUSES];
export const HISTORY_TENDER_STATUSES_ARRAY: string[] = [...HISTORY_TENDER_STATUSES];

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Returns true when the given status value is in TERMINAL_TENDER_STATUSES. */
export function isTerminalTenderStatus(status: string): boolean {
  return TERMINAL_TENDER_STATUSES.has(status);
}
