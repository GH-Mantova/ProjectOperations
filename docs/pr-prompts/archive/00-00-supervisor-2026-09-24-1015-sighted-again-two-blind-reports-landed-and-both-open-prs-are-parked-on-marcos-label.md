# Station 00 — Supervisor | 2026-09-24T10:15Z–2026-09-24T10:55Z

**SIGHTED run, after two consecutive blind ones.** The box was reachable on the first attempt, so
this run could do what 08:14Z and 09:14Z could not: run the sweep, run the validator, read the board
live, and — the thing that actually mattered — **land the two blind runs' reports, which were sitting
untracked in the dev tree and reaching nobody.**

**Headline: the board is not stuck and there is nothing on it for a station to fix.** Both open PRs
read `FAIL - CP-26 approval-receipt [LABEL_PRESENT]` — **parked by design on Marco's `do-not-merge`
label, not defects and not work** (DOCTRINE §9.4). Three earlier collect runs listed such PRs among
"the reds" as though they were something to chase; this one does not.

## GROUND

```
UTC            2026-09-24T10:15Z start
origin/main    0f13c399              (git fetch, then git rev-parse --short origin/main)
dev tree       main @ 690d80dc       C:\ProjectOperations2   (0 ahead, 2 behind origin/main)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1   (scheduled-task SKILL.md `station_doc_version: 1`)
```

Doc version and bootstrap **AGREE**, so this run was not READ-ONLY.

## WHAT I MEASURED

### PREFLIGHT step 1 — the guard, then the box

**[MEASURED] `vm-git-guard.sh` exit 2 — the EXPECTED station outcome.** Last line and exit code read
unpiped (`; echo "GUARD_EXIT=$?"`), never through `tail`:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/quirky-elegant-thompson/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

INSTALLED BUT INERT — the ban was **remembered, not mechanical**, and it was kept: no `git` ran
against the mount this run. Every `git` and `gh` call below ran in a `powershell.exe` shell on the
Windows host.

**[MEASURED] The box is reachable.** `start_process` shell `powershell.exe` returned
`main`, `690d80dc22356a40fd76f87f5ca52fe73632bff4 2026-09-24 18:18:10 +1000`, `2026-09-24 20:14:32`
on the first call. **Not blind.**

### PREFLIGHT step 2 — the three binding documents, read fresh

All three read **in full**. The dev tree is 2 behind `origin/main`, so freshness was proved with the
sanctioned no-pipe form (§9.1 — never `git show | git hash-object`, which is unsound in PowerShell):

```
git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md \
    docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md
  -> EMPTY
```

**EMPTY is the real answer**: all three working copies are byte-identical to `origin/main` despite
the tree being behind, so reading the working copy was sound *on these three paths* and is stated
rather than assumed.

### PREFLIGHT step 4 — the sweep

`status-sweep.ps1` captured to a file and decoded: **`ENC=utf16le BYTES=139806 LINES=404`** — the
`*>` UTF-16LE trap (§9.3) reproduced exactly as documented, and the capture was decoded with node
rather than read as UTF-8. Section 0 positive controls both **PASS** (`gh` reached GitHub, node runs).

**[MEASURED] Section 7 verdict: `SAFE TO ACT` — no board mutation in progress, no recent remote
activity, no live station worktrees.** Section 3: `index.lock` False/False, scoped git processes 0,
no PR touched in the last 2 min.

**[MEASURED] Watcher HEALTHY.** node RUNNING pid 42212, auto-restart wrapper alive (2), heartbeat age
41 min. Heartbeat ticks only mid-run, and `armed = 0`, so **stale heartbeat + empty queue = idle, NOT
wedged** — `restart-watcher-if-wedged.ps1` was not needed and `-Fix` was not run. Independent
corroboration that the watcher is alive and working: the 09:15Z run measured `rev-2156`–`rev-2159`
consumed into `processed/`/`blocked/` with logs written after 08:15Z.

### The board — live, and it is two PRs with one cause

**[MEASURED]** `gh pr list --state open --json ... | ConvertFrom-Json` (assign-then-foreach, never a
pipe into `Where-Object` — §9.4):

| PR | msf | labels | head | created |
|---|---|---|---|---|
| `#2158` | BLOCKED | **`do-not-merge`** | `feat/fv2-formrule-contract-drop` | 2026-09-24T08:05:06Z |
| `#2148` | BLOCKED | **`do-not-merge`** | `feat/sec-a3-stop-credential-logs` | 2026-09-24T02:56:07Z |

`OPEN_COUNT=2`. **Zero DIRTY** — so Q1's "N PRs dirty ⇒ CI frozen ⇒ the board cannot move" does not
apply this run. **Zero armed prompts.**

**[MEASURED] Each shows exactly two reds, and they are one cause.** Read from **column 3** of the
CP-26 job log, split on the tab (§9.1 — column 1 is the job name, so grepping the whole line for
`CP-26` matches every line of the log):

```
2026-09-24T09:46:47Z  FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge
label (escalates:true). A human must review and REMOVE the label; removing it is what releases
the merge.
```

Identical verdict token on **both** PRs (jobs `107580017990` and `107579341845`). The second red is
the same check running again as a step inside `PR gates — diff checks`. **`[LABEL_PRESENT]` = parked
by design. Only Marco removes the label; there is no agent-side action behind it.** Lane
classification is moot here — the label binds absolutely and independently.

**[MEASURED] Trunk is green:** `main CI on 0f13c399: 4 success / 0 failed / 0 running`.

### COLLECT

**[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.**
`structure: 5 checked, 0 malformed`. This run **has** earned the phrase: the command was run and the
exit code read.

```
00  last 2026-09-24T09:15:00Z   1.1h ago  (cadence 1h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-23T23:04:00Z  11.3h ago  (cadence 24h)  ok
04  last 2026-09-24T06:10:00Z   4.2h ago  (cadence 4h)   ok
05  last 2026-09-23T14:23:00Z  19.9h ago  (cadence 24h)  ok
```

**[MEASURED] Crossed against `lastRunAt` from the scheduled-tasks MCP**, because the breadcrumb is
one instrument and cannot name a cause:

| station | cron (live) | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| 00 | `5 * * * *` | 2026-09-24T10:14:07Z | 09:15Z | this run |
| 03 | `0 9 * * *` | 2026-09-23T23:02:54Z | 23:04Z | aligned, healthy |
| 04 | `0 */4 * * *` | **2026-09-24T10:09:46Z** | 06:10Z | **mid-run inside my window — NOT a defect** |
| 05 | `10 0 * * *` | 2026-09-23T14:22:41Z | 14:23Z | aligned, healthy |

04's row is the documented by-construction case: 00 is hourly and 04 every 4 h, so 00 lands inside a
live 04 run on every one of 04's occurrences. `lastRunAt` fresh + no breadcrumb yet + 5 minutes old
is a run in flight, and it was **not** dispositioned as SILENT. `weekly-security-audit` remains
`enabled: false`, `lastRunAt 2026-09-06T21:32:44Z` — **18 days**.

**[MEASURED] Two breadcrumbs were UNREPORTED, and the tracked-set probe was asked of `origin/main`,
not of the dev tree** (the dev tree is 2 behind, and its `ls-files` answers about `HEAD`):

```
git ls-tree -r --name-only origin/main -- docs/pr-prompts/   (trailing slash AND -r)
```

returned exactly **4** breadcrumbs at depth 1 — `0514`, `0614`, `0714`, `04-scanner-0610` — and
**neither `0814` nor `0915`**. `check-breadcrumb.mjs`, which builds its tracked set the same way,
independently printed `NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it` for
both. Two instruments, one answer. **Both are landed by this run's PR.**

### The `[STALE]` escalation row

**[MEASURED] Exactly one** `[STALE]` row in sweep section 5: `pr-2135-review-fix.md`. Re-asked
**individually**, never from a LIST response (§9.4): `{"mergedAt":"2026-09-24T07:26:33Z",
"number":2135,"state":"MERGED","title":"feat(pipeline): block \`git reset\` in the shared dev tree
(DEVTREE_RESET)"}`. The escalation asked for exactly one thing — change `feat(guard):` to
`feat(pipeline):` — and **the live title is `feat(pipeline):`**. NEGATIVE control `gh pr view 999997
--json "number,state"` → GraphQL could-not-resolve, exit **1** (a server field, never `--json number`
alone, which fabricates a row at exit 0). Nothing GENERAL survives it. **Discharged.**

### An instrument lie, met live and already on file

**[MEASURED] `✅ Process 42080 has finished execution` was FALSE, for the third recorded time.** It
arrived immediately after `gh` wrote a multi-line `failed to parse jq expression` block to stderr —
the `EARLY_RETURN_TRIGGER_IS_A_NATIVE_STDERR_WRITER_V1` shape. Guard (2) as **strengthened** by
`FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1` — do not merely ping the PID, **READ
ITS BUFFER** — settled it in one call: the drained buffer carried `MARKER_V1` and every subsequent
statement, and the same shell carried the rest of this run. **The output was pending, not absent.**
This is a confirming instance; §9.1 already records it and needs no edit.

The jq failure itself was the documented §9.4 trap: `join(",")` arrived as `join(,)`. Re-run with
`--json` + `ConvertFrom-Json`, which is the prescribed cure, and it worked first time.

## WHAT CHANGED

**Board: nothing.** No PR merged, closed, labelled, rebased, commented or dispatched. No smoke run.
Nothing armed — `armed = 0` at the start of this run and `armed = 0` at the end.

**One PR opened by this run** (branch `board/sup-2026-09-24-1015`, from an isolated worktree off
`origin/main` at `0f13c399`, `wt_dirty=0` at creation), carrying:

1. **The two unreported breadcrumbs**, copied in as raw Buffers and read back `byteExact=true`
   (17953 B and 22257 B). This is the only channel by which 08:14Z's and 09:15Z's findings reach
   anyone.
2. **This breadcrumb**, written *inside the worktree* — Cure 1, so no loose copy is left in the dev
   tree to refuse the next fast-forward.
3. **`docs/pipeline/STATION-CAPABILITIES.md`** — one additive bullet on the blind-run ceiling
   (08:14Z F1's repair). Read back: `delta=1242 expected=1242 deltaOK=true`,
   `anchor_still_present=true`, `new_bullet_present=true`, and `git diff --numstat` →
   **`13  0`** — thirteen insertions, **zero deletions**, so nothing was spilled and no line endings
   were rewritten. Edited with node and **concatenation**, never `String.replace` with a replacement
   string (§9.3 — `$&` and `` $` `` are live in one).
4. **`pr-verdictguard-spaced-path-candidates-HOLD.md`** — 09:15Z F1 staged as a prompt.
5. **Four dispositioned breadcrumbs archived** (`git mv` to `archive/`): `0514`, `0614`, `0714`,
   `00-04-scanner-0610`. `0814` and `0915` stay at depth 1 — they are this cycle.

**Dev tree:** one escalation discharged, `needs-marco/pr-2135-review-fix.md` →
`needs-marco/discharged/`, with `_DISCHARGE-NOTE-2026-09-24-1015.md` beside it. **Moved, never
deleted.** Read back False at the old path, True at the new. The file was **untracked**
(`git ls-files --error-unmatch` → exit 1), so the move cannot ride into another actor's commit.

## FINDINGS

### F1 — Both open PRs are parked on Marco's label, and neither is a defect

`#2158` and `#2148`, both `[LABEL_PRESENT]`, both BLOCKED, both with 13 green checks and the same two
reds from one cause. The board's throughput constraint this hour is **entirely** Marco's label, not
CI, not a conflict, not a stale lock, and not the watcher.

**DISPOSITION: ESCALATED** — already his before this run, and restated so the report is not silent
about the board's real state. **No new question is asked**; the release procedure and the standing
stale-remote-heads decision are already written up in the 06:14Z breadcrumb and in
`needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`. `#2148` is the one worth
doing first — it stops live sign-in codes and password-reset links reaching the production log.

### F2 — 09:15Z F1: `verdict-guard.mjs` truncates every un-backticked `Claude Design/` path

Dispatched by the blind 09:15Z run to "the next **sighted** Station 00 run" — this one. The finding
is sound and was re-read from its own evidence: `PATH_TOKEN_RE` excludes `\s` from both segments, so
a bare `Claude Design/proposed/.../s8h-traffic-index-mockup.html` extracts as `Design/proposed/...`;
`pathMatches`' suffix tolerance cannot recover it because the preceding character is a space, not a
`/`. Two occurrences twenty days apart (`rev-1573` 2026-09-04, `rev-2157` 2026-09-24), and the block
note blames a stale clone and prescribes a re-queue **that cannot fix it**.

**DISPOSITION: ACTIONED (staged) — and DISPATCHED onward for arming.** Staged this run as
`docs/pr-prompts/pr-verdictguard-spaced-path-candidates-HOLD.md`, in the PR above, with the
complete-and-additive repair first (RULE 1): add spaced-prefix candidates in pass 2 and relax the
suffix rule — the guard only ever *gains* candidates and a candidate is accepted only when it
resolves to a real file in the PR, so it cannot be weakened — plus the block-note correction and a
spec case.

**[MEASURED] `lint-prompt.mjs` ADMIT, exit 0 — and it earned it by rejecting me twice first:**
`[MISSING_STANDING_AUTHORITY]` (the body had no push authority, so an armed agent would have done the
work, exited 0 and opened no PR — a silent exit 0), then `[MODULE_MISMATCH]` (`module: pipeline`
against a `scope` that resolves to `watcher`). Both fixed and re-linted. **This is the linter doing
exactly what §9.5 says ADMIT is necessary but not sufficient for — and this run did not arm on it.**

**I did NOT arm it.** Arming is one-at-a-time and is the decision to *run*; the next sighted run
should arm it as its first board action, once it has re-confirmed `SAFE TO ACT` immediately
beforehand (the verdict expires the moment it prints). The resulting PR touches
`scripts/pr-watcher/**`, so it is outside `tests|docs`, will carry `do-not-merge` from
`escalates: true`, and is **Marco's to merge** — a station may drive it green and no further.

### F3 — 08:14Z F1: the blind-COLLECT precedent runs `git` against the mount while certifying it does not

The 05:14Z breadcrumb is the only worked example of COLLECT from a blind station, so it is the
template the next blind run copies — and it ran `check-breadcrumb.mjs` from the VM against the
mounted tree while stating in its own WHAT I MEASURED that *"this is not a `git` call and not a
GitHub-side read"*. It is both: the validator shells `git ls-tree -r --name-only origin/main`,
`git ls-files`, and `gh pr list --state open --limit 100 --json files`.

**DISPOSITION: ACTIONED** — landed in this run's PR as an additive bullet on
`STATION-CAPABILITIES.md`'s blind-run ceiling, beside the existing "run any `.ps1`" prohibition,
with the falsifying probe attached. The fix goes in the **binding document** rather than in the
05:14Z breadcrumb, because a breadcrumb is a historical record of what that run believed and
rewriting it would destroy the evidence; the ceiling is where a future blind run actually looks.
Verified by byte-delta and a 13-insertion/0-deletion `--numstat`.

### F4 — 08:14Z F3 is CLOSED: `rev-2156`–`rev-2159` were the watcher's normal loop

08:14Z escalated *"four prompts armed in twelve minutes against 00's one-at-a-time contract — were
they watcher-routed?"* to the next sighted run. **It was already answered by 09:15Z**, which measured
all four landing in `processed/`/`blocked/` with logs written after that run ended. They are
auto-generated **review jobs**, not prompts (§9.5), and must not be counted as arms at all.

**DISPOSITION: ACTIONED** — closed by measurement, no mutation needed. Recorded rather than dropped
because closing it is the only thing that stops a later run re-raising it. The general lesson worth
keeping: **a queue-root listing measures the queue's mouth, not its throughput.**

### F5 — The `[STALE]` escalation row is discharged

`pr-2135-review-fix.md`, dead since `#2135` merged at 07:26:33Z with exactly the title it asked for.

**DISPOSITION: ACTIONED** — moved to `needs-marco/discharged/` with a discharge note naming what was
measured. ⚠️ That folder is gitignored, so **the note reaches nobody on its own** — which is why the
discharge is also stated here, in a tracked file. **Falsifying probe: re-run the sweep and read
section 5;** if `pr-2135-review-fix.md` is still tagged, the move did not take.

### F6 — The watcher clone's dirty flag is a REAL tracked modification this time, not the usual artefact

The sweep prints `watcher clone: branch=main dirty=1 <-- ... the watcher may refuse to start`.
DOCTRINE §9.5 records that this flag counts **untracked** files and that `start-watcher.ps1` ignores
those, so the warning is usually false. **Re-derived from its own source, as the rule requires
before acting on any `[LIVE]` line** — and this time both forms agree:

```
git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no
 M docs/data-model/metadata-catalog.json          <- TRACKED, modified
git -C C:\po-watcher\ProjectOperations status --short   -> 1
```

So this is a genuinely modified tracked file, not a review verdict awaiting mirroring. It is
**still not a refusal** — §9.5 records that a tracked-dirty clone AUTO-STASHES rather than exiting 1
— so the sweep's *"may refuse to start"* clause remains wrong even when its count is right. The same
path is also modified in the orphaned worktree below, which suggests one generator rather than two.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder)**, whose lane is the watcher process, locks,
worktrees and clone drift. Two things for it: (a) resolve `docs/data-model/metadata-catalog.json` in
the clone — it is a generated file, so regenerate, never hand-merge; (b) the orphaned worktree
`C:/po-worktrees/sup-cwd-paths`, age 161 min, on `fix/pipeline-scripts-resolve-state-paths-from-module`
whose PR **#2154 MERGED at 08:35Z**, holding `M docs/data-model/metadata-catalog.json` and
`?? pr-body.md`. **It holds uncommitted work — `git worktree remove` will refuse and `--force` would
discard it.** I listed it rather than pruning it; prune only after confirming those two files carry
nothing wanted. The second worktree, `C:/po-wt/fv2drop`, is `dirty=0` and safe.

### F7 — Station 00 blindness: 3 of today's 6 occurrences

05:14Z blind → 06:14Z sighted → 07:14Z sighted → 08:14Z blind → 09:14Z blind → **10:14Z sighted**.
An identical `CONNECT_TIMEOUT` 30000ms signature each time. The intermittency DOCTRINE records is
intact, and this run breaks the consecutive streak.

**DISPOSITION: DEFERRED** — the failure is in the MCP transport any fix would have to travel, and
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` already holds it.
What would make it urgent: it stops being intermittent, or a sighted run finds 00 genuinely SILENT.
⚠️ Worth carrying forward from 09:15Z: the probe *"two consecutive blind runs make `--freshness` call
00 SILENT, so it surfaces itself"* has now **had its trigger met and still could not fire** — both
blind runs wrote breadcrumbs, so 00 read current. **That probe should not be relied on again.**

### F8 — `weekly-security-audit` has been disabled for 18 days

`enabled: false`, last ran 2026-09-06T21:32:44Z.

**DISPOSITION: ESCALATED** — Marco's; whether a security baseline audit should be running is his
call and guessing his intent is forbidden. Already on his desk in the 08:14Z and 09:15Z breadcrumbs,
both of which this PR lands. **Not re-asked here** — one question per cycle, and it is already the
open one.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry `do-not-merge`; only Marco removes it, and
  `Assert-SmokedOrEscalate` refuses them as a matter of code. I did not run `why-blocked.ps1` on
  either — it is **mutating** (its method is a REST squash-merge attempt) and pointing it at a
  labelled PR is exactly what it now refuses.
- **Did not arm anything.** `armed = 0` on entry and on exit. The prompt staged this run is a
  `-HOLD.md`; staging is not arming, and arming is the decision to run.
- **Did not treat the two CP-26 reds as work.** `[LABEL_PRESENT]` is parked by design. Three earlier
  collect runs chased these; this one read the verdict token instead of the pass/fail counts.
- **Did not restart, kill or probe-and-act on the watcher.** It is HEALTHY: running, supervised,
  `armed=0`. A stale heartbeat with an empty queue is idle, not wedged, and `-Fix` on BUSY/HEALTHY
  is how a healthy agent gets killed mid-merge.
- **Did not prune either orphaned worktree**, and did not touch the clone. Both are Station 03's,
  one holds uncommitted work, and `--force` would discard it.
- **Did not do 03/04/05's work myself** (LL-38). F6 is dispatched, not done.
- **Did not edit `sot/`** — never this station's — and did not touch Azure, Entra or SharePoint.
- **Did not commit to `main`,** and ran no `git` in `C:\po-watcher\ProjectOperations` beyond
  read-only `status`. All writes happened in an isolated worktree off `origin/main`.
- **Did not run `git` through the device bridge against the Windows `.git`**, despite the guard
  reporting INERT. The ban was mine to keep by hand and it was kept.
- **Did not discharge any of the other 46 `needs-marco/` files.** Only one carried a `[STALE]` tag;
  the rest are `[FILE]` rows the sweep explicitly says it **cannot** decide, and clearing one on that
  line alone is the documented error.
- **Did not archive `0814` or `0915`.** They are this cycle and belong in the root until their
  findings are carried; the four older ones are archived.

## HANDOVER — the next run inherits a fast-forward that WILL refuse

This run opened **PR #2162** (`board/sup-2026-09-24-1015`). When it merges, the dev tree at
`C:\ProjectOperations2` is left holding blockers of **both** documented classes at once, and the
three read-backs the station doc prescribes are exactly the ones that cannot see them:

| path class | dev-tree state now | after #2162 merges |
|---|---|---|
| `00-...-0814-....md`, `00-...-0915-....md`, `00-...-1015-....md` | **untracked** at depth 1 | become **tracked**; `git merge --ff-only` refuses to overwrite an untracked file |
| `00-...-0514-....md`, `00-...-0614-....md`, `00-04-scanner-...-0610-....md` | tracked, present at depth 1 | archived by this PR, so the FF must **delete** them |

⚠️ `0714` is already tracked on `origin/main` and **absent from the dev tree**, which is the correct
post-merge state from an earlier run — leave it alone.

🔧 **The order that works, every step §9.2-safe. Never `git checkout -- <path>`, never `git clean`
(consumed prompts come back armed), never `reset --hard`:**

1. For each blocking path, restore it byte-exactly from `HEAD` with a **raw-Buffer** node write —
   `fs.writeFileSync(abs, execFileSync("git", ["show", "HEAD:" + rel]))` — then
   `git update-index --refresh`. **Exit 0 ⇒ done.** Only on non-zero do you dump the blob and the
   disk copy, count `\r\n` against bare `\n`, and pick convert-on-write or `--renormalize`.
   The raw write cannot be wrong about a blob’s own bytes, and it is one call shorter.
2. `git merge --ff-only origin/main`.
3. Restore anything you deleted, from the **new** `HEAD`, the same raw-first way.

🔴 **Read back all FOUR, not three.** `git rev-list --left-right --count HEAD...origin/main` → `0 0`,
`git diff --numstat` → EMPTY, `git diff --cached --name-status` → EMPTY, **and**
`git status --porcelain --untracked-files=no` → EMPTY. **The first three pass on a dirty tree** —
that is the trap the station doc records three times, and only the fourth probe dissents.

**This run did not perform the fast-forward itself**, because #2162 had not merged inside its slot
and fast-forwarding to an unmerged target is not a thing to do. It is named here so the next run
diagnoses it from the record instead of from first principles, which four consecutive runs have
already paid for.

**And the first board action for the next sighted run** is to arm
`pr-verdictguard-spaced-path-candidates-HOLD.md` (ADMIT, size 3) — after re-running the sweep
immediately beforehand, because the SAFE TO ACT verdict expires the moment it prints.

## FOR MARCO — three lines

**Nothing is broken.** Trunk is green, the watcher is alive and supervised, no station is silent, no
stale lock, the queue is empty and the sweep says SAFE TO ACT. The two blind hours before this one
cost coverage, not correctness.

**The board is two PRs and both are waiting on you, nobody else** — `#2158` and `#2148`, each
green on 13 checks with two reds that are the *same* check firing twice because your `do-not-merge`
label is on them. Removing the label is the entire release. **`#2148` is the one I would do first:**
it stops live sign-in codes and password-reset links being written to the production log.

**One small thing I staged rather than ran:** the review-verdict guard cannot read a directory name
with a space in it, so any review that cites a `Claude Design/...` file gets blocked as a phantom —
it has happened twice, twenty days apart, and the block note blames the wrong cause. The fix is
written up and staged; it touches watcher internals, so it will come to you labelled when it is
built.
