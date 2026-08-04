---
premise: '! grep -q "components/ErrorBoundary" apps/web/src/App.tsx'
premise_means: The field OfflineProvider subtree is not wrapped in an ErrorBoundary, so a failure in the offline IndexedDB layer can white-screen the whole /field app.
scope:
  - apps/web/src/App.tsx
  - apps/web/src/components/ErrorBoundary.tsx
done_when: pnpm build && pnpm lint && grep -q "components/ErrorBoundary" apps/web/src/App.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Wrap the field OfflineProvider subtree in an ErrorBoundary (Phase-6 robustness)

`OfflineProvider` (from `apps/web/src/offline/OfflineContext.tsx`) is mounted in `App.tsx`, scoped
to `/field/*`. It initialises an IndexedDB-backed offline queue. If that init throws (corrupt DB,
private-mode, quota, migration failure), the exception propagates and **white-screens the entire
field app** — the worst possible outcome for a field user with no signal. Wrap it so it degrades
gracefully instead.

A reusable `ErrorBoundary` component already exists at `apps/web/src/components/ErrorBoundary.tsx`.
Read it first and use it as-is; only extend it if it does not already accept a custom `fallback`.

## What to build

1. In `apps/web/src/App.tsx`, wrap the `<OfflineProvider>…</OfflineProvider>` subtree (around the
   existing mount) in `<ErrorBoundary>`, with a **field-appropriate fallback** — a small message that
   the offline layer is unavailable but the app still works online, plus a reload/retry affordance.
   Do NOT wrap the whole app — scope the boundary to the offline subtree so only that area degrades.
2. If `ErrorBoundary.tsx` has no `fallback` prop, add an optional one (keep the existing default
   behaviour unchanged for all current callers) and cover it with the existing ErrorBoundary test.

## Do NOT
- Do NOT change any offline sync / queue / dead-letter logic (`offline/**`).
- Do NOT alter ErrorBoundary's default behaviour for existing usages.
- Do NOT touch anything outside the two scoped files. No schema, no migration.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already wrapped.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
