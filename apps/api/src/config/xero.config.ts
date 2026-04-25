import { registerAs } from "@nestjs/config";

export const xeroConfig = registerAs("xero", () => ({
  clientId: process.env.XERO_CLIENT_ID ?? "",
  clientSecret: process.env.XERO_CLIENT_SECRET ?? "",
  redirectUri:
    process.env.XERO_REDIRECT_URI ?? "http://localhost:3000/api/v1/xero/callback",
  scopes:
    process.env.XERO_SCOPES?.split(" ") ?? [
      "openid",
      "profile",
      "email",
      "accounting.contacts",
      "accounting.transactions",
      "offline_access"
    ]
}));
