import { registerAs } from "@nestjs/config";

export const xeroConfig = registerAs("xero", () => ({
  clientId: process.env.XERO_CLIENT_ID ?? "",
  clientSecret: process.env.XERO_CLIENT_SECRET ?? "",
  redirectUri:
    process.env.XERO_REDIRECT_URI ?? "http://localhost:3000/api/v1/xero/callback",
  scopes:
    process.env.XERO_SCOPES?.split(" ") ?? [
      "openid",
      "profile",
      "email",
      "accounting.contacts",
      "accounting.transactions",
      "offline_access"
    ],
  // Account code for ACCPAY bills pushed from Expense records.
  // Override per-deployment via XERO_EXPENSE_ACCOUNT_CODE.
  // Default 420 = typical "Employee Reimbursements" in Xero starter chart.
  expenseAccountCode: process.env.XERO_EXPENSE_ACCOUNT_CODE ?? "420",
  // Account code for ACCPAY bills pushed from vendor invoices (3-way match).
  // Override per-deployment via XERO_VENDOR_INVOICE_ACCOUNT_CODE.
  // Default 310 = typical "Purchases" account code in Xero starter chart.
  vendorInvoiceAccountCode: process.env.XERO_VENDOR_INVOICE_ACCOUNT_CODE ?? "310",
  // Xero tracking category name for project allocation (optional).
  // When set, each pushed bill carries a tracking option equal to the project number.
  // Override via XERO_TRACKING_CATEGORY_NAME.
  trackingCategoryName: process.env.XERO_TRACKING_CATEGORY_NAME ?? "",
}));
