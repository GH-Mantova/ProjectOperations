// CRM S2: Accounts landing page — tab shell.
// Renders two URL-keyed tabs so the tab is linkable and shareable:
//   ?tab=list         (default) → existing AccountsListPage content unchanged
//   ?tab=relationships          → existing RelationshipsPage content unchanged
//
// /crm/relationships redirects here with ?tab=relationships (App.tsx).
// Data fetching, filters, and content of each page are untouched.

import { useSearchParams, NavLink } from "react-router-dom";
import { AccountsListPage } from "./AccountsListPage";
import { RelationshipsPage } from "./RelationshipsPage";

type TabId = "list" | "relationships";

const TABS: { id: TabId; label: string }[] = [
  { id: "list", label: "List" },
  { id: "relationships", label: "Relationships" }
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

export function AccountsPage() {
  const [searchParams] = useSearchParams();
  const activeTab: TabId = (searchParams.get("tab") as TabId) ?? "list";
  const validTab = TABS.some((t) => t.id === activeTab) ? activeTab : "list";

  return (
    <div>
      {/* CRM_NAV_TABS — accounts tab bar (S2, 2026-08-28). */}
      <div style={tabBarStyle} role="tablist" aria-label="Accounts sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.id === "list" ? "/crm/accounts" : `/crm/accounts?tab=${tab.id}`}
            style={tabStyle(validTab === tab.id)}
            role="tab"
            aria-selected={validTab === tab.id}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      {validTab === "list" && <AccountsListPage />}
      {validTab === "relationships" && <RelationshipsPage />}
    </div>
  );
}
