import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// Resolves the user's per-user defaultDashboardId via GET /users/me/default-dashboard.
// When the backend returns isFallback=true, the user has no personal default (or it was
// deleted / lost access), so we route to "/" (the global Operations canvas). Otherwise
// we navigate to the resolved dashboard at /dashboards/:id.

export type DefaultDashboardPayload = {
  id: string;
  name: string;
  scope: string;
  isDefault: boolean;
  /** True when the backend fell back to the global Home because the user's
   *  defaultDashboardId is unset, deleted, or no longer accessible. */
  isFallback: boolean;
};

/** Pure helper — determines the navigation target from the API payload.
 *  Exported so unit tests can cover the branching logic without mounting React. */
export function resolveNavigationTarget(payload: DefaultDashboardPayload): string {
  // When isFallback is true we land on "/" (the global Operations canvas).
  // Navigating to /dashboards/<homeId> would create a loop through this page.
  if (payload.isFallback) return "/";
  return `/dashboards/${payload.id}`;
}

export function DashboardRedirectPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void authFetch("/users/me/default-dashboard")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          navigate("/", { replace: true });
          return;
        }
        const payload = (await response.json()) as DefaultDashboardPayload;
        const target = resolveNavigationTarget(payload);
        navigate(target, { replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate("/", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, navigate]);

  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      Loading your dashboard…
    </div>
  );
}
