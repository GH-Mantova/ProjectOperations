# Station 00 — Supervisor | 2026-09-22T13:14Z–2026-09-22T13:35Z

## GROUND

```
UTC            2026-09-22T13:14Z
origin/main    49262485  (at start)  ->  744abe54  (after this run's merge of #2080)
dev tree       main @ 49262485  C:\ProjectOperations2   (0 behind, 0 ahead at start)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run had full authority, not read-only.
**This was a SIGHTED run.** Desktop Commander loaded, `start_process` shell `powershell.exe`
returned PID 20936 on the first attempt, and every measurement below was taken on the Windows box.

## WHAT I MEASURED

**[MEASURED] The device-bridge git guard is INSTALLED BUT INERT — exit 2, the expected station outcome.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read from the
installer itself and not from a pipeline appended to it:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

Per the PREFLIGHT table this is a FINDING, not a STOP. The device-bridge git ban is REMEMBERED, not
mechanical, for this run. No VM-side `git` was run against the mount at any point.

**[MEASURED] All three binding documents are byte-identical to `origin/main` in the dev tree**, so
reading the working copy was sound this run. Using the non-piped forms PREFLIGHT step 2 mandates:

```
git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md                 -> EMPTY
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md   -> EMPTY
git diff --numstat origin/main -- docs/pipeline/STATION-CAPABILITIES.md     -> EMPTY
git rev-list --left-right --count HEAD...origin/main                        -> 0	0
```

**[MEASURED] Breadcrumb freshness is CLEAN, exit 0. No station is SILENT.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness`:

```
00  last 2026-09-22T12:23:00Z  0.9h ago  (cadence 2h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-21T23:04:00Z  14.2h ago (cadence 24h) ok
04  last 2026-09-22T10:11:00Z  3.1h ago  (cadence 4h)  ok
05  last 2026-09-21T14:11:00Z  23.1h ago (cadence 24h) ok
structure: 1 checked, 0 malformed        CLEAN   FRESHNESS_EXIT=0
```

**[MEASURED] `status-sweep.ps1` verdict: SAFE TO ACT** — generated 2026-09-22T13:15:17Z. Both
instrument positive controls passed (`gh` reached GitHub; `node` runs). No git index.lock in either
tree, 0 scoped git processes, no PR touched in the last 2 minutes, no live station worktrees.

**[MEASURED] Section 5 of the sweep produced ZERO `[STALE]` escalation rows.** Every row was
`[FILE]`. There was nothing to discharge into `needs-marco/discharged/` this run — which is a
different answer from the eleven dead rows of 2026-09-10, and it is the answer the instrument gave.

**[MEASURED] The watcher is healthy and the queue is empty.** `watcher node: RUNNING pid 9744`,
auto-restart wrapper alive (1), heartbeat 40 min (ticks only mid-run), `armed (*-ready.md): 0`,
non-main worktrees: none. An idle watcher with 0 armed prompts is CORRECT, not wedged — no restart
was considered.

**[MEASURED] The sweep's `<-- TRUNK IS RED` headline is a CANCELLED run counted as a FAILED one.**
The sweep printed `main CI on 49262485: 3 success / 1 failed / 0 running`. Asked live, per-commit,
with the FULL 40-char SHA (§9.4 — the short form answers `[]`):

```
git rev-parse origin/main -> 49262485184de386ec7178dfe728638c327c1d98
gh run list -R GH-Mantova/ProjectOperations --commit <full> --json ...   GHEXIT=0

35727963319 | CI                       | completed | success
35727963366 | Deploy                   | completed | success
35727961201 | CodeQL                   | completed | success
35728152886 | Claude Code              | completed | skipped
35727963197 | Tendering Browser Smoke  | completed | CANCELLED
```

There is **no failing job on the trunk commit.** The one non-success is a *cancellation*, and the
run's own job detail names it: `X tendering-e2e in 7m55s` / `X The operation was canceled.`

**[MEASURED] The cancellation is not a timeout and not this workflow's concurrency rule.**
`.github/workflows/playwright.yml` carries `timeout-minutes: 60` on that job (it died at 7m55s) and
`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`, which is FALSE for the push event
that started it.

**[MEASURED] It is the second such cancellation today, and the first one's timing does look like a
concurrency cancel despite that expression.** Last 12 push runs of `Tendering Browser Smoke` on
main: **10 success, 2 cancelled.**

| run | created | ended | outcome |
|---|---|---|---|
| 35704419954 | 08:22:09Z | 08:35:27Z | cancelled — **2 s AFTER** the next main push run (35705634836) was created at 08:35:25Z |
| 35727963197 | 12:34:06Z | 12:42:23Z | cancelled — **no successor push run existed**; cause unexplained |

The 08:22Z row is consistent with concurrency cancellation firing on a push despite the expression
evaluating false; the 12:34Z row is not, and no instrument I have names its canceller.

**[MEASURED] PR #2080 did NOT come through the watcher, and the RULE-2 probe is well calibrated.**
§10.1 step 1, with the positive control that bullet demands:

```
'merge result for PR #2080' in docs/pr-prompts/processed/*.md.log  -> 0
'merge result for PR #'     (POSITIVE CONTROL, same corpus)        -> 755
```

755 verdicts prove the probe can produce a hit; 0 for #2080 is therefore a real absence, and the
absence means *it never went through the watcher* — not *it was checked and cleared*.

**[MEASURED] #2080 classifies as Station 00's own lane under §10.1 step 3, and passes step 2 anyway.**
Its entire diff is ONE file: `docs/pr-prompts/pr-scopecards-s7-one-cutting-total-HOLD.md`, ADDED,
237 additions, 0 deletions. That path matches `NESTED_TEST_PATHS[0]` `/^(tests|docs)\//`, so
`classifyPolicyFiles` admits it as docs; and it is `docs/`, which is 00's recorded lane. Labels: **none**
(no `do-not-merge`, no `needs-marco`, no `hold`). `mergeStateStatus: CLEAN`, `isDraft: false`.
`Approval receipt (CP-26)`: **pass** — so the gate never armed via labelling, per §10.2.1.

**[MEASURED] A published reviewer verdict for #2080 already exists on `main` and says MERGE.**
`docs/pr-reviews/pr-2080-review.md`, `VERDICT: MERGE`, with its own `[MEASURED]` dependency proof
that S6's `CUTTING_ONE_SURFACE_V1` marker is on main at `c2511054`. My merge agrees with it. The
copy in the watcher clone reads `??` only because that clone is behind the commit that published it.

**[MEASURED] The watcher clone is 22 commits behind and carries one dirty tracked file.**
Read-only git in `C:\po-watcher\ProjectOperations` (no checkout, no merge, no commit):

```
HEAD         a31e86d5   committed 2026-09-21 20:12:36Z
origin/main  eb3086fa   (that tree's own tracking ref — pinned at watcher launch, §9.2)
git rev-list --left-right --count HEAD...origin/main   ->  0	22

 M docs/data-model/metadata-catalog.json
?? .codex/
?? AGENTS.md
?? docs/pr-reviews/pr-2080-review.md
?? scripts/pr-watcher/.conflict-notified-prs.json
```

**NOT corrupt** — on `main`, no `MERGE_HEAD`, no rebase, no unmerged paths. This is the "parked and
harmless" reading of the OFF-MAIN rule, not the `*** CORRUPT` one. The rescue script was NOT run.

**[INFERRED] `.codex/` and `AGENTS.md` are untracked artefacts of a lane that is not the watcher.**
I did not identify which, and I did not touch them.

**[MEASURED] Escalation and lesson gates are all clear.** `open=0  resolved=3  broken=0`;
`holding=5  regressed=0  broken=0`. Three escalations are RESOLVED with the artifact verified on
main (`clients-perms-namespace`, `smoke-gate-nonfunctional`, `queue-armed-by-commit-noop`).

## WHAT CHANGED

**1. PR #2080 merged, and it reached `main`.** Native squash auto-merge, the sanctioned path for a
non-migration PR (DOCTRINE §8.3) — never a hand `git merge`:

```
gh pr merge 2080 -R GH-Mantova/ProjectOperations --auto --squash --delete-branch   MERGE_EXIT=0
gh pr view 2080 --json number,state,mergedAt  ->  {"state":"MERGED","mergedAt":"2026-09-22T13:21:41Z"}
```

Read back **on the trunk, not on the PR page** — `git fetch` then
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` returns
`docs/pr-prompts/pr-scopecards-s7-one-cutting-total-HOLD.md` at `744abe54`. The board is now EMPTY.

**2. Re-ran the cancelled `tendering-e2e` job before diagnosing it as a defect** (station rule 5 —
a cancellation is the transient class). `gh run rerun 35727963197 --failed`, exit 0. At the time of
writing that re-run is `in_progress` and a fresh push run `35732962684` (created 13:21:45Z by
#2080's own merge) is `pending`. **Neither had concluded when this breadcrumb was written**, so this
run does not claim the trunk is green — it claims the trunk is not *failing*, which is a different
and smaller claim.

**3. Nothing was armed.** 0 prompts were armed, 0 `-HOLD.md` renamed, `.arming-log.txt` untouched.

**4. Nothing was discharged from `needs-marco/`.** The sweep produced no `[STALE]` rows to clear.

## FINDINGS

### F1 — `status-sweep.ps1` renders a CANCELLED main run as `TRUNK IS RED`, and that reading sends every reader hunting a code defect that does not exist

The sweep buckets any `conclusion != success` as *failed*. On `49262485` the only non-success was a
**cancelled** `Tendering Browser Smoke`; `CI`, `Deploy` and `CodeQL` were all green. "Red" and
"cancelled" are different facts with different owners — a red trunk is a code defect and belongs to
whoever broke it; a cancelled run is an infrastructure event and belongs to nobody until its
canceller is named. The headline is the FIRST line of section 1 that a station reads, and the
station doc's own Q6 makes "what is the ONE thing blocking progress" turn on it.

This is §7's shape exactly: a correct reading of the wrong quantity, printed with more confidence
than the quantity deserves.

**Falsifying probe:** re-read `main CI on <sha>` against
`gh run list --commit <FULL sha> --json conclusion` on any commit whose only non-success is a
cancellation. If the sweep ever prints `0 failed` there, this finding is wrong.

**DISPOSITION: DEFERRED** — the fix is a one-line change to the counting in `status-sweep.ps1`
(count `cancelled` into its own bucket and print `TRUNK IS RED` only on a true `failure`), and it is
a code PR. This collect run is carrying a docs PR, and CP-24 hard-fails any PR mixing code and
`sot/` — that is not this case, but a code change to the one instrument every station opens with
deserves its own PR and its own review rather than riding a breadcrumb sweep. **It becomes urgent
the moment a real red trunk appears while a cancellation is also present**, because then the
headline is true for the wrong reason and the distinction is lost entirely.

### F2 — Two push-event `Tendering Browser Smoke` runs on main were cancelled today, and one of them has no explanation at all

10 of the last 12 succeeded, so this is not chronic and not a regression. But `cancel-in-progress`
is expressed as FALSE for push events, and the 08:22Z run still died 2 seconds after the next push
run was created — which either means the concurrency rule fires on pushes regardless of that
expression, or two unrelated cancellations coincided to the second. The 12:42Z one had no successor
run at all, so whatever cancelled it is not the concurrency group.

I re-ran it rather than reasoning further, because the rule is *re-run a transient before you
diagnose a defect*, and because the rerun plus the fresh push run together answer the question
better than any log reading would.

**DISPOSITION: DISPATCHED to Station 04 (Scanner)** — "is anything rotting?" is exactly this
question, and it wants the read-only audit 04 owns, over a longer window than one supervisor cycle:
pull every `Tendering Browser Smoke` run on main for the last 14 days, count cancellations, and test
whether each one coincides with a subsequent run's creation. If they all do, the finding is that
`cancel-in-progress` is not doing what the workflow file says and the fix is to state the intent
explicitly. If the 12:42Z shape recurs without a successor, it is an Actions-side event and belongs
to Marco. **Station 04, the falsifying probe is the table in WHAT I MEASURED — rebuild it over 14
days, not 12 runs.**

### F3 — The watcher clone is 22 commits behind `origin/main`, with a dirty tracked file, while the queue is empty

The clone is where the watcher checks out every branch it builds. At `a31e86d5` it is holding
yesterday's `main` (2026-09-21 20:12Z), and `docs/data-model/metadata-catalog.json` is modified
there. Impact today is **latent, not active**: `armed (*-ready.md): 0`, so nothing is being built
from that stale base right now. It stops being latent the moment a prompt is armed.

I deliberately did not touch it. Reading it was read-only git; fixing it means `checkout`/`pull` in
`C:\po-watcher\ProjectOperations`, which is the absolute prohibition that cost the entire overnight
queue in LL-38, and which belongs to 03 regardless.

**DISPOSITION: DISPATCHED to Station 03 (Machine Minder)** — local trees and the watcher process are
03's lane. Two things to settle, and the second matters more than the first: **(a)** bring the clone
current and decide whether `metadata-catalog.json` there is a real local change or a generated-file
smudge; **(b)** answer whether a 22-commit-behind clone is *expected* between watcher restarts — the
clone's `origin/main` tracking ref is only fetched at watcher launch (§9.2), so "behind" may be the
designed steady state and the sweep's `<-- NOT clean-on-main; the watcher may refuse to start` may
be alarming about something normal. **Do not arm anything into that clone until (a) is done.**

### F4 — The PREFLIGHT git guard reported INERT (exit 2), as the contract says it will

Quoted in full under WHAT I MEASURED. The shim is byte-correct and not on the non-login shell's
PATH, so the device-bridge git ban was **remembered, not mechanical**, for the whole of this run.
Nothing was run that tested it.

**DISPOSITION: ACTIONED** — the obligation exit 2 creates is to quote it and to not run VM-side
`git` against the mount. Both were done: the installer's last line and its exit code are quoted
above, and every git command in this run was issued from the Windows PowerShell shell (PID 20936),
never through the device bridge.

### F5 — `[LIVE]` said the board had one PR; it now has none

#2080 was the only open PR, it was CLEAN and fully green, it carried no hold label, no watcher
verdict, and a published `VERDICT: MERGE`. It is merged and on `main`. **Zero PRs are DIRTY, because
zero PRs are open** — the station doc's Q1 answered honestly rather than by the usual route.

**DISPOSITION: ACTIONED** — merged via native auto-merge, read back on the trunk with `git ls-tree`
at `744abe54`, not from the PR page.

## WHAT I DID NOT DO

- **Did not restart, kill or touch the watcher.** It is RUNNING (pid 9744) with its wrapper alive and
  0 armed prompts. That is HEALTHY-and-idle, and "never restart on BUSY/idle" is the rule that once
  nearly killed a working queue.
- **Did not run `rescue-watcher-repo.ps1`.** The clone is on `main` with no `MERGE_HEAD`, no rebase
  and no unmerged paths — the NOT-corrupt reading. Running the rescue on a parked-but-clean repo is
  the destructive false alarm that rule exists to prevent.
- **Did not run any `git` write in the watcher clone**, and did not delete or stage `.codex/`,
  `AGENTS.md` or the other untracked files there. They belong to a lane I did not identify, and
  deleting another actor's untracked work is not recoverable.
- **Did not stage the `rates-11c-blocked-consumers` backlog item**, though the sweep tags it
  READY TO STAGE. Its own note says 11c must not merge until `pr-rates-11b2-c-parity-proof` has RUN
  and come back clean, and that proof has not run. Staging it now would put a destructive
  table-drop chain in front of an instrument that has never produced a verdict. **DEFERRED — it
  becomes actionable the moment the parity proof reports clean, and not before.**
- **Did not claim the trunk is green.** The rerun and the fresh push run were both still running when
  this was written. The claim made is narrower and is the one the evidence supports: no job on
  `49262485` FAILED.
- **Did not fix `status-sweep.ps1` (F1) in this PR.** A code change to the instrument every station
  opens with should not ride in on a breadcrumb sweep.
- **Did not touch Azure, Entra or SharePoint**, and did not write production data.
