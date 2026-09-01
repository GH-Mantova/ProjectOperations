// CRM S2 (+ CRM UIFIX S1): Tenders landing page — tab shell.
// Renders two URL-keyed tabs so the tab is linkable and shareable:
//   ?tab=register     (default) → Register view of TendersRegisterPage
//   ?tab=follow-ups             → Follow-ups view of TendersRegisterPage
//
// CRM UIFIX S1 (2026-09-01) — the outer tab bar is the design. The
// Follow-ups branch used to render an "S8 empty state" stub while the real
// S8 work already shipped inside TendersRegisterPage (which drew its own
// second tab bar). We now pass the tab down as a prop and
// TendersRegisterPage renders no inner tablist. One tab bar per page, one
// URL contract.

import { useSearchParams, NavLink } from "react-router-dom";
import { TendersRegisterPage, type TendersRegisterTab } from "./TendersRegisterPage";

export type TendersOuterTabId = "register" | "follow-ups";

export const TENDERS_TABS: { id: TendersOuterTabId; label: string; inner: TendersRegisterTab }[] = [
  { id: "register", label: "Register", inner: "register" },
  { id: "follow-ups", label: "Follow-ups", inner: "followups" }
];

/** Resolve the outer URL tab id to the inner TendersRegisterPage tab. */
export function resolveTendersInnerTab(outer: TendersOuterTabId): TendersRegisterTab {
  return outer === "follow-ups" ? "followups" : "register";
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

export function TendersPage() {
  const [searchParams] = useSearchParams();
  const raw = (searchParams.get("tab") as TendersOuterTabId | null) ?? "register";
  const validTab: TendersOuterTabId =
    TENDERS_TABS.some((t) => t.id === raw) ? raw : "register";
  const innerTab = resolveTendersInnerTab(validTab);

  return (
    <div>
      {/* CRM_NAV_TABS — tenders tab bar (S2, 2026-08-28; UIFIX S1, 2026-09-01). */}
      <div style={tabBarStyle} role="tablist" aria-label="Tenders sections">
        {TENDERS_TABS.map((tab) => (
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
      <TendersRegisterPage activeTab={innerTab} />
    </div>
  );
}
