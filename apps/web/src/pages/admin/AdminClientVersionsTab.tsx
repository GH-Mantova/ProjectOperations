import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";

type Row = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  clientVersion: string | null;
  lastSeenAt: string | null;
  userAgent: string | null;
  behind: boolean;
  updateRequestedAt: string | null;
};

type ListResponse = {
  serverVersion: string;
  users: Row[];
};

function shortSha(sha: string | null): string {
  if (!sha) return "—";
  if (sha === "unknown" || sha === "dev") return sha;
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function AdminClientVersionsTab() {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/admin/client-versions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ListResponse;
      setData(body);
    } catch (err) {
      setError((err as Error).message || "Failed to load client versions.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestOne = async (userId: string) => {
    const ok = await confirm({
      title: "Request update",
      message: "Ask this user's browser to reload to the latest build?",
      confirmLabel: "Request"
    });
    if (!ok) return;
    setBusy(userId);
    try {
      const res = await authFetch("/admin/client-versions/request-update", {
        method: "POST",
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError((err as Error).message || "Failed to request update.");
    } finally {
      setBusy(null);
    }
  };

  const requestAll = async () => {
    const ok = await confirm({
      title: "Request update — everyone",
      message: "Ask every active user's browser to reload to the latest build?",
      confirmLabel: "Request all"
    });
    if (!ok) return;
    setBusy("__all");
    try {
      const res = await authFetch("/admin/client-versions/request-update", {
        method: "POST",
        body: JSON.stringify({ all: true })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError((err as Error).message || "Failed to request updates.");
    } finally {
      setBusy(null);
    }
  };

  const behindCount = useMemo(
    () => (data?.users.filter((u) => u.behind).length ?? 0),
    [data]
  );

  if (loading && !data) {
    return (
      <div>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Client versions</h2>
        <div aria-live="polite" style={{ padding: 24, color: "var(--text-muted)" }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Client versions</h2>
          <p style={{ marginTop: 0, color: "var(--text-muted)" }}>
            Current server build: <code>{shortSha(data?.serverVersion ?? null)}</code>.{" "}
            {behindCount > 0
              ? `${behindCount} user${behindCount === 1 ? "" : "s"} on an older build.`
              : "Everyone is on the latest build."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 6,
              border: "1px solid var(--border, #d1d5db)",
              background: "white",
              cursor: "pointer"
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={requestAll}
            disabled={busy !== null}
            style={{
              minHeight: 44,
              padding: "0 16px",
              borderRadius: 6,
              border: "none",
              background: "#005B61",
              color: "white",
              cursor: "pointer"
            }}
          >
            {busy === "__all" ? "Requesting…" : "Request update — everyone"}
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6, marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {data && data.users.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border,#d1d5db)", borderRadius: 8, marginTop: 16 }}>
          No client sightings yet — users will appear here after their next authenticated request.
        </div>
      ) : null}

      {data && data.users.length > 0 ? (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f9fafb", borderBottom: "1px solid var(--border,#e5e7eb)" }}>
                <th style={{ padding: "10px 12px" }}>User</th>
                <th style={{ padding: "10px 12px" }}>Build</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Last seen</th>
                <th style={{ padding: "10px 12px" }}>Nudge</th>
                <th style={{ padding: "10px 12px" }} />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.userId} style={{ borderBottom: "1px solid var(--border,#f1f5f9)" }}>
                  <td style={{ padding: "12px" }}>
                    <div style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "12px", fontFamily: "monospace" }}>{shortSha(u.clientVersion)}</td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: u.behind ? "#fff7ed" : u.clientVersion ? "#ecfdf5" : "#f3f4f6",
                        color: u.behind ? "#c2410c" : u.clientVersion ? "#047857" : "#6b7280"
                      }}
                    >
                      {u.behind ? "Behind" : u.clientVersion ? "Current" : "No sightings"}
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "var(--text-muted)" }}>{relTime(u.lastSeenAt)}</td>
                  <td style={{ padding: "12px", color: "var(--text-muted)" }}>
                    {u.updateRequestedAt ? `sent ${relTime(u.updateRequestedAt)}` : "—"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => requestOne(u.userId)}
                      disabled={busy !== null}
                      style={{
                        minHeight: 44,
                        padding: "0 14px",
                        borderRadius: 6,
                        border: "1px solid #005B61",
                        background: "white",
                        color: "#005B61",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                    >
                      {busy === u.userId ? "Requesting…" : "Request update"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
