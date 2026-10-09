# Station 00 — Supervisor | 2026-10-09T00:15Z–2026-10-09T00:4xZ

## For Marco

Nothing is on fire and nothing in this run needs you. The pipeline is reporting normally: all
four enabled stations have fresh breadcrumbs and `check-breadcrumb.mjs --freshness` exits 0
CLEAN. **#2267, the previous run's collect PR, is MERGED** (00:29:50Z, read back from GitHub),
so five station breadcrumbs that were sitting untracked now reach you on `main`. The dev tree
fast-forwarded cleanly afterwards.

Two items were deferred to this occurrence by the previous run and both are now done, in the PR
this breadcrumb rides in: **`pr-tipid-s3`'s dead first gate is repaired** (F2 — the prompt's
protection is unchanged and proved unchanged by `lint-prompt.mjs` before and after), and **one
provably dead escalation is retired** (F3).

**One PR is yours and unchanged: #2261**, labelled `do-not-merge`, CI 13 pass / 2 fail, open 46 h.
I removed no label and touched nothing on it.

**The three questions already open with you are NOT re-asked here** and are carried unchanged on
`main` in the breadcrumbs #2267 just landed: the `sot`-lane / breadcrumb-home conflict, the
"no station can tell a dead occurrence from a blind one" gap, and Station 04's three HOLDs held
only by your `do-not-arm` marker. Station 04's F2 options are in its own breadcrumb, now on
`main`, and I did not pre-clear any of them.

**New, and worth one line of your attention: `Merge-Pr` now fails on its first call for every
BEHIND PR** (F1). It is self-healing — the second call merges — but it has cost two consecutive
runs a thrown exception, and the previous run's response to it was to type `gh pr merge` by hand,
which DOCTRINE §1 names specifically. I did not repeat that. The fix is a retry inside the
primitive; it is a `scripts/pipeline/**` change and is staged as a finding, not pushed.

## GROUND

```
UTC            2026-10-09T00:15:00Z
origin/main    ffaeb1e2 at run start; ccda2d3f after this run merged #2267
dev tree       main @ 609a1602 at run start; main @ ccda2d3f after the fast-forward   C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree** (1 == 1), so this run was not restricted to read-only by the
version-mismatch clause. `DOCTRINE.md` (core, 508 lines), `docs/pipeline/stations/00-supervisor.md`
(454 lines) and `STATION-CAPABILITIES.md` (667 lines) were each read **in full** from
`git -C C:\ProjectOperations2 show origin/main:<path>` — in the **dev tree**, never the working
copy and never the watcher clone. **SIGHTED run**: Desktop Commander loaded and a PowerShell shell
on the Windows host answered on the first call. No `CONNECT_TIMEOUT`, no retry needed. This is not
a blind run.

## WHAT I MEASURED

**Device-bridge git guard — installed, INERT, exit 2.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit read from the
installer itself with **no pipeline appended**. Last line and exit:

```
   PATH="/sessions/epic-funny-curie/.local/bin:$PATH" git <args>
EXIT=2
```

Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` Its own controls printed `bash -lc 'command -v git'` →
`/sessions/epic-funny-curie/.local/bin/git` (the shim) and `bash -c 'command -v git'` →
`/usr/bin/git` (the real one). Exit 2 is the station doc's EXPECTED station outcome — a FINDING,
not a stop. **No `git` was run against the mount at any point this run**; every git call below
went through `powershell.exe` on the Windows host.

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` answered immediately;
`(Get-Date).ToUniversalTime()` → `2026-10-09T00:15:00Z`.

**status-sweep.ps1, run TWICE — once to build the picture, once immediately before mutating.**
[MEASURED] run 1 `SWEEP COMPLETE 2026-10-09 00:15:26Z`, 474 lines; run 2
`SWEEP COMPLETE 2026-10-09 00:20:41Z`. Section 0 positive controls PASSED in both
(`gh CAN reach GitHub (saw merged PR #2266)`, `node runs`) — **no `[BROKEN]`**. Both verdicts:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Run 2's gate inputs, which are what the verdict is computed from:
`git index.lock interactive/clone: False / False`; `git processes touching our trees (scoped): 0`;
`watcher build (heartbeat): no build in flight`; `board lease: free`;
`no PR touched on GitHub in the last 2 min`; `armed (*-ready.md): 0`.

⚠️ The sweep's streamed output returned early with output still pending (DOCTRINE §9.1) on run 1
and had to be drained with repeated explicit `read_process_output` calls; run 2 was redirected to
a file with `Start-Process -RedirectStandardOutput` instead, which sidesteps the trap entirely and
is the cheaper instrument. Recorded because the trap is live, not historical.

**Board state at run start.** [MEASURED] sweep section 1: 2 open PRs — **#2267** BEHIND,
`CI: 10 pass / 0 fail / 0 pending (green)`, **no labels**; **#2261** BEHIND,
`CI: 13 pass / 2 fail`, labelled `do-not-merge`, open 45 h. `main` CI on `ffaeb1e2`:
`4 success / 0 failed / 0 running (trunk green)`. `WAITING ON MARCO: 1`. Queue census:
`armed 0`, `needs-marco/ 54`, `no-pr-opened/ 111`, `failed/ 80`, `blocked/ 201`.
Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.

**COLLECT — every breadcrumb since my last run, read in full.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, **exit 0** (`FRESHNESS_EXIT=0`,
read with no pipeline appended):

```
  00  last 2026-10-08T23:07:00Z  1.2h ago  (cadence 1h + grace 0.5h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-08T23:06:00Z  1.2h ago  (cadence 24h + grace 3h)  ok
  04  last 2026-10-08T22:38:00Z  1.7h ago  (cadence 4h + grace 1h)  ok
  05  last 2026-10-08T22:38:00Z  1.7h ago  (cadence 24h + grace 3h)  ok
structure: 4 checked, 0 malformed, 0 skipped as pre-contract
```

So **`breadcrumb-clean`** is claimed on the authority of `check-breadcrumb.mjs` exit 0, with the
command quoted — not on `lint-prompt.mjs`, which was never run against a breadcrumb this run.
**No station is MISSED**, so FRESHNESS_ONE_CADENCE_V1's classification step did not arise and no
scheduled task was touched. The 41-hour outage the 22:38Z run headlined is over and stays over.

Breadcrumbs read in full this run: `00-00-supervisor-2026-10-08-2307-...` (722 lines, read from
`FETCH_HEAD:` on #2267's branch), `00-03-machine-minder-2026-10-08-2306-...` (509 lines),
`00-04-scanner-2026-10-08-2238-...` (385 lines). `00-03-...-2251-...` is cited rather than
re-derived: the 2306 run states it read 2251 in full and re-measured everything that moved, and
every 2251 finding it carries forward is dispositioned below.

**#2267 merged, through the sanctioned primitives, on the second call.** [MEASURED] in full:

```
LEASE_TAKEN=True                       Enter-BoardLease -Actor station-00.sched0015
ASSERT_SMOKED_OK=True True             Assert-SmokedOrEscalate -PR 2267
MERGE_PR_THREW: Merge-Pr: #2267 could not queue auto-merge after update-branch -- exit 1
  read back -> state=OPEN mss=BLOCKED head=b7fcbe8b   (branch updated; CI restarted)
  ... CI settles ...
  read back -> state=OPEN mss=CLEAN head=b7fcbe8b     SUCCESS=10 SKIPPED=5  (0 fail, 0 pending)
ASSERT_SMOKED_OK=True True             Assert-SmokedOrEscalate -PR 2267   (re-run)
MERGE_STATE=MERGED MERGE_PR=2267       Merge-Pr -PR 2267 -Actor station-00.sched0015
  read back -> state=MERGED mergedAt=2026-10-09T00:29:50Z
```

MERGED is claimed from the **post-merge GitHub read-back**, not from the primitive's return value
and not from a QUEUED state (UPDATE_AT_MERGE_TIME_V1). CP-26 did not require a receipt: every path
in #2267's diff is under `docs/`, so the diff-armed rule does not fire; its 10 checks were already
green on the pre-update head and green again on `b7fcbe8b`.

**#2267's classification before I merged it.** [INFERRED] from measured facts: it is Station 00's
own board PR (DOCTRINE §10.1 step 3, classified by STATION-CAPABILITIES §5's authority matrix, not
by `classifyPolicyFiles`), it carries **no** labels at all — so no `do-not-merge` — and its six
files are all under `docs/pr-prompts/`, inside 00's recorded `docs/` lane. Not watcher-routed, and
"not watcher-routed" was treated as necessary and **not** sufficient
(`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`).

**The dev tree fast-forwarded, and the three untracked breadcrumbs that would have refused it were
cleared SAFELY.** [MEASURED] #2267 landed five breadcrumb paths on `main` while the dev tree held
untracked copies of three of them — the exact trap 03's F8 and the station doc's fast-forward note
describe. Each local copy was hashed against `main` before anything was removed:

```
local=c9839f5d  main=c9839f5d  00-03-...-2251-....md   IDENTICAL -> removed (copied to scratch first)
local=e5ddeb89  main=e5ddeb89  00-03-...-2306-....md   IDENTICAL -> removed (copied to scratch first)
local=3bb4a1eb  main=3bb4a1eb  00-04-scanner-2026-10-08-2238-....md  IDENTICAL -> removed (ditto)
ABSENT_LOCALLY  00-00-supervisor-...-2307-....md   (written in its own PR worktree, never here)
ABSENT_LOCALLY  00-05-sot-keeper-...-2238-....md   (rehomed into #2267 by the previous run)
```

`git hash-object <abs>` vs `git rev-parse origin/main:<rel>` — the sound comparison forms, never a
piped `git show | git hash-object --stdin`, which §9.2 records as UNSOUND in `powershell.exe`. Each
file was copied to `C:\po-sup-fix-scripts\preserved-0015\` **before** removal, so nothing was
destroyed on a hash I had not checked. **No `git checkout -- <path>`, no `git clean`, no
`reset --hard`, no `stash pop`** (§9.2 — consumed prompts come back armed). Then:

```
pre-ff :  rev-list 0 2   numstat []   cached []   porcelain []
          git merge --ff-only origin/main  ->  Updating 609a1602..ccda2d3f  Fast-forward
          FF_EXIT=0   8 files changed, 2567 insertions(+), 16 deletions(-)
post-ff:  HEAD ccda2d3f   rev-list 0 0   numstat []   cached []   porcelain []
```

**All four readings clean, and the fourth is the one that matters** — the first three pass on a
dirty tree. Remaining untracked files in the dev tree are 36 pre-existing ones (`.codex/agents/*.toml`,
`AGENTS.md`, four `Claude Design/**` HTML files, 25 `docs/pr-reviews/pr-*-review.md`) — **not one
is a breadcrumb**, so no station report is stranded. `.codex/` and `AGENTS.md` are the sixth-layer
question already open with Marco
(`needs-marco/the-cowork-project-instruction-block-is-a-sixth-layer-escalated-to-nobody-2026-09-08.md`);
not re-raised.

**`pr-tipid-s3`'s first gate, before and after, with the verdict proved unchanged.** [MEASURED]
`node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md`
run in the isolated worktree, exit read with no pipeline appended — **byte-identical output before
and after the edit**, `LINT_BEFORE_EXIT=1` and `LINT_AFTER_EXIT=1`:

```
REJECT  pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md  [GATE_NOT_RELEASED]
   GATE_NOT_RELEASED: requires_on_main: "docs/audits/waste-map-location-backfill.md ::
   BACKFILL_UNMATCHED_ZERO" — the file ... is not on origin/main yet, so the needle is absent.
```

Note what the BEFORE run proves on its own: lint named the **second** gate, having walked straight
past the first — which is the measurement that the first gate was released, taken by the gate's own
enforcer rather than by my reading of the script. Post-edit controls on the file itself: the four
"three gates" claim patterns → **HITS=0**; POSITIVE control `TWO MACHINE GATES` → 1;
NEGATIVE control `SUP00Z0015NEEDLE`, minted this run → 0. Diff: `21 7` on one file.

**One escalation retired, on a reading I took myself.** [MEASURED]
`gh pr view 2260 --json number,state,mergedAt` → `state=MERGED mergedAt=2026-10-07T02:29:09Z`,
asked **individually** because a LIST response's `merged` field is unusable (§9.4). Sweep section 5
independently: `[STALE] pr-2260-review-fix.md references #2260 which is MERGED -- escalation is
DEAD, clear it.` Then `retire-escalation.mjs` with the four prescribed arguments, `RETIRE_EXIT=0`:

```
C:\po-wt\sup00-0015\docs\pipeline\discharges\2026-10-09-0032Z-pr-2260-review-fix.md
still in needs-marco?: False
in needs-marco/discharged/?: [pr-2260-review-fix.md]
```

**Nothing was deleted** — the file moved, and the discharge note is committed in this PR.

## WHAT CHANGED

Four mutations, each read back:

1. **#2267 MERGED** at 2026-10-09T00:29:50Z via `Assert-SmokedOrEscalate` → `Merge-Pr`. Read back
   from GitHub as `state=MERGED`. Five station breadcrumbs plus the #2265 CP-26 receipt and the
   restored `superseded/pr-gitpush-worktree-mandatory-HOLD.md` are now on `main`.
2. **The dev tree fast-forwarded** `609a1602` → `ccda2d3f`, `FF_EXIT=0`, all four readings clean
   afterwards. Three identical untracked breadcrumb copies were removed after hash-matching them
   against `main` and copying them to scratch.
3. **`docs/pr-prompts/pr-tipid-s3-...-HOLD.md` edited in this PR** — the dead first gate removed
   from `requires_on_main`, the gate table reduced to its two real rows, four prose claims of
   "three gates" corrected, and a dated `CORRECTION` block added naming the measurement and the
   actor. Lint verdict identical before and after.
4. **`docs/pr-prompts/needs-marco/pr-2260-review-fix.md` retired** to
   `needs-marco/discharged/` by `retire-escalation.mjs` (exit 0), with its discharge note
   committed in this PR.

**Nothing else.** No prompt was armed, disarmed or renamed (`armed = 0` on arrival and `armed = 0`
on exit, so the MARCO_QUEUE_LINE_V1 call did not arise). No label was added or removed. No `/sot/`
file was touched. No worktree was pruned. No watcher was stopped, started or restarted. No
scheduled task was created, edited, enabled, disabled or re-run. Nothing was committed to `main` in
the dev tree. No `git` ran against the mount.

The board lease was held as `station-00.sched0015` from 00:26:36Z, renewed at 00:29:43Z, and is
released at the end of this run; `arm-prompt.ps1` was never called, so the hold-past-arm rule did
not apply. Scratch files went to `C:\po-sup-fix-scripts\` (`sup00-0015-*.ps1`, `lint-tipid-*.txt`,
`preserved-0015\`), which is outside the repo and dirties nothing.

## FINDINGS

### F1 — `Merge-Pr` throws on its FIRST call for every BEHIND PR, and the throw is what tempted the previous run into a hand-merge

[MEASURED] this run: `Merge-Pr -PR 2267` threw
`could not queue auto-merge after update-branch -- exit 1`. It had done its UPDATE_AT_MERGE_TIME_V1
job correctly — the BEHIND branch was updated and the head moved to `b7fcbe8b` — and then its
`gh pr merge --squash --auto` call returned exit 1, because updating the branch had just started a
fresh CI run and the queue attempt raced it. [MEASURED] the previous run hit the **identical**
failure on #2265 and recorded it in its own F13; that is two consecutive occurrences, both on a
BEHIND PR, both with the branch update succeeding and only the queue step failing.

**Why it matters more than an exception.** The previous run's response was to run
`gh pr merge 2265 --squash --auto` by hand to capture its stderr, and that hand call took effect —
a mutation obtained outside the primitive, with none of `Merge-Pr`'s read-back. DOCTRINE §1 names
that command specifically. **A primitive that throws on its own happy path trains its callers out
of using it**, which is the §7 failure wearing different clothes: the instrument is not wrong about
the board, it is wrong about itself, and the cost lands on discipline rather than on data.

**What I did instead, and it worked:** waited for CI to settle on the new head, re-read it
(`mss=CLEAN`, `SUCCESS=10 SKIPPED=5`, 0 fail, 0 pending), re-ran `Assert-SmokedOrEscalate`, then
re-ran `Merge-Pr`, which returned `MERGED` on the second call. **No command was typed by hand.**

**DISPOSITION: DEFERRED** — to a `scripts/pipeline/**` PR of its own, which puts it on
`instrument-lane.json` territory and wants a test. RULE 1:

- **Complete and additive (recommended):** after a successful `update-branch`, have `Merge-Pr`
  poll the PR's checks until they are no longer pending and then attempt the queue, returning
  `QUEUED` or `MERGED` as it does today, and throwing only if the queue is refused on a settled
  head. *Complete*: it removes the throw for every BEHIND PR now and in future, and the
  caller-side workaround — wait, re-read, re-run — stops being something each station rediscovers.
  *Additive*: it adds a wait to a path that currently throws; no PR, label, lane, receipt or queue
  file changes meaning, and the CLEAN-PR path is untouched. **Passes both halves.**
- *Alternative A:* retry the queue call N times with a fixed backoff and no check-reading. Fails
  the **complete** half — it is a guess at a duration, and on a slow CI run it still throws.
- *Alternative B:* document the two-call pattern in the station doc and leave the primitive alone.
  Fails the **complete** half outright: that is effectively today's state, and today's state
  produced a hand-merge one run ago.

🔴 **Falsifying probe: the next BEHIND PR merged through `Merge-Pr`.** If the first call returns
`QUEUED` or `MERGED` without throwing, this finding is wrong and the two occurrences were a CI-load
coincidence. **It is NOT urgent**: the second call works, and a CLEAN PR never enters this path.

### F2 — 04's F1, carried and DEFERRED to this run by 00's 23:07Z run: `pr-tipid-s3`'s first machine gate is repaired

The prompt declared three `requires_on_main` gates and had two. Gate 1,
`scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH`, named the script's own
human-readable **failure label** — the string `renderReceipt` prints for a row whose status is
`NO_MATCH`, `NO_FACILITY_CELL` or `AMBIGUOUS` — so it was true from the moment the script landed
and could never shut. [MEASURED] independently by lint itself: the BEFORE run walked past gate 1
and rejected on gate 2, which is the gate enforcer measuring gate 1 as released.

**Repaired by REMOVAL, not by re-pointing, and here is the argument.** The gate table recorded
gate 1's intent as *"the predecessor exists at all"*. That is already **strictly implied** by the
remaining first gate: `docs/audits/waste-map-location-backfill.md` can only be on `main` if that
very script has run. So gate 1 was logically redundant even when correct. Re-pointing it was
considered and rejected on a measurement: `lint-prompt.mjs` treats a `requires_file_on_main` (or
needle-less `requires_on_main`) path that is **already present** on `origin/main` as a dead gate
and has its own code for it, so converting gate 1 to a bare existence gate risked **changing the
verdict** — the one outcome a gate repair on a destructive prompt must not do. Removal cannot: the
rejection comes from gate 2, which is untouched.

**The protection is unchanged, and that is measured rather than asserted.** Lint returned
`REJECT [GATE_NOT_RELEASED]` naming `docs/audits/waste-map-location-backfill.md` both before and
after, exit 1 both times. The prompt stays genuinely held: both remaining gates name files ABSENT
from `main`. The human layer remains released (Marco, 2026-09-24) and I did not touch it.

RULE 1 on the repair itself: *complete* — the false "three enforced gates" claim is gone from the
front matter and from all four prose instances, with a dated `CORRECTION` block naming the
measurement and the actor, so the next reader is not re-deriving it; *additive* — no data, no code,
no arming, no verdict change, and the prompt's two real gates are byte-identical.

**DISPOSITION: ACTIONED** — in this PR, verified by the before/after lint pair with its own
positive and negative controls, and by `HITS=0` on the four claim patterns.

⚠️ **One residual, named rather than guessed.** If Marco intended a third *distinct* precondition
that gate 1 was a botched expression of, that intent is not recoverable from the repo — the gate
table's own stated reason is the one I have honoured. Flagged here, not escalated: the prompt is
held by two real gates either way, and inventing a third gate is exactly the guess §5 stop 5
forbids.

### F3 — 03's F9 / the sweep's single `[STALE]` row: one escalation was provably dead and is retired

[MEASURED] `gh pr view 2260` individually → `state=MERGED mergedAt=2026-10-07T02:29:09Z`.
`retire-escalation.mjs --file ... --actor station-00.sched0015 --evidence ... --record-into
C:\po-wt\sup00-0015` → exit 0; the file is gone from `needs-marco/` and present in
`needs-marco/discharged/`; the discharge note
`docs/pipeline/discharges/2026-10-09-0032Z-pr-2260-review-fix.md` is committed in this PR.
Nothing deleted. The previous run deferred this precisely because it would not retire an
escalation on a reading it had not taken itself; I took the reading.

**DISPOSITION: ACTIONED.** Note for the next COLLECT: every other `needs-marco/` line in sweep
section 5 is `[FILE] "cites N MERGED PRs as evidence -- not its premise"`, which the sweep itself
says **does not clear anything**. 53 escalations remain and none of them is cleared by this run.

### F4 — 03's F2/F3 (the `Get-CimInstance` crash loop and its missing reporter), carried forward unchanged

Seven `WATCHER-CRASH-LOOP` escalations between 2026-10-03T16:37+10:00 and 2026-10-06T06:14+10:00
share one named cause: an unguarded `Get-CimInstance` at `scripts/pr-watcher/start-watcher.ps1:137`
turns a transient WMI condition into a fatal child exit, and five identical child failures stop the
supervisor. And the component that writes those escalations, `supervise-watcher.ps1`, is not in the
live chain — so the next crash loop produces silence.

**DISPOSITION: DEFERRED, unchanged from the previous run's (a), and I am not re-deciding it.**
The reasons are measured and still hold: `scripts/pr-watcher/**` is the one path §9.5 says requires
a **watcher restart** before the running `index.mjs` picks it up, and 03 measured the watcher
healthy with its three generations on the same PIDs across sixteen minutes. The route is a prompt
through the normal lane. **I did not stage it this run** and I will say why plainly rather than
imply I ran out of lane: a prompt that edits the watcher's launch path and then needs a restart is
a construction order I would be authoring unattended, and DOCTRINE §10.4 says design decisions are
settled before the prompt, not inside it — the null-vs-empty distinction 03 itself flagged
(`-ErrorAction SilentlyContinue` alone turns "WMI is down" into "no node is running", inviting a
duplicate launch) is exactly such a decision. **It becomes urgent on the next crash-loop
escalation — and F4's second half is why that escalation may never arrive.** The silence half is
already ESCALATED to Marco inside the previous run's Question 2, now on `main`.

### F5 — 03's F8 / the fast-forward trap: ACTIONED, and the cure is cheaper than the station doc's

Three untracked breadcrumbs sat in the dev tree at paths #2267 was about to land on `main`. The
station doc's documented cure is to restore blocking paths byte-exactly from `HEAD` with a
raw-Buffer node write. **For an UNTRACKED copy of a file that is about to become tracked, a simpler
and strictly safer move exists**: hash the local copy against `origin/main`, and if the hashes
match, the local copy carries no information `main` does not already have, so removing it loses
nothing. [MEASURED] all three matched (`c9839f5d`, `e5ddeb89`, `3bb4a1eb`), each was copied to
scratch before removal, and `git merge --ff-only` then returned `FF_EXIT=0` with all four
post-readings clean.

**DISPOSITION: ACTIONED** — and recorded as a method, not just an outcome: the hash comparison is
what makes the removal safe, and the `DIFFERS -> left in place, NOT removed` branch was written
into the script before it ran so that a mismatch could not be swept away by momentum.

### F6 — 04's F4: `triage-holds.ps1` cries SUSPECT on every correctly-gated board

Carried from 04's F4 and the previous run's F5. Not re-measured this run — 04 owns the rotation
that measures it and its measurement is on `main` now.
**DISPOSITION: DEFERRED**, unchanged: a `scripts/pipeline/**` change wanting its own PR and a test.
04's narrowing is the right one (suppress the banner when both positive controls PASSED **and** the
single bucket holds more than one distinct reject code). It costs nothing per run beyond a
misleading line that two breadcrumbs now contradict in writing.

### F7 — 04's F2: three HOLDs held ONLY by Marco's `do-not-arm` marker

`pr-queue-layout-sot-entry`, `pr-scopecards-s8b-azure-maps-travel`,
`pr-sec-a2-email-codes-and-reset-links`. Their dependency gates have all released on `main`; the
human marker is the only remaining protection.
**DISPOSITION: ESCALATED — already, by 04, in its own words, and that breadcrumb is now on `main`
where Marco reads it.** I deliberately did **not** re-ask it in my own words and did **not**
pre-clear any marker: removing a `do-not-arm` marker is a human act by construction, and arming
these is the decision the marker exists to reserve. The channel that closes is 04's breadcrumb
reaching him, which merging #2267 is what accomplished.

### F8 — 03's F6 / the previous run's F6: orphan worktrees are at 31, two holding work `--force` would destroy

[MEASURED] sweep section 2 this run: `non-main worktrees found: 31`, plus
`worktree-registry-escapees: 2`. `C:/po-wt/fv2drop` holds **21 commits on no remote branch**;
`C:/po-worktrees/sup-cwd-paths` holds 4 commits **plus 2 uncommitted files**;
`C:/po-worktrees/marco-queue-line` 1 commit + 1 dirty file;
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` 1 commit + 1 uncommitted file.
**DISPOSITION: DEFERRED**, unchanged and for the same reason: §5 stop 4 requires the verification
step to **complete before** the destructive one, never alongside it, and the verification is
per-worktree (`gh pr list --head <branch> --state merged`, then
`git -C <path> status --porcelain` to list and preserve). ⚠️ **I added one worktree of my own this
run** (`C:\po-wt\sup00-0015`) and it is torn down below, so this run does not add to the pile. The
trend — 27 → 32 → 31 across five days, one per station run — is the thing worth watching, and the
cause is that every run leaves its worktree behind.

### F9 — the device-bridge git guard is INERT (exit 2): the ban is remembered, not mechanical

[MEASURED] quoted verbatim above, exit read from the installer with no pipeline appended. All four
stations reporting in the last 24 hours (00 ×2, 03 ×2, 04) measured exit 2 independently.
**DISPOSITION: DEFERRED** — the station doc declares exit 2 the EXPECTED station outcome and
explicitly refuses to widen the stop contract for it, because turning an inert shell script into a
frozen board is the outcome the guard exists to prevent. Recorded, obeyed, not repaired. It becomes
urgent if the exit code changes: **non-zero other than 2** means the shim was never written; **0**
means the protection became mechanical and every station doc's "remembered, not mechanical" wording
is then itself the stale instruction.

### F10 — 03's F7 and the previous run's F9/F10, re-measured: no new ask

The cron burst, Station 03's two runs inside sixteen minutes against a `0 9 * * *` cron, and 03's
bootstrap claiming a 4-hour cadence — all already open with Marco in the scheduled-tasks layer,
which no station may edit. This run adds one datum: **the catch-up burst has drained.**
`--freshness` shows all four stations inside one cadence with no doubled fire, so the post-outage
burst 03 measured is over.
**DISPOSITION: DEFERRED** — no new ask, and deliberately not re-raised as one.

### F11 — the backlog's one READY item is `rates-11c-blocked-consumers`, and arming is NOT what it needs

[MEASURED] sweep section 6: `ready=1 needs-marco=2 blocked=4 broken=0`; the ready item is
`[P2] rates-11c-blocked-consumers`. [MEASURED] its own registry note says its slices are **already
staged** and the item stays registered until its gate dies, which happens only once the consumers
are migrated and the legacy models are gone. [MEASURED] `armed (*-ready.md): 0` and 04's
`triage-holds.ps1` reading this cycle: `spent=0 of 13  gates-satisfied=0  still-gated=13` — so
**there is nothing armable on this board**, and the MARCO_QUEUE_LINE_V1 figures are
`WAITING ON MARCO: 1 open PR (#2261, oldest, open 45h)` and `ALL OPEN (non-draft): 2`.
**DISPOSITION: DEFERRED** — a registered backlog item whose gate is deliberately still alive is not
an arming decision. Arming anything here would mean arming one of the three HOLDs in F7, which is
Marco's marker to remove.

### F12 — the previous run's F11 (`failed/` entries from a revoked token) is still correctly a no-op, and I did not "confirm and move" it either

The previous run established that two of the three are auto-generated watcher **review jobs**
(`rev-<n>-ready.md`, no front matter by design — §9.5), so restaging one is not a repair, and that
`pr-doctrine-core-and-reference` **looks** spent on an `[INFERRED]` reading. It declined to move the
file on an inference and asked the next run to name the PR that landed the split and then move the
file with that PR named inside it.
**DISPOSITION: DEFERRED** — and I am naming why rather than quietly dropping it: naming that PR
means a `gh` search over merged PRs touching `docs/pipeline/DOCTRINE-REFERENCE.md`, which I did not
run this run, and moving a prompt on an inference is precisely the mistake the previous run's F2
exists to record. [MEASURED] `failed/` holds 80 files and the newest `LastWriteTimeUtc` across all
of them is `2026-10-06 05:47:39Z` (sweep section 4B), so **nothing in it is new** and nothing is
degrading while this waits.

## WHAT I DID NOT DO

- **Did not touch #2261.** Open, BEHIND, `CI: 13 pass / 2 fail`, labelled `do-not-merge`, open 45 h.
  Station 00 never merges a PR carrying that label and never removes it — **only Marco removes it**.
  I did not update its branch either: §8.3's UPDATE_AT_MERGE_TIME_V1 says never call
  `gh pr update-branch` on a PR you are not about to merge, because every stray update costs a full
  CI rebuild. Its two reds were diagnosed by the 2026-10-07 runs as the `do-not-merge` label working
  (CP-26 refusing a labelled PR), not a regression, and nothing this run changes that.
- **Did not arm, disarm, rename or move any prompt in the queue root.** `armed = 0` on arrival and
  on exit. The only queue-root file this PR touches is `pr-tipid-s3-...-HOLD.md`, whose **filename
  is unchanged** — editing a HOLD's gating is not arming, and §10.5 keeps an artifact's identity
  across its whole life.
- **Did not remove or add any label, on any PR.**
- **Did not pre-clear a `do-not-arm` marker** (F7) or re-ask 04's question in my own words.
- **Did not stage the watcher `Get-CimInstance` prompt** (F4), and said above why rather than
  implying I ran out of time: it carries an unsettled design decision, and §10.4 puts that before
  the prompt, not inside it.
- **Did not touch `/sot/`.** Station 05's lane only. No `sot/` path appears in this PR's diff —
  which also keeps this PR inside 00's `docs/` lane and clear of the `sot`-lane trap the previous
  run measured as `STANDING_OUTSIDE_LANE`.
- **Did not prune any worktree other than my own**, including the two registry escapees (F8).
- **Did not pop, drop or clear any of the watcher clone's 86 stashes**, and did not run
  `checkout`, `commit`, `push`, `stash` or `clean` anywhere under `C:\po-watcher\`.
- **Did not restart, stop or probe the watcher for liveness beyond the sweep's own reading**, and
  did not dispatch a restart. Machines are 03's lane; 03 measured 14 commits of clone drift with
  **0** files under `scripts/pr-watcher/`, so §9.5's restart rule does not fire.
- **Did not run `git` against the mount**, in any form, the guard being inert (F9). Every git
  reading in this report came from `powershell.exe` on the Windows host.
- **Did not type `gh pr merge`, `gh pr update-branch`, or any raw `git merge` against a PR.** Every
  board mutation went through `Assert-SmokedOrEscalate` → `Merge-Pr`. When `Merge-Pr` threw I
  waited and re-ran it (F1) — the previous run's slip is exactly what I was avoiding.
- **Did not use `git checkout -- <path>`, `git clean`, `reset --hard` or `stash pop`** anywhere
  (§9.2). The three breadcrumb removals were hash-matched, scratch-copied, named deletions.
- **Did not create, edit, enable, disable or re-run any scheduled task.** `--freshness` was CLEAN,
  so no MISSED reading arose — and a MISSED reading would not have authorised it anyway.
- **Did not clear any lock.** None existed: `index.lock interactive/clone: False / False`, and no
  `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / rebase-merge / rebase-apply / sequencer in
  either tree per the sweep.
- **Did not retire any `needs-marco/` file except `pr-2260-review-fix.md`** (F3), and did not
  append to any file under `needs-marco/` — 6 of 61 files in that gitignored folder are tracked in
  fact, and an append there can ride into another actor's commit.
- **Did not write to any of the five gitignored `docs/qa/` sinks**, and did not write this report to
  the session's `outputs` folder. It is at a tracked path **inside this run's own PR** (Cure 1), so
  no later sweep is needed to rescue it.
- **Did not touch Azure, Entra, SharePoint, production data, or any secret.** Absolute, every
  station, every run.
