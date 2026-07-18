// Permission catalogue — the code-side source of truth. Every entry here
// is upserted into the `permissions` table by the seed (and re-synced on
// API startup); the seed never deletes RolePermission rows an admin
// created via /admin/settings. See seed-reference.ts for the additive
// semantics that back this.
//
// `label` is what an operator sees in the UI ("Edit rates and price
// lists"). Write labels action-first, in plain English. Derive them from
// the actual enforcement site — never guess a permission's meaning.
// `description` remains the secondary line.
//
// `isHighRisk` marks permissions that grant an override, bypass, or
// elevated write. The matrix UI adds a confirm step before granting one.
// Data-driven, not a hardcoded frontend list.
export const permissionRegistry = [
  { code: "users.view", module: "users", label: "View user accounts", description: "View users" },
  { code: "users.create", module: "users", label: "Create user accounts", description: "Create users", isHighRisk: true },
  { code: "users.update", module: "users", label: "Edit user accounts", description: "Update users", isHighRisk: true },
  { code: "platform.admin", module: "platform", label: "Administer platform configuration", description: "Administer platform configuration — AI providers, notifications, email, integrations", isHighRisk: true },
  { code: "finance.view", module: "finance", label: "View contracts, variations and claims", description: "View contracts, variations, and progress claims" },
  { code: "finance.manage", module: "finance", label: "Create and manage contracts, variations and claims", description: "Create and manage contracts, variations, and progress claims" },
  { code: "finance.admin", module: "finance", label: "Approve claims and adjust contract values", description: "Approve progress claims, record payments, edit contract values", isHighRisk: true },
  { code: "roles.view", module: "roles", label: "View roles", description: "View roles" },
  { code: "roles.create", module: "roles", label: "Create roles", description: "Create roles", isHighRisk: true },
  { code: "roles.update", module: "roles", label: "Edit roles (and role-permission wholesale update)", description: "Update roles", isHighRisk: true },
  { code: "permissions.view", module: "permissions", label: "View the permission catalogue", description: "View permissions" },
  { code: "audit.view", module: "audit", label: "View audit logs", description: "View audit logs" },
  { code: "sharepoint.view", module: "platform", label: "View SharePoint configuration", description: "View SharePoint platform configuration" },
  { code: "sharepoint.manage", module: "platform", label: "Manage SharePoint folders and files", description: "Manage SharePoint-linked folders and files" },
  { code: "notifications.view", module: "platform", label: "View notifications", description: "View notifications" },
  { code: "notifications.manage", module: "platform", label: "Mark notifications read / dismiss", description: "Manage notification status" },
  { code: "search.view", module: "platform", label: "Use global search", description: "Use platform search" },
  { code: "dashboards.view", module: "platform", label: "View dashboards", description: "View dashboards" },
  { code: "dashboards.manage", module: "platform", label: "Create and edit dashboards", description: "Create and edit dashboards" },
  { code: "masterdata.view", module: "masterdata", label: "View master data (lookup values, global lists)", description: "View master data records" },
  { code: "masterdata.manage", module: "masterdata", label: "Edit master data (lookups, global lists)", description: "Create and update master data records" },
  { code: "resources.view", module: "resources", label: "View worker availability and competencies", description: "View worker availability, competencies, and suitability" },
  { code: "resources.manage", module: "resources", label: "Manage worker availability and competencies", description: "Manage worker availability, competencies, and suitability" },
  { code: "assets.view", module: "assets", label: "View the asset register", description: "View asset register and assignment visibility" },
  { code: "assets.manage", module: "assets", label: "Manage the asset register", description: "Manage asset register and categories" },
  { code: "maintenance.view", module: "maintenance", label: "View maintenance schedules and events", description: "View maintenance plans, events, inspections, and breakdowns" },
  { code: "maintenance.manage", module: "maintenance", label: "Manage maintenance schedules and events", description: "Manage maintenance plans, events, inspections, and breakdowns" },
  { code: "inventory.view", module: "inventory", label: "View stock items and movements", description: "View stock items and movements" },
  { code: "inventory.manage", module: "inventory", label: "Manage stock items and stocktakes", description: "Manage stock items, movements, and stocktakes" },
  { code: "forms.view", module: "forms", label: "View form templates and submissions", description: "View form templates and submissions" },
  { code: "forms.submit", module: "forms", label: "Fill and lodge form submissions", description: "Submit forms — fill and lodge submissions" },
  { code: "forms.manage", module: "forms", label: "Create and edit form templates", description: "Create and edit form templates" },
  { code: "forms.approve", module: "forms", label: "Approve or reject form submissions", description: "Approve or reject form submissions in approval chains" },
  // Reserved — Forms Engine Phase 2; declared but not yet enforced (audit 2026-05-02 finding m1).
  // Label reflects the intended surface once it lands.
  { code: "forms.admin", module: "forms", label: "Delete templates and manage form schedules (not yet enforced)", description: "Delete templates, view all submissions, manage schedules", isHighRisk: true },
  { code: "documents.view", module: "documents", label: "View document library", description: "View SharePoint-backed document records and filtered document lists" },
  { code: "documents.manage", module: "documents", label: "Manage document links and access", description: "Create document links, versions, and document access rules" },
  { code: "tenders.view", module: "tendering", label: "View tenders", description: "View tenders" },
  { code: "tenders.manage", module: "tendering", label: "Create and edit tenders", description: "Create and update tenders" },
  { code: "tenderdocuments.view", module: "tendering", label: "View tender documents", description: "View tender documents" },
  { code: "tenderdocuments.manage", module: "tendering", label: "Upload and manage tender documents", description: "Manage tender documents" },
  { code: "jobs.view", module: "jobs", label: "View jobs", description: "View jobs" },
  { code: "jobs.manage", module: "jobs", label: "Create and manage jobs", description: "Create and manage jobs" },
  { code: "scheduler.view", module: "scheduler", label: "View the scheduler", description: "View scheduler workspace" },
  { code: "scheduler.manage", module: "scheduler", label: "Create shifts and assign workers", description: "Create shifts and manage assignments" },
  { code: "calendar.sync", module: "scheduler", label: "Sync assignments to personal calendar", description: "Sync schedulable items to the user's calendar (PR-216 mock-mode)" },
  { code: "tenderconversion.manage", module: "tendering", label: "Award tenders and convert to jobs", description: "Award tenders, issue contracts, and convert tenders to jobs", isHighRisk: true },
  { code: "estimates.view", module: "tendering", label: "View tender estimates and rate library", description: "View tender estimates and rate library" },
  { code: "estimates.manage", module: "tendering", label: "Create and edit tender estimates", description: "Create and update tender estimates" },
  { code: "estimates.admin", module: "tendering", label: "Manage the estimate rate library and configuration", description: "Manage rate library and estimate configuration", isHighRisk: true },
  { code: "projects.view", module: "projects", label: "View projects", description: "View projects, scope, team, and activity log" },
  { code: "projects.manage", module: "projects", label: "Update project team, status, budget and milestones", description: "Update project team, status, budget, milestones, documents" },
  { code: "projects.admin", module: "projects", label: "Create projects manually and reopen closed projects", description: "Create projects manually, change contract value, reopen closed projects", isHighRisk: true },
  { code: "field.view", module: "field", label: "Use the field worker app", description: "Access the field worker app — own allocations, pre-starts, timesheets, documents" },
  { code: "field.manage", module: "field", label: "Approve timesheets and view all field submissions", description: "Approve timesheets and view all field submissions (PM / WHS / Admin)" },
  { code: "directory.view", module: "directory", label: "View clients, subcontractors and suppliers", description: "View business directory — clients, subcontractors, suppliers" },
  { code: "directory.manage", module: "directory", label: "Manage directory entries, contacts and licences", description: "Create and update directory entries, contacts, licences, insurances" },
  { code: "directory.admin", module: "directory", label: "Delete directory entries and approve credit", description: "Delete directory entries, approve credit, update prequalification status", isHighRisk: true },
  { code: "directory.finance", module: "directory", label: "View and edit bank details on directory entries", description: "View and edit bank details on directory entries", isHighRisk: true },
  { code: "compliance.view", module: "compliance", label: "View compliance records and expiry alerts", description: "View compliance records and expiry alerts" },
  { code: "compliance.manage", module: "compliance", label: "Add and edit licences, insurance and qualifications", description: "Add and edit licences, insurance, qualifications" },
  { code: "compliance.admin", module: "compliance", label: "Override compliance blocks and send manual alerts", description: "Override compliance blocks, send manual alerts", isHighRisk: true },
  { code: "safety.view", module: "safety", label: "View safety incidents and hazard observations", description: "View safety incidents and hazard observations" },
  { code: "safety.manage", module: "safety", label: "Report and update incidents and hazards", description: "Report and update incidents and hazard observations" },
  { code: "safety.admin", module: "safety", label: "Close incidents and manage corrective actions", description: "Close incidents/hazards, manage corrective actions", isHighRisk: true },
  { code: "portal.invite", module: "portal", label: "Invite clients to the client portal", description: "Invite client contacts to the client portal" },
  { code: "ai.persona.tendering", module: "ai", label: "Use the Tendering AI assistant", description: "Use the Tendering Assistant AI persona — chat, settings, instruction overrides" },
  { code: "authority.manage", module: "authority", label: "Configure spend limits and approval thresholds", description: "Manage authority rules — configurable spend limits and approval thresholds", isHighRisk: true },
  // Rates & Lists R0 (PR-487).
  { code: "rates.manage", module: "rates", label: "Edit rates and price lists", description: "Create and edit flexible rate tables (RateTable / RateColumn / RateRow)" },
  { code: "lists.manage", module: "lists", label: "Manage list bindings and consumers", description: "Manage list bindings and list-consumer wiring" },
  // Comms + Approvals Phase 2 slice 1.
  { code: "approvals.view", module: "approvals", label: "View approval-decision history", description: "View approval-decision history for a record" },
  { code: "approvals.decide", module: "approvals", label: "Approve or reject records", description: "Record an approval decision (approve or reject) on a record" },
  { code: "approvals.overrule", module: "approvals", label: "Overrule a prior approval decision", description: "Overrule a prior approval decision as a senior in the reporting chain", isHighRisk: true },
  { code: "internal-messages.view", module: "approvals", label: "View internal record messages", description: "View internal record-anchored messages you sent or received" },
  { code: "internal-messages.send", module: "approvals", label: "Send internal record messages", description: "Send an internal record-anchored message to another user" },
  // Procurement (PR-488 slice 1).
  { code: "procurement.view", module: "procurement", label: "View procurement requests and purchase orders", description: "View procurement requests and purchase orders" },
  { code: "procurement.manage", module: "procurement", label: "Draft, edit and submit procurement requests", description: "Create, edit, submit, cancel procurement requests" },
  { code: "procurement.approve", module: "procurement", label: "Approve procurement requests and issue POs", description: "Approve procurement requests and issue purchase orders", isHighRisk: true },
  { code: "procurement.receive", module: "procurement", label: "Record goods receipt against a PO line", description: "Record receipt of goods against a procurement line" },
  // Expenses (D365-parity slice 1 — PR-expenses-slice1).
  { code: "expenses.view", module: "expenses", label: "View expense submissions", description: "View expense submissions and their status" },
  { code: "expenses.manage", module: "expenses", label: "Create and submit expense claims", description: "Create, edit, and submit expense claims" },
  { code: "expenses.approve", module: "expenses", label: "Approve or reject expense submissions", description: "Approve or reject submitted expense claims — routed via AuthorityService", isHighRisk: true },
  // Case management (slice 1, PR cases-slice1).
  { code: "cases.view", module: "cases", label: "View cases (defects, warranty, RFIs, complaints)", description: "View case register, detail, and comment thread" },
  { code: "cases.manage", module: "cases", label: "Create and manage cases", description: "Raise cases, update status, assign, and post comments" },
  // Automation engine (MVP slice 1). Cross-module Power-Automate-style rules.
  // Manage is high-risk: a rule fires on domain events across the platform.
  { code: "automations.view", module: "platform", label: "View automation rules", description: "View admin-configured automation rules and their run log" },
  { code: "automations.manage", module: "platform", label: "Create and edit automation rules", description: "Create, edit, enable and disable admin-configured automation rules", isHighRisk: true }
] as const;

export type PermissionRegistryEntry = (typeof permissionRegistry)[number];
