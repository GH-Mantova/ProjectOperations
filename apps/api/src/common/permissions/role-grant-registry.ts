// Role-grant registry — the ONE place role→permission grants are declared.
//
// Workflow:
//   1. Edit ROLE_GRANTS below (add or remove codes for a role).
//   2. Run: pnpm --filter @project-ops/api grants:write
//      This writes a new migration under prisma/migrations/ and updates
//      role-grants.lock.json to match.
//   3. Commit the migration SQL + updated lock in the same PR.
//   4. Include GATE-ALLOW: migrations in the PR body (column 0, bare).
//
// CI gate: apps/api/src/modules/permissions/__tests__/role-grant-registry.spec.ts
// fails when the map differs from the lock — the error message prints the
// exact command to run.
//
// Removals: grants:write only updates the lock; it does NOT revoke grants in
// any database. Directors may grant extras via /admin/settings — those survive.
// A role absent from a target database is skipped with a RAISE NOTICE.

export const ROLE_GRANT_REGISTRY_V1 = "permission-role-reconciler";

/**
 * Role name -> sorted, de-duplicated permission codes.
 *
 * Admin is intentionally absent: it receives every permission via the
 * reference seed (seed-reference.ts) and must not be constrained here.
 */
export const ROLE_GRANTS: Readonly<Record<string, readonly string[]>> = {
  Accounts: [
    "compliance.view",
    "dashboards.view",
    "directory.finance",
    "directory.manage",
    "directory.view",
    "documents.view",
    "finance.manage",
    "finance.view",
    "jobs.view",
    "masterdata.manage",
    "masterdata.view",
    "notifications.view",
    "projects.view",
    "resources.view",
    "search.view",
    "tenderconversion.manage",
    "tenderdocuments.view",
    "tenders.view",
    "users.view"
  ],
  Field: [
    "permissions.view"
  ],
  "Field Worker": [
    "expenses.manage",
    "expenses.view",
    "field.view",
    "notifications.view",
    "safety.manage",
    "safety.view",
    "sites.manage",
    "sites.view"
  ],
  Planner: [
    "assets.manage",
    "assets.view",
    "documents.manage",
    "documents.view",
    "forms.manage",
    "forms.view",
    "inventory.manage",
    "inventory.view",
    "jobs.manage",
    "jobs.view",
    "maintenance.manage",
    "maintenance.view",
    "masterdata.manage",
    "permissions.view",
    "procurement.approve",
    "procurement.manage",
    "procurement.receive",
    "procurement.view",
    "projects.manage",
    "projects.view",
    "resources.manage",
    "resources.view",
    "roles.view",
    "scheduler.manage",
    "scheduler.view",
    "tenderconversion.manage",
    "tenderdocuments.manage",
    "tenderdocuments.view",
    "tenders.manage",
    "tenders.view",
    "users.view"
  ],
  "Project Manager": [
    "assets.view",
    "compliance.view",
    "dashboards.view",
    "directory.view",
    "documents.manage",
    "documents.view",
    "field.manage",
    "finance.view",
    "forms.manage",
    "forms.view",
    "jobs.manage",
    "jobs.view",
    "maintenance.view",
    "masterdata.manage",
    "masterdata.view",
    "notifications.view",
    "projects.manage",
    "projects.view",
    "resources.manage",
    "resources.view",
    "safety.manage",
    "safety.view",
    "scheduler.manage",
    "scheduler.view",
    "search.view",
    "sites.view",
    "tenderconversion.manage",
    "tenders.view",
    "users.view"
  ],
  "Senior Estimator": [
    "ai.persona.tendering",
    "dashboards.view",
    "directory.manage",
    "directory.view",
    "documents.view",
    "estimates.admin",
    "estimates.manage",
    "estimates.view",
    "masterdata.manage",
    "masterdata.view",
    "notifications.view",
    "projects.view",
    "resources.view",
    "search.view",
    "tenderdocuments.manage",
    "tenderdocuments.view",
    "tenders.manage",
    "tenders.view",
    "users.view"
  ],
  Viewer: [
    "assets.view",
    "crm.view",
    "dashboards.view",
    "directory.view",
    "documents.view",
    "forms.view",
    "inventory.view",
    "jobs.view",
    "maintenance.view",
    "masterdata.view",
    "notifications.view",
    "permissions.view",
    "resources.view",
    "roles.view",
    "scheduler.view",
    "search.view",
    "tenderdocuments.view",
    "tenders.view",
    "users.view"
  ],
  "WHS Officer": [
    "audit.view",
    "compliance.admin",
    "compliance.manage",
    "compliance.view",
    "dashboards.view",
    "documents.manage",
    "documents.view",
    "field.manage",
    "forms.manage",
    "forms.view",
    "jobs.view",
    "masterdata.manage",
    "masterdata.view",
    "notifications.view",
    "projects.view",
    "resources.view",
    "safety.admin",
    "safety.manage",
    "safety.view",
    "search.view",
    "sites.view",
    "tenders.view",
    "users.view"
  ],
  "Warehouse Manager": [
    "assets.manage",
    "assets.view",
    "dashboards.view",
    "inventory.manage",
    "inventory.view",
    "jobs.view",
    "maintenance.manage",
    "maintenance.view",
    "masterdata.manage",
    "masterdata.view",
    "notifications.view",
    "procurement.manage",
    "procurement.receive",
    "procurement.view",
    "projects.view",
    "resources.manage",
    "resources.view",
    "scheduler.view",
    "search.view",
    "users.view"
  ]
} as const;
