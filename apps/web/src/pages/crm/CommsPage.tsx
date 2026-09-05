// CRM S2 (+ CRM UIFIX S1): Comms hub landing page — tab shell.
// Renders three URL-keyed tabs so each tab is linkable and shareable:
//   ?tab=inbox    (default) → CommsHubPage inbox view
//   ?tab=threads            → CommsHubPage threads view
//   ?tab=todos              → CommsHubPage my-to-dos view
//
// CRM UIFIX S1 (2026-09-01) — CommsHubPage used to keep its own inboxTab state
// and draw its own tab bar, so the /crm/comms screen carried TWO tab bars —
// the outer here (advertising an "S10 empty state" for work already shipped)
// and the inner in CommsHubPage. We now pass the tab down as a prop and
// CommsHubPage renders no inner tablist. One tab bar per page, one URL
// contract. Anchored /crm/comms?entityType=…&entityId=… links still open the
// anchored view inside CommsHubPage unchanged.

import { useEffect, useState } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CommsHubPage, type CommsInnerTab } from "./CommsHubPage";

export type CommsOuterTabId = "inbox" | "threads" | "todos";

export const COMMS_TABS: { id: CommsOuterTabId; label: string; inner: CommsInnerTab }[] = [
  { id: "inbox", label: "Inbox", inner: "inbox" },
  { id: "threads", label: "Threads", inner: "threads" },
  { id: "todos", label: "To-dos", inner: "tasks" }
];

/** Resolve the outer URL tab id to the inner CommsHubPage tab. */
export function resolveCommsInnerTab(outer: CommsOuterTabId): CommsInnerTab {
  const entry = COMMS_TABS.find((t) => t.id === outer);
  return entry ? entry.inner : "inbox";
}

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 0,
  borderBottom: "2px solid #e5e7eb",
  padding: "0 24px",
  background: "var(--surface-1, #fff)"
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? "#4f46e5" : "#6b7280",
    borderBottom: active ? "2px solid #4f46e5" : "2px solid transparent",
    marginBottom: -2,
    textDecoration: "none",
    background: "transparent",
    cursor: "pointer",
    transition: "color 0.15s"
  };
}

// CRM_CHROME_V1 — plain grey tab figure, colour read back off the existing
// tabStyle() so it can never drift from the inactive tab text.
const tabCountStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 12,
  fontWeight: 400,
  color: tabStyle(false).color
};

// CRM_CHROME_V1 — Inbox is the attention count: a red pill with white text,
// straight off the shared design tokens (--status-danger is the mock-up's
// red); no colour literal is introduced here.
const tabPillStyle: React.CSSProperties = {
  marginLeft: 6,
  display: "inline-block",
  padding: "1px 7px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: "var(--status-danger)",
  color: "var(--text-inverse)"
};

export function CommsPage() {
  const [searchParams] = useSearchParams();
  const { authFetch, user } = useAuth();
  const raw = (searchParams.get("tab") as CommsOuterTabId | null) ?? "inbox";
  const validTab: CommsOuterTabId =
    COMMS_TABS.some((t) => t.id === raw) ? raw : "inbox";
  const innerTab = resolveCommsInnerTab(validTab);

  // CRM_CHROME_V1 — three tab counts, each off an existing route that already
  // returns a `total`. Null means "loading or the request failed", and the
  // label then renders alone: a tab must never break because a count did not
  // arrive.
  const userId = user?.id;
  const [counts, setCounts] = useState<Record<CommsOuterTabId, number | null>>({
    inbox: null,
    threads: null,
    todos: null
  });

  useEffect(() => {
    let cancelled = false;
    const load = async (tab: CommsOuterTabId, url: string) => {
      try {
        const res = await authFetch(url);
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { total?: number };
        if (cancelled || typeof body.total !== "number") return;
        setCounts((current) => ({ ...current, [tab]: body.total as number }));
      } catch {
        // A tab must never break because a count did not arrive.
      }
    };
    void load("inbox", "/crm/intake/open?limit=1");
    void load("threads", "/crm/comms/threads?limit=1");
    if (userId) {
      void load("todos", `/crm/comms/tasks?assigneeId=${encodeURIComponent(userId)}&limit=1`);
    }
    return () => {
      cancelled = true;
    };
  }, [authFetch, userId]);

  return (
    <div>
      {/* CRM_NAV_TABS — comms-hub tab bar (S2, 2026-08-28; UIFIX S1, 2026-09-01;
          CRM_CHROME_V1 counts, 2026-09-04). */}
      <div style={tabBarStyle} role="tablist" aria-label="Comms hub sections">
        {COMMS_TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.id === "inbox" ? "/crm/comms" : `/crm/comms?tab=${tab.id}`}
            style={tabStyle(validTab === tab.id)}
            role="tab"
            aria-selected={validTab === tab.id}
          >
            {tab.label}
            {counts[tab.id] === null ? null : tab.id === "inbox" ? (
              <span style={tabPillStyle}>{counts.inbox}</span>
            ) : (
              <span style={tabCountStyle}>{counts[tab.id]}</span>
            )}
          </NavLink>
        ))}
      </div>
      <CommsHubPage activeInnerTab={innerTab} />
    </div>
  );
}
