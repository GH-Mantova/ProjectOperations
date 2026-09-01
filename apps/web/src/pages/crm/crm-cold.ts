/**
 * CRM_COLD_V2 (web mirror) — the ONE going-cold contract for the whole CRM.
 *
 * Server truth: apps/api/src/modules/crm/accounts/accounts.service.ts exports
 * an identically-shaped CRM_COLD_V2 with the same values; the two must never
 * diverge. Assertions in the two suites pin the numbers on both sides:
 *   - apps/web/src/pages/crm/__tests__/crm-uifix-s1.test.ts
 *   - apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts
 *
 * Marco's decisions (2026-09-01, CRM UIFIX S1):
 *   - Default threshold is 60 days (user-selectable at the Relationships tab).
 *   - lastContactedAt === null counts as COLD (if non-PAST). Never-contacted
 *     is the coldest state in the system, not the warmest.
 *
 * DO NOT introduce a second threshold or a second null-rule anywhere in the
 * CRM. If a surface wants a different threshold it must pass it in explicitly
 * (only the /going-cold tab does — via ?thresholdDays=).
 *
 * This file exists standalone (not on AccountsListPage or RelationshipsPage)
 * to keep the constant off the two circular-import paths: RelationshipsPage
 * imports it, and AccountsListPage imports both this and RelationshipsPage.
 */
export const CRM_COLD_V2 = {
  THRESHOLD_DAYS: 60 as number,
  NULL_IS_COLD: true as const
} as const;
