# Station 00 — Supervisor | 2026-09-24T05:14Z–2026-09-24T05:22Z

**BLIND RUN. Desktop Commander never connected, so there was no shell on the Windows host. No board
mutation of any kind was attempted. Doc version and bootstrap AGREE (both `station_doc_version: 1`),
so the READ-ONLY posture below comes from PREFLIGHT step 1, not from a version mismatch.**

## GROUND

```
UTC            2026-09-24T05:14Z start
origin/main    [CANNOT MEASURE] — no shell; `git fetch` + `git rev-parse` unavailable, and `git`
               against the mount is banned (DOCTRINE §9.2)
dev tree       main @ [CANNOT MEASURE short SHA]   C:\ProjectOperations2  (ref read from .git/HEAD as
               a FILE: `ref: refs/heads/main` — no git invoked)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1   (scheduled-task SKILL.md `station_doc_version: 1`)
```

## WHAT I MEASURED

**[MEASURED] The Windows host is unreachable. This is an absent MCP server, not an unloaded schema.**
The station doc is emphatic that declaring blindness without loading the schema first is a §7
instrument lie, so the load was attempted the way the doc prescribes — keyword `ToolSearch` for
`desktop-commander`, not a hard-coded `select:` of ids:

- `ToolSearch "desktop-commander start_process interact_with_process read_file"` → returned one
  unrelated Google-Drive tool. No Desktop Commander tool of any id.
- `ToolSearch "+desktop-commander start_process"` → `No matching deferred tools found. Some MCP
  servers are still connecting: plugin:desktop-commander:desktop-commander.`
- `ToolSearch "start_process powershell shell command execution local machine"` → PDF-viewer,
  GitHub, Shopify, scheduled-tasks tools. No shell tool.
- The MCP host then reported the cause outright:
  `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
  plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.

There is no tool id to call, so there is no post-load failure to distinguish from a pre-load one:
the server itself timed out. `start_process` was therefore never reachable, and no `powershell.exe`
ran this run.

**[CANNOT MEASURE] Everything the station's lane depends on.** No `scripts/pipeline/status-sweep.ps1`,
no `check-breadcrumb.mjs` on the host, no dot-sourced `pipeline-lib.ps1`, no `smoke-pr.ps1`, no `gh`,
no `git`. `Assert-SmokedOrEscalate` + `Merge-Pr` is the only merge path and it was unavailable, so
ARM / DISPATCH / MERGE were all impossible rather than declined.

**[CANNOT MEASURE] Freshness of the three binding documents.** PREFLIGHT step 2 requires reading them
from `git show origin/main:<path>` in the dev tree. With no shell that is impossible, so all three
were read from the working copy in `C:\ProjectOperations2` — which the doc explicitly says is *not* a
valid read, and which `station_doc_version` cannot vouch for ("a version match is not a freshness
proof"). Treat every doc-derived statement in this breadcrumb as provisional on a working copy of
unknown age. What was read: `stations/00-supervisor.md` (1648 lines), and `DOCTRINE.md` (2841) and
`STATION-CAPABILITIES.md` (579) were located and sized but NOT read in full — a blind run that cannot
act had nothing to gate on them, and reading a possibly-stale copy in full would have produced
confident quotes from an unverifiable source.

**[MEASURED] The board is NOT frozen by a stale lock.** `ls` only — no git process was started:
`.git/index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`
and `sequencer` are all ABSENT in `C:\ProjectOperations2\.git`. (`.git/_writetest`, 0 bytes, exists —
but it is dated **Jul 2 12:52**, not this run, and it is not a lock.) This is the one preflight-step-4
question a blind station can still answer, because byte size and age come from a directory listing.

**[MEASURED] COLLECT ran for real, from the Linux side. No station is SILENT.** `node` exists in the
Cowork VM and the validator is a node script, so it ran against the mounted tree. This is not a
`git` call and not a GitHub-side read — it is the dev tree itself:

```
$ node scripts/pipeline/check-breadcrumb.mjs --freshness
ADMIT   00-00-supervisor-2026-09-24-0414-rule-2s-only-probe-answered-no-log-for-all-four-prs-...md
structure: 1 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)
freshness (a station is SILENT past 2x its cadence):
  00  last 2026-09-24T04:14:00Z  1.0h ago   (cadence 1h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-23T23:04:00Z  6.2h ago   (cadence 24h)  ok
  04  last 2026-09-24T02:10:00Z  3.1h ago   (cadence 4h)   ok
  05  last 2026-09-23T14:23:00Z  14.9h ago  (cadence 24h)  ok
CLEAN
TRUE_EXIT=0   (measured unpiped — `> file; echo $?`, NOT through `tail`, per the step-1 warning
               that two runs on 2026-09-22 recorded a guard exit of 0 that way against a true 2)
```

**[CANNOT MEASURE] The `lastRunAt` cross-check the doc requires after freshness.** That needs
`list_scheduled_tasks`; the freshness table alone cannot name a cause. Not attempted — with no
ability to dispatch, a cause I could not act on was not worth a claim.

**[MEASURED] The one breadcrumb since my last run needs nothing from me.** It is Station 00's own
0414Z report, and every finding in it already carries a literal disposition (three ACTIONED, one
ESCALATED, two DEFERRED, plus F2 DISPATCHED → Station 06 and F3 ESCALATED carried forward unchanged).
There is no undispositioned finding anywhere in the window 04:14Z–05:14Z.

**[INFERRED] Blindness is intermittent, as DOCTRINE records.** The 04:14Z run was sighted — it wrote
a full breadcrumb and opened a PR. One hour later the same task is blind. Cause still unknown; this
run adds a data point (`CONNECT_TIMEOUT` after 30 s) and nothing more.

## WHAT CHANGED

**Nothing on the board, nothing in git, nothing in `sot/`.** No PR was armed, labelled, merged,
dispatched or commented on. No `-HOLD.md` was moved. No escalation file was discharged. No `git`
command was run anywhere, against the mount or otherwise.

The only write this run made anywhere is **this breadcrumb**, at
`C:\ProjectOperations2\docs\pr-prompts\00-00-supervisor-2026-09-24-0514-blind-desktop-commander-connect-timeout.md`.
Cure 1 (write it inside the run's own PR worktree) was unavailable — that needs git. The dev tree is
the contract's other sanctioned home, so it went there and is **untracked until a later board PR
commits it**. The filename is novel, so it collides with no path a fast-forward must create.

## FINDINGS

### F1 — Station 00 was blind at 05:14Z: Desktop Commander timed out and there was no Windows shell

Measured above. The schema-load discipline was followed first, so this is an unreachable machine and
not a validation error. Consequence: the station's entire lane (ARM / DISPATCH / MERGE) was
unavailable for this occurrence, and the four PRs waiting on Marco stayed exactly where they were.
Nothing was lost — a blind hour on an hourly cadence costs one occurrence — but it is being said
loudly because a blind run and a healthy quiet run both produce "no news", and only one of them is
fine.

**DISPOSITION: DEFERRED** — real, and not actionable from inside a blind run: the failure is in the
MCP transport that would have to carry the fix. It becomes urgent the moment it stops being
intermittent, and the falsifying probe is already in place and cheap: `check-breadcrumb.mjs
--freshness` calls Station 00 SILENT past 2 h, so **two consecutive blind occurrences surface
themselves** at the next sighted run without anyone watching for it. If a sighted run ever finds 00
SILENT, that is this finding having graduated, and it goes to Marco as a desktop-app/MCP question
rather than a pipeline one.

### F2 — The binding documents were read from an unverifiable source, and the contract has no sighted-free path

PREFLIGHT step 2 mandates `git show origin/main:<path>` in the dev tree; step 1's STOP fires before
it whenever there is no shell. So a blind station is instructed both to stop and to read three
documents it has no sanctioned way to read. This run resolved the conflict by stopping, reading only
what it needed from the working copy, and labelling it `[CANNOT MEASURE]` rather than quoting it as
current — but the gap is structural, not a one-off.

**DISPOSITION: DEFERRED** — noting it rather than fixing it, because fixing it means editing a
station doc, which means a PR, which needs the shell this finding is about. It is also nearly
harmless by construction: a station that cannot act cannot execute a superseded instruction. It
becomes worth a PR if a blind run is ever given work it *can* perform from the VM side. Recorded so
the next sighted run meets it already written down instead of rediscovering it.

### F3 — The four PRs waiting on Marco are unchanged and unworked for an eighth consecutive occurrence

`#2148` (auth: stops live sign-in codes and password-reset links reaching the production log — the
one worth Marco's time first), `#2135`, `#2131`, `#2127`. Carried from the 04:14Z report, which
measured them; this run could not re-measure them and does not claim to have. None is blocked by a
defect; all four are routed to Marco because of what they touch.

**DISPOSITION: ESCALATED** — it was already Marco's before this run and a blind run cannot advance
it. No new question: the release procedure and the standing stale-remote-heads decision are stated in
the 04:14Z breadcrumb's `FOR MARCO` section and in
`needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`. Re-stated here only so this
report is not silent about the board's actual state.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for the tree.** The GitHub MCP is connected and `gh`-shaped
  reads were available to me; the contract forbids presenting `origin/main` as coverage of the tree
  the watcher globs, so no PR, check or label state was read from GitHub and none is claimed.
- **Did not open a second-lane PR to deliver this breadcrumb.** The GitHub MCP could have pushed a
  branch and opened one, but a PR the watcher did not open carries no RULE-2 verdict (DOCTRINE §10.1),
  and a blind run adding an unrouted PR to a board it cannot then read is a worse trade than an
  untracked file in the dev tree.
- **Did not run the `vm-git-guard.sh` installer.** It exists to make the git-against-the-mount ban
  mechanical for a shell; the only shell I had was the Linux VM's and I ran no `git` in it at all, so
  installing a guard would have produced an exit code to quote and nothing to protect. Named rather
  than skipped silently, because the contract asks for the installer's last line and exit code and
  this run has neither.
- **Did not read DOCTRINE.md or STATION-CAPABILITIES.md in full**, for the reason under WHAT I
  MEASURED: a blind station has nothing to gate on them, and full quotes from a working copy of
  unknown age would look like authority they do not have.
- **Did not clear any `[STALE]` escalation row.** That requires `status-sweep.ps1` section 5 plus a
  per-PR `gh pr view` re-ask; both need the shell.
- **Did not touch `sot/`** — never this station's, sighted or blind.
- **Did not leave this breadcrumb unvalidated.** After writing it, `node
  scripts/pipeline/check-breadcrumb.mjs` was run from the VM against the mounted tree:
  `ADMIT 00-00-supervisor-2026-09-24-0514-blind-desktop-commander-connect-timeout.md`,
  `structure: 2 checked, 0 malformed`, `CLEAN`, **TRUE_EXIT=0 measured unpiped**. So
  `breadcrumb-clean` is claimed here with the command quoted, as the contract requires. The validator
  also printed its own confirmation of the caveat above: `NOTE ... is UNTRACKED — it reaches nobody
  until a board PR commits it`. ⚠️ **Station 00's next sighted run must sweep this file up** — it is
  the one thing this run needs from the next one.

## FOR MARCO — one line, because nothing new is asking for you

The hour was lost to a blind station, not to a defect: Desktop Commander timed out, so Station 00 had
no shell on the box and merged, armed and dispatched nothing. The board is clean underneath it — no
stale lock, no silent station, no undispositioned finding. **Your four PRs are still yours, `#2148`
first**, and the stale-remote-heads question is still the one standing decision; both are written up
in the 04:14Z breadcrumb and neither changed. If the next hourly run reports normally, this was the
documented intermittent blindness and needs nothing from you. If `--freshness` ever names **00** as
SILENT, the intermittent has become persistent and it is a desktop-app / MCP-transport question
rather than a pipeline one.
