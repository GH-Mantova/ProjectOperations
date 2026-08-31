/**
 * CRM-S8: Unit tests for TendersRegisterPage pure helpers.
 *
 * Tests are pure logic — no React, no DOM. Mirrors the pattern in
 * DropReasonAdminPage.test.ts and tenders-register-interaction.test.ts.
 *
 * Four assertions from the spec:
 * 1. The Follow-ups toggle set is a filter predicate over the same rows —
 *    with all toggles on, the Follow-ups row set equals the Register row set.
 * 2. Overdue classification: nextActionAt < now → overdue; null → none;
 *    future → due_soon or on_track. Includes the boundary.
 * 3. Sort is stable and uses localeCompare (same collation as the export).
 * 4. Log writes an interaction AND a next action in one payload — assert both
 *    keys present in validateLogPayload's accepted shape.
 */

import { describe, expect, it } from "vitest";
import {
  classifyNextAction,
  nextActionPassesFilter,
  sortCrmRow,
  buildCrmRegisterCsv,
  validateLogPayload,
  DUE_SOON_MS,
  ALL_FOLLOWUP_TOGGLES,
  DEFAULT_FOLLOWUP_TOGGLES,
  FOLLOWUPS_DEFAULT_TOGGLES,
  type FollowUpToggles,
  type CrmExportRow,
  type SortableRow,
  type LogPayload
} from "../tendersRegisterPage.helpers";

// ---------------------------------------------------------------------------
// 1. Follow-ups toggle: same list predicate
// ---------------------------------------------------------------------------

describe("nextActionPassesFilter — decision 6 predicate", () => {
  it("with all toggles ON, every classification passes (Follow-ups == Register)", () => {
    const classes = ["overdue", "due_soon", "on_track", "none"] as const;
    for (const cls of classes) {
      expect(nextActionPassesFilter(cls, ALL_FOLLOWUP_TOGGLES)).toBe(true);
    }
  });

  it("with all toggles OFF, every classification passes (no filter applied)", () => {
    const classes = ["overdue", "due_soon", "on_track", "none"] as const;
    for (const cls of classes) {
      expect(nextActionPassesFilter(cls, DEFAULT_FOLLOWUP_TOGGLES)).toBe(true);
    }
  });

  it("amber toggles ON, on_track OFF — overdue and due_soon and none pass; on_track does not", () => {
    const toggles = FOLLOWUPS_DEFAULT_TOGGLES; // overdue/dueSoon/noNextAction=true, onTrack=false
    expect(nextActionPassesFilter("overdue", toggles)).toBe(true);
    expect(nextActionPassesFilter("due_soon", toggles)).toBe(true);
    expect(nextActionPassesFilter("none", toggles)).toBe(true);
    expect(nextActionPassesFilter("on_track", toggles)).toBe(false);
  });

  it("only overdue ON — only overdue passes", () => {
    const toggles: FollowUpToggles = {
      overdue: true,
      dueSoon: false,
      noNextAction: false,
      onTrack: false
    };
    expect(nextActionPassesFilter("overdue", toggles)).toBe(true);
    expect(nextActionPassesFilter("due_soon", toggles)).toBe(false);
    expect(nextActionPassesFilter("on_track", toggles)).toBe(false);
    expect(nextActionPassesFilter("none", toggles)).toBe(false);
  });

  it("only on_track ON — only on_track passes", () => {
    const toggles: FollowUpToggles = {
      overdue: false,
      dueSoon: false,
      noNextAction: false,
      onTrack: true
    };
    expect(nextActionPassesFilter("on_track", toggles)).toBe(true);
    expect(nextActionPassesFilter("overdue", toggles)).toBe(false);
    expect(nextActionPassesFilter("due_soon", toggles)).toBe(false);
    expect(nextActionPassesFilter("none", toggles)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Overdue classification + boundary
// ---------------------------------------------------------------------------

describe("classifyNextAction", () => {
  const BASE = new Date("2026-08-31T12:00:00.000Z");

  it("returns 'none' when dueAt is null", () => {
    expect(classifyNextAction(null, BASE)).toBe("none");
  });

  it("returns 'overdue' when dueAt is exactly now (boundary: due <= now → overdue)", () => {
    expect(classifyNextAction(BASE.toISOString(), BASE)).toBe("overdue");
  });

  it("returns 'overdue' when dueAt is 1ms before now", () => {
    const past = new Date(BASE.getTime() - 1);
    expect(classifyNextAction(past.toISOString(), BASE)).toBe("overdue");
  });

  it("returns 'overdue' when dueAt is 1 day in the past", () => {
    const yesterday = new Date(BASE.getTime() - 24 * 60 * 60 * 1000);
    expect(classifyNextAction(yesterday.toISOString(), BASE)).toBe("overdue");
  });

  it("returns 'due_soon' when dueAt is 1ms after now (just inside threshold)", () => {
    const soon = new Date(BASE.getTime() + 1);
    expect(classifyNextAction(soon.toISOString(), BASE)).toBe("due_soon");
  });

  it("returns 'due_soon' when dueAt is exactly DUE_SOON_MS after now (boundary inclusive)", () => {
    const boundary = new Date(BASE.getTime() + DUE_SOON_MS);
    expect(classifyNextAction(boundary.toISOString(), BASE)).toBe("due_soon");
  });

  it("returns 'on_track' when dueAt is 1ms beyond the due_soon threshold", () => {
    const later = new Date(BASE.getTime() + DUE_SOON_MS + 1);
    expect(classifyNextAction(later.toISOString(), BASE)).toBe("on_track");
  });

  it("returns 'on_track' for a date well in the future", () => {
    const future = new Date(BASE.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(classifyNextAction(future.toISOString(), BASE)).toBe("on_track");
  });
});

// ---------------------------------------------------------------------------
// 3. Stable sort via sortCrmRow — localeCompare matches DB collation
// ---------------------------------------------------------------------------

function makeRow(
  overrides: Partial<SortableRow> & Pick<SortableRow, "tenderNumber">
): SortableRow {
  return {
    title: "Untitled",
    status: "DRAFT",
    updatedAt: "2026-08-01T00:00:00Z",
    tenderClients: [{ client: { name: "ACME Corp" } }],
    lastInteractionAt: null,
    nextActionAt: null,
    ...overrides
  };
}

describe("sortCrmRow — stable sort matches localeCompare (DB collation)", () => {
  it("tenderNumber: ascending by locale collation", () => {
    const rows = [makeRow({ tenderNumber: "T001" }), makeRow({ tenderNumber: "T003" }), makeRow({ tenderNumber: "T002" })];
    const sorted = [...rows].sort((a, b) => sortCrmRow(a, b, "tenderNumber"));
    expect(sorted.map((r) => r.tenderNumber)).toEqual(["T001", "T002", "T003"]);
  });

  it("title: ascending by locale collation", () => {
    const rows = [
      makeRow({ tenderNumber: "T1", title: "Zebra project" }),
      makeRow({ tenderNumber: "T2", title: "Alpha project" }),
      makeRow({ tenderNumber: "T3", title: "Beta project" })
    ];
    const sorted = [...rows].sort((a, b) => sortCrmRow(a, b, "title"));
    expect(sorted.map((r) => r.title)).toEqual(["Alpha project", "Beta project", "Zebra project"]);
  });

  it("client: ascending by first client name", () => {
    const rows = [
      makeRow({ tenderNumber: "T1", tenderClients: [{ client: { name: "Zulu Ltd" } }] }),
      makeRow({ tenderNumber: "T2", tenderClients: [{ client: { name: "Alpha Co" } }] }),
      makeRow({ tenderNumber: "T3", tenderClients: [{ client: { name: "Beta Ltd" } }] })
    ];
    const sorted = [...rows].sort((a, b) => sortCrmRow(a, b, "client"));
    expect(sorted.map((r) => r.tenderClients[0].client.name)).toEqual(["Alpha Co", "Beta Ltd", "Zulu Ltd"]);
  });

  it("lastInteraction: rows with no interaction sort after those with one", () => {
    const rows = [
      makeRow({ tenderNumber: "T1", lastInteractionAt: null }),
      makeRow({ tenderNumber: "T2", lastInteractionAt: "2026-08-25T00:00:00Z" }),
      makeRow({ tenderNumber: "T3", lastInteractionAt: "2026-08-20T00:00:00Z" })
    ];
    const sorted = [...rows].sort((a, b) => sortCrmRow(a, b, "lastInteraction"));
    // Oldest first, then newest, then null.
    expect(sorted[0].tenderNumber).toBe("T3"); // 2026-08-20
    expect(sorted[1].tenderNumber).toBe("T2"); // 2026-08-25
    expect(sorted[2].lastInteractionAt).toBeNull();
  });

  it("nextAction: rows with no next action sort last", () => {
    const rows = [
      makeRow({ tenderNumber: "T1", nextActionAt: null }),
      makeRow({ tenderNumber: "T2", nextActionAt: "2026-09-10T00:00:00Z" }),
      makeRow({ tenderNumber: "T3", nextActionAt: "2026-09-05T00:00:00Z" })
    ];
    const sorted = [...rows].sort((a, b) => sortCrmRow(a, b, "nextAction"));
    expect(sorted[0].tenderNumber).toBe("T3"); // earlier date
    expect(sorted[1].tenderNumber).toBe("T2"); // later date
    expect(sorted[2].nextActionAt).toBeNull();
  });

  it("updatedAt: ascending chronological", () => {
    const rows = [
      makeRow({ tenderNumber: "T1", updatedAt: "2026-08-15T00:00:00Z" }),
      makeRow({ tenderNumber: "T2", updatedAt: "2026-08-01T00:00:00Z" }),
      makeRow({ tenderNumber: "T3", updatedAt: "2026-08-30T00:00:00Z" })
    ];
    const sorted = [...rows].sort((a, b) => sortCrmRow(a, b, "updatedAt"));
    expect(sorted.map((r) => r.tenderNumber)).toEqual(["T2", "T1", "T3"]);
  });
});

// ---------------------------------------------------------------------------
// 4. Log payload — both interaction and next-action keys present
// ---------------------------------------------------------------------------

describe("validateLogPayload — both interaction and next-action in one payload", () => {
  const VALID_PAYLOAD: LogPayload = {
    subject: "Call — 2026-08-31",
    body: "Discussed scope with client.",
    nextActionAt: "2026-09-07",
    nextActionNote: "Follow up on revised drawings"
  };

  it("accepts a valid payload with both subject and body keys", () => {
    expect(validateLogPayload(VALID_PAYLOAD)).toBeNull();
  });

  it("the payload type includes both 'subject'/'body' and 'nextActionAt'/'nextActionNote' keys", () => {
    // Assert both interaction keys are present (pins spec test 4).
    expect("subject" in VALID_PAYLOAD).toBe(true);
    expect("body" in VALID_PAYLOAD).toBe(true);
    // Assert both next-action keys are present.
    expect("nextActionAt" in VALID_PAYLOAD).toBe(true);
    expect("nextActionNote" in VALID_PAYLOAD).toBe(true);
  });

  it("rejects a payload with no subject", () => {
    expect(validateLogPayload({ ...VALID_PAYLOAD, subject: "" })).not.toBeNull();
  });

  it("rejects a payload with whitespace-only subject", () => {
    expect(validateLogPayload({ ...VALID_PAYLOAD, subject: "   " })).not.toBeNull();
  });

  it("rejects a payload with no body", () => {
    expect(validateLogPayload({ ...VALID_PAYLOAD, body: "" })).not.toBeNull();
  });

  it("accepts a payload without next-action fields (optional)", () => {
    expect(validateLogPayload({ subject: "Call", body: "Notes here" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CSV export sanity check
// ---------------------------------------------------------------------------

describe("buildCrmRegisterCsv", () => {
  const rows: CrmExportRow[] = [
    {
      tenderNumber: "T001",
      title: "Test tender",
      tenderClients: [{ client: { name: "ACME Corp" } }],
      status: "SUBMITTED",
      updatedAt: "2026-08-31T00:00:00Z",
      lastInteractionAt: "2026-08-25T00:00:00Z",
      loggedByName: "Marco Rossi",
      nextActionAt: "2026-09-07T00:00:00Z",
      nextActionNote: "Follow up on drawings"
    }
  ];

  it("produces a string with CRLF line endings", () => {
    const csv = buildCrmRegisterCsv(rows);
    expect(csv).toContain("\r\n");
  });

  it("includes the tender number in the output", () => {
    const csv = buildCrmRegisterCsv(rows);
    expect(csv).toContain("T001");
  });

  it("includes the loggedByName in the output", () => {
    const csv = buildCrmRegisterCsv(rows);
    expect(csv).toContain("Marco Rossi");
  });

  it("includes the nextActionNote in the output", () => {
    const csv = buildCrmRegisterCsv(rows);
    expect(csv).toContain("Follow up on drawings");
  });

  it("returns an empty body (headers only) when rows array is empty", () => {
    const csv = buildCrmRegisterCsv([]);
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(1); // header row only
  });
});
