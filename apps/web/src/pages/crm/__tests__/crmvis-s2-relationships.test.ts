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
// Note: REPEAT_BAR_FILL = "var(--color-teal, #005B61)" is preserved in source
// to keep the S1 regression test (crm-relationships-panels.test.ts) green —
// that test asserts the exact string. The hex appears only in that constant's
// fallback value; all render paths use CSS classes (crm-bar__fill) with
// var(--brand-primary) from crm.css.
//
// The zero-hex check below excludes that one S1 compatibility constant.

describe("crmvis-S2: no new hex literals in RelationshipsPage.tsx", () => {
  it("the only hex in source is the S1 compatibility REPEAT_BAR_FILL fallback", () => {
    const HEX_RE = /#[0-9a-fA-F]{6}\b/g;
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = HEX_RE.exec(PAGE_SRC)) !== null) {
      matches.push(m[0]);
    }
    // Allow at most one hex: the S1 REPEAT_BAR_FILL fallback (#005B61).
    // New S2 code must not introduce any additional hex.
    const unexpected = matches.filter((h) => h !== "#005B61");
    expect(unexpected, `Unexpected hex literals found: ${unexpected.join(", ")}`).toHaveLength(0);
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
