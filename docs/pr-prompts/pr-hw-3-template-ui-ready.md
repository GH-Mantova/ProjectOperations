---
premise: ! test -f apps/web/src/pages/settings/HandoverTemplatePage.tsx
premise_means: B-HW-3 (Settings → Handover Template editor UI) is not built.
scope:
  - apps/web/src/pages/settings/**
  - apps/web/src/App.tsx
  - apps/web/src/components/settings/**
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/settings/HandoverTemplatePage.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/handover-templates/handover-templates.service.ts
---

# feat(web): handover template editor in Settings (B-HW-3)

Implement **B-HW-3** of `docs/plans/contract-handover-wizard-plan.md`. Add
`HandoverTemplatePage.tsx` under Settings, gated on `handovertemplate.manage`, backed by the
B-HW-2 API. Let an authorised user reorder/rename/add/remove sections and fields (field-type
palette: text, money, date, list, attachment, contact; list-type backed by a GlobalList) and hit
**Publish** to cut a new version. Show the current live version and the editing draft. Route it in
`App.tsx` under the Settings shell.

## Do NOT
- Do NOT build handover instances or the wizard. Do NOT add a migration or backend endpoints.
- Do NOT touch `/sot/`. Do NOT exceed the B-HW-3 file set.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
