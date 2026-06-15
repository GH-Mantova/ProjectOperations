import { useEffect, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { useAuth } from "./AuthContext";

// Consumes the MSAL redirect response on app bootstrap. Runs once per mount;
// on a non-null result with an idToken it hands off to the existing
// loginWithSso() exchange, which sets the local JWTs and triggers the normal
// post-login routing via AuthContext. Errors are logged at debug — the user
// just lands on the login page and can retry.
export function SsoRedirectHandler() {
  const { instance } = useMsal();
  const { loginWithSso } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    let cancelled = false;
    (async () => {
      try {
        const result = await instance.handleRedirectPromise();
        if (cancelled || !result || !result.idToken) return;
        await loginWithSso(result.idToken);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.debug("[sso] redirect handling skipped", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance, loginWithSso]);

  return null;
}
