# Station 04 — Scanner | 2026-09-22T10:11Z–2026-09-22T10:14Z

> **FIRST LINE: THIS WAS A BLIND RUN.** Desktop Commander failed to connect
> (`CONNECT_TIMEOUT`, 30000 ms) *after* the tool loads were attempted. No sweep was covered.
> The quiet below is the quiet of an instrument that was not there — **not** the quiet of a
> healthy board. Nothing here is board coverage for 2026-09-22T10:11Z.

## GROUND

```
UTC            2026-09-22T10:11:05Z
origin/main    3be7587a  ⚠ STALE REF, NOT FETCHED THIS RUN (see WHAT I MEASURED)
dev tree       main @ 3be7587a  C:\ProjectOperations2
doc version    1   (read from the WORKING COPY, not from origin/main — see caveat below)
bootstrap      1
```

`doc version` and `bootstrap` **agree**, so the read-only clamp for a version mismatch did not
fire. But that agreement is worth less than it looks: the preflight requires the station doc be
read via `git show origin/main:<path>`, and `git` against the mount was unavailable this run, so
the doc was read from the working copy — the exact tree the preflight says can be several commits
behind with content corrected and no version bump. **A version match is not a freshness proof**,
and this run could not obtain one.

## WHAT I MEASURED

**[MEASURED] Desktop Commander is ABSENT — this is the blindness, and it is definitive.**
Schemas were loaded first, per the preflight; a validation error was not mistaken for blindness.
Three load attempts, then a hard runtime failure:

1. `ToolSearch select:mcp__plugin_desktop-commander_desktop-commander__start_process,…interact_with_process,…read_process_output`
   → `No matching deferred tools found. Some MCP servers are still connecting: … plugin:desktop-commander:desktop-commander.`
2. `ToolSearch "desktop-commander"` (keyword form the preflight mandates, so the session's own ids
   are used rather than hard-coded ones) → same "still connecting" result, no tools.
3. Runtime then reported, unprompted:
   `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`

So `start_process` does not exist in this session under any id. There was no shell on the Windows
host to start. Per the station contract this is a STOP, not a degraded run.

**[MEASURED] The git guard installed INERT — exit 2, the expected station outcome.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — exit code read from the
installer itself, **not** from a pipeline appended to it:

```
GUARD_EXIT=2
```

Last line, verbatim:

```
   PATH="/sessions/sharp-epic-ptolemy/.local/bin:$PATH" git <args>
```

Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` Its own controls reproduced exactly as the station doc's table predicts:
`bash -lc 'command -v git'` → `/sessions/sharp-epic-ptolemy/.local/bin/git` (shim);
`bash -c 'command -v git'` → `/usr/bin/git` (real git). The device-bridge git ban was therefore
**remembered, not mechanical**, for this whole run — and it was honoured: **no `git` command was
run against the mount at any point.** Every fact below comes from plain file reads.

**[MEASURED] The mount is readable; the blindness is of EXECUTION, not of the filesystem.**
`/sessions/sharp-epic-ptolemy/mnt/ProjectOperations2/` lists the live dev tree, with mtimes in
Windows local time (+1000). A future run reading "blind" flatly should not infer the tree was
gone — it was there, and unreadable only by anything that needed to *run*: PowerShell,
`status-sweep.ps1`, `next-sweep.mjs`, `check-backlog.mjs`, `lint-prompt.mjs`, `gh`, `git`.

**[MEASURED] `origin/main` tracking ref = `3be7587a49e3a94f42202a98cdd42d86d6d7c120`, and it is
stale by construction.** Read from `.git/refs/`, not from `git rev-parse`. `.git/FETCH_HEAD`
mtime is `2026-09-22 19:15:11 +1000` = **09:15:11Z, 56 minutes before this run started**, and no
fetch was possible this run. `HEAD` = `refs/heads/main` = the same SHA. **Treat the SHA in GROUND
as "what this tree last heard", never as "what `main` is now."**

**[MEASURED] The dev tree is clean of the §9.2 freeze.** No `.git/index.lock` at all — so no
stale-lock age/size judgement was needed. No `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`,
`rebase-merge/`, `rebase-apply/` or `sequencer`. This is the one genuinely reassuring reading in
the run, and it is a file-existence check, which is exactly the kind of claim a blind run may
still make honestly.

**[MEASURED] Sweep rotation was NOT advanced.** `docs/pipeline/sweep-rotation.json` reads
`last_index: 0` (`gate-liveness`), `last_run_utc: 2026-09-22T06:10:45Z`, `last_station:
04-scanner`. Left untouched, so the next run's `next-sweep.mjs` still returns index 1,
**`instrument-honesty`** — which is the correct next sweep and must not be skipped.

**[MEASURED] `docs/pr-prompts/00-*.md` held exactly one breadcrumb before this one:**
`00-00-supervisor-2026-09-22-0820-2071-merged-mid-run-by-the-supervised-lane-with-a-receipt-and-eighteen-review-verdicts-were-never-published.md`.
Recorded as a datum only; reconciling it is Station 00's.

**[CANNOT MEASURE] Everything the board is actually made of.** No `status-sweep.ps1` verdict
(SAFE/CAUTION/DO-NOT-ACT), no watcher liveness, no open-PR or check state, no gate premises, no
`origin/main` freshness, no `lint-station.mjs`, no live site. **No GitHub-side read was
substituted for any of it** — the contract forbids presenting `origin/main` reads as coverage of
the tree the watcher globs, and that prohibition was honoured.

**[CANNOT MEASURE] This breadcrumb was not validated.** `scripts/pipeline/check-breadcrumb.mjs`
calls `execSync` on `git` (lines 19, 101) and `gh pr list` (line 149); both were unavailable, and
running the git path against the mount is banned. The validator was therefore **not run**, and
the word `breadcrumb-clean` does not appear in this report. Its structure is hand-matched to the
five mandated sections; CI's `pipeline-tests` job is the real verdict.

## WHAT CHANGED

**Nothing on the board. Nothing in the repo but this file.**

- No prompt staged, armed, disarmed, renamed, moved or deleted.
- No PR touched, no label touched, no merge.
- No `git` command executed anywhere.
- `sweep-rotation.json` deliberately left as-is (see FINDINGS F3).
- One file written: this breadcrumb, into the dev tree at
  `C:\ProjectOperations2\docs\pr-prompts\`. It is **untracked** — Station 00 must sweep it up.

## FINDINGS

### F1 — Desktop Commander did not connect; Station 04 ran blind and covered no sweep

**Evidence:** three load attempts returned no tools; runtime reported
`CONNECT_TIMEOUT … timed out after 30000ms` for `plugin:desktop-commander:desktop-commander`.
Quoted in full under WHAT I MEASURED.

**Blast radius — this is the finding's real weight.** The bridge is the *only* sanctioned liveness
probe. Without it a station cannot run `status-sweep.ps1`, cannot fetch, cannot read its own
binding documents from `origin/main` (so the freshness guarantee the preflight is built on is
simply absent — folded in here rather than filed separately, since it shares this one cause),
cannot run any gate checker, and cannot validate its own breadcrumb. Every scheduled station
inherits this, not just 04. The station doc records blindness as intermittent, cause unknown, at
roughly 40% of Station 00's recent runs; today's data point is one more, with a concrete error
string — `CONNECT_TIMEOUT` at 30 s — which is more than "it was quiet" and is worth keeping.

**DISPOSITION: ESCALATED.**

Marco — the question, not a status update: **the bridge fails often enough that roughly two runs
in five produce a confident-looking "no news" that is actually an absence of measurement. Which
of these do you want?**

- **(A) Fix the timeout at the source — complete and additive, and the only option that passes
  both halves of RULE 1.** Treat the 30 s MCP connect timeout as the defect: find why Desktop
  Commander needs longer than 30 s to come up on this host (cold start, antivirus scan, a slow
  first-run resolve) and either remove that cost or raise the timeout in the Cowork MCP config.
  It restores real coverage for every station, now and in future, and it changes no pipeline data
  and no board state, so nothing existing or future is put at risk. Needs your hand because it is
  local host/app configuration.
- **(B) Make blindness self-reporting instead of self-diagnosed.** Have each station emit a
  one-line machine-readable liveness receipt (`bridge=UP|DOWN`, error string, UTC) that Station 00
  tallies. **Fails the "solves it completely" half** — a run that can count its blind runs is
  still blind for all of them. Worth doing *alongside* (A), not instead of it.
- **(C) Accept it and let stations stop, as this one did.** **Fails the same half, harder.**
  Coverage silently drops to whatever fraction of runs happens to connect, and the rotation stalls
  every time. It damages no data, which is why it is survivable — but it is the status quo that
  produced this report.

### F2 — `vm-git-guard` reports INERT (exit 2) exactly as its own documentation predicts

**Evidence:** `GUARD_EXIT=2`; headline and both shell controls quoted verbatim above.

This is the **documented expected outcome** for a station shell (non-interactive, non-login, so
neither `~/.bashrc` nor `~/.profile` is sourced), not an anomaly, and the station doc's own table
says to quote it and carry on. Recording it because a reproduction is a small positive control:
the `instrument-honesty` sweep's claim about this trap is still true as of this SHA, which is a
scrap of value salvaged from an otherwise blind run.

**DISPOSITION: DEFERRED.** It becomes urgent the day the guard reports exit 0 or non-zero on a
station shell instead of 2 — either would mean the documented mechanism has changed underneath
the doc. Nothing to do while it keeps telling the truth.

### F3 — The rotation was deliberately not advanced, so `instrument-honesty` is still owed

**Evidence:** `sweep-rotation.json` left at `last_index: 0` / `2026-09-22T06:10:45Z`.

Advancing after covering nothing would have burned `instrument-honesty` (index 1) without running
it — the rotation would keep turning while coverage quietly fell to zero, which is the exact
failure the rotation exists to prevent, wearing the opposite hat from the shallow-pass failure.

**DISPOSITION: DISPATCHED** to the next Station 04 run: **run `instrument-honesty` (index 1).**
Station 00 needs to do nothing with the file — no commit is required, because no change was made
to it.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for the blind sweep.** Explicitly forbidden, and it is
  the failure mode that makes a blind run indistinguishable from a healthy one. No connector call
  was made.
- **Did not run any sweep, gate check, backlog check, HOLD triage, or lint.** All require the
  execution the run did not have. Part 0's static grep audit and Part 1's GitHub reconciliation
  were both left alone: the preflight stop precedes them, and running a partial static pass would
  have produced findings that look like coverage of a run that had none.
- **Did not run `git` against the mount.** The guard was inert, so the ban was mine to keep, and I
  kept it. All git facts here are reads of `.git/` files.
- **Did not mint a worktree** (orphan-lock hazard, AUTHORITY) and **did not clear anything** —
  there was no lock to clear.
- **Did not advance the rotation** (F3) and **did not write to any gitignored `docs/qa/` sink** —
  no `qa-findings.md`, no `qa-checklist.md`, no `.qa-run.lock`. The concurrency lock was neither
  claimed nor needed: the run stopped at preflight and mutated nothing it could collide on.
- **Did not leave this report in the session `outputs` folder.** A blind run on 2026-09-22 did
  exactly that — correct content, complete dispositions, reached nobody. This file is in the dev
  tree instead, and is named in the chat report so Station 00 sweeps it.
