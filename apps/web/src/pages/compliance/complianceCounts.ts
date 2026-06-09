// Canonical formula for the "Compliance" sidebar badge count.
//
// The badge and the /compliance page must always agree, otherwise the user
// clicks a "6" and sees a list of 4 — which is exactly the F3-02 finding.
// Both surfaces share the same response shape from /compliance/dashboard
// (alias of /compliance/expiring?days=30) and the same status set, so we
// centralise the count here and call it from both sides.

export type ComplianceExpiryStatus =
  | "not_set"
  | "active"
  | "expiring_30"
  | "expiring_7"
  | "expired";

export type CountableExpiryRow = { status: ComplianceExpiryStatus };

export type ComplianceDashboardData = {
  licences?: CountableExpiryRow[];
  insurances?: CountableExpiryRow[];
  qualifications?: CountableExpiryRow[];
};

const ALERT_STATUSES: ReadonlySet<ComplianceExpiryStatus> = new Set([
  "expired",
  "expiring_7",
  "expiring_30"
]);

export function isComplianceAlert(row: CountableExpiryRow): boolean {
  return ALERT_STATUSES.has(row.status);
}

export function countComplianceAlerts(data: ComplianceDashboardData | null | undefined): number {
  if (!data) return 0;
  const rows: CountableExpiryRow[] = [
    ...(data.licences ?? []),
    ...(data.insurances ?? []),
    ...(data.qualifications ?? [])
  ];
  return rows.filter(isComplianceAlert).length;
}

export const COMPLIANCE_BADGE_TOOLTIP =
  "Licences, insurances and worker qualifications that have expired or expire within 30 days.";
