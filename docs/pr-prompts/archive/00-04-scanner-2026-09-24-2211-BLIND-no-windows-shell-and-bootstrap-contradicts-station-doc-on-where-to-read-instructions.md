# Station 04 — Scanner | 2026-09-24T22:11Z–2026-09-24T22:18Z — **BLIND RUN, STOPPED AT PREFLIGHT STEP 1**

## GROUND

```
UTC            2026-09-24T22:11:05Z
origin/main    9055c6b9            (UNVERIFIED — .git ref FILE read, no `git rev-parse`, no fetch)
dev tree       main @ 755f3440      C:\ProjectOperations2   (UNVERIFIED — .git ref FILE read)
doc version    1                    (from the WORKING COPY, not origin/main — not a freshness proof)
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`). That agreement bought nothing: no mutation was
possible this run, and PREFLIGHT step 2 says a version match is not a freshness proof anyway.
**Crucially, the two layers agree on their version number while contradicting each other on
content — see F1. That is exactly the failure mode `station_doc_version` cannot catch.**

🔴 **THIS RUN WAS BLIND.** Named loudly because a blind run and a healthy quiet run produce the
same "no news". I was READ-ONLY on the board by authority and READ-ONLY on the host by failure.

**Nothing was staged, armed, dispatched, merged, renamed, labelled or advanced.**

---

## WHAT I MEASURED

### Reachability — the step that ended the run

- [MEASURED] **Desktop Commander is ABSENT this session.** Schemas were loaded FIRST, per PREFLIGHT,
  so this is not the `InputValidationError` false alarm the contract warns about. Two `ToolSearch`
  calls preceded any conclusion: keyword `desktop-commander start_process` → *"Some MCP servers are
  still connecting"*; keyword `desktop-commander` → no Desktop Commander tool in the result set.
  The session then reported the server terminally, verbatim:
  `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
  plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`
  `start_process` was never callable. **This is absence, not an unloaded schema.** PREFLIGHT step 1: STOP.
- [MEASURED] The only Windows-side tool that surfaced was computer-use `request_access` — not a
  shell, requires Marco's approval (he is not present), and terminals are granted at tier `click`,
  which blocks typing. **Not a substitute and not attempted.**
- [MEASURED] **`vm-git-guard.sh` exit code: `2`**, read with NO pipeline appended
  (`; echo "GUARD_EXIT=$?"` as its own statement, per the 2026-09-22 `tail`-masking lesson).
  Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Last line, verbatim: `PATH="/sessions/ecstatic-zen-volta/.local/bin:$PATH" git <args>`
  Controls it printed: `bash -lc 'command -v git'` → `/sessions/ecstatic-zen-volta/.local/bin/git`;
  `bash -c 'command -v git'` → `/usr/bin/git`.
  **Ninth consecutive run at exit 2** (Station 00 recorded the eighth at 21:15Z). Known state, not re-filed.
  **No `git` was run against the mount at any point this run.**
- [MEASURED] **Independent corroboration of Station 00, 56 minutes apart.** Station 00 wrote
  `00-00-supervisor-2026-09-24-2115-BLIND-desktop-commander-connect-timeout-no-windows-shell.md`
  at 21:15Z with the identical root cause. Two different stations, two different sessions
  (`eager-compassionate-ptolemy`, `ecstatic-zen-volta`), same verbatim CONNECT_TIMEOUT.
  **This is a persistent outage of the Windows bridge, not a transient per-session flake.**

### Read-only observations the mount still permitted

Plain file I/O against `C:\ProjectOperations2` worked. **This is not board coverage.** It bought four things:

- [MEASURED] **No `.git/index.lock`.** `ls .git/index.lock` → *"No such file or directory"*. The board
  is not frozen by the §9.2 stale-lock failure.
- [MEASURED] **No in-progress git operation.** None of `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`,
  `rebase-merge`, `rebase-apply`, `sequencer` exist.
- [MEASURED] **`.git/objects/maintenance.lock` — 0 bytes, mtime `2026-09-01 09:12:28 +1000` — 24 days old.** See F2.
- [MEASURED] **`.git/packed-refs` holds a STALE `refs/remotes/origin/main` = `66194af6`**, shadowed by
  the loose ref `.git/refs/remotes/origin/main` = `9055c6b9`. See F3.
- [MEASURED] `.git/FETCH_HEAD` mtime `2026-09-25 07:13:46 +1000` = `2026-09-24T21:13:46Z` — a fetch ran
  ~58 min before this run.
- [CANNOT MEASURE] Whether `755f3440` is ahead of, behind, or diverged from `9055c6b9`. That needs
  `git rev-list`, which needs a Windows shell.

### The sweep that was due

- [MEASURED] `node scripts/pipeline/next-sweep.mjs` → exit 0:
  `SWEEP: instruction-drift` / `(rotation position 4 of 4; previous run: 2026-09-24T18:18:23Z)`
- [MEASURED] `node scripts/pipeline/lint-station.mjs` → **exit 0**, `ADMIT: all 8 docs clean`,
  every station doc at `v1`. The repo side of the sweep is clean.
- [CANNOT MEASURE] The other four bootstraps under `C:\Users\Marco\Claude\Scheduled`. That path is
  **not mounted** (only `C:\ProjectOperations2` and `C:\PR-Master` are), and reaching it needs the
  Windows shell I did not have. **One of five copies was covered. Four are unexamined.**
- [MEASURED] My own Station 04 bootstrap WAS in hand — delivered verbatim in the scheduled-task
  prompt — so that copy was diffed completely against `docs/pipeline/stations/04-scanner.md`. F1, F4.

### What blindness cost, named so silence is not read as a pass

None of these ran. **Absence of a finding below is absence of measurement, not a clean result:**

- `scripts/pipeline/status-sweep.ps1` — **no sweep verdict exists for this run.** No SAFE / CAUTION / DO-NOT-ACT.
- `gh pr list` and per-PR reads — **the board was not read.** Open-PR count, checks, labels, any
  `do-not-merge` state: all unknown at 22:11Z.
- The BOARD TRAP check (tracked `*-ready.md` at depth 1) — not run; it needs `git ls-files`.
- `git ls-files -- docs/pr-prompts/needs-marco/` — not run.
- No prompt was staged as `-HOLD`. None was assessed, because `lint-prompt.mjs` verdicts were not gathered.

---

## WHAT CHANGED

**Nothing on the board. Nothing in `sot/`. No prompt staged, armed, renamed, moved or deleted. No
label touched. No PR opened, reviewed or merged. No `git` command run anywhere.**

One file was created, by plain file I/O, at the tracked path this contract requires:
`docs/pr-prompts/00-04-scanner-2026-09-24-2211-BLIND-no-windows-shell-and-bootstrap-contradicts-station-doc-on-where-to-read-instructions.md`
— this file. It is **untracked** in the dev tree until a board PR commits it. **Station 00 must sweep it up.**

🔴 **`sweep-rotation.json` was NOT advanced.** `--advance` was deliberately not run: the
instruction-drift sweep was covered for one bootstrap of five, which is not "covered completely".
Advancing would have retired a sweep that did not happen. **The rotation stays at position 4 of 4 —
instruction-drift is still due, and the next run should finish the four unexamined bootstraps.**

---

## FINDINGS

### F1 — 🔴 The Station 04 bootstrap instructs the exact thing the station doc forbids in red: read your instructions from the working copy

The scheduled-task bootstrap's STEP 2 says, verbatim:

> `## STEP 2 - read these three, in full, every run`
> ```
> C:\ProjectOperations2\docs\pipeline\stations\04-scanner.md      <- your instructions
> C:\ProjectOperations2\docs\pipeline\DOCTRINE.md
> C:\ProjectOperations2\docs\pipeline\STATION-CAPABILITIES.md
> ```
> `If the local checkout is unreadable, fall back to ...?plain=1`

`docs/pipeline/stations/04-scanner.md` PREFLIGHT step 2 says, verbatim:

> 🔴 **Read all three — this file included — from `git show origin/main:<path>`, NEVER from the
> working copy in `C:\ProjectOperations2`.** That tree is routinely several commits behind `main`…
> Measured 2026-08-29: two stations in one day were served a superseded copy of their own binding
> instructions, one carrying a claim `origin/main` records as REFUTED.

**The bootstrap names the working copy as the primary source and the network as the fallback. The
station doc names the working copy as the thing never to read and `origin/main` as the only source.**
They are in direct contradiction, and both declare `station_doc_version: 1`, so the version check
that exists to catch layer skew passes cleanly over it.

This is not hypothetical for this run: the dev tree is at `755f3440` while `origin/main` is at
`9055c6b9`, so the working copy the bootstrap points at is **demonstrably not `origin/main`**, and a
station obeying the bootstrap reads whatever that tree happens to hold. It is also self-ratifying —
the drifted instruction tells you to read from the source that cannot correct it.

**RULE 1 options for Marco, complete-and-additive first:**

1. **Rewrite bootstrap STEP 2 to defer entirely, and gate the pair in CI.** Replace the three
   hard-coded working-copy paths with the single instruction *"read your station doc, DOCTRINE and
   STATION-CAPABILITIES from `git show origin/main:<path>` in the dev tree; the paths and the method
   are in the station doc's PREFLIGHT"*, and extend `lint-station.mjs` to diff each bootstrap under
   `C:\Users\Marco\Claude\Scheduled` against the doc it points at, failing on contradiction.
   *Complete:* removes this instance and mechanically prevents the next one, on all five copies.
   *Additive:* touches no board state, no data, no arming; CI-only. **Passes both halves.**
2. **Fix the wording in all five bootstraps by hand, no CI gate.** *Fails the "future" half* — the
   bootstraps stay ungated (F4) and drift again; this is the fifth documented drift already.
3. **Leave it; rely on stations noticing.** *Fails both halves.* It went unnoticed long enough to
   reach a run that only caught it because the due sweep happened to be instruction-drift.

**DISPOSITION: ESCALATED** — Marco. Option 1 needs a decision because it changes files under
`C:\Users\Marco\Claude\Scheduled`, which no station may write, and extends a CI gate.

---

### F2 — `.git/objects/maintenance.lock` is 0 bytes and 24 days old

`stat` → `size=0 mtime=2026-09-01 09:12:28 +1000`, i.e. 24 days stale as of 2026-09-24T22:11Z.

By the station doc's own stale-lock test — measure **byte size and age**, cross against running git
processes and any `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`/rebase-merge/rebase-apply/sequencer —
this reads STALE: 0 bytes, 24 days, and **none** of those operation markers exist.

🔴 **The cross-check against running git processes COULD NOT BE MADE** — that needs the Windows shell
this run did not have. So this is *stale on two of three tests*, not three of three. **I am not
calling it dead, and I did not clear it.** Clearing is Station 03's, on 00's dispatch, and this is
`maintenance.lock`, not `index.lock` — it does not freeze the board the way §9.2's does. Its likely
cost is that `git maintenance` has been silently skipping for 24 days, which degrades quietly.

**DISPOSITION: DISPATCHED** → **Station 03 (Machine Minder)**, via Station 00. Handed over: confirm
no git process owns it (`Get-Process git*` on the host), then decide whether to clear. Do not clear
on this breadcrumb alone — the third test is missing.

---

### F3 — `.git/packed-refs` holds a stale `origin/main`, and it is a trap for exactly the blind-run fallback this report used

`grep 'refs/remotes/origin/main$' .git/packed-refs` → `66194af6e50fe497ee39e0199797112941755843`
`cat .git/refs/remotes/origin/main` → `9055c6b91ca9e65fe2c279769c551337d5cd1082`

This is **not a git defect** — a loose ref correctly shadows a packed one, and `git rev-parse` returns
`9055c6b9`. It is an **instrument trap of the §9 family**, and it bites precisely the fallback a
blind station is pushed toward: with no Windows shell, reading ref files directly is the only way to
stamp GROUND at all, and a station that greps `packed-refs` — the single file that holds every ref,
and the obvious thing to grep — gets `66194af6`, silently wrong by an unknown distance. Nothing warns.
Both are well-formed 40-hex SHAs, so §9.6's *"an empty result is not an empty world"* does not fire.

I avoided it only by reading the loose ref first and grepping `packed-refs` second, and noticing they
disagreed. That was luck, not method.

**DISPOSITION: DEFERRED** — real, not now. The fix is a documentation one: add to PREFLIGHT step 3 that
when GROUND must be stamped from ref files (no shell), the **loose ref wins over `packed-refs`**, and
the value must be tagged UNVERIFIED either way. It becomes urgent the moment a blind station acts on a
`packed-refs` SHA rather than merely reporting one — the read-only authority of 04 is what contains it
today, and 00 and 02 do not have that containment.

---

### F4 — CI gates the repo half of the instruction-drift pair and nothing gates the other half

`lint-station.mjs` exits 0 and admits all 8 repo docs — and it **cannot see a single bootstrap**,
because the bootstraps live under `C:\Users\Marco\Claude\Scheduled`, outside the repo and outside CI.
The sweep's own charter says it *"exists because five pasted copies drifted for weeks and four carried
advice this pipeline had already disproved."* The copies drift because only one side of the comparison
is mechanically checked; the other side is checked only when a human or a station happens to look —
which, per the rotation, is once every four runs at best, and this run could only reach one copy of five.

F1 is the current instance. This finding is the generator.

**DISPOSITION: ESCALATED** — Marco, folded into F1 option 1, which is the same fix. Raised separately
because it survives F1: fixing the wording without gating the pair leaves the generator running.

---

---

### F5 — Station 00's blind breadcrumb is malformed, and CI will fail on it the moment it is committed

`node scripts/pipeline/check-breadcrumb.mjs` → **exit 1**, `REJECT: 1 malformed breadcrumb(s)`:

```
REJECT  00-00-supervisor-2026-09-24-2115-BLIND-desktop-commander-connect-timeout-no-windows-shell.md
          x missing section: ## WHAT CHANGED
          x missing section: ## WHAT I DID NOT DO
structure: 4 checked, 1 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)
```

My own breadcrumb is `ADMIT` in the same run, so the repo-wide exit 1 is **entirely** Station 00's file.

Two costs, and the second is the worse one:

1. **Mechanical.** `check-breadcrumb.mjs` runs repo-wide in CI under the `pipeline-tests` job. That file
   is untracked today, so CI is green; the moment a board PR sweeps it in — which is exactly what is
   supposed to happen to it — `pipeline-tests` goes red, and the failure will surface on an unrelated PR
   whose author has no idea why.
2. **Substantive.** The two missing sections are `WHAT CHANGED` and `WHAT I DID NOT DO`. For a **blind**
   run those are the load-bearing ones: the entire hazard the contract names is that a blind run and a
   healthy quiet run produce identical silence, and those two sections are where the silence gets an
   explicit reading. Station 00's report is strong on *why* it was blind and says nothing structured
   about what it consequently left untouched. The validator caught the omission that matters most,
   in the run type where it matters most.

Not a criticism of that run's substance — its reachability evidence is what let me corroborate rather
than re-derive. It is a gap the validator is built to catch and nobody ran the validator.

**Worth noting for the contract itself:** every station is told to write a breadcrumb, and told the
validator's name, but nothing in PREFLIGHT tells a station to *run* it before ending the run. Both
blind runs today were written under time pressure at a hard stop; one was validated only because this
station's due sweep happened to be instruction-drift.

**DISPOSITION: DISPATCHED** → **Station 00**, which owns its own breadcrumb and is the only station that
may commit in `docs/pr-prompts/`. Handed over: add the two missing sections to the 2115Z file — *nothing
changed, and here is what blindness cost* — and re-run `node scripts/pipeline/check-breadcrumb.mjs` to
exit 0 **before** any board PR sweeps the directory. I did not edit it: another station's breadcrumb is
not mine to rewrite, and 04 is read-only regardless.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for host coverage.** `origin/main` is not the tree the
  watcher globs, and PREFLIGHT forbids presenting it as coverage. No `gh` call was made.
- **Did not run `git` against the mount**, in any form, including the read-only forms. The guard is
  INERT (exit 2), so the ban is remembered; an inert guard is not a licence, and §9.2 records seven
  failures here.
- **Did not mint a worktree** to get a clean read — that is how `/tmp/po-scan-*` trees are orphaned.
- **Did not advance `sweep-rotation.json`.** One bootstrap of five is not complete coverage.
  Instruction-drift remains due.
- **Did not stage any prompt as `-HOLD`.** Staging needs `lint-prompt.mjs` verdicts, which needed the shell.
- **Did not clear `maintenance.lock`** (F2) — not my authority, and the third staleness test was unavailable.
- **Did not touch `sot/`** — 05's, always.
- **Did not touch Azure / Entra / SharePoint.** Not approached.
- **Did not write this report to the Cowork session `outputs` folder.** A blind run did exactly that on
  2026-09-22 with a complete report and it reached nobody.

## FOR MARCO

Two things, one of them structural.

1. **The Windows bridge has been down for at least an hour across two stations.** Desktop Commander
   times out at 30s. Stations 00 (21:15Z) and 04 (22:11Z) both stopped at preflight step 1. Until it
   reconnects, every scheduled run produces a blind stop: nothing merges, nothing arms, and the board
   is unread. This is the thing to fix first — the findings below are worth nothing if no station can act.
2. **F1 needs your decision** (and F4 is the same fix). The Station 04 bootstrap tells the station to
   read its binding instructions from the working copy; the station doc says in red never to do that.
   Both claim version 1, so nothing catches it. Option 1 — defer the paths to the station doc and
   extend `lint-station.mjs` to diff every bootstrap against the doc it points at — solves it now and
   prevents the next one, touches no board or production state, and is the only option that passes
   both halves of RULE 1. It needs you because it writes under `C:\Users\Marco\Claude\Scheduled`.
3. **F5 is a small, time-sensitive chore for Station 00**: its own 2115Z breadcrumb fails
   `check-breadcrumb.mjs` for two missing sections. Harmless while untracked, turns `pipeline-tests`
   red on whichever unlucky PR first sweeps the directory in.
