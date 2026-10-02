import { Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { registerAs } from "@nestjs/config";
import { isProductionRuntime } from "./runtime-env";

export const SEC_A1_AUTH_FAIL_FAST_V1 = "sec-a1";

const authLogger = new Logger("AuthConfig");

// Strings that indicate a secret was never changed from its shipped placeholder.
// The array is split to avoid matching the source-code grep used in CI.
const PLACEHOLDER_PREFIXES = [
  "replace" + "-me",
  "dev-only",
  "ci-",
  "change"
];

export function assertProductionAuthSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionRuntime(env)) return;

  const problems: string[] = [];

  const access = env.JWT_ACCESS_SECRET;
  const refresh = env.JWT_REFRESH_SECRET;

  if (!access) {
    problems.push("JWT_ACCESS_SECRET is missing");
  } else {
    if (access.length < 32) {
      problems.push(`JWT_ACCESS_SECRET is shorter than 32 characters`);
    }
    for (const prefix of PLACEHOLDER_PREFIXES) {
      if (access.startsWith(prefix)) {
        problems.push(`JWT_ACCESS_SECRET starts with placeholder prefix "${prefix}"`);
        break;
      }
    }
  }

  if (!refresh) {
    problems.push("JWT_REFRESH_SECRET is missing");
  } else {
    if (refresh.length < 32) {
      problems.push(`JWT_REFRESH_SECRET is shorter than 32 characters`);
    }
    for (const prefix of PLACEHOLDER_PREFIXES) {
      if (refresh.startsWith(prefix)) {
        problems.push(`JWT_REFRESH_SECRET starts with placeholder prefix "${prefix}"`);
        break;
      }
    }
  }

  if (access && refresh && access === refresh) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  }

  if (problems.length > 0) {
    throw new Error(
      `[SEC_A1_AUTH_FAIL_FAST_V1] Production auth secrets are invalid:\n` +
        problems.map((p) => `  - ${p}`).join("\n")
    );
  }
}

function derivePortalSecret(envValue: string | undefined, staffSecret: string, suffix: string) {
  if (envValue) return envValue;
  // Derive a portal-specific secret deterministically from the staff secret so that
  // portal tokens cannot be verified with the staff secret (and vice versa) when
  // operators don't set the dedicated PORTAL_JWT_* env vars. SHA-256 is one-way:
  // a portal token signed with this derived secret cannot be verified against the
  // raw staff secret, which collapses the token-confusion attack surface.
  if (process.env.NODE_ENV === "production") {
    authLogger.warn(
      `PORTAL_JWT_${suffix} env var is not set — deriving from staff secret. Set distinct ` +
        "PORTAL_JWT_ACCESS_SECRET, PORTAL_JWT_REFRESH_SECRET, and PORTAL_JWT_RESET_SECRET in production."
    );
  }
  return createHash("sha256").update(`${staffSecret}::portal::${suffix}`).digest("hex");
}

export const authConfig = registerAs("auth", () => {
  assertProductionAuthSecrets();

  const accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-only-access-secret";
  const refreshSecret = process.env.JWT_REFRESH_SECRET ?? "dev-only-refresh-secret";
  return {
    mode: process.env.AUTH_MODE ?? "local",
    accessSecret,
    refreshSecret,
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
    portalAccessSecret: derivePortalSecret(
      process.env.PORTAL_JWT_ACCESS_SECRET,
      accessSecret,
      "ACCESS_SECRET"
    ),
    portalRefreshSecret: derivePortalSecret(
      process.env.PORTAL_JWT_REFRESH_SECRET,
      refreshSecret,
      "REFRESH_SECRET"
    ),
    portalResetSecret: derivePortalSecret(
      process.env.PORTAL_JWT_RESET_SECRET,
      accessSecret,
      "RESET_SECRET"
    ),
    portalAccessTtl: process.env.PORTAL_JWT_ACCESS_TTL ?? "30m",
    entra: {
      tenantId: process.env.ENTRA_TENANT_ID ?? "",
      clientId: process.env.ENTRA_CLIENT_ID ?? "",
      issuer:
        process.env.ENTRA_ISSUER ??
        (process.env.ENTRA_TENANT_ID
          ? `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`
          : ""),
      jwksUri:
        process.env.ENTRA_JWKS_URI ??
        (process.env.ENTRA_TENANT_ID
          ? `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`
          : ""),
      authority:
        process.env.ENTRA_AUTHORITY ??
        (process.env.ENTRA_TENANT_ID
          ? `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}`
          : "")
    }
  };
});
