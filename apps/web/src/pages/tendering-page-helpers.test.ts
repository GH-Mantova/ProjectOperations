import { describe, expect, it } from "vitest";
import {
  getTenderingAttentionSummary,
  getTenderingCreateReadiness,
  getTenderingLoadNotices,
  getTenderingStageReadiness,
  matchesTenderDueFilter,
  matchesTenderProbabilityBand,
  matchesTenderValueBand
} from "./tendering-page-helpers";

describe("getTenderingLoadNotices", () => {
  it("returns no notices when optional data is available", () => {
    expect(
      getTenderingLoadNotices({
        jobsAvailable: true,
        sitesAvailable: true,
        usersAvailable: true
      })
    ).toEqual([]);
  });

  it("returns targeted warning notices for unavailable optional datasets", () => {
    const notices = getTenderingLoadNotices({
      jobsAvailable: false,
      sitesAvailable: true,
      usersAvailable: false
    });

    expect(notices).toHaveLength(2);
    expect(notices.map((notice) => notice.message)).toEqual([
      "Estimator and conversion assignee lists are temporarily unavailable. Core tendering still works.",
      "Recent job context could not be loaded. Conversion history will be limited until jobs load again."
    ]);
  });
});

describe("getTenderingCreateReadiness", () => {
  it("identifies missing tender number and title", () => {
    expect(
      getTenderingCreateReadiness({
        tenderNumber: " ",
        title: "",
        hasClarification: false,
        hasFollowUp: false,
        hasNote: false
      })
    ).toEqual({
      hasOpeningActivity: false,
      missingCoreFields: ["Tender number", "Title"]
    });
  });

  it("marks opening activity ready when any starting activity exists", () => {
    expect(
      getTenderingCreateReadiness({
        tenderNumber: "TEN-100",
        title: "Example tender",
        hasClarification: false,
        hasFollowUp: true,
        hasNote: false
      })
    ).toEqual({
      hasOpeningActivity: true,
      missingCoreFields: []
    });
  });
});

describe("getTenderingAttentionSummary", () => {
  it("marks tenders as rotting when overdue actions exist", () => {
    expect(
      getTenderingAttentionSummary(
        {
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
        },
        new Date("2026-04-03T00:00:00.000Z")
      )
    ).toMatchObject({
      attentionState: "rotting",
      needsAttention: true,
      overdueFollowUpCount: 1,
      openFollowUpCount: 1,
      nextActionAt: "2026-04-01T00:00:00.000Z",
      tenderAgeDays: 14
    });
  });

  it("uses open workload and recency to mark tenders as watch", () => {
    expect(
      getTenderingAttentionSummary(
        {
          stage: "IN_PROGRESS",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-31T00:00:00.000Z",
          dueDate: "2026-04-15T00:00:00.000Z",
          contractIssuedAt: null,
          tenderNotes: [{ createdAt: "2026-03-28T00:00:00.000Z", updatedAt: null }],
          tenderDocuments: [],
          outcomes: [],
          clarifications: [
            {
              status: "OPEN",
              dueDate: "2026-04-06T00:00:00.000Z",
              createdAt: "2026-03-29T00:00:00.000Z",
              updatedAt: "2026-03-30T00:00:00.000Z"
            }
          ],
          followUps: []
        },
        new Date("2026-04-03T00:00:00.000Z")
      )
    ).toMatchObject({
      attentionState: "watch",
      needsAttention: true,
      overdueClarificationCount: 0,
      openClarificationCount: 1,
      stageAgeDays: 3
    });
  });

  it("keeps converted tenders healthy when no open action pressure exists", () => {
    expect(
      getTenderingAttentionSummary(
        {
          stage: "CONVERTED",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-05T00:00:00.000Z",
          dueDate: null,
          contractIssuedAt: "2026-02-04T00:00:00.000Z",
          tenderNotes: [],
          tenderDocuments: [],
          outcomes: [],
          clarifications: [],
          followUps: []
        },
        new Date("2026-04-03T00:00:00.000Z")
      )
    ).toMatchObject({
      attentionState: "healthy",
      needsAttention: false,
      stageAgeDays: 57
    });
  });
});

describe("matchesTenderDueFilter", () => {
  const now = new Date("2026-04-03T00:00:00.000Z");

  it("matches overdue and missing due date states", () => {
    expect(matchesTenderDueFilter("2026-04-01T00:00:00.000Z", "OVERDUE", now)).toBe(true);
    expect(matchesTenderDueFilter(undefined, "NO_DUE_DATE", now)).toBe(true);
    expect(matchesTenderDueFilter("2026-04-20T00:00:00.000Z", "OVERDUE", now)).toBe(false);
  });
});

describe("matchesTenderValueBand", () => {
  it("matches configured value bands", () => {
    expect(matchesTenderValueBand("90000", "UNDER_100K")).toBe(true);
    expect(matchesTenderValueBand("250000", "BETWEEN_100K_500K")).toBe(true);
    expect(matchesTenderValueBand("750000", "OVER_500K")).toBe(true);
    expect(matchesTenderValueBand("750000", "UNDER_100K")).toBe(false);
  });
});

describe("matchesTenderProbabilityBand", () => {
  it("matches configured probability bands", () => {
    expect(matchesTenderProbabilityBand(20, "UNDER_40")).toBe(true);
    expect(matchesTenderProbabilityBand(55, "BETWEEN_40_70")).toBe(true);
    expect(matchesTenderProbabilityBand(85, "OVER_70")).toBe(true);
    expect(matchesTenderProbabilityBand(85, "UNDER_40")).toBe(false);
  });
});

describe("getTenderingStageReadiness", () => {
  it("flags estimator ownership as an important check for in-progress work", () => {
    expect(
      getTenderingStageReadiness({
        nextStage: "IN_PROGRESS",
        dueDate: "2026-04-10",
        estimatedValue: "100000",
        estimatorUserId: "",
        linkedClientCount: 1,
        awardedClientCount: 0,
        contractIssuedCount: 0,
        commercialSummary: "Estimator still being assigned."
      })
    ).toEqual({
      blockers: [],
      importantChecks: ["Assign an estimator so the estimating stage has a clear owner."],
      canProceed: true
    });
  });

  it("blocks submission when required commercial fields are missing", () => {
    expect(
      getTenderingStageReadiness({
        nextStage: "SUBMITTED",
        dueDate: null,
        estimatedValue: "",
        estimatorUserId: "",
        linkedClientCount: 0,
        awardedClientCount: 0,
        contractIssuedCount: 0,
        commercialSummary: ""
      })
    ).toEqual({
      blockers: [
        "Add a due date before moving to Submitted.",
        "Add an estimated value before moving to Submitted.",
        "Assign an estimator before moving to Submitted.",
        "Link at least one client before moving to Submitted."
      ],
      importantChecks: ["Add a commercial summary so the submitted tender has context for reviewers."],
      canProceed: false
    });
  });

  it("blocks award when no awarded client is set", () => {
    expect(
      getTenderingStageReadiness({
        nextStage: "AWARDED",
        dueDate: "2026-04-10",
        estimatedValue: "250000",
        estimatorUserId: "user-1",
        linkedClientCount: 2,
        awardedClientCount: 0,
        contractIssuedCount: 0,
        commercialSummary: ""
      })
    ).toEqual({
      blockers: ["Mark an awarded client before moving to Awarded."],
      importantChecks: ["Capture a commercial outcome summary for the award decision."],
      canProceed: false
    });
  });

  it("allows conversion when contract issuance is complete", () => {
    expect(
      getTenderingStageReadiness({
        nextStage: "CONVERTED",
        dueDate: "2026-04-10",
        estimatedValue: "100000",
        estimatorUserId: "user-1",
        linkedClientCount: 1,
        awardedClientCount: 1,
        contractIssuedCount: 1,
        commercialSummary: "Award recommendation approved."
      })
    ).toEqual({
      blockers: [],
      importantChecks: [],
      canProceed: true
    });
  });
});
