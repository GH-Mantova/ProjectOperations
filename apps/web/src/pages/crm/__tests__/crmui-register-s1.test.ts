// crmui-register-s1 — CRM_REGISTER_V3 pure logic assertions.
//
// The register's row composition brought onto the approved mock-up: the Value
// column, the Tender cell's "Submitted …" sub-line, the relative-time half of
// Last interaction, and the Columns picker's persistence model.
//
// No jsdom; pure unit tests over the exported helpers only — same pattern as
// crmui-accounts-list-s1.test.ts and crm-s8-register-helpers.test.ts.

import { describe, expect, it } from "vitest";
import {
  formatMoneyAUD,
  formatRelativeTime,
  formatSubmittedLabel,
  normalizeColumnVisibility,
  visibleRegisterColumns,
  sortCrmRow,
  classifyNextAction,
  DEFAULT_COLUMN_VISIBILITY,
  DUE_SOON_MS,
  EM_RULE,
  REGISTER_COLUMNS,
  REGISTER_COLUMNS_STORAGE_KEY,
  type RegisterColumnVisibility,
  type SortableRow
} from "../tendersRegisterPage.helpers";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-05T10:00:00Z");
const agoMs = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function makeSortable(overrides: Partial<SortableRow> = {}): SortableRow {
  return {
    tenderNumber: "T-0001",
    title: "Some tender",
    status: "SUBMITTED",
    updatedAt: "2026-08-01T00:00:00Z",
    tenderClients: [{ client: { name: "Acme Corp" } }],
    ...overrides
  };
}

// ── Item 2: the Value column ──────────────────────────────────────────────────

describe("formatMoneyAUD — CRM_REGISTER_V3 Value column", () => {
  it("formats a Decimal-as-string in the house en-AU / AUD / no-cents format", () => {
    expect(formatMoneyAUD("1250000.00")).toBe("$1,250,000");
  });

  it("rounds to whole dollars (maximumFractionDigits: 0)", () => {
    expect(formatMoneyAUD("487500.50")).toBe("$487,501");
  });

  it("renders the em-rule for a null value — never $0", () => {
    expect(formatMoneyAUD(null)).toBe(EM_RULE);
    expect(formatMoneyAUD(null)).not.toBe("$0");
  });

  it("renders the em-rule for undefined and for an empty string", () => {
    expect(formatMoneyAUD(undefined)).toBe(EM_RULE);
    expect(formatMoneyAUD("")).toBe(EM_RULE);
    expect(formatMoneyAUD("   ")).toBe(EM_RULE);
  });

  it("a genuine zero estimate is NOT the em-rule — $0 and 'no estimate' differ", () => {
    expect(formatMoneyAUD("0.00")).toBe("$0");
  });

  it("renders the em-rule rather than junk for an unparseable value", () => {
    expect(formatMoneyAUD("not-a-number")).toBe(EM_RULE);
  });

  it("accepts a plain number as well as a Decimal string", () => {
    expect(formatMoneyAUD(98000)).toBe("$98,000");
  });
});

describe("sortCrmRow — the Value column sorts numerically, nulls last", () => {
  const cheap = makeSortable({ tenderNumber: "T-A", estimatedValue: "1000.00" });
  const dear = makeSortable({ tenderNumber: "T-B", estimatedValue: "900000.00" });
  const none = makeSortable({ tenderNumber: "T-C", estimatedValue: null });

  it("orders ascending by numeric value, not lexicographically", () => {
    // "1000.00" > "900000.00" as strings; as money it is smaller.
    expect(sortCrmRow(cheap, dear, "value")).toBeLessThan(0);
  });

  it("a null value sorts after any priced tender", () => {
    expect(sortCrmRow(dear, none, "value")).toBeLessThan(0);
    expect(sortCrmRow(none, dear, "value")).toBeGreaterThan(0);
  });

  it("two null values compare equal (never NaN)", () => {
    const result = sortCrmRow(none, { ...none, tenderNumber: "T-D" }, "value");
    expect(Number.isNaN(result)).toBe(false);
    expect(result).toBe(0);
  });

  it("sorts a mixed list with the unpriced tenders last", () => {
    const sorted = [none, dear, cheap].sort((a, b) => sortCrmRow(a, b, "value"));
    expect(sorted.map((r) => r.tenderNumber)).toEqual(["T-A", "T-B", "T-C"]);
  });
});

// ── Item 3 (shipped half): relative time ─────────────────────────────────────

describe("formatRelativeTime — the '4 days ago' half of Last interaction", () => {
  it("renders the mock-up's '4 days ago' for a four-day-old interaction", () => {
    expect(formatRelativeTime(agoMs(4 * DAY), NOW)).toBe("4 days ago");
  });

  it("renders the em-rule when there is no interaction", () => {
    expect(formatRelativeTime(null, NOW)).toBe(EM_RULE);
    expect(formatRelativeTime(undefined, NOW)).toBe(EM_RULE);
  });

  it("renders the em-rule for an unparseable timestamp", () => {
    expect(formatRelativeTime("not-a-date", NOW)).toBe(EM_RULE);
  });

  it("collapses anything under a minute to 'just now'", () => {
    expect(formatRelativeTime(agoMs(30 * 1000), NOW)).toBe("just now");
  });

  it("clamps a future timestamp (clock skew) to 'just now' rather than a negative age", () => {
    const future = new Date(NOW.getTime() + 5 * MINUTE).toISOString();
    expect(formatRelativeTime(future, NOW)).toBe("just now");
  });

  it("singularises exactly one unit", () => {
    expect(formatRelativeTime(agoMs(1 * MINUTE), NOW)).toBe("1 minute ago");
    expect(formatRelativeTime(agoMs(1 * HOUR), NOW)).toBe("1 hour ago");
    expect(formatRelativeTime(agoMs(1 * DAY), NOW)).toBe("1 day ago");
  });

  it("steps minutes → hours → days → months → years", () => {
    expect(formatRelativeTime(agoMs(45 * MINUTE), NOW)).toBe("45 minutes ago");
    expect(formatRelativeTime(agoMs(5 * HOUR), NOW)).toBe("5 hours ago");
    expect(formatRelativeTime(agoMs(20 * DAY), NOW)).toBe("20 days ago");
    expect(formatRelativeTime(agoMs(90 * DAY), NOW)).toBe("3 months ago");
    expect(formatRelativeTime(agoMs(800 * DAY), NOW)).toBe("2 years ago");
  });

  it("is pure — the same instant always yields the same string", () => {
    const iso = agoMs(4 * DAY);
    expect(formatRelativeTime(iso, NOW)).toBe(formatRelativeTime(iso, NOW));
  });
});

// ── Item 4: the Tender cell's submitted sub-line ─────────────────────────────

describe("formatSubmittedLabel — the 'Submitted 12 Aug' sub-line", () => {
  it("renders the mock-up's sub-line verbatim", () => {
    expect(formatSubmittedLabel("2026-08-12T04:30:00Z")).toBe("Submitted 12 Aug");
  });

  it("returns null for an unsubmitted tender so no empty sub-line renders", () => {
    expect(formatSubmittedLabel(null)).toBeNull();
    expect(formatSubmittedLabel(undefined)).toBeNull();
  });

  it("returns null for an unparseable timestamp", () => {
    expect(formatSubmittedLabel("not-a-date")).toBeNull();
  });

  it("is formatted in UTC so the string does not drift with the runner TZ", () => {
    // 23:30 UTC on the 12th is the 13th in Australia — the label stays the
    // wire date, so a test run in any TZ pins the same string.
    expect(formatSubmittedLabel("2026-08-12T23:30:00Z")).toBe("Submitted 12 Aug");
  });
});

// ── Items 1 & 4: the column sequence ─────────────────────────────────────────

describe("REGISTER_COLUMNS — the mock-up's column sequence", () => {
  it("is the mock-up's header row, in order", () => {
    expect(REGISTER_COLUMNS.map((c) => c.label)).toEqual([
      "Tender",
      "Client",
      "Status",
      "Value",
      "Last interaction",
      "Logged by",
      "Next action",
      "Actions"
    ]);
  });

  it("is eight columns — one fewer than the nine that shipped", () => {
    expect(REGISTER_COLUMNS).toHaveLength(8);
  });

  it("no longer carries an Updated column (it duplicated Last interaction)", () => {
    expect(REGISTER_COLUMNS.map((c) => c.label)).not.toContain("Updated");
  });

  it("no longer carries a standalone Title column (folded into Tender)", () => {
    expect(REGISTER_COLUMNS.map((c) => c.label)).not.toContain("Title");
  });

  it("carries the Value column, right-aligned and sortable", () => {
    const value = REGISTER_COLUMNS.find((c) => c.id === "value");
    expect(value).toBeDefined();
    expect(value?.align).toBe("right");
    expect(value?.sortKey).toBe("value");
  });

  it("the Tender column sorts by tender number", () => {
    expect(REGISTER_COLUMNS.find((c) => c.id === "tender")?.sortKey).toBe("tenderNumber");
  });

  it("Tender and Actions are the two columns that can never be hidden", () => {
    const notHideable = REGISTER_COLUMNS.filter((c) => !c.hideable).map((c) => c.id);
    expect(notHideable).toEqual(["tender", "actions"]);
  });
});

describe("sortCrmRow — updatedAt survives the loss of its column", () => {
  it("still sorts by updatedAt even though no header renders it", () => {
    const older = makeSortable({ updatedAt: "2026-01-01T00:00:00Z" });
    const newer = makeSortable({ updatedAt: "2026-08-01T00:00:00Z" });
    expect(sortCrmRow(older, newer, "updatedAt")).toBeLessThan(0);
  });
});

// ── Item 5: the Columns picker ───────────────────────────────────────────────

describe("Columns picker persistence — CRM_REGISTER_V3", () => {
  it("uses its own storage key, NOT the saved-views key", () => {
    expect(REGISTER_COLUMNS_STORAGE_KEY).toBe("crm-register-columns:v1");
    expect(REGISTER_COLUMNS_STORAGE_KEY).not.toBe("crm-register-saved-views:v1");
  });

  it("defaults to every column visible", () => {
    expect(Object.values(DEFAULT_COLUMN_VISIBILITY).every(Boolean)).toBe(true);
    expect(visibleRegisterColumns(DEFAULT_COLUMN_VISIBILITY)).toHaveLength(
      REGISTER_COLUMNS.length
    );
  });

  it("round-trips a stored map: a column switched off stays off", () => {
    const stored = { ...DEFAULT_COLUMN_VISIBILITY, loggedBy: false };
    const restored = normalizeColumnVisibility(JSON.parse(JSON.stringify(stored)));
    expect(restored.loggedBy).toBe(false);
    expect(visibleRegisterColumns(restored).map((c) => c.id)).not.toContain("loggedBy");
  });

  it("keeps the surviving columns in mock-up order when one is hidden", () => {
    const restored = normalizeColumnVisibility({ status: false });
    expect(visibleRegisterColumns(restored).map((c) => c.id)).toEqual([
      "tender",
      "client",
      "value",
      "lastInteraction",
      "loggedBy",
      "nextAction",
      "actions"
    ]);
  });

  it("fills missing ids with visible so a stored blob from an older shape still works", () => {
    const restored = normalizeColumnVisibility({ client: false });
    expect(restored.client).toBe(false);
    expect(restored.value).toBe(true);
    expect(restored.nextAction).toBe(true);
  });

  it("forces the non-hideable columns on however the stored blob was tampered with", () => {
    const restored = normalizeColumnVisibility({ tender: false, actions: false });
    expect(restored.tender).toBe(true);
    expect(restored.actions).toBe(true);
  });

  it("drops unknown ids instead of leaking them into the column set", () => {
    const restored = normalizeColumnVisibility({ notAColumn: false }) as Record<string, boolean>;
    expect(restored.notAColumn).toBeUndefined();
    expect(visibleRegisterColumns(restored as RegisterColumnVisibility)).toHaveLength(
      REGISTER_COLUMNS.length
    );
  });

  it("falls back to all-visible for junk in localStorage", () => {
    expect(normalizeColumnVisibility(null)).toEqual(DEFAULT_COLUMN_VISIBILITY);
    expect(normalizeColumnVisibility("nonsense")).toEqual(DEFAULT_COLUMN_VISIBILITY);
    expect(normalizeColumnVisibility([1, 2, 3])).toEqual(DEFAULT_COLUMN_VISIBILITY);
  });
});

// ── The canonical thresholds this slice must not fork ────────────────────────

describe("classifyNextAction / DUE_SOON_MS — canonical home unchanged", () => {
  it("DUE_SOON_MS is still three days", () => {
    expect(DUE_SOON_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("classification is unchanged by this slice (AccountDetailPage shares it)", () => {
    expect(classifyNextAction(null, NOW)).toBe("none");
    expect(classifyNextAction(agoMs(DAY), NOW)).toBe("overdue");
    expect(classifyNextAction(new Date(NOW.getTime() + DAY).toISOString(), NOW)).toBe("due_soon");
    expect(classifyNextAction(new Date(NOW.getTime() + 10 * DAY).toISOString(), NOW)).toBe(
      "on_track"
    );
  });
});
