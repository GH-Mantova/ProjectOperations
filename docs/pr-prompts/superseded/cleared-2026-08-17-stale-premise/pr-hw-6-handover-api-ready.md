---
premise: ! test -f apps/api/src/modules/handovers/handovers.service.ts
premise_means: B-HW-6 (handover API — create-on-contract, values, one-way prefill, completeness) is not built.
scope:
  - apps/api/src/modules/handovers/**
  - apps/api/src/app.module.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/handovers/handovers.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/handovers/handover.types.ts
---

# feat(api): handover API — create, values, one-way prefill, completeness (B-HW-6)

Implement **B-HW-6** of `docs/plans/contract-handover-wizard-plan.md`. Add handovers
controller/service/module (guarded by `tenderconversion.manage`), wired into `app.module.ts`.
Behaviour: create a Handover for a contract, pinning the current active template version; get/patch
`HandoverValue` rows keyed by fieldKey with `sectionDone`; compute `completionPct`. Implement the
**one-way prefill** — populate auto-fields from the awarded `ClientQuote` (highest revision) into
the handover's own copy (`sourceValue` + `value`), NEVER writing back to tender/quote/contract; set
`isOverridden` when the user edits. Do NOT implement the UI, safeguards badge, compliance
derivation, subbies, or finalise (later slices).

## Do NOT
- Do NOT add a migration. Do NOT build B-HW-7..11 concerns. Do NOT touch `/sot/`. Do NOT exceed the B-HW-6 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
