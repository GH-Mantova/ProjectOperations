import type { PublicClientApplication } from "@azure/msal-browser";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

// Consumes any pending MSAL redirect response BEFORE React renders.
// AuthContext seeds its state from these localStorage keys on first mount,
// so the protected route sees `isAuthenticated === true` on the first render
// instead of bouncing the user to /login while a useEffect awaits MSAL.
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
    if (!response.ok) return;

    const data = await response.json();
    localStorage.setItem("project-ops.accessToken", data.accessToken);
    localStorage.setItem("project-ops.refreshToken", data.refreshToken);
    localStorage.setItem("project-ops.user", JSON.stringify(data.user));
  } catch (err) {
    if (import.meta.env.DEV) {
      console.debug("[sso] bootstrap redirect handling skipped", err);
    }
  }
}
