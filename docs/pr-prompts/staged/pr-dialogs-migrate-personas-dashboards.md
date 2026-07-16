---
premise: 'grep -lqE "window\.(confirm|alert|prompt)" apps/web/src/personas/ChatPanel.tsx apps/web/src/personas/ClarificationProposalCardList.tsx apps/web/src/personas/EstimateProposalCardList.tsx apps/web/src/personas/ProposalCardList.tsx apps/web/src/personas/QuoteProposalCardList.tsx apps/web/src/personas/pages/ProviderKeyManager.tsx apps/web/src/dashboards/CustomisePanel.tsx apps/web/src/dashboards/DashboardCanvas.tsx apps/web/src/dashboards/DashboardSwitcher.tsx apps/web/src/dashboards/WidgetSettingsPopover.tsx'
premise_means: The personas and dashboards components still call native window.confirm/alert/prompt.
scope:
  - apps/web/src/personas/**
  - apps/web/src/dashboards/**
done_when: pnpm build && pnpm lint && test -z "$(grep -lE 'window\.(confirm|alert|prompt)' apps/web/src/personas/ChatPanel.tsx apps/web/src/personas/ClarificationProposalCardList.tsx apps/web/src/personas/EstimateProposalCardList.tsx apps/web/src/personas/ProposalCardList.tsx apps/web/src/personas/QuoteProposalCardList.tsx apps/web/src/personas/pages/ProviderKeyManager.tsx apps/web/src/dashboards/CustomisePanel.tsx apps/web/src/dashboards/DashboardCanvas.tsx apps/web/src/dashboards/DashboardSwitcher.tsx apps/web/src/dashboards/WidgetSettingsPopover.tsx)"
size: 10
gate_allow: none
seed_only: false
escalates: false
---

# Migrate native dialogs -> useConfirm (personas + dashboards)

**GATED: arm this only AFTER `pr-dialogs-foundation` has merged to main.**
Do not rename to `-ready` until `grep -rq "useConfirm" apps/web/src` returns true on main.

Replace every `window.confirm` / `window.alert` / `window.prompt` in these 10 files (5 personas
components, ProviderKeyManager, 4 dashboards components) with the shared `useConfirm()` hook (danger
variant for destructive confirms; `alert({title,message})` for alerts). Mechanical swap, preserve
existing behaviour and messages.

## Do NOT
- Do NOT touch `dashboards/widgets/tendering.tsx` (it is in the misc-A batch).
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
