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
//
// CRM_PARITY_REGISTER_V1 (crmvis-S4, 2026-09-16) — tab card moved into
// TendersRegisterPage using the CrmTabs component (same shape as
// AccountsPage → AccountsListPage). TendersPage builds the tab defs and
// count data; TendersRegisterPage renders the CrmTabs bar. Hex literals
// and inline tabBarStyle/tabStyle removed; all colours are tokens.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  countDistinctOverdueTenders,
  type CrmOverdueTaskRow
} from "../../components/ShellLayout";
import { TendersRegisterPage, type TendersRegisterTab } from "./TendersRegisterPage";
import type { CrmTabDef } from "./CrmTabs";

export type TendersOuterTabId = "register" | "follow-ups";

export const TENDERS_TABS: { id: TendersOuterTabId; label: string; inner: TendersRegisterTab }[] = [
  { id: "register", label: "Register", inner: "register" },
  { id: "follow-ups", label: "Follow-ups", inner: "followups" }
];

/** Resolve the outer URL tab id to the inner TendersRegisterPage tab. */
export function resolveTendersInnerTab(outer: TendersOuterTabId): TendersRegisterTab {
  return outer === "follow-ups" ? "followups" : "register";
}

export function TendersPage() {
  const [searchParams] = useSearchParams();
  const { authFetch } = useAuth();
  const raw = (searchParams.get("tab") as TendersOuterTabId | null) ?? "register";
  const validTab: TendersOuterTabId =
    TENDERS_TABS.some((t) => t.id === raw) ? raw : "register";
  const innerTab = resolveTendersInnerTab(validTab);

  // CRM_CHROME_V1 — Register count from GET /tenders?pageSize=1 (`total`).
  // Follow-ups is the distinct-overdue-tender derivation shared with the
  // sidebar badge, off the same request TendersRegisterPage already issues.
  // Null means "loading or the request failed" — the label renders alone.
  const [registerCount, setRegisterCount] = useState<number | null>(null);
  const [followUpCount, setFollowUpCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/tenders?pageSize=1");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { total?: number };
        if (!cancelled && typeof body.total === "number") setRegisterCount(body.total);
      } catch {
        // A tab must never break because a count did not arrive.
      }
    })();
    (async () => {
      try {
        const res = await authFetch("/crm/comms/tasks?entityType=TENDER&status=OPEN&limit=200");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { items?: CrmOverdueTaskRow[] };
        if (!cancelled) {
          setFollowUpCount(countDistinctOverdueTenders(body.items ?? [], Date.now()));
        }
      } catch {
        // A tab must never break because a count did not arrive.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // CRM_PARITY_REGISTER_V1: Build CrmTabDef array — passed to
  // TendersRegisterPage which renders the CrmTabs bar (same pattern as
  // AccountsPage → AccountsListPage). The Follow-ups count renders as an
  // amber pill via badge="warning" when non-zero.
  const tabs: CrmTabDef[] = [
    {
      id: "register",
      label: "Register",
      to: "/crm/register",
      count: registerCount
    },
    {
      id: "follow-ups",
      label: "Follow-ups",
      to: "/crm/register?tab=follow-ups",
      badge: followUpCount != null && followUpCount > 0 ? "warning" : undefined,
      count: followUpCount
    }
  ];

  return (
    <TendersRegisterPage activeTab={innerTab} tabs={tabs} activeId={validTab} />
  );
}
