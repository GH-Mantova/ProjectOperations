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
//
// CRM_PARITY_INBOX_V1 (crmvis-S7): tab bar uses crm-tab CSS classes.

import { useEffect, useState } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CommsHubPage, type CommsInnerTab } from "./CommsHubPage";
import "./crm.css";

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

// CRM_CHROME_V1 — Inbox is the attention count: a red pill with white text,
// straight off the shared design tokens (--status-danger is the mock-up's red).
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
          CRM_CHROME_V1 counts, 2026-09-04; CRM_PARITY_INBOX_V1 crm-tab classes, 2026-09-21). */}
      <nav className="crm-tabs" role="tablist" aria-label="Comms hub sections">
        {COMMS_TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.id === "inbox" ? "/crm/comms" : `/crm/comms?tab=${tab.id}`}
            className={`crm-tab${validTab === tab.id ? " crm-tab--on" : ""}`}
            role="tab"
            aria-selected={validTab === tab.id}
          >
            {tab.label}
            {counts[tab.id] === null ? null : tab.id === "inbox" ? (
              <span style={tabPillStyle}>{counts.inbox}</span>
            ) : (
              <span className="crm-tab__count">{counts[tab.id]}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <CommsHubPage activeInnerTab={innerTab} />
    </div>
  );
}
