/**
 * Shape specs for the New Tender wizard's quick-add helpers.
 *
 * The wizard UI is smoke-tested manually (no jsdom); the request/response
 * shape and 409 mapping live in `tenderQuickAdd.ts` so they're covered here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUICK_ADD_CLIENT_FULL_DETAILS_URL,
  QUICK_ADD_CONTACT_FULL_DETAILS_URL,
  QuickAddError,
  openFullDetailsTab,
  quickAddClient,
  quickAddContact,
  type AuthFetch
} from "../tenderQuickAdd";

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

describe("quickAddClient — request shape", () => {
  it("POSTs to /master-data/clients with just `name` when abn/email are empty", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({ id: "c1", name: "Acme Builders" }));

    const result = await quickAddClient(authFetch, { name: "Acme Builders" });

    expect(authFetch).toHaveBeenCalledTimes(1);
    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/master-data/clients");
    expect((init as RequestInit | undefined)?.method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit | undefined)?.body))).toEqual({
      name: "Acme Builders"
    });
    expect(result).toEqual({ id: "c1", name: "Acme Builders" });
  });

  it("includes abn and email when supplied and trims whitespace", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({ id: "c2", name: "Beta Group" }));

    await quickAddClient(authFetch, {
      name: "  Beta Group  ",
      abn: " 12 345 678 901 ",
      email: " ops@beta.example  "
    });

    const body = JSON.parse(String((authFetch.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({
      name: "Beta Group",
      abn: "12 345 678 901",
      email: "ops@beta.example"
    });
  });

  it("omits abn/email when supplied as whitespace-only", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({ id: "c3", name: "Ghost Co" }));

    await quickAddClient(authFetch, { name: "Ghost Co", abn: "   ", email: "" });

    const body = JSON.parse(String((authFetch.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({ name: "Ghost Co" });
  });

  it("throws QuickAddError(400) locally when name is blank (no request fired)", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({ id: "x", name: "x" }));

    let caught: unknown;
    try {
      await quickAddClient(authFetch, { name: "  " });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QuickAddError);
    expect((caught as QuickAddError).status).toBe(400);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("maps 409 to a friendly duplicate-name message that names the builder", async () => {
    const authFetch = makeAuthFetch(async () =>
      textResponse("Client name already exists.", 409)
    );

    let caught: unknown;
    try {
      await quickAddClient(authFetch, { name: "Duplicate Builder" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QuickAddError);
    expect((caught as QuickAddError).status).toBe(409);
    expect((caught as QuickAddError).message).toContain("Duplicate Builder");
    expect((caught as QuickAddError).message).toMatch(/already exists/i);
    expect((caught as QuickAddError).message).toMatch(/picker/i);
  });

  it("surfaces the server message on 400", async () => {
    const authFetch = makeAuthFetch(async () =>
      jsonResponse({ message: "name must be a string" }, 400)
    );

    let caught: unknown;
    try {
      await quickAddClient(authFetch, { name: "Blank Payload" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QuickAddError);
    expect((caught as QuickAddError).status).toBe(400);
    expect((caught as QuickAddError).message).toBe("name must be a string");
  });

  it("throws QuickAddError(500) when the response is 2xx but malformed", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({ id: "c-good" }));

    let caught: unknown;
    try {
      await quickAddClient(authFetch, { name: "Malformed Response" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QuickAddError);
    expect((caught as QuickAddError).status).toBe(500);
  });
});

describe("quickAddContact — request shape", () => {
  it("POSTs to /master-data/contacts with clientId + first/last name", async () => {
    const authFetch = makeAuthFetch(async () =>
      jsonResponse({
        id: "ct-1",
        firstName: "Ada",
        lastName: "Lovelace",
        fullName: "Ada Lovelace",
        email: null,
        phone: null
      })
    );

    const result = await quickAddContact(authFetch, {
      clientId: "client-42",
      firstName: "Ada",
      lastName: "Lovelace"
    });

    expect(authFetch).toHaveBeenCalledTimes(1);
    const [path, init] = authFetch.mock.calls[0] ?? [];
    expect(path).toBe("/master-data/contacts");
    expect((init as RequestInit | undefined)?.method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit | undefined)?.body))).toEqual({
      clientId: "client-42",
      firstName: "Ada",
      lastName: "Lovelace"
    });
    expect(result).toEqual({
      id: "ct-1",
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
      email: null,
      phone: null
    });
  });

  it("passes optional email/phone/mobile through to the server (trimmed)", async () => {
    const authFetch = makeAuthFetch(async () =>
      jsonResponse({
        id: "ct-2",
        firstName: "Grace",
        lastName: "Hopper",
        fullName: "Grace Hopper",
        email: "grace@example.com",
        phone: "07 5555 1111"
      })
    );

    await quickAddContact(authFetch, {
      clientId: "client-42",
      firstName: "  Grace  ",
      lastName: " Hopper ",
      email: " grace@example.com  ",
      phone: "  07 5555 1111 ",
      mobile: " 0400 000 000  "
    });

    const body = JSON.parse(String((authFetch.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({
      clientId: "client-42",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      phone: "07 5555 1111",
      mobile: "0400 000 000"
    });
  });

  it("does not fire the request when clientId is blank", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({}));
    let caught: unknown;
    try {
      await quickAddContact(authFetch, {
        clientId: "  ",
        firstName: "A",
        lastName: "B"
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QuickAddError);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("does not fire the request when first or last name is blank", async () => {
    const authFetch = makeAuthFetch(async () => jsonResponse({}));
    for (const dto of [
      { clientId: "c", firstName: "", lastName: "B" },
      { clientId: "c", firstName: "A", lastName: "" }
    ]) {
      let caught: unknown;
      try {
        await quickAddContact(authFetch, dto);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(QuickAddError);
    }
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("surfaces the server message on non-2xx responses", async () => {
    const authFetch = makeAuthFetch(async () => textResponse("Invalid clientId.", 400));
    let caught: unknown;
    try {
      await quickAddContact(authFetch, {
        clientId: "missing",
        firstName: "A",
        lastName: "B"
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(QuickAddError);
    expect((caught as QuickAddError).status).toBe(400);
    expect((caught as QuickAddError).message).toBe("Invalid clientId.");
  });

  it("synthesises fullName when the server response omits it", async () => {
    const authFetch = makeAuthFetch(async () =>
      jsonResponse({ id: "ct-3", firstName: "Alan", lastName: "Turing" })
    );

    const result = await quickAddContact(authFetch, {
      clientId: "c",
      firstName: "Alan",
      lastName: "Turing"
    });

    expect(result.fullName).toBe("Alan Turing");
  });
});

describe("openFullDetailsTab — window.open target", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens /tenders/clients in a new tab (builder full-details URL)", () => {
    const openMock = vi.fn();
    vi.stubGlobal("window", { open: openMock });

    openFullDetailsTab(QUICK_ADD_CLIENT_FULL_DETAILS_URL);

    expect(openMock).toHaveBeenCalledTimes(1);
    const [url, target] = openMock.mock.calls[0] ?? [];
    expect(url).toBe("/tenders/clients");
    expect(target).toBe("_blank");
  });

  it("opens /directory/contacts in a new tab (contact full-details URL)", () => {
    const openMock = vi.fn();
    vi.stubGlobal("window", { open: openMock });

    openFullDetailsTab(QUICK_ADD_CONTACT_FULL_DETAILS_URL);

    expect(openMock).toHaveBeenCalledWith(
      "/directory/contacts",
      "_blank",
      expect.stringContaining("noopener")
    );
  });

  it("is a no-op when window is undefined (SSR-safe)", () => {
    vi.stubGlobal("window", undefined);
    // Should not throw.
    expect(() => openFullDetailsTab("/anywhere")).not.toThrow();
  });
});
