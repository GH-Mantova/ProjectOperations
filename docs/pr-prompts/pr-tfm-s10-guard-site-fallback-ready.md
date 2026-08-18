---
premise: '! grep -q "site: tender.site" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts'
premise_means: The legacy-copy destination guard derives its probe path from projectName only. Because Tender.project_name was added additive-nullable with no backfill (TFM-S2), every pre-existing tender has project_name = NULL, so the guard probes a bare T-number path, finds nothing, and silently excludes those tenders from the 2026 copy.
scope:
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "site: tender.site" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts && grep -c "site: { select: { name: true } }" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts | grep -q "^2$"
size: 2
gate_allow: none
seed_only: false
escalates: false
cluster: tender-folder-model
---

# TFM-S10: the guard must derive the same folder name provisioning did

**Grounded against `origin/main` = `ba1f74a2`, measured 2026-08-19.**

## The defect (MEASURED, not inferred)

Two call sites derive the tender folder name, and they disagree.

**Provisioning** â€” `apps/api/src/modules/platform/sharepoint.service.ts:200`

```typescript
const folderName = deriveTenderFolderName(tender);
```

`tender` here comes from a Prisma call using `tenderInclude`, which contains
`site: { select: { id: true, name: true, ... } }`. So `deriveTenderFolderName`
resolves the name part as `projectName ?? site.name`.

**The copy guard** â€” `apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts:638`

```typescript
const folderName = deriveTenderFolderName({
  tenderNumber: tender.tenderNumber,
  projectName: tender.projectName,
});
```

This builds a **fresh object literal with no `site` key**, and neither of the two
Prisma `select` blocks that feed it (one in `plan()`, one in the `execute()`
re-check) fetches `site` either. So the guard resolves the name part as
`projectName ?? ""`.

## Why this is not an edge case

`apps/api/prisma/migrations/20260819120000_tender_project_name/migration.sql` reads,
in full:

```sql
-- TFM-S2: additive nullable column for human-readable project name.
-- No default value, no row mutation, no non-null constraint.
-- Existing rows remain NULL; the wizard populates it for new tenders.
ALTER TABLE "tenders" ADD COLUMN "project_name" TEXT;
```

Every tender that existed before TFM-S2 merged has `project_name = NULL`. For each
of those the guard probes `{tendersRoot}/T2608xx` while the real folder is
`{tendersRoot}/T2608xx - {Site Name}`. `folderExists` returns false, the entry gets
`destinationReady: false` with reason `"destination folder missing"`, and the tender
is skipped â€” in `plan()` and again in the `execute()` re-check.

The failure is fail-safe in direction (it skips rather than misfiles) but it means
the 2026 copy can cover far fewer tenders than the captured plan implies, and the
plan document gives no hint that the cause is a naming mismatch rather than a
genuinely absent folder.

## What to build

1. Add `site: { select: { name: true } }` to **both** Prisma `select` blocks in this
   file â€” the one in `plan()` that loads all tenders, and the one in `execute()` that
   re-loads a single tender before re-checking readiness. (`done_when` asserts exactly
   two occurrences.)

2. Widen the `assertDestinationExists` parameter type to carry it:

```typescript
tender: {
  id: string;
  tenderNumber: string;
  folderProvisioningStatus: string | null;
  projectName: string | null;
  site?: { name?: string | null } | null;
},
```

3. Pass it through, so the guard derives exactly what provisioning derived:

```typescript
const folderName = deriveTenderFolderName({
  tenderNumber: tender.tenderNumber,
  projectName: tender.projectName,
  site: tender.site,
});
```

The literal `site: tender.site` is what kills the premise â€” keep that spelling.

## Do NOT

- Do **not** change `deriveTenderFolderName` itself. It is correct and is shared with
  provisioning; changing it would move the divergence rather than close it.
- Do **not** pass `existingNames` to `deriveTenderFolderName`. No production call site
  does, so the `(2)` de-duplication branch never fires today. Introducing it here would
  reintroduce the very mismatch this slice removes.
- Do **not** touch `sot/`.

## Tests

Add to `sharepoint-legacy-copy.service.spec.ts`:

- `project_name = NULL` and `site.name = "Acme Site"` â†’ the guard probes
  `{tendersRoot}/T260817 - Acme Site`, **not** `{tendersRoot}/T260817`. Assert on the
  argument `folderExists` was called with; that is the whole point of the slice.
- `project_name` populated â†’ `site.name` is ignored (projectName still wins).
- Both null/empty â†’ falls back to the bare T-prefix, unchanged from today.

## Verification

- `pnpm build && pnpm lint`
- `pnpm --filter @po/api test -- sharepoint-legacy-copy`
