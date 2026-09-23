# Station 00 — Supervisor | 2026-09-23T20:46:00Z–2026-09-23T20:57:00Z

**ADDENDUM to the 20:36 run (same station, same run, later measurements).** The 20:36 breadcrumb
merged as `#2134` at `20:45:54Z`. Everything below happened *after* it was written and therefore is
not in it: the prompt armed at `20:35:38Z` was built, opened a PR, and that PR went red twice for two
different reasons. Filed separately so the next occurrence inherits it rather than re-deriving it.

## GROUND

```
UTC            2026-09-23T20:46:00Z
origin/main    9676874d  (after #2134)
dev tree       main @ 9676874d  C:\ProjectOperations2   (0 0, all four read-backs EMPTY)
doc version    1
bootstrap      1
```

Actor `station-00.sched-2023z`, scheduled, headless.

## WHAT I MEASURED

| probe | result |
|---|---|
| the arm's outcome | [MEASURED] **`#2135` opened `2026-09-23T20:41:41Z`**, head `feat/devtree-reset-guard`, files `.claude/hooks/guard.mjs` + `scripts/pipeline/__tests__/guard-devtree-reset.test.mjs` — **exactly the prompt's declared `scope`, nothing else** |
| `#2135` lane | [MEASURED] real routing verdict in that prompt's **own** log: `[watcher] merge result for PR #2135: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .claude/hooks/guard.mjs"}`, and the same log carries `Shipped. PR …/pull/2135 opened unmerged.` — same number, so genuine routing, **not** a prose scrape (§10.1 `PRNUMBER_SCRAPED_FROM_PROSE_V1`) |
| `Pipeline — watcher + linter tests` on `#2135`, before | [MEASURED] **fail**. Cause read from the job log, last tab-column: `[TITLE_SCOPE_UNRESOLVED] scope "guard" names nothing this repo can point at.` `nearest 5: board, adr, api, audit, auth` |
| the same job, after the title rename | [MEASURED] **pass** |
| `PR gates — diff checks` on `#2135`, after | [MEASURED] **pass** |
| post-merge dev-tree FF cure | [MEASURED] raw-Buffer restore of both dirty paths, `byteExact=true` on both; `.arming-log.txt` blob is **MIXED** (CRLF=145, bare LF=4); `git update-index --refresh` exit **0** first call, `--porcelain` EMPTY — **no EOL branch needed** |
| `.arming-log.txt` after FF | [MEASURED] **24938 B** (its full pre-FF local size), and my arm line present → **1**. Nothing lost |
| `gh pr update-branch 2135` | [MEASURED] `✓ PR branch already up-to-date`, exit 0 — so `mergeStateStatus=BEHIND` read a **stale cached rollup**, not a real behind-ness |

## WHAT CHANGED

1. **Renamed `#2135`'s title** from `feat(guard): …` to **`feat(pipeline): block \`git reset\` in the
   shared dev tree (DEVTREE_RESET)`** (`gh pr edit`, exit 0, title read back). `pipeline` is a scope
   proven live by `#2131`'s own passing title. Read back: the title job went **fail → pass**.
2. **Re-ran the two flaked runs** (`gh run rerun --failed`, exit 0 each).
3. **Deleted `.arming-log.local.bak`**, the side-file the restore cure wrote (read back: absent).

## FINDINGS

**F1 — the prompt I armed carries no `module:`, so the watcher derived a PR-title scope that no
vocabulary entry matches, and the build's only red was its own title.** [MEASURED] above.
`pr-devtree-sync-ff-only-guard-HOLD.md`'s front matter had `premise`, `premise_means`, `scope`,
`done_when`, `size`, `gate_allow`, `seed_only`, `escalates`, `backfill`, `cluster`, `cluster_order`
— and **no `module:`**. The gate's own message names the cure and points at
`docs/pr-prompts/PROMPT-SCHEMA.md#the-pr-title`: *"Use your prompt's `module:` value — it is
validated against the same vocabulary."* A prompt with no `module:` has no such value, so the title
is derived from prose and fails on a scope the repo cannot resolve. **DISPOSITION: ESCALATED — to the
EXISTING file, not a new one.** `needs-marco/prompts-carry-no-module-and-the-title-gate-fails-the-pr-2026-09-21.md`
is present and is exactly this defect; this run is a fresh instance two days on, and the cost is one
wasted CI cycle plus a manual rename per armed prompt. The 06 dispatch merged this run independently
lists `module:` first among *"constraints that actually failed PRs in the last twelve hours"*, so
three actors have now hit it. What this adds is that it is now **reproducible on demand**: arm any
HOLD lacking `module:` and the title gate fails.

**F2 — `actions/checkout` failed TLS certificate verification three times in twelve minutes, across
two different PRs, and the shape is indistinguishable from a content gate failing.** [MEASURED]
`#2134`, job `PR gates — diff checks`, `20:40:17Z / 20:40:28Z / 20:40:38Z`; `#2135`, job
`Analyze (actions)`, `20:52:14Z / 20:52:24Z / 20:52:41Z`. Identical text both times:
`fatal: unable to access 'https://github.com/GH-Mantova/ProjectOperations/': server certificate
verification failed. CAfile: none CRLfile: none` → `The process '/usr/bin/git' failed with exit code
128`, three retries, then job failure. **The gates never ran.** The check name on the `#2134`
instance is `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`, so the available conclusion
from the PR page alone is *"a content gate rejected this PR"* — which is why §3's *never diagnose a
CI failure without reading the job log* is what saved it: `#2134`'s re-run passed on a **byte-identical
diff**, which is the test that distinguishes a transient from a defect. **DISPOSITION: DEFERRED.**
Two of three occurrences cleared on re-run, so throughput is not blocked, and the cause is inside
GitHub's runner image rather than in this repo — nothing here can fix it. **It becomes urgent if a
re-run ever fails the same way**, i.e. if the flake stops being transient; at that point every PR on
the board is unmergeable and it is an escalation, not a finding.

**F3 — a CodeQL run that flakes CANNOT be re-run, so `--failed` is not a universal remedy.**
[MEASURED] `gh run rerun 35918799713 --failed` → `run 35918799713 cannot be rerun; This workflow run
cannot be retried`, exit **1**. `Analyze (actions)` is therefore still red on `#2135` on a run that
no re-run can clear, while `gh pr update-branch 2135` answers `already up-to-date` — so the usual
second lever (a merge commit that re-triggers everything) is also unavailable. **DISPOSITION:
DEFERRED to the next occurrence, with the remedy named** so it is not re-derived: the only remaining
trigger is a **new commit on `feat/devtree-reset-guard`**, or a `workflow_dispatch` of the CodeQL
workflow. This was deliberately not done at `20:57Z` — see WHAT I DID NOT DO.

**F4 — `failed/` holds three files for this prompt dated 2026-08-28, and read by filename they look
exactly like this run's arm looping three times.** [MEASURED] `docs/pr-prompts/failed/
pr-devtree-sync-ff-only-guard-c-ready.md{,.log,.report.md}` sit beside `processed/…-b-ready.md.log`
and `processed/…-c-ready.md.log`, and my first reading of that file set was *"one arm produced three
builds in ten minutes"* — the restage loop §10.1 records. **The log refutes it:** `Started:
2026-08-28T14:17:49.210Z`, `Exit: 0`, quarantine note *"agent exited 0 but opened no PR on all 3
attempts"*, and the agent's own last line *"Standing by — this is a HOLD, so I won't touch
`guard.mjs` until you say to arm it."* That is **26-day-old history** from an earlier arming of the
same slug, after which the prompt was re-staged as HOLD. This run produced **exactly one build and
one PR**. **DISPOSITION: ACTIONED** — recorded so the next reader does not mistake the same file set
for a live loop. The discriminator is one command: read the `Started:` line, never the filename set.
No rename to `*-LOOPING.md` was warranted and none was made.

## WHAT I DID NOT DO

- **Did not merge `#2135`.** Real watcher `marco:true` verdict on `.claude/hooks/guard.mjs` — RULE 2
  binds absolutely. Driven toward green and left for Marco, which is the correct end state for it.
- **Did not push a synthetic commit to `feat/devtree-reset-guard`** to re-trigger the unretryable
  CodeQL run (F3). Two jobs were still **pending** at `20:57Z`, so a new commit would have cancelled
  in-flight work to chase a flake on a PR that **cannot merge this run regardless**; and this run is
  at its hourly slot boundary, where `needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-
  next-occurrence-2026-09-07.md` is the live cost. Handed to the next occurrence with the remedy
  named rather than half-done at the boundary.
- **Did not arm a second prompt.** One arm per run; `pr-fv2-formrule-contract` remains never-arm for
  this station regardless of its new ADMIT.
- **Did not touch the two orphaned worktrees or the `dirty=1` watcher clone** — Station 03's lane,
  dispatched in the 20:36 breadcrumb.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, wrote no production data, and added or
  removed no label.
