import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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

type NotificationsDropdownProps = {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
};

const SEVERITY_COLOR: Record<string, string> = {
  INFO: "var(--status-info, #3B82F6)",
  SUCCESS: "var(--status-active, #005B61)",
  WARNING: "var(--status-warning, #F59E0B)",
  ERROR: "var(--status-danger, #EF4444)"
};

function severityColor(severity: string): string {
  return SEVERITY_COLOR[severity] ?? "var(--status-neutral, #6B7280)";
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

export function NotificationsDropdown({ anchorRef, open, onClose, onUnreadCountChange }: NotificationsDropdownProps) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await authFetch("/notifications/me");
        if (!response.ok) {
          if (!cancelled) setItems([]);
          return;
        }
        const data = (await response.json()) as NotificationItem[];
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, open]);

  useEffect(() => {
    const unread = items.filter((item) => item.status === "UNREAD").length;
    onUnreadCountChange?.(unread);
  }, [items, onUnreadCountChange]);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  const unread = items.filter((item) => item.status === "UNREAD");

  const handleItemClick = async (item: NotificationItem) => {
    if (item.status === "UNREAD") {
      try {
        await authFetch(`/notifications/${item.id}/read`, { method: "PATCH" });
        setItems((current) =>
          current.map((row) => (row.id === item.id ? { ...row, status: "READ", readAt: new Date().toISOString() } : row))
        );
      } catch {
        // non-fatal; ignore
      }
    }
    if (item.linkUrl) {
      navigate(item.linkUrl);
    }
    onClose();
  };

  const markAll = async () => {
    if (marking || unread.length === 0) return;
    setMarking(true);
    try {
      await authFetch("/notifications/read-all", { method: "PATCH" });
      setItems((current) => current.map((row) => ({ ...row, status: "READ", readAt: row.readAt ?? new Date().toISOString() })));
    } finally {
      setMarking(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="notif-dropdown"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="notif-dropdown__header">
        <span className="notif-dropdown__title">Notifications</span>
        <button
          type="button"
          className="notif-dropdown__mark-all"
          onClick={markAll}
          disabled={marking || unread.length === 0}
        >
          Mark all read
        </button>
      </div>
      <div className="notif-dropdown__list">
        {loading ? (
          <p className="notif-dropdown__empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="notif-dropdown__empty">No notifications.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notif-dropdown__item${item.status === "UNREAD" ? " notif-dropdown__item--unread" : ""}`}
              onClick={() => handleItemClick(item)}
            >
              <span
                className="notif-dropdown__icon"
                style={{ background: `color-mix(in srgb, ${severityColor(item.severity)} 15%, transparent)`, color: severityColor(item.severity) }}
                aria-hidden
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </span>
              <span className="notif-dropdown__body">
                <span className="notif-dropdown__item-title">{item.title}</span>
                <span className="notif-dropdown__subtext">{item.body}</span>
                <span className="notif-dropdown__meta">{formatTimeAgo(item.createdAt)}</span>
              </span>
              {item.status === "UNREAD" ? <span className="notif-dropdown__dot" aria-hidden /> : null}
            </button>
          ))
        )}
      </div>
      <div className="notif-dropdown__footer">
        <button
          type="button"
          className="notif-dropdown__see-all"
          onClick={() => {
            navigate("/notifications");
            onClose();
          }}
        >
          See all notifications →
        </button>
      </div>
    </div>
  );
}
