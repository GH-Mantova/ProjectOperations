import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// vitest in this workspace runs in node (no jsdom). Polyfill the minimum
// browser API surface consumeSsoRedirect needs before importing it.
beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map<string, string>();
    const shim: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key) => (store.has(key) ? store.get(key)! : null),
      key: (index) => Array.from(store.keys())[index] ?? null,
      removeItem: (key) => {
        store.delete(key);
      },
      setItem: (key, value) => {
        store.set(key, String(value));
      }
    };
    Object.defineProperty(globalThis, "localStorage", { value: shim, configurable: true });
  }
});

import { consumeSsoRedirect } from "../consumeSsoRedirect";

type MockInstance = {
  initialize: ReturnType<typeof vi.fn>;
  handleRedirectPromise: ReturnType<typeof vi.fn>;
};

function makeInstance(redirectResult: unknown): MockInstance {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    handleRedirectPromise: vi.fn().mockResolvedValue(redirectResult)
  };
}

describe("consumeSsoRedirect", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges the redirect idToken and seeds localStorage BEFORE returning", async () => {
    const instance = makeInstance({ idToken: "ms-id-token" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "jwt-access",
          refreshToken: "jwt-refresh",
          user: { id: "u-1", email: "marco@initialservices.net" }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await consumeSsoRedirect(instance as never);

    expect(instance.initialize).toHaveBeenCalledTimes(1);
    expect(instance.handleRedirectPromise).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({ idToken: "ms-id-token" });

    // The seeded keys are what AuthContext.readStoredState() reads on its
    // very first render — so the protected route never sees an empty token.
    expect(localStorage.getItem("project-ops.accessToken")).toBe("jwt-access");
    expect(localStorage.getItem("project-ops.refreshToken")).toBe("jwt-refresh");
    expect(JSON.parse(localStorage.getItem("project-ops.user")!)).toMatchObject({
      email: "marco@initialservices.net"
    });
  });

  it("is a no-op when there is no pending redirect (cold visit)", async () => {
    const instance = makeInstance(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await consumeSsoRedirect(instance as never);

    expect(instance.handleRedirectPromise).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("project-ops.accessToken")).toBeNull();
  });

  it("does not seed when the SSO exchange endpoint rejects", async () => {
    const instance = makeInstance({ idToken: "ms-id-token" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 401 })
    );

    await consumeSsoRedirect(instance as never);

    expect(localStorage.getItem("project-ops.accessToken")).toBeNull();
  });

  it("swallows MSAL errors so the app still boots", async () => {
    const instance: MockInstance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleRedirectPromise: vi.fn().mockRejectedValue(new Error("interaction_in_progress"))
    };

    await expect(consumeSsoRedirect(instance as never)).resolves.toBeUndefined();
    expect(localStorage.getItem("project-ops.accessToken")).toBeNull();
  });
});
