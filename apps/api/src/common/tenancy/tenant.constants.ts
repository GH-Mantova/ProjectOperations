// MT-0 — multi-tenant foundation constants (shared across MT-1..MT-5 slices).
//
// Locked decisions (docs/plans/multi-tenant-plan.md, 2026-08-04):
//   * Model A — row-level `tenantId` on tenant-aware models.
//   * A five-model pilot set is the scope of MT-1 scoping / MT-3 backfill.
//   * One default tenant seeded up-front so existing data has a target row
//     for MT-3's backfill; nothing is backfilled or made NOT NULL in MT-0.

// The pilot set of tenant-aware models. Scoping (MT-1) covers exactly these.
export const PILOT_TENANT_AWARE_MODELS = [
  "Client",
  "Worker",
  "Contact",
  "Tender",
  "Job",
] as const;

export type PilotTenantAwareModel = (typeof PILOT_TENANT_AWARE_MODELS)[number];

// The one existing company, seeded as tenant #1. Used by MT-3's backfill.
export const SEEDED_DEFAULT_TENANT_ID = "tenant-initial-services-001";
