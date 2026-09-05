// CRM S2: Accounts landing page — tab shell.
// Renders two URL-keyed tabs so the tab is linkable and shareable:
//   ?tab=list         (default) → existing AccountsListPage content unchanged
//   ?tab=relationships          → existing RelationshipsPage content unchanged
//
// /crm/relationships redirects here with ?tab=relationships (App.tsx).
// Data fetching, filters, and content of each page are untouched.

import { useEffect, useState } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
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

// CRM_CHROME_V1 — plain grey tab figure. The colour is read back off the
// existing tabStyle() so the count can never drift from the inactive tab text.
const tabCountStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 12,
  fontWeight: 400,
  color: tabStyle(false).color
};

export function AccountsPage() {
  const [searchParams] = useSearchParams();
  const { authFetch } = useAuth();
  const activeTab: TabId = (searchParams.get("tab") as TabId) ?? "list";
  const validTab = TABS.some((t) => t.id === activeTab) ? activeTab : "list";

  // CRM_CHROME_V1 — List count from GET /crm/accounts?limit=1 (`total`).
  // Relationships carries no count in the mock-up; do not invent one.
  // Null means "loading or the request failed" — the label renders alone.
  const [listCount, setListCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/crm/accounts?limit=1");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { total?: number };
        if (!cancelled && typeof body.total === "number") setListCount(body.total);
      } catch {
        // A tab must never break because a count did not arrive.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <div>
      {/* CRM_NAV_TABS — accounts tab bar (S2, 2026-08-28; CRM_CHROME_V1 counts). */}
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
            {tab.id === "list" && listCount !== null ? (
              <span style={tabCountStyle}>{listCount}</span>
            ) : null}
          </NavLink>
        ))}
      </div>
      {validTab === "list" && <AccountsListPage />}
      {validTab === "relationships" && <RelationshipsPage />}
    </div>
  );
}
