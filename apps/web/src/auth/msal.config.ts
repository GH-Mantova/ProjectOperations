import type { Configuration, RedirectRequest } from "@azure/msal-browser";

const rawSsoEnabled = import.meta.env.VITE_SSO_ENABLED;
const rawTenant = import.meta.env.VITE_ENTRA_TENANT_ID;
const rawClient = import.meta.env.VITE_ENTRA_CLIENT_ID;

export const isSsoEnabled =
  String(rawSsoEnabled ?? "false").toLowerCase() === "true" &&
  Boolean(rawTenant) &&
  Boolean(rawClient);

export const msalConfig: Configuration = {
  auth: {
    clientId: rawClient ?? "",
    authority: rawTenant ? `https://login.microsoftonline.com/${rawTenant}` : undefined,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "/"
  },
  cache: {
    // localStorage survives service-worker activations and reloads on SWA;
    // sessionStorage can be lost mid-redirect on some browsers when the
    // top-frame Entra round-trip swaps tabs/contexts.
    cacheLocation: "localStorage"
  }
};

export const loginRequest: RedirectRequest = {
  scopes: ["openid", "profile", "email", "User.Read"]
};
