---
premise: '! grep -q "folderProvisioningStatus" apps/api/prisma/schema.prisma'
premise_means: Per-tender folder provisioning status is not persisted anywhere; ensureTenderFolderStructure still swallows per-category failures into a log line and the tender page has no way to say "provisioned / partial / failed".
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260819140000_tender_folder_provisioning_status/migration.sql
  - docs/data-model/relationship-map.json
  - docs/data-model/relationship-map.md
  - docs/data-model/metadata-catalog.json
  - apps/api/src/modules/platform/sharepoint.service.ts
  - apps/api/src/modules/platform/sharepoint.service.spec.ts
  - apps/web/src/pages/tendering/TenderFolderStatusPill.tsx
  - apps/api/src/modules/tendering/tendering.service.ts
done_when: pnpm build && pnpm lint && grep -q "folderProvisioningStatus" apps/api/prisma/schema.prisma && grep -q "TenderFolderStatusPill" apps/web/src/pages/tendering/TenderFolderStatusPill.tsx && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: false
backfill: false
rollback_strategy: Two additive nullable columns only (folder_provisioning_status TEXT NULL, folder_provisioning_errors JSONB NULL) — no row mutation, no default value. Safe to leave on main if the run is capped before code lands. To revert, remove Tender.folderProvisioningStatus and Tender.folderProvisioningErrors from schema.prisma and drop the migration; no compensating row updates required.
requires_on_main: apps/api/src/modules/platform/sharepoint.service.ts :: ensureTenderQuoteClientFolder
cluster: tender-folder-model
---

# TFM-S5: Provisioning visibility

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (section 6 TFM-S5). Gated on
TFM-S4 (`ensureTenderQuoteClientFolder` on `origin/main`).

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `sharepoint.service.ts:176 ensureTenderFolderStructure` currently wraps each per-category
  create in a try/catch that logs a warn line and moves on. If Graph refuses one of the
  nested creates, the tender ends up with an incomplete tree and nobody sees it.
- This is not a bug in the service; it is a design gap. The service must surface the
  outcome so the tender page can show it and a human can decide to retry.

## What to build

### 1. Two additive nullable columns on `Tender`

In `apps/api/prisma/schema.prisma`:

```prisma
model Tender {
  // ... existing fields
  folderProvisioningStatus  String?  @map("folder_provisioning_status")   // "ok" | "partial" | "failed"
  folderProvisioningErrors  Json?    @map("folder_provisioning_errors")   // [{ path, message }]
}
```

Generate the migration; the SQL must be two `ADD COLUMN` statements with no default and no
constraint. No row mutation.

### 2. Regenerate the data-model map

```
node scripts/data-model/build-relationship-map.mjs
```

Commit the regenerated JSON + MD + `metadata-catalog.json`.

### 3. Stop swallowing failures

In `ensureTenderFolderStructure`, refactor the per-path loop so it accumulates a result:

```typescript
const failures: Array<{ path: string; message: string }> = [];
for (const path of flattenFolderPaths(TENDER_FOLDER_STRUCTURE)) {
  try {
    await this.ensureTenderCategoryFolder(tenderId, path);
  } catch (err) {
    failures.push({ path, message: (err as Error).message });
    this.logger.warn(`ensureTenderFolderStructure: failed to create ${path}: ${(err as Error).message}`);
  }
}
```

At the end, write back:

- `failures.length === 0` → `folderProvisioningStatus = "ok"`, `folderProvisioningErrors = null`.
- Otherwise → `folderProvisioningStatus = "partial"` when at least one child succeeded, else
  `"failed"`; `folderProvisioningErrors = failures`.

Update `tendering.service.ts` where `ensureTenderFolderStructure` is called (create,
duplicate) to persist the returned status. Do not add a new endpoint here; the status is
read from `Tender` directly.

### 4. Retry surface

Expose the existing `ensureTenderFolderStructure` behind a retry endpoint
(`POST /tendering/tenders/:id/reprovision-folders`) that re-runs the walk and rewrites the
status. Guard with `@RequirePermissions("tenders.manage")`. No new permission.

### 5. Status pill — `TenderFolderStatusPill.tsx`

New web component that reads the two new fields off the tender payload and renders:

- `ok` → green pill "Filed" (or no pill; keep it quiet on the happy path).
- `partial` → amber pill "Partial — N subfolders failed" with a click-to-retry action.
- `failed` → red pill "Folder provisioning failed" with a click-to-retry action.

Wire it into the tender detail page header. The click-to-retry calls the reprovision
endpoint and refetches the tender.

### 6. Test the accumulator

Extend `sharepoint.service.spec.ts`: mock the adapter to fail on one nested path; assert the
returned status is `"partial"` and the failures list contains that path. Assert that the
happy path returns `"ok"` and null errors.

## Do NOT

- Do NOT add a non-null constraint on either new column — both stay nullable.
- Do NOT rewrite existing tender rows to populate the status. Row updates are out of scope;
  the status populates on the next reprovision or new create.
- Do NOT touch the naming, template, or nested-path logic — those slices already shipped.
- Do NOT surface individual per-category failures anywhere but the retry pill — the point
  of this slice is visibility, not noise.
- Do NOT touch the legacy copy service — TFM-S6/S7.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.**

## Guardrails

- One attempt. If `folderProvisioningStatus` already exists on main, say
  `NO-OP: status already persisted` and stop.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Regenerate and commit the data-model map — CI hard-fails otherwise.

GATE-ALLOW: migrations
