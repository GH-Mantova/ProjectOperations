import { PublicClientApplication } from "@azure/msal-browser";
import { isSsoEnabled, msalConfig } from "./msal.config";

// Singleton MSAL instance shared by main.tsx (which wires MsalProvider) and
// AuthContext (which needs to clear the account cache on logout so the next
// SSO sign-in on a shared PC doesn't silently re-use the previous user).
let instance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication | null {
  if (!isSsoEnabled) return null;
  if (!instance) instance = new PublicClientApplication(msalConfig);
  return instance;
}
