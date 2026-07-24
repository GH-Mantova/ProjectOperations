---
premise: gh pr view 735 --json state -q .state | grep -q OPEN
premise_means: PR #735 is still open, so its 3 tendering-e2e acceptance specs still assert the OLD IA and need updating to the new (LOCKED nav-IA) fold.
scope:
  - tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts
  - tests/e2e/pr-acceptance/batch5-directory.spec.ts
  - tests/e2e/pr-acceptance/batch5-clients.spec.ts
done_when: pnpm build && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Fix PR #735 - update 3 acceptance specs to the new nav-IA (Archive->Documents, Resources->Workers)

**PR:** https://github.com/GH-Mantova/ProjectOperations/pull/735
**Branch:** `feat/fold-archive-resources`

You are fixing an **EXISTING** PR. **Do NOT open a new PR.** Check out
`feat/fold-archive-resources`, make the edits, commit, and **push to that same branch** - that
updates #735 and re-triggers its checks.

## Why this is authorized

Marco confirmed (2026-07-22) that the IA fold in #735 is intended - it is part of the LOCKED
nav-IA redesign. So the 3 acceptance specs that still assert the OLD IA are what is wrong, not the
app. Update them to the new IA.

## The failure - VERIFY IT YOURSELF FIRST (doctrine: read the job log, never diagnose from the diff)

#735 is BLOCKED because the required check `tendering-e2e` fails. 7 of 8 required checks are green;
only this one is red. In that job, the **"Run PR-acceptance E2E suite"** step fails with 3
deterministic `expect(locator).toBeVisible()` timeouts. Read the latest `tendering-e2e` run for
#735 (`gh pr checks 735`, then `gh run view <run-id> --log`) and confirm the 3 failures are exactly
the ones below before editing. If the log shows different failures, fix what the log actually shows
and say so.

### Expected 3 failures and the fix for each (new IA)

1. `tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts` -
   "archive register renders standalone at `/archive`". #735 makes `/archive` **redirect** to
   `/documents?tab=archived`, so nothing renders standalone at `/archive` any more. Retarget the
   spec to assert the archive register renders under the **Documents -> Archived** tab
   (`/documents?tab=archived`).

2. `tests/e2e/pr-acceptance/batch5-directory.spec.ts` -
   "workers page renders KPI strip and search". #735 makes `/workers` a tabbed page
   (Roster / Availability / Suitability / Competencies); the KPI strip + search now live under the
   **Roster** tab. Retarget the spec's locators to the Roster tab.

3. `tests/e2e/pr-acceptance/batch5-clients.spec.ts` -
   "...navigates to resources". #735 removes the standalone `/resources` route (folded into
   `/workers`). Point the spec at `/workers` instead of `/resources`.

Keep the specs asserting real, seeded behaviour on the new IA - do NOT weaken them to
always-pass (no bare `expect(true)`, no removing the visibility assertions). They must still prove
the page renders. The `plant pills` flake (`batch3-scope-items.spec.ts`) is NOT in scope - it is
skipped in this run and unrelated.

## Do NOT

- Do NOT open a new PR. Push to `feat/fold-archive-resources`.
- Do NOT touch any file outside the 3 specs in `scope`. In particular, do NOT change app routes,
  components, or add a `/resources -> /workers` redirect - the fold is already implemented; this is
  a spec-only fix.
- Do NOT merge. Push and let CI run; merging is a separate station's job.
- Do NOT edit `sot/`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and update the PR. Do not ask.
"Do NOT merge" means: push the fix and LEAVE THE PR UNMERGED. It does NOT mean "wait for approval
before starting", and it does NOT mean "do the work then ask permission to push". There is no human
in this run. Finishing the work and then asking for permission is indistinguishable from failing -
the work is discarded either way.

## Guardrails

- One attempt. If you cannot make the fix, say `NO-OP: <reason>` loudly - never exit silently.
- Never ask a question or "stand by" for approval - there is no human in a headless run.
- Read the `tendering-e2e` job log before diagnosing; do not reason the failure out of the diff.
- The real acceptance gate is CI `tendering-e2e` after you push. Your local `done_when`
  (`pnpm build && pnpm lint`) only proves the specs still compile and lint.

### Completion test

Before finishing, ask: "Did I push a commit to `feat/fold-archive-resources` that updates #735?"
Yes -> done. No because already fixed on the branch -> `NO-OP: <reason>`. No because I could not ->
`NO-OP: <reason>`. No because I am waiting for someone -> WRONG; there is nobody. Push it.
