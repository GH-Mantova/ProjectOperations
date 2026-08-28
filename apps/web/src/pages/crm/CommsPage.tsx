// CRM S2: Comms hub landing page — tab shell.
// Renders three URL-keyed tabs so each tab is linkable and shareable:
//   ?tab=inbox        (default) → existing CommsHubPage content unchanged
//   ?tab=threads                → empty state (filled by S10)
//   ?tab=todos                  → empty state (filled by S10)
//
// Data fetching, filters, and content of CommsHubPage are untouched.

import { useSearchParams, NavLink } from "react-router-dom";
import { CommsHubPage } from "./CommsHubPage";

type TabId = "inbox" | "threads" | "todos";

const TABS: { id: TabId; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "threads", label: "Threads" },
  { id: "todos", label: "To-dos" }
];

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

function ThreadsEmptyState() {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "#6b7280",
        maxWidth: 480,
        margin: "0 auto"
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        Threads coming in S10
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        The Threads tab will surface anchored conversation threads from across the CRM.
        This is delivered in <strong>CRM S10 — Inbox tab</strong>.
      </p>
    </div>
  );
}

function TodosEmptyState() {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "#6b7280",
        maxWidth: 480,
        margin: "0 auto"
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        To-dos coming in S10
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        The To-dos tab will surface CRM task management across all record types.
        This is delivered in <strong>CRM S10 — Inbox tab</strong>.
      </p>
    </div>
  );
}

export function CommsPage() {
  const [searchParams] = useSearchParams();
  const activeTab: TabId = (searchParams.get("tab") as TabId) ?? "inbox";
  const validTab = TABS.some((t) => t.id === activeTab) ? activeTab : "inbox";

  return (
    <div>
      {/* CRM_NAV_TABS — comms-hub tab bar (S2, 2026-08-28). */}
      <div style={tabBarStyle} role="tablist" aria-label="Comms hub sections">
        {TABS.map((tab) => (
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
      {validTab === "inbox" && <CommsHubPage />}
      {validTab === "threads" && <ThreadsEmptyState />}
      {validTab === "todos" && <TodosEmptyState />}
    </div>
  );
}
