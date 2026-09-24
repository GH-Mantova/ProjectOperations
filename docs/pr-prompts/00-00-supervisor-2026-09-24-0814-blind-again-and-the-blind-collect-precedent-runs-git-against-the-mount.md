# Station 00 — Supervisor | 2026-09-24T08:14Z–2026-09-24T08:17Z

**BLIND RUN. Desktop Commander timed out, so there was no shell on the Windows host. No board
mutation of any kind was attempted.** Doc version and bootstrap AGREE (both `station_doc_version: 1`),
so the READ-ONLY posture comes from PREFLIGHT step 1's STOP, not from a version mismatch.

**Headline, and the reason this report is worth reading rather than being the third "I was blind"
of the day: the blind-COLLECT precedent set at 05:14Z today is unsound.** That run ran
`check-breadcrumb.mjs` from the VM against the mounted tree and wrote, in its own WHAT I MEASURED,
*"This is not a `git` call and not a GitHub-side read."* It is both. The validator shells out to
`git ls-tree -r --name-only origin/main` and `git ls-files` against the mount — precisely what
DOCTRINE §9.2 and `vm-git-guard` exist to forbid — and also to `gh pr list`. This run therefore did
**not** run it, and lost its freshness verdict as a result.

## GROUND

```
UTC            2026-09-24T08:14Z start
origin/main    [CANNOT MEASURE] — no shell; `git fetch` + `git rev-parse` unavailable, and `git`
               against the mount is banned (DOCTRINE §9.2)
dev tree       main @ [CANNOT MEASURE short SHA]   C:\ProjectOperations2
               (ref read from .git/HEAD as a FILE: `ref: refs/heads/main` — no git invoked)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1   (scheduled-task SKILL.md `station_doc_version: 1`)
```

## WHAT I MEASURED

### PREFLIGHT step 1 — the guard, then the box

**[MEASURED] `vm-git-guard.sh` exit 2 — the EXPECTED station outcome. Last line and exit code quoted
as the contract demands, read unpiped (`; echo "GUARD_EXIT=$?"`, never through `tail`):**

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
  bash -lc 'command -v git' -> /sessions/confident-exciting-franklin/.local/bin/git
  bash -c  'command -v git' -> /usr/bin/git
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/confident-exciting-franklin/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

**[MEASURED] Negative control confirming INERT in this very shell:** `command -v git` → `/usr/bin/git`.
So the device-bridge git ban was REMEMBERED, not mechanical, for this entire run — and it was kept.
No `git` ran anywhere, against the mount or otherwise.

**[MEASURED] The Windows host is unreachable. An absent MCP server, not an unloaded schema.** The load
was attempted the way the doc prescribes — keyword `ToolSearch` for `desktop-commander`, never a
hard-coded `select:` of ids:

- `ToolSearch "desktop-commander start_process powershell"` → one unrelated Microsoft-Learn tool.
- `ToolSearch "desktop-commander"` (bare keyword, max_results 30) → `No matching deferred tools found.`
- `ToolSearch "start_process interact_with_process shell command execution"` → PDF-viewer, Chrome,
  plugins tools. No shell tool of any id.
- The MCP host named the cause outright: `plugin:desktop-commander:desktop-commander
  (CONNECT_TIMEOUT): "MCP server ... connection timed out after 30000ms"`.

There is no tool id to call, so there is no post-load failure to distinguish from a pre-load one: the
server itself timed out. `start_process` was never reachable and no `powershell.exe` ran.

**[CANNOT MEASURE] The station's whole lane.** No `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no
dot-sourced `pipeline-lib.ps1`, no `smoke-pr.ps1`, no `gh`, no `git`. `Assert-SmokedOrEscalate` +
`Merge-Pr` is the only sanctioned merge path and it was unavailable, so ARM / DISPATCH / MERGE were
**impossible rather than declined**.

**[CANNOT MEASURE] Freshness of the three binding documents.** PREFLIGHT step 2 requires
`git show origin/main:<path>` in the dev tree; with no shell that is impossible, so
`stations/00-supervisor.md` was read from the working copy, which the doc says is not a valid read and
which `station_doc_version` cannot vouch for. Treat every doc-derived statement here as provisional.
This is F2 of the 05:14Z report, unchanged and re-met exactly as that run predicted.

### PREFLIGHT step 4 — the one question a blind station can still answer

**[MEASURED] The board is NOT frozen by a stale lock.** `ls`/`stat` only, no git process started.
`.git/index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`,
`sequencer` — **all seven ABSENT**. Byte size and age come from a directory listing, so §7's
"escalates on mere existence" has nothing to fire on.

### COLLECT — what the precedent cost, and what survived it

**[MEASURED] `check-breadcrumb.mjs` invokes `git` against the mount. Quoted from the script:**

```
scripts/pipeline/check-breadcrumb.mjs:19   import { execSync } from 'node:child_process';
scripts/pipeline/check-breadcrumb.mjs:104  const probes = [`git ls-tree -r --name-only origin/main -- ${DIR}`, `git ls-files ${DIR}`];
scripts/pipeline/check-breadcrumb.mjs:107      const set = new Set(execSync(cmd, ...
scripts/pipeline/check-breadcrumb.mjs:155      const raw = execSync('gh pr list --state open --limit 100 --json files', ...
```

So the validator is a `git` caller and a `gh` caller. It was **not run this run**. Consequence, stated
plainly rather than papered over: **this run has no `--freshness` verdict and does not claim one**, and
`breadcrumb-clean` is **NOT** claimed for this file — the contract permits that phrase only with the
command quoted and exit 0, and the only command that produces it is banned from my shell.

**[MEASURED] The freshness question answered the one way left open — `list_scheduled_tasks` crossed
against breadcrumb filenames on disk. No git, no gh.** Station 00's cadence read from the live listing
rather than any pasted line: `cronExpression: 5 * * * *`, which **agrees** with the bootstrap's
measured claim of hourly.

| station | cadence | `lastRunAt` | age at 08:17Z | newest breadcrumb in queue root | reading |
|---|---|---|---|---|---|
| 00 | 1h | 2026-09-24T08:14:06Z | this run | 06:14Z | see below — 07:14Z unresolved |
| 03 | 24h | 2026-09-23T23:02:54Z | 9.2h | (archived) | ok |
| 04 | 4h | 2026-09-24T06:09:44Z | 2.1h | 06:10Z | **healthy, aligned** |
| 05 | 24h | 2026-09-23T14:22:41Z | 17.9h | (archived) | ok |

**[CANNOT MEASURE] Whether Station 00's 07:14Z occurrence fired.** `lastRunAt` holds only the most
recent run — it now holds *this* one — so by construction it cannot answer a question about an earlier
occurrence; the station doc records a wrong refutation produced by exactly that limit. The third
instrument that *can* answer it is the session directory under
`…\local-agent-mode-sessions\<a>\<b>\<8-hex>\`, and **that path is outside every mount available to
me** (only `ProjectOperations2`, `PR-Master`, `outputs`, `uploads`, `skills` are mounted). Absence of a
07:14Z breadcrumb in the queue root is **not** evidence either way: the 06:14Z run wrote its own
breadcrumb *inside its PR worktree* (cure 1), so a sighted 07:14Z run would legitimately leave nothing
in the root. Unresolved, deliberately, rather than guessed.

**[MEASURED] Queue state, filesystem only.** Root breadcrumbs 3 · `archive/` 720 · **armed
(`*-ready.md`) = 4** · `*-HOLD.md` = 16 · `needs-marco/` = 47.

**[MEASURED] Four prompts were armed in the fifteen minutes before this run started, and the 06:14Z
run measured `armed = 0`.** `rev-2156-ready.md`, `rev-2157-ready.md`, `rev-2158-ready.md`,
`rev-2159-ready.md`, mtimes 07:59Z / 08:02Z / 08:08Z / 08:11Z (17:59–18:11 local, UTC+10). HOLDs also
moved 15 → 16. **[INFERRED]** an actor was live on the board minutes before my start; **[CANNOT
MEASURE]** which one, or whether those four are watcher-routed, second-lane (DOCTRINE §10), or
Marco's. This is the single most important reason a blind run must not touch anything here: LL-38 is
two actors sharing one git index, and the board is exactly where it bites.

**[MEASURED] `weekly-security-audit` is DISABLED and has not run for 18 days.** `enabled: false`,
`lastRunAt: 2026-09-06T21:32:44Z`. The station doc records a precedent worth naming: all four
scheduled tasks once sat disabled for three days and no chat noticed.

**[MEASURED] The two untracked breadcrumbs the 06:14Z run swept are still sitting in the dev tree
root** — `…0514-blind-desktop-commander-connect-timeout.md` and
`…04-scanner-2026-09-24-0610-four-pipeline-scripts…md`, both mtime 08:14Z today. **[CANNOT MEASURE]**
whether that sweep PR merged; confirming it needs `git`/`gh`. Flagged because the contract warns an
untracked file at a path a landed PR must create is what refuses the next `--ff-only`, while
`--numstat` and `--cached` both read EMPTY.

## WHAT CHANGED

**Nothing on the board, nothing in git, nothing in `sot/`.** No PR armed, labelled, merged, closed,
commented or dispatched. No `-HOLD.md` moved. No `-ready.md` touched — least of all the four armed
minutes before I started. No escalation file discharged. No breadcrumb archived. **No `git` command
run anywhere.**

The only write this run made is **this breadcrumb**, at
`C:\ProjectOperations2\docs\pr-prompts\00-00-supervisor-2026-09-24-0814-blind-again-and-the-blind-collect-precedent-runs-git-against-the-mount.md`.
Cure 1 (write it inside the run's own PR worktree) needs git and was unavailable; the dev tree is the
contract's other sanctioned home. It is **untracked until a later board PR commits it**, and the
filename is novel so it collides with no path a fast-forward must create.

## FINDINGS

### F1 — The blind-COLLECT precedent from 05:14Z runs `git` against the mount while certifying that it does not

The 05:14Z breadcrumb is the template the next blind run will copy — it is the only worked example of
COLLECT from a blind station, and it reads as a careful run, which is what makes it dangerous. Its
claim *"This is not a `git` call and not a GitHub-side read"* is refuted by the script's own source,
quoted above: two `git` invocations against the mounted tree plus one `gh`. It exited 0 and left no
lock, so nothing warned — and a call that *is* cut short is exactly what leaves the 0-byte
`index.lock` with no owning Windows process that freezes every station (DOCTRINE §9.2, seven prior
occurrences). The cost of getting this right is real and was paid this run: no freshness verdict, and
no `breadcrumb-clean` on this file.

**DISPOSITION: DEFERRED** — real, mine, and not startable from inside a blind run, because the fix is
a documentation/tooling PR and opening one needs the shell this finding is about. What would make it
urgent: the next blind occurrence, since the precedent is live and uncorrected in the queue root right
now. Two concrete repairs for the next sighted run, RULE 1 order — **complete-and-additive first:**
give `check-breadcrumb.mjs` a `--no-vcs` mode that takes its tracked set from a committed manifest
instead of `git ls-tree`, so a blind station gets a real freshness verdict with no git at all (solves
it immediately and for every future blind run, and adds a capability rather than removing one);
**fallback, additive but incomplete** — have the script detect that its cwd is a mounted path and
refuse with the guard's own message, which stops the violation but leaves blind COLLECT with no
verdict, i.e. it fails the "solves it completely" half.

### F2 — Station 00 was blind at 08:14Z; this is the second blind occurrence today, not consecutive

Measured above, schema-load discipline followed first, so this is an unreachable machine and not a
validation error. 05:14Z blind → 06:14Z **sighted** → 08:14Z blind. The intermittency DOCTRINE records
is intact and the cause is still unknown; this run adds one data point (`CONNECT_TIMEOUT` after 30s,
identical signature to 05:14Z) and nothing more. The falsifying probe the 05:14Z run relied on —
*"two consecutive blind occurrences make `--freshness` call 00 SILENT, so it surfaces itself"* — has
**not** fired, correctly, because 06:14Z was sighted. ⚠️ But note that probe now has a second way to
fail silently: it only fires if some later run can *run the validator*, and F1 is the reason a blind
run should not.

**DISPOSITION: DEFERRED** — the failure is in the MCP transport that would have to carry any fix. It
becomes urgent the moment it stops being intermittent. It graduates to a desktop-app/MCP question for
Marco, not a pipeline one, if a sighted run ever finds 00 SILENT.

### F3 — Four prompts were armed minutes before this run and no station-00 breadcrumb accounts for them

`rev-2156` … `rev-2159`, armed 07:59Z–08:11Z, against `armed = 0` measured at 06:14Z. Arming is
Station 00's exclusive lane and is ONE AT A TIME by contract, so four appearing inside twelve minutes
is either a sighted 07:14Z run behaving unusually, a second lane (§10), or Marco. I could not read the
board, the watcher log or git, so I am naming it rather than diagnosing it — and I did not touch them.

**DISPOSITION: ESCALATED** — to the next **sighted** Station 00 run as the first thing it does, ahead
of any arming of its own, with a specific question: *were `rev-2156`–`rev-2159` watcher-routed?* If
they were not, DOCTRINE §10.1 applies and they carry no RULE-2 verdict, which must not be read as
cleared-for-merge. Not escalated to Marco: nothing here needs his intent yet, and it may resolve to a
perfectly normal sighted run.

### F4 — `weekly-security-audit` has been disabled for 18 days

`enabled: false`, last ran 2026-09-06T21:32:44Z. It may well have been turned off deliberately; I
cannot tell from the listing, and no station owns that decision.

**DISPOSITION: ESCALATED** — Marco's, because whether a security baseline audit should be running is
his call and guessing his intent is forbidden. One question, in FOR MARCO below.

### F5 — The four PRs waiting on Marco, and #2131, carried forward unre-measured

From the 06:14Z report: `#2148` (auth — stops live sign-in codes and password-reset links reaching the
production log; its two reds were diagnosed there as **one human gate, not a defect**), plus `#2135`,
`#2131`, `#2127`. `#2131` was found to be a second-lane PR: clean, green, unlabelled, reviewed MERGE,
carrying **no RULE-2 verdict at all**. This run could not re-measure any of them and does not claim to
have.

**DISPOSITION: ESCALATED** — already Marco's before this run; a blind run cannot advance it. No new
question: the release procedure and the standing stale-remote-heads decision are written up in the
06:14Z breadcrumb and in `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`.
Restated only so this report is not silent about the board's real state.

## WHAT I DID NOT DO

- **Did not run `check-breadcrumb.mjs`** — F1. Which means I did **not** produce a `--freshness`
  verdict and do **not** write `breadcrumb-clean` for this file. Said plainly rather than quietly
  omitted, because the contract treats an unearned `breadcrumb-clean` as a lie.
- **Did not run any `git` command anywhere.** The guard reported INERT, so the ban was mine to keep by
  hand, and it was kept. The one-call form `PATH=…/.local/bin:$PATH git …` was not used either —
  protection for a call I had no business making is not a reason to make it.
- **Did not touch the four armed prompts, or any HOLD.** An actor was live on the board eleven minutes
  before my start and I could not identify it. Arming or disarming blind, into a queue another actor
  may be mid-run on, is LL-38 with the index shared.
- **Did not substitute GitHub-side reads for the tree.** The GitHub MCP is connected and read-only
  `gh`-shaped reads were available; the contract forbids presenting `origin/main` as coverage of the
  tree the watcher globs, so no PR, check or label state was read from GitHub and none is claimed.
- **Did not open a second-lane PR to deliver this breadcrumb.** A PR the watcher did not open carries
  no RULE-2 verdict (§10.1), and a blind run adding an unrouted PR to a board it cannot then read is a
  worse trade than an untracked file in the dev tree — and F3 is this run watching that exact
  ambiguity cost someone else a diagnosis.
- **Did not read `DOCTRINE.md` or `STATION-CAPABILITIES.md` in full.** A blind station has nothing to
  gate on them, and full quotes from a working copy of unknown age would carry authority they have not
  earned. §9.2 and §10.1, which this report leans on, are cited from the station doc's own restatement.
- **Did not clear any `[STALE]` escalation row**, and did not discharge any of the 47 `needs-marco/`
  files. Both need `status-sweep.ps1` section 5 plus a per-PR `gh pr view` re-ask.
- **Did not archive any breadcrumb.** That is a `git mv` in a board PR.
- **Did not touch `sot/`** — never this station's, sighted or blind.
- **Did not restart or probe the watcher.** A process check needs the box; the ENSURE-UP probe is a
  Windows-side call.

## FOR MARCO — two lines

The hour was lost to a blind station, not a defect: Desktop Commander timed out, so Station 00 had no
shell and armed, merged and dispatched nothing. Underneath it the tree is clean — no stale lock, no
in-progress merge, no station SILENT on the cadence evidence available. **Your PRs are still yours,
`#2148` first**, and the stale-remote-heads question is still the one standing decision; neither
changed and both are written up in the 06:14Z breadcrumb.

**One question, and it is small: should `weekly-security-audit` be running?** It has been
`enabled: false` since 2026-09-06 — 18 days. If that was deliberate, nothing to do and I will stop
raising it once it is recorded as intentional. If it was not, it is a one-click re-enable and the
pipeline has been without a weekly security baseline for two and a half weeks. No station can decide
this, which is the only reason it is on your desk.
