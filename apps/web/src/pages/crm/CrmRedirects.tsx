// NAV-4: Centralised CRM redirect components.
// CrmRootRedirect: /crm → /crm/accounts (same behaviour as CrmIndex, kept
//   in sync). CrmCatchAllRedirect: /crm/* dead paths → /crm/accounts.
//   ClientsEntryRedirect: /clients bookmark alias → /crm/accounts.
// The deep Directory decommission (Subcontractor/Supplier) is owned by
// docs/plans/site-dissolution-plan.md — not duplicated here.
import { Navigate } from "react-router-dom";

/** /crm → /crm/accounts (mirrors the CrmIndex redirect). */
export function CrmRootRedirect() {
  return <Navigate to="/crm/accounts" replace />;
}

/** Catch-all for dead /crm/* paths → /crm/accounts. */
export function CrmCatchAllRedirect() {
  return <Navigate to="/crm/accounts" replace />;
}

/** /clients bookmark alias → /crm/accounts.
 * Deep Directory decommission deferred to site-dissolution-plan. */
export function ClientsEntryRedirect() {
  return <Navigate to="/crm/accounts" replace />;
}
