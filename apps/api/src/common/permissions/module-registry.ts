// Display names for permission modules. The keys match `Permission.module`
// strings (the raw slug the API also groups by). Kept as data so an
// operator can reword a title without a deploy — the seed upserts each
// entry into the `permission_modules` lookup table, and the /permissions
// endpoint joins it back on read.
//
// Unknown modules fall back to their raw slug in the UI, so removing an
// entry here degrades gracefully rather than breaking a page.
export const permissionModuleRegistry: Array<{ name: string; label: string }> = [
  { name: "users", label: "Users" },
  { name: "platform", label: "Platform configuration" },
  { name: "finance", label: "Finance — contracts, variations, claims" },
  { name: "roles", label: "Roles" },
  { name: "permissions", label: "Permissions" },
  { name: "audit", label: "Audit log" },
  { name: "masterdata", label: "Master data" },
  { name: "resources", label: "Resources — worker availability" },
  { name: "assets", label: "Plant and assets" },
  { name: "maintenance", label: "Maintenance" },
  { name: "inventory", label: "Inventory and stock" },
  { name: "forms", label: "Forms" },
  { name: "documents", label: "Documents" },
  { name: "tendering", label: "Tendering and estimating" },
  { name: "jobs", label: "Jobs" },
  { name: "scheduler", label: "Scheduler" },
  { name: "projects", label: "Projects" },
  { name: "field", label: "Field worker app" },
  { name: "directory", label: "Directory — clients, subcontractors, suppliers" },
  { name: "compliance", label: "Compliance and tickets" },
  { name: "safety", label: "Safety" },
  { name: "portal", label: "Client portal" },
  { name: "ai", label: "AI assistants" },
  { name: "authority", label: "Authority and approval limits" },
  { name: "rates", label: "Rates and price lists" },
  { name: "lists", label: "List bindings" },
  { name: "approvals", label: "Approvals and internal messages" },
  { name: "procurement", label: "Procurement" },
  { name: "cases", label: "Case management" },
  { name: "workers", label: "Workers and leave" },
  { name: "reporting", label: "Reporting and BI" }
];
