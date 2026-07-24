---
premise: gh pr view 735 --json state -q .state | grep -q OPEN
premise_means: PR #735 (fold Archive into Documents / Resources into Workers) is still open; its two PR-acceptance specs still assert the Workers KPI strip and worker search on the default /workers view, where the fold no longer renders them, so tendering-e2e is red.
scope:
  - tests/e2e/pr-acceptance/batch5-clients.spec.ts
  - tests/e2e/pr-acceptance/batch5-directory.spec.ts
done_when: pnpm build && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Retarget two PR-acceptance specs to the folded Workers IA (#735) — SPEC-ONLY, no app changes

## Branch — read this first
Work ON the existing PR branch **`feat/fold-archive-resources`** (PR #735). `git fetch origin` then
`git checkout feat/fold-archive-resources` and push your commit to THAT branch so it updates #735.
**Do NOT open a new branch or a new PR.** The whole point is to turn #735's red `tendering-e2e`
check green.

## Why it's red (confirmed from run 29880287226 job log)
The nav-IA fold made `/workers` a tabbed page: **Roster** (default) plus **Availability /
Suitability / Competencies**. The old Resources content — the **"Workers in scope" KPI strip** and
the **"Name or employee code"** search — now lives in `apps/web/src/pages/ResourcesPage.tsx`
(strip ~line 166, search input ~line 185), which the tabbed Workers page renders only for the
non-Roster tabs (i.e. `<ResourcesPage section=... />`). It is reachable at
**`/workers?tab=availability`**. The Roster tab has its own different search ("Search name or role…")
and no KPI strip. Two specs still look for the KPI strip / worker search on the bare `/workers`
(default Roster) view and fail with `toBeVisible` element-not-found:

1. `tests/e2e/pr-acceptance/batch5-clients.spec.ts` — the test at ~line 93 ("Workers → strip
   navigates to /resources"): after it lands on `/workers`, line ~98 asserts
   `getByText("Workers in scope")`. That KPI text is not on the Roster tab.
2. `tests/e2e/pr-acceptance/batch5-directory.spec.ts` — the test "workers page renders KPI strip and
   search" at ~line 217: after `page.goto("/workers")` it asserts the KPI labels (line ~226) and
   `getByPlaceholder("Name or employee code")` (line ~228). Same cause.

## What to do (specs only)
Retarget both tests to the tab where those elements now render — navigate to
**`/workers?tab=availability`** (rather than bare `/workers`) before the KPI-strip / "Name or
employee code" assertions — so the specs match the intended folded IA. Keep each test's other
assertions (URL-shape, redirect behaviour) intact. Use the smallest change that makes the intent
correct; do not weaken coverage beyond the relocation.

Confirm the exact tab that renders the KPI strip + "Name or employee code" search by reading
`apps/web/src/pages/workers/WorkersListPage.tsx` (tab ids: roster|availability|suitability|
competencies) and `apps/web/src/pages/ResourcesPage.tsx`, and target whichever non-Roster tab shows
them (Availability is expected).

## Do NOT
- Do NOT change any application/UI code — nothing under `apps/web/src/**`, no route, redirect, or
  component changes. This is a **test-only** retarget (Marco's explicit decision: retarget the specs,
  do not move the UI).
- Do NOT touch any spec other than the two named files.
- Do NOT open a new PR or new branch; push to `feat/fold-archive-resources`.
- Do NOT auto-merge. Open/refresh the PR (#735) and leave the merge to the board.

## Verify before you finish
Run the acceptance suite against the branch and read the exit code — do not trust your impression of it:
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pipeline\smoke-pr.ps1 -Branch feat/fold-archive-resources`
The two named tests must pass and the suite must be green. If a required env boot is missing, say so
plainly; never re-run hoping for green.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN/REFRESH THE PR. Do not ask.**
**"Do NOT auto-merge" means: push to #735 and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push". There
is no human in this run. **Finishing the work and then asking for permission is indistinguishable from
failing** — the work is discarded either way.

## Guardrails
- One honest attempt. Never exit silently — if you produce no push, say `NO-OP: <reason>` loudly.
- Never ask a question or "stand by" for approval — there is nobody awake to answer.
- Read the job log before diagnosing any CI failure; the exit code of smoke-pr decides, not your
  opinion of it.
- Completion test: is there a commit pushed to `feat/fold-archive-resources` (updating #735) in your
  output? If not because it was already green, say `NO-OP: already green`. If not because you could
  not, say `NO-OP: <reason>`. Never stop merely waiting for someone.
