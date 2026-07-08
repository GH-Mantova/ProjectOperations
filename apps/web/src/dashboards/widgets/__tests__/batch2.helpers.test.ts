import { describe, expect, it } from "vitest";
import {
  countMyDay,
  isImagePhoto,
  myDayHeadline,
  preStartsSubtitle,
  relativeDue,
  type MyDayResponse,
  type PhotoRow
} from "../batch2.helpers";

const NOW = new Date("2026-07-08T09:00:00Z");

describe("relativeDue", () => {
  it("returns 'No due date' when null or invalid", () => {
    expect(relativeDue(null, NOW)).toBe("No due date");
    expect(relativeDue("not-a-date", NOW)).toBe("No due date");
  });

  it("formats future due dates in hours or days", () => {
    expect(relativeDue("2026-07-08T15:00:00Z", NOW)).toBe("Due in 6h");
    expect(relativeDue("2026-07-11T09:00:00Z", NOW)).toBe("Due in 3d");
  });

  it("formats past due dates with Overdue prefix", () => {
    expect(relativeDue("2026-07-08T05:00:00Z", NOW)).toBe("Overdue 4h");
    expect(relativeDue("2026-07-05T09:00:00Z", NOW)).toBe("Overdue 3d");
  });
});

describe("preStartsSubtitle", () => {
  it("handles empty / null shapes", () => {
    expect(preStartsSubtitle(null)).toBe("No prestarts today yet");
    expect(preStartsSubtitle(undefined)).toBe("No prestarts today yet");
    expect(preStartsSubtitle({ count: 0, latestSubmittedAt: null })).toBe("No prestarts today yet");
  });

  it("returns Logged today when count > 0 but no timestamp", () => {
    expect(preStartsSubtitle({ count: 3, latestSubmittedAt: null })).toBe("Logged today");
  });

  it("returns Latest ... when a timestamp is present", () => {
    const sub = preStartsSubtitle({ count: 1, latestSubmittedAt: "2026-07-08T05:15:00Z" });
    expect(sub.startsWith("Latest ")).toBe(true);
  });
});

describe("isImagePhoto", () => {
  const base = { title: "x" } as never as PhotoRow;
  it("accepts image/* mime types", () => {
    expect(isImagePhoto({ ...base, mimeType: "image/jpeg" })).toBe(true);
    expect(isImagePhoto({ ...base, mimeType: "image/png" })).toBe(true);
  });
  it("rejects non-image mime types and nulls", () => {
    expect(isImagePhoto({ ...base, mimeType: "application/pdf" })).toBe(false);
    expect(isImagePhoto({ ...base, mimeType: null })).toBe(false);
  });
});

describe("countMyDay / myDayHeadline", () => {
  const empty: MyDayResponse = {
    workerProfileId: null,
    allocations: [],
    approvals: [],
    formsDue: []
  };

  it("returns zeros for a null/empty response", () => {
    expect(countMyDay(null)).toEqual({ allocations: 0, approvals: 0, formsDue: 0, overdueApprovals: 0 });
    expect(countMyDay(empty)).toEqual({ allocations: 0, approvals: 0, formsDue: 0, overdueApprovals: 0 });
  });

  it("counts each feed and splits overdue approvals", () => {
    const res: MyDayResponse = {
      workerProfileId: "w1",
      allocations: [
        {
          id: "a1",
          date: "2026-07-08",
          note: null,
          projectId: "p1",
          projectName: "P1",
          projectNumber: "P-001",
          jobRoleId: null,
          jobRoleName: null
        }
      ],
      approvals: [
        {
          id: "ap1",
          submissionId: "s1",
          stepNumber: 1,
          dueAt: null,
          overdue: true,
          submittedAt: "2026-07-08T00:00:00Z",
          submittedByName: null,
          templateName: "T",
          templateCode: "T"
        },
        {
          id: "ap2",
          submissionId: "s2",
          stepNumber: 1,
          dueAt: null,
          overdue: false,
          submittedAt: "2026-07-08T00:00:00Z",
          submittedByName: null,
          templateName: "T",
          templateCode: "T"
        }
      ],
      formsDue: [
        {
          id: "f1",
          templateId: "t1",
          templateName: "Prestart",
          templateCode: "PRESTART",
          scheduleType: "cron",
          nextRunAt: "2026-07-08T00:00:00Z",
          overdue: false
        }
      ]
    };
    expect(countMyDay(res)).toEqual({ allocations: 1, approvals: 2, formsDue: 1, overdueApprovals: 1 });
  });

  it("myDayHeadline returns 'Clear day' when nothing waits", () => {
    expect(myDayHeadline({ allocations: 0, approvals: 0, formsDue: 0, overdueApprovals: 0 })).toBe("Clear day");
  });

  it("myDayHeadline enumerates non-zero feeds with singular/plural", () => {
    expect(myDayHeadline({ allocations: 1, approvals: 2, formsDue: 1, overdueApprovals: 0 })).toBe(
      "1 allocation · 2 approvals · 1 form"
    );
  });
});
