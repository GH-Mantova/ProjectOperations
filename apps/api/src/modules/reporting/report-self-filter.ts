import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";

// EA-GATE: shared self-filter resolver.
//
// Centralises the rule for whether a user may see the whole team's numbers or
// only their own assigned tenders. The four cases are ordered strictly:
//
//   1. No currentUser (internal call, seed, test) → no filter.
//   2. isSuperUser → no filter.
//   3. currentUser holds ANY code in TEAM_VISIBILITY_CODES → no filter.
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

// EA-GATE delivery constraint: team visibility must not depend on a grant that
// production never runs.
//
// Production deploys with `prisma migrate deploy` (.github/workflows/deploy.yml)
// and never executes the TS seed, so a seed-only rolePermission insert reaches
// dev and CI but never production. If reporting.team were the ONLY code that
// unlocked the team rollup, the code would ship while the grant did not: Admin
// would keep visibility through admin-all-permissions and every estimating
// manager would silently drop to self-view.
//
// So team visibility is keyed off a LIST of codes, and tenders.allocate — the
// manager-shaped permission that already exists in production and is already
// held by exactly the manager roles we mean ("Allocate tenders to estimators;
// view and manage the estimator capacity board") — is a member. reporting.team
// is the forward-looking explicit code; tenders.allocate is the one that makes
// the first deploy correct with no data migration at all.
//
// Additive by construction: holding either code widens visibility, holding
// neither is unchanged from today. A later PR may grant reporting.team to
// allocate-holding roles via a real migration; when it does nothing here needs
// to change and no user's visibility moves.
export const TEAM_VISIBILITY_CODES = ["reporting.team", "tenders.allocate"] as const;

export function resolveSelfFilter(params: SelfFilterParams): { assignedEstimatorId?: string } {
  const user = params.currentUser;
  if (!user) return {};
  if (user.isSuperUser) return {};
  if (TEAM_VISIBILITY_CODES.some((code) => user.permissions.includes(code))) return {};
  return { assignedEstimatorId: user.sub };
}
