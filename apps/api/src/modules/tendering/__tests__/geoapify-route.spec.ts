/**
 * geoapify-route.spec.ts -- GEOAPIFY_ROUTE_TRAVEL_V1 (scopecards-s8g)
 *
 * All HTTP is mocked via globalThis.fetch. No live call ever leaves CI.
 *
 * Covers:
 *   - Two samples (free_flow + approximated) average into a suggested index.
 *   - A failed approximated sample yields suggestedIndex: null (not half an answer).
 *   - A timeout on both attempts returns null within budget with exactly one retry.
 *   - The API key never appears in any log line, thrown error, or `detail`.
 *   - Free-flow km is used verbatim; the traffic index NEVER multiplies km.
 */

import {
  GeoapifyRouteProvider,
  GEOAPIFY_ROUTE_TRAVEL_V1
} from "../providers/geoapify-route.provider";

// ---- Version marker ---------------------------------------------------------

describe("GEOAPIFY_ROUTE_TRAVEL_V1", () => {
  it("equals the scopecards-s8g identifier", () => {
    expect(GEOAPIFY_ROUTE_TRAVEL_V1).toBe("scopecards-s8g");
  });
});

// ---- Helpers ----------------------------------------------------------------

const SECRET_KEY = "test-secret-key-DO-NOT-LEAK";
const FROM = { lat: -27.4698, lng: 153.0251 };
const TO = { lat: -27.5750, lng: 153.1020 };

/**
 * Builds a mock Geoapify response feature payload.
 * distance in metres, time in seconds -- the raw API shape.
 */
function mockResponse(distanceMetres: number, timeSeconds: number) {
  return {
    ok: true,
    json: async () => ({
      features: [
        {
          properties: {
            distance: distanceMetres,
            distance_units: "meters",
            time: timeSeconds
          }
        }
      ]
    })
  };
}

// ---- Fetch stubs and log capture -------------------------------------------

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const originalLog = console.log;
const originalError = console.error;

let logCapture: string[] = [];

beforeEach(() => {
  logCapture = [];
  // Capture every Nest Logger.warn / .log / .error output (they route to console).
  console.warn = (...args: unknown[]) => {
    logCapture.push(args.map(String).join(" "));
  };
  console.log = (...args: unknown[]) => {
    logCapture.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    logCapture.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  console.log = originalLog;
  console.error = originalError;
});

// ---- The tests --------------------------------------------------------------

describe("GeoapifyRouteProvider", () => {
  it("uses free-flow km verbatim and averages both samples into an index (2 dp, floor 1.00)", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      if (url.includes("traffic=free_flow")) {
        // 21.6 km, 26 min (1560 s) free-flow
        return mockResponse(21_600, 1560);
      }
      // approximated: 32 min (1920 s) -- 1920/1560 = 1.2307 -> 1.23
      return mockResponse(21_600, 1920);
    }) as never;

    const provider = new GeoapifyRouteProvider(SECRET_KEY);
    const est = await provider.resolve(FROM, TO);

    expect(est).not.toBeNull();
    // Km comes from free-flow distance, unchanged by index.
    expect(est!.km).toBe(21.6);
    expect(est!.minutesOneWay).toBe(26);
    expect(est!.source).toBe("route");
    // 1920 / 1560 = 1.2307... -> 1.23
    const withIdx = est as unknown as { suggestedIndex: number | null };
    expect(withIdx.suggestedIndex).toBe(1.23);
    // Two calls: one per traffic model.
    expect(calls.length).toBe(2);
  });

  it("floors the suggested index at 1.00 (approximated cannot be faster than free-flow)", async () => {
    globalThis.fetch = (async (url: string) => {
      if (url.includes("traffic=free_flow")) return mockResponse(10_000, 1000);
      // Approximated somehow faster (shouldn't happen, but the API can return it)
      return mockResponse(10_000, 800);
    }) as never;

    const provider = new GeoapifyRouteProvider(SECRET_KEY);
    const est = await provider.resolve(FROM, TO);
    const withIdx = est as unknown as { suggestedIndex: number | null };
    // 800/1000 = 0.80 -> floored to 1.00
    expect(withIdx.suggestedIndex).toBe(1.0);
  });

  it("gives suggestedIndex: null when approximated fails (not half an answer)", async () => {
    globalThis.fetch = (async (url: string) => {
      if (url.includes("traffic=free_flow")) {
        return mockResponse(15_000, 1200);
      }
      // approximated fails with a 5xx
      return { ok: false, status: 503, json: async () => ({}) };
    }) as never;

    const provider = new GeoapifyRouteProvider(SECRET_KEY);
    const est = await provider.resolve(FROM, TO);

    expect(est).not.toBeNull();
    expect(est!.km).toBe(15);
    const withIdx = est as unknown as { suggestedIndex: number | null };
    // No half-answer: index must be null when either sample failed.
    expect(withIdx.suggestedIndex).toBeNull();
  });

  it("returns null when free-flow fails (routing is required)", async () => {
    globalThis.fetch = (async (url: string) => {
      if (url.includes("traffic=free_flow")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return mockResponse(15_000, 1200);
    }) as never;

    const provider = new GeoapifyRouteProvider(SECRET_KEY);
    const est = await provider.resolve(FROM, TO);
    expect(est).toBeNull();
  });

  it("times out and retries exactly once, then returns null", async () => {
    let attempts = 0;
    globalThis.fetch = ((_url: string, opts?: { signal?: AbortSignal }) => {
      attempts++;
      // Return a promise that never resolves -- the AbortController will fire.
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as never;

    // We fake timers so 5s abort fires immediately.
    jest.useFakeTimers();
    const provider = new GeoapifyRouteProvider(SECRET_KEY);
    const promise = provider.resolve(FROM, TO);
    // Advance past the 5s timeout twice (initial + one retry) per request.
    // With Promise.all two requests are in flight; each has attempts = 2.
    await jest.advanceTimersByTimeAsync(6000);
    await jest.advanceTimersByTimeAsync(6000);
    const est = await promise;
    jest.useRealTimers();

    expect(est).toBeNull();
    // Two traffic models x (1 initial + 1 retry) = 4 total attempts.
    expect(attempts).toBe(4);
  });

  it("never leaks the API key in any log line, error, or the returned detail string", async () => {
    globalThis.fetch = (async (url: string) => {
      if (url.includes("traffic=free_flow")) return mockResponse(20_000, 1500);
      // Force a warn path on approximated with a non-ok response.
      return { ok: false, status: 429, json: async () => ({}) };
    }) as never;

    const provider = new GeoapifyRouteProvider(SECRET_KEY);
    const est = await provider.resolve(FROM, TO);

    // Assert the key does not appear anywhere it could be read from.
    const capturedText = logCapture.join("\n");
    expect(capturedText).not.toContain(SECRET_KEY);
    expect(est).not.toBeNull();
    expect(est!.detail).not.toContain(SECRET_KEY);
  });

  it("labels the index as MODELLED, not measured (never uses the word 'measured' or 'peak')", async () => {
    globalThis.fetch = (async (url: string) => {
      if (url.includes("traffic=free_flow")) return mockResponse(20_000, 1500);
      return mockResponse(20_000, 1800);
    }) as never;

    const provider = new GeoapifyRouteProvider(SECRET_KEY);
    const est = await provider.resolve(FROM, TO);

    expect(est!.detail.toLowerCase()).not.toContain("measured");
    expect(est!.detail.toLowerCase()).not.toContain("peak");
    // Positive assertion: it does describe the number as a modelled allowance.
    expect(est!.detail.toLowerCase()).toContain("modelled allowance");
  });

  it("passes the configured vehicle mode to the Routing API", async () => {
    let capturedMode: string | null = null;
    globalThis.fetch = (async (url: string) => {
      const match = /mode=([^&]+)/.exec(url);
      if (match) capturedMode = decodeURIComponent(match[1]);
      if (url.includes("traffic=free_flow")) return mockResponse(20_000, 1500);
      return mockResponse(20_000, 1800);
    }) as never;

    const provider = new GeoapifyRouteProvider(SECRET_KEY, "heavy_truck");
    await provider.resolve(FROM, TO);
    expect(capturedMode).toBe("heavy_truck");
  });
});
