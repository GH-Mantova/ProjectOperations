import type { PublicClientApplication } from "@azure/msal-browser";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

// Storage key the LoginPage reads to render the request-access screen
// after an SSO redirect where the Entra identity was validated but not
// yet a registered internal user. We keep the idToken here so the
// request-access POST can reuse it without going back through MSAL.
export const ENTRA_PENDING_ACCESS_KEY = "project-ops.entraPendingAccess";

export type PendingAccessRequest = {
  email: string;
  displayName: string | null;
  idToken: string;
};

// Consumes any pending MSAL redirect response BEFORE React renders.
// AuthContext seeds its state from these localStorage keys on first mount,
// so the protected route sees `isAuthenticated === true` on the first render
// instead of bouncing the user to /login while a useEffect awaits MSAL.
//
// If /auth/sso returns 403 { code: "ENTRA_NOT_REGISTERED" } (the gated-SSO
// path), we stash the idToken + email/displayName in localStorage so the
// LoginPage can render the request-access screen instead of a blank
// redirect loop.
export async function consumeSsoRedirect(instance: PublicClientApplication): Promise<void> {
  try {
    await instance.initialize();
    const result = await instance.handleRedirectPromise();
    if (!result || !result.idToken) return;

    const response = await fetch(`${API_BASE_URL}/auth/sso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: result.idToken })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("project-ops.accessToken", data.accessToken);
      localStorage.setItem("project-ops.refreshToken", data.refreshToken);
      localStorage.setItem("project-ops.user", JSON.stringify(data.user));
      localStorage.removeItem(ENTRA_PENDING_ACCESS_KEY);
      return;
    }

    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      if (body && typeof body === "object" && (body as { code?: unknown }).code === "ENTRA_NOT_REGISTERED") {
        const pending: PendingAccessRequest = {
          email: String((body as { email?: unknown }).email ?? ""),
          displayName:
            typeof (body as { displayName?: unknown }).displayName === "string"
              ? (body as { displayName: string }).displayName
              : null,
          idToken: result.idToken
        };
        localStorage.setItem(ENTRA_PENDING_ACCESS_KEY, JSON.stringify(pending));
        return;
      }
    }

    // Any other non-OK response — clear any stale pending state so the
    // LoginPage renders its normal error path.
    localStorage.removeItem(ENTRA_PENDING_ACCESS_KEY);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.debug("[sso] bootstrap redirect handling skipped", err);
    }
  }
}
