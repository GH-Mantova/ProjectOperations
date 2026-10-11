# Station 04 — Scanner | 2026-10-11T14:11Z–2026-10-11T14:50Z

## GROUND

```
UTC            2026-10-11T14:11:54Z
origin/main    bf245896                (git fetch origin, then git rev-parse origin/main)
dev tree       main @ bf245896         C:\ProjectOperations2
doc version    1                       (station_doc_version, docs/pipeline/stations/04-scanner.md @ origin/main)
bootstrap      1                       (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE (1 = 1). This run is not forced read-only by a version mismatch —
but Station 04 is read-only on the board by authority in any case, and nothing on the board was
mutated.

Sweep this run, per `node scripts/pipeline/next-sweep.mjs`: **`instrument-honesty`** (rotation
position 2 of 4; previous run 2026-10-11T10:11:00Z). Advanced on completion with
`--advance --utc 2026-10-11T14:21:00Z` → `advanced: last_index=1`, exit 0.
🔴 **`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN THE DEV TREE AND STATION 00 MUST COMMIT
IT** — 04 may not commit to the shared tree. It was **already dirty before this run**, so at least
two advances are now uncommitted, which is the standing failure mode the station doc records.

---

## WHAT I MEASURED

### Preflight

- **[MEASURED] Desktop Commander reached the Windows host.** `start_process`, shell
  `powershell.exe`, `git rev-parse --abbrev-ref HEAD` → `main`. **This run was SIGHTED.** The
  tool schemas were loaded first with a keyword `ToolSearch` for `desktop-commander`, and the ids
  that search reported were used — no id was assumed.
- **[CANNOT MEASURE] the device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
  returned, twice, `bash failed on resume, create, and re-resume. resume: VM guest is not
  connected.; create: VM guest is not connected.` **There is no installer last line and no
  installer exit code to quote, because the installer never ran.** A control call
  (`echo alive; ls "$HOME/mnt/"`) failed identically, so the Linux sandbox is unreachable, not just
  the script. Per STATION-CAPABILITIES §3 this is not a stop: it removes the VM read transport, and
  the whole run was therefore done on the host through Desktop Commander. **No `git` was run
  through the device bridge in this run — there was no device bridge to run it through.** The guard's
  absence is NOT read as a licence; the host shell is the sanctioned transport for host `git`, and
  that is the only one used.
- **[MEASURED] the three binding documents were read from `origin/main`, in the dev tree.**
  `git show origin/main:docs/pipeline/stations/04-scanner.md`,
  `git show origin/main:docs/pipeline/DOCTRINE.md`,
  `git show origin/main:docs/pipeline/STATION-CAPABILITIES.md` — all in `C:\ProjectOperations2`,
  after `git fetch origin`. `HEAD` and `origin/main` are the same commit and
  `git rev-list --left-right --count HEAD...origin/main` → `0  0`.
- ⚠️ **[MEASURED] the session's declared date and the host clock disagree by a day.** The Cowork
  environment block declares `Today's date: 2026-10-12`; the host answered
  `(Get-Date).ToUniversalTime()` → `2026-10-11T14:11:54Z`, and again `2026-10-11T14:44:04Z` half an
  hour later. **Every timestamp in this breadcrumb is the host's**, which is the clock Desktop
  Commander reads directly. Station 00's 13:14Z breadcrumb today already names a scheduler-clock
  problem in its own slug; this is a second, independent sighting of the same disagreement and is
  recorded here as corroboration, not as a new finding.

### The sweep: DOCTRINE §9, trap by trap

Every probe below carries a positive control, and a needle minted this run
(`SCANNER-NEEDLE-20261011-1421-QX7K`) is the negative control.

| §9 claim | reproduced? | evidence |
|---|---|---|
| 9.2 `ls-tree` without `-r` under-reports scope | **YES** | `git ls-tree --name-only origin/main -- docs/pipeline` → **1** entry (`docs/pipeline`); with `-r` → **34**. Positive control at repo root: **30** vs **4533**. |
| 9.2 `git status` is structurally blind to gitignored files | **YES** | `git check-ignore -v docs/qa/qa-findings.md` → `.gitignore:116:docs/qa/qa-findings.md`, exit 0. `git status --porcelain -- docs/qa/qa-findings.md` → **empty**, while `Test-Path` → **True**. Positive control: an untracked non-ignored probe file in the same directory → `?? docs/qa/ZZPROBE-<needle>.txt`. Probe file removed; `Test-Path` → False. |
| 9.2 piped `git show <ref>:<path> \| git hash-object --stdin` is UNSOUND in `powershell.exe` | **YES** | on `docs/pipeline/DOCTRINE.md`: piped → `bdee0241…`; `git rev-parse origin/main:<path>` → `5b71fe52…`; `git hash-object <path>` → `5b71fe52…`; `git diff --numstat origin/main -- <path>` → **empty**. Both exit 0, both print well-formed 40-hex. The sound forms agree with each other and disagree with the pipe, exactly as documented. |
| 9.2 a 0-byte `.git/index.lock` with no git process is STALE | **n/a, nothing to measure** | no `index.lock` in `C:\ProjectOperations2\.git` or `C:\po-watcher\ProjectOperations\.git`. 14 `git` processes were alive at the time (this run's own, plus other actors). §9.6 control: the string `index.lock` has **1** hit in `DOCTRINE.md` itself — the documentation false positive the sweep warns about — against **0** locks in the real corpus. |
| 9.4 `gh run list --branch main` can be DAYS stale | **NOT reproduced today, and not falsified** | newest run `2026-10-11T12:29:14Z` (Pipeline heartbeat), trunk CI `2026-10-11T09:20:57Z`, against `now = 2026-10-11T14:25:28Z` — ~2 h, not days. The claim is *"can be"*, so one fresh reading does not retire it. The cure (read CI from the PR) is independently sound: `gh pr checks 2303` returned 15 checks with 4 failing. |
| 9.4 / CAPABILITIES §3 escaped double quotes in `--jq` through the shell | **NOT reproduced — consistent with `JQ_LOUD_FAILURE_NOT_REPRODUCED_V1`** | `gh pr view 2303 --json labels --jq ".labels[].name"` → exit **0**, output `do-not-merge`, the correct answer. Positive control `#1369` → exit 0, `do-not-merge` (which it genuinely carries). Raw `--json` + `ConvertFrom-Json` on the same PR → `do-not-merge`. Measured at PS `5.1.26100.9444`. The 2026-10-09 narrowing in CAPABILITIES §3 is therefore **confirmed by a second, independent measurement**: the raw-JSON cure stands as a precaution, not as the cure for an observed failure. |
| 9.5 `rev-<n>-ready.md` are auto-generated review jobs | **n/a** | `rev-*-ready.md` at depth 1 → **NONE** on disk. (Two exist, archived, under `superseded/cleared-2026-09-04-paused-queue-resolved/`.) |
| 9.5 `STOP-WATCHER-LANE2` present BY DESIGN since 2026-08-15 | **CONFIRMED STILL TRUE** | `C:\po-watcher\STOP-WATCHER-LANE2`, 1090 bytes, mtimeUtc `2026-08-18T04:44:50`. **Do not clear it.** |
| 9.3 PS 5.1 mis-decodes BOM-less UTF-8 / CP1252 double-encode signature | **instrument sound, corpus clean** | `sot/README.md` read as BYTES with `node`: len 15710, `U+FFFD=0`, `cp1252sig=0`. Positive control, a synthetic double-encoded em-dash → `sig=1`. So the detector can produce a positive, and the file is genuinely clean. |
| Station doc BOARD TRAP: tracked `*-ready.md` at depth 1 | **CLEAN** | tracked at depth 1 (`^docs/pr-prompts/[^/]+-ready\.md$` over `git ls-files -- docs/pr-prompts`) → **0**. On disk at depth 1 → **NONE**. Positive control: 1541 tracked files under `docs/pr-prompts`. 16 `*-HOLD.md` at depth 1, all correctly held. |

🔧 **[MEASURED] ONE NEW INSTRUMENT LIE FOUND WHILE RUNNING THE SWEEP, AND IT BIT THIS RUN FIRST.**
`git ls-files -- "docs/pr-prompts/*-ready.md"` is **NOT depth-limited** — a git pathspec `*`
matches `/`, so that glob returned **175** paths from `processed/` and `superseded/**` and would
have been reported as 175 depth-1 board-trap defects. The depth-1 answer is **0**. The honest form
is a regex over `git ls-files -- <dir>`, as used above. This is §9.6 in its purest shape: a
well-formed, confident, wrong answer with nothing empty and nothing erroring. It is recorded here
rather than as a finding because no committed instrument makes this mistake — only a reader writing
the probe by hand does, which is precisely who this breadcrumb is for.

### `status-sweep.ps1` — run, and obeyed as far as it got

`powershell -NoProfile -File scripts\pipeline\status-sweep.ps1`, generated
`2026-10-11 14:21:10Z`. Section 0 positive controls both PASSED (`gh CAN reach GitHub (saw merged
PR #2311)`, `node runs`). **It then ran for 773 s and did not finish** — it was still classifying
33 non-main worktrees in section 4 when this run moved on, so **it produced no section 7
SAFE / CAUTION / DO-NOT-ACT verdict and this run therefore has none to obey.** PR #2294
(`dedupe section 5 PR crawl and add -SkipSection5 fast switch`) is open against exactly this
slowness. No board mutation was attempted, so no verdict was needed.

What it printed, verbatim, tagged `[LIVE]`:

```
  [LIVE] OPEN PRs: 2
  [LIVE]    #2303  BEHIND  fix(pipeline): refuse a HOLD whose own PR is already open
  [LIVE]       CI: 11 pass / 4 fail / 0 pending  <-- RED, do not expect a merge
  [LIVE]    #2294  BEHIND  fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5 fast switch
  [LIVE]       CI: 0 pass / 0 fail / 0 pending  (green)
  [LIVE] WAITING ON MARCO: 0 open PR(s) labelled do-not-merge
  [LIVE] ALL OPEN (non-draft): 0
  [LIVE] MARCO QUEUE MISMATCH: section 1 counted 2 non-draft PR(s), marco-queue.mjs counted 0 -- do not trust either number
  [LIVE] MERGED (most recent 8):
  [LIVE]    #  ?
  ...
  [LIVE] watcher node: NOT RUNNING  <-- the queue will not drain
  [LIVE] auto-restart wrapper: NOT RUNNING -- watcher will not self-restart
```

### Ground truth for those lines, taken independently

- **[MEASURED] both open PRs carry `do-not-merge`.** `gh pr list --state open --limit 50 --json
  number,title,isDraft,labels` → `#2303 draft=False labels=[do-not-merge]`,
  `#2294 draft=False labels=[do-not-merge]`, `OPEN COUNT = 2`. Confirmed **per PR** (DOCTRINE §9.4
  — a list response is not authority): `gh pr view 2303 --json number,state,mergedAt,labels` →
  `state=OPEN mergedAt= labels=[do-not-merge]`; same for `#2294`. So
  `WAITING ON MARCO: 0` and `ALL OPEN (non-draft): 0` are both **wrong**, under the tag the
  report's own header calls authoritative, and the project's standing instruction is *"report ONLY
  from `[LIVE]` lines"*.
- **[MEASURED] `marco-queue.mjs` is NOT the liar — it was fed an empty world.** Reproduced twice
  with the real payload (2 PRs, both labelled): `WAITING ON MARCO: 2 open PR(s) labelled
  do-not-merge; oldest #2294, open 42h` / `ALL OPEN (non-draft): 2`, exit 0, identical on both
  runs. Positive control, a hand-made single labelled PR → `1`. **Negative control, `[]` → exactly
  the two lines the sweep printed: `WAITING ON MARCO: 0 …` / `ALL OPEN (non-draft): 0`.**
- **[MEASURED] `node.exe` IS running; the CIM instrument is dead.** `Get-Process node` → **9**
  processes at `2026-10-11T14:44:04Z`. `Get-CimInstance Win32_Process` inside `status-sweep.ps1`
  threw twice, loudly, and the error text names the cause:
  `Get-CimInstance : No more threads can be created in the system.` …
  `FullyQualifiedErrorId : HRESULT 0x800700a4` at `status-sweep.ps1:263`, and again at `:267`.
  A standalone `Get-CimInstance Win32_Process` call in a control script **hung without returning**.
- **[MEASURED] the host is in a shell storm.** `Get-Process powershell` → **1033**, then **1034**
  ninety seconds later; **2412** processes in total; `node` 9. Each of this run's probe scripts
  took 170–240 s to return work that normally takes seconds. Station 00's own breadcrumbs today
  (`…-0815-…thread-exhausted-at-2037-shells…`, `…-1023-root-caused-the-shell-storm-to-an-unreaped-watchdog-start-job…`)
  already own this condition and have escalated it. **It is named here only because it is the
  upstream cause of the CIM failures below, not as a new finding.**
- **[CANNOT MEASURE] whether any of those 9 `node.exe` processes is the watcher.** Matching
  `*pr-watcher*` requires a command line, command lines require `Win32_Process`, and
  `Win32_Process` is the thing that is failing. So the correct reading of
  `watcher node: NOT RUNNING` is **not "false" — it is UNMEASURED**, and the defect is that it was
  printed as `[LIVE]` rather than as `[CANNOT MEASURE]`. `scripts\restart-watcher-if-wedged.ps1`
  exists (`Test-Path` → True) and is the only sanctioned liveness probe — **it was NOT run: it is
  Station 00/03's instrument and 04 is report-only.**

---

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR merged,
labelled, relabelled or commented. No `/sot/` file touched. No source file touched. No branch
command run. No `-HOLD` staged this run (reason under WHAT I DID NOT DO).

Two writes, both outside the board and both named here:

1. `docs/pipeline/sweep-rotation.json` — advanced by `next-sweep.mjs --advance`, **left dirty in
   the dev tree for Station 00 to commit.** It was already dirty on arrival, so **two or more
   advances are now uncommitted**; if they are never committed the rotation silently stops turning.
2. This breadcrumb, at the tracked path
   `docs/pr-prompts/00-04-scanner-2026-10-11-1421-status-sweep-launders-three-dead-gh-calls-and-two-dead-cim-calls-into-live-zeros-and-waiting-on-marco-reads-0-against-two-do-not-merge-prs.md`.
   **It is UNTRACKED until a board PR commits it** — Station 00 sweeps it up. Four scratch `.ps1`
   probe scripts were written to `C:\po-sup-fix-scripts\` (outside the repo, by design) and one
   transient probe file under `docs/qa/` was created and deleted within the same script, verified
   absent.

---

## FINDINGS

### F1 — `status-sweep.ps1` launders a FAILED `gh pr list` into `"[]"`, and prints `[LIVE] WAITING ON MARCO: 0` while two open PRs are waiting on Marco. New site, same defect class as the already-escalated CIM one, and the blast radius is at least five sites in one file.

**Severity S2.** `do-not-merge` is the gate that stops an agent merging Marco's work, and this is
the line a station reads to see whether that gate is loaded.

**The mechanism, exactly.** `scripts/pipeline/status-sweep.ps1:101–102`:

```powershell
$mqRaw = gh pr list --state open --limit 50 --json number,isDraft,labels,createdAt 2>$null | Out-String
if ([string]::IsNullOrWhiteSpace($mqRaw)) { $mqRaw = "[]" }
```

`2>$null` discards the error, `$LASTEXITCODE` is never tested, and line 102 **rewrites a failed
call as a valid empty payload**. `marco-queue.mjs` then answers that empty payload honestly — `0` —
and the result is forwarded as `[LIVE]`. The comment four lines below reads *"never inventing a
zero"*; line 102 is where the zero is invented. This is DOCTRINE §7 standing guard 2 (*connect,
then assert; never let a failed call flow into a comparison*) and §9.6 (*an empty result is not an
empty world*) in the same two lines.

**Five angles.**

1. **Reproduced.** `marco-queue.mjs` run twice on the real payload → `2` / `2`, exit 0, byte-identical. Positive control (1 labelled PR) → `1`. **Negative control (`[]`) → the sweep's exact two lines.** So the downstream script is exonerated and the input is the lie.
2. **Source.** `status-sweep.ps1:101–102`, read from `origin/main`; working copy is byte-identical (`git status --porcelain` lists only `sweep-rotation.json`).
3. **Ground truth violated.** DOCTRINE §7 standing guard 2, §7's *"a tool that cannot run must FAIL LOUD, never fail quiet"*, §9.6, and §7.1's three-tag rule — the line should be `[CANNOT MEASURE]`.
4. **History.** The CIM half of this defect was found and **ESCALATED by Station 04's own 10:11Z run today** (that breadcrumb's F2/F6, `status-sweep.ps1:263`). **This `gh` site is not in that escalation's scope**, and neither is the `:267` wrapper sibling. Not covered by any open PR: #2303 touches `lint-prompt.mjs` HOLD handling; #2294 touches section 5 only.
5. **Blast radius — the same shape at five sites in one file, three of which fired in this single run.** `:80–81` `$open` → `OPEN PRs: <n>`; **`:101–102` `$mqRaw` → `WAITING ON MARCO` / `ALL OPEN` (fired)**; `:134–135` `$merged` → `MERGED (most recent 8)` (**fired** — it printed the garbage row `#  ?`); **`:263–264` CIM → `watcher node: NOT RUNNING` (fired)**; **`:267,:275` CIM → `auto-restart wrapper: NOT RUNNING` (fired)**; `:687` `$upd` → same shape. **Positive control that the cure is already house style in this very file:** `:73` tests `$LASTEXITCODE` before believing `node -v`; `:159`, `:235`, `:384` and `:419` all test the exit code or emptiness and print `[CANNOT MEASURE]` with prune/verdict advice explicitly withheld. The defect is not a missing idea — it is five sites the idea was not applied to.
6. **And the one control that caught it only half-worked.** `MARCO QUEUE MISMATCH` fired **only because section 1's independent `gh` call happened to succeed**. Had both calls failed — which is the likely case under a worse shell storm — both would have read 0, the mismatch control would have been silent, and the report would have said, authoritatively, that nothing is waiting on Marco.

**DISPOSITION: ESCALATED.** This is an addendum to the escalation Station 04 already filed at
10:11Z, not a second ask: **the open escalation's scope is one site and the measured scope is at
least five, two of which (`:101` and `:267`) it does not name.** I did not stage a `-HOLD` repair —
see WHAT I DID NOT DO. The question for Marco, RULE 1 applied:

- **(A) Complete and additive — recommended.** Add a single `Assert-Measured` helper in
  `status-sweep.ps1` that tests `$LASTEXITCODE` **and** emptiness before any value is believed, and
  route all five sites (`:80`, `:101`, `:134`, `:263`, `:267`, plus `:687`) through it, emitting
  `[CANNOT MEASURE]` with the verdict withheld on failure — the pattern already present at `:159`
  and `:419`. **Solves it immediately and in future** (a sixth site added later must use the
  helper) and **damages no data entry** — it only ever converts a false negative into an honest
  silence. Passes both halves of RULE 1.
- **(B) Patch the two sites that fired, leave the rest.** Fails the *future* half: the next CIM or
  `gh` failure lands on `:80`, `:134` or `:687` and prints another authoritative zero.
- **(C) Fix the shell storm and treat these as transient.** Fails the *future* half outright —
  the thread exhaustion is the trigger, not the defect; the file will mis-report on any future
  `gh`/CIM failure from any cause. Worth doing (Station 00 already owns it), but it is not this fix.

⚠️ **Falsifying probe:** make `gh pr list` fail (unset `GH_TOKEN`, or run from a non-repo cwd) and
run `status-sweep.ps1`. If `WAITING ON MARCO` prints a number rather than `[CANNOT MEASURE]`, F1
stands. If it prints `[CANNOT MEASURE]`, line 102 has been fixed and this finding is discharged.

### F2 — The CIM half reproduced a second time, four hours later, with a DIFFERENT HRESULT — which widens the open escalation from "a cancelled call" to "any CIM failure".

**Severity S2, already escalated — this entry exists to correct the open escalation's premise, not to re-ask.**

Station 04's 10:11Z breadcrumb recorded `HRESULT 0x80010002` — *"Call was canceled by the message
filter"* — and its F2 already generalised to *"any future CIM failure"*. This run measured
`HRESULT 0x800700a4` — **"No more threads can be created in the system"** — at the same two lines
(`:263`, `:267`), 4 h 10 m later, and the printed verdict was identical:
`[LIVE] watcher node: NOT RUNNING  <-- the queue will not drain` plus
`[LIVE] auto-restart wrapper: NOT RUNNING -- watcher will not self-restart`.

**Why this matters beyond a repeat count.** Two different failure modes in one day produce the
same false-negative verdict, so a reader cannot dismiss it as one flaky call — and the `:267`
wrapper line is a **sibling the 10:11Z escalation does not name**. A station acting on these two
lines would conclude the queue is dead and the watcher cannot self-restart; `Get-Process node` → 9
and the correct reading is `[CANNOT MEASURE]`, because matching `*pr-watcher*` needs a command line
and command lines need the dead instrument. ⚠️ **And note what this run could NOT establish: it
is not shown that the watcher IS running** — only that the assertion it is not was manufactured
from an exception.

**DISPOSITION: DEFERRED** — real, and already with Marco in the 10:11Z escalation, which F1's
option (A) would fix in the same change. It becomes urgent the moment a station merges, arms or
prunes on the strength of a `NOT RUNNING` line, or dispatches Station 03 to repair a watcher that
was never down.

### F3 — `status-sweep.ps1` did not complete in 773 s, so this run had no section 7 safe-to-act verdict to obey.

**Severity S3.** The sweep reached section 4 (classifying 33 non-main worktrees) and was still
there when this run moved on. Its own header says the verdict expires the moment it prints; a
verdict that never prints is worse, because a station under turn pressure is tempted to act
without one.

**Five angles, honestly.** Reproduced once, not twice — a second 13-minute run on a
thread-exhausted host would have added to the storm for no new information, and that is a
deliberate choice stated here rather than a gap papered over. Source: section 4's per-worktree
`gh` and `git` calls, 33 worktrees, on a host where every shell call this run made took 170–240 s.
Ground truth: the station contract's preflight step 4 requires the sweep to be run and obeyed.
History: **PR #2294 is open against exactly this** (`dedupe section 5 PR crawl and add
-SkipSection5 fast switch`) and carries `do-not-merge`, so the fix is written and waiting on Marco.
Blast radius: every station whose preflight requires this sweep — 00, 03, 04, 05 — is exposed
whenever the host is loaded.

**DISPOSITION: DEFERRED** — the fix is already authored and sitting in #2294 behind Marco's label;
there is nothing for a station to do but not act without a verdict, which this run did. It becomes
urgent if #2294 stays blocked while the shell storm persists, because then no station gets a
verdict at all.

### F4 — The sweep rotation file arrived already dirty, so two or more advances are uncommitted in the shared dev tree.

**Severity S3.** `git status --porcelain` on arrival listed ` M docs/pipeline/sweep-rotation.json`
**before this run advanced anything**. This run's advance is now stacked on that one. The station
doc records the exact consequence: 04 may not commit, so if Station 00 does not sweep the file up,
the advance survives only as long as the working copy does, and the rotation stops turning while
appearing to work.

A second, related exposure measured in the same reading: **9 untracked station breadcrumbs sit at
depth 1 in `docs/pr-prompts/`** (six from Station 00 and three from Station 04, all dated
2026-10-11), plus untracked `AGENTS.md`, `.codex/`, four `Claude Design/` paths and
`docs/pr-reviews/pr-2311-review.md`. Per the station contract, an untracked breadcrumb at a path a
future fast-forward must create will **block `git merge --ff-only`** while `git diff --numstat` and
`git diff --cached` both read EMPTY — the documented PASS reading. `git rev-list --left-right
--count HEAD...origin/main` → `0  0` today, so nothing is blocked *yet*.

**DISPOSITION: DISPATCHED to Station 00.** It is 00's to commit — the rotation file with the next
board PR, and the nine breadcrumbs via `sweep-breadcrumbs.ps1`. Named here because the contract
requires 04 to name it rather than commit it, and because the backlog is now deep enough that the
fast-forward exposure is a question of when a PR lands one of those paths, not whether.

### F5 — Two of the 16 depth-1 `-HOLD` prompts describe work that already has an open PR.

**Severity S4 (opportunity), reported for completeness because it is the sweep's own subject matter.**
`pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` and
`pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` sit at depth 1 while PR **#2303** (*refuse a
HOLD whose own PR is already open*) and PR **#2294** (*dedupe section 5 PR crawl and add
-SkipSection5 fast switch*) are open with matching titles. DOCTRINE §10.6 is explicit that a PR
does not consume the prompt describing the same work, and the first of those PRs is the fix for
precisely this class. Nothing is armed — both are `-HOLD`, so nothing will run — and marking a
prompt superseded is a board mutation 04 may not make.

**DISPOSITION: DISPATCHED to Station 00**, which may mark them superseded (naming the PR number
inside, per §10.5/§10.6) once those PRs land.

---

## WHAT I DID NOT DO

- **I staged no `-HOLD` prompt**, although the station doc allows up to two. The one repair worth
  staging is F1's option (A), and it edits `scripts/pipeline/status-sweep.ps1` — **the same file
  PR #2294 has open, with `do-not-merge`, and the same file the 10:11Z escalation already put to
  Marco.** Staging a third actor against that file would collide with both, and the station doc
  forbids staging anything *"already covered by an open PR, staged prompt, HOLD file, or existing
  finding note"*. The complete fix is written out in F1 instead, ready for whoever owns the file
  next.
- **I ran no mutating script.** No `arm-prompt.ps1`, no `queue-sync.ps1`, no `pipeline-lib.ps1`
  primitive, no merge, no label change, no `restart-watcher-if-wedged.ps1` — that last one is the
  only sanctioned liveness probe and it is Station 00/03's, which is why F2 reports
  `[CANNOT MEASURE]` rather than resolving the watcher question itself.
- **I did not clear `STOP-WATCHER-LANE2`** (present by design, §9.5) and **did not clear any lock**
  (there were none, and clearing is Station 03's on 00's dispatch).
- **I minted no worktree.** `origin/main` was read with `git show` at a named SHA, per the 2026-08-24
  supersession of the clean-worktree instruction.
- **I did not touch Azure, Entra or SharePoint**, and nothing in this run came near them.
- **I did not run the live-site pass (Part 2) or the GitHub reconciliation audit (Part 1).** The
  station contract's authority section takes ONE named sweep per run and covers it completely;
  `next-sweep.mjs` named `instrument-honesty`, and a shallow pass over everything is what the
  rotation exists to prevent. Part 0's sub-check (a) was also not run for the same reason.
- **I did not re-run `status-sweep.ps1` to completion**, and I did not run a second `Get-CimInstance`
  probe after the first hung. On a host at 1034 `powershell.exe` processes, each additional shell
  is a contribution to the condition Station 00 is trying to clear. This is a judgement, stated
  plainly rather than left for a reader to assume I looked.
- **I wrote nothing to the five gitignored `docs/qa/` sinks** named under the
  `# Overnight-QA scheduled task` comment in `.gitignore`. The one probe file created under
  `docs/qa/` was a positive control for the git-status blindness test and was deleted and verified
  absent in the same script.

---

**Breadcrumb validator:** `scripts/pipeline/check-breadcrumb.mjs` — see the run and its exit code
recorded in the chat report for this run. **This file is UNTRACKED in the dev tree until a board PR
commits it; Station 00 collects.**
