import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

const HOME_DASHBOARD_ID = "seed-home-dashboard";

type Dashboard = {
  id: string;
  name: string;
  scope: "GLOBAL" | "ROLE" | "USER";
  ownerRole?: { id: string; name: string } | null;
};

type ResolvedDefault = {
  id: string;
  name: string;
  scope: "GLOBAL" | "ROLE" | "USER";
  isDefault: boolean;
  isFallback: boolean;
};

function scopeLabel(d: Dashboard): string {
  if (d.scope === "GLOBAL") return "Global";
  if (d.scope === "ROLE") return d.ownerRole?.name ? `Role · ${d.ownerRole.name}` : "Role";
  return "Personal";
}

export function DefaultDashboardSection() {
  const { authFetch } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null);
  const [current, setCurrent] = useState<ResolvedDefault | null>(null);
  const [selection, setSelection] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dashResp, currentResp] = await Promise.all([
        authFetch("/dashboards"),
        authFetch("/users/me/default-dashboard")
      ]);
      if (!dashResp.ok) throw new Error(await dashResp.text());
      if (!currentResp.ok) throw new Error(await currentResp.text());
      const list = (await dashResp.json()) as Dashboard[];
      const resolved = (await currentResp.json()) as ResolvedDefault;
      setDashboards(list);
      setCurrent(resolved);
      // If the resolver returned Home because the user has NOT set an
      // override (isFallback), leave the picker empty — the "Use Home
      // (default)" option represents the null/cleared state. Otherwise
      // preselect what the user actually chose.
      setSelection(resolved.isFallback ? "" : resolved.id);
    } catch (err) {
      setError((err as Error).message || "Could not load dashboards.");
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const dashboardId = selection === "" ? null : selection;
      const response = await authFetch("/users/me/default-dashboard", {
        method: "PATCH",
        body: JSON.stringify({ dashboardId })
      });
      if (!response.ok) throw new Error(await response.text());
      const resolved = (await response.json()) as ResolvedDefault;
      setCurrent(resolved);
      setSelection(resolved.isFallback ? "" : resolved.id);
      setStatus(
        dashboardId === null
          ? "Cleared. You'll now land on Home."
          : `Saved. You'll now land on “${resolved.name}”.`
      );
    } catch (err) {
      setError((err as Error).message || "Could not save default dashboard.");
    } finally {
      setBusy(false);
    }
  }, [authFetch, selection]);

  const currentLabel = current
    ? current.isFallback
      ? `Home (default) — you have not chosen a personal default`
      : `${current.name}${current.id === HOME_DASHBOARD_ID ? " (Home)" : ""}`
    : "Loading…";

  const canSave =
    !busy &&
    dashboards !== null &&
    ((selection === "" && current && !current.isFallback) ||
      (selection !== "" && current?.id !== selection));

  return (
    <section className="s7-card" style={{ marginTop: 24 }}>
      <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>
        Default dashboard
      </h2>
      <p style={{ color: "var(--text-muted)", marginTop: 0, fontSize: 13 }}>
        Pick the dashboard you want to land on when you sign in. Choose{" "}
        <em>Home (default)</em> to fall back to the global Home dashboard. If your
        chosen dashboard is later deleted or you lose access, you&apos;ll be sent to
        Home automatically.
      </p>

      <p style={{ fontSize: 13, margin: "12px 0" }}>
        Current: <strong>{currentLabel}</strong>
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="default-dashboard-select" style={{ fontSize: 13 }}>
          Land on:
        </label>
        <select
          id="default-dashboard-select"
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          disabled={busy || dashboards === null}
          style={{ minWidth: 260, padding: "6px 8px" }}
        >
          <option value="">Home (default)</option>
          {(dashboards ?? [])
            .filter((d) => d.id !== HOME_DASHBOARD_ID)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {scopeLabel(d)}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          onClick={() => void save()}
          disabled={!canSave}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      {status ? (
        <p style={{ color: "var(--text-success, #197a3d)", fontSize: 13, marginTop: 10 }}>
          {status}
        </p>
      ) : null}
      {error ? (
        <p style={{ color: "var(--text-danger, #b3261e)", fontSize: 13, marginTop: 10 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
