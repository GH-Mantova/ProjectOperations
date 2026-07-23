---
premise: '! test -f docs/architecture/drafts/swms-build-slice-plan.md'
premise_means: The SWMS split-build slice plan has not been written yet.
scope:
  - docs/architecture/drafts/**
done_when: pnpm build && pnpm lint && test -f docs/architecture/drafts/swms-build-slice-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Interactive SWMS module - SLICE 0: write the ordered SPLIT build plan (two tracks)

Marco confirmed (2026-07-17): **SPLIT into two independently-shippable tracks** -
**(A) the static SWMS wizard** and **(B) the control-mapping tool**. They ship separately; (A) does
not depend on (B). Because this is the largest body of unshipped design work, SLICE 0 is a **plan
only** - no schema or code - so every later slice is a small, reviewable PR under the size-10 cap.

Backbone already extracted from the **Rev 5 template**: 7 sections, 102 controls, 410 control rows,
31 SOP-SWMS. Prototype lives only in `C:\ProjectOperations-Reference\Interactive SWMS\`. Zero SWMS
artifacts exist on `main` today.

## Deliverable: `docs/architecture/drafts/swms-build-slice-plan.md`

Produce it with:
1. **Decision header** - two-track split (Marco 2026-07-17): (A) static SWMS wizard, (B)
   control-mapping tool; (A) ships without (B). **Open sub-question:** module home. Default the plan
   to a **standalone SWMS module surfaced under the Compliance area**, and flag that default for Marco
   to confirm before Track-A slice 1 is armed.
2. **Source inventory** (read the prototype + Rev 5 template, do not guess): the 7 sections, the 102
   controls / 410 control rows, the 31 SOP-SWMS, and how the prototype models them.
3. **Track A - static SWMS wizard**: ordered slices, each <=10 files, each independently shippable
   (data model for SWMS + sections/controls -> seed the Rev 5 backbone -> wizard UI -> render/export).
   For any slice touching `apps/api/prisma/schema.prisma`, the slice MUST also regenerate the
   data-model map (`node scripts/data-model/build-relationship-map.mjs`, commit `docs/data-model/**`)
   and declare `GATE-ALLOW: migrations`.
4. **Track B - control-mapping tool**: ordered slices, each <=10 files, mapping controls to
   sections/SOP-SWMS; note its dependency on the Track-A data model.
5. **Sequencing + risks** - what must land first, seed idempotency, and which slices are `escalates`
   (seed/prod-data). Mark each slice's `size`, `gate_allow`, `seed_only`, `escalates`.

## Do NOT
- Do NOT change `schema.prisma`, add a migration, seed, or touch any application code in this PR.
  **Plan only.**
- Do NOT touch `sot/` (CP-24).
- Do NOT decide the module-home question yourself - default + flag it, per item 1.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- if the plan doc already exists, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
