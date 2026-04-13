const DAY_IN_MS = 24 * 60 * 60 * 1000;
const stageIdleThresholds = {
    DRAFT: { watch: 3, rotting: 7 },
    IN_PROGRESS: { watch: 4, rotting: 8 },
    SUBMITTED: { watch: 2, rotting: 5 },
    AWARDED: { watch: 3, rotting: 6 },
    CONTRACT_ISSUED: { watch: 5, rotting: 10 },
    CONVERTED: { watch: 999, rotting: 999 }
};
function parseTimestamp(value) {
    if (!value)
        return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}
function getLatestTimestamp(values) {
    let latest = null;
    for (const value of values) {
        const time = parseTimestamp(value);
        if (time === null)
            continue;
        latest = latest === null ? time : Math.max(latest, time);
    }
    return latest;
}
function getEarliestTimestamp(values) {
    let earliest = null;
    for (const value of values) {
        const time = parseTimestamp(value);
        if (time === null)
            continue;
        earliest = earliest === null ? time : Math.min(earliest, time);
    }
    return earliest;
}
function diffInDays(fromTime, toTime) {
    return Math.max(0, Math.floor((toTime - fromTime) / DAY_IN_MS));
}
export function getTenderingLoadNotices(input) {
    const notices = [];
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
export function getTenderingCreateReadiness(input) {
    const missingCoreFields = [
        !input.tenderNumber.trim() ? "Tender number" : null,
        !input.title.trim() ? "Title" : null
    ].filter((value) => Boolean(value));
    return {
        missingCoreFields,
        hasOpeningActivity: input.hasClarification || input.hasFollowUp || input.hasNote
    };
}
export function getTenderingAttentionSummary(input, now = new Date()) {
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
    let attentionState = "healthy";
    if (input.stage !== "CONVERTED" &&
        (overdueFollowUpCount > 0 || overdueClarificationCount > 0 || daysSinceLastActivity >= thresholds.rotting)) {
        attentionState = "rotting";
    }
    else if (input.stage !== "CONVERTED" &&
        (openFollowUps.length > 0 || openClarifications.length > 0 || daysSinceLastActivity >= thresholds.watch)) {
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
export function matchesTenderDueFilter(dueDate, filter, now = new Date()) {
    if (filter === "ALL")
        return true;
    if (!dueDate)
        return filter === "NO_DUE_DATE";
    const dueTime = parseTimestamp(dueDate);
    if (dueTime === null)
        return filter === "NO_DUE_DATE";
    const nowTime = now.getTime();
    const thirtyDaysAhead = nowTime + DAY_IN_MS * 30;
    const weekAhead = nowTime + DAY_IN_MS * 7;
    if (filter === "OVERDUE")
        return dueTime < nowTime;
    if (filter === "THIS_WEEK")
        return dueTime >= nowTime && dueTime <= weekAhead;
    if (filter === "NEXT_30_DAYS")
        return dueTime >= nowTime && dueTime <= thirtyDaysAhead;
    return false;
}
export function matchesTenderValueBand(estimatedValue, filter) {
    if (filter === "ALL")
        return true;
    const amount = Number(estimatedValue ?? 0);
    if (Number.isNaN(amount))
        return false;
    if (filter === "UNDER_100K")
        return amount < 100000;
    if (filter === "BETWEEN_100K_500K")
        return amount >= 100000 && amount <= 500000;
    return amount > 500000;
}
export function matchesTenderProbabilityBand(probability, filter) {
    if (filter === "ALL")
        return true;
    const amount = Number(probability ?? 0);
    if (Number.isNaN(amount))
        return false;
    if (filter === "UNDER_40")
        return amount < 40;
    if (filter === "BETWEEN_40_70")
        return amount >= 40 && amount <= 70;
    return amount > 70;
}
export function getTenderingStageReadiness(input) {
    const blockers = [];
    const importantChecks = [];
    if (input.nextStage === "IN_PROGRESS") {
        if (!input.estimatorUserId) {
            importantChecks.push("Assign an estimator so the estimating stage has a clear owner.");
        }
    }
    if (input.nextStage === "SUBMITTED") {
        if (!input.dueDate)
            blockers.push("Add a due date before moving to Submitted.");
        if (!input.estimatedValue)
            blockers.push("Add an estimated value before moving to Submitted.");
        if (!input.estimatorUserId)
            blockers.push("Assign an estimator before moving to Submitted.");
        if (input.linkedClientCount < 1)
            blockers.push("Link at least one client before moving to Submitted.");
        if (!input.commercialSummary?.trim()) {
            importantChecks.push("Add a commercial summary so the submitted tender has context for reviewers.");
        }
    }
    if (input.nextStage === "AWARDED") {
        if (input.awardedClientCount < 1)
            blockers.push("Mark an awarded client before moving to Awarded.");
        if (!input.commercialSummary?.trim()) {
            importantChecks.push("Capture a commercial outcome summary for the award decision.");
        }
    }
    if (input.nextStage === "CONTRACT_ISSUED") {
        if (input.awardedClientCount < 1)
            blockers.push("Award a client before moving to Contract.");
        if (input.contractIssuedCount < 1)
            blockers.push("Issue the contract before moving to Contract.");
    }
    if (input.nextStage === "CONVERTED") {
        if (input.contractIssuedCount < 1)
            blockers.push("Issue the contract before converting to a job.");
    }
    return {
        blockers,
        importantChecks,
        canProceed: blockers.length === 0
    };
}
