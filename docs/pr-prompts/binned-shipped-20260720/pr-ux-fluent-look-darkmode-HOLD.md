---
premise: '! grep -rqi "prefers-color-scheme\|data-theme\|darkMode" apps/web/src 2>/dev/null'
premise_means: There is no dark mode / modern Fluent theming across the web app.
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && grep -rqi "prefers-color-scheme\|data-theme\|darkMode" apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 modern Fluent look + dark mode) | MVP -->
# HOLD — UX: modern Fluent look + dark mode (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 "New Look" parity: a design-token pass for a modern flat
look and a **dark mode** toggle. Foundational polish that lifts every screen.

## What to build
Branch: `feat/ux-fluent-darkmode`. Reviewer: `GH-Mantova`. No migration.
1. Introduce CSS-variable **design tokens** for surfaces/text/borders/brand and route existing
   hardcoded colours through them (incremental — cover the shell + the most-used pages; don't rewrite
   every component). Add a `data-theme` (light/dark) on the root that flips the tokens; respect
   `prefers-color-scheme` and a user toggle (persisted).
2. A theme toggle in the shell (user menu). Keep the brand tokens (`sot/01` §5 BRAND) intact — dark
   mode adjusts neutrals, not the brand palette.

## Do NOT
- Do NOT change the locked brand colours/logo (sot/01 §5). Do NOT rewrite every component's styles in
  one PR — establish the token system + dark toggle + shell + top pages, and note what remains. Do NOT
  touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
