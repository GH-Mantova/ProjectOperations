---
premise: '! grep -q "listFolderChildren" apps/api/src/modules/platform/sharepoint.adapter.ts'
premise_means: MIG-3.5 seam is missing — the SharePointAdapter interface has no listFolderChildren method, so admin-imports.module.ts throws SeamExtensionRequiredError and MIG-3's legacy copy service cannot enumerate a legacy folder.
scope:
  - apps/api/src/modules/platform/sharepoint.adapter.ts
  - apps/api/src/modules/platform/graph-sharepoint.adapter.ts
  - apps/api/src/modules/platform/sharepoint.service.ts
  - apps/api/src/modules/platform/sharepoint.adapter.spec.ts
  - apps/api/src/modules/platform/graph-sharepoint.adapter.spec.ts
  - apps/api/src/modules/platform/__tests__/sharepoint-graph-paging.spec.ts
  - apps/api/src/modules/admin-imports/admin-imports.module.ts
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
done_when: pnpm build && pnpm lint && grep -q "listFolderChildren" apps/api/src/modules/platform/sharepoint.adapter.ts && grep -q "listFolderChildren" apps/api/src/modules/platform/graph-sharepoint.adapter.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
cluster: tender-folder-model
---

# TFM-S1: `listFolderChildren` seam (MIG-3.5)

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (read section 6 TFM-S1 before
starting). This is the first slice of the tender folder model cluster and has no predecessor.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `SharePointAdapter` interface lives at
  `apps/api/src/modules/platform/sharepoint.adapter.ts` and is implemented by
  `MockSharePointAdapter` (same file) and `GraphSharePointAdapter`
  (`graph-sharepoint.adapter.ts`).
- `admin-imports.module.ts:45` currently throws `SeamExtensionRequiredError` because MIG-3's
  legacy copy service depends on a `listFolderChildren` method that does not exist. This
  slice adds the method and removes the throw.
- MIG-3's `sharepoint-legacy-copy.service.ts` already has the T-number matcher and
  idempotency; the only reason it cannot run is the missing enumeration seam.
- Graph list-children returns 200 children per page by default and paginates via
  `@odata.nextLink`. A tender folder can hold hundreds of files — paging MUST be handled
  transparently by the adapter, not by callers.

## What to build

### 1. `apps/api/src/modules/platform/sharepoint.adapter.ts`

Extend the `SharePointAdapter` interface with:

```typescript
listFolderChildren(
  siteId: string,
  driveId: string,
  itemId: string,
): Promise<Array<{ id: string; name: string; isFolder: boolean; size?: number; webUrl?: string }>>;
```

Add a working implementation to `MockSharePointAdapter` in the same file — return the
contents of an in-memory map keyed by `itemId`, so tests can seed folders with children.

### 2. `apps/api/src/modules/platform/graph-sharepoint.adapter.ts`

Implement `listFolderChildren` against Microsoft Graph:

- Endpoint: `GET /sites/{siteId}/drives/{driveId}/items/{itemId}/children?$top=200`.
- Follow `@odata.nextLink` until absent; concatenate all pages.
- Map each Graph child to the interface shape (`isFolder` is `!!child.folder`).
- Log a single warn on transient failures and rethrow — the caller decides retry policy.

### 3. `apps/api/src/modules/platform/sharepoint.service.ts`

Expose a pass-through `listFolderChildren(siteId, driveId, itemId)` method that delegates to
the injected adapter. This is the surface MIG-3's copy service calls.

### 4. `apps/api/src/modules/admin-imports/admin-imports.module.ts`

Remove the `SeamExtensionRequiredError` throw at line 45. Wire the module so
`SharePointLegacyCopyService` receives `SharePointService` directly. Keep every other
provider registration untouched.

### 5. `apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts`

Replace whatever placeholder was catching the missing seam with a real call to
`sharepointService.listFolderChildren(...)`. No behavioural change beyond that — this slice
does not fix the wrongly-shared legacy root assumption (that is TFM-S6).

### 6. Unit tests

- `sharepoint.adapter.spec.ts` — mock adapter returns seeded children, empty for missing
  `itemId`.
- `graph-sharepoint.adapter.spec.ts` — mock Graph fetch, assert URL shape, assert children
  map correctly.
- `apps/api/src/modules/platform/__tests__/sharepoint-graph-paging.spec.ts` (new) — a folder
  with 250 children returned as two pages (200 + 50) must enumerate all 250. Assert the
  count and that no page was skipped or duplicated.

## Do NOT

- Do NOT change `SharePointFolderMapping` or the configured tenders root — TFM leaves the
  mapping alone.
- Do NOT touch the folder naming logic — that is TFM-S2.
- Do NOT extend the copy service beyond wiring `listFolderChildren` — S6/S7 rework it.
- Do NOT touch `/sot/`. CP-24 hard-fails a PR mixing code and `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.** "Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. It does not mean
> "wait for approval before starting", and it does not mean "do the work then ask permission
> to push". There is no human in a headless run.

## Guardrails

- One attempt. If `listFolderChildren` already exists on
  `apps/api/src/modules/platform/sharepoint.adapter.ts` on main, say
  `NO-OP: seam already shipped` and stop.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Paging test is mandatory — a folder with 250 or more children is a real case and the whole
  point of the seam.
