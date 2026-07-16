---
premise: 'grep -lqE "window\.(confirm|alert|prompt)" apps/web/src/pages/tendering/TenderingPage.tsx apps/web/src/pages/tendering/ScopeCuttingSheet.tsx apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx apps/web/src/pages/tendering/ScopeWasteTab.tsx apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx'
premise_means: These tendering scope pages still call native window.confirm/alert/prompt.
scope:
  - apps/web/src/pages/tendering/**
done_when: pnpm build && pnpm lint && test -z "$(grep -lE 'window\.(confirm|alert|prompt)' apps/web/src/pages/tendering/TenderingPage.tsx apps/web/src/pages/tendering/ScopeCuttingSheet.tsx apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx apps/web/src/pages/tendering/ScopeWasteTab.tsx apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx)"
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Migrate native dialogs -> useConfirm (tendering, batch B)

**GATED: arm this only AFTER `pr-dialogs-foundation` has merged to main.**
Do not rename to `-ready` until `grep -rq "useConfirm" apps/web/src` returns true on main.

Replace every `window.confirm` / `window.alert` / `window.prompt` in these 5 files with the shared
`useConfirm()` hook (danger variant for destructive confirms; `alert({title,message})` for alerts).
Mechanical swap, preserve existing behaviour and messages. Files: `TenderingPage.tsx`,
`ScopeCuttingSheet.tsx`, `ScopeQuantitiesTable.tsx`, `ScopeWasteTab.tsx`, `scope-cards/ScopeCardsTab.tsx`.

## Do NOT
- Do NOT touch tendering files outside this list (they belong to batch A).
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
