import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | string;
  status: "READ" | "UNREAD" | string;
  linkUrl?: string | null;
  createdAt: string;
  readAt?: string | null;
};

const TEAL = "#005B61";

const SEVERITY_COLOR: Record<string, string> = {
  INFO: "#3B82F6",
  SUCCESS: TEAL,
  WARNING: "#F59E0B",
  ERROR: "#EF4444"
};

function severityColor(severity: string): string {
  return SEVERITY_COLOR[severity] ?? "#6B7280";
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(months / 12);
  return `${years}y ago`;
}

function isFieldLink(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith("/field/");
}

export function FieldNotificationsPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await authFetch("/notifications/me");
      if (!response.ok) {
        setItems([]);
        return;
      }
      const data = (await response.json()) as NotificationItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (item: NotificationItem) => {
    if (item.status !== "UNREAD") return;
    try {
      await authFetch(`/notifications/${item.id}/read`, { method: "PATCH" });
      setItems((current) =>
        (current ?? []).map((row) =>
          row.id === item.id ? { ...row, status: "READ", readAt: new Date().toISOString() } : row
        )
      );
    } catch {
      // non-fatal
    }
  };

  const handleTap = async (item: NotificationItem) => {
    await markRead(item);
    // Only follow the link when it targets /field/* — otherwise we'd eject
    // the user into the desktop shell (the whole reason this page exists).
    if (isFieldLink(item.linkUrl)) {
      navigate(item.linkUrl);
    }
  };

  const markAll = async () => {
    const list = items ?? [];
    const hasUnread = list.some((row) => row.status === "UNREAD");
    if (marking || !hasUnread) return;
    setMarking(true);
    try {
      await authFetch("/notifications/read-all", { method: "PATCH" });
      setItems((current) =>
        (current ?? []).map((row) => ({
          ...row,
          status: "READ",
          readAt: row.readAt ?? new Date().toISOString()
        }))
      );
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = (items ?? []).filter((row) => row.status === "UNREAD").length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12
        }}
      >
        <span style={{ fontSize: 13, color: "#374151" }}>
          {items === null ? "Loading…" : `${unreadCount} unread`}
        </span>
        <button
          type="button"
          className="field-btn field-btn--ghost"
          onClick={markAll}
          disabled={marking || unreadCount === 0}
          style={{ minHeight: 44, padding: "8px 12px" }}
        >
          Mark all read
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            background: "#FEE2E2",
            color: "#991B1B",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12
          }}
        >
          {error}
        </div>
      ) : null}

      {items === null ? (
        <p style={{ color: "#6B7280" }}>Loading notifications…</p>
      ) : items.length === 0 ? (
        <div className="field-card" style={{ textAlign: "center" }}>
          <p style={{ margin: 0, color: "#6B7280" }}>No notifications.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item) => {
            const canNavigate = isFieldLink(item.linkUrl);
            const unread = item.status === "UNREAD";
            const color = severityColor(item.severity);
            return (
              <li key={item.id} style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => void handleTap(item)}
                  aria-label={`${item.title}${unread ? " (unread)" : ""}`}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "#fff",
                    border: "none",
                    borderLeft: `4px solid ${unread ? color : "transparent"}`,
                    borderRadius: 12,
                    padding: 16,
                    minHeight: 44,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    fontFamily: "inherit"
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-flex",
                      width: 10,
                      height: 10,
                      marginTop: 6,
                      borderRadius: "50%",
                      background: unread ? color : "#E5E7EB",
                      flex: "0 0 auto"
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontWeight: unread ? 700 : 500,
                        fontSize: 15,
                        color: "#111827",
                        marginBottom: 4
                      }}
                    >
                      {item.title}
                    </span>
                    {item.body ? (
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          color: "#4B5563",
                          lineHeight: 1.4,
                          marginBottom: 6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word"
                        }}
                      >
                        {item.body}
                      </span>
                    ) : null}
                    <span
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        color: "#6B7280"
                      }}
                    >
                      <span>{formatTimeAgo(item.createdAt)}</span>
                      {canNavigate ? <span style={{ color: TEAL, fontWeight: 600 }}>Open →</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
