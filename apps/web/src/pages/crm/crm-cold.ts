/**
 * CRM_COLD_V3 (web mirror) — the ONE contact-state contract for the whole CRM.
 *
 * Server truth: apps/api/src/modules/crm/accounts/accounts.service.ts exports
 * an identically-shaped CRM_COLD_V3 and the same ContactState union; the two
 * must never diverge. Assertions in the two suites pin the numbers and the
 * four rules on both sides:
 *   - apps/web/src/pages/crm/__tests__/crmui-accounts-list-s2.test.ts
 *   - apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts
 *
 * Marco's decisions:
 *   - 2026-09-01: default threshold is 60 days (user-selectable at the
 *     Relationships going-cold panel).
 *   - 2026-09-04: never-contacted is its OWN state, not the coldest one.
 *     "Cold" means was warm, went quiet. A never-contacted account is a
 *     relationship that has not STARTED, which is a different job for the
 *     estimator and belongs in a different number. This retired the earlier
 *     null-is-cold rule: with no contact ever logged it made all 175 accounts
 *     cold, and a tile reading "Going cold 175" out of 175 tells nobody
 *     anything.
 *
 * DO NOT introduce a second threshold or a second null-rule anywhere in the
 * CRM. If a surface wants a different threshold it must pass it in explicitly
 * (only the going-cold panel does — via ?thresholdDays=).
 *
 * This file exists standalone (not on AccountsListPage or RelationshipsPage)
 * to keep the constant off the two circular-import paths: RelationshipsPage
 * imports it, and AccountsListPage imports both this and RelationshipsPage.
 */
export const CRM_COLD_V3 = {
  THRESHOLD_DAYS: 60 as number
} as const;

/**
 * The four states an account's contact history can be in. Exactly one applies.
 * Mirrors the server-side ContactState union.
 */
export type ContactState = "PAST" | "NEVER_CONTACTED" | "COLD" | "IN_CONTACT";
