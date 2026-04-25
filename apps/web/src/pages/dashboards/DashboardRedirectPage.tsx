import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// Replaces the old `/dashboards` Codex admin index. Resolves the user's first
// custom dashboard (if any) and routes there; otherwise falls through to the
// default Operations canvas at `/`. Spinner avoids a blank-page flash.
export function DashboardRedirectPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void authFetch("/user-dashboards")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          navigate("/", { replace: true });
          return;
        }
        const body = (await response.json()) as { items?: Array<{ id: string }> } | Array<{ id: string }>;
        const items = Array.isArray(body) ? body : (body.items ?? []);
        const first = items[0];
        if (first?.id) {
          navigate(`/dashboards/${first.id}`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
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
