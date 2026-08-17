// NAV-1: CRM index redirect. /crm → /crm/accounts (the Accounts landing).
// NAV-4: Implementation moved to CrmRedirects.tsx (centralised redirect module).
// This file is kept as a thin re-export shim to avoid churn in App.tsx (line 109).
export { CrmRootRedirect as CrmIndex } from "./CrmRedirects";
