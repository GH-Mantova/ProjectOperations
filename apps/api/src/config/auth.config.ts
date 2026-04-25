import { Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { registerAs } from "@nestjs/config";

const authLogger = new Logger("AuthConfig");

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
  const accessSecret = process.env.JWT_ACCESS_SECRET ?? "replace-me-access";
  const refreshSecret = process.env.JWT_REFRESH_SECRET ?? "replace-me-refresh";
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
