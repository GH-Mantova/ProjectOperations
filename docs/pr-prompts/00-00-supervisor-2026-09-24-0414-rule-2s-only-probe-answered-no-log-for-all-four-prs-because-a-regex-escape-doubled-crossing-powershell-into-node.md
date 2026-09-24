# Station 00 — Supervisor | 2026-09-24T04:14Z–2026-09-24T04:45Z

## GROUND

```
UTC            2026-09-24T04:14Z
origin/main    45bbffbc              (fetched, then rev-parse)
dev tree       main @ 45bbffbc       C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`). This run was not read-only-by-mismatch and acted in
full authority.

**Sighted run.** `start_process` shell `powershell.exe` answered on the first call after the
`ToolSearch` schema load — `git rev-parse --abbrev-ref HEAD` → `main`, `git log -1` → `45bbffbc`,
`Get-Date` → `2026-09-24 14:14` local. Nothing below is a GitHub-side substitute for a dev-tree read.

**Which tree I read the binding documents in.** The dev tree, `C:\ProjectOperations2`. PREFLIGHT
step 2's *"read from `origin/main`"* is satisfied by measurement rather than by transport:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** and `git rev-list --left-right --count
HEAD...origin/main` returned `0	0`. [MEASURED] All three working copies are byte-identical to
`origin/main`. No piped `hash-object` comparison was made (§9.1 — unsound in PowerShell).

---

## WHAT I MEASURED

**vm-git-guard installer.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` Last line, verbatim:

```
   PATH="/sessions/hopeful-vibrant-fermat/.local/bin:$PATH" git <args>
```

**EXIT CODE = 2**, read from the installer itself and not from a pipeline appended to it. [MEASURED]
The expected middle outcome for a station: the device-bridge git ban is REMEMBERED this run, not
mechanical. No `git` ran through the device bridge against a mounted `.git` at any point — every
`git` below ran in a PowerShell shell on the Windows host.

**status-sweep.ps1.** `exit 0`, 403 lines, generated `2026-09-24 04:15:45Z`. The call outran the
180 s MCP cap; per §9.1 I treated the timeout as a claim to falsify and **drained the buffer with
explicit offsets** — `BYTES=69460`, `LINES=404`, `✅ Process completed with exit code 0 (runtime:
234.58s)` were all sitting in it. **Captured by writing the child's stdout from node, not with `>` or
`*>`** (§9.3 — both write UTF-16LE in PS 5.1), so no decode step was needed and none could go wrong.

- Section 0 positive controls: `gh CAN reach GitHub (saw merged PR #2150)`, `node runs`. **Both PASS.**
- §7 VERDICT: **`SAFE TO ACT`** — no board mutation in progress, no recent remote activity, no live
  station worktrees. Re-measured before the one board mutation; see the single-actor block below.
- Board: 4 open PRs (#2148 #2135 #2131 #2127), **0 DIRTY**. Queue: `armed: 0` · needs-marco 47 ·
  no-pr-opened 111 · failed 59 · blocked 150. Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.
- Watcher: `node RUNNING pid 38776`, wrapper alive (1), heartbeat 67 min, no non-main worktrees, no
  registry escapees, `index.lock` absent in **both** trees, 0 git processes touching our trees.
- Section 5 produced **zero `[STALE]` rows** this run — the 03:24Z run's F4 discharge took. Its one
  `[LIVE]` row reads `pr-2135-review-fix.md references #2135 = OPEN — genuinely open`. **Nothing to
  clear**, which is the falsifying probe for that discharge passing.

**COLLECT — `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.** Crossed
against `lastRunAt` from the scheduled-tasks MCP, which is a different instrument and the only one
that can separate *did not fire* from *ran and did not report*:

| station | `--freshness` | `lastRunAt` (MCP) | newest breadcrumb | reading |
|---|---|---|---|---|
| 00 | `0.9h ago (cadence 1h) ok` | `04:14:04Z` (this run) | 03:24Z | aligned |
| 03 | `5.3h ago (cadence 24h) ok` | `2026-09-23T23:02:54Z` | 23:04Z | aligned |
| 04 | `2.2h ago (cadence 4h) ok` | `2026-09-24T02:09:41Z` | 02:10Z | aligned |
| 05 | `14.0h ago (cadence 24h) ok` | `2026-09-23T14:22:41Z` | 14:23Z | aligned |

**No station is SILENT, none missed an occurrence, and none is mid-run-with-no-breadcrumb.** Cadence
read live from the MCP, never from a document: `00` `5 * * * *`, `03` `0 9 * * *`, `04` `0 */4 * * *`,
`05` `10 0 * * *`. `weekly-security-audit` remains `enabled: false`, unchanged.

**Breadcrumbs since my last run.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
(trailing slash AND `-r`, §9.2), matched by basename — asked of `origin/main` and never of the dev
tree's index (§9.5, `TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`). Exactly **one** breadcrumb sits at
depth 1: my own `…-0324-…`, tracked, landed by `#2150`. **03, 04 and 05 all reported BEFORE it**
(23:04Z, 02:10Z, 14:23Z) and the 03:24Z run dispositioned them. **There is no uncollected finding
this run** — and I did not re-disposition a closed one, which is the failure the archive exists to
prevent.

Open dispositions carried from 03:24Z, unchanged and not re-opened here: **F2 DISPATCHED → Station 06**
(add the `scope:`-names-its-own-file REJECT to `lint-prompt.mjs`), **F3 ESCALATED** (every PR is
Marco's), **F6/F7 DEFERRED** with their urgency conditions stated.

---

### The lane probe, and the instrument failure inside it

**§10.1 step 1, prompt logs only, `rev-*` excluded, pinned to `C:\ProjectOperations2\docs\pr-prompts\
processed` and never the clone's decoy (§9.5).** 948 `pr-*.log`.

🔴 **My first pass answered `hits=0` for ALL FOUR PRs while its positive control passed.** The cause
is a regex escape doubling as it crossed a PowerShell double-quoted layer into `node -e`; the full
measurement, both control pairs and the cure are in **F1**, and the bullet is landed in DOCTRINE §9.1
in this run's PR. Re-run backslash-free, the probe reproduces the 03:24Z run's numbers exactly:

| PR | hits | verdict line, verbatim | lane |
|---|---|---|---|
| #2148 | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true — PR already carries \`do-not-merge\` — no duplicate apply"}` | **Marco's** — RULE 2 *and* the label |
| #2135 | 1 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .claude/hooks/guard.mjs"}` | **Marco's** — RULE 2 |
| #2127 | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}` | **Marco's** — RULE 2 |
| #2131 | **0** | — | **`[NO LANE VERDICT — hand-classified]`** |

Controls on the working form: POSITIVE `marco.:true` → **706**; POSITIVE `PR #2147` and `PR #2150` —
board PRs the watcher did **not** open → **0 / 0 each**, which is the control §9.5 specifically asks
for, proving `NO LOG` means *second lane* and not *probe broken*; NEGATIVE, a freshly minted needle →
**0**. ⚠️ That needle is spent the moment this file lands (§9.6) and is not repeated here.

**#2131 hand-classified under §10.1 step 2.** Files, read live: `docs/pipeline/SCRIPT-REGISTRY.md`,
`docs/pipeline/stations/00-supervisor.md`, **`scripts/pipeline/why-blocked.ps1`**. `classifyPolicyFiles`
refuses the first path that is not test-or-docs; that third path is outside all three `NESTED_TEST_PATHS`
forms and outside 00's recorded `docs/` lane, so step 3's station-lane exception does not reach it.
**Marco's.** *"Not watcher-routed" is a necessary condition, never a sufficient one*
(`STATION-CAPABILITIES.md` §5, `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`).

**So all four open PRs are Marco's, by two independent routes between them, and there was no merge
available to this station.** Seventh consecutive run.

**#2148's reds, read as verdict tokens rather than as counts (§9.4).** `gh pr checks 2148` → **13
pass / 2 fail**. Both failures are the CP-26 pair — the required check and the same check running as
a step inside `PR gates — diff checks` — and the verdict was read from **column 3** of the job log
(§9.1 — column 1 is the job name and greps every line):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` is **parked by design, not work**. Controls on that read: POSITIVE `approval` in
column 3 → 6 lines; NEGATIVE, a minted needle → 0.

🟢 **And `Pipeline — watcher + linter tests` now reads `pass` on #2148.** It was the third red at
03:1xZ. The 03:24Z run's F1 renamed the PR from its prompt's `cluster:` to its `module:`; this run
confirms the fix held through a fresh run (`35951851951`) rather than taking the predecessor's word.

**Trunk.** `main CI on 45bbffbc: 4 success / 0 failed` (trunk green). The one non-trunk run excluded
from the verdict is `Pipeline heartbeat`, 0 failing — the scoped verdict `#1852` landed, working.

**Single-actor gate, re-measured immediately before acting** (`[LIVE]` means true when measured, not
true now):

```
NOW=2026-09-24T04:21:45Z
lock_dev=False  lock_clone=False
git_processes_touching_our_trees=0
open PRs last updated 03:32:07Z / 03:32:11Z / 03:32:14Z / 03:32:17Z  — 49 min ago
```

All four last touched within ten seconds of each other at 03:32Z — `#2150` merging at 03:30Z plus the
~100 s branch auto-update the 02:14Z run's F4 already measured. **Not a second actor.** No local lock,
no git process, no board activity inside two minutes. Condition 3 **SATISFIED** at the moment of acting.

---

## WHAT CHANGED

**1. Landed a new §9.1 instrument bullet: `NODE_E_REGEX_BACKSLASH_DOUBLES_THROUGH_POWERSHELL_V1`.**
Edited with node by **concatenation**, never a replacement string (§9.3 — `String.replace` reads `$`
in a replacement as a substitution pattern), and written from a `.mjs` file on disk rather than a
`node -e` one-liner, which is the bullet's own second cure. Read back:
`ANCHOR_OCCURRENCES=1` · `bytes 219311 → 223526` · `ACTUAL_DELTA=4215` · `EXPECTED_DELTA=4215` ·
`DELTA_MATCHES=true` · `MARKER_PRESENT=1` · `ANCHOR_STILL_PRESENT=1` · `git diff --numstat` → `53 0`.
The byte delta was asserted, so nothing spilled and nothing was deleted.

**Encoding read back, both directions.** `REPLACEMENT_CHARS=0` in the result, and the `â€`
double-encoding signature reads **2 in my result and 2 in `git show origin/main:docs/pipeline/DOCTRINE.md`**
— pre-existing, and both are §9.3 *quoting* the signature as documentation. **I introduced zero.**
That check exists because the same probe pointed at §9 measures the documentation (§9.6's closing rule).

**2. Re-recorded the canonical hash, deliberately.** §9 sits inside `CANONICAL-BLOCK: instruments v2`,
which `lint-station.mjs` fails on any unrecorded edit. `node scripts/pipeline/lint-station.mjs
--write-canonical`, exit 0: `instruments v2 0975b1dd56b1ee8b → 9831c31ff3ea8fa5`. **`station-contract`
v5 `81ddf31ac807132b` is UNCHANGED** — I did not touch that block, so the seven-doc ship its comment
requires is **not** triggered and this stays a two-file docs change.

**3. Archived the collected breadcrumb.** The 03:24Z breadcrumb was confirmed **tracked**
(`git ls-files --error-unmatch` exit 0) and `git mv`-ed to `archive/` inside this PR's worktree, every
finding in it already carrying a disposition. `R` in `git status --porcelain`, so the rename is staged
as a rename and not as an add+delete.

**4. This breadcrumb was written INSIDE the PR worktree (Cure 1).** No loose copy exists in the dev
tree, so the post-merge fast-forward cannot be blocked by it and no delete/restore dance is needed.

**Dev tree state throughout: `git diff --cached --name-status` EMPTY before any commit** — nothing of
another chat's was staged (§9.2, the shared-index rule). Nothing was committed on `main`.

**Nothing armed. Nothing merged. No label added or removed. No `/sot/` edit. No branch deleted.**

---

## FINDINGS

### F1 — RULE 2's only live probe answered `NO LOG` for all four open PRs, because a `\b` doubled crossing PowerShell into `node -e` — and BOTH prescribed controls passed while it did. Landed in DOCTRINE §9.1.

This is the finding of the run, and it is a near-miss rather than a defect I inherited.

The §10.1 step 1 lane probe is, in that section's own words, RULE 2's *"exactly one live probe"*. I
ran it as a `node -e` one-liner carried inside a PowerShell double-quoted string, building the word
boundary with a shell-escaped `\b`. It returned:

| form | #2148 | #2135 | #2131 | #2127 | POSITIVE control | NEGATIVE control |
|---|---|---|---|---|---|---|
| a `RegExp` built with a shell-escaped `\b` — **the failing form** | **0** | **0** | 0 | **0** | `marco.:true` → **706**, PASSES | a `\b`-bearing needle → 0 |
| `indexOf` plus an explicit next-character digit guard — **the cure** | **2** | **1** | 0 | **2** | `PR #2147` / `PR #2150` → **0 / 0** | a backslash-free minted needle → 0 |

**Mechanism.** PowerShell double quotes expand `$` and backticks and leave `\` **alone**. Escaping
*"for the shell"* therefore doubles the escape: node receives the four backslashes verbatim as JS
source, the string literal evaluates to two, and `new RegExp` compiles a **literal backslash followed
by `b`** — a sequence that occurs in no log this pipeline writes. Exit 0, nothing warns, nothing is
empty in a way §9.6 can see.

🔴 **What believing it would have cost.** Three of those four PRs carry a live watcher `marco:true`
verdict. Read through the failing form all four answer `NO LOG`, whose prescribed reading in §10.1
step 2 is *"it did not come through the watcher."* **Three live Marco routings would have been
hand-classified as second lane, on a board where this station may merge.** §10.1 names this shape
itself: *"§9.6 with a merge button attached."* Here it was reached through the **needle**, not
through the corpus.

🔴 **The control pair is structurally blind to it, which is why this earns a bullet rather than a
note.** The positive control that passed, `marco.:true`, contains no backslash — it certifies the
corpus and the reader and says nothing whatever about the escape. The negative control shape this
document prescribes everywhere carries the same `\b` and so returns 0 for the wrong reason. **Both
controls passed while every real query was broken.** What caught it was the *uniform zero across a
heterogeneous set* — §9.4's own named signature — and the fact that the 03:24Z run had measured
non-zero hits on the same corpus an hour earlier.

🔧 **The cure is free and is stated positively: put no backslash in a needle that crosses a PowerShell
layer into `node -e`.** Use `indexOf` plus an explicit next-character guard, which is what the `\b`
was for; if a regex is genuinely required, build the boundary from a character class, or write the
script to a `.mjs` file and run it from disk so no shell layer touches the source. The generalised
half is the one that matters beyond this probe: **a control must carry the same escape as the query
it certifies.**

**DISPOSITION: ACTIONED** — bullet landed in DOCTRINE §9.1 in this run's PR, immediately after the
single-quoted-Windows-path bullet it is most likely to be confused with, and explicitly distinguished
from it. Byte delta asserted. Canonical hash re-recorded. Falsifying probe written into the bullet:
re-run both forms over `processed/pr-*.log` for a PR known to carry a watcher verdict; a non-zero
count from the escaped form kills it.

---

### F2 — Every open PR is Marco's for the seventh consecutive run, and the queue behind them is genuinely empty rather than merely quiet.

Three live `marco:true` verdicts plus one hand-classification onto `scripts/pipeline/why-blocked.ps1`.
There is no merge this station may perform, and there is nothing armable behind them: `armed: 0`, and
the only gate-satisfied HOLD remains `pr-fv2-formrule-contract-HOLD.md`, which the station doc carries
on the standing **never-arm** list by name. The ADMIT count that matters for arming is **zero**, and
that is a property of the never-arm list rather than of the board.

The backlog's only `READY TO STAGE` item, `rates-11c-blocked-consumers`, is unchanged: a chain whose
own gate stays alive until its consumers merge, and which must not merge before the parity proof has
RUN clean. Staging it ahead of four PRs already parked on Marco lengthens the queue without shortening
anything.

**DISPOSITION: ESCALATED** — carried unchanged to the existing standing file. One question, in
FOR MARCO below. **I filed no new escalation for it**, because a seventh copy of a standing question
is noise, and `needs-marco/` is at 47.

---

### F3 — The 03:24Z discharge of `pr-2142-review-fix.md` held, proved by that finding's own falsifying probe.

F4 of the 03:24Z run moved a `[STALE]`-tagged escalation to `needs-marco/discharged/` and wrote:
*"Falsifying probe: re-run the sweep and read §5; if the name is still tagged, the move did not take."*

[MEASURED] This run's sweep §5 produced **zero `[STALE]` rows** and the name does not appear. The
`needs-marco/` count fell 48 → 47, which is the same move seen from the other side.

**DISPOSITION: ACTIONED** — nothing to do; recorded because a discharge into a gitignored folder
reaches nobody on its own, and because a falsifying probe nobody runs is a comment (§9.5's own lesson
about the trunk row that sat stale for thirteen days).

---

### F4 — Station 04's `clone dirty=N → "the watcher may refuse to start"` line fired again. Re-derived, not acted on, for the third time in two days.

My sweep printed `watcher clone: branch=main dirty=2`. DOCTRINE §9.5 records the cause: the sweep
counts **untracked** files while `start-watcher.ps1` explicitly does not, and the entries are
`?? docs/pr-reviews/pr-<N>-review.md` verdicts the review lane writes into the clone **by design**.
A tracked-dirty clone auto-stashes rather than refusing.

**I did not dispatch 03 on it.** The watcher is running (pid 38776, wrapper alive), so the warning is
not biting.

**DISPOSITION: DEFERRED** — the escalation exists
(`needs-marco/sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`) and the remedy is a
one-word scope change in `status-sweep.ps1` (`--untracked-files=no`), which is `scripts/` and would
therefore park on Marco exactly like the two instrument-repair PRs already on the board. Adding a
third buys nothing today. **What would make it urgent:** a run that ACTS on the line — dispatching 03,
or treating the clone as unable to start — rather than re-deriving it. That would be the third
occurrence in three days and the cost DOCTRINE already prices at 13 mis-routed dispatches.

---

### F5 — `vm-git-guard` installed INERT (exit 2) for the sixth consecutive run. Honoured, not reasoned past.

Structural and unchanged: a station's shell is non-interactive and non-login, so it sources neither
file the installer writes its `PATH` export into. The ban is remembered, not mechanical. It bit
nothing — no `git` ran through the device bridge this run, and `index.lock` was absent in both trees
at every measurement.

**DISPOSITION: DEFERRED** — the contract's own three-outcome table calls exit 2 the expected station
outcome and a FINDING rather than a STOP. **What would make it urgent:** a run reporting exit 2 *and*
a 0-byte `index.lock` with no owning Windows process, which would mean the remembered ban had finally
been forgotten.

---

### F6 — The machinery is healthy, and this line exists so that silence is not the only evidence of it.

[MEASURED] watcher node RUNNING pid 38776 · auto-restart wrapper alive (1) · no non-main worktrees ·
no registry escapees · `index.lock` absent in **both** trees · 0 git processes touching our trees ·
guard hook present · all four enabled scheduled stations fresh and aligned against `lastRunAt` ·
trunk green on `45bbffbc` with nothing failed · `--freshness` CLEAN, exit 0 · sweep §7 `SAFE TO ACT`.

Heartbeat age is 67 min, which with `armed: 0` and an empty queue is **idle, not wedged** — the
heartbeat ticks only mid-run, and DOCTRINE §9.5 records that age alone cannot separate the two. The
three independent signals that *can* (armed work, queue movement, the live Windows process table) all
read healthy.

**DISPOSITION: ACTIONED** — measured, nothing to do. Stated rather than left silent, because a blind
run and a healthy quiet run produce the same absence of news.

---

## WHAT I DID NOT DO

- **I merged nothing.** All four open PRs are Marco's — three by a live watcher `marco:true` verdict,
  the fourth by hand-classification onto `scripts/pipeline/why-blocked.ps1`. No merge was available.
- **I did not remove a `do-not-merge` label**, from #2148 or anywhere. That is the release action and
  it is Marco's; CP-26 exists to make it a human act.
- **I did not touch `title-scope-baseline.json`**, which may only SHRINK.
- **I armed nothing.** `armed: 0`, and the only gate-satisfied HOLD is on the standing never-arm list
  by name. I did not read its body to form an arming opinion.
- **I did not stage `rates-11c-blocked-consumers`** despite it being the backlog's only READY item —
  see F2.
- **I did not edit the `station-contract` canonical block.** My §9 edit is inside `instruments` only,
  so the seven-doc ship stays untriggered; `station-contract` v5 `81ddf31ac807132b` is byte-unchanged
  and was read back to prove it.
- **I did not re-disposition the 03:24Z run's findings.** They carry dispositions; re-opening them is
  how a closed finding gets billed to a second run. I archived that breadcrumb instead.
- **I did not do 03/04/05/06's work.** F4 is deferred with its owner named; the 03:24Z dispatch to 06
  stands untouched.
- **I did not touch Azure, Entra or SharePoint**, in any form, read-modify-write included.
- **I did not write production data, commit to `main`, or edit `sot/`.**
- **I did not run `git` through the device bridge against either Windows `.git`**, and ran no
  `git checkout .` / `checkout -- <dir>` / `reset --hard` / `stash pop` / `git clean` anywhere.
- **I did not clear any lock** — there were none, in either tree.
- **Nothing of mine lives only in a gitignored path.** Everything this run produced is in this file or
  in the two tracked files its PR changes.

---

## FOR MARCO — the same four PRs, and one thing that got safer this run

**Four PRs are waiting on you and none of them is waiting on a defect.** This is the seventh run in a
row where every open PR is yours and the station could merge nothing.

- **#2148** `feat(auth)` — stops the API writing live field-worker sign-in codes and client-portal
  password-reset links into the production log. **Still the one worth your time first**: until it
  merges, anyone with log access has working credentials. 13 checks pass; the only two reds are the
  CP-26 pair that the `do-not-merge` label produces by design.
- **#2135** the dev-tree `git reset` guard · **#2131** `why-blocked.ps1` is an unconditional
  squash-merge that both docs called read-only · **#2127** the raw NUL byte hiding a 52 KB service
  from every grep. **All three are green and CLEAN with no labels at all** — they are routed to you
  only because they touch `scripts/` or `.claude/`.

Releasing one is: remove the `do-not-merge` label where there is one, then commit
`docs/decisions/merge-approvals/<n>.md` to that PR's branch per that folder's README. CI re-runs on
`unlabeled` and CP-26 turns green in the same run. For #2135, #2131 and #2127 there is no label — they
need only the merge.

**The standing question, unchanged and still yours: the stale remote heads.** The consolidated file is
`needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`.

- **Enable Settings → General → Pull Requests → *Automatically delete head branches*.** It fixes the
  problem immediately and in future, and it damages no data — a merged head's commits are already on
  `main`. **Both halves of RULE 1 pass.** This is the option I would take.
- A one-off hand-cleanup fails the *future* half: the population regrows on the next merge.
- **One head must be excluded from any delete set whatever you choose: `fix1483`.** It has no PR and
  its tip is **not** on `main`. Auto-delete-on-merge would never touch it, so the setting is safe for
  it; a hand-deletion pass that reads the list without this exclusion would destroy the only copy.

**And one thing that got safer, no decision needed.** The probe that decides *"is this PR Marco's?"*
returned `NO LOG` for all four of your PRs this run, because of a backslash that doubled crossing two
shells — while both of its prescribed controls passed. Believing it would have re-classified three of
your PRs as unrouted work on a board where the station may merge. It was caught, the correct answer is
in this report, and the trap is now written into DOCTRINE §9.1 with the cure and a falsifying probe, so
the next run cannot meet it fresh. Nothing is waiting on you for it.
