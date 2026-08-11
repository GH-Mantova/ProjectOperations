# SLICE-0 plan — Multi-company / multi-tenant

**Status:** PLAN ONLY (Marco 2026-08-04). Justification: a sister company would use the same system with
separated data, and the two companies **share some** workers, clients, and suppliers (tips) but **not
all**. Largest lift on the roadmap — heavily Marco-involved, phased, every schema slice escalates. No
sub-slice armed. Design source: `docs/architecture/drafts/tenant-readiness-analysis.md`.

**✅ DECISION LOCKED 2026-08-04 (Marco): model A — row-level `tenantId`.**
Schema-per-tenant (B) and DB-per-tenant (C) are **ruled out**: they physically separate each company's
data, so a shared worker/client/supplier would have to be **duplicated and kept in sync** across boxes.
Row-level is the only model that lets one shared record be visible to both companies at once.

## The mechanism (locked) — nullable `tenantId`, null = shared

- Every tenant-aware row carries a **nullable** `tenantId`:
  - **`tenantId = NULL` → group-wide / shared** (visible to every company).
  - **`tenantId = <company>` → company-owned** (visible only to that company).
- The scoping filter is: **`tenantId IS NULL OR tenantId = currentTenant`** (injected globally,
  fail-closed).
- **Master data can be shared; transactions stay company-owned.** A shared *client* is visible to both,
  but a *tender* for that client belongs only to the company bidding it — the sister company does not see
  your tender just because you both know the client. Shared "who", separate "what we did with them".

### Entity classification (Marco-confirmed 2026-08-04)

- **Group-wide (shared, `tenantId` null / not scoped):** suppliers & tips, rates & lists, permission
  roles, plus the **shared subset** of workers and clients.
- **Company-owned (`tenantId` required):** tenders, estimates, quotes, jobs, contracts, progress claims,
  allocations, and other transactional records.
- **Mixed (nullable — shared OR tagged):** workers, clients, contacts (some shared across the group, some
  exclusive to one company).

## Phased plan (each phase = several escalates slices)

- **MT-0 — Tenant model + additive nullable `tenantId` columns** (default NULL = the existing company as
  tenant #1 for master data; transactions get tenant #1 explicitly). Purely additive; nothing enforced
  yet; no behaviour change. Escalates.
- **MT-1 — Tenant-scoping middleware.** Global Prisma middleware (or repository guard) injecting
  `tenantId IS NULL OR = currentTenant` on every tenant-aware read/write; contract tests proving a
  company cannot see the other's company-owned rows AND that shared (null) rows are visible to both.
  Security core.
- **MT-2 — Identity carries tenant.** JWT + session carry the active `tenantId`; login resolves the
  user's company(ies); a Super User can switch companies. Reuses the existing auth seam (do NOT touch Entra).
- **MT-3 — Backfill + enforce.** Set `tenantId` on existing transactional rows (production-data migration
  — Marco-run, like the siteId backfill); leave shared master data NULL. Enforce NOT NULL only on the
  company-owned tables. After MT-1/MT-2 are proven.
- **MT-4 — Apply the classification.** Implement the group-wide / company-owned / mixed split above per
  table; the "mixed" tables (workers, clients, contacts) get the nullable-tenantId UI so a record can be
  marked shared or assigned to one company.
- **MT-5 — Company admin UI** (create/manage companies, assign users, per-company branding/settings on
  top of the existing company-profile).

## Risks

- **Data-leak = the whole point failing.** MT-1 middleware + cross-tenant tests (both directions:
  can't-see-theirs AND can-see-shared) are non-negotiable; ship nothing company-facing until green.
- Every existing query must go through the scoped path — a missed raw query is a leak. Audit needed.
- Sequence MT-0 **after** the in-flight migrations settle (rate-table, model-merge, siteId) to avoid
  migration collisions. Runs only with Marco present, one phase at a time.

## Start

Arm **MT-0** first (additive nullable columns). Model + mechanism are locked; no further decision needed
before MT-0.
