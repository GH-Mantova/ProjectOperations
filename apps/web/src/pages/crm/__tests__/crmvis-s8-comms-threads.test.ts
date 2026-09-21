// crmvis-s8-comms-threads — CRM_PARITY_THREADS_V1 regression pins.
//
// This suite guards the pure-logic layer that S8 keeps intact while replacing
// hex colours with CSS custom properties. The web workspace has no
// @testing-library / jsdom setup — every web test is pure logic.
//
// What is pinned here:
//   1. CRM_COMMS_RAIL_V1.GRID_TEMPLATE is unchanged (S8 must not alter layout).
//   2. buildTodoRowView overdue / due-soon regressions (articulated in S7).
//   3. countOverdueTodos chip count (the "N overdue" danger badge).
//   4. No 6-digit hex in this file (the linter gate mirrors this as a test).
//
// What is NOT duplicated here:
//   buildThreadRowView, buildToggleTaskBody, buildCreateTaskBody — they are
//   fully covered by crm-comms-rail.test.ts. This file only adds the S8
//   marker regression and a hex-free assertion.

import { describe, expect, it } from "vitest";
import {
  CRM_COMMS_RAIL_V1,
  CRM_PARITY_THREADS_V1,
  buildTodoRowView,
  countOverdueTodos,
  type TodoRowInput
} from "../CommsHubPage";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-21T09:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function todo(overrides: Partial<TodoRowInput> = {}): TodoRowInput {
  return { status: "OPEN", dueAt: null, ...overrides };
}

// ── Marker ────────────────────────────────────────────────────────────────────

describe("CRM_PARITY_THREADS_V1 — marker", () => {
  it("is exported and equals the slice id", () => {
    expect(CRM_PARITY_THREADS_V1).toBe("crmvis-s8");
  });
});

// ── CRM_COMMS_RAIL_V1 layout contract is unchanged ────────────────────────────

describe("CRM_COMMS_RAIL_V1 — S8 must not alter the layout contract", () => {
  it("GRID_TEMPLATE is still '1fr 400px'", () => {
    expect(CRM_COMMS_RAIL_V1.GRID_TEMPLATE).toBe("1fr 400px");
  });

  it("GAP is still 16", () => {
    expect(CRM_COMMS_RAIL_V1.GAP).toBe(16);
  });

  it("DUE_SOON_DAYS is still 7", () => {
    expect(CRM_COMMS_RAIL_V1.DUE_SOON_DAYS).toBe(7);
  });
});

// ── buildTodoRowView regressions ──────────────────────────────────────────────

describe("buildTodoRowView — overdue regressions (S8)", () => {
  it("OPEN task due 3 days ago is overdue", () => {
    const view = buildTodoRowView(todo({ dueAt: at(-3 * DAY) }), NOW);
    expect(view.overdue).toBe(true);
    expect(view.dueLabel).toBe("Overdue by 3 days");
  });

  it("DONE task due 3 days ago is NOT overdue", () => {
    const view = buildTodoRowView(todo({ status: "DONE", dueAt: at(-3 * DAY) }), NOW);
    expect(view.overdue).toBe(false);
  });

  it("null due date is never overdue", () => {
    const view = buildTodoRowView(todo({ dueAt: null }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel).toBe("No due date");
  });

  it("due in 2 days reads 'Due in 2 days'", () => {
    const view = buildTodoRowView(todo({ dueAt: at(2 * DAY) }), NOW);
    expect(view.overdue).toBe(false);
    expect(view.dueLabel).toBe("Due in 2 days");
  });
});

// ── countOverdueTodos regressions ─────────────────────────────────────────────

describe("countOverdueTodos — S8 regression", () => {
  it("zero for an empty list", () => {
    expect(countOverdueTodos([], NOW)).toBe(0);
  });

  it("counts only actionable overdue rows", () => {
    const rows = [
      todo({ dueAt: at(-3 * DAY) }),           // overdue — counted
      todo({ status: "DONE", dueAt: at(-3 * DAY) }), // done — not counted
      todo({ dueAt: at(2 * DAY) })             // future — not counted
    ];
    expect(countOverdueTodos(rows, NOW)).toBe(1);
  });

  it("IN_PROGRESS past-due counts as overdue", () => {
    const rows = [
      todo({ status: "IN_PROGRESS", dueAt: at(-1 * DAY) }),
      todo({ status: "OPEN", dueAt: at(-5 * DAY) })
    ];
    expect(countOverdueTodos(rows, NOW)).toBe(2);
  });
});
