/**
 * Logic-only specs for the admin reset-password flow.
 *
 * The web workspace has no jsdom / @testing-library set up, so we
 * cover the testable seam — the `performAdminResetPassword` helper
 * the modal calls — directly. The modal itself is exercised manually
 * via the smoke checklist in the PR body.
 */
import { describe, expect, it, vi } from "vitest";
import {
  copyTextToClipboard,
  performAdminResetPassword,
  ResetPasswordError,
  type AuthFetch
} from "../resetUserPassword";

function makeAuthFetch(impl: AuthFetch) {
  return vi.fn<AuthFetch>(impl);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

describe("AdminUsersTab — performAdminResetPassword (request shape)", () => {
  it("POSTs to /admin/users/:id/reset-password and parses the temp password from the response", async () => {
    const authFetch = makeAuthFetch(async () =>
      jsonResponse({
        userId: "worker-1",
        temporaryPassword: "AbCdEf123456",
        message: "Communicate this password to the user out of band."
      })
    );

    const result = await performAdminResetPassword(authFetch, "worker-1");

    expect(authFetch).toHaveBeenCalledTimes(1);
    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/admin/users/worker-1/reset-password");
    expect((init as RequestInit | undefined)?.method).toBe("POST");
    expect(result.userId).toBe("worker-1");
    expect(result.temporaryPassword).toBe("AbCdEf123456");
    expect(result.message).toMatch(/out of band/i);
  });

  it("URL-encodes a user id with reserved characters", async () => {
    const authFetch = makeAuthFetch(async () =>
      jsonResponse({ userId: "abc/123", temporaryPassword: "PW" })
    );
    await performAdminResetPassword(authFetch, "abc/123");
    const [path] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/admin/users/abc%2F123/reset-password");
  });

  it("throws ResetPasswordError(403) with the server message when the API returns 403", async () => {
    const authFetch = makeAuthFetch(async () => textResponse("Admin access required.", 403));
    let caught: unknown;
    try {
      await performAdminResetPassword(authFetch, "worker-1");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ResetPasswordError);
    expect((caught as ResetPasswordError).status).toBe(403);
    expect((caught as ResetPasswordError).message).toBe("Admin access required.");
  });

  it("throws ResetPasswordError(400) when the admin tries to reset their own password", async () => {
    const authFetch = makeAuthFetch(async () =>
      textResponse("Use the standard reset flow for your own account.", 400)
    );
    await expect(performAdminResetPassword(authFetch, "self-1")).rejects.toBeInstanceOf(
      ResetPasswordError
    );
  });

  it("throws ResetPasswordError(404) when the target user does not exist", async () => {
    const authFetch = makeAuthFetch(async () => textResponse("User not found.", 404));
    let caught: unknown;
    try {
      await performAdminResetPassword(authFetch, "missing");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ResetPasswordError);
    expect((caught as ResetPasswordError).status).toBe(404);
  });

  it("throws a synthetic ResetPasswordError(500) when the server returns 2xx without a temp password", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({ userId: "worker-1" }));
    let caught: unknown;
    try {
      await performAdminResetPassword(authFetch, "worker-1");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ResetPasswordError);
    expect((caught as ResetPasswordError).message).toMatch(/missing the temporary password/i);
  });

  it("falls back to a generic message when the failed response body is empty", async () => {
    const authFetch = makeAuthFetch(async () => new Response("", { status: 502 }));
    let caught: unknown;
    try {
      await performAdminResetPassword(authFetch, "worker-1");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ResetPasswordError);
    expect((caught as ResetPasswordError).status).toBe(502);
    expect((caught as ResetPasswordError).message).toMatch(/502/);
  });
});

describe("AdminUsersTab — copyTextToClipboard", () => {
  it("uses navigator.clipboard.writeText when available", async () => {
    const writeText = vi.fn(async () => undefined);
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText } },
      configurable: true,
      writable: true
    });
    try {
      const ok = await copyTextToClipboard("hello");
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith("hello");
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
    }
  });

  it("returns false when neither Clipboard API nor document is available", async () => {
    const originalNavigator = globalThis.navigator;
    const originalDocument = (globalThis as { document?: unknown }).document;
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: undefined },
      configurable: true,
      writable: true
    });
    (globalThis as { document?: unknown }).document = undefined;
    try {
      const ok = await copyTextToClipboard("hello");
      expect(ok).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
      (globalThis as { document?: unknown }).document = originalDocument;
    }
  });
});
