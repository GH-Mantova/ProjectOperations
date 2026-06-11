/**
 * Logic specs for the per-entry delete affordance (PR-63b). Verifies the
 * endpoint routing — comm entries hard-delete via /clarification-notes
 * (PR-63a, emits COMM_ENTRY_DELETED audit) while TenderEntry rows
 * soft-delete via /entries — and the error surface the panel's optimistic
 * removal relies on. Modal interaction is covered by the smoke checklist
 * in the PR body (no jsdom in this workspace).
 */
import { describe, expect, it, vi } from "vitest";
import {
  deletePathFor,
  performDeleteFeedItem,
  type AuthFetch
} from "../activityClientFilter";

describe("deletePathFor", () => {
  it("routes comm entries to the clarification-notes DELETE endpoint", () => {
    expect(deletePathFor("t-1", { kind: "comm", id: "c-9" })).toBe(
      "/tenders/t-1/clarification-notes/c-9"
    );
  });

  it("routes tender entries to the entries DELETE endpoint", () => {
    expect(deletePathFor("t-1", { kind: "entry", id: "e-9" })).toBe("/tenders/t-1/entries/e-9");
  });

  it("URL-encodes ids", () => {
    expect(deletePathFor("t/1", { kind: "comm", id: "c/9" })).toBe(
      "/tenders/t%2F1/clarification-notes/c%2F9"
    );
  });
});

describe("performDeleteFeedItem", () => {
  it("issues DELETE and resolves on 204 (comm entry)", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => new Response(null, { status: 204 }));

    await performDeleteFeedItem(authFetch, "t-1", { kind: "comm", id: "c-1" });

    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/tenders/t-1/clarification-notes/c-1");
    expect((init as RequestInit | undefined)?.method).toBe("DELETE");
  });

  it("resolves on 200 (entries soft-delete returns the cancelled row)", async () => {
    const authFetch = vi.fn<AuthFetch>(async () =>
      new Response(JSON.stringify({ id: "e-1", status: "cancelled" }), { status: 200 })
    );

    await expect(
      performDeleteFeedItem(authFetch, "t-1", { kind: "entry", id: "e-1" })
    ).resolves.toBeUndefined();
  });

  it("throws the server message on failure so the panel can roll back", async () => {
    const authFetch = vi.fn<AuthFetch>(async () =>
      new Response("Clarification not found on this tender.", { status: 404 })
    );

    await expect(
      performDeleteFeedItem(authFetch, "t-1", { kind: "comm", id: "missing" })
    ).rejects.toThrow("Clarification not found on this tender.");
  });

  it("falls back to a status-coded message when the body is empty", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => new Response("", { status: 502 }));

    await expect(
      performDeleteFeedItem(authFetch, "t-1", { kind: "entry", id: "e-1" })
    ).rejects.toThrow(/502/);
  });
});
