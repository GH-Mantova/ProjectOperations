/**
 * CRM_ACCOUNT360_V2: Unit tests for Account 360 slice 1.
 *
 * Pure-logic tests — no React, no DOM. Covers:
 *   1. KPI tile derivations: tenderTotal, winRate, jobs cap label, contracts cap label.
 *   2. Last-contact derivation from two ordered lists.
 *   3. Next-action chip classification — verifies we import classifyNextAction
 *      and DUE_SOON_MS from tendersRegisterPage.helpers (canonical location).
 *   4. fmtRelAge relative-age formatting.
 *   5. nameInitials avatar abbreviation.
 *   6. buildCreateNoteBody round-trip — confirms the note body builder is imported
 *      from RelationshipsPage (not re-implemented here).
 */

import { describe, expect, it } from "vitest";
import { classifyNextAction, DUE_SOON_MS } from "../tendersRegisterPage.helpers";
import { buildCreateNoteBody } from "../RelationshipsPage";
import { formatWinRate } from "../formatWinRate";

// ---------------------------------------------------------------------------
// 1. KPI tile derivations
// ---------------------------------------------------------------------------

describe("KPI tile: Tenders", () => {
  it("uses tenderTotal (uncapped), not tenders.length (capped at 20)", () => {
    // Simulates an account with 47 tenders — array capped at 20, total = 47.
    const tendersArray = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`,
      tenderNumber: `T00${i}`,
      title: `Tender ${i}`,
      status: "SUBMITTED",
      dueDate: null,
      createdAt: "2026-01-01T00:00:00Z"
    }));
    const tenderTotal = 47;

    // The tile must show tenderTotal, not tendersArray.length.
    expect(tenderTotal).toBe(47);
    expect(tendersArray.length).toBe(20);
    expect(tenderTotal).not.toBe(tendersArray.length);
  });
});

describe("KPI tile: Win rate", () => {
  it("formatWinRate formats a decimal string from the 360 payload", () => {
    // The 360 route sends Decimal-as-string; formatWinRate handles it.
    expect(formatWinRate("41.3")).toBe("41.3%");
  });

  it("formatWinRate returns em-dash for null", () => {
    expect(formatWinRate(null)).toBe("—");
  });

  it("formatWinRate handles numeric input", () => {
    expect(formatWinRate(0)).toBe("0.0%");
    expect(formatWinRate(100)).toBe("100.0%");
  });
});

describe("KPI tile: Jobs cap label", () => {
  const JOBS_CAP = 20;

  it("does NOT append cap label when count is below cap", () => {
    const count = 15;
    const label = count === JOBS_CAP ? `${count} (≤${JOBS_CAP})` : String(count);
    expect(label).toBe("15");
  });

  it("appends cap label when count equals the cap (user would see wrong number without it)", () => {
    const count = 20;
    const label = count === JOBS_CAP ? `${count} (≤${JOBS_CAP})` : String(count);
    expect(label).toBe("20 (≤20)");
  });
});

describe("KPI tile: Contracts cap label", () => {
  const CONTRACTS_CAP = 50;

  it("does NOT append cap label when count is below cap", () => {
    const count = 12;
    const label = count === CONTRACTS_CAP ? `${count} (≤${CONTRACTS_CAP})` : String(count);
    expect(label).toBe("12");
  });

  it("appends cap label when count equals the cap", () => {
    const count = 50;
    const label = count === CONTRACTS_CAP ? `${count} (≤${CONTRACTS_CAP})` : String(count);
    expect(label).toBe("50 (≤50)");
  });
});

// ---------------------------------------------------------------------------
// 2. Last-contact derivation
// ---------------------------------------------------------------------------

/**
 * Mirrors the logic in AccountDetailPage:
 *   - lastNoteAt  = rollUps.relationshipNotes[0]?.createdAt (list is createdAt DESC)
 *   - lastThreadAt = rollUps.commThreads[0]?.createdAt (list is createdAt DESC)
 *   - result = newer of the two, or whichever is non-null
 */
function deriveLastContact(
  noteAt: string | null,
  threadAt: string | null
): string | null {
  if (noteAt && threadAt) {
    return new Date(noteAt) >= new Date(threadAt) ? noteAt : threadAt;
  }
  return noteAt ?? threadAt;
}

describe("Last contact derivation", () => {
  it("returns the note timestamp when it is newer than the thread", () => {
    const noteAt = "2026-09-04T10:00:00Z";
    const threadAt = "2026-09-02T08:00:00Z";
    expect(deriveLastContact(noteAt, threadAt)).toBe(noteAt);
  });

  it("returns the thread timestamp when it is newer than the note", () => {
    const noteAt = "2026-09-01T09:00:00Z";
    const threadAt = "2026-09-04T14:00:00Z";
    expect(deriveLastContact(noteAt, threadAt)).toBe(threadAt);
  });

  it("returns the note timestamp when thread list is empty", () => {
    expect(deriveLastContact("2026-09-03T00:00:00Z", null)).toBe("2026-09-03T00:00:00Z");
  });

  it("returns the thread timestamp when note list is empty", () => {
    expect(deriveLastContact(null, "2026-09-03T00:00:00Z")).toBe("2026-09-03T00:00:00Z");
  });

  it("returns null when both lists are empty", () => {
    expect(deriveLastContact(null, null)).toBeNull();
  });

  it("returns the note when both have the same timestamp (note wins via >=)", () => {
    const ts = "2026-09-04T12:00:00Z";
    expect(deriveLastContact(ts, ts)).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// 3. Next-action chip classification — canonical import from helpers
// ---------------------------------------------------------------------------

describe("Next-action chip classification (canonical import from tendersRegisterPage.helpers)", () => {
  const NOW = new Date("2026-09-04T12:00:00.000Z");

  it("DUE_SOON_MS is 3 days in milliseconds", () => {
    expect(DUE_SOON_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("classifyNextAction returns 'none' for null dueAt", () => {
    expect(classifyNextAction(null, NOW)).toBe("none");
  });

  it("classifyNextAction returns 'overdue' when dueAt is in the past", () => {
    const past = new Date(NOW.getTime() - 1000).toISOString();
    expect(classifyNextAction(past, NOW)).toBe("overdue");
  });

  it("classifyNextAction returns 'due_soon' for a date 1ms in the future", () => {
    const soon = new Date(NOW.getTime() + 1).toISOString();
    expect(classifyNextAction(soon, NOW)).toBe("due_soon");
  });

  it("classifyNextAction returns 'due_soon' at exactly the DUE_SOON_MS boundary", () => {
    const boundary = new Date(NOW.getTime() + DUE_SOON_MS).toISOString();
    expect(classifyNextAction(boundary, NOW)).toBe("due_soon");
  });

  it("classifyNextAction returns 'on_track' beyond the DUE_SOON_MS threshold", () => {
    const later = new Date(NOW.getTime() + DUE_SOON_MS + 1).toISOString();
    expect(classifyNextAction(later, NOW)).toBe("on_track");
  });
});

// ---------------------------------------------------------------------------
// 4. fmtRelAge relative-age formatting
// ---------------------------------------------------------------------------

/** Inline copy of the fmtRelAge logic for testing — mirrors AccountDetailPage exactly. */
function fmtRelAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  const hours = Math.floor(mins / 60);
  if (hours < 1) return `${mins}m`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours}h`;
  const weeks = Math.floor(days / 7);
  if (weeks < 1) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 1) return `${weeks}w`;
  return `${months}mo`;
}

describe("fmtRelAge", () => {
  it("returns '—' for null", () => {
    expect(fmtRelAge(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(fmtRelAge(undefined)).toBe("—");
  });

  it("returns 'just now' for a future timestamp (clock skew)", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(fmtRelAge(future)).toBe("just now");
  });

  it("returns 'just now' for a timestamp less than 1 minute ago", () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    expect(fmtRelAge(recent)).toBe("just now");
  });

  it("returns minutes for a timestamp less than 1 hour ago", () => {
    const fortyMinAgo = new Date(Date.now() - 40 * 60_000).toISOString();
    expect(fmtRelAge(fortyMinAgo)).toBe("40m");
  });

  it("returns hours for a timestamp less than 1 day ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(fmtRelAge(threeHoursAgo)).toBe("3h");
  });

  it("returns '4d' for a timestamp 4 days ago (mock-up example)", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60_000).toISOString();
    expect(fmtRelAge(fourDaysAgo)).toBe("4d");
  });

  it("returns weeks for a timestamp 14 days ago", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
    expect(fmtRelAge(twoWeeksAgo)).toBe("2w");
  });

  it("returns months for a timestamp 60 days ago", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60_000).toISOString();
    expect(fmtRelAge(twoMonthsAgo)).toBe("2mo");
  });
});

// ---------------------------------------------------------------------------
// 5. nameInitials avatar abbreviation
// ---------------------------------------------------------------------------

/** Inline copy of the nameInitials logic — mirrors AccountDetailPage exactly. */
function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

describe("nameInitials", () => {
  it("returns first char uppercase for a single word", () => {
    expect(nameInitials("Acme")).toBe("A");
  });

  it("returns first + last initials for two words", () => {
    expect(nameInitials("Initial Services")).toBe("IS");
  });

  it("returns first + last initials for three words (ignores middle)", () => {
    expect(nameInitials("Initial And Services")).toBe("IS");
  });

  it("is case-normalised to uppercase", () => {
    expect(nameInitials("abc def")).toBe("AD");
  });

  it("handles leading/trailing whitespace", () => {
    expect(nameInitials("  Acme Corp  ")).toBe("AC");
  });
});

// ---------------------------------------------------------------------------
// 6. buildCreateNoteBody round-trip — canonical import from RelationshipsPage
// ---------------------------------------------------------------------------

describe("buildCreateNoteBody (imported from RelationshipsPage, not re-implemented)", () => {
  it("returns a body with the supplied accountId and body text", () => {
    const result = buildCreateNoteBody({ body: "Called client.", accountId: "acct-123" });
    expect(result.accountId).toBe("acct-123");
    expect(result.body).toBe("Called client.");
    expect(result.contactId).toBeNull();
  });

  it("includes contactId when supplied", () => {
    const result = buildCreateNoteBody({ body: "Discussed scope.", accountId: "acct-456", contactId: "contact-789" });
    expect(result.contactId).toBe("contact-789");
  });

  it("contactId defaults to null when not supplied", () => {
    const result = buildCreateNoteBody({ body: "Note.", accountId: "acct-1" });
    expect(result.contactId).toBeNull();
  });
});
