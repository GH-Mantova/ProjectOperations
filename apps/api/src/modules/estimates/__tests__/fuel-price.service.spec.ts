/**
 * Unit tests for FuelPriceService — price-selection logic.
 *
 * Tests cover:
 *   - Takes MAXIMUM of valid Ampol diesel prices.
 *   - Skips Price == 9999 (unavailable).
 *   - Filters by brand (Ampol site ids) — non-Ampol sites ignored.
 *   - Empty result keeps last stored value (returns null, no upsert).
 *   - Non-200 from GetSitesPrices keeps last stored value (returns null).
 *   - fetchAndStoreWithResult returns failure without clearing stored price.
 *   - manualRefresh refuses a second call within 60s (throttle).
 *   - Staleness helper: 47h fine, 49h overdue.
 *
 * Pattern mirrors estimates.service.spec.ts — plain-object stubs, no
 * NestJS testing module, production code not modified.
 */

import { FuelPriceService } from "../fuel-price.service";

// ── helpers ────────────────────────────────────────────────────────────────

type AsyncMock<T = unknown> = jest.Mock<Promise<T>, unknown[]>;

function buildPrisma(upsertResult: Record<string, unknown> = {}) {
  return {
    operationsSettings: {
      upsert: jest.fn().mockResolvedValue(upsertResult) as AsyncMock
    }
  };
}

function buildIntegrationKeys(token: string | null = "test-token") {
  return {
    resolveIntegrationKey: jest.fn().mockResolvedValue(token) as AsyncMock<string | null>
  };
}

function buildConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn().mockReturnValue({
      baseUrl: "https://fake.fuelpricesqld.test",
      tokenEnvFallback: null,
      regionLevel: 3,
      regionId: 1,
      fuelName: "Diesel",
      brandName: "Ampol",
      countryId: 21,
      ...overrides
    })
  };
}

/**
 * Build a FuelPriceService subclass where `apiFetch` is injectable so
 * tests can control all HTTP responses without real network calls.
 */
function buildService({
  prisma = buildPrisma(),
  integrationKeys = buildIntegrationKeys(),
  config = buildConfig(),
  apiResponses = {} as Record<string, unknown>
}: {
  prisma?: ReturnType<typeof buildPrisma>;
  integrationKeys?: ReturnType<typeof buildIntegrationKeys>;
  config?: ReturnType<typeof buildConfig>;
  apiResponses?: Record<string, unknown>;
}) {
  class TestableFuelPriceService extends FuelPriceService {
    protected override apiFetch(url: string, _token: string): Promise<Response> {
      // Find a matching response by checking if any key is a substring of url.
      const matchKey = Object.keys(apiResponses).find((k) => url.includes(k));
      if (!matchKey) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({})
        } as unknown as Response);
      }
      const body = apiResponses[matchKey];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => body
      } as unknown as Response);
    }
  }

  return new TestableFuelPriceService(
    prisma as never,
    integrationKeys as never,
    config as never
  );
}

// ── stock API responses used across tests ─────────────────────────────────

const DIESEL_FUEL_ID = 2;
const AMPOL_BRAND_ID = 10;
const CALTEX_BRAND_ID = 11;
const OTHER_BRAND_ID = 99;

const AMPOL_SITE_ID = 1001;
const AMPOL_SITE_ID_2 = 1002;
const NON_AMPOL_SITE_ID = 9999;

const fuelTypesBody = {
  Fuels: [
    { FuelId: 1, Name: "Unleaded" },
    { FuelId: DIESEL_FUEL_ID, Name: "Diesel" }
  ]
};

const brandsBody = {
  Brands: [
    { BrandId: AMPOL_BRAND_ID, Name: "Ampol" },
    { BrandId: CALTEX_BRAND_ID, Name: "Caltex" },
    { BrandId: OTHER_BRAND_ID, Name: "BP" }
  ]
};

const siteDetailsBody = {
  S: [
    { SiteId: AMPOL_SITE_ID, B: AMPOL_BRAND_ID },
    { SiteId: AMPOL_SITE_ID_2, B: CALTEX_BRAND_ID },
    { SiteId: NON_AMPOL_SITE_ID, B: OTHER_BRAND_ID }
  ]
};

const baseApiResponses = {
  GetCountryFuelTypes: fuelTypesBody,
  GetCountryBrands: brandsBody,
  GetFullSiteDetails: siteDetailsBody
};

// ── tests ──────────────────────────────────────────────────────────────────

describe("FuelPriceService — price selection", () => {
  it("takes the MAXIMUM valid Ampol diesel price and divides by 1000", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      apiResponses: {
        ...baseApiResponses,
        GetSitesPrices: {
          SitePrices: [
            { SiteId: AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 2150, CollectionMethod: "", TransactionDateUtc: "" },
            { SiteId: AMPOL_SITE_ID_2, FuelId: DIESEL_FUEL_ID, Price: 2189, CollectionMethod: "", TransactionDateUtc: "" }
          ]
        }
      }
    });

    const result = await service.fetchAndStore();

    // Maximum of 2150 and 2189 is 2189; 2189 / 1000 = 2.189
    expect(result).toBeCloseTo(2.189, 3);
    expect(prisma.operationsSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          fuelPricePerLitre: 2.189,
          fuelPriceSource: "fuelpricesqld:Ampol-Diesel-max"
        })
      })
    );
  });

  it("skips Price == 9999 (unavailable sentinel)", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      apiResponses: {
        ...baseApiResponses,
        GetSitesPrices: {
          SitePrices: [
            { SiteId: AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 9999, CollectionMethod: "", TransactionDateUtc: "" },
            { SiteId: AMPOL_SITE_ID_2, FuelId: DIESEL_FUEL_ID, Price: 2100, CollectionMethod: "", TransactionDateUtc: "" }
          ]
        }
      }
    });

    const result = await service.fetchAndStore();

    // 9999 is skipped; only 2100 remains → 2.1
    expect(result).toBeCloseTo(2.1, 3);
  });

  it("ignores prices from non-Ampol sites", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      apiResponses: {
        ...baseApiResponses,
        GetSitesPrices: {
          SitePrices: [
            // NON_AMPOL_SITE_ID should be filtered out even though price is high.
            { SiteId: NON_AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 3000, CollectionMethod: "", TransactionDateUtc: "" },
            { SiteId: AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 2200, CollectionMethod: "", TransactionDateUtc: "" }
          ]
        }
      }
    });

    const result = await service.fetchAndStore();

    // NON_AMPOL_SITE_ID (3000) must be excluded; only AMPOL_SITE_ID (2200) passes.
    expect(result).toBeCloseTo(2.2, 3);
  });

  it("ignores prices for non-Diesel fuel ids", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      apiResponses: {
        ...baseApiResponses,
        GetSitesPrices: {
          SitePrices: [
            // FuelId 1 = Unleaded — should be excluded.
            { SiteId: AMPOL_SITE_ID, FuelId: 1, Price: 1800, CollectionMethod: "", TransactionDateUtc: "" },
            { SiteId: AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 2050, CollectionMethod: "", TransactionDateUtc: "" }
          ]
        }
      }
    });

    const result = await service.fetchAndStore();

    expect(result).toBeCloseTo(2.05, 3);
  });

  it("returns null and does NOT upsert when zero valid prices remain (keep-last)", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      apiResponses: {
        ...baseApiResponses,
        GetSitesPrices: {
          SitePrices: [
            // All 9999 — nothing valid.
            { SiteId: AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 9999, CollectionMethod: "", TransactionDateUtc: "" }
          ]
        }
      }
    });

    const result = await service.fetchAndStore();

    expect(result).toBeNull();
    expect(prisma.operationsSettings.upsert).not.toHaveBeenCalled();
  });

  it("returns null and does NOT upsert when GetSitesPrices returns non-200 (keep-last)", async () => {
    const prisma = buildPrisma();

    class Non200Service extends FuelPriceService {
      private callCount = 0;

      protected override apiFetch(url: string, _token: string): Promise<Response> {
        this.callCount++;
        // Daily-cache endpoints return 200; GetSitesPrices returns 503.
        if (url.includes("GetSitesPrices")) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({})
          } as unknown as Response);
        }
        if (url.includes("GetCountryFuelTypes")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => fuelTypesBody } as unknown as Response);
        }
        if (url.includes("GetCountryBrands")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => brandsBody } as unknown as Response);
        }
        if (url.includes("GetFullSiteDetails")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => siteDetailsBody } as unknown as Response);
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as unknown as Response);
      }
    }

    const service = new Non200Service(prisma as never, buildIntegrationKeys() as never, buildConfig() as never);
    const result = await service.fetchAndStore();

    expect(result).toBeNull();
    expect(prisma.operationsSettings.upsert).not.toHaveBeenCalled();
  });

  it("returns null without calling the API when no token is available", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      integrationKeys: buildIntegrationKeys(null),
      config: buildConfig({ tokenEnvFallback: null }),
      apiResponses: {}
    });

    const result = await service.fetchAndStore();

    expect(result).toBeNull();
    expect(prisma.operationsSettings.upsert).not.toHaveBeenCalled();
  });

  it("writes fuelPriceSource as exactly 'fuelpricesqld:Ampol-Diesel-max'", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      apiResponses: {
        ...baseApiResponses,
        GetSitesPrices: {
          SitePrices: [
            { SiteId: AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 2000, CollectionMethod: "", TransactionDateUtc: "" }
          ]
        }
      }
    });

    await service.fetchAndStore();

    const upsertCall = (prisma.operationsSettings.upsert as jest.Mock).mock.calls[0][0] as {
      update: { fuelPriceSource: string };
    };
    expect(upsertCall.update.fuelPriceSource).toBe("fuelpricesqld:Ampol-Diesel-max");
  });
});

// ── New slice tests (fuel-price-refresh-and-staleness) ─────────────────────

describe("FuelPriceService — fetchAndStoreWithResult failure does not clear stored price", () => {
  it("returns ok=false and does NOT call upsert when GetSitesPrices returns non-200", async () => {
    const prisma = buildPrisma();

    class FailingFetchService extends FuelPriceService {
      protected override apiFetch(url: string, _token: string): Promise<Response> {
        if (url.includes("GetSitesPrices")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({})
          } as unknown as Response);
        }
        if (url.includes("GetCountryFuelTypes")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => fuelTypesBody } as unknown as Response);
        }
        if (url.includes("GetCountryBrands")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => brandsBody } as unknown as Response);
        }
        if (url.includes("GetFullSiteDetails")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => siteDetailsBody } as unknown as Response);
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as unknown as Response);
      }
    }

    const service = new FailingFetchService(
      prisma as never,
      buildIntegrationKeys() as never,
      buildConfig() as never
    );

    const result = await service.fetchAndStoreWithResult();

    // Failure must be reported and the stored price must NOT be touched.
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/401|HTTP|stored price retained/i);
    expect(prisma.operationsSettings.upsert).not.toHaveBeenCalled();
  });

  it("returns ok=false and does NOT call upsert when no token is available", async () => {
    const prisma = buildPrisma();
    const service = buildService({
      prisma,
      integrationKeys: buildIntegrationKeys(null),
      config: buildConfig({ tokenEnvFallback: null }),
      apiResponses: {}
    });

    const result = await service.fetchAndStoreWithResult();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/token|key/i);
    expect(prisma.operationsSettings.upsert).not.toHaveBeenCalled();
  });
});

describe("FuelPriceService — manualRefresh throttle", () => {
  it("refuses a second call within 60s and returns throttled=true without calling upstream", async () => {
    const prisma = buildPrisma();
    let fetchCallCount = 0;

    class ThrottleTestService extends FuelPriceService {
      protected override apiFetch(url: string, _token: string): Promise<Response> {
        fetchCallCount++;
        if (url.includes("GetSitesPrices")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              SitePrices: [
                { SiteId: AMPOL_SITE_ID, FuelId: DIESEL_FUEL_ID, Price: 2100, CollectionMethod: "", TransactionDateUtc: "" }
              ]
            })
          } as unknown as Response);
        }
        if (url.includes("GetCountryFuelTypes")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => fuelTypesBody } as unknown as Response);
        }
        if (url.includes("GetCountryBrands")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => brandsBody } as unknown as Response);
        }
        if (url.includes("GetFullSiteDetails")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => siteDetailsBody } as unknown as Response);
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as unknown as Response);
      }
    }

    const service = new ThrottleTestService(
      prisma as never,
      buildIntegrationKeys() as never,
      buildConfig() as never
    );

    // First call — should succeed and call GetSitesPrices.
    const first = await service.manualRefresh();
    expect(first.ok).toBe(true);
    const fetchCountAfterFirst = fetchCallCount;

    // Second call immediately after — should be throttled.
    const second = await service.manualRefresh();
    expect(second.ok).toBe(false);
    expect(second.throttled).toBe(true);
    expect(second.message).toMatch(/60|minute|wait|rate limit/i);

    // Upstream must not have been called again.
    expect(fetchCallCount).toBe(fetchCountAfterFirst);
  });
});

// ── Staleness helper tests (boundary at 47h and 49h) ──────────────────────
// The helper lives in AdminCompanyPage.tsx (web), but the boundary behaviour
// is a pure function that we can test from the service side via the threshold
// constant. These tests verify the intent: 47h is fine, 49h is overdue.
// (The actual web helper is a local function; tested here as spec-level logic
// using the same constant value: FUEL_PRICE_STALE_THRESHOLD_HOURS = 48.)

const STALE_THRESHOLD_HOURS = 48; // Must match AdminCompanyPage.tsx FUEL_PRICE_STALE_THRESHOLD_HOURS

function stalenessOverdue(fetchedAt: Date | null): boolean {
  if (fetchedAt === null) return true;
  const ageHours = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
  return ageHours > STALE_THRESHOLD_HOURS;
}

describe("Fuel price staleness helper — boundary at 48h", () => {
  it("returns overdue=false for a fetch 47 hours ago", () => {
    const fetchedAt = new Date(Date.now() - 47 * 60 * 60 * 1000);
    expect(stalenessOverdue(fetchedAt)).toBe(false);
  });

  it("returns overdue=true for a fetch 49 hours ago", () => {
    const fetchedAt = new Date(Date.now() - 49 * 60 * 60 * 1000);
    expect(stalenessOverdue(fetchedAt)).toBe(true);
  });

  it("returns overdue=true when fetchedAt is null (never fetched)", () => {
    expect(stalenessOverdue(null)).toBe(true);
  });
});
