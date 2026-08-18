---
premise: '! grep -q "legacyTendersRoot" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts'
premise_means: The legacy copy service still assumes the legacy tenders root IS the destination tendersRoot (see sharepoint-legacy-copy.service.ts:287), and it does not walk the month folders that hold the real tenders under 2. Quotes/Quotes 2026/{month}/.
scope:
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.spec.ts
  - apps/api/src/modules/admin-imports/admin-imports.module.ts
  - apps/api/src/config/sharepoint.config.ts
done_when: pnpm build && pnpm lint && grep -q "legacyTendersRoot" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts && grep -q "SHAREPOINT_LEGACY_TENDERS_ROOT" apps/api/src/config/sharepoint.config.ts
size: 4
gate_allow: env-vars
seed_only: false
escalates: false
cluster: tender-folder-model
---

# TFM-S6: Legacy root + month walk

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (section 6 TFM-S6). No
predecessor gate — this runs in parallel with the S1–S5 chain.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `sharepoint-legacy-copy.service.ts:287` treats the legacy root as identical to the
  configured destination `tendersRoot`. This is factually wrong: real 2026 tenders live at
  `2. Quotes/Quotes 2026/8. Aug/T2096 - Cornerstone - Grace LC Rothwell` (18 folders in
  August alone), while the destination stays `1. Operations/1. Tenders/`.
- The legacy folder is nested one level DEEPER than the destination: destination is one
  tender folder per T-number directly under the root, whereas legacy has an extra month
  folder between the year root and each tender folder.
- MIG-3.5 (TFM-S1) already delivered the `listFolderChildren` seam, so enumeration works;
  this slice just teaches the walk about the extra depth.

## What to build

### 1. Config: `SHAREPOINT_LEGACY_TENDERS_ROOT`

In `apps/api/src/config/sharepoint.config.ts` (create if missing — the current source of
these config keys), add:

```typescript
export const legacyTendersRoot = process.env.SHAREPOINT_LEGACY_TENDERS_ROOT
  ?? "2. Quotes/Quotes 2026";
```

Validate on startup: if the env var is set but is a bare empty string, throw a clear
startup error naming the var. Default is provided so a fresh dev environment works with the
production shape without configuration.

Add a `GATE-ALLOW: env-vars` marker at column 0 in the PR body so CP-14 accepts the new
config key. Document the new env var in the sharepoint config file's header comment.

### 2. Enumerate legacy tender folders

In `sharepoint-legacy-copy.service.ts`, replace the current single-level walk with a
two-level walk:

```typescript
async listLegacyTenderFolders(): Promise<Array<{ id: string; name: string; monthFolder: string }>> {
  const monthFolders = await this.sharepointService.listFolderChildren(siteId, driveId, this.legacyRootItemId);
  const tenders: Array<{ id: string; name: string; monthFolder: string }> = [];
  for (const month of monthFolders.filter(m => m.isFolder)) {
    const children = await this.sharepointService.listFolderChildren(siteId, driveId, month.id);
    for (const child of children.filter(c => c.isFolder)) {
      tenders.push({ id: child.id, name: child.name, monthFolder: month.name });
    }
  }
  return tenders;
}
```

Every downstream call site that previously enumerated the legacy root directly must switch
to `listLegacyTenderFolders()`. The T-number matcher and idempotency logic stay unchanged.

### 3. Wire the config

In `admin-imports.module.ts`, inject `legacyTendersRoot` (and derived siteId/driveId/itemId)
into `SharePointLegacyCopyService`. Resolve the root's Graph itemId once at boot via
`SharePointService.resolvePath(...)` — the resolved id is what `listFolderChildren` takes.

### 4. Tests

Extend `sharepoint-legacy-copy.service.spec.ts`: the mock adapter is seeded with a month
folder holding three tender folders; the service returns all three with the correct
`monthFolder` label. A month folder that contains a non-folder file is walked without
error and the file is skipped.

## Do NOT

- Do NOT touch the destination `tendersRoot` or `SharePointFolderMapping` — the mapping is
  correct and this slice deliberately does not change it.
- Do NOT enforce the copy precondition here — TFM-S7 owns that.
- Do NOT execute any copy — the S8 copy slice is separate and gated on this slice via S7.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.**

## Guardrails

- One attempt. If `legacyTendersRoot` already exists on main, say
  `NO-OP: legacy root already split` and stop.
- `pnpm build` and `pnpm lint` must both pass before pushing.

GATE-ALLOW: env-vars
