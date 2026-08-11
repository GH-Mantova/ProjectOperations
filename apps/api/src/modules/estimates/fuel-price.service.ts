import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { IntegrationKeysService } from "../../common/integrations/integration-keys.service";
import type { FuelPriceConfig } from "../../config/fuel-price.config";

const SINGLETON_ID = "singleton";

/** Price == 9999 means "unavailable" in the fuelpricesqld.com.au API. Skip these. */
const UNAVAILABLE_PRICE = 9999;

/**
 * Price divisor: raw Price values from the API are in tenths-of-a-cent.
 * Divide by 1000 to get $/L (e.g. 2189 → $2.189/L).
 */
const PRICE_DIVISOR = 1000;

/** TTL for the daily caches (brands, sites, fuel type id). One full day in ms. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Rate-limit guard: never call GetSitesPrices more than once per minute. */
const MIN_PRICE_FETCH_INTERVAL_MS = 60 * 1000;

interface SitePrice {
  SiteId: number;
  FuelId: number;
  CollectionMethod: string;
  TransactionDateUtc: string;
  Price: number;
}

interface FuelType {
  FuelId: number;
  Name: string;
}

interface Brand {
  BrandId: number;
  Name: string;
}

interface SiteDetail {
  SiteId: number;
  /** BrandId — the API field is named "B" */
  B: number;
}

interface DailyCache {
  dieselFuelId: number | null;
  ampolBrandIds: number[];
  ampolSiteIds: Set<number>;
  cachedAt: number;
}

/**
 * Live diesel fuel-price feed from fuelpricesqld.com.au (R3 T-2).
 *
 * Runs a daily @Cron (02:00 UTC) to:
 *  1. Resolve the configured fuel type id ("Diesel") and Ampol brand ids — cached daily.
 *  2. Fetch all site details for the configured region, filter to Ampol sites — cached daily.
 *  3. Call GetSitesPrices, filter to Diesel + Ampol sites + Price != 9999.
 *  4. Take the MAXIMUM remaining price, divide by 1000 → $/L.
 *  5. Write OperationsSettings.fuelPricePerLitre / fuelPriceSource / fuelPriceFetchedAt.
 *
 * Graceful fallback: if zero valid prices are available, or if any HTTP call
 * fails, the previously stored value is kept and a structured warning is logged.
 * This service NEVER throws into a quote path.
 *
 * Rate-limit guard: GetSitesPrices is called at most once per minute (enforced
 * via lastPriceFetchAt; the cron is once/day so this is a safety rail, not a
 * primary throttle).
 */
@Injectable()
export class FuelPriceService {
  private readonly logger = new Logger(FuelPriceService.name);

  /** Daily cache — fuel type id, brand ids, site ids. */
  private cache: DailyCache | null = null;

  /** Timestamp of the last GetSitesPrices call — rate-limit guard. */
  private lastPriceFetchAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationKeys: IntegrationKeysService,
    private readonly config: ConfigService
  ) {}

  /**
   * Scheduled job: runs every day at 02:00 UTC.
   * Follows the compliance cron precedent (ComplianceService.runDailyComplianceTasks).
   */
  @Cron("0 2 * * *", { name: "fuel-price-daily-fetch", timeZone: "UTC" })
  async runDailyFuelPriceFetch(): Promise<void> {
    this.logger.log("FuelPriceService: starting daily price fetch.");
    try {
      await this.fetchAndStore();
    } catch (err) {
      this.logger.warn({
        message: "FuelPriceService: unhandled error in daily cron — last stored price retained.",
        error: (err as Error).message
      });
    }
  }

  /**
   * Core fetch-and-store logic. Exposed for testing and for manual triggers.
   *
   * Returns the written $/L value, or null if the existing value was kept
   * (zero valid prices, or any API failure).
   */
  async fetchAndStore(): Promise<number | null> {
    const token = await this.resolveToken();
    if (!token) {
      this.logger.warn({
        message:
          "FuelPriceService: no token available (resolveIntegrationKey returned null, env fallback absent). Skipping fetch."
      });
      return null;
    }

    const cfg = this.config.get<FuelPriceConfig>("fuelPrice");
    if (!cfg) {
      this.logger.warn({ message: "FuelPriceService: fuelPrice config missing. Skipping fetch." });
      return null;
    }

    // ── Step 1: resolve daily cache (fuel type id, brand ids, site ids) ──────
    const daily = await this.resolveDailyCache(token, cfg);
    if (!daily) return null;

    const { dieselFuelId, ampolBrandIds, ampolSiteIds } = daily;
    if (dieselFuelId === null) {
      this.logger.warn({
        message: `FuelPriceService: fuel type "${cfg.fuelName}" not found in country fuel types. Skipping fetch.`
      });
      return null;
    }

    this.logger.log({
      message: "FuelPriceService: cache resolved.",
      dieselFuelId,
      ampolBrandIds,
      ampolSiteCount: ampolSiteIds.size
    });

    // ── Step 2: rate-limit guard for GetSitesPrices ───────────────────────
    const now = Date.now();
    if (now - this.lastPriceFetchAt < MIN_PRICE_FETCH_INTERVAL_MS) {
      this.logger.warn({
        message: "FuelPriceService: GetSitesPrices called less than 1 minute ago. Skipping to respect rate limit."
      });
      return null;
    }

    // ── Step 3: fetch site prices ─────────────────────────────────────────
    const pricesUrl =
      `${cfg.baseUrl}/Price/GetSitesPrices` +
      `?countryId=${cfg.countryId}&geoRegionLevel=${cfg.regionLevel}&geoRegionId=${cfg.regionId}`;

    let sitePrices: SitePrice[];
    try {
      const response = await this.apiFetch(pricesUrl, token);
      this.lastPriceFetchAt = Date.now();
      if (!response.ok) {
        this.logger.warn({
          message: `FuelPriceService: GetSitesPrices returned HTTP ${response.status}. Last stored price retained.`,
          url: pricesUrl,
          status: response.status
        });
        return null;
      }
      const body = (await response.json()) as { SitePrices?: SitePrice[] };
      sitePrices = body.SitePrices ?? [];
    } catch (err) {
      this.logger.warn({
        message: `FuelPriceService: network error calling GetSitesPrices. Last stored price retained.`,
        error: (err as Error).message
      });
      return null;
    }

    // ── Step 4: filter and pick maximum ──────────────────────────────────
    const validPrices = sitePrices
      .filter(
        (row) =>
          row.FuelId === dieselFuelId &&
          ampolSiteIds.has(row.SiteId) &&
          row.Price !== UNAVAILABLE_PRICE
      )
      .map((row) => row.Price);

    if (validPrices.length === 0) {
      this.logger.warn({
        message:
          "FuelPriceService: zero valid Ampol diesel prices found after filtering. Last stored price retained.",
        totalRows: sitePrices.length,
        dieselFuelId,
        ampolSiteCount: ampolSiteIds.size
      });
      return null;
    }

    const maxRaw = Math.max(...validPrices);
    const pricePerLitre = maxRaw / PRICE_DIVISOR;

    this.logger.log({
      message: "FuelPriceService: price resolved.",
      maxRaw,
      pricePerLitre,
      validPriceCount: validPrices.length
    });

    // ── Step 5: persist ───────────────────────────────────────────────────
    await this.prisma.operationsSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        fuelPricePerLitre: pricePerLitre,
        fuelPriceSource: "fuelpricesqld:Ampol-Diesel-max",
        fuelPriceFetchedAt: new Date()
      },
      update: {
        fuelPricePerLitre: pricePerLitre,
        fuelPriceSource: "fuelpricesqld:Ampol-Diesel-max",
        fuelPriceFetchedAt: new Date()
      }
    });

    this.logger.log({
      message: `FuelPriceService: OperationsSettings updated — $${pricePerLitre.toFixed(3)}/L (source: fuelpricesqld:Ampol-Diesel-max).`
    });

    return pricePerLitre;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async resolveToken(): Promise<string | null> {
    // Primary: DB-stored integration key (encrypted, rotatable from Admin UI).
    const dbToken = await this.integrationKeys.resolveIntegrationKey("fuelpricesqld");
    if (dbToken) return dbToken;

    // Fallback: FUELPRICE_QLD_TOKEN env var (transitional — same pattern as
    // resolveIntegrationKey's own env fallback but kept explicit here so the
    // config module owns the env var definition).
    const cfg = this.config.get<FuelPriceConfig>("fuelPrice");
    return cfg?.tokenEnvFallback ?? null;
  }

  /**
   * Returns the daily cache, fetching from the API if stale (> 24 h old).
   * Returns null on any API failure — caller keeps last stored price.
   */
  private async resolveDailyCache(
    token: string,
    cfg: FuelPriceConfig
  ): Promise<DailyCache | null> {
    const now = Date.now();
    if (this.cache && now - this.cache.cachedAt < CACHE_TTL_MS) {
      return this.cache;
    }

    // ── Fuel types ──────────────────────────────────────────────────────
    const fuelTypesUrl = `${cfg.baseUrl}/Subscriber/GetCountryFuelTypes?countryId=${cfg.countryId}`;
    let fuelTypes: FuelType[];
    try {
      const response = await this.apiFetch(fuelTypesUrl, token);
      if (!response.ok) {
        this.logger.warn({
          message: `FuelPriceService: GetCountryFuelTypes returned HTTP ${response.status}. Cache not refreshed.`,
          status: response.status
        });
        return null;
      }
      const body = (await response.json()) as { Fuels?: FuelType[] };
      fuelTypes = body.Fuels ?? [];
    } catch (err) {
      this.logger.warn({
        message: "FuelPriceService: network error fetching fuel types. Cache not refreshed.",
        error: (err as Error).message
      });
      return null;
    }

    const fuelNameLower = cfg.fuelName.toLowerCase();
    const dieselEntry = fuelTypes.find((ft) => ft.Name.toLowerCase().includes(fuelNameLower));
    const dieselFuelId = dieselEntry?.FuelId ?? null;

    // ── Brands ──────────────────────────────────────────────────────────
    const brandsUrl = `${cfg.baseUrl}/Subscriber/GetCountryBrands?countryId=${cfg.countryId}`;
    let brands: Brand[];
    try {
      const response = await this.apiFetch(brandsUrl, token);
      if (!response.ok) {
        this.logger.warn({
          message: `FuelPriceService: GetCountryBrands returned HTTP ${response.status}. Cache not refreshed.`,
          status: response.status
        });
        return null;
      }
      const body = (await response.json()) as { Brands?: Brand[] };
      brands = body.Brands ?? [];
    } catch (err) {
      this.logger.warn({
        message: "FuelPriceService: network error fetching brands. Cache not refreshed.",
        error: (err as Error).message
      });
      return null;
    }

    const brandNameLower = cfg.brandName.toLowerCase();
    // Match "Ampol" or legacy "Caltex" (which Ampol absorbed).
    const ampolBrandIds = brands
      .filter(
        (b) =>
          b.Name.toLowerCase().includes(brandNameLower) ||
          b.Name.toLowerCase().includes("caltex")
      )
      .map((b) => b.BrandId);

    this.logger.log({
      message: `FuelPriceService: matched brand ids for "${cfg.brandName}".`,
      ampolBrandIds,
      matchedNames: brands
        .filter((b) => ampolBrandIds.includes(b.BrandId))
        .map((b) => b.Name)
    });

    // ── Sites ───────────────────────────────────────────────────────────
    const sitesUrl =
      `${cfg.baseUrl}/Subscriber/GetFullSiteDetails` +
      `?countryId=${cfg.countryId}&geoRegionLevel=${cfg.regionLevel}&geoRegionId=${cfg.regionId}`;

    let siteDetails: SiteDetail[];
    try {
      const response = await this.apiFetch(sitesUrl, token);
      if (!response.ok) {
        this.logger.warn({
          message: `FuelPriceService: GetFullSiteDetails returned HTTP ${response.status}. Cache not refreshed.`,
          status: response.status
        });
        return null;
      }
      const body = (await response.json()) as { S?: SiteDetail[] };
      siteDetails = body.S ?? [];
    } catch (err) {
      this.logger.warn({
        message: "FuelPriceService: network error fetching site details. Cache not refreshed.",
        error: (err as Error).message
      });
      return null;
    }

    const ampolBrandSet = new Set(ampolBrandIds);
    const ampolSiteIds = new Set(
      siteDetails.filter((s) => ampolBrandSet.has(s.B)).map((s) => s.SiteId)
    );

    this.logger.log({
      message: `FuelPriceService: resolved ${ampolSiteIds.size} Ampol sites.`,
      regionLevel: cfg.regionLevel,
      regionId: cfg.regionId
    });

    this.cache = {
      dieselFuelId,
      ampolBrandIds,
      ampolSiteIds,
      cachedAt: now
    };

    return this.cache;
  }

  /**
   * Thin fetch wrapper that injects the subscriber token and JSON content-type.
   * Separated so tests can mock it.
   */
  protected apiFetch(url: string, token: string): Promise<Response> {
    return fetch(url, {
      method: "GET",
      headers: {
        Authorization: `FPDAPI SubscriberToken=${token}`,
        "Content-Type": "application/json"
      }
    });
  }
}
