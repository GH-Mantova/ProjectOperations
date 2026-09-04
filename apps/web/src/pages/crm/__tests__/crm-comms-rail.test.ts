// crm-comms-rail — CRM_COMMS_RAIL_V1 pure logic assertions.
//
// The Comms hub's Threads screen grew a 400px right rail: an "Add a to-do"
// composer and a tickable "My to-dos" list, plus thicker thread rows. The web
// workspace has no @testing-library / jsdom setup — every web test is pure
// logic, and LeadsTriageList.archive.test.tsx says so in its header — so the
// row/chip logic is exported from CommsHubPage as pure functions and pinned
// here. The clock is injected, never read from Date.now(), so these are
// deterministic.
//
// Why the overdue rule excludes DONE:
//   The "N overdue" chip is derived from the rows already in state (no second
//   request). A finished task whose due date has passed is closed business,
//   not a problem — counting it would leave every long-lived inbox showing a
//   permanent red pill nobody can clear.
//
// Why buildCreateTaskBody is re-asserted here:
//   The rail's composer is the first place on this screen that can create a
//   to-do at all. It reuses buildCreateTaskBody unchanged, and the whole point
//   of that builder is that assigneeId is pinned to the creating user — the
//   inbox lists tasks by ?assigneeId=<userId>, so an unassigned to-do would
//   make "My to-dos" permanently empty for the person who just created it.

import { describe, expect, it } from "vitest";
import {
  CRM_COMMS_RAIL_V1,
  buildCreateTaskBody,
  buildThreadRowView,
  buildTodoRowView,
  buildToggleTaskBody,
  countOverdueTodos,
  type ThreadRowInput,
  type TodoRowInput
} from "../CommsHubPage";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-04T10:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function todo(overrides: Partial<TodoRowInput> = {}): TodoRowInput {
  return { status: "OPEN", dueAt: null, ...overrides };
}

function thread(overrides: Partial<ThreadRowInput> = {}): ThreadRowInput {
  return {
    subject: "Northshore variation pricing",
    entityType: "TENDER",
    entityId: "t-2418",
    updatedAt: at(-6 * DAY),
    createdBy: { firstName: "Renata", lastName: "Silva" },
    ...overrides
  };
}

// ── Layout contract (CRM_COMMS_RAIL_V1) ───────────────────────────────────────

describe("CRM_COMMS_RAIL_V1 — the Threads screen's grid", () => {
  it("is a two-column grid with a fixed 400px rail", () => {
    // The mock-up's Comms.dc.html artboard:
    //   display: grid; grid-template-columns: 1fr 400px; gap: 16px
    expect(CRM_COMMS_RAIL_V1.GRID_TEMPLATE).toBe("1fr 400px");
  });

  it("names exactly two columns — the screen went from 1 column to 2", () => {
    expect(CRM_COMMS_RAIL_V1.GRID_TEMPLATE.split(/\s+/)).toHaveLength(2);
  });

  it("the rail column is 400px", () => {
    expect(CRM_COMMS_RAIL_V1.GRID_TEMPLATE.split(/\s+/)[1]).toBe("400px");
  });

  it("gap between the columns (and the rail's two cards) is 16", () => {
    expect(CRM_COMMS_RAIL_V1.GAP).toBe(16);
  });

  it("due-soon window is 7 days", () => {
    expect(CRM_COMMS_RAIL_V1.DUE_SOON_DAYS).toBe(7);
  });
});

// ── buildTodoRowView — the to-do row's sub-line ───────────────────────────────

describe("buildTodoRowView — overdue", () => {
  it("an OPEN task due 3 days ago is overdue and reads 'Overdue by 3 days'", () => {
    const view = buildTodoRowView(todo({ dueAt: at(-3 * DAY) }), NOW);
    expect(view.overdue).toBe(true);
    expect(view.dueLabel).toBe("Overdue by 3 days");
  });

  it("an IN_PROGRESS task due 3 days ago is also overdue", () => {
    const view = buildTodoRowView(todo({ status: "IN_PROGRESS", dueAt: at(-3 * DAY) }), NOW);
    expect(view.overdue).toBe(true);
    expect(view.dueLabel).toBe("Overdue by 3 days");
  });

  it("singularises a one-day overdue", () => {
    expect(buildTodoRowView(todo({ dueAt: at(-1 * DAY) }), NOW).dueLabel).toBe("Overdue by 1 day");
  });

  it("less than a full day past reads 'Overdue today'", () => {
    const view = buildTodoRowView(todo({ dueAt: at(-1 * HOUR) }), NOW);
    expect(view.overdue).toBe(true);
    expect(view.dueLabel).toBe("Overdue today");
  });
});

describe("buildTodoRowView — due soon", () => {
  it("a task due in 2 days reads 'Due in 2 days' and is not overdue", () => {
    const view = buildTodoRowView(todo({ dueAt: at(2 * DAY) }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel).toBe("Due in 2 days");
  });

  it("singularises a one-day-away due date", () => {
    expect(buildTodoRowView(todo({ dueAt: at(1 * DAY) }), NOW).dueLabel).toBe("Due in 1 day");
  });

  it("later today reads 'Due today'", () => {
    const view = buildTodoRowView(todo({ dueAt: at(2 * HOUR) }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel).toBe("Due today");
  });

  it("the due-soon window is inclusive at DUE_SOON_DAYS", () => {
    const view = buildTodoRowView(todo({ dueAt: at(CRM_COMMS_RAIL_V1.DUE_SOON_DAYS * DAY) }), NOW);
    expect(view.dueLabel).toBe(`Due in ${CRM_COMMS_RAIL_V1.DUE_SOON_DAYS} days`);
  });
});

describe("buildTodoRowView — due later", () => {
  it("beyond the due-soon window it falls back to a date, not a countdown", () => {
    const view = buildTodoRowView(todo({ dueAt: at(30 * DAY) }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel.startsWith("Due ")).toBe(true);
    expect(view.dueLabel).not.toContain("Due in");
    expect(view.dueLabel).not.toContain("Overdue");
  });

  it("one day past the window is already a date", () => {
    const view = buildTodoRowView(todo({ dueAt: at((CRM_COMMS_RAIL_V1.DUE_SOON_DAYS + 1) * DAY) }), NOW);
    expect(view.dueLabel).not.toContain("Due in");
  });
});

describe("buildTodoRowView — no due date", () => {
  it("reads 'No due date' and is never overdue", () => {
    const view = buildTodoRowView(todo({ dueAt: null }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel).toBe("No due date");
  });

  it("an unparseable due date degrades to 'No due date' rather than throwing", () => {
    const view = buildTodoRowView(todo({ dueAt: "not-a-date" }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel).toBe("No due date");
  });
});

describe("buildTodoRowView — a closed task is never overdue", () => {
  it("DONE with a due date 3 days in the past is NOT overdue", () => {
    const view = buildTodoRowView(todo({ status: "DONE", dueAt: at(-3 * DAY) }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel).not.toContain("Overdue");
  });

  it("CANCELLED with a due date in the past is NOT overdue", () => {
    const view = buildTodoRowView(todo({ status: "CANCELLED", dueAt: at(-90 * DAY) }), NOW);
    expect(view.overdue).toBe(false);
  });
});

// ── countOverdueTodos — the "N overdue" chip ──────────────────────────────────

describe("countOverdueTodos — the red pill on the My to-dos card", () => {
  it("returns 0 for an empty list (the chip renders nothing at zero)", () => {
    expect(countOverdueTodos([], NOW)).toBe(0);
  });

  it("returns 0 when nothing is past due", () => {
    const rows = [
      todo({ dueAt: at(2 * DAY) }),
      todo({ dueAt: at(9 * DAY) }),
      todo({ dueAt: null })
    ];
    expect(countOverdueTodos(rows, NOW)).toBe(0);
  });

  it("counts exactly the actionable past-due rows — the mock's '1 overdue' over 3 rows", () => {
    const rows = [
      todo({ dueAt: at(-3 * DAY) }),          // overdue
      todo({ dueAt: at(2 * DAY) }),           // due soon
      todo({ dueAt: at(5 * DAY) })            // due soon
    ];
    expect(rows).toHaveLength(3);
    expect(countOverdueTodos(rows, NOW)).toBe(1);
  });

  it("a DONE row with a past due date does NOT count", () => {
    const rows = [
      todo({ status: "DONE", dueAt: at(-10 * DAY) }),
      todo({ status: "OPEN", dueAt: at(-1 * DAY) })
    ];
    expect(countOverdueTodos(rows, NOW)).toBe(1);
  });

  it("a list of only DONE past-due rows counts zero", () => {
    const rows = [
      todo({ status: "DONE", dueAt: at(-10 * DAY) }),
      todo({ status: "DONE", dueAt: at(-1 * DAY) })
    ];
    expect(countOverdueTodos(rows, NOW)).toBe(0);
  });

  it("counts IN_PROGRESS past-due rows alongside OPEN ones", () => {
    const rows = [
      todo({ status: "IN_PROGRESS", dueAt: at(-2 * DAY) }),
      todo({ status: "OPEN", dueAt: at(-4 * DAY) }),
      todo({ status: "CANCELLED", dueAt: at(-4 * DAY) })
    ];
    expect(countOverdueTodos(rows, NOW)).toBe(2);
  });
});

// ── buildThreadRowView — the thickened thread row ─────────────────────────────

describe("buildThreadRowView — avatar initials", () => {
  it("builds initials from the thread's createdBy", () => {
    expect(buildThreadRowView(thread(), NOW).initials).toBe("RS");
  });

  it("uppercases lower-case names", () => {
    const view = buildThreadRowView(
      thread({ createdBy: { firstName: "marco", lastName: "cattaneo" } }),
      NOW
    );
    expect(view.initials).toBe("MC");
  });

  it("a null createdBy degrades to an em-dash rather than a blank circle", () => {
    expect(buildThreadRowView(thread({ createdBy: null }), NOW).initials).toBe("—");
  });

  it("blank names degrade to an em-dash too", () => {
    const view = buildThreadRowView(
      thread({ createdBy: { firstName: "  ", lastName: "  " } }),
      NOW
    );
    expect(view.initials).toBe("—");
  });
});

describe("buildThreadRowView — subject", () => {
  it("carries the subject through unchanged", () => {
    expect(buildThreadRowView(thread(), NOW).subject).toBe("Northshore variation pricing");
  });

  it("a null subject renders '(no subject)', never a blank row", () => {
    expect(buildThreadRowView(thread({ subject: null }), NOW).subject).toBe("(no subject)");
  });
});

describe("buildThreadRowView — anchor chip", () => {
  it("labels the anchor from the (entityType, entityId) pair", () => {
    const view = buildThreadRowView(thread({ entityType: "TENDER", entityId: "t-2418" }), NOW);
    expect(view.anchorLabel).toContain("Tender");
    expect(view.anchorLabel).toContain("t-2418");
  });

  it("an unknown entityType still produces a visible label, never a blank chip", () => {
    const view = buildThreadRowView(thread({ entityType: "WIDGET", entityId: "w-1" }), NOW);
    expect(view.anchorLabel.trim().length).toBeGreaterThan(0);
    expect(view.anchorLabel).toContain("WIDGET");
  });
});

describe("buildThreadRowView — relative age", () => {
  it("today", () => {
    expect(buildThreadRowView(thread({ updatedAt: at(-2 * HOUR) }), NOW).ageLabel).toBe("Today");
  });

  it("yesterday", () => {
    expect(buildThreadRowView(thread({ updatedAt: at(-1 * DAY) }), NOW).ageLabel).toBe("Yesterday");
  });

  it("six days ago — the mock-up's first row", () => {
    expect(buildThreadRowView(thread({ updatedAt: at(-6 * DAY) }), NOW).ageLabel).toBe("6 days ago");
  });

  it("switches to weeks past a month", () => {
    expect(buildThreadRowView(thread({ updatedAt: at(-35 * DAY) }), NOW).ageLabel).toBe("5 weeks ago");
  });

  it("switches to months past a quarter", () => {
    expect(buildThreadRowView(thread({ updatedAt: at(-120 * DAY) }), NOW).ageLabel).toBe("4 months ago");
  });

  it("an unparseable updatedAt degrades to an em-dash rather than 'NaN days ago'", () => {
    expect(buildThreadRowView(thread({ updatedAt: "not-a-date" }), NOW).ageLabel).toBe("—");
  });
});

describe("buildThreadRowView — the row renders four fields and only four", () => {
  it("returns initials, subject, anchorLabel and ageLabel", () => {
    // The mock-up's row also carries the last-message preview and a message
    // count. listThreads returns rows through threadInclude() — createdBy and
    // nothing else — so neither is available without a new API slice.
    expect(Object.keys(buildThreadRowView(thread(), NOW)).sort()).toEqual([
      "ageLabel",
      "anchorLabel",
      "initials",
      "subject"
    ]);
  });
});

// ── buildToggleTaskBody — the tick ────────────────────────────────────────────

describe("buildToggleTaskBody — one flip shared by the rail, the tab and the anchored view", () => {
  it("OPEN ticks to DONE", () => {
    expect(buildToggleTaskBody({ status: "OPEN" })).toEqual({ status: "DONE" });
  });

  it("IN_PROGRESS ticks to DONE", () => {
    expect(buildToggleTaskBody({ status: "IN_PROGRESS" })).toEqual({ status: "DONE" });
  });

  it("DONE unticks back to OPEN", () => {
    expect(buildToggleTaskBody({ status: "DONE" })).toEqual({ status: "OPEN" });
  });

  it("CANCELLED ticks to DONE", () => {
    expect(buildToggleTaskBody({ status: "CANCELLED" })).toEqual({ status: "DONE" });
  });

  it("sends status and nothing else — PATCH must not smuggle other fields", () => {
    expect(Object.keys(buildToggleTaskBody({ status: "OPEN" }))).toEqual(["status"]);
  });
});

// ── buildCreateTaskBody — the rail's composer ─────────────────────────────────

describe("buildCreateTaskBody — the rail composer's body", () => {
  const base = {
    entityType: "TENDER",
    entityId: "t-2418",
    title: "Chase addendum 3 from the QS",
    dueAt: "2026-09-06",
    userId: "user-mc"
  };

  it("assigneeId equals the creating user", () => {
    expect(buildCreateTaskBody(base).assigneeId).toBe("user-mc");
  });

  it("assigneeId is neither null nor undefined — 'My to-dos' filters on it", () => {
    const body = buildCreateTaskBody(base);
    expect(body.assigneeId).not.toBeNull();
    expect(body.assigneeId).not.toBeUndefined();
  });

  it("carries the anchor CreateTaskDto requires (entityType + entityId)", () => {
    const body = buildCreateTaskBody(base);
    expect(body.entityType).toBe("TENDER");
    expect(body.entityId).toBe("t-2418");
  });

  it("passes an absent due date through as null, not an empty string", () => {
    expect(buildCreateTaskBody({ ...base, dueAt: null }).dueAt).toBeNull();
  });
});
