---
premise: '! grep -q "validateVerdict" scripts/pr-watcher/index.mjs'
premise_means: >-
  Nothing checks a review verdict against the PR it describes. Four verdicts in two days asserted file
  changes that were never in the PR, because the reviewer computes the file list from a stale local main.
scope:
  - scripts/pr-watcher/verdict-guard.mjs
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/**
done_when: 'pnpm lint && grep -q "validateVerdict" scripts/pr-watcher/index.mjs'
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-guard
cluster_order: 1
requires_on_main: scripts/pr-watcher/index.mjs :: mirrorVerdictToPr
---

# PIPELINE GUARD 1 — a verdict may not name a file that is not in the PR

## The measured defect

`renderTemplate` (`index.mjs:1969-1973`) passes **only** `{{PR_NUMBER}}` and `{{PR_TITLE}}` into the
review agent. No diff, no file list. So the reviewer computes one itself, with `cwd: REPO_ROOT` — the
watcher's own clone, whose `main` is synced **only** by `syncMain()` (`:1717`), called from exactly one
site (`:2477`) inside a block review jobs skip (`:2298-2302`). Every PR here is gated to Marco, so it
never syncs. Measured stale by 2.5 days and divergent.

The error is directional and always inflates scope. rev-1344 claimed "30+ unrelated code changes in
apps/, scripts/pipeline/, .github/workflows/" for a 5-file docs PR. rev-1346 claimed a 304-line deletion
of `allocation.service.spec.ts` — a file that exists **only in the watcher clone**, at exactly 304 lines.
That number was measured against the wrong base, not hallucinated.

And nothing validates the result: `mirrorVerdictToPr` (`:608-645`) posts the file verbatim, and
`verdictApproves` (`:1251-1259`) is `/^VERDICT:\s*MERGE\b/m` against a string.

## Do

1. New `scripts/pr-watcher/verdict-guard.mjs` exporting a **pure** `validateVerdict({verdictText, prFiles})`:
   extract every path-shaped token from the verdict (backticked spans and bare `a/b/c.ext`), ignore
   `docs/pr-reviews/**` and `docs/pr-prompts/**`, and return `{ok:false, unmatched:[...]}` when any named
   path is absent from `prFiles`.
2. Lift the existing `runGh(["pr","view",String(prNumber),"--json","files"])` call at `index.mjs:1601`
   into a shared `prFileList(prNumber)` and use it as the source of truth.
3. Wire the guard into `drain()`'s success path **before** `mirrorVerdictToPr`. On failure: do not mirror,
   do not write the escalation, move the prompt to `BLOCKED_DIR` with the unmatched paths in the note.
4. Make `verdictApproves` run the same guard before returning true, so a confabulated MERGE can never arm.

## Do NOT

- Do NOT change `syncMain()` or the AUTO_MERGE block. Fixing the stale base is a separate concern; this
  slice makes the lie **detectable**, which is the part that must land first.
- Do NOT touch the review prompt template — that is P0-b's neighbour and a different file.
- Do NOT make the guard silent. A dropped verdict that nobody sees is the failure mode being fixed.

## Tests

Beside `__tests__/verdict-archival.spec.mjs`, same style — the guard is pure over injected deps.
1. Verdict naming a file in `prFiles` → ok.
2. Verdict naming a file **not** in `prFiles` → `ok:false` with that path in `unmatched`.
3. **Regression on the real case**: a verdict quoting `apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts`
   against a `prFiles` of two `docs/pipeline/` entries must fail.
4. Paths under `docs/pr-reviews/` and `docs/pr-prompts/` are ignored, not flagged.
5. A verdict naming no paths at all → ok (not every verdict cites files).

## STOP AND REPORT

- `index.mjs:1601` does not carry the `--json files` call described above.
- Wiring the guard into `drain()` needs a change to `syncMain()` or the merge path.
- Any quoted line number does not match your branch point — re-measure and report the difference.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. **Finishing the work and then asking for
> permission is indistinguishable from failing** — the work is discarded either way.

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. The STOP
AND REPORT conditions mean **open the PR, put the problem in the body, leave it unmerged** — never exit
without opening a PR. Report measurements, not conclusions: if you assert a count or a line number,
show the command that produced it.
