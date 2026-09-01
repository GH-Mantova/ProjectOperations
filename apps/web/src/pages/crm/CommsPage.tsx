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

import { useSearchParams, NavLink } from "react-router-dom";
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

export function CommsPage() {
  const [searchParams] = useSearchParams();
  const raw = (searchParams.get("tab") as CommsOuterTabId | null) ?? "inbox";
  const validTab: CommsOuterTabId =
    COMMS_TABS.some((t) => t.id === raw) ? raw : "inbox";
  const innerTab = resolveCommsInnerTab(validTab);

  return (
    <div>
      {/* CRM_NAV_TABS — comms-hub tab bar (S2, 2026-08-28; UIFIX S1, 2026-09-01). */}
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
          </NavLink>
        ))}
      </div>
      <CommsHubPage activeInnerTab={innerTab} />
    </div>
  );
}
