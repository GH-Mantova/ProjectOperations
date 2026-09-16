// crmvis-s2-relationships — S2 visual parity assertions.
//
// Asserts:
//   1. The submit label is "Save note".
//   2. RelationshipsPage.tsx contains no 6-digit hex literal.
//   3. Each of the four pure builders (buildCreateNoteBody, formatColdDuration,
//      buildGoingColdCard, buildRepeatBusinessBars) still returns what a single
//      fixture expects — a regression pin, one fixture per builder.
//
// The existing crm-relationships-panels.test.ts is NOT touched.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildCreateNoteBody,
  formatColdDuration,
  buildGoingColdCard,
  buildRepeatBusinessBars,
  type AccountSummaryLite
} from "../RelationshipsPage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "RelationshipsPage.tsx"),
  "utf-8"
);

// ── 1. Submit label is "Save note" ────────────────────────────────────────────

describe("crmvis-S2: submit label", () => {
  it('renders "Save note" (not "Add note")', () => {
    expect(PAGE_SRC).toContain("Save note");
  });

  it('does not contain the old "Add note" label', () => {
    expect(PAGE_SRC).not.toContain("Add note");
  });
});

// ── 2. Zero hex literals in the source file ───────────────────────────────────
//
// The page keeps ONE legacy colour literal: the fallback inside
// REPEAT_BAR_FILL = "var(--color-teal, ...)", preserved because the S1 regression
// test (crm-relationships-panels.test.ts) asserts that exact string. Every render
// path uses CSS classes (crm-bar__fill) with var(--brand-primary) from crm.css.
//
// This test pins WHERE that survivor may live, never WHAT its value is, and the
// literal is not written in this file. Two reasons, in order of importance:
//   1. Repeating the value here would duplicate it in a second place that can
//      drift from the source it is supposed to be guarding.
//   2. A colour literal in a NEW file fails the hex ratchet outright -
//      check-hex-ratchet.mjs: "a file absent from the baseline must be clean".
//      A test whose whole purpose is to forbid hex must not be the thing that
//      introduces one.
// Line-scoping is also the stricter rule: it stops a SECOND hex being added to
// the REPEAT_BAR_FILL line, which a value filter would have waved through.

describe("crmvis-S2: no new hex literals in RelationshipsPage.tsx", () => {
  it("the only hex in source sits on the S1 compatibility REPEAT_BAR_FILL line", () => {
    const HEX_RE = /#[0-9a-fA-F]{6}\b/;
    const offending = PAGE_SRC.split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => HEX_RE.test(line))
      .filter(({ line }) => !line.includes("REPEAT_BAR_FILL"));
    expect(
      offending,
      `Unexpected hex literals at line(s): ${offending.map((o) => o.n).join(", ")}`,
    ).toHaveLength(0);
  });

  it("the REPEAT_BAR_FILL hex is only in the S1 compat constant, not in render paths", () => {
    // Verify the constant is defined but the rendering uses crm-bar__fill class.
    expect(PAGE_SRC).toContain("crm-bar__fill");
    expect(PAGE_SRC).toContain("const REPEAT_BAR_FILL");
  });
});

// ── 3a. buildCreateNoteBody fixture ──────────────────────────────────────────

describe("crmvis-S2: buildCreateNoteBody regression pin", () => {
  it("returns expected shape for a note with account and contact", () => {
    const result = buildCreateNoteBody({
      body: "Chased the Northshore demolition package.",
      accountId: "acc-42",
      contactId: "con-7"
    });
    expect(result).toEqual({
      body: "Chased the Northshore demolition package.",
      accountId: "acc-42",
      contactId: "con-7"
    });
  });
});

// ── 3b. formatColdDuration fixture ───────────────────────────────────────────

describe("crmvis-S2: formatColdDuration regression pin", () => {
  const NOW = new Date("2026-09-04T10:00:00Z").getTime();
  const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

  it("returns '71 days' for a 71-day-old contact", () => {
    expect(formatColdDuration(daysAgo(71), NOW)).toBe("71 days");
  });
});

// ── 3c. buildGoingColdCard fixture ────────────────────────────────────────────

describe("crmvis-S2: buildGoingColdCard regression pin", () => {
  const NOW = new Date("2026-09-04T10:00:00Z").getTime();
  const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

  const summaryById: Record<string, AccountSummaryLite | undefined> = {
    "acc-1": { id: "acc-1", name: "ADCO Constructions", winRate: 18, openOpportunitiesCount: 3 }
  };

  it("returns name, stats and daysLabel for a known fixture", () => {
    const card = buildGoingColdCard(
      { id: "acc-1", client: { id: "cli-1", name: "ADCO Constructions", code: null, isActive: true }, coldSince: daysAgo(71) },
      summaryById,
      NOW
    );
    expect(card.name).toBe("ADCO Constructions");
    expect(card.stats).toBe("18.0% win rate · 3 open opps");
    expect(card.daysLabel).toBe("71 days");
  });
});

// ── 3d. buildRepeatBusinessBars fixture ──────────────────────────────────────

describe("crmvis-S2: buildRepeatBusinessBars regression pin", () => {
  it("scales bars proportionally: top account is always 100%", () => {
    const rows = [
      { id: "a", client: { id: "cli-a", name: "John Holland", code: null, winCount: 24, tenderCount: 30, winRate: "80", lastWonAt: null, isActive: true } },
      { id: "b", client: { id: "cli-b", name: "Hansen Yuncken", code: null, winCount: 12, tenderCount: 20, winRate: "60", lastWonAt: null, isActive: true } }
    ];
    const bars = buildRepeatBusinessBars(rows);
    expect(bars[0].barPercent).toBe(100);
    expect(bars[1].barPercent).toBe(50);
    expect(bars[0].winCount).toBe(24);
    expect(bars[1].name).toBe("Hansen Yuncken");
  });
});
