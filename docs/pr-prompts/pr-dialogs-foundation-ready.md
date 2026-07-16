---
premise: '! grep -rq "useConfirm" apps/web/src'
premise_means: No shared confirm/alert dialog primitive (useConfirm / ConfirmDialog) exists in the web app yet.
scope:
  - apps/web/src/components/**
  - apps/web/src/hooks/**
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && grep -rq "useConfirm" apps/web/src
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Foundation: reusable ConfirmDialog + useConfirm hook

The web app calls native `window.confirm` / `window.alert` / `window.prompt` in 43 places. Those are
un-styled, un-testable, and blocked in some embedded/kiosk contexts. This PR builds the ONE primitive
the migration prompts depend on. It does NOT migrate any call sites (six follow-up prompts do that,
each gated on this landing).

## What to build

1. `apps/web/src/components/ConfirmDialog.tsx` — an accessible modal (focus-trap, Esc to cancel,
   Enter to confirm) with title, message, confirm/cancel labels, and a `variant` (`danger` | `default`).
   Match the app's existing modal styling (reuse the same Tailwind/class conventions used by existing
   dialogs such as `ShellLayout` overlays — do not invent a new design language).
2. `apps/web/src/hooks/useConfirm.tsx` — a promise-based hook + context provider:
   `const confirm = useConfirm(); if (await confirm({ title, message, variant })) { ... }`. Provider
   renders a single `ConfirmDialog` instance and resolves the promise on confirm/cancel. Also expose a
   simple `alert({ title, message })` for the `window.alert` sites.
3. Mount the provider once at the app root (`App.tsx`, wrapping the routed tree).

## Do NOT

- Do NOT migrate any of the 43 existing `window.confirm/alert/prompt` call sites here — that is the
  six follow-up prompts' job. Keep this PR to the primitive + provider only (size 5).
- Do NOT add a new dependency (no headless-ui / radix). Build on the app's existing modal pattern.
- Do NOT change routing or unrelated components.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. Never exit silently -- if the primitive already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval -- there is no human in this run.
- Read the CI job log before diagnosing any failure. `pnpm build` + `pnpm lint` must pass.
