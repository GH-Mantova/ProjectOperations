// CRM S2: Accounts landing page — tab shell.
// Renders two URL-keyed tabs so the tab is linkable and shareable:
//   ?tab=list         (default) → existing AccountsListPage content unchanged
//   ?tab=relationships          → existing RelationshipsPage content unchanged
//
// /crm/relationships redirects here with ?tab=relationships (App.tsx).
// Data fetching, filters, and content of each page are untouched.
//
// crmvis-S1: tab bar moved into AccountsListPage (CrmTabs component).
// AccountsPage owns the data (list count) and passes tabs+activeId down.
// RelationshipsPage will receive the same props in S2.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AccountsListPage } from "./AccountsListPage";
import { RelationshipsPage } from "./RelationshipsPage";
import type { CrmTabDef } from "./CrmTabs";

type TabId = "list" | "relationships";

const VALID_TABS: TabId[] = ["list", "relationships"];

export function AccountsPage() {
  const [searchParams] = useSearchParams();
  const { authFetch } = useAuth();
  const activeTabRaw = searchParams.get("tab") as TabId | null;
  const activeTab: TabId =
    activeTabRaw && VALID_TABS.includes(activeTabRaw) ? activeTabRaw : "list";

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

  const tabs: CrmTabDef[] = [
    {
      id: "list",
      label: "List",
      to: "/crm/accounts",
      count: listCount
    },
    {
      id: "relationships",
      label: "Relationships",
      to: "/crm/accounts?tab=relationships"
    }
  ];

  return (
    <div>
      {activeTab === "list" && (
        <AccountsListPage tabs={tabs} activeId={activeTab} />
      )}
      {activeTab === "relationships" && <RelationshipsPage />}
    </div>
  );
}
