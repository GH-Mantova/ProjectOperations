# Station 00 — Supervisor | 2026-08-31T18:20Z–2026-08-31T18:4xZ (SUPPLEMENT to the 18:09Z run)

**This is a second breadcrumb for one run, and that needs saying.** The 18:09Z breadcrumb landed in
**#1456** (merged 18:19:16Z, `64f7f856`). Station 04 then finished a run at 18:22Z and left a
breadcrumb the earlier report could not have contained. Collecting is 00's job and it is the only
channel that closes, so the collection is written here rather than left for the 20:0xZ run.

## GROUND

```
UTC            2026-08-31T18:20:36Z
origin/main    64f7f856            (fetched, then rev-parse; f4f6ddc6 -> 64f7f856 via #1456 this run)
dev tree       main @ 64f7f856     C:\ProjectOperations2   (fast-forwarded, index clean)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

## WHAT I MEASURED

| Claim | Command | Verdict |
|---|---|---|
| #1456 reached `main` | `gh pr view 1456 --json state,mergedAt,mergeCommit` | **[MEASURED]** `MERGED`, `2026-08-31T18:19:16Z`, `64f7f85663d10b8d679590081faabeafb6689bf2` |
| Dev tree FF'd onto it | `git merge --ff-only origin/main`; `git rev-parse --short HEAD` | **[MEASURED]** `64f7f856` |
| — the FF's known hazard | `git hash-object` local vs `git rev-parse origin/main:<path>` on the 1609 breadcrumb | **[MEASURED]** identical (`8d816660`), so the untracked copy was deleted, then the FF ran clean |
| 04 wrote a new breadcrumb after #1456 | `git status --porcelain` in the dev tree post-FF | **[MEASURED]** `?? docs/pr-prompts/00-04-scanner-2026-08-31-1810-orphan-worktrees-the-sweep-cannot-see.md` |
| Armed queue after the arm | `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` | **[MEASURED]** `pr-lint-not-a-prompt-ready.md` + `rev-1456-ready.md` — the second is an auto-generated REVIEW JOB (§9.5), so **real armed = 1** |
| Post-arm index state | `git diff --cached --name-status` | **[MEASURED]** empty; working tree shows ` D pr-lint-not-a-prompt-HOLD.md` — the ` D`-not-`RD` state the standing trap wants |
| DOCTRINE edit lints | `node scripts/pipeline/lint-station.mjs` | **[MEASURED]** `ADMIT: all 7 docs clean`, exit 0, after `--write-canonical` re-recorded `instruments v2` |
| Edited prompt still ADMITs | `node scripts/pipeline/lint-prompt.mjs docs\pr-prompts\pr-sweep-worktree-liveness-HOLD.md` | **[MEASURED]** `ADMIT (size 3)`, exit 0 |

## WHAT CHANGED

Four files in this PR, plus 04's two:

1. **`docs/pipeline/DOCTRINE.md` §9.5** — new bullet: an armed `-ready.md`'s mtime dates its
   AUTHORSHIP, not its arming (04's F3). `instruments v2` hash re-recorded in
   `docs/pipeline/stations/_canonical-blocks.json` (`b1030c00…`), read back as `ADMIT: all 7 docs clean`.
2. **`docs/pr-prompts/pr-sweep-worktree-liveness-HOLD.md`** — a THIRD defect folded in (04's F1) and
   `done_when` extended with a fourth grep, `worktree-registry-escapees`. Still **UNARMED**.
3. **`docs/pr-prompts/00-04-scanner-2026-08-31-1810-…`** — 04's breadcrumb, committed.
4. **`docs/pipeline/sweep-rotation.json`** — 04's rotation advance, which it explicitly flagged must
   ship with its breadcrumb or the next 04 run repeats `repo-hygiene`.

## FINDINGS

### F7 — 04's F3 was a near-miss S2, and its rule is now in DOCTRINE §9.5

`git mv` preserves mtime, `-ready.md` is gitignored, and `git status` shows only the ` D` of the
vanished HOLD. So an arm made two minutes ago presents as a file last touched 3.4 days ago that no
sweep counted. 04 assembled those three readings, saw *"armed and unseen since 28 August"*, and
checked `.arming-log.txt` before filing. It was **my** arm, at 18:13:56Z, four minutes into its run.

**DISPOSITION: ACTIONED.** The bullet is in §9.5 with the measurement and the falsifier. One
correction made while landing it: the linter rejected the first draft because it named
`docs/pr-prompts/.arming-log.txt` as a repo path and **the arming log is untracked** — so the bullet
now says so explicitly and tells a clone, CI or cloud-fired station not to infer arm age at all.
That is a better rule than the one 04 handed over, and the linter found it, not me.

### F8 — 04's F1: the registry cannot enumerate its own escapees. Folded into the staged cure

`status-sweep.ps1:117` reads `git worktree list`, i.e. the git registry. `C:\ProjectOperations2\.git\worktrees`
is ABSENT, so §2 prints `orphaned worktrees: none` — true of the registry, false of the disk, where
`C:\po-worktrees` holds **4 orphan directories, 85.3 MB, 7519 files**, two of them pointing at Linux
sandboxes that no longer exist. Being absent from the registry is *what makes them orphans*.

04 dispatched this to 03 and deliberately did not stage a competing prompt, because #1454 had edited
those same lines four hours earlier. That reasoning was right, and it leaves the finding owned by a
station that is 19 h stale — the ownerless-park shape the OPEN-DISPATCHES escalation is about.

**DISPOSITION: ACTIONED**, by the move 04 correctly declined to make itself: folded into the
**already-staged, still-UNARMED** `pr-sweep-worktree-liveness-HOLD.md`, which owns that exact
function. One script, one prompt, three defects, one `done_when`. Read back: the prompt still lints
`ADMIT (size 3)`. No worktree was pruned, deleted or touched — that stays 03's, and the prompt says so.

### F9 — 04's F4 REFUTES the phantom-refs figure this station has been carrying

Memory carried *"`git branch -r` 69 vs `ls-remote` 25 ⇒ 44 phantom refs, up from 33 in two days"* as a
dispatch to 03. Re-measured like-for-like by 04: **dev tree** 26 vs 25 → **1** (effectively clean,
because it is being `--prune`d); **watcher clone** 58 vs 25 → **33**. So it is **clone-only**, and it
went 33 → 44 → 33, i.e. it **fluctuates**, which kills the "growing" framing the dispatch rested on.
Also new: the **dev tree carries 11 stashes**, which no previous run had reported.

**DISPOSITION: DISPATCHED → Station 03**, re-stated with the corrected numbers. The cure is one
`git fetch --prune` in the clone, and `stash drop`, never `pop`. **The correction matters more than
the item**: a dispatch built on "44 and growing" would have had 03 hunting a trend that is not there.

### F10 — 04's F2: 22 dead branches on origin, 21 of them from one automation gap

24 non-main heads exist on the remote, reconciled against all 1455 PRs: 2 OPEN (correct), 1 MERGED
with its branch undeleted (#1145), **21 CLOSED-unmerged with branches undeleted**. Auto-delete-on-merge
works — one residue in ~1400 merges — it simply **does not fire on close**, so the 21 will keep growing
at the rate PRs are closed. Branch deletion is a §5.4 irreversible hard stop.

**DISPOSITION: ESCALATED → Marco**, carried forward exactly as 04 framed it, RULE 1 applied:
**(A) complete AND additive, recommended** — write the 22 tip SHAs to a tracked manifest
(`docs/audits/closed-branch-tips-2026-08-31.md`) **first**, then delete, and add the same
export-then-delete as a periodic job. A branch whose tip SHA is recorded is fully restorable with
`git branch <name> <sha>`, so nothing is destroyed, and the accumulation stops. **(B) delete now, no
manifest** — fails the no-damage half (a closed PR's branch is the only place its unmerged work
lives) *and* the future half. **(C) leave them** — damages nothing, fails the solves-it half; the
count only grows. Nothing has been deleted and nothing will be until Marco answers.

### F11 — 04's F5 is clean and is recorded here so no station re-derives it

Board trap **0** tracked depth-1 `*-ready.md` on `origin/main` (controls: 589 tracked / 72 depth-1 /
60 HOLD / neg 0). `triage-holds.ps1`: **spent=0**, 32 satisfied, 27 gated, 0 unreadable of 59 — down
from `spent=2` at 10:1xZ because both were retired in #1449. Data-model `--check` exit 0. Queue root
not littered. **DISPOSITION: ACTIONED** — nothing was required and nothing was done.

## WHAT I DID NOT DO

- **Did not delete any of the four orphan directories, any branch, or any stash.** Irreversible or
  03's lane, or both. 04 measured no `.lock` in any of the four, so they are inert litter today.
- **Did not arm a second prompt.** RULE 4 is one at a time and `pr-lint-not-a-prompt` is in flight.
  `pr-sweep-worktree-liveness-HOLD.md` is now a three-defect fix and is the obvious next arm.
- **Did not re-arm `pr-lint-not-a-prompt`.** It was armed at 18:13:56Z; the banked next-action in
  project memory is **SPENT** and must be retired there, not re-run (04's F3, second half).
- **Did not merge #1443 or #1450** — RULE 2, unchanged from the 18:09Z report.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, and did not `git` anything in the watcher clone.
