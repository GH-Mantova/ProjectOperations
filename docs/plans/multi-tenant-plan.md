# SLICE-0 plan — Multi-company / multi-tenant

**Status:** PLAN ONLY (Marco 2026-08-04). Justification: a sister company would use the same system with
separated data. **This is the largest lift on the roadmap — heavily Marco-involved, phased, and every
schema slice escalates.** No sub-slice armed. Design source: `docs/architecture/drafts/tenant-readiness-analysis.md`.

## Problem / goal

Run more than one company (starting with the sister company) in the same deployment with **hard data
separation** — each tenant sees only its own tenders, jobs, contacts, rates, forms, etc. — plus a way to
assign users to a tenant and (optionally) share reference data.

## Tenancy model — decision needed FIRST (Marco)

Three options; recommend **(A) row-level `tenantId`** for a two-company start:
- **(A) Shared DB, `tenantId` discriminator on every tenant-owned row** + a mandatory query filter.
  Cheapest to run, one migration path; the risk is a missed filter leaking data (mitigated by a global
  Prisma middleware that injects the tenant filter + tests). **Recommended.**
- **(B) Schema-per-tenant** (one Postgres schema each). Stronger isolation, heavier ops, harder migrations.
- **(C) Database-per-tenant.** Strongest isolation, most ops overhead. Overkill for two related companies.

Locking (A) vs (B)/(C) is the single biggest decision and must be Marco's before any code.

## Phased plan (assuming model A; each phase is many escalates slices)

- **MT-0 — Tenant model + additive `tenantId` columns** (nullable, default = the existing company as
  tenant #1). Purely additive migration; nothing enforced yet; no behaviour change. Escalates.
- **MT-1 — Tenant-scoping middleware.** A Prisma middleware (or repository guard) that injects
  `tenantId = currentTenant` on every tenant-owned read/write; contract tests that a cross-tenant read
  returns nothing. This is the security core.
- **MT-2 — Identity carries tenant.** JWT + session carry the active `tenantId`; login resolves the
  user's tenant(s); a Super User can switch tenants. Reuses the existing auth seam (do not touch Entra).
- **MT-3 — Backfill + enforce NOT NULL** on `tenantId` (production-data migration — Marco-run, like the
  siteId backfill). Only after MT-1/MT-2 are proven.
- **MT-4 — Shared reference data policy.** Decide per reference table (rates, global lists, permission
  registry) whether it is tenant-scoped or shared; implement the split.
- **MT-5 — Tenant admin UI** (create tenant, assign users, per-tenant branding/settings).

## Risks

- **Data-leak = the whole point failing.** MT-1 middleware + cross-tenant tests are non-negotiable; ship
  nothing tenant-facing until they're green.
- **Every existing query** must go through the scoped path — a missed raw query is a leak. Audit needed.
- **Interaction with in-flight migrations** (rate-table, model-merge, siteId) — sequence MT-0 after those
  settle to avoid migration collisions.
- Blast radius is the entire schema; this program runs **only with Marco present**, one phase at a time.

## Start

Do NOT arm anything until Marco locks the tenancy model (A/B/C). Then MT-0 (additive columns) first.
