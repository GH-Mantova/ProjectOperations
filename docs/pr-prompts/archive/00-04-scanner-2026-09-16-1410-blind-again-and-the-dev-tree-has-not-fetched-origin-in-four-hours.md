# Station 04 — Scanner | 2026-09-16T14:10:55Z–2026-09-16T14:23Z

## GROUND

```
UTC            2026-09-16T14:10:55Z
origin/main    bdc5d05b            (ref READ FROM FILE — NO fetch, NO rev-parse. See caveat.)
dev tree       main @ bdc5d05b     C:\ProjectOperations2   (.git/HEAD + .git/refs read as files)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter — WORKING COPY)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run is READ-ONLY regardless, because it is **BLIND**.

### 🔴 BLIND RUN — no Windows shell. Step 1 of the station contract fired STOP.

**I could not reach the box.** `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP
server ... connection timed out after 30000ms"`. No `start_process` tool exists in this session.

**This was absence after an honest load, not a cold-call validation error.** The contract's §1 warning
was obeyed: `ToolSearch` was run three times *before* concluding anything — keyword `desktop-commander`
(the form the contract prescribes), then `start_process powershell terminal shell command windows`,
and the server then reported `CONNECT_TIMEOUT` explicitly. The loads returned PDF-viewer, Microsoft
Learn, Teams and Chrome tools and **no shell tool of any kind**.

**A blind run and a healthy quiet run both produce "no news." This was the blind one.**
This is the **second consecutive blind Station 04 run** (10:11Z, 14:10Z) — see F1.

What that costs, named, so nobody reads this as coverage:

- **No `git` at all.** The dev-tree `git` is reachable only through the Windows shell, and the
  device-bridge guard (correctly) refuses `git` against the mount. No `git fetch`, no
  `git rev-parse origin/main`, no `git diff --numstat`, no `git show origin/main:<path>`.
- **The GROUND SHAs are file reads, not `rev-parse`** — and this run they are also **demonstrably
  stale**: see F2.
- **The three binding documents were read from the WORKING COPY**, which the contract forbids.
  `station_doc_version` matching is explicitly **not** a freshness proof. Treat every reading below as
  taken against possibly-superseded instructions.
- **`scripts/pipeline/status-sweep.ps1` never ran** — PowerShell. **No board verdict exists for this
  run.** Nothing here is a merge or arm clearance.
- **`check-breadcrumb.mjs` was NOT run end-to-end.** Its verdict path shells to `git ls-tree` /
  `gh pr list`; under the guard, against the mount, that is refused by design. **This breadcrumb is
  UNVALIDATED — the word `breadcrumb-clean` does not appear in this report and must not be inferred.**

**Sweep this run: NONE.** `node scripts/pipeline/next-sweep.mjs` (read-only, no `--advance`) reports
**`SWEEP: gate-liveness` (rotation position 1 of 4; previous run: 2026-09-15T02:10:31Z)**. It was **not
run**: gate-liveness means executing premises against `origin/main` at a named SHA — precisely what a
blind run cannot do. **The rotation was NOT advanced.** `gate-liveness` is still owed and is now owed
for the **third** consecutive run.

---

## WHAT I MEASURED

**Device-bridge git guard** — installed before any other VM-side call. Last line, quoted verbatim as
the contract requires, pass or fail:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
**PASS** (exit 0). [MEASURED]

**Shell reachability.** Three `ToolSearch` loads, then `CONNECT_TIMEOUT` from the server itself. No
`start_process`, no `interact_with_process`, no PowerShell of any kind offered. [MEASURED]

**Refs, read as files (no git binary invoked).** [MEASURED]
```
cat .git/HEAD                      -> ref: refs/heads/main
cat .git/refs/heads/main           -> bdc5d05b...
cat .git/refs/remotes/origin/main  -> bdc5d05b...
date -u -r .git/FETCH_HEAD         -> 2026-09-16T09:47:41Z
```
The 10:11Z run recorded the identical `FETCH_HEAD` mtime, `2026-09-16T09:47:41Z`. **It has not moved in
the 4h23m since.** [MEASURED] → F2.

**Rotation state.** [MEASURED]
```
docs/pipeline/sweep-rotation.json  content: last_index 3, last_run_utc 2026-09-15T02:10:31Z
                                   file mtime: 2026-09-16T06:59:01Z
```
The file's **mtime is 4h48m newer than the timestamp its own content carries**, and its content names a
run from the previous day. A file rewritten *backwards*. → F3.

**Station 04 run history, by breadcrumb (`grep -ciE 'BLIND RUN|could not reach the box'`).** [MEASURED]
`2026-09-15-0000` blind · `09-15-0210` sighted · `09-15-1010` sighted · `09-15-2222` sighted ·
`09-16-0219` sighted · `09-16-0610` sighted · `09-16-1011` **blind** · `09-16-1410` (this) **blind**.
Blindness is intermittent and now **consecutive** for the first time in this window. [MEASURED]

**Breadcrumb structure.** Filename matches `NAME_RE`; the five contract sections are present and in
order; no finding is routed into a gitignored sink. **Structure only** — the tracked/untracked and
open-PR-collision verdicts need git and were **not** obtained. [MEASURED, partial]

---

## WHAT CHANGED

**Nothing.** No board mutation, no arm, no disarm, no rename, no delete, no prompt staged, no rotation
advance, no git command. One file written: this breadcrumb, untracked, in the dev tree at
`C:\ProjectOperations2\docs\pr-prompts\`, for Station 00 to collect.

---

## FINDINGS

### F1 — Two consecutive blind runs; `gate-liveness` is now owed for the third run running.

The 10:11Z run filed blindness as **DEFERRED** behind two open escalations, on the reasoning that it was
recurrent but not yet continuous. It is now continuous: **eight hours of Station 04 with no sighted
coverage**, and the rotation has not turned since `2026-09-15T02:10:31Z` — **36 hours**. The cause
remains unknown; nothing in this run's reach can diagnose it.

**DISPOSITION: DEFERRED.** Not re-escalated — the 06:10Z F1 escalation (Station 00 disabled) is the
parent and is still open; a second channel for the same silence adds noise, not signal. **What would
make it urgent: a third consecutive blind run, or any sighted run finding work that rotted during the
blind window.** Whoever picks this up should treat `gate-liveness` as overdue, not as due.

### F2 — The dev tree has not fetched `origin` in 4h23m; the remote-tracking ref is now stale in fact, not merely unproven.

At 10:11Z `.git/FETCH_HEAD` was 23 minutes old and the run could honestly call it "fresh in fact, but
not fetched now." It now reads the **same** `2026-09-16T09:47:41Z` — unmoved across a full station
cycle. Under normal operation the watcher fetches; it has not. This is an independent, git-free
corroboration that the watcher/Station 00 chain is down, measured from an artifact rather than inferred
from silence.

**Consequence for every station reading while blind:** `bdc5d05b` is no longer a defensible stand-in for
`origin/main`. Any gate, premise or drift reading taken against that ref from now on is reading a
**4½-hour-old world** and must say so.

**DISPOSITION: ESCALATED** — folded into the open 06:10Z F1 escalation (Station 00 disabled) rather than
re-filed, as new evidence for it. Marco: this is the same outage, now with a second independent witness.

### F3 — `sweep-rotation.json` carries an mtime 4h48m NEWER than the `last_run_utc` in its own content — the reset-overwrite in 10:11Z/F1, caught in the artifact.

10:11Z/F1 argued that the watcher's `reset` destroys 04's uncommitted rotation advance every cycle, and
that "leave it dirty, 00 commits it" is therefore unsafe as written. That was reasoned from behaviour.
This run has the fingerprint: the file was **written at 2026-09-16T06:59:01Z** and the content it was
written *to* names **2026-09-15T02:10:31Z**, index 3. A file cannot advance backwards on its own. The
06:10Z run's advance was overwritten at 06:59Z by a restore to the committed state.

**DISPOSITION: ESCALATED** — folded into the open 10:11Z F1 escalation as corroborating evidence, not
re-filed. It does not change that finding's ask (where rotation state should live); it removes the last
reason to treat it as a hypothesis.

---

## WHAT I DID NOT DO

- **No sweep.** `gate-liveness` requires premise execution against `origin/main` at a named SHA. Blind.
- **Did NOT advance the rotation.** Advancing would burn a slot for a sweep that never happened — the
  exact silent coverage loss this station exists to prevent. And per F3 the advance would not survive.
- **Did NOT substitute GitHub-side reads for the tree.** The contract forbids presenting `origin/main`
  reads as coverage of the tree the watcher globs, and the GitHub connector was not used for that.
- **Did NOT run Part 0, Part 1 or Part 2.** Part 0's greps are reachable over the mount, but they are
  not this run's rotated sweep, and a shallow pass over everything is the failure mode the rotation
  exists to remove. Part 2 needs Chrome against the live site and a board verdict that does not exist.
- **Staged no prompt.** Read-only on the board, and nothing this run found is prompt-shaped.
- **Did NOT run `git` against the mount**, by hand or otherwise. The guard is installed and was not
  worked around.
