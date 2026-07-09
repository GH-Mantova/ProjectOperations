import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../../prisma/prisma.service";
import { WeatherService } from "../weather.service";

/**
 * Weather service unit coverage — no DB, no real network.
 *
 * We stub PrismaService and the global fetch so the tests document the
 * observable proxy behaviour: successful passthrough, upstream failure
 * downgraded to { unavailable: true }, geocode miss surfaced cleanly, and
 * caching within the TTL window.
 */

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

function siteRecord(overrides: Partial<{ postcode: string | null; suburb: string | null }> = {}) {
  return {
    id: "site-1",
    name: "Test Site",
    suburb: overrides.suburb === undefined ? "Testville" : overrides.suburb,
    state: "NSW",
    postcode: overrides.postcode === undefined ? "2000" : overrides.postcode
  };
}

function makePrisma(site: ReturnType<typeof siteRecord> | null): PrismaService {
  return {
    site: {
      findUnique: jest.fn().mockResolvedValue(site)
    }
  } as unknown as PrismaService;
}

const config: ConfigService = {
  get: (_key: string, def?: string) => def
} as unknown as ConfigService;

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response;
}

describe("WeatherService.getSiteWeather", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function withFetch(impl: FetchImpl): jest.Mock {
    const mock = jest.fn(impl);
    globalThis.fetch = mock as unknown as typeof globalThis.fetch;
    return mock;
  }

  it("returns current + 5-day forecast on the happy path", async () => {
    const svc = new WeatherService(makePrisma(siteRecord()), config);
    withFetch(async (url) => {
      if (url.includes("geocoding-api")) {
        return response(200, { results: [{ latitude: -33.8688, longitude: 151.2093 }] });
      }
      return response(200, {
        current: {
          temperature_2m: 22.4,
          wind_speed_10m: 12.5,
          weather_code: 2,
          time: "2026-07-09T09:00"
        },
        daily: {
          time: ["2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13"],
          temperature_2m_max: [24, 25, 21, 19, 22],
          temperature_2m_min: [12, 13, 11, 9, 10],
          precipitation_sum: [0, 1.2, 3.5, 0, 0],
          weather_code: [2, 61, 63, 3, 1]
        }
      });
    });

    const result = await svc.getSiteWeather("site-1");
    expect(result.unavailable).toBe(false);
    if (result.unavailable) throw new Error("unreachable");
    expect(result.current?.temperatureC).toBeCloseTo(22.4);
    expect(result.forecast).toHaveLength(5);
    expect(result.forecast[0]).toMatchObject({ date: "2026-07-09", temperatureMaxC: 24 });
    expect(result.source).toBe("open-meteo");
  });

  it("returns unavailable when the upstream forecast call fails", async () => {
    const svc = new WeatherService(makePrisma(siteRecord()), config);
    withFetch(async (url) => {
      if (url.includes("geocoding-api")) {
        return response(200, { results: [{ latitude: 0, longitude: 0 }] });
      }
      return response(503, {});
    });

    const result = await svc.getSiteWeather("site-1");
    expect(result.unavailable).toBe(true);
    if (!result.unavailable) throw new Error("unreachable");
    expect(result.reason).toMatch(/unavailable/i);
  });

  it("returns unavailable when the geocode has no results", async () => {
    const svc = new WeatherService(makePrisma(siteRecord()), config);
    withFetch(async () => response(200, { results: [] }));

    const result = await svc.getSiteWeather("site-1");
    expect(result.unavailable).toBe(true);
    if (!result.unavailable) throw new Error("unreachable");
    expect(result.reason).toMatch(/location/i);
  });

  it("short-circuits with unavailable when the site has no address details", async () => {
    const svc = new WeatherService(
      makePrisma(siteRecord({ postcode: null, suburb: null })),
      config
    );
    const fetchMock = withFetch(async () => response(500, {}));

    const result = await svc.getSiteWeather("site-1");
    expect(result.unavailable).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the second call from the in-memory cache without re-fetching upstream", async () => {
    const svc = new WeatherService(makePrisma(siteRecord()), config);
    let calls = 0;
    withFetch(async (url) => {
      calls += 1;
      if (url.includes("geocoding-api")) {
        return response(200, { results: [{ latitude: 1, longitude: 1 }] });
      }
      return response(200, {
        current: { temperature_2m: 10, wind_speed_10m: 5, weather_code: 0, time: "" },
        daily: { time: ["2026-07-09"], temperature_2m_max: [10], temperature_2m_min: [5], precipitation_sum: [0], weather_code: [0] }
      });
    });

    await svc.getSiteWeather("site-1");
    const before = calls;
    await svc.getSiteWeather("site-1");
    expect(calls).toBe(before); // second call served from cache
  });
});
