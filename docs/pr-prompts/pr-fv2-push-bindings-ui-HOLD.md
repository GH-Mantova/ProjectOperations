---
premise: ! test -f apps/web/src/pages/forms/PushBindingsPanel.tsx
premise_means: The forms designer's properties panel has no Push tab and there is no UI for authoring FormFieldPushBinding rows or the Plant Pre-Start bindings.
scope:
  - apps/web/src/pages/forms/PushBindingsPanel.tsx
  - apps/web/src/pages/forms/formDesignerState.ts
  - apps/web/src/pages/forms/FormDesignerPage.tsx
  - apps/api/src/modules/forms/push-executor.service.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
  - apps/api/src/modules/assets/assets.service.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/forms/PushBindingsPanel.tsx && grep -q "record_usage_reading" apps/api/src/modules/forms/push-executor.service.ts
size: 10
gate_allow: none
seed_only: false
escalates: true
rollback_strategy: ''
---

# Forms Engine v2 — push bindings UI + Plant Pre-Start (F-9b)

This is the second half of the F-9 flagship, chained after F-9a
(`feat/fv2-push-engine-core`), which built `FormFieldPushBinding`, the
`PushExecutorService` post-commit executor with its dispatch strategy stub,
and the `FormTriggeredRecord` failure/retry columns. This slice registers
the real Plant Pre-Start dispatch handlers behind that stub, builds the Push
tab in the designer's properties panel, and adds the apply-on-approval
toggle. `apps/web/src/pages/forms/formDesignerState.ts`'s `tabsForFieldType`
already documents "The Push tab arrives with F-9; not surfaced here" — this
slice is where it lands.

## What to build

- Create `apps/web/src/pages/forms/PushBindingsPanel.tsx`: a Push tab shown
  in the designer's right-panel properties surface
  (`FormDesignerPage.tsx`) for fields that support push bindings (worker
  picker / asset picker / meter-reading style fields from F-5, and
  repeating-section defect entries). Lets an author add one or more bindings
  per field: `targetModule`, `targetAction` (pick from the handlers this
  slice registers), a `config` editor for the binding-specific shape (e.g.
  `unit`, `rejectBelowLast`, `allowMeterReplacedOverride`,
  `assetFromFieldKey` for a usage-reading binding), an enable/disable
  toggle, and the **apply-on-approval toggle** (`applyOn`: `"submit"` |
  `"approval"`, per-binding). Wire it into `tabsForFieldType` so eligible
  field types show a `"push"` tab alongside `general`/`options`/`logic`.
- In `apps/api/src/modules/forms/push-executor.service.ts` (from F-9a),
  register the Plant Pre-Start dispatch handlers behind the existing
  strategy stub:
  - `record_usage_reading`: resolves the target asset via
    `config.assetFromFieldKey`, reads the reading value from the submitted
    field, and calls `AssetsService.recordUsageReading` (F-7, already on
    `main` by the time this slice runs) — never touches `prisma.asset.*` or
    `prisma.assetUsageReading.*` directly, per the single-writer rule in
    `sot/06-active-specs.md` §4.1.
  - `create_defect`: for each entry in a repeating defect section, creates a
    breakdown-style record through the maintenance/assets module (the
    nearest existing analogue is `AssetBreakdown`, already
    trigger-creatable per the ownership map) via that module's own service
    method — not a direct Prisma write from the forms module.
  - Major-severity flag/block: when a defect entry's severity is `"Major"`,
    additionally call the assets service's status-update path (the same one
    `MaintenanceService.updateAssetStatus` uses) to flag/block the asset's
    cleared status, so `AssetStatusHistory` records the change.
  Every successful dispatch still writes the `FormTriggeredRecord` row F-9a
  already wires up — this slice only supplies the concrete handlers.
- On the approval route (`forms-engine.controller.ts`, `approve` at L120),
  call `PushExecutorService` for bindings with `applyOn = "approval"` —
  mirroring how `applyOn = "submit"` bindings already fire from the submit
  route per F-9a.
- Surface push failures and the retry action: extend
  `FormSubmissionDetailPage.tsx` (or the submission detail view) to show any
  `FormTriggeredRecord` rows with `status = "failed"` and a retry button
  that calls `PushExecutorService.retryFailedPushes` (F-9a) via a small
  controller route if one doesn't already exist.

## Do NOT

- Do not touch `FormFieldPushBinding`'s schema or the `FormTriggeredRecord`
  status/lastError/attempts columns — those were added by F-9a; this is a
  UI + handler-registration slice only, no migration.
- Do not modify `AssetsService.recordUsageReading`'s validation logic — call
  it as-is; F-7 owns that method.
- Do not touch Azure/Entra/SharePoint.
- Do not build the rules-engine push actions (system-value-driven pushes) —
  that is F-10.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — if something in scope cannot be completed,
say `NO-OP: <reason>` and stop. Never ask or stand by for approval. Read the
CI job log before diagnosing any failure. `pnpm build` and `pnpm lint` must
both pass before pushing.
