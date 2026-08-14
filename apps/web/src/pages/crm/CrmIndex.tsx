// NAV-1: CRM index redirect. /crm → /crm/accounts (the Accounts landing).
// The Accounts list page (AccountsListPage) ships in NAV-2; for now
// /crm/accounts routes to the AccountDetailPage index or NotFoundPage until
// NAV-2 lands. This redirect keeps the nav group wired correctly.
import { Navigate } from "react-router-dom";

export function CrmIndex() {
  return <Navigate to="/crm/accounts" replace />;
}
