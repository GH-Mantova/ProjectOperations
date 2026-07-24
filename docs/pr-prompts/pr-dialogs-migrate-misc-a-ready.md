---
premise: 'grep -lqE "window\.(confirm|alert|prompt)" apps/web/src/components/contacts/ContactsTab.tsx apps/web/src/components/ShellLayout.tsx apps/web/src/drafts/DraftBanner.tsx apps/web/src/offline/DeadLetterBanner.tsx apps/web/src/dashboards/widgets/tendering.tsx apps/web/src/pages/contracts/ContractDetailPage.tsx apps/web/src/pages/directory/SubcontractorsPage.tsx'
premise_means: These shared components and pages still call native window.confirm/alert/prompt.
scope:
  - apps/web/src/components/**
  - apps/web/src/drafts/**
  - apps/web/src/offline/**
  - apps/web/src/dashboards/widgets/**
  - apps/web/src/pages/contracts/**
  - apps/web/src/pages/directory/**
done_when: pnpm build && pnpm lint && test -z "$(grep -lE 'window\.(confirm|alert|prompt)' apps/web/src/components/contacts/ContactsTab.tsx apps/web/src/components/ShellLayout.tsx apps/web/src/drafts/DraftBanner.tsx apps/web/src/offline/DeadLetterBanner.tsx apps/web/src/dashboards/widgets/tendering.tsx apps/web/src/pages/contracts/ContractDetailPage.tsx apps/web/src/pages/directory/SubcontractorsPage.tsx)"
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# Migrate native dialogs -> useConfirm (shared components + misc pages, batch A)

**GATED: arm this only AFTER `pr-dialogs-foundation` has merged to main.**
Do not rename to `-ready` until `grep -rq "useConfirm" apps/web/src` returns true on main.

Replace every `window.confirm` / `window.alert` / `window.prompt` in these 7 files with the shared
`useConfirm()` hook (danger variant for destructive confirms; `alert({title,message})` for alerts).
Mechanical swap, preserve existing behaviour and messages. `ShellLayout.tsx` hosts the provider mount
point from the foundation PR — only swap its own dialog calls, do not move the provider.

## Do NOT
- Do NOT touch files outside this list (projects/scheduler/workers are in batch B).
- Do NOT change dialog wording or the actions guarded.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already migrated.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
