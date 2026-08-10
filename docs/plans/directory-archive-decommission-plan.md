# SLICE-0 plan — Directory & Contracts: Archive + super-admin Decommission

**Status:** PLAN. Design LOCKED by Marco 2026-08-10 (see chat + memory
`project_directory_contracts_archive_decision`). Everyday = Archive (all manage users). Super-admin
"delete" = **Decommission only** (export + freeze + keep searchable) — **there is NO true hard row-delete,
ever.**

## Model (locked)

**Everyday — Archive/Unarchive** (all users with manage rights) for Client, Subcontractor/Supplier, and
Contract records. Archived items leave the DEFAULT lists but stay reachable via the status filter. A
bulk-archive affordance makes clearing the seed data quick. (Clients already carry an
Active/Inactive/Archived `status`; this promotes archive to a first-class action + fixes default filtering.)

**Super-admin only — Decommission a client** (this is what "delete" means; no row deletion):
1. If the client has linked records (tenders/jobs/documents/etc.), show an **alert** listing what's attached.
2. On confirm: **export** to the client's **SharePoint folder** BOTH the documents AND a structured
   full-record export (PDF/CSV/JSON) of the ERP data; then **freeze** the client + all linked records
   (read-only, out of active views, **still searchable** in the ERP).
- Gated to super admins (super-user role) at API + UI; type-the-name confirmation.

**Prerequisite:** auto-create a client SharePoint folder when a client is created (reuse the existing
`ensureTenderFolderStructure` Graph machinery), so the decommission export has a destination.

## Hard stop
SharePoint tenant config/permissions/scopes = Marco-only. App RUNTIME folder creation + export via the
existing authenticated Graph integration is buildable; anything needing a NEW scope/permission is a
code+runbook hand-off to Marco.

## Slices (each ≤10 files, chained)

- **AR-1 — Directory archive UX** (`feat/directory-archive-action`). One-click Archive/Unarchive on
  Client + Subcontractor/Supplier cards/rows; exclude archived from the DEFAULT list (still shown when the
  status filter selects Archived/All); bulk-archive selected records. Reuses the existing `status` field.
  Web-focused; minor API only if a default-status filter is needed server-side. Gated on directory PR #969
  (requires_file_on_main `apps/web/src/pages/directory/directory-tab-helpers.ts`) to avoid file collisions.
- **AR-2 — Contracts archive** (`feat/contracts-archive`). Add an archive status/flag + API + one-click
  action for Contract records; exclude archived from default contract lists. (Schema/migration if Contract
  lacks an archive field — additive, escalates.)
- **DC-1 — Auto-create client SharePoint folder on client create** (`feat/client-folder-on-create`). API;
  reuse `ensureTenderFolderStructure` pattern. Escalates (SharePoint runtime).
- **DC-2 — Frozen state** (`feat/client-frozen-state`). Additive `frozen`/decommissioned flag on Client +
  cascade marker to linked records; write-guards make frozen records read-only; keep them in search but out
  of default/active lists. Schema/migration, escalates.
- **DC-3 — Client data export job** (`feat/client-decommission-export`). Export documents + structured
  PDF/CSV/JSON of all the client's ERP data into the client's SharePoint folder. API; escalates.
- **DC-4 — Super-admin Decommission action** (`feat/client-decommission-action`). Wire the flow:
  super-admin-only trigger → linked-data alert → type-name confirm → run DC-3 export → apply DC-2 freeze.
  Web + API; escalates; depends on DC-1/DC-2/DC-3.

## Start
Ship **AR-1** first (immediate value: lets Marco archive the seed data), gated on #969. AR-2 next. The
DC-* decommission chain follows once the archive basics are in and Marco confirms the SharePoint runbook
steps for folder scope.
