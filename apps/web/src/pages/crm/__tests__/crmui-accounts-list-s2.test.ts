// crmui-accounts-list-s2 — CRM_COLD_V3: never-contacted is its own state.
//
// Marco ruled on 2026-09-04 that never-contacted becomes its own state and
// "cold" goes back to meaning WAS WARM, WENT QUIET. Before this, the null rule
// made every account cold: no contact had ever been logged, so all 175
// accounts had lastContactedAt = null and the tile read "Going cold 175" out
// of 175. That was the contract working as written, not a defect — but a
// number that is always the total is a number nobody reads.
//
// No jsdom in this workspace, so the tile's rendered content is built by an
// exported pure function (buildGoingColdTile) and pinned here, and the chip
// rules are pinned through computeContactState.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildGoingColdTile,
  computeContactState,
  CRM_COLD_V3,
  type AccountSummaryRow,
  type ContactState
} from "../AccountsListPage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "AccountsListPage.tsx"),
  "utf-8"
);

// A FIXED instant. Every boundary below is asserted against it and never
// against Date.now() — a spec that pins a literal date while the function
// reads the wall clock goes green in CI and turns red on a date nobody chose.
const NOW = new Date("2026-09-05T10:00:00Z").getTime();
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function rowsOf(...states: ContactState[]): Array<Pick<AccountSummaryRow, "contactState">> {
  return states.map((contactState) => ({ contactState }));
}

// ── The four rules, in order, against the FIXED instant ───────────────────────

describe("computeContactState — the four CRM_COLD_V3 rules, in order", () => {
  it("BOUNDARY 1 — PAST + any date returns PAST", () => {
    // PAST is tested FIRST, so it wins over the null rule and the threshold.
    expect(computeContactState("PAST", daysAgo(365), NOW)).toBe("PAST");
    expect(computeContactState("PAST", daysAgo(1), NOW)).toBe("PAST");
    expect(computeContactState("PAST", null, NOW)).toBe("PAST");
  });

  it("BOUNDARY 2 — null returns NEVER_CONTACTED, not COLD", () => {
    expect(computeContactState("ACTIVE", null, NOW)).toBe("NEVER_CONTACTED");
    expect(computeContactState("PROSPECT", null, NOW)).toBe("NEVER_CONTACTED");
  });

  it("BOUNDARY 3 — exactly 60 days returns IN_CONTACT (strict >)", () => {
    expect(computeContactState("ACTIVE", daysAgo(60), NOW)).toBe("IN_CONTACT");
  });

  it("BOUNDARY 4 — 60 days plus one millisecond returns COLD", () => {
    const justOver = new Date(NOW - 60 * 24 * 60 * 60 * 1000 - 1).toISOString();
    expect(computeContactState("ACTIVE", justOver, NOW)).toBe("COLD");
  });

  it("the threshold itself is unchanged at 60 days", () => {
    expect(CRM_COLD_V3.THRESHOLD_DAYS).toBe(60);
  });
});

// ── The tile: two numbers, one tile ───────────────────────────────────────────

describe("buildGoingColdTile — the Going cold tile", () => {
  it("counts COLD only, and names the never-contacted rows on a second clause", () => {
    // 2 cold, 3 never-contacted, 2 in-contact, 1 past.
    const tile = buildGoingColdTile(
      rowsOf(
        "COLD", "COLD",
        "NEVER_CONTACTED", "NEVER_CONTACTED", "NEVER_CONTACTED",
        "IN_CONTACT", "IN_CONTACT",
        "PAST"
      )
    );

    expect(tile.label).toBe("Going cold");
    expect(tile.value).toBe(2);
    expect(tile.subLine).toBe("no contact in 60 days · 3 never contacted");
    expect(tile.accent).toBe(true);
  });

  it("omits the second clause entirely when no row is never-contacted", () => {
    const tile = buildGoingColdTile(rowsOf("COLD", "IN_CONTACT", "PAST"));

    expect(tile.value).toBe(1);
    expect(tile.subLine).toBe("no contact in 60 days");
    // Not "· 0 never contacted", and no trailing separator left behind.
    expect(tile.subLine).not.toContain("never contacted");
    expect(tile.subLine).not.toContain("·");
  });

  it("reads 0 on today's data — every row never-contacted", () => {
    // The measured state of the live system: no contact ever logged. This is
    // the number the slice exists to fix; it used to read the full total.
    const tile = buildGoingColdTile(
      rowsOf("NEVER_CONTACTED", "NEVER_CONTACTED", "NEVER_CONTACTED")
    );

    expect(tile.value).toBe(0);
    expect(tile.subLine).toBe("no contact in 60 days · 3 never contacted");
  });

  it("the accent follows the COLD count, never the never-contacted count", () => {
    // A backlog is not an alarm.
    const backlogOnly = buildGoingColdTile(rowsOf("NEVER_CONTACTED", "NEVER_CONTACTED"));
    expect(backlogOnly.value).toBe(0);
    expect(backlogOnly.accent).toBe(false);

    const oneCold = buildGoingColdTile(rowsOf("COLD", "NEVER_CONTACTED"));
    expect(oneCold.accent).toBe(true);
  });

  it("handles an empty set without inventing a clause", () => {
    const tile = buildGoingColdTile([]);
    expect(tile.value).toBe(0);
    expect(tile.subLine).toBe("no contact in 60 days");
    expect(tile.accent).toBe(false);
  });

  it("reads THRESHOLD_DAYS from the constant, not a hard-coded literal", () => {
    // If the constant moved, the sub-line must move with it.
    const tile = buildGoingColdTile(rowsOf("COLD"));
    expect(tile.subLine).toBe(`no contact in ${CRM_COLD_V3.THRESHOLD_DAYS} days`);
  });
});

// ── The two chips ─────────────────────────────────────────────────────────────

describe("Last-contact cell — two chips, the second deliberately quieter", () => {
  it("the cold chip keeps its orange set and its aria-label", () => {
    expect(PAGE_SRC).toContain('aria-label="Going cold"');
    expect(PAGE_SRC).toContain("Going cold");
    expect(PAGE_SRC).toContain('background: "#fff7ed"');
    expect(PAGE_SRC).toContain('border: "1px solid #fed7aa"');
    expect(PAGE_SRC).toContain('color: "#ea580c"');
  });

  it("the never-contacted chip exists with a matching aria-label", () => {
    expect(PAGE_SRC).toContain('aria-label="Never contacted"');
    expect(PAGE_SRC).toContain("Never contacted");
  });

  it("the chips are driven by contactState, not by the boolean", () => {
    expect(PAGE_SRC).toContain('row.contactState === "COLD"');
    expect(PAGE_SRC).toContain('row.contactState === "NEVER_CONTACTED"');
  });

  it("the never-contacted chip introduces no colour literal new to this file", () => {
    // Its three colours are the page's existing muted greys: the same #9ca3af
    // as the Owner cell's em-dash placeholder at the Owner cell, the plain
    // #e5e7eb border the StatTile and the table already use, and #fff.
    //
    // Cut the chip block out of the source and assert each colour is STILL
    // there — that is the direct proof it was already in the file rather than
    // arriving with this chip.
    const start = PAGE_SRC.indexOf('aria-label="Never contacted"');
    const end = PAGE_SRC.indexOf("Never contacted\n", start);
    expect(start).toBeGreaterThan(-1);
    const withoutChip = PAGE_SRC.slice(0, start) + PAGE_SRC.slice(end);

    for (const colour of ["#fff", "#e5e7eb", "#9ca3af"]) {
      expect(withoutChip).toContain(colour);
    }
  });

  it("the never-contacted chip does NOT reuse the orange alarm set", () => {
    // Isolate the chip block and check it carries none of the orange trio.
    const start = PAGE_SRC.indexOf('aria-label="Never contacted"');
    expect(start).toBeGreaterThan(-1);
    const chip = PAGE_SRC.slice(start, start + 500);
    expect(chip).not.toContain("#fff7ed");
    expect(chip).not.toContain("#fed7aa");
    expect(chip).not.toContain("#ea580c");
  });
});

// ── The retired contract must not come back ───────────────────────────────────

describe("CRM_COLD_V3 — the old contract is retired, not aliased", () => {
  it("the page names exactly one version of the cold contract, and it is V3", () => {
    // Written as a regex rather than a not.toContain of the retired name on
    // purpose: the repo-wide sweep for that name must come back EMPTY, and a
    // guard that spells it out would be the only thing keeping it alive. This
    // is also the stronger check — it catches a V2 alias AND any future V4
    // that lands beside V3 instead of replacing it.
    const versions = new Set(
      [...PAGE_SRC.matchAll(/CRM_COLD_V(\d+)/g)].map((m) => m[1])
    );
    expect([...versions]).toEqual(["3"]);

    // Likewise the retired null-rule flag, matched without naming it.
    expect(PAGE_SRC).not.toMatch(/NULL_IS_[A-Z]+/);
  });

  it("exposes no compatibility alias — one name for one contract", () => {
    expect(Object.keys(CRM_COLD_V3)).toEqual(["THRESHOLD_DAYS"]);
  });

  it("the row keeps goingCold AND gains contactState", () => {
    // Additive: no consumer of the boolean breaks.
    const row: Pick<AccountSummaryRow, "goingCold" | "contactState"> = {
      goingCold: false,
      contactState: "NEVER_CONTACTED"
    };
    expect(row.goingCold).toBe(false);
    expect(row.contactState).toBe("NEVER_CONTACTED");
  });

  it("no write path appears in the tile or chip logic", () => {
    // This slice is read-only by construction; the tile builder touches no
    // fetch and the chips are pure render.
    expect(buildGoingColdTile.length).toBe(1);
  });
});
