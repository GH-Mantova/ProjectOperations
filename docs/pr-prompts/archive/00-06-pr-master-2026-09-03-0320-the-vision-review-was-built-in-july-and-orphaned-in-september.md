# Station 06 — PR Master | 2026-09-03T03:05Z–03:22Z

Run by the **cloud/chat lane** following the Station 06 pathway at Marco's instruction.
`[NO LANE VERDICT — hand-classified]` per DOCTRINE §10.1. Brief: make the design mock-ups a
checkable source of truth, so a PR can be verified against the artifact it was built from.

## GROUND

```
UTC            2026-09-03T03:05Z
origin/main    f5c01415
dev tree       main @ 52f985e8   C:\ProjectOperations2
doc version    1
bootstrap      n/a — invoked from chat
```

## WHAT I MEASURED

**[MEASURED] Both halves of this were already built, in July.**
`scripts/pipeline/visual-smoke.mjs` (PR #636, 2026-07-16) logs in as the seed admin, drives a
`screens.json` route list, and writes one deterministic full-page PNG per screen to
`docs/pr-reviews/pr-{n}-smoke/{name}.png` at 1440x900, asserting nothing by design. The judgement
half is `docs/pipeline/stations/02-board-driver.md:336`, rule 6 **VISION REVIEW** — open each PNG,
judge it against the PR's stated visual acceptance criteria, per-screen PASS/FAIL in the smoke
comment's table, a visual FAIL is a SMOKE FAIL, and *"This step REPLACES the manual 'Marco test'
for appearance."*

**[MEASURED] 🔴 The vision review is orphaned.** PR **#1516** folded Station 02 into 00
(merged 2026-09-02T04:49:33Z). `00-supervisor.md` is **944 lines** and contains:

```
visual-smoke   0 hits
VISION         0 hits
screenshot     0 hits
rule 6         0 hits
```

Its only reference to 02 is a struck-through table row at `:313` —
`| ~~02-board-driver~~ | FOLDED INTO YOU, 2026-09-02 — the board is yours | nothing; you drive it |`.
It does not tell its reader to go and read 02's doc. Worse, 00's own smoke instruction at `:245`
says **"the EXIT CODE decides, never your reading of the log"** — the exact opposite of a review
where the agent's reading of the PNG *is* the verdict. A station reading only 00's contract cannot
learn the vision review exists, and would be told the wrong rule if it guessed.

**[MEASURED] The screenshots have never once been kept.**
`git ls-tree -r --name-only origin/main -- docs/pr-reviews` returns **zero** `*-smoke`
directories. `git check-ignore` returns nothing for `docs/pr-reviews/pr-999-smoke/x.png`, so the
path is **not** ignored — they could always have been committed. `visual-smoke.mjs` resolves
`REPO_ROOT` from its own location, so inside the smoke worktree it writes into
`<worktree>/docs/pr-reviews/...`, and rule 6's teardown removes the worktree. The vision review
judges evidence that is destroyed minutes later. Same shape as the review-verdict loss recorded in
this morning's 02:50Z breadcrumb.

**[MEASURED] `design_ref` does not exist.** `git grep design_ref origin/main` returns one hit, an
unrelated `mix_design_ref` seed field. `lint-prompt.mjs` rejects unrecognised frontmatter with
`UNKNOWN_KEY`, so a naming convention alone cannot work — the key must be taught to the linter.

**[MEASURED] `playwright.config.ts:27` is `screenshot: "only-on-failure"`.** A correction to an
earlier claim of mine this session: `PWTEST_SCREENSHOT_DIR` in `smoke-pr.ps1:167` does not mean the
harness captures screens on a green run. It does not. `visual-smoke.mjs` is the deliberate capture
path and it is a separate tool.

## WHAT CHANGED

Three prompt drafts placed at the queue root as `-HOLD` (nothing armed; `armed at queue root: 0`):

| File | Lint |
|---|---|
| `pr-visualreview-s1-restore-vision-review-to-00-HOLD.md` | **ADMIT (size 1)** |
| `pr-visualreview-s2-keep-the-screenshots-HOLD.md` | **REJECT [GATE_NOT_RELEASED]** — correct |
| `pr-visualreview-s3-design-ref-frontmatter-HOLD.md` | **ADMIT (size 3)** |

S1 and S2 are cluster `visual-review`, orders 1 and 2; S2 gates on
`requires_on_main: docs/pipeline/stations/00-supervisor.md :: VISION REVIEW`, verified absent from
`origin/main` so it is a live gate, not a `CLUSTER_DEAD_GATE`. S3 is deliberately uncluttered —
it touches only the linter, its tests and `PROMPT-SCHEMA.md`.

Nothing else. No arming, no code, no `sot/`.

## FINDINGS

**F1 — A shipped capability was lost in a fold, silently.**
The 02→00 fold moved authority but not the rule. Nothing detected it: `lint-station.mjs` checks the
canonical block, not whether a folded station's body rules survived. This is the second time in two
days that a fold or a worktree teardown quietly removed something that was working.
**DISPOSITION: DISPATCHED** — Station 00, as `pr-visualreview-s1`. Marco approved the design
2026-09-03.

**F2 — Evidence written into a disposable worktree is not evidence.**
Zero smoke PNG directories have ever reached `main`, on a path that was never ignored.
**DISPOSITION: DISPATCHED** — Station 00, as `pr-visualreview-s2`. It adds `--out` to
`visual-smoke.mjs` (default unchanged), a `MAX_PNG_BYTES` guard so one runaway screen cannot commit
a 40 MB file, and a commit-before-teardown step. A failed push is a smoke **NOTE**, never a FAIL —
losing the pictures must not turn a green PR red.

**F3 — Nothing links a PR to the design it came from.**
**DISPOSITION: DISPATCHED** — Station 00, as `pr-visualreview-s3`. Optional `design_ref`, required
only when `scope` touches `apps/web/`, with a `fixes_pr` exception so a red-board fix is never
blocked for want of a citation. Shape-checked only — an artifact URL is unreachable from CI and a
`Claude Design/` path is gitignored, so existence cannot be verified and must not be attempted.
The prompt carries a mandatory regression control: re-lint all 74 held prompts and prove no verdict
changed. A linter change that silently re-verdicts the queue is a board outage.

**F4 — A fourth slice is deliberately NOT written: before/after comparison.**
It needs a main-branch capture run in CI and is worth nothing until F2 proves the PNGs survive.
**DISPOSITION: DEFERRED** — revisit once S2 has merged and one PR has carried its own screenshots.

## WHAT I DID NOT DO

- **Did not arm anything.** The `git mv` to `-ready` is Station 00's.
- **Did not rewrite `visual-smoke.mjs` or rule 6.** Both work. S1 moves the contract; S2 makes its
  output durable. Rebuilding either would have been the "already built" failure this station exists
  to catch.
- **Did not delete rule 6 from `02-board-driver.md`.** S1 leaves a pointer instead, so the two
  cannot silently drift.
- **Did not retrofit `design_ref` onto the 74 existing prompts.** Every one would fail the linter
  at once. That is its own decision.
- **Did not touch the canonical block.** Rule 6 lives in the station body, so none of these three
  slices needs a `station-contract` version bump — which is why S1 is size 1 rather than size 8.
- **Did not touch `sot/`.**
