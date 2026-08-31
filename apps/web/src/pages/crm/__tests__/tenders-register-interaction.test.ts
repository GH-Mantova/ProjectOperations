import { describe, expect, it } from "vitest";

/**
 * CRM-S7: Unit tests for TendersRegisterPage interaction-log rendering logic.
 *
 * The register shows "Last interaction" and "Logged by" columns.
 * When no logged contact exists, both render "—" and the row should sort
 * last (after rows with a dated interaction).
 *
 * These tests validate the pure data-shaping logic without mounting the
 * component (no React, no DOM). The display label helpers and sort key
 * mirror what is done inline in TendersRegisterPage.tsx.
 */

type LastInteraction = {
  entityType: string;
  entityId: string;
  lastMessageAt: string; // ISO date string as returned by the API
  loggedBy: { id: string; firstName: string; lastName: string };
};

// ── Display label helpers (mirror of TendersRegisterPage.tsx) ─────────────────

function lastInteractionLabel(interaction: LastInteraction | null): string {
  return interaction ? new Date(interaction.lastMessageAt).toLocaleDateString() : "—";
}

function loggedByLabel(interaction: LastInteraction | null): string {
  if (!interaction) return "—";
  return `${interaction.loggedBy.firstName} ${interaction.loggedBy.lastName}`.trim();
}

/**
 * Sort key for the "Last interaction" column.
 * Tenders with no logged contact produce Infinity → sort last.
 * Tenders with an interaction produce its epoch ms → earlier dates sort first.
 */
function lastInteractionSortKey(interaction: LastInteraction | null): number {
  return interaction ? new Date(interaction.lastMessageAt).getTime() : Infinity;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTHOR = { id: "user-1", firstName: "Marco", lastName: "Rossi" };

const INTERACTION_NEW: LastInteraction = {
  entityType: "TENDER",
  entityId: "tender-1",
  lastMessageAt: "2026-08-31T10:00:00Z",
  loggedBy: AUTHOR
};

const INTERACTION_OLD: LastInteraction = {
  entityType: "TENDER",
  entityId: "tender-2",
  lastMessageAt: "2026-08-25T08:00:00Z",
  loggedBy: { id: "user-2", firstName: "Jane", lastName: "Smith" }
};

// ── Label rendering ───────────────────────────────────────────────────────────

describe("TendersRegisterPage interaction label rendering", () => {
  it("renders a date for a tender with a logged interaction", () => {
    const label = lastInteractionLabel(INTERACTION_NEW);
    // Formatted date must be non-empty and not the fallback
    expect(label).not.toBe("—");
    expect(label.length).toBeGreaterThan(0);
  });

  it("renders '—' for a tender with no logged interaction", () => {
    expect(lastInteractionLabel(null)).toBe("—");
  });

  it("renders the author's full name for a tender with a logged interaction", () => {
    expect(loggedByLabel(INTERACTION_NEW)).toBe("Marco Rossi");
  });

  it("renders '—' for logged-by when no interaction exists", () => {
    expect(loggedByLabel(null)).toBe("—");
  });
});

// ── Sort behaviour ────────────────────────────────────────────────────────────

describe("TendersRegisterPage interaction sort ordering", () => {
  it("a tender with no logged contact sorts after one with a logged contact", () => {
    const withContact = lastInteractionSortKey(INTERACTION_NEW);
    const noContact = lastInteractionSortKey(null);
    expect(withContact).toBeLessThan(noContact);
  });

  it("older interaction sorts before newer one (ascending sort)", () => {
    const older = lastInteractionSortKey(INTERACTION_OLD);
    const newer = lastInteractionSortKey(INTERACTION_NEW);
    expect(older).toBeLessThan(newer);
  });

  it("sorts a mixed list so no-contact tenders appear last", () => {
    const pairs: Array<{ tender: string; interaction: LastInteraction | null }> = [
      { tender: "no-contact-A", interaction: null },
      { tender: "old-contact", interaction: INTERACTION_OLD },
      { tender: "new-contact", interaction: INTERACTION_NEW },
      { tender: "no-contact-B", interaction: null }
    ];

    const sorted = [...pairs].sort(
      (a, b) => lastInteractionSortKey(a.interaction) - lastInteractionSortKey(b.interaction)
    );

    // First two must be the ones with interactions
    expect(sorted[0].tender).toBe("old-contact");
    expect(sorted[1].tender).toBe("new-contact");
    // Last two must be the no-contact ones
    expect(sorted[2].interaction).toBeNull();
    expect(sorted[3].interaction).toBeNull();
  });
});
