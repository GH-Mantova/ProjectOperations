import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";

// EA-GATE: shared self-filter resolver.
//
// Centralises the rule for whether a user may see the whole team's numbers or
// only their own assigned tenders. The four cases are ordered strictly:
//
//   1. No currentUser (internal call, seed, test) → no filter.
//   2. isSuperUser → no filter.
//   3. currentUser.permissions includes "reporting.team" → no filter.
//   4. Otherwise → filter to tenders assigned to the current user.
//
// The old selfFilterClause in estimating-analytics-report.definitions.ts keyed
// off isSuperUser alone, which was wrong in both directions:
//   - over-restrictive: an estimating manager (non-super-user) was self-filtered.
//   - under-restrictive: tender-win-rate in reporting.service.ts had NO filter at all.
//
// Do NOT widen reporting.view to mean "see the team" — that code is the only
// gate on the /reports endpoint and overloading it would lock estimators out.
// Do NOT add @RequirePermissions("reporting.team") to any controller — this is
// a row filter, not an endpoint gate.

export interface SelfFilterParams {
  currentUser?: Pick<AuthenticatedUser, "sub" | "isSuperUser" | "permissions">;
}

export function resolveSelfFilter(params: SelfFilterParams): { assignedEstimatorId?: string } {
  if (!params.currentUser) return {};
  if (params.currentUser.isSuperUser) return {};
  if (params.currentUser.permissions.includes("reporting.team")) return {};
  return { assignedEstimatorId: params.currentUser.sub };
}
