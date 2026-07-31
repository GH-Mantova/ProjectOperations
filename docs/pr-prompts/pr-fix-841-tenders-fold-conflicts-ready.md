---
premise: gh pr view 841 --json state -q .state | grep -q OPEN
premise_means: PR 841 (tenders consolidation) is still open — it went DIRTY after the nav-gates and route-hygiene merges and needs its conflicts resolved on its own branch.
fixes_pr: 841
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/App.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
done_when: gh pr view 841 --json mergeable -q .mergeable | grep -qv CONFLICTING
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# FIX-FORWARD PR #841: resolve merge conflicts on its OWN branch (no new PR)

## Re-verify first (errors drift)

`gh pr view 841 --json mergeable,mergeStateStatus` on the current head. As of 2026-07-31 12:30Z:
CI green but DIRTY — #834 (sidebar permission gates) and #836 (route hygiene) rewrote the same
regions of `ShellLayout.tsx`, `App.tsx` and the nav test that #841 (Tenders consolidation:
remove CRM + Tender Settings entries, delete dead Tender Settings feature, kill /crm and
/tenders/settings) also edits.

## What to build

1. Check out PR #841's EXISTING branch (`feat/...` per `gh pr view 841 --json headRefName`),
   merge current origin/main into it, and resolve conflicts preserving BOTH intents:
   - #841's removals stand: no CRM entry, no Tender Settings entry, /crm and /tenders/settings
     routes gone (404), TenderingSettingsPage + tendering-labels deleted, CRM tab crm.view gate.
   - main's additions stand: `requiresPermission` gates on the surviving items (#834),
     breadcrumb changes and redirect components (#836). Where #841 deletes an item #834 gated,
     the deletion wins; delete its breadcrumb keys too.
2. Reconcile `ShellLayout.nav.test.ts` to the merged reality (estimating = Tenders, Contracts,
   Directory, Rates & Lists, Reports — WITH their new gates) and RUN it (`npx vitest run` on the
   file).
3. Push to the SAME branch. Do NOT open a new PR. CI re-runs; auto-merge is already armed.

## Do NOT

- Do NOT close #841 or recreate its work in a fresh PR.
- Do NOT revert anything from #834/#836.
- Do NOT touch the batch8 archive spec (separate fix in flight).

## VERIFY

- `pnpm build && pnpm lint`
- `npx vitest run apps/web/src/components/__tests__/ShellLayout.nav.test.ts` passes.
- `gh pr view 841 --json mergeable` no longer CONFLICTING.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.
> (For THIS prompt: the deliverable is the updated EXISTING PR #841 — pushing the resolved
> branch IS the completion; say so plainly in your output.)

## Guardrails

- One attempt. Never exit silently — if already resolved, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
