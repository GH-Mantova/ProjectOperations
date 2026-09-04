// crmui-account360-s1 — CRM_ACCOUNT360_V2 pure logic assertions.
//
// The tile figures, the next-action pick and the header avatar are all pure
// functions exported from AccountDetailPage so they can be pinned without
// jsdom. No DOM, no fetch, no timers.

import { describe, expect, it } from "vitest";
import {
  ACCOUNT360_ROLLUP_CAPS,
  deriveLastContactAt,
  formatCappedCount,
  formatRelativeAge,
  initialsFor,
  pickNextAction,
  type Account360Task
} from "../AccountDetailPage";

const NOW = new Date("2026-09-05T10:00:00Z");
const isoAgo = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ── Cap disclosure ────────────────────────────────────────────────────────────
// The 360 payload takes 20 jobs and 50 contracts. Below the cap the length is
// the true figure; at the cap it is not, so the tile must not claim it is.

describe("formatCappedCount — the Jobs and Contracts tiles never print a wrong number", () => {
  it("prints the exact length below the cap", () => {
    expect(formatCappedCount(0, 20)).toBe("0");
    expect(formatCappedCount(7, 20)).toBe("7");
    expect(formatCappedCount(19, 20)).toBe("19");
  });

  it("discloses the cap at the cap", () => {
    expect(formatCappedCount(20, 20)).toBe("20+");
    expect(formatCappedCount(50, 50)).toBe("50+");
  });

  it("caps match the server takes in accounts.service.ts", () => {
    expect(ACCOUNT360_ROLLUP_CAPS.JOBS).toBe(20);
    expect(ACCOUNT360_ROLLUP_CAPS.CONTRACTS).toBe(50);
  });
});

// ── Last contact ──────────────────────────────────────────────────────────────
// Both lists arrive createdAt desc, so element 0 of each is the true newest.

describe("deriveLastContactAt — newest of the newest note and the newest thread", () => {
  it("returns null when there is neither", () => {
    expect(deriveLastContactAt([], [])).toBeNull();
  });

  it("returns the note when there is no thread", () => {
    const iso = isoAgo(4 * DAY);
    expect(deriveLastContactAt([{ createdAt: iso }], [])).toBe(iso);
  });

  it("returns the thread when there is no note", () => {
    const iso = isoAgo(9 * DAY);
    expect(deriveLastContactAt([], [{ createdAt: iso }])).toBe(iso);
  });

  it("returns the newer of the two, whichever list it came from", () => {
    const newer = isoAgo(2 * DAY);
    const older = isoAgo(30 * DAY);
    expect(deriveLastContactAt([{ createdAt: older }], [{ createdAt: newer }])).toBe(newer);
    expect(deriveLastContactAt([{ createdAt: newer }], [{ createdAt: older }])).toBe(newer);
  });

  it("reads only element 0 of each list, because both arrive newest-first", () => {
    const newest = isoAgo(1 * DAY);
    const stale = isoAgo(400 * DAY);
    expect(
      deriveLastContactAt(
        [{ createdAt: newest }, { createdAt: stale }],
        [{ createdAt: stale }]
      )
    ).toBe(newest);
  });
});

// ── Relative age ──────────────────────────────────────────────────────────────
// The mock-up writes "4d", not a date. Asserted against a FIXED clock.

describe("formatRelativeAge — the mock-up's short age", () => {
  it("renders an em-dash for no contact", () => {
    expect(formatRelativeAge(null, NOW)).toBe("—");
  });

  it("renders sub-hour as now", () => {
    expect(formatRelativeAge(isoAgo(20 * 60 * 1000), NOW)).toBe("now");
  });

  it("renders hours below a day", () => {
    expect(formatRelativeAge(isoAgo(5 * HOUR), NOW)).toBe("5h");
    expect(formatRelativeAge(isoAgo(23 * HOUR), NOW)).toBe("23h");
  });

  it("renders days up to a year", () => {
    expect(formatRelativeAge(isoAgo(4 * DAY), NOW)).toBe("4d");
    expect(formatRelativeAge(isoAgo(364 * DAY), NOW)).toBe("364d");
  });

  it("renders years at a year and beyond", () => {
    expect(formatRelativeAge(isoAgo(365 * DAY), NOW)).toBe("1y");
    expect(formatRelativeAge(isoAgo(900 * DAY), NOW)).toBe("2y");
  });

  it("never renders a negative age for a clock-skewed future date", () => {
    expect(formatRelativeAge(new Date(NOW.getTime() + DAY).toISOString(), NOW)).toBe("now");
  });

  it("renders an em-dash for an unparseable value", () => {
    expect(formatRelativeAge("not-a-date", NOW)).toBe("—");
  });
});

// ── Next action ───────────────────────────────────────────────────────────────
// Same rule the tenders register applies per tender: earliest-due OPEN task.

function task(overrides: Partial<Account360Task> = {}): Account360Task {
  return {
    id: "task-1",
    entityId: "acc-1",
    title: "Re-price Northshore once addendum 3 lands",
    status: "OPEN",
    dueAt: isoAgo(-2 * DAY),
    assignee: null,
    ...overrides
  };
}

describe("pickNextAction — earliest-due open task for THIS account", () => {
  it("returns null when there are no tasks", () => {
    expect(pickNextAction([], "acc-1")).toBeNull();
  });

  it("ignores tasks anchored to another account", () => {
    expect(pickNextAction([task({ entityId: "acc-2" })], "acc-1")).toBeNull();
  });

  it("ignores tasks that are not OPEN", () => {
    expect(pickNextAction([task({ status: "DONE" })], "acc-1")).toBeNull();
  });

  it("returns the earliest due of several", () => {
    const soon = task({ id: "soon", dueAt: isoAgo(-1 * DAY) });
    const later = task({ id: "later", dueAt: isoAgo(-9 * DAY) });
    expect(pickNextAction([later, soon], "acc-1")?.id).toBe("soon");
  });

  it("sorts an undated task last, so a dated commitment always wins", () => {
    const undated = task({ id: "undated", dueAt: null });
    const dated = task({ id: "dated", dueAt: isoAgo(-30 * DAY) });
    expect(pickNextAction([undated, dated], "acc-1")?.id).toBe("dated");
  });

  it("returns the undated task when it is the only one", () => {
    expect(pickNextAction([task({ id: "undated", dueAt: null })], "acc-1")?.id).toBe("undated");
  });

  it("carries the assignee through, so the card can name an owner", () => {
    const withOwner = task({ assignee: { id: "u-1", firstName: "Jane", lastName: "Smith" } });
    expect(pickNextAction([withOwner], "acc-1")?.assignee?.lastName).toBe("Smith");
  });
});

// ── Header avatar ─────────────────────────────────────────────────────────────

describe("initialsFor — header avatar, no image and no dependency", () => {
  it("takes first and last initial of a multi-word name", () => {
    expect(initialsFor("Bryant Civil Contracting")).toBe("BC");
  });

  it("takes the first two letters of a single word", () => {
    expect(initialsFor("Northshore")).toBe("NO");
  });

  it("collapses runs of whitespace", () => {
    expect(initialsFor("  Acme   Group  ")).toBe("AG");
  });

  it("renders an em-dash for a missing name", () => {
    expect(initialsFor(null)).toBe("—");
    expect(initialsFor("   ")).toBe("—");
  });
});
