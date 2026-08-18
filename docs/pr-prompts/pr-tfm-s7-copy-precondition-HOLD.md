---
premise: '! grep -q "assertDestinationExists" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts'
premise_means: The legacy copy plan/execute endpoints do not verify the destination folder exists before queuing a copy; a plan can currently be produced against tenders whose destination tree was never provisioned.
scope:
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.spec.ts
  - apps/api/src/modules/admin-imports/dto/sharepoint-legacy-copy.dto.ts
done_when: pnpm build && pnpm lint && grep -q "assertDestinationExists" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts && grep -q "destinationReady" apps/api/src/modules/admin-imports/dto/sharepoint-legacy-copy.dto.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts :: legacyTendersRoot
cluster: tender-folder-model
---

# TFM-S7: Copy precondition

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (section 6 TFM-S7). Gated on
TFM-S6 (`legacyTendersRoot` on `origin/main`).

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- The MIG-3 `plan` endpoint returns a copy plan for every matched legacy tender. It does
  not currently check whether the destination folder was ever provisioned. Marco's brief
  was explicit: **"only after you confirmed the folders were created."** This slice turns
  that discipline into an enforced precondition.
- TFM-S6 delivered a separate legacy root and a two-level walk; this slice adds the
  matching destination-side guard.
- TFM-S5 delivered `folderProvisioningStatus` on `Tender`; this slice consumes it as one of
  two signals (the other being a live Graph existence check for tenders that predate S5).

## What to build

### 1. `assertDestinationExists`

Add a private method:

```typescript
private async assertDestinationExists(tenderId: string): Promise<{
  ready: boolean;
  reason: string | null;
}> {
  const tender = await this.prisma.tender.findUnique({
    where: { id: tenderId },
    select: { id: true, folderProvisioningStatus: true, /* fields needed to derive folder path */ },
  });
  if (!tender) return { ready: false, reason: "tender not found" };
  if (tender.folderProvisioningStatus === "failed") {
    return { ready: false, reason: "folder provisioning failed" };
  }
  // Existence probe for rows that predate the status column (S5) or that were partially provisioned.
  const path = deriveTenderFolderName(tender);
  const exists = await this.sharepointService.folderExists(siteId, driveId, `${tendersRoot}/${path}`);
  if (!exists) return { ready: false, reason: "destination folder missing" };
  return { ready: true, reason: null };
}
```

If `SharePointService.folderExists` does not exist yet, add it — a thin wrapper over the
adapter that returns `false` on `NotFound` and rethrows on any other error.

### 2. Refuse in `plan`

The plan endpoint calls `assertDestinationExists(tender.id)` for every matched tender and
returns per-tender readiness:

```typescript
{
  tenderId,
  destinationReady: boolean,
  destinationReason: string | null,
  wouldCopy: Array<{ sourcePath, destinationPath, sizeBytes }>,
}
```

Tenders where `destinationReady === false` are still included in the plan output (so a human
can see which ones need remediation) but their `wouldCopy` list is empty and a top-line
`unready` count is surfaced.

### 3. Refuse in `execute`

The execute endpoint MUST call `assertDestinationExists` again immediately before starting
each tender's copy (do not trust a stale plan). A tender that fails the precondition at
execute time is skipped, logged, and counted in the response — not attempted.

### 4. DTO

Extend `sharepoint-legacy-copy.dto.ts` with the `destinationReady` and `destinationReason`
fields on the plan-entry DTO, and a top-level `unreadyCount` field on the plan-response DTO.

### 5. Tests

Extend `sharepoint-legacy-copy.service.spec.ts`:

- A tender with `folderProvisioningStatus = "failed"` is unready with reason
  `"folder provisioning failed"`; its `wouldCopy` is empty.
- A tender whose destination folder does not exist per the adapter probe is unready with
  reason `"destination folder missing"`.
- A tender with a successful provisioning status AND a resolvable folder is ready and its
  `wouldCopy` list is populated.
- `execute` skips an unready tender at run time even if the plan called it ready earlier
  (the adapter is re-checked between plan and execute).

## Do NOT

- Do NOT execute any copy here — this slice adds the guard only. TFM-S8 runs the 2026 copy.
- Do NOT touch `folderProvisioningStatus` semantics — that field's meaning is fixed by S5.
- Do NOT change the T-number matcher or idempotency logic.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.**

## Guardrails

- One attempt. If `assertDestinationExists` already exists on main, say
  `NO-OP: precondition already enforced` and stop.
- `pnpm build` and `pnpm lint` must both pass before pushing.
