// WL-1b — Typed client for the WL-1a tender outcome endpoints.
//
// The API surface exposes two write paths for a structured outcome:
//   PATCH /tenders/:id/status  { status, outcome? }  (status change + optional outcome)
//   POST  /tenders/:id/outcome { ...outcome }        (backfill / post-close)
//
// This module exposes just the standalone POST because the status path is
// already owned by the existing kanban `moveTender` handler; the kanban
// simply passes the outcome payload alongside the status change. Both paths
// go through the append-only TenderOutcomeCaptureService on the server.

// The Prisma enums must match `apps/api/prisma/schema.prisma` exactly — the
// server rejects any value not in these sets (IsIn validator).
export const TENDER_OUTCOME_RESULTS = ["WON", "LOST", "NO_BID"] as const;
export type TenderOutcomeResult = (typeof TENDER_OUTCOME_RESULTS)[number];

export const TENDER_OUTCOME_RESULT_LABEL: Record<TenderOutcomeResult, string> = {
  WON: "Won",
  LOST: "Lost",
  NO_BID: "No bid"
};

export const TENDER_OUTCOME_REASONS = [
  "PRICE_TOO_HIGH",
  "LOST_ON_RELATIONSHIP",
  "SCOPE_MISMATCH",
  "TIMING_PROGRAM_CLASH",
  "CAPACITY_CONSTRAINT",
  "CLIENT_WENT_ANOTHER_DIRECTION",
  "PROJECT_CANCELLED",
  "NO_RESPONSE_FROM_CLIENT",
  "DECLINED_TO_BID",
  "OTHER"
] as const;
export type TenderOutcomeReason = (typeof TENDER_OUTCOME_REASONS)[number];

export const TENDER_OUTCOME_REASON_LABEL: Record<TenderOutcomeReason, string> = {
  PRICE_TOO_HIGH: "Price too high",
  LOST_ON_RELATIONSHIP: "Lost on relationship",
  SCOPE_MISMATCH: "Scope mismatch",
  TIMING_PROGRAM_CLASH: "Timing / program clash",
  CAPACITY_CONSTRAINT: "Capacity constraint",
  CLIENT_WENT_ANOTHER_DIRECTION: "Client went another direction",
  PROJECT_CANCELLED: "Project cancelled",
  NO_RESPONSE_FROM_CLIENT: "No response from client",
  DECLINED_TO_BID: "Declined to bid",
  OTHER: "Other"
};

export interface OutcomeCapturePayload {
  resultType?: TenderOutcomeResult;
  reason?: TenderOutcomeReason;
  // Values are sent as strings — the server DTO uses @IsNumberString so the
  // exact string the user typed is validated and coerced into Decimal there.
  tenderValue?: string;
  ourPrice?: string;
  clientId?: string;
  scopeSummary?: string;
  competitorOrWinner?: string;
  notes?: string;
}

/**
 * Strip empty strings/undefineds so the DTO's @IsOptional actually kicks in
 * (empty string would fail @IsNumberString on tenderValue/ourPrice).
 */
export function compactOutcomePayload(payload: OutcomeCapturePayload): OutcomeCapturePayload {
  const out: OutcomeCapturePayload = {};
  for (const [key, value] of Object.entries(payload) as [
    keyof OutcomeCapturePayload,
    string | undefined
  ][]) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    (out as Record<string, string>)[key] = value;
  }
  return out;
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Standalone recorder (POST /tenders/:id/outcome) — used by both the
 * NeedsOutcomePanel backfill and by the kanban after the status PATCH.
 * (The status PATCH also accepts a nested outcome payload, but sending it
 * separately keeps the kanban's optimistic status write independent from
 * the modal submit — the card never has to wait on the outcome round-trip.)
 */
export async function recordOutcome(
  authFetch: AuthFetch,
  tenderId: string,
  payload: OutcomeCapturePayload
): Promise<void> {
  const body = compactOutcomePayload(payload);
  const response = await authFetch(`/tenders/${tenderId}/outcome`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Failed to record outcome (${response.status})`);
  }
}
