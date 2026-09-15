// CrmTabs — reusable tab navigation for CRM pages (crmvis-S1).
// Renders nav.crm-tabs > Link.crm-tab[.crm-tab--on] with ARIA tab roles.
// Pure props — no internal state.

import { Link } from "react-router-dom";

export type CrmTabDef = {
  id: string;
  label: string;
  to: string;
  count?: number | null;
  badge?: "warning" | "danger";
};

export function CrmTabs({
  tabs,
  activeId,
  ariaLabel
}: {
  tabs: CrmTabDef[];
  activeId: string;
  ariaLabel: string;
}) {
  return (
    <nav className="crm-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={`crm-tab${isActive ? " crm-tab--on" : ""}`}
            role="tab"
            aria-selected={isActive}
          >
            {tab.label}
            {tab.count != null && (
              <span className="crm-tab__count">{tab.count}</span>
            )}
            {tab.badge != null && (
              <span className={`s7-badge s7-badge--${tab.badge}`}>{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
