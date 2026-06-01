import { describe, expect, it } from "vitest";
import {
  matchesChip,
  type FilterableEntry,
  type FilterChip,
  type TenderEntryType
} from "../tenderEntriesFilters";

// Mirrors the chip set rendered by TenderEntriesPanel's FilterChips.
// Tests exercise the pure filter helper directly — the panel just wraps
// `entries.filter(e => matchesChip(e, chip, currentUserId))`.

const USER_ID = "user-001";
const OTHER_USER_ID = "user-002";

function entry(type: TenderEntryType, assigneeId: string | null = null): FilterableEntry {
  return { type, assigneeId };
}

function filterAll(entries: FilterableEntry[], chip: FilterChip, currentUserId: string | null) {
  return entries.filter((e) => matchesChip(e, chip, currentUserId));
}

describe("tenderEntriesFilters — chip predicates", () => {
  const fixture: FilterableEntry[] = [
    entry("note"),
    entry("rfi"),
    entry("email"),
    entry("call"),
    entry("meeting"),
    entry("follow_up"),
    entry("self_reminder"),
    entry("task", USER_ID),
    entry("task", OTHER_USER_ID)
  ];

  it("'all' returns every entry regardless of user", () => {
    expect(filterAll(fixture, "all", USER_ID)).toEqual(fixture);
    expect(filterAll(fixture, "all", null)).toEqual(fixture);
  });

  it("'notes' returns only entries with type 'note'", () => {
    const result = filterAll(fixture, "notes", USER_ID);
    expect(result).toHaveLength(1);
    expect(result.every((e) => e.type === "note")).toBe(true);
  });

  it("'correspondence' returns entries with type in {rfi, email, call, meeting}", () => {
    const result = filterAll(fixture, "correspondence", USER_ID);
    const types = result.map((e) => e.type).sort();
    expect(types).toEqual(["call", "email", "meeting", "rfi"]);
    // Sanity: notes/follow-ups/tasks excluded.
    expect(result.find((e) => e.type === "note")).toBeUndefined();
    expect(result.find((e) => e.type === "follow_up")).toBeUndefined();
    expect(result.find((e) => e.type === "task")).toBeUndefined();
  });

  it("'followups' returns entries with type in {follow_up, self_reminder}", () => {
    const result = filterAll(fixture, "followups", USER_ID);
    const types = result.map((e) => e.type).sort();
    expect(types).toEqual(["follow_up", "self_reminder"]);
  });

  it("'mytasks' returns only tasks whose assigneeId === currentUserId", () => {
    const result = filterAll(fixture, "mytasks", USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "task", assigneeId: USER_ID });
  });

  it("'mytasks' returns nothing when currentUserId is null (no logged-in user)", () => {
    expect(filterAll(fixture, "mytasks", null)).toEqual([]);
  });

  it("'mytasks' excludes tasks assigned to other users", () => {
    const result = filterAll(fixture, "mytasks", OTHER_USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].assigneeId).toBe(OTHER_USER_ID);
  });

  it("'mytasks' excludes non-task types even when assignee matches", () => {
    // A follow_up assigned to the current user should NOT appear under My Tasks.
    const mixed: FilterableEntry[] = [
      entry("task", USER_ID),
      entry("follow_up", USER_ID),
      entry("note", USER_ID)
    ];
    const result = filterAll(mixed, "mytasks", USER_ID);
    expect(result).toEqual([entry("task", USER_ID)]);
  });

  it("empty input returns empty array for every chip", () => {
    const chips: FilterChip[] = ["all", "notes", "correspondence", "followups", "mytasks"];
    for (const chip of chips) {
      expect(filterAll([], chip, USER_ID)).toEqual([]);
      expect(filterAll([], chip, null)).toEqual([]);
    }
  });
});
