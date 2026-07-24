---
premise: 'grep -lqE "window\.(confirm|alert|prompt)" apps/web/src/pages/tendering/ClientQuotesPanel.tsx apps/web/src/pages/tendering/QuoteTab.tsx apps/web/src/pages/tendering/RatesTab.tsx apps/web/src/pages/tendering/TenderClarificationLog.tsx apps/web/src/pages/tendering/TenderDetailPage.tsx apps/web/src/pages/tendering/TenderDocumentsPanel.tsx'
premise_means: These tendering pages still call native window.confirm/alert/prompt.
scope:
  - apps/web/src/pages/tendering/**
done_when: pnpm build && pnpm lint && test -z "$(grep -lE 'window\.(confirm|alert|prompt)' apps/web/src/pages/tendering/ClientQuotesPanel.tsx apps/web/src/pages/tendering/QuoteTab.tsx apps/web/src/pages/tendering/RatesTab.tsx apps/web/src/pages/tendering/TenderClarificationLog.tsx apps/web/src/pages/tendering/TenderDetailPage.tsx apps/web/src/pages/tendering/TenderDocumentsPanel.tsx)"
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# Migrate native dialogs -> useConfirm (tendering, batch A)

**GATED: arm this only AFTER `pr-dialogs-foundation` (ConfirmDialog + useConfirm) has merged to main.**
Do not rename to `-ready` until `grep -rq "useConfirm" apps/web/src` returns true on main.

Replace every `window.confirm` / `window.alert` / `window.prompt` in these 6 files with the shared
`useConfirm()` hook: `if (await confirm({ title, message, variant: 'danger' })) { ... }` for confirms,
`alert({ title, message })` for alerts. Preserve the exact existing behaviour and messages — this is a
mechanical swap, not a UX redesign. Files: `ClientQuotesPanel.tsx`, `QuoteTab.tsx`, `RatesTab.tsx`,
`TenderClarificationLog.tsx`, `TenderDetailPage.tsx`, `TenderDocumentsPanel.tsx`.

## Do NOT
- Do NOT touch tendering files outside this list (they belong to batch B).
- Do NOT change what the dialogs say or which actions they guard.

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
