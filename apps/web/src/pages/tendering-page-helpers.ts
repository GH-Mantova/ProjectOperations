export type TenderingLoadNotice = {
  kind: "warning";
  message: string;
};

export type TenderingLoadNoticeInput = {
  jobsAvailable: boolean;
  sitesAvailable: boolean;
  usersAvailable: boolean;
};

export type TenderingCreateReadinessInput = {
  tenderNumber: string;
  title: string;
  hasClarification: boolean;
  hasFollowUp: boolean;
  hasNote: boolean;
};

export type TenderingStage =
  | "DRAFT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "AWARDED"
  | "CONTRACT_ISSUED"
  | "CONVERTED";

type TimestampedRecord = {
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TenderingAttentionInput = TimestampedRecord & {
  stage: TenderingStage;
  dueDate?: string | null;
  contractIssuedAt?: string | null;
  clarifications: Array<TimestampedRecord & { status: string; dueDate?: string | null }>;
  followUps: Array<TimestampedRecord & { status: string; dueAt?: string | null }>;
  tenderNotes: Array<TimestampedRecord>;
  tenderDocuments?: Array<TimestampedRecord> | null;
  outcomes?: Array<TimestampedRecord> | null;
};

export type TenderingAttentionState = "healthy" | "watch" | "rotting";

export type TenderingAttentionSummary = {
  lastActivityAt: string | null;
  nextActionAt: string | null;
  stageAgeDays: number;
  tenderAgeDays: number;
  openFollowUpCount: number;
  overdueFollowUpCount: number;
  openClarificationCount: number;
  overdueClarificationCount: number;
  attentionState: TenderingAttentionState;
  needsAttention: boolean;
};

export type TenderingValueBand = "ALL" | "UNDER_100K" | "BETWEEN_100K_500K" | "OVER_500K";
export type TenderingDueFilter = "ALL" | "OVERDUE" | "THIS_WEEK" | "NEXT_30_DAYS" | "NO_DUE_DATE";
export type TenderingProbabilityBand = "ALL" | "UNDER_40" | "BETWEEN_40_70" | "OVER_70";

export type TenderingStageReadinessInput = {
  nextStage: TenderingStage;
  dueDate?: string | null;
  estimatedValue?: string | null;
  estimatorUserId?: string | null;
  linkedClientCount: number;
  awardedClientCount: number;
  contractIssuedCount: number;
  commercialSummary?: string | null;
};

export type TenderingStageReadiness = {
  blockers: string[];
  importantChecks: string[];
  canProceed: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const stageIdleThresholds: Record<TenderingStage, { watch: number; rotting: number }> = {
  DRAFT: { watch: 3, rotting: 7 },
  IN_PROGRESS: { watch: 4, rotting: 8 },
  SUBMITTED: { watch: 2, rotting: 5 },
  AWARDED: { watch: 3, rotting: 6 },
  CONTRACT_ISSUED: { watch: 5, rotting: 10 },
  CONVERTED: { watch: 999, rotting: 999 }
};

function parseTimestamp(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function getLatestTimestamp(values: Array<string | null | undefined>) {
  let latest: number | null = null;

  for (const value of values) {
    const time = parseTimestamp(value);
    if (time === null) continue;
    latest = latest === null ? time : Math.max(latest, time);
  }

  return latest;
}

function getEarliestTimestamp(values: Array<string | null | undefined>) {
  let earliest: number | null = null;

  for (const value of values) {
    const time = parseTimestamp(value);
    if (time === null) continue;
    earliest = earliest === null ? time : Math.min(earliest, time);
  }

  return earliest;
}

function diffInDays(fromTime: number, toTime: number) {
  return Math.max(0, Math.floor((toTime - fromTime) / DAY_IN_MS));
}

export function getTenderingLoadNotices(input: TenderingLoadNoticeInput): TenderingLoadNotice[] {
  const notices: TenderingLoadNotice[] = [];

  if (!input.usersAvailable) {
    notices.push({
      kind: "warning",
      message: "Estimator and conversion assignee lists are temporarily unavailable. Core tendering still works."
    });
  }

  if (!input.sitesAvailable) {
    notices.push({
      kind: "warning",
      message: "Site options are temporarily unavailable. Tender creation and workspace review still work."
    });
  }

  if (!input.jobsAvailable) {
    notices.push({
      kind: "warning",
      message: "Recent job context could not be loaded. Conversion history will be limited until jobs load again."
    });
  }

  return notices;
}

export function getTenderingCreateReadiness(input: TenderingCreateReadinessInput) {
  const missingCoreFields = [
    !input.tenderNumber.trim() ? "Tender number" : null,
    !input.title.trim() ? "Title" : null
  ].filter((value): value is string => Boolean(value));

  return {
    missingCoreFields,
    hasOpeningActivity: input.hasClarification || input.hasFollowUp || input.hasNote
  };
}

export function getTenderingAttentionSummary(
  input: TenderingAttentionInput,
  now = new Date()
): TenderingAttentionSummary {
  const nowTime = now.getTime();
  const openFollowUps = input.followUps.filter((item) => item.status !== "DONE");
  const openClarifications = input.clarifications.filter((item) => item.status !== "CLOSED");

  const lastActivityTime = getLatestTimestamp([
    input.updatedAt,
    input.createdAt,
    input.contractIssuedAt,
    ...input.tenderNotes.flatMap((item) => [item.createdAt, item.updatedAt]),
    ...input.clarifications.flatMap((item) => [item.createdAt, item.updatedAt, item.dueDate]),
    ...input.followUps.flatMap((item) => [item.createdAt, item.updatedAt, item.dueAt]),
    ...(input.tenderDocuments ?? []).flatMap((item) => [item.createdAt, item.updatedAt]),
    ...(input.outcomes ?? []).flatMap((item) => [item.createdAt, item.updatedAt]),
    input.dueDate
  ]);

  const nextActionTime = getEarliestTimestamp([
    ...openFollowUps.map((item) => item.dueAt),
    ...openClarifications.map((item) => item.dueDate),
    input.dueDate
  ]);

  const stageAnchorTime = getLatestTimestamp([
    input.stage === "CONTRACT_ISSUED" ? input.contractIssuedAt : null,
    input.updatedAt,
    input.createdAt
  ]) ?? nowTime;

  const overdueFollowUpCount = openFollowUps.filter((item) => {
    const dueTime = parseTimestamp(item.dueAt);
    return dueTime !== null && dueTime < nowTime;
  }).length;

  const overdueClarificationCount = openClarifications.filter((item) => {
    const dueTime = parseTimestamp(item.dueDate);
    return dueTime !== null && dueTime < nowTime;
  }).length;

  const daysSinceLastActivity = lastActivityTime === null ? 0 : diffInDays(lastActivityTime, nowTime);
  const stageAgeDays = diffInDays(stageAnchorTime, nowTime);
  const tenderAgeDays = input.createdAt ? diffInDays(parseTimestamp(input.createdAt) ?? nowTime, nowTime) : 0;
  const thresholds = stageIdleThresholds[input.stage];

  let attentionState: TenderingAttentionState = "healthy";
  if (
    input.stage !== "CONVERTED" &&
    (overdueFollowUpCount > 0 || overdueClarificationCount > 0 || daysSinceLastActivity >= thresholds.rotting)
  ) {
    attentionState = "rotting";
  } else if (
    input.stage !== "CONVERTED" &&
    (openFollowUps.length > 0 || openClarifications.length > 0 || daysSinceLastActivity >= thresholds.watch)
  ) {
    attentionState = "watch";
  }

  return {
    lastActivityAt: lastActivityTime === null ? null : new Date(lastActivityTime).toISOString(),
    nextActionAt: nextActionTime === null ? null : new Date(nextActionTime).toISOString(),
    stageAgeDays,
    tenderAgeDays,
    openFollowUpCount: openFollowUps.length,
    overdueFollowUpCount,
    openClarificationCount: openClarifications.length,
    overdueClarificationCount,
    attentionState,
    needsAttention: attentionState !== "healthy"
  };
}

export function matchesTenderDueFilter(
  dueDate: string | null | undefined,
  filter: TenderingDueFilter,
  now = new Date()
) {
  if (filter === "ALL") return true;
  if (!dueDate) return filter === "NO_DUE_DATE";

  const dueTime = parseTimestamp(dueDate);
  if (dueTime === null) return filter === "NO_DUE_DATE";

  const nowTime = now.getTime();
  const thirtyDaysAhead = nowTime + DAY_IN_MS * 30;
  const weekAhead = nowTime + DAY_IN_MS * 7;

  if (filter === "OVERDUE") return dueTime < nowTime;
  if (filter === "THIS_WEEK") return dueTime >= nowTime && dueTime <= weekAhead;
  if (filter === "NEXT_30_DAYS") return dueTime >= nowTime && dueTime <= thirtyDaysAhead;

  return false;
}

export function matchesTenderValueBand(
  estimatedValue: string | null | undefined,
  filter: TenderingValueBand
) {
  if (filter === "ALL") return true;

  const amount = Number(estimatedValue ?? 0);
  if (Number.isNaN(amount)) return false;

  if (filter === "UNDER_100K") return amount < 100000;
  if (filter === "BETWEEN_100K_500K") return amount >= 100000 && amount <= 500000;
  return amount > 500000;
}

export function matchesTenderProbabilityBand(
  probability: number | null | undefined,
  filter: TenderingProbabilityBand
) {
  if (filter === "ALL") return true;

  const amount = Number(probability ?? 0);
  if (Number.isNaN(amount)) return false;

  if (filter === "UNDER_40") return amount < 40;
  if (filter === "BETWEEN_40_70") return amount >= 40 && amount <= 70;
  return amount > 70;
}

export function getTenderingStageReadiness(input: TenderingStageReadinessInput): TenderingStageReadiness {
  const blockers: string[] = [];
  const importantChecks: string[] = [];

  if (input.nextStage === "IN_PROGRESS") {
    if (!input.estimatorUserId) {
      importantChecks.push("Assign an estimator so the estimating stage has a clear owner.");
    }
  }

  if (input.nextStage === "SUBMITTED") {
    if (!input.dueDate) blockers.push("Add a due date before moving to Submitted.");
    if (!input.estimatedValue) blockers.push("Add an estimated value before moving to Submitted.");
    if (!input.estimatorUserId) blockers.push("Assign an estimator before moving to Submitted.");
    if (input.linkedClientCount < 1) blockers.push("Link at least one client before moving to Submitted.");
    if (!input.commercialSummary?.trim()) {
      importantChecks.push("Add a commercial summary so the submitted tender has context for reviewers.");
    }
  }

  if (input.nextStage === "AWARDED") {
    if (input.awardedClientCount < 1) blockers.push("Mark an awarded client before moving to Awarded.");
    if (!input.commercialSummary?.trim()) {
      importantChecks.push("Capture a commercial outcome summary for the award decision.");
    }
  }

  if (input.nextStage === "CONTRACT_ISSUED") {
    if (input.awardedClientCount < 1) blockers.push("Award a client before moving to Contract.");
    if (input.contractIssuedCount < 1) blockers.push("Issue the contract before moving to Contract.");
  }

  if (input.nextStage === "CONVERTED") {
    if (input.contractIssuedCount < 1) blockers.push("Issue the contract before converting to a job.");
  }

  return {
    blockers,
    importantChecks,
    canProceed: blockers.length === 0
  };
}
