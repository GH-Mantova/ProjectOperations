---
premise: '! grep -q "SWEEP_COLLECTS_REVIEW_VERDICTS_V1" scripts/pipeline/sweep-breadcrumbs.ps1'
premise_means: >-
  sweep-breadcrumbs.ps1 scans exactly two roots - the `"docs/pr-prompts", "docs/pipeline"` literal
  in its candidate block - and admits only `docs/pr-prompts/00-*.md` plus `docs/pipeline/*`.
  `docs/pr-reviews/` is in neither, so the review verdicts the `rev-<N>` job writes are collected
  by nothing and reach `origin/main` only when a Station 00 collect PR happens to sweep them in by
  hand. MEASURED 2026-09-25T02:2xZ by Station 00 at 5045e81d - 14 untracked review files in the dev
  tree, newest tracked on origin/main is pr-2114-review.md, and this is the THIRD hand-sweep of the
  same backlog (#2026 published 33, #2078 published 18).
scope:
  - scripts/pipeline/sweep-breadcrumbs.ps1
  - docs/pr-prompts/superseded/pr-sweep-collects-review-verdicts-HOLD.md
done_when: >-
  grep -q "SWEEP_COLLECTS_REVIEW_VERDICTS_V1" scripts/pipeline/sweep-breadcrumbs.ps1 &&
  ! test -f docs/pr-prompts/pr-sweep-collects-review-verdicts-HOLD.md
size: 2
gate_allow: none
seed_only: false
escalates: true
module: pipeline
---

# sweep-breadcrumbs: collect the review verdicts too, so the third hand-sweep is the last

Staged by Station 00 on 2026-09-25 from its own F3 this run. The reviewer verdicts under
`docs/pr-reviews/` are named in `00-supervisor.md` PHASE 1b as a source every collect run must
read - *"reviewer verdicts (MERGE / FIX / BLOCK)"* - and nothing in this repo puts them on `main`.

## What is wrong

`scripts/pipeline/sweep-breadcrumbs.ps1` exists precisely so that agent-written artifacts left
untracked in the shared dev tree get batched onto a branch and opened as ONE PR, because
NO-DRIFT forbids a station committing them itself. Its candidate block names two roots:

    "docs/pr-prompts", "docs/pipeline"

and its filter admits `docs/pr-prompts/00-*.md` (breadcrumbs) and `docs/pipeline/*`. A review
verdict is neither, so it is never a candidate and the script's own "nothing to sweep" message is
scoped to breadcrumbs by construction.

The consequence is not theoretical and it is not new. It has now produced three separate manual
backfills, each by a Station 00 run that noticed the pile by eye:

| backfill | landed by | what it published |
|---|---|---|
| `a111a591` | `#2026` | 33 settled verdicts, `#1869`-`#2011`, *"that sat untracked in the dev tree"* |
| `3be7587a` | `#2078` | 18 verdicts, in a collect PR whose own title records they *"were never published"* |
| this run | (pending) | 14 verdicts, `#2119`-`#2180` |

[MEASURED] 2026-09-25T02:2xZ at `5045e81d`: the newest `pr-*-review.md` tracked on `origin/main` is
`pr-2114-review.md`; `git status --porcelain` in the dev tree lists 14 untracked review files;
`git check-ignore -v docs/pr-reviews/pr-2180-review.md` exits **1** with empty output, so the
directory is NOT gitignored (POSITIVE control - `docs/qa/qa-findings.md` through the same form
exits 0 naming its rule). 171 review files ARE tracked on `origin/main`, so the tracked state is
the intended one and what is missing is only the mechanism that maintains it.

## The change

**Do not widen the breadcrumb filter.** Add a second, explicitly-named class so the two cannot
drift into each other.

1. Add `"docs/pr-reviews"` to the candidate scan roots beside the two already there.
2. Admit a candidate under that root only when its leaf matches `pr-<digits>-review.md`. Anything
   else under `docs/pr-reviews/` is left alone, exactly as the arming-file refusal already leaves
   `*-ready.md` and `*-HOLD.md` alone.
3. Keep every existing refusal unchanged - no `git add -A`, every path passed explicitly, no
   staging of a deletion.
4. Put the literal marker `SWEEP_COLLECTS_REVIEW_VERDICTS_V1` in a comment beside the scan-roots
   line so this prompt's premise can die.

## What this deliberately does NOT do

**It does not decide where a verdict should be read from.** DOCTRINE section 9.5 records that a
review verdict has THREE homes - the dev tree, the watcher clone's `docs/pr-reviews/`, and
`C:\po-watcher\verdicts-archive\` - and that the leader is whichever home the last job wrote to.
The sweep runs in the dev tree and can only collect what is there. A verdict that landed only in
the clone or only in the archive is a SEPARATE gap and is not in scope here; say so in the PR body
rather than quietly widening to the other two, because reading across trees is what the mirror
step already exists to do and duplicating it here would give two actors one job.

**It does not change the review lane's behaviour.** Whether the `rev-<N>` lane should review
second-lane PRs at all is Marco's, already filed as
`needs-marco/rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md`.

## Verification

- `grep -q "SWEEP_COLLECTS_REVIEW_VERDICTS_V1" scripts/pipeline/sweep-breadcrumbs.ps1` - exit 0.
- Run the script's existing no-op path in a tree holding one untracked
  `docs/pr-reviews/pr-999999-review.md` fixture and one untracked `docs/pr-reviews/notes.txt`
  fixture. The first must be listed as a candidate, the second must not. **Both fixtures are
  required**: a test with only the matching file cannot fail.
- POSITIVE control that existing behaviour is untouched: an untracked
  `docs/pr-prompts/00-04-scanner-<date>-fixture.md` is still a candidate.
- NEGATIVE control: an untracked `docs/pr-prompts/pr-something-ready.md` is still REFUSED.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
