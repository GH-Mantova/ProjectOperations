---
premise: '! grep -q "projectName" apps/api/prisma/schema.prisma'
premise_means: There is no Tender.projectName field, folder naming still uses the client-slug + Rev pattern, and a revision bump renames tenderNumber in place while the SharePoint folder path is derived from the new number — orphaning every previously-filed document.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260819120000_tender_project_name/migration.sql
  - docs/data-model/relationship-map.json
  - docs/data-model/relationship-map.md
  - docs/data-model/metadata-catalog.json
  - apps/api/src/modules/tendering/tender-number.service.ts
  - apps/api/src/modules/platform/sharepoint.service.ts
  - apps/web/src/pages/tendering/NewTenderWizard.tsx
  - apps/web/src/pages/tendering/newTenderWizard.helpers.ts
  - apps/api/src/modules/tendering/__tests__/tender-number.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "projectName" apps/api/prisma/schema.prisma && grep -q "projectName" apps/api/src/modules/tendering/tender-number.service.ts && node scripts/data-model/build-relationship-map.mjs --check
size: 10
gate_allow: migrations
seed_only: false
escalates: false
backfill: false
rollback_strategy: Additive nullable column only (ADD COLUMN project_name TEXT NULL) — no row mutation, no default backfill. Safe to leave on main if the run is capped before code lands. To revert, remove Tender.projectName from schema.prisma and drop the migration; no compensating row updates required.
cluster: tender-folder-model
---

# TFM-S2: Folder naming + `Tender.projectName`

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (read sections 4, 5, and 6 TFM-S2
before starting). Runs in parallel with TFM-S1; no predecessor gate.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `Tender` has no `projectName` and no `project_name` field on main today.
- `tender-number.service.ts` mints `T{YYMMDD}-{SLUG}-Rev{N}` where SLUG is the client's
  short slug (max 4 characters).
- **`tender-number.service.ts:63` overwrites `tenderNumber` on the same row when a revision
  is marked** (`tendering.controller.ts:468` confirms "the row id is unchanged"). Because
  `sharepoint.service.ts` derives the folder path from `tenderNumber`, the post-revision
  path no longer matches the pre-revision folder — every document filed before the revision
  is orphaned into a stub the system silently re-creates.
- `NewTenderWizard.tsx` is the creation surface; `newTenderWizard.helpers.ts` holds the
  derivation helpers.
- `Site.name` is the natural default for the human-readable project name.

## What to build

### 1. Additive nullable column on `Tender`

In `apps/api/prisma/schema.prisma`, add:

```prisma
model Tender {
  // ... existing fields
  projectName  String?  @map("project_name")
}
```

Generate the migration:

```
npx prisma migrate dev --name tender_project_name --create-only
```

The generated SQL must be `ALTER TABLE "tenders" ADD COLUMN "project_name" TEXT` — no
default value, no row mutation, nullable. Confirm before committing.

### 2. Regenerate the data-model map

```
node scripts/data-model/build-relationship-map.mjs
```

Commit `docs/data-model/relationship-map.json`, `relationship-map.md`, and
`metadata-catalog.json`. The CI data-model drift check hard-fails a schema change with a
stale map.

### 3. Derive the folder name from `projectName`

In `apps/api/src/modules/tendering/tender-number.service.ts` (or a new sibling helper
imported here — keep the size budget in mind):

- Add `deriveTenderFolderName(tender: { number: string; projectName?: string | null; site?: { name?: string | null } | null }): string`.
- Returns `T{YYMMDD} - {sanitised project name}` where the date portion is parsed from
  `tender.number` and the project name is `tender.projectName ?? tender.site?.name ?? ""`.
- Sanitise for SharePoint: strip characters Graph rejects (`~ " # % & * : < > ? / \ { | }`),
  collapse runs of whitespace to a single space, trim, cap the resulting name at 90
  characters, and if the final string is empty fall back to the T-number itself.
- If two tenders on the same day resolve to the same sanitised name, append ` (2)`,
  ` (3)`, ... until unique — the caller passes the list of existing folder names.

### 4. Pin the folder path on the row

Add a nullable `folderName` column to `Tender` too? **No — do not.** Instead, always call
`deriveTenderFolderName` and let sanitisation of the projectName (which does NOT change on
revision) give the stable path. The revision bump touches `tenderNumber` but leaves
`projectName` and `site.name` untouched, so the derived folder name stays constant. This is
the fix for the stranding defect.

### 5. Update `sharepoint.service.ts`

Wherever `ensureTenderFolderStructure` and `ensureTenderCategoryFolder` currently build a
path from `tender.tenderNumber`, switch them to `deriveTenderFolderName(tender)`. Include
the `site` and `projectName` in the tender query that feeds these methods (add a `select` if
needed). Do not change the categories or the flat-vs-nested behaviour — that is TFM-S4.

### 6. Update `NewTenderWizard.tsx` and `newTenderWizard.helpers.ts`

- Add a "Project name" input to the wizard, prefilled from the selected `Site.name`.
- The estimator may override the prefill before saving.
- On submit, pass `projectName` through to the create endpoint.
- Add a small preview line under the input: `Folder will be named: T260817 - Northshore`
  (compute via the same sanitiser so the estimator sees what they will get).

### 7. Unit tests — `tender-number.service.spec.ts`

Extend the existing spec with:

- `deriveTenderFolderName` strips the Graph-rejected characters listed above.
- `deriveTenderFolderName` collapses double spaces and trims.
- `deriveTenderFolderName` falls back to `site.name` when `projectName` is null, and to the
  T-number when both are empty.
- `deriveTenderFolderName` returns the same value before and after a revision bump when
  `projectName` is unchanged (the stranding-fix invariant).
- Same-day collisions resolve to `... (2)`, `... (3)`.

## Do NOT

- Do NOT add a non-null constraint or default value on the new column — the column stays
  nullable. Existing rows keep the null value and fall back to `site.name`.
- Do NOT rewrite existing tender rows to populate `projectName`. Row updates are out of scope.
- Do NOT touch the category list or nested paths — those are TFM-S3 and TFM-S4.
- Do NOT change `SharePointFolderMapping` or the configured root.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT touch `/sot/`. CP-24 hard-fails a PR mixing code and `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.** "Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. There is no human in
> a headless run.

## Guardrails

- One attempt. If `Tender.projectName` already exists on main, say
  `NO-OP: field already shipped` and stop.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated map
  in the same PR — the CI data-model drift check hard-fails otherwise.
- If the migration + wizard change together exceed the size budget of 10 files, split into
  two chained slices (S2a schema+backend, S2b wizard UI) rather than exceed the size cap.

GATE-ALLOW: migrations
