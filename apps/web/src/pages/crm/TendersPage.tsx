// CRM S2: Tenders landing page — tab shell.
// Renders two URL-keyed tabs so the tab is linkable and shareable:
//   ?tab=register     (default) → existing TendersRegisterPage content unchanged
//   ?tab=follow-ups             → empty state (filled by S8)
//
// Data fetching, filters, and content of TendersRegisterPage are untouched.

import { useSearchParams, NavLink } from "react-router-dom";
import { TendersRegisterPage } from "./TendersRegisterPage";

type TabId = "register" | "follow-ups";

const TABS: { id: TabId; label: string }[] = [
  { id: "register", label: "Register" },
  { id: "follow-ups", label: "Follow-ups" }
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

function FollowUpsEmptyState() {
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
      <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        Follow-ups coming in S8
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        The Follow-ups tab will surface tender-level follow-up actions and next-action tracking.
        This is delivered in <strong>CRM S8 — Register & Follow-ups, one screen</strong>.
      </p>
    </div>
  );
}

export function TendersPage() {
  const [searchParams] = useSearchParams();
  const activeTab: TabId = (searchParams.get("tab") as TabId) ?? "register";
  const validTab = TABS.some((t) => t.id === activeTab) ? activeTab : "register";

  return (
    <div>
      {/* CRM_NAV_TABS — tenders tab bar (S2, 2026-08-28). */}
      <div style={tabBarStyle} role="tablist" aria-label="Tenders sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.id === "register" ? "/crm/register" : `/crm/register?tab=${tab.id}`}
            style={tabStyle(validTab === tab.id)}
            role="tab"
            aria-selected={validTab === tab.id}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      {validTab === "register" && <TendersRegisterPage />}
      {validTab === "follow-ups" && <FollowUpsEmptyState />}
    </div>
  );
}
