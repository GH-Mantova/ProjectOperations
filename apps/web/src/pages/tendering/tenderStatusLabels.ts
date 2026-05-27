export const TENDER_STATUSES = [
  "DRAFT",
  "IN_PROGRESS",
  "SUBMITTED",
  "AWARDED",
  "CONTRACT_ISSUED",
  "LOST",
  "WITHDRAWN"
] as const;

export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const TENDER_STATUS_LABEL: Record<TenderStatus, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "Estimating",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  CONTRACT_ISSUED: "Contract",
  LOST: "Lost",
  WITHDRAWN: "Withdrawn"
};

export const TENDER_STATUS_ACCENT: Record<TenderStatus, string> = {
  DRAFT: "var(--status-neutral, #6B7280)",
  IN_PROGRESS: "var(--status-info, #3B82F6)",
  SUBMITTED: "var(--status-warning, #F59E0B)",
  AWARDED: "var(--status-active, #005B61)",
  CONTRACT_ISSUED: "var(--brand-primary, #005B61)",
  LOST: "var(--status-danger, #EF4444)",
  WITHDRAWN: "var(--text-muted, #9CA3AF)"
};
