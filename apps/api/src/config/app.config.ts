import { registerAs } from "@nestjs/config";

const DEFAULT_CORS_ORIGIN = "http://localhost:5173";

export type RatesCanonicalSource = "legacy" | "ratetable";

/**
 * Which store answers rate lookups. `legacy` (default) reads the eight
 * Estimate*Rate tables, matching pre-cutover behaviour byte-identically.
 * `ratetable` reads the flexible RateTable / RateColumn / RateRow model
 * that was seeded byte-identically in PR #552. The switch lives here so
 * the flip is a deploy-time env change, not a code change.
 */
export function parseRatesCanonicalSource(raw: string | undefined): RatesCanonicalSource {
  const normalised = (raw ?? "").trim().toLowerCase();
  return normalised === "ratetable" ? "ratetable" : "legacy";
}

export function parseCorsOrigin(raw: string | undefined): string[] {
  if (raw === undefined) {
    return [DEFAULT_CORS_ORIGIN];
  }

  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? parsed : [DEFAULT_CORS_ORIGIN];
}

export const appConfig = registerAs("app", () => ({
  // Azure App Service injects PORT; API_PORT remains the local-dev override.
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  ratesCanonicalSource: parseRatesCanonicalSource(process.env.RATES_CANONICAL_SOURCE),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public"
}));
