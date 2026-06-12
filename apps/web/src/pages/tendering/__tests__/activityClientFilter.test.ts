/**
 * Logic specs for the Activity & communications client-filter sidebar
 * (PR-63b). Covers the seam the panel renders from: merged feed ordering,
 * sidebar counts, the client + chip filter, the subtitle line, and the
 * server-filter path builder. No jsdom in this workspace — the sidebar's
 * rendered behaviour is exercised via the smoke checklist in the PR body.
 */
import { describe, expect, it } from "vitest";
import {
  buildCommCreateBody,
  clientEntryCounts,
  commEntriesPath,
  commMatchesChip,
  feedSubtitle,
  isCommType,
  mergeFeed,
  visibleFeed,
  type CommEntry
} from "../activityClientFilter";

type TestEntry = {
  id: string;
  type: "note" | "rfi" | "email" | "call" | "meeting" | "follow_up" | "self_reminder" | "task";
  assigneeId: string | null;
  createdAt: string;
};

function entry(id: string, createdAt: string, type: TestEntry["type"] = "note"): TestEntry {
  return { id, type, assigneeId: null, createdAt };
}

function comm(id: string, occurredAt: string, clientId: string | null, noteType = "call"): CommEntry {
  return {
    id,
    tenderId: "t-1",
    direction: "sent",
    noteType,
    text: `comm ${id}`,
    occurredAt,
    clientId,
    createdBy: { id: "u-1", firstName: "Rita", lastName: "Park" }
  };
}

describe("mergeFeed", () => {
  it("interleaves entries and comm entries newest-first", () => {
    const feed = mergeFeed(
      [entry("e-1", "2026-06-10T10:00:00Z"), entry("e-2", "2026-06-12T10:00:00Z")],
      [comm("c-1", "2026-06-11T10:00:00Z", "client-1")]
    );
    expect(feed.map((item) => item.id)).toEqual(["e-2", "c-1", "e-1"]);
  });
});

describe("clientEntryCounts", () => {
  it("counts comm entries per linked client and ignores unlinked rows", () => {
    const counts = clientEntryCounts([
      comm("c-1", "2026-06-01T00:00:00Z", "client-1"),
      comm("c-2", "2026-06-02T00:00:00Z", "client-1"),
      comm("c-3", "2026-06-03T00:00:00Z", "client-2"),
      comm("c-4", "2026-06-04T00:00:00Z", null)
    ]);
    expect(counts).toEqual({ "client-1": 2, "client-2": 1 });
  });
});

describe("visibleFeed — client filter", () => {
  const feed = mergeFeed(
    [entry("e-1", "2026-06-10T10:00:00Z")],
    [
      comm("c-1", "2026-06-11T10:00:00Z", "client-1"),
      comm("c-2", "2026-06-12T10:00:00Z", "client-2")
    ]
  );

  it("selecting a client keeps only that client's comm entries", () => {
    const visible = visibleFeed(feed, { chip: "all", currentUserId: null, selectedClientId: "client-1" });
    expect(visible.map((item) => item.id)).toEqual(["c-1"]);
  });

  it("hides unlinked TenderEntry rows while a client is selected", () => {
    const visible = visibleFeed(feed, { chip: "all", currentUserId: null, selectedClientId: "client-2" });
    expect(visible.some((item) => item.kind === "entry")).toBe(false);
  });

  it("All clients (null) restores the full feed", () => {
    const visible = visibleFeed(feed, { chip: "all", currentUserId: null, selectedClientId: null });
    expect(visible.map((item) => item.id)).toEqual(["c-2", "c-1", "e-1"]);
  });

  it("still applies the chip filter on top of the client filter", () => {
    const mixed = mergeFeed(
      [] as TestEntry[],
      [
        comm("c-note", "2026-06-11T10:00:00Z", "client-1", "note"),
        comm("c-call", "2026-06-12T10:00:00Z", "client-1", "call")
      ]
    );
    const visible = visibleFeed(mixed, {
      chip: "correspondence",
      currentUserId: null,
      selectedClientId: "client-1"
    });
    expect(visible.map((item) => item.id)).toEqual(["c-call"]);
  });
});

describe("commMatchesChip", () => {
  it("classifies call/email/meeting/response as correspondence", () => {
    for (const noteType of ["call", "email", "meeting", "response"]) {
      expect(commMatchesChip(noteType, "correspondence")).toBe(true);
    }
    expect(commMatchesChip("note", "correspondence")).toBe(false);
  });

  it("never matches follow-up or my-tasks chips (no assignee semantics)", () => {
    expect(commMatchesChip("call", "followups")).toBe(false);
    expect(commMatchesChip("call", "mytasks")).toBe(false);
  });
});

describe("feedSubtitle", () => {
  it("names the selected client", () => {
    expect(feedSubtitle(3, "Acme Civil")).toBe("Showing 3 entries for Acme Civil");
  });

  it("falls back to (all clients) and singularises", () => {
    expect(feedSubtitle(1, null)).toBe("Showing 1 entry (all clients)");
  });
});

describe("commEntriesPath", () => {
  it("omits the query when no client is selected", () => {
    expect(commEntriesPath("t-1")).toBe("/tenders/t-1/clarification-notes");
  });

  it("appends an encoded clientId when filtering", () => {
    expect(commEntriesPath("t-1", "client/9")).toBe(
      "/tenders/t-1/clarification-notes?clientId=client%2F9"
    );
  });
});

describe("buildCommCreateBody / isCommType", () => {
  it("only note/call/email/meeting can be client-linked", () => {
    expect(["note", "call", "email", "meeting"].every(isCommType)).toBe(true);
    expect(["rfi", "follow_up", "self_reminder", "task"].some(isCommType)).toBe(false);
  });

  it("folds an optional subject into the single text field", () => {
    expect(
      buildCommCreateBody({ type: "call", subject: " Pricing ", body: " Spoke to Jo ", clientId: "client-1" })
    ).toEqual({ direction: "sent", noteType: "call", text: "Pricing — Spoke to Jo", clientId: "client-1" });
  });

  it("uses the body alone when no subject is given", () => {
    expect(
      buildCommCreateBody({ type: "note", subject: "", body: "Body only", clientId: "client-1" }).text
    ).toBe("Body only");
  });
});
