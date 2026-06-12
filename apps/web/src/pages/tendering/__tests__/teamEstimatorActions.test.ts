/**
 * Logic specs for the Team panel's assigned-estimator dropdown (PR-63b).
 *
 * The web workspace has no jsdom / @testing-library set up, so these cover
 * the testable seam — the request helpers the TeamEstimatorPanel calls —
 * directly (same pattern as AdminUsersTab.reset-password.test.tsx). The
 * rendered dropdown is exercised via the smoke checklist in the PR body.
 */
import { describe, expect, it, vi } from "vitest";
import type { AuthFetch } from "../activityClientFilter";
import {
  estimatorInitials,
  loadEstimators,
  patchAssignedEstimator
} from "../teamEstimatorActions";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("loadEstimators", () => {
  it("GETs /users?role=estimator and returns only active users", async () => {
    const authFetch = vi.fn<AuthFetch>(async () =>
      jsonResponse({
        items: [
          { id: "u-1", firstName: "Rita", lastName: "Park", isActive: true },
          { id: "u-2", firstName: "Old", lastName: "Hand", isActive: false },
          { id: "u-3", firstName: "Sam", lastName: "Quill", isActive: true }
        ]
      })
    );

    const options = await loadEstimators(authFetch);

    expect(authFetch).toHaveBeenCalledTimes(1);
    const [path] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/users?role=estimator&page=1&pageSize=100");
    expect(options.map((o) => o.id)).toEqual(["u-1", "u-3"]);
  });

  it("throws with the server message on a non-2xx response", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => new Response("Forbidden.", { status: 403 }));
    await expect(loadEstimators(authFetch)).rejects.toThrow("Forbidden.");
  });
});

describe("patchAssignedEstimator", () => {
  it("PATCHes /tenders/:id/assigned-estimator with { userId }", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => jsonResponse({ id: "t-1" }));

    await patchAssignedEstimator(authFetch, "t-1", "u-9");

    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/tenders/t-1/assigned-estimator");
    expect((init as RequestInit | undefined)?.method).toBe("PATCH");
    expect(JSON.parse(String((init as RequestInit | undefined)?.body))).toEqual({ userId: "u-9" });
  });

  it("sends { userId: null } to clear the assignment", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => jsonResponse({ id: "t-1" }));

    await patchAssignedEstimator(authFetch, "t-1", null);

    const [, init] = authFetch.mock.calls[0] ?? [];
    expect(JSON.parse(String((init as RequestInit | undefined)?.body))).toEqual({ userId: null });
  });

  it("URL-encodes the tender id and surfaces server errors", async () => {
    const authFetch = vi.fn<AuthFetch>(async () => new Response("Tender not found.", { status: 404 }));

    await expect(patchAssignedEstimator(authFetch, "t/1", "u-1")).rejects.toThrow("Tender not found.");
    const [path] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/tenders/t%2F1/assigned-estimator");
  });
});

describe("estimatorInitials", () => {
  it("builds uppercase initials for the avatar circle", () => {
    expect(estimatorInitials({ firstName: "rita", lastName: "park" })).toBe("RP");
  });

  it("handles empty names without crashing (Unassigned-adjacent edge)", () => {
    expect(estimatorInitials({ firstName: "", lastName: "" })).toBe("");
  });
});
