---
premise: '! grep -q "collectLegacyFilesRecursive" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts'
premise_means: The copy seam filters folders out before the service ever sees them (admin-imports.module.ts mapAdapterChildren does .filter(item => !item.isFolder)), and the copy never recurses. Nested files are therefore never enumerated and never migrated, and NOTHING in the run report signals the omission - the job reports success having copied only loose top-level files.
scope:
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.spec.ts
  - apps/api/src/modules/admin-imports/admin-imports.module.ts
done_when: pnpm build && pnpm lint && grep -q "collectLegacyFilesRecursive" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts && grep -q "MAX_COPY_DEPTH" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts && grep -q "ensureCopyFolderPath" apps/api/src/modules/admin-imports/admin-imports.module.ts && grep -q "size" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
size: 3
gate_allow: none
seed_only: false
escalates: true
requires_on_main: apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts :: site: tender.site
cluster: tender-folder-model
---

# TFM-S11: recurse into legacy subfolders, preserving the tree verbatim

**Grounded against `origin/main` = `ba1f74a2`, measured 2026-08-19.**
**Gated on TFM-S10** (`site: tender.site` on `origin/main`) - without S10 the guard
skips every pre-TFM-S2 tender and this slice has nothing to copy.

## STOP - escalates: true - READ THIS FIRST

This changes the behaviour of a migration job that writes into production SharePoint.
The resulting PR is labelled `do-not-merge`. **Automation must never remove that label.**
Marco removes it himself; removing it is what authorises the merge (D34). Drive the PR
to green and stop.

**Marco's standing rules, unchanged and binding:** COPY ONLY. NEVER MOVE. NEVER DELETE.
2026 tenders only. This slice adds reads and folder-creates. It must not introduce a
single delete, move, or rename call.

## The defect (MEASURED)

`copyMatchCandidate()` lists the immediate children of the matched legacy tender folder
and treats **every** child as a file:

```typescript
for (const legacy of legacyChildren) {
  const bytes = await this.sharepoint.downloadFileBytes({ fileId: legacy.fileId });
  await this.sharepoint.uploadFile({
    folderId: candidate.destinationFolderItemId, name: legacy.name, content: bytes });
}
```

There is no `.filter(c => !c.isFolder)` and no recursion. The two-level month walk in
this same file **does** filter (`monthFolders.filter(m => m.isFolder)` and
`children.filter(c => c.isFolder)`), so the omission reads as unintentional.

Real legacy tenders are `2. Quotes/Quotes {YYYY}/{N}. {Mon}/T{NNNN} - {Client} - {Project}/`
with working subfolders inside, so today's job migrates only loose top-level files.

## Decision taken (Marco, 2026-08-19) - PRESERVE, do not map

Nested files keep their legacy path verbatim under the tender folder:

```
FROM  {legacyRoot}/8. Aug/T2608 - Acme - Northbourne/Site photos/IMG_2231.jpg
TO    {tendersRoot}/T260817 - Northbourne Ave Upgrade/Site photos/IMG_2231.jpg
```

Do **not** map legacy folder names onto `TENDER_FOLDER_STRUCTURE` categories. Do not
call `resolveUploadPath` - it maps category strings, not folder names. A mapping pass
may follow as its own slice once the real folder names across 2026 are known.

## HAZARD - creating destination subfolders must not poison the tender lookup

`SharePointService.ensureFolder()` **upserts a `sharePointFolderLink` row and writes an
audit entry for every folder it ensures** (sharepoint.service.ts:129-162).

`plan()` finds each tender's destination with:

```typescript
findMany({ where: { linkedEntityType: "Tender" } })
// then: new Map(links.map(fl => [fl.linkedEntityId, fl]))
```

A `Map` built this way keeps the **last** row per key. So if preserved subfolders were
linked with `linkedEntityType: "Tender"` and `linkedEntityId: <tenderId>`, a subfolder
row could win the lookup and the tender's destination would resolve to one of its own
subfolders. That is a data-corrupting outcome, not a cosmetic one.

**Therefore, when ensuring a preserved subfolder:**

- set `module: "tendering-legacy-copy"`
- leave `linkedEntityType` and `linkedEntityId` **unset/null**

Both are optional on `EnsureSharePointFolderDto`. Unset means the row can never match
`where: { linkedEntityType: "Tender" }`. Add a test asserting exactly that.

## What to build

### 1. Seam extension - `ensureCopyFolderPath`

`ISharePointCopySeam` has `resolveItemIdByPath` (read-only, null when absent) but no
create. Add to the interface and bridge it in `admin-imports.module.ts` exactly as
TFM-S7 bridged `folderExists`:

```typescript
/**
 * TFM-S11 - Ensure a folder exists at `relativePath` and return its drive item ID.
 * Creates intermediate folders as needed. NEVER moves, renames or deletes.
 * Links are written with module "tendering-legacy-copy" and NO linkedEntityType,
 * so they can never win the `linkedEntityType: "Tender"` destination lookup.
 */
ensureCopyFolderPath(relativePath: string, name: string): Promise<string>;
```

The bridge delegates to the existing `SharePointService.ensureFolder(...)` and returns
`record.itemId`. Do not add a new adapter method - `ensureFolder` already exists on
both adapters.

### 2. `collectLegacyFilesRecursive`

Walk the legacy tender folder depth-first, returning a flat list of
`{ fileId, name, size, relativeSubPath }` where `relativeSubPath` is the path **below**
the tender folder (`""` for top-level files, `"Site photos"` for one level down).

- Recurse only into `isFolder === true` children; download only `isFolder === false`.
- **Do NOT use `listFolderChildren` to discover subfolders.** MEASURED against
  origin/main ba1f74a2: the copy seam's own `FolderChildItem` is
  `{ name, fileId, size, eTag? }` with **no `isFolder` field**, and the bridge
  `mapAdapterChildren()` in admin-imports.module.ts drops every folder via
  `.filter((item) => !item.isFolder)`. The copy service is structurally blind to
  folders today - that is WHY nothing is copied and WHY nothing is reported.
- **Use `listFolderItemsById(siteId, driveId, itemId)` instead.** It already returns
  files AND folders as `LegacyFolderItem { id, name, isFolder }`, and it is exactly
  what the TFM-S6 month-walk uses - so this reuses a proven path rather than
  loosening the existing one.
- `LegacyFolderItem` carries **no `size`**, and the idempotency key needs it. Add
  `size?: number` to `LegacyFolderItem` and pass `size: item.size` through
  `mapAdapterItemsToLegacyFolderItems()`. ADDITIVE ONLY - do NOT change
  `mapAdapterChildren()` or the copy seam's `FolderChildItem`: the existing
  top-level copy relies on folders being filtered out of that path, and widening
  it would change behaviour this slice is not scoped to touch.
- `const MAX_COPY_DEPTH = 10;` - stop descending past it and
  `this.logger.warn(...)` naming the folder that hit the cap. A silent truncation
  would read as "copied everything" when it did not.

### 3. Idempotency must survive nesting

Today's key is `` `${name}::${size}` `` against a single destination listing. That
collides across subfolders: two different `Photo.jpg` files in two subfolders would
make the second look already-present and be skipped.

Key on the sub-path as well - `` `${relativeSubPath}::${name}::${size}` `` - and list
the destination **per distinct sub-path**, not once for the tender root. Re-running the
copy must still be a no-op.

### 4. Report the new shape

`wouldCopy` entries in `plan()` must carry the nested `sourcePath`/`destinationPath` so
the captured plan Marco reviews shows what will actually be copied. Add
`skippedDepthCapped` to `LegacyCopyExecutionReport` alongside `skippedUnreadyCount`.

## Do NOT

- No move, rename or delete calls - of any kind, anywhere in this slice.
- Do not touch `sot/`.
- Do not remove or re-apply the `do-not-merge` label.
- Do not widen the year filter. 2026 only.

## Tests

- Two-level legacy tree --' nested file lands at the mirrored destination sub-path.
- Subfolders are recursed, never passed to `downloadFileBytes`.
- Same filename+size in two different subfolders --' **both** copied, neither skipped.
- Re-running over an already-copied tree copies nothing (idempotent, nested).
- Depth beyond `MAX_COPY_DEPTH` --' stops, warns, increments `skippedDepthCapped`.
- `ensureCopyFolderPath` writes links with no `linkedEntityType`, and a follow-up
  `findMany({ where: { linkedEntityType: "Tender" } })` still returns exactly one row
  per tender.

## Verification

- `pnpm build && pnpm lint`
- `pnpm --filter @po/api test -- sharepoint-legacy-copy`
