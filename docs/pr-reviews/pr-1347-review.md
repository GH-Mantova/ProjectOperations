# PR #1347 — review

**VERDICT: MERGE**

Written by Station 06 (PR Master) 2026-08-27T02:4xZ, at Marco's explicit instruction to
check the PR body, complete its checks, and merge if cleared.

**This supersedes the `NEEDS-MARCO-VERIFY` verdict mirrored into this file by the watcher
at 02:20:52Z.** Both of that verdict's blockers are wrong or discharged; see §4.

PR: `feat(nav): gate folded Pipeline item on tenders.view OR crm.view (any-of)`
Head `3c8961c9ad9b1a53a8ade70a2b17fa08641f3082` · base `47f9c73d` · 3 files, +67 / -12.

---

## 1. Provenance

Originating prompt: `docs/pr-prompts/pr-pipeline-fold-s3-nav-any-permission-HOLD.md`
(cluster `pipeline-fold`, `cluster_order: 3`, `size 3`, `gate_allow: none`,
`escalates: false`, `requires_on_main: apps/web/src/components/ShellLayout.tsx :: PIPELINE_FOLDED`).

Armed by `fs.renameSync` HOLD → ready at **01:56:32.996Z**. Consumed 01:56:33.985Z,
ended 02:11:28.444Z, exit 0. Run log:
`docs/pr-prompts/processed/pr-pipeline-fold-s3-nav-any-permission-ready.md.log`.

Watcher routing: `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/components/ShellLayout.tsx"}`
— correctly routed to Marco. Merged only because Marco instructed it by name.

## 2. Premise — verified live, not taken from the PR body

`apps/api/src/modules/crm/pipeline/pipeline-dashboard.controller.ts` carries
`@RequireAnyPermission("tenders.view", "crm.view")` at lines **54, 66, 74, 82, 91** —
all five routes (dashboard, by-stage, win-rates, stalled, relationship-coverage).

Before this PR the nav item carried `requiresPermission: "tenders.view"` alone, so a
`crm.view`-only user was admitted by the server and had no nav link. Real gap, real fix.

## 3. Change — read line by line at PR head

- `requiresAnyPermission?: string[]` added to `NavItem` with JSDoc that correctly states
  the AND semantics when both gates are set.
- `canAny` imported alongside `can`. The helper **already existed** at
  `apps/web/src/auth/permissions.ts:8` (`codes.some((c) => can(user, c))`) — nothing new
  was invented for this.
- One sibling `if` added at the single filter point in `filteredGroups`.
  `requiresPermission` is untouched on every other nav item. `pickMobileTabItem` consumes
  `filteredGroups`, so the mobile tab bar inherits the fix without a second change.
- Pipeline item gate → `["tenders.view", "crm.view"]`; `PIPELINE_FOLDED` comment updated.

Four new tests, read at head and confirmed substantive:
1. `tenders.view`-only → visible.
2. `crm.view`-only → visible. *(the actual bug)*
3. neither → hidden. **Negative control.**
4. generic: a synthetic item, holds-none → false, holds-one → true — deliberately written
   so the any-of contract survives the Pipeline item being removed.

`Pipeline` was correctly removed from the `EXPECTED_GATES` table (which asserts
`requiresPermission` via `it.each`) and replaced with a pointer comment to the new
describe block. Without that removal the suite would fail.

**Scope: 3 files against 2 declared.** The third, `ShellLayout.nav.test.tsx`, updates a
pre-existing assertion that would otherwise fail. Consequential rather than gratuitous —
and the run log disclosed it unprompted rather than hiding it. Accepted.

## 4. Why the 02:20:52Z NEEDS-MARCO-VERIFY does not stand

**Blocker 1, "No originating prompt file located" — false.** The review searched for
`pr-1347-*.md` and `pr-pipeline-fold-s1-any-permission*.md`. Neither is the prompt's name:
it is **s3**, not s1, and prompts are never named after the PR number they produce. It
then applied the house rule ("if NONE match, do NOT guess — output NEEDS-MARCO-VERIFY")
correctly to a search that was itself wrong. Compounding it, `*-ready.md` and `processed/`
are gitignored, so a git-indexed search cannot find them — the working tree must be read
directly.

**Blocker 2, "tendering-e2e IN_PROGRESS" — discharged by time.** It completed `success`
at **02:22:07Z**, 1m15s after the review was posted.

This is the fourth instance in the recovered corpus and the last two days of a review-lane
verdict asserting something it did not actually check (rev-1344, rev-1346, `pr-1238`'s own
retraction, and now this). It is a milder instance — a failed search rather than a
fabrication — but the same shape, and it points the same direction: blocking clean work.
Filed for the reviewer-defect thread.

## 5. CI — all 13 check runs green on `3c8961c9`

`Web — lint, logic tests, vitest, build` ✓ · `API — lint, test, compliance smoke` ✓ ·
`tendering-e2e` ✓ · `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` ✓ ·
`raw-error-envelope gate` ✓ · `Data model — generator sanity` ✓ ·
`Pipeline — watcher + linter tests` ✓ · `Pipeline — arm-prompt tests (Windows)` ✓ ·
`Changed-path filter` ×2 ✓ · `CodeQL` + `Analyze (javascript-typescript)` +
`Analyze (actions)` ✓.

`mergeable_state: clean`, not a draft, **no labels** (no `do-not-merge`).

`done_when` verified against PR head:
`grep -q "requiresAnyPermission" apps/web/src/components/ShellLayout.tsx` → exit 0.

## 6. Caveat, stated plainly

I did **not** run `pnpm build` / `lint` / `test` myself. pnpm is not installed in the
environment available to me, and I do not run builds or git against the dev tree. CI ran
them; the green `Web — lint, logic tests, vitest, build` job is the evidence — my own
execution is not.

## 7. Merge

Attempted via the GitHub MCP; the integration token is read-only
(`403 Resource not accessible by integration` on both comment and merge). Handed to Marco
with `gh pr merge 1347 --squash`. Verification above stands regardless of who clicks.
