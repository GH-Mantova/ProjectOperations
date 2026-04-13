import { getTenderingAttentionSummary, getTenderingCreateReadiness, getTenderingLoadNotices, getTenderingStageReadiness, matchesTenderDueFilter, matchesTenderValueBand } from "./tendering-page-helpers.js";
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function assertDeepEqual(actual, expected, message) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${message}\nExpected: ${expectedJson}\nActual: ${actualJson}`);
    }
}
function run() {
    assertDeepEqual(getTenderingLoadNotices({
        jobsAvailable: true,
        sitesAvailable: true,
        usersAvailable: true
    }), [], "Expected no load notices when optional datasets are available.");
    const createReadiness = getTenderingCreateReadiness({
        tenderNumber: "TEN-100",
        title: "Example tender",
        hasClarification: false,
        hasFollowUp: true,
        hasNote: false
    });
    assert(createReadiness.hasOpeningActivity === true, "Expected opening activity readiness to be true when a follow-up exists.");
    assert(Array.isArray(createReadiness.missingCoreFields) && createReadiness.missingCoreFields.length === 0, "Expected no missing core fields.");
    const attention = getTenderingAttentionSummary({
        stage: "SUBMITTED",
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
        dueDate: "2026-04-10T00:00:00.000Z",
        contractIssuedAt: null,
        tenderNotes: [],
        tenderDocuments: [],
        outcomes: [],
        clarifications: [],
        followUps: [
            {
                status: "OPEN",
                dueAt: "2026-04-01T00:00:00.000Z",
                createdAt: "2026-03-25T00:00:00.000Z",
                updatedAt: "2026-03-25T00:00:00.000Z"
            }
        ]
    }, new Date("2026-04-03T00:00:00.000Z"));
    assert(attention.attentionState === "rotting", "Expected submitted tender to be marked as rotting.");
    assert(attention.overdueFollowUpCount === 1, "Expected one overdue follow-up.");
    assert(attention.tenderAgeDays === 14, "Expected tender age of 14 days.");
    assert(attention.nextActionAt === "2026-04-01T00:00:00.000Z", "Expected earliest next action date.");
    assert(matchesTenderDueFilter("2026-04-01T00:00:00.000Z", "OVERDUE", new Date("2026-04-03T00:00:00.000Z")) === true, "Expected overdue due-date filter match.");
    assert(matchesTenderDueFilter(undefined, "NO_DUE_DATE", new Date("2026-04-03T00:00:00.000Z")) === true, "Expected missing due date to match NO_DUE_DATE.");
    assert(matchesTenderValueBand("250000", "BETWEEN_100K_500K") === true, "Expected value band match for 250000.");
    assertDeepEqual(getTenderingStageReadiness({
        nextStage: "SUBMITTED",
        dueDate: null,
        estimatedValue: "",
        estimatorUserId: "",
        linkedClientCount: 0,
        awardedClientCount: 0,
        contractIssuedCount: 0,
        commercialSummary: ""
    }), {
        blockers: [
            "Add a due date before moving to Submitted.",
            "Add an estimated value before moving to Submitted.",
            "Assign an estimator before moving to Submitted.",
            "Link at least one client before moving to Submitted."
        ],
        importantChecks: ["Add a commercial summary so the submitted tender has context for reviewers."],
        canProceed: false
    }, "Expected submission readiness blockers when key commercial fields are missing.");
    console.log("Tendering helper smoke checks passed.");
}
run();
