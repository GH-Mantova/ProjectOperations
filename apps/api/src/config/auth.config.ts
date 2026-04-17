import { registerAs } from "@nestjs/config";

export const authConfig = registerAs("auth", () => ({
  mode: process.env.AUTH_MODE ?? "local",
  accessSecret: process.env.JWT_ACCESS_SECRET ?? "replace-me-access",
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? "replace-me-refresh",
  accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
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
}));
