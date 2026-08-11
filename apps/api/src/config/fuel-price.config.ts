import { registerAs } from "@nestjs/config";

/**
 * Configuration for the fuelpricesqld.com.au live diesel price feed (R3 T-2).
 *
 * All values are optional with sensible defaults — only the base URL and token
 * are required for the feed to operate (token is resolved via resolveIntegrationKey,
 * not from this config).
 *
 * Env vars introduced:
 *   FUELPRICE_QLD_BASE_URL  — API host (default: https://fppdirectapi-prod.fuelpricesqld.com.au)
 *   FUELPRICE_QLD_TOKEN     — fallback token when DB integration key is absent
 *   FUELPRICE_QLD_REGION_LEVEL — geographic region level (default: 3)
 *   FUELPRICE_QLD_REGION_ID    — geographic region id (default: 1 = QLD)
 *   FUELPRICE_QLD_FUEL         — fuel type name to match (default: Diesel)
 *   FUELPRICE_QLD_BRAND        — brand name to filter (default: Ampol)
 */
export const fuelPriceConfig = registerAs("fuelPrice", () => ({
  baseUrl:
    process.env.FUELPRICE_QLD_BASE_URL ??
    "https://fppdirectapi-prod.fuelpricesqld.com.au",
  /** Legacy env-var fallback for token — prefer DB integration key via resolveIntegrationKey. */
  tokenEnvFallback: process.env.FUELPRICE_QLD_TOKEN ?? null,
  regionLevel: Number(process.env.FUELPRICE_QLD_REGION_LEVEL ?? 3),
  regionId: Number(process.env.FUELPRICE_QLD_REGION_ID ?? 1),
  fuelName: process.env.FUELPRICE_QLD_FUEL ?? "Diesel",
  brandName: process.env.FUELPRICE_QLD_BRAND ?? "Ampol",
  countryId: 21
}));

export type FuelPriceConfig = ReturnType<typeof fuelPriceConfig>;
