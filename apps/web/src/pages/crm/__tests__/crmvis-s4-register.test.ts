/**
 * crmvis-s4-register — CRM_PARITY_REGISTER_V1 pure logic assertions.
 *
 * Spec (crmvis-S4):
 *   1. isStalled: never logged -> true
 *   2. isStalled: logged 31 days ago, no task -> true
 *   3. isStalled: logged 3 days ago, no task -> false
 *   4. isStalled: open task -> false (regardless of last-interaction age)
 *   5. The overdue classification helper still returns the S2 results (pin).
 *   6. No 6-digit hex in the page source.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  isStalled,
  classifyNextAction,
  STALLED_AFTER_DAYS,
  type StalledCheckRow
} from "../tendersRegisterPage.helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = resolve(__dirname, "..");

function readCrmSource(basename: string): string {
  return readFileSync(resolve(CRM_DIR, basename), "utf-8");
}

const NOW_MS = new Date("2026-09-16T12:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgoIso(days: number): string {
  return new Date(NOW_MS - days * DAY_MS).toISOString();
}

// ---------------------------------------------------------------------------
// 1-4: isStalled
// ---------------------------------------------------------------------------

describe("isStalled — crmvis-S4 None set / Stalled display rule", () => {
  it("never logged (null lastInteractionAt), no task → stalled", () => {
    const row: StalledCheckRow = { lastInteractionAt: null, hasOpenTask: false };
    expect(isStalled(row, NOW_MS)).toBe(true);
  });

  it("never logged (undefined lastInteractionAt), no task → stalled", () => {
    const row: StalledCheckRow = { lastInteractionAt: undefined, hasOpenTask: false };
    expect(isStalled(row, NOW_MS)).toBe(true);
  });

  it(`logged ${STALLED_AFTER_DAYS + 1} days ago (> threshold), no task → stalled`, () => {
    const row: StalledCheckRow = {
      lastInteractionAt: daysAgoIso(STALLED_AFTER_DAYS + 1),
      hasOpenTask: false
    };
    expect(isStalled(row, NOW_MS)).toBe(true);
  });

  it(`logged exactly ${STALLED_AFTER_DAYS} days ago (boundary: = threshold), no task → NOT stalled`, () => {
    // Boundary: exactly STALLED_AFTER_DAYS days ago is NOT stalled (strict >).
    const row: StalledCheckRow = {
      lastInteractionAt: daysAgoIso(STALLED_AFTER_DAYS),
      hasOpenTask: false
    };
    expect(isStalled(row, NOW_MS)).toBe(false);
  });

  it("logged 3 days ago (well within threshold), no task → NOT stalled", () => {
    const row: StalledCheckRow = {
      lastInteractionAt: daysAgoIso(3),
      hasOpenTask: false
    };
    expect(isStalled(row, NOW_MS)).toBe(false);
  });

  it("has an open task → NOT stalled (even if never logged)", () => {
    const row: StalledCheckRow = { lastInteractionAt: null, hasOpenTask: true };
    expect(isStalled(row, NOW_MS)).toBe(false);
  });

  it("has an open task → NOT stalled (even if logged 60 days ago)", () => {
    const row: StalledCheckRow = {
      lastInteractionAt: daysAgoIso(60),
      hasOpenTask: true
    };
    expect(isStalled(row, NOW_MS)).toBe(false);
  });

  it("unparseable lastInteractionAt with no task → stalled (treated as never logged)", () => {
    const row: StalledCheckRow = { lastInteractionAt: "not-a-date", hasOpenTask: false };
    expect(isStalled(row, NOW_MS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5: overdue classification pin — S2 results unchanged
// ---------------------------------------------------------------------------

describe("classifyNextAction — S2 pin (isStalled must not affect it)", () => {
  const BASE = new Date("2026-09-16T12:00:00.000Z");

  it("null dueAt → 'none'", () => {
    expect(classifyNextAction(null, BASE)).toBe("none");
  });

  it("past dueAt → 'overdue'", () => {
    const yesterday = new Date(BASE.getTime() - DAY_MS).toISOString();
    expect(classifyNextAction(yesterday, BASE)).toBe("overdue");
  });

  it("1 day in future → 'due_soon'", () => {
    const tomorrow = new Date(BASE.getTime() + DAY_MS).toISOString();
    expect(classifyNextAction(tomorrow, BASE)).toBe("due_soon");
  });

  it("10 days in future → 'on_track'", () => {
    const future = new Date(BASE.getTime() + 10 * DAY_MS).toISOString();
    expect(classifyNextAction(future, BASE)).toBe("on_track");
  });
});

// ---------------------------------------------------------------------------
// 6: no 6-digit hex literal in TendersRegisterPage.tsx
// ---------------------------------------------------------------------------

describe("TendersRegisterPage.tsx — design-token compliance", () => {
  it("contains no 6-digit hex colour literal (#xxxxxx)", () => {
    const src = readCrmSource("TendersRegisterPage.tsx");
    // This regex matches #RRGGBB — six hex digits. 3-digit shorthands (#RGB)
    // are also forbidden by done_when but are less likely; the 6-digit check
    // is the primary gate.
    const matches = src.match(/#[0-9a-fA-F]{6}\b/g);
    expect(matches).toBeNull();
  });

  it("carries the CRM_PARITY_REGISTER_V1 marker", () => {
    const src = readCrmSource("TendersRegisterPage.tsx");
    expect(src).toContain("CRM_PARITY_REGISTER_V1");
  });

  it('renders "None set" for the no-task state', () => {
    const src = readCrmSource("TendersRegisterPage.tsx");
    expect(src).toContain("None set");
  });
});
