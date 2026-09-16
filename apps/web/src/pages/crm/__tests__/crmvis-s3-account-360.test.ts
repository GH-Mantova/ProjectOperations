// crmvis-s3-account-360 — S3 visual parity assertions for AccountDetailPage.tsx.
//
// Asserts:
//   1. No 6-digit hex literal in AccountDetailPage.tsx source.
//   2. Regression pins for pickNextAction (earliest-due open task).
//   3. Regression pins for formatRelativeAge (short relative age strings).
//   4. Header action labels present in source: "Log contact", "New thread", "Edit account".
//   5. Parity marker CRM_PARITY_ACCOUNT360_V1 is exported.
//
// All tests are pure-logic or file-source assertions — no jsdom, no fetch.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  CRM_PARITY_ACCOUNT360_V1,
  pickNextAction,
  formatRelativeAge,
  type Account360Task
} from "../AccountDetailPage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "AccountDetailPage.tsx"),
  "utf-8"
);

// ── 1. Zero hex literals in AccountDetailPage.tsx ────────────────────────────
//
// crmvis-S3 deleted the A360_* tone derivation block and every inline hex.
// The rule: no 6-digit hex colour literal anywhere in the source file.

describe("crmvis-S3: no hex colour literals in AccountDetailPage.tsx", () => {
  it("contains no #RRGGBB hex literals", () => {
    const HEX_RE = /#[0-9a-fA-F]{6}\b/g;
    const matches = PAGE_SRC.match(HEX_RE) ?? [];
    expect(
      matches,
      `Unexpected hex literals found: ${matches.join(", ")}`,
    ).toHaveLength(0);
  });
});

// ── 2. Regression pins for pickNextAction ────────────────────────────────────

const NOW_ISO = "2026-09-16T10:00:00Z";
const NOW = new Date(NOW_ISO);
const isoAgo = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;

function task(overrides: Partial<Account360Task> = {}): Account360Task {
  return {
    id: "task-1",
    entityId: "acc-1",
    title: "Follow-up call",
    status: "OPEN",
    dueAt: isoAgo(2 * DAY),
    assignee: null,
    ...overrides
  };
}

describe("crmvis-S3: pickNextAction regression pins", () => {
  it("returns null when task list is empty", () => {
    expect(pickNextAction([], "acc-1")).toBeNull();
  });

  it("returns null when all tasks belong to another account", () => {
    expect(pickNextAction([task({ entityId: "acc-99" })], "acc-1")).toBeNull();
  });

  it("returns null when tasks exist but none are OPEN", () => {
    expect(pickNextAction([task({ status: "DONE" })], "acc-1")).toBeNull();
  });

  it("returns the earliest-due open task when multiple exist", () => {
    const earlier = task({ id: "t-earlier", dueAt: isoAgo(5 * DAY) });
    const later = task({ id: "t-later", dueAt: isoAgo(1 * DAY) });
    const result = pickNextAction([later, earlier], "acc-1");
    // earlier has a smaller (earlier) due timestamp — it wins
    expect(result?.id).toBe("t-earlier");
  });

  it("sorts a null-dueAt task last (a dated commitment always wins)", () => {
    const undated = task({ id: "t-undated", dueAt: null });
    const dated = task({ id: "t-dated", dueAt: isoAgo(10 * DAY) });
    expect(pickNextAction([undated, dated], "acc-1")?.id).toBe("t-dated");
  });

  it("carries the assignee so the card can show an owner", () => {
    const withOwner = task({ assignee: { id: "u-1", firstName: "Jane", lastName: "Doe" } });
    expect(pickNextAction([withOwner], "acc-1")?.assignee?.lastName).toBe("Doe");
  });
});

// ── 3. Regression pins for formatRelativeAge ─────────────────────────────────

const HOUR = 60 * 60 * 1000;

describe("crmvis-S3: formatRelativeAge regression pins", () => {
  it("returns em-dash for null", () => {
    expect(formatRelativeAge(null, NOW)).toBe("—");
  });

  it("returns em-dash for an unparseable string", () => {
    expect(formatRelativeAge("not-a-date", NOW)).toBe("—");
  });

  it("returns 'now' for sub-hour age", () => {
    expect(formatRelativeAge(isoAgo(30 * 60 * 1000), NOW)).toBe("now");
  });

  it("returns 'now' for a future-skewed date", () => {
    expect(formatRelativeAge(new Date(NOW.getTime() + DAY).toISOString(), NOW)).toBe("now");
  });

  it("returns hours for same-day contact", () => {
    expect(formatRelativeAge(isoAgo(3 * HOUR), NOW)).toBe("3h");
  });

  it("returns days for multi-day contact", () => {
    expect(formatRelativeAge(isoAgo(7 * DAY), NOW)).toBe("7d");
  });

  it("returns years for contacts a year or more ago", () => {
    expect(formatRelativeAge(isoAgo(365 * DAY), NOW)).toBe("1y");
    expect(formatRelativeAge(isoAgo(730 * DAY), NOW)).toBe("2y");
  });
});

// ── 4. Header action labels present in source ─────────────────────────────────

describe("crmvis-S3: header action labels", () => {
  it('renders "Log contact" in the header', () => {
    expect(PAGE_SRC).toContain("Log contact");
  });

  it('renders "New thread" in the header', () => {
    expect(PAGE_SRC).toContain("New thread");
  });

  it('renders "Edit account" in the header', () => {
    expect(PAGE_SRC).toContain("Edit account");
  });
});

// ── 5. Parity marker is exported ─────────────────────────────────────────────

describe("crmvis-S3: parity marker", () => {
  it("exports CRM_PARITY_ACCOUNT360_V1 with value 'crmvis-s3'", () => {
    expect(CRM_PARITY_ACCOUNT360_V1).toBe("crmvis-s3");
  });

  it("marker is present in the source file", () => {
    expect(PAGE_SRC).toContain("CRM_PARITY_ACCOUNT360_V1");
  });
});
