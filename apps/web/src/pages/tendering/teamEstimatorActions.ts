// Pure helpers for the Team panel's assigned-estimator dropdown (§5A.3 /
// PR-63b). Extracted so the request shapes can be tested without jsdom.
//
// Reads from Tender.assignedEstimatorId (new, PR-63a) and writes via
// PATCH /tenders/:id/assigned-estimator. The legacy estimatorUserId field
// (estimator-of-record, surfaced as tender.estimator) is deliberately not
// touched here.

import type { AuthFetch } from "./activityClientFilter";

export type EstimatorOption = { id: string; firstName: string; lastName: string };

export async function loadEstimators(authFetch: AuthFetch): Promise<EstimatorOption[]> {
  const response = await authFetch("/users?role=estimator&page=1&pageSize=100");
  if (!response.ok) {
    throw new Error((await response.text()) || `Failed to load estimators (${response.status}).`);
  }
  const body = (await response.json()) as {
    items: Array<{ id: string; firstName: string; lastName: string; isActive: boolean }>;
  };
  return body.items
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName }));
}

export async function patchAssignedEstimator(
  authFetch: AuthFetch,
  tenderId: string,
  userId: string | null
): Promise<void> {
  const response = await authFetch(
    `/tenders/${encodeURIComponent(tenderId)}/assigned-estimator`,
    { method: "PATCH", body: JSON.stringify({ userId }) }
  );
  if (!response.ok) {
    throw new Error((await response.text()) || `Failed to update estimator (${response.status}).`);
  }
}

export function estimatorInitials(option: Pick<EstimatorOption, "firstName" | "lastName">): string {
  return `${option.firstName.charAt(0)}${option.lastName.charAt(0)}`.toUpperCase();
}
