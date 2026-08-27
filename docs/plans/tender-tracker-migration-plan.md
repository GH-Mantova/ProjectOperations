# Legacy Estimating Tracker → ERP Migration — Plan

**Status:** SLICE-0 emitted 2026-08-12. MIG-1, MIG-2, MIG-3 slice prompts authored (ready).

## Program context

Marco's estimating team has run tenders out of a spreadsheet ("the tracker") for years:
**~540 rows**, each a bid with columns for Project Name (embedding a legacy T-number), Client
Company Name, Estimator, Tender Price, Quote Due Date, Date Submitted, Lead time, a mislabelled
"Probability" column that is actually the pipeline **stage/outcome** (`Won` / `Lost` /
`Not quoting` / `Submitted` / `Quoting` / `Chasing` / `Hot` / `Warm` / `Cold`), a `Decision`
column, and free-text **Follow Up Notes**. Every row also has a matching **legacy SharePoint
folder** (named by the T-number) that holds the actual bid documents.

The ERP already models tenders, clients, sites, notes, and SharePoint folder linkage
(see `apps/api/prisma/schema.prisma` — `Tender`, `Client`, `Site`, `TenderClientNote`,
`SharePointFolderLink`, and the Graph seam used by tender-create). **This program migrates the
tracker into those existing models — it does NOT build a new tender/client system.**

### What this program IS

- A super-user import that turns the 540-row tracker into ERP `Tender` rows (with matching
  `Client` rows and stub `Site` rows), plus `TenderClientNote` rows for follow-up comms.
- A companion job that copies legacy SharePoint folder contents into the ERP-created folders by
  matching on the T-number, via the existing Graph integration.

### What this program is NOT

- **NOT a new tender/client/site model.** Reuse `Tender`, `Client`, `Site`, `TenderClientNote`.
- **NOT a Xero-sourced client import.** Marco has locked "clients = tracker clients only" —
  Xero is not the source of truth for this program (decision TFM-D1 below).
- **NOT a bulk address enrichment.** Every tender needs a Site, but the tracker has no address
  data — sites are created as **name-only stubs** (TFM-D4). Users complete the address when they
  open the tender.
- **NOT CRM Account creation.** CRM-1 must independently auto-create an Account per Client so
  clients imported here are wrapped by the CRM. That is called out under "Cross-dependencies"
  below and is NOT part of this program's slices.
- **NOT an Azure/Entra/SharePoint config change.** MIG-3 uses the EXISTING Graph integration in
  Marco's environment. The slice authors the copy job; it does not touch Azure config.

---

## Guardrails (all slices, non-negotiable)

1. **Never commit real tracker data to the repo.** The repository is public. Client names,
   values, and comms notes are UPLOADED to the import endpoint at runtime — the slices build
   TOOLING (endpoints, services, tests with fixture data), not data. Any spec fixtures use
   synthetic rows, not the real workbook.
2. **Never invent Users.** Estimator matching is by name against existing `User` rows. Unmatched
   → leave `estimatorUserId` null and flag the row in the dry-run report. Do not create users.
3. **Never touch Azure/Entra/SharePoint config.** MIG-3 uses the existing Graph seam only.
4. **Idempotency is required on commit.** Re-running the import must not create duplicate
   Tender/Client/Site rows. The T-number embedded in the tender title is the idempotency key.
5. **Dry-run before commit.** The endpoint MUST support a `dryRun` mode that validates, produces
   a report (client counts, tender counts, unmatched estimators, bad rows), and writes NOTHING.
6. **Reuse existing models.** Do NOT add fields to `Tender`, `Client`, `Site`, or
   `TenderClientNote` unless a slice explicitly requires it. MIG-1's ONLY schema change is the
   removal of `Site @@unique([name])`.

---

## Marco's locked decisions (2026-08-12) — bake in, do NOT re-litigate

| # | Decision |
|---|---|
| TFM-D1 | **Client set = the tracker's clients ONLY.** One `Client` per distinct "Client Company Name" (dedupe on normalised — lowercased, whitespace-collapsed — name). Users merge/edit variants later. Xero is NOT the client source for this program. |
| TFM-D2 | **All 540 rows import as Tenders.** Map the tracker's word-"Probability" (mislabelled — it is the pipeline stage/outcome), reinforced by `Decision`: `Won` → status `WON` + set `wonAt`; `Lost` → `LOST` + set `lostAt`; `Not quoting` → `WITHDRAWN`; `Submitted` → `SUBMITTED`; `Quoting`, `Chasing`, `Hot`, `Warm`, `Cold` → `DRAFT` (open). Where `Decision` disagrees with the word-"Probability", `Decision` wins (a `Won`/`Lost` decision is the terminal fact). |
| TFM-D3 | **Legacy T-number lives in the Project Name / `title`.** Format: `title = "T#### — <Project Name>"`. This makes the legacy number searchable in the ERP and is the **idempotency key** for re-runs (match by the `T####` substring in title). No separate legacy field. |
| TFM-D4 | **Every tender needs a Site but the tracker has NO address.** Create a name-only stub Site per tender: `name = title`, all address fields NULL, `clientId` set to the linked client, `notes = "IMPORTED — address to be completed"`. Users complete the address when they open the tender. Because sites are NOT unique by name (multiple projects share the same site name over years), **MIG-1 first drops `Site @@unique([name])`** before MIG-2 can safely create stubs. |
| TFM-D5 | **Follow Up Notes → `TenderClientNote`** (`noteType = "note"`, linked to `tenderId` AND `clientId` — so CRM reads it per client too). One row per non-empty note; multiple notes on one tender are split on line boundaries or kept as a single note if the tracker cell is a single blob (author decides in MIG-2 based on the real data shape at commit time). |
| TFM-D6 | **Estimator matching by name against existing `User` rows.** Known names in the tracker: `Sean Lattin`, `Raj Pudasaini`, `Marco Mantovanini` (the tracker misspells this as `Mantovaninni` — match by best-effort normalised name), `Russel Cummings`. Unmatched → leave `estimatorUserId` NULL and flag in the dry-run report. **Never create Users.** |
| TFM-D7 | **Field mapping:** `Tender Price` → `estimatedValue` (Decimal); `Lead time` → `leadTimeDays` (Int); `Quote Due Date` → `dueDate` (DateTime); `Date Submitted` → `submittedAt` (DateTime). Missing / unparseable → NULL and flag in the dry-run report. |
| TFM-D8 | **SharePoint legacy folder copy** (MIG-3): match legacy folder by the `T####` number to the ERP-created folder for the same tender, copy contents via the EXISTING Graph seam. `escalates: true` (Azure environment). The slice AUTHORS the job; it does not touch Azure/Entra/SharePoint config. |
| TFM-D9 | **Data privacy:** the real tracker workbook is UPLOADED to the endpoint at runtime — NEVER committed to the repo (public). Slice fixtures use synthetic rows only. |

---

## Reuse map (grounded against origin/main, 2026-08-12)

| Artifact | Path | What to reuse |
|---|---|---|
| Tender model | `apps/api/prisma/schema.prisma` — `model Tender` | `tenderNumber` (unique), `title`, `status` (String default `DRAFT`), `estimatorUserId`, `siteId` (required), `dueDate`, `submittedAt`, `leadTimeDays`, `estimatedValue`, `wonAt`, `lostAt`, `tenderClients`, `clientNotes` |
| Client model | `apps/api/prisma/schema.prisma` — `model Client` | Master client rows (`name` unique). Dedupe imported clients on normalised name. |
| Site model | `apps/api/prisma/schema.prisma` — `model Site` | Stub site per tender (name-only). **MIG-1 removes `@@unique([name])` first.** |
| TenderClientNote | `apps/api/prisma/schema.prisma` — `model TenderClientNote` | `tenderId` + `clientId` + `noteType` + `subject`/`body` + `occurredAt` + `createdBy` for follow-up notes. |
| Admin controller convention | `apps/api/src/modules/admin-settings/`, `apps/api/src/modules/admin-users/` | Follow the `admin-*` module layout for the import endpoint. |
| SharePoint Graph seam | Existing tender-create integration (see `SharePointFolderLink` usage across `Tender` / `Job` / `Project`) | MIG-3 copies legacy folder contents through this seam. Do not create a parallel Graph client. |

---

## Ordered slices

Each slice is ≤ ~10 files. Each has its own `pr-mig-s<N>-<slug>-ready.md` prompt and is chained
to the previous one via `requires_file_on_main`. All three `escalates: true`.

### MIG-1 (S1) — Drop `Site @@unique([name])`

**Slug:** `drop-site-name-unique`
**Gate:** `gate_allow: migrations`
**Escalates:** true (schema migration)
**Rollback:** additive/reversible — restoring the unique index is a one-line migration reverse.

**What it builds:**

- Prisma schema change: remove the `@@unique([name])` line from `model Site`
  (`apps/api/prisma/schema.prisma`).
- Prisma migration under `apps/api/prisma/migrations/<ts>_drop_site_name_unique/migration.sql`
  dropping the unique index (`DROP INDEX ...`).
- Regenerate the data-model map: run `node scripts/data-model/build-relationship-map.mjs` and
  commit the updated `docs/data-model/relationship-map.json`, `relationship-map.md`, and
  `metadata-catalog.json`.
- **Landed marker:** `docs/data-model/tender-migration/MIG-1-DONE.md` — a one-page note
  recording that MIG-1 shipped, the migration name, and the rationale (linking to TFM-D4). This
  file is the anchor that MIG-2 chains on via `requires_file_on_main`.
- **Backfill:** none — the change removes a constraint, no data transformation.
  `backfill: false`.

**Why now:** the ERP has one project per Site to date, so the unique constraint has held.
Once the tracker imports 540 tenders as stub sites (TFM-D4), the constraint will conflict with
real-world duplicate project names and multiple stub sites sharing a client. Sites are NOT
unique in reality (Marco: "the auto ID is the key; you revisit addresses over years").

### MIG-2 (S2) — Tender-tracker import endpoint + service

**Slug:** `tender-import`
**Gate:** `gate_allow: none`
**Escalates:** true (writes production tender/client/site rows on commit)
**Depends on:** `requires_file_on_main: docs/data-model/tender-migration/MIG-1-DONE.md`

**What it builds:**

- A super-user admin endpoint following the `admin-settings` / `admin-users` module convention:
  `POST /admin/imports/tender-tracker`. Accepts an uploaded `.xlsx` or `.csv`; two modes:
  `dryRun=true` (validate + report only, writes NOTHING) and `dryRun=false` (commit).
- New module `apps/api/src/modules/admin-imports/` (or equivalent following the admin-controller
  convention) with:
  - `tender-tracker-import.service.ts` — the parser + mapper + committer.
  - `tender-tracker-import.controller.ts` — the endpoint, guarded by super-user permission
    (reuse the existing super-user guard; do not invent one).
  - `tender-tracker-import.module.ts` — wires it into `app.module.ts`.
  - `tender-tracker-import.service.spec.ts` — unit tests over synthetic fixtures.
- On `dryRun`: parse the workbook, compute:
  - Unique clients to be created (per TFM-D1 — normalised-name dedupe).
  - Tender rows to be created (per TFM-D2/TFM-D3/TFM-D7).
  - Unmatched estimator names (per TFM-D6).
  - Row-level parse errors (bad dates, unparseable Decimal, missing Project Name / Client).
  Return a structured report; write NOTHING.
- On commit: idempotently, in a transaction per row (or per bounded batch):
  1. Upsert `Client` by normalised name (TFM-D1).
  2. Create name-only stub `Site` (TFM-D4) — enabled by MIG-1.
  3. Upsert `Tender` keyed on the `T####` substring in `title` (TFM-D3):
     - `title = "T#### — <Project Name>"`.
     - `status` + `wonAt` / `lostAt` per TFM-D2.
     - `estimatorUserId` per TFM-D6 (NULL if unmatched).
     - `siteId` → stub site.
     - `estimatedValue`, `leadTimeDays`, `dueDate`, `submittedAt` per TFM-D7.
     - `tenderClients` link to the upserted client.
  4. For each non-empty Follow Up Note → `TenderClientNote` (`noteType = "note"`, linked to
     tender + client) per TFM-D5. On re-run, skip if a note with the same (`tenderId`, `clientId`,
     `body`, `occurredAt`) already exists.
- Return an execution report: created / skipped / errored counts.

**Guardrails specific to MIG-2:**

- Fixtures under `apps/api/src/modules/admin-imports/**/__fixtures__/` MUST be synthetic. Do
  NOT commit any row from the real tracker workbook (TFM-D9).
- No new fields on `Tender` / `Client` / `Site` / `TenderClientNote`. Reuse only.
- No `schema.prisma` change (MIG-1 already did the one change needed).
- Never invent a User row for an unmatched estimator (TFM-D6).

### MIG-3 (S3) — SharePoint legacy-folder copy job

**Slug:** `sharepoint-legacy-copy`
**Gate:** `gate_allow: none`
**Escalates:** true (Azure environment — copies files through the existing Graph seam)
**Depends on:** `requires_file_on_main:` MIG-2's import service file (name TBD by MIG-2 body;
prompt pins the specific expected path).

**What it builds:**

- A job / service that, for each imported tender, matches the legacy SharePoint folder by the
  `T####` in the tender title and copies its contents into the ERP-created folder
  (the one Tender-create already provisions via the Graph seam).
- Wired through the EXISTING Graph integration only. Does NOT create a new Graph client, does
  NOT read/write Azure/Entra/SharePoint config.
- Super-user-triggered (endpoint or CLI wired into the same `admin-imports` module) with a
  dry-run mode: list matches, list unmatched legacy folders, list tenders with no matching
  legacy folder. Commit mode performs the copy.
- Unit tests over a mocked Graph seam confirming the T-number matching logic and the "skip
  if already copied" idempotency check.

**Guardrails specific to MIG-3:**

- Do NOT touch Azure/Entra/SharePoint config. If the seam is missing a needed capability, the
  prompt says `NO-OP: <reason>` and stops — a config change is escalated to Marco separately.
- Idempotent: re-running must not re-copy files already present in the destination folder.
- No production-data test fixtures. Mock the Graph seam in unit tests.

---

## Sequencing

```
main ──► MIG-1 (drop Site @@unique[name]) ──► MIG-2 (import endpoint) ──► MIG-3 (SP copy job)
              │                                     │                            │
              └── landed marker gates ──────────────┘                            │
                                                    └── service-file gates ──────┘
```

Chain via `requires_file_on_main` on a NEW file each predecessor creates. Do NOT use
`requires_merged` (per PROMPT-SCHEMA).

---

## Cross-dependency (call-out, not part of this program)

**CRM-1 must auto-create an `Account` per `Client` on Client-create** — not just a one-time
backfill — so that clients created by MIG-2 are automatically wrapped by the CRM. This is a
CRM program concern (see `docs/plans/crm-module-plan.md`) and is NOT scoped here. If the
CRM-Account auto-create hook is not in place when MIG-2 runs, the imported clients will need
a follow-up backfill in the CRM program.

---

## Files authored in this SLICE-0

- `docs/plans/tender-tracker-migration-plan.md` (this file)
- `docs/pr-prompts/pr-mig-s1-drop-site-name-unique-ready.md`
- `docs/pr-prompts/pr-mig-s2-tender-import-ready.md`
- `docs/pr-prompts/pr-mig-s3-sharepoint-legacy-copy-ready.md`
