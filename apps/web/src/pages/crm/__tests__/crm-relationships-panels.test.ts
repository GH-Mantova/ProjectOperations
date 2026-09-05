// crm-relationships-panels — CRM_RELATIONSHIPS_V2 pure logic assertions.
//
// The Relationships screen became one two-column grid of four panels
// (Log a contact / Recent notes | Going cold / Repeat business) instead of a
// second tab bar showing one panel at a time. The web workspace has no
// @testing-library or jsdom setup — every existing web test is pure logic
// (LeadsTriageList.archive.test.tsx says so in its header) — so the layout
// decisions are exported as pure functions and pinned here:
//
//   - buildCreateNoteBody      — now actually carries a contactId.
//   - buildGoingColdCard       — going-cold row + summary map -> card fields.
//   - formatColdDuration       — the days chip.
//   - buildRepeatBusinessBars  — repeat-business rows -> proportional bars.
//
// Plus a source-text scan pinning the marker and the absence of the inner
// tab bar this slice deleted.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildCreateNoteBody,
  buildGoingColdCard,
  buildRepeatBusinessBars,
  formatColdDuration,
  GOING_COLD_DEFAULT_THRESHOLD,
  GOING_COLD_THRESHOLD_OPTIONS,
  type AccountSummaryLite
} from "../RelationshipsPage";
import { CRM_COLD_V3 } from "../crm-cold";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "RelationshipsPage.tsx"),
  "utf-8"
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-04T10:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function coldRow(
  id: string,
  name: string | null,
  coldSince: string | null
): { id: string; client: { id: string; name: string; code: string | null; isActive: boolean } | null; coldSince: string | null } {
  return {
    id,
    client: name === null ? null : { id: `cli-${id}`, name, code: null, isActive: true },
    coldSince
  };
}

function summaryRow(
  id: string,
  winRate: number | string | null,
  openOpportunitiesCount: number
): AccountSummaryLite {
  return { id, name: `Account ${id}`, winRate, openOpportunitiesCount };
}

function repeatRow(id: string, name: string | null, winCount: number) {
  return {
    id,
    client:
      name === null
        ? null
        : {
            id: `cli-${id}`,
            name,
            code: null,
            winCount,
            tenderCount: winCount * 2,
            winRate: "50",
            lastWonAt: null,
            isActive: true
          }
  };
}

// ── buildCreateNoteBody — the contact picker's whole point ────────────────────

describe("buildCreateNoteBody — contactId is now supplied (CRM_RELATIONSHIPS_V2)", () => {
  it("carries a supplied contactId through verbatim", () => {
    const body = buildCreateNoteBody({
      body: "Called about the depot tender",
      accountId: "acc-1",
      contactId: "con-9"
    });
    expect(body).toEqual({
      body: "Called about the depot tender",
      accountId: "acc-1",
      contactId: "con-9"
    });
  });

  it("contactId matters: relationships.service writes contact.lastContactedAt only when present", () => {
    // Without a contactId the note saves but lastContactedAt is never written,
    // so the going-cold query (which selects on contacts.lastContactedAt) can
    // never drop the account. This assertion pins the key's presence.
    const body = buildCreateNoteBody({ body: "b", accountId: "acc-1", contactId: "con-9" });
    expect(Object.prototype.hasOwnProperty.call(body, "contactId")).toBe(true);
    expect(body.contactId).not.toBeNull();
  });

  it("still defaults contactId to null when omitted (existing contract unchanged)", () => {
    expect(buildCreateNoteBody({ body: "b", accountId: "acc-1" }).contactId).toBeNull();
  });

  it("normalises an explicit null contactId to null", () => {
    expect(
      buildCreateNoteBody({ body: "b", accountId: "acc-1", contactId: null }).contactId
    ).toBeNull();
  });

  it("normalises the empty-string picker value the form sends when no contact is chosen", () => {
    // The <select> value is "" when nothing is picked; the call site passes
    // `selectedContactId || null` so the service never sees "".
    const picked = "";
    const body = buildCreateNoteBody({
      body: "b",
      accountId: "acc-1",
      contactId: picked || null
    });
    expect(body.contactId).toBeNull();
  });

  it("accountId is never dropped — the service rejects a both-null note", () => {
    const body = buildCreateNoteBody({ body: "b", accountId: "acc-1", contactId: "con-9" });
    expect(body.accountId).toBe("acc-1");
  });
});

// ── formatColdDuration — the days chip ───────────────────────────────────────

describe("formatColdDuration — the going-cold days chip", () => {
  it("renders whole days below the months cut-over", () => {
    expect(formatColdDuration(daysAgo(71), NOW)).toBe("71 days");
    expect(formatColdDuration(daysAgo(64), NOW)).toBe("64 days");
  });

  it("renders months once the gap reaches 90 days", () => {
    expect(formatColdDuration(daysAgo(240), NOW)).toBe("8 months");
  });

  it("switches to months exactly at 90 days, not before", () => {
    expect(formatColdDuration(daysAgo(89), NOW)).toBe("89 days");
    expect(formatColdDuration(daysAgo(90), NOW)).toBe("3 months");
  });

  it("singularises one day and one month", () => {
    expect(formatColdDuration(daysAgo(1), NOW)).toBe("1 day");
    expect(formatColdDuration(daysAgo(45), NOW)).toBe("45 days");
  });

  it("never-contacted (null coldSince) reads 'never contacted', not '0 days'", () => {
    // CRM_COLD_V3 gave never-contacted a state of its own, which is exactly
    // what this chip has always said in words — the chip must not read as the
    // freshest number on the card.
    expect(formatColdDuration(null, NOW)).toBe("never contacted");
  });

  it("degrades to 'never contacted' on an unparseable date rather than NaN", () => {
    expect(formatColdDuration("not-a-date", NOW)).toBe("never contacted");
  });

  it("clamps a future coldSince to 0 days rather than rendering a negative", () => {
    expect(formatColdDuration(daysAgo(-5), NOW)).toBe("0 days");
  });
});

// ── buildGoingColdCard — name / stats / days chip ─────────────────────────────

describe("buildGoingColdCard — the three fields of one going-cold card", () => {
  const summaryById: Record<string, AccountSummaryLite | undefined> = {
    "acc-1": summaryRow("acc-1", 18, 3),
    "acc-2": summaryRow("acc-2", 0, 1),
    "acc-3": summaryRow("acc-3", null, 0)
  };

  it("renders name, '<win rate> win rate · <n> open opps', and the days chip", () => {
    const card = buildGoingColdCard(
      coldRow("acc-1", "Northern Excavations", daysAgo(71)),
      summaryById,
      NOW
    );
    expect(card.name).toBe("Northern Excavations");
    expect(card.stats).toBe("18.0% win rate · 3 open opps");
    expect(card.daysLabel).toBe("71 days");
  });

  it("the win rate is NOT multiplied a second time (defect 1 regression)", () => {
    // The server stores win_rate already multiplied. 18 must render 18.0%,
    // never 1800%. formatWinRate is the one formatter in the CRM.
    const card = buildGoingColdCard(coldRow("acc-1", "N", daysAgo(10)), summaryById, NOW);
    expect(card.stats).toContain("18.0%");
    expect(card.stats).not.toContain("1800");
  });

  it("clamps an impossible stored win rate through the shared helper", () => {
    const card = buildGoingColdCard(
      coldRow("acc-x", "Clamped Pty Ltd", daysAgo(10)),
      { "acc-x": summaryRow("acc-x", 200, 2) },
      NOW
    );
    expect(card.stats).toBe("100.0%+ win rate · 2 open opps");
  });

  it("singularises a single open opportunity", () => {
    const card = buildGoingColdCard(coldRow("acc-2", "Solo Ltd", daysAgo(65)), summaryById, NOW);
    expect(card.stats).toBe("0.0% win rate · 1 open opp");
  });

  it("renders an em dash for a null win rate rather than inventing a number", () => {
    const card = buildGoingColdCard(coldRow("acc-3", "Fresh Co", daysAgo(62)), summaryById, NOW);
    expect(card.stats).toBe("— win rate · 0 open opps");
  });

  it("account absent from the summary map: name and chip alone, stats null", () => {
    // The going-cold payload does not carry winRate or openOpportunitiesCount
    // and this slice does not add them. When /crm/accounts/summary has no row
    // for the account, the card renders without the sub-line.
    const card = buildGoingColdCard(
      coldRow("acc-missing", "Ghost Holdings", daysAgo(64)),
      summaryById,
      NOW
    );
    expect(card.name).toBe("Ghost Holdings");
    expect(card.stats).toBeNull();
    expect(card.daysLabel).toBe("64 days");
  });

  it("an empty summary map degrades every card to name + chip", () => {
    const card = buildGoingColdCard(coldRow("acc-1", "Northern Excavations", null), {}, NOW);
    expect(card.stats).toBeNull();
    expect(card.daysLabel).toBe("never contacted");
  });

  it("falls back to '(no client)' when the account carries no client", () => {
    const card = buildGoingColdCard(coldRow("acc-1", null, daysAgo(70)), summaryById, NOW);
    expect(card.name).toBe("(no client)");
  });
});

// ── buildRepeatBusinessBars — proportional horizontal bars ────────────────────

describe("buildRepeatBusinessBars — winCount as a share of the largest winCount", () => {
  it("the top account is always a full bar", () => {
    const bars = buildRepeatBusinessBars([
      repeatRow("a1", "Alpha Civil", 24),
      repeatRow("a2", "Bravo Group", 12),
      repeatRow("a3", "Charlie Pty", 6)
    ]);
    expect(bars[0]).toEqual({ id: "a1", name: "Alpha Civil", winCount: 24, barPercent: 100 });
    expect(bars[1].barPercent).toBe(50);
    expect(bars[2].barPercent).toBe(25);
  });

  it("preserves input order (the route already orders by lastWonAt desc)", () => {
    const bars = buildRepeatBusinessBars([
      repeatRow("a1", "Alpha Civil", 6),
      repeatRow("a2", "Bravo Group", 24)
    ]);
    expect(bars.map((b) => b.id)).toEqual(["a1", "a2"]);
    expect(bars[0].barPercent).toBe(25);
    expect(bars[1].barPercent).toBe(100);
  });

  it("single row: the only bar is 100%", () => {
    const bars = buildRepeatBusinessBars([repeatRow("a1", "Only Co", 3)]);
    expect(bars).toHaveLength(1);
    expect(bars[0].barPercent).toBe(100);
    expect(bars[0].winCount).toBe(3);
  });

  it("all-zero set: every bar is 0% and nothing divides by zero", () => {
    const bars = buildRepeatBusinessBars([
      repeatRow("a1", "Zero One", 0),
      repeatRow("a2", "Zero Two", 0)
    ]);
    expect(bars.map((b) => b.barPercent)).toEqual([0, 0]);
    expect(bars.every((b) => Number.isFinite(b.barPercent))).toBe(true);
  });

  it("single all-zero row is 0%, not NaN", () => {
    const bars = buildRepeatBusinessBars([repeatRow("a1", "Zero Only", 0)]);
    expect(bars[0].barPercent).toBe(0);
    expect(Number.isNaN(bars[0].barPercent)).toBe(false);
  });

  it("empty set returns an empty array", () => {
    expect(buildRepeatBusinessBars([])).toEqual([]);
  });

  it("rounds to a whole percentage", () => {
    const bars = buildRepeatBusinessBars([
      repeatRow("a1", "Alpha", 3),
      repeatRow("a2", "Bravo", 1)
    ]);
    expect(bars[1].barPercent).toBe(33);
  });

  it("a null client counts as zero wins and falls back to '(no client)'", () => {
    const bars = buildRepeatBusinessBars([
      repeatRow("a1", "Alpha", 10),
      repeatRow("a2", null, 0)
    ]);
    expect(bars[1].name).toBe("(no client)");
    expect(bars[1].winCount).toBe(0);
    expect(bars[1].barPercent).toBe(0);
  });
});

// ── Threshold selector — unchanged behaviour, moved into the card header ──────

describe("going-cold threshold selector — unchanged by CRM_RELATIONSHIPS_V2", () => {
  it("still offers 30 / 60 / 90", () => {
    expect(GOING_COLD_THRESHOLD_OPTIONS).toEqual([30, 60, 90]);
  });

  it("still defaults to CRM_COLD_V3.THRESHOLD_DAYS — no second constant", () => {
    expect(GOING_COLD_DEFAULT_THRESHOLD).toBe(CRM_COLD_V3.THRESHOLD_DAYS);
    expect(GOING_COLD_DEFAULT_THRESHOLD).toBe(60);
  });
});

// ── Source-text scans: the inner tab bar is gone, the marker is present ───────

describe("RelationshipsPage source — four panels, no inner tab bar", () => {
  it("is marked CRM_RELATIONSHIPS_V2", () => {
    expect(PAGE_SRC).toContain("CRM_RELATIONSHIPS_V2");
  });

  it("no longer declares an inner Tab type, activeTab state or tabStyle helper", () => {
    expect(PAGE_SRC).not.toContain('type Tab = "notes"');
    expect(PAGE_SRC).not.toContain("activeTab");
    expect(PAGE_SRC).not.toContain("function tabStyle");
    expect(PAGE_SRC).not.toContain("setActiveTab");
  });

  it("renders the four panels as one grid, not one at a time", () => {
    expect(PAGE_SRC).toContain("gridTemplateColumns");
    expect(PAGE_SRC).toContain("<LogContactPanel");
    expect(PAGE_SRC).toContain("<RecentNotesPanel");
    expect(PAGE_SRC).toContain("<GoingColdPanel");
    expect(PAGE_SRC).toContain("<RepeatBusinessPanel");
  });

  it("the heading agrees with the Accounts tab that opens it", () => {
    expect(PAGE_SRC).toContain("<h1 style={s.heading}>Accounts</h1>");
    expect(PAGE_SRC).not.toContain("Relationship intelligence");
  });

  it("the bar fill is the shared teal token, not a fresh hex", () => {
    expect(PAGE_SRC).toContain('const REPEAT_BAR_FILL = "var(--color-teal, #005B61)"');
  });

  it("the log form posts an optional contactId and clears it with the account", () => {
    expect(PAGE_SRC).toContain("contactId: selectedContactId || null");
    expect(PAGE_SRC).toContain("setSelectedContactId(\"\")");
  });

  it("keeps the account required on submit — the contact is the optional one", () => {
    expect(PAGE_SRC).toContain("selectedAccountId.length > 0");
  });

  it("does not re-point the log form at the Tenders register's log-contact write", () => {
    expect(PAGE_SRC).not.toContain("/crm/comms/log-contact");
    expect(PAGE_SRC).toContain('authFetch("/crm/relationships/notes"');
  });
});
