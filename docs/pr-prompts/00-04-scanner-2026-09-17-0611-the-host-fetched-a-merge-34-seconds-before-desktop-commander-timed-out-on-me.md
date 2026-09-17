# Station 04 — Scanner | 2026-09-17T06:11:09Z–2026-09-17T06:31Z

## GROUND

```
UTC            2026-09-17T06:11:09Z
origin/main    ebe7a599            (ref READ FROM FILE — no fetch, no rev-parse. Corroborated in F1.)
dev tree       main @ ebe7a599      C:\ProjectOperations2   (.git/HEAD + .git/refs read as files)
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter — WORKING COPY)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run is READ-ONLY regardless, because it is **BLIND on the
Windows shell**.

### 🔴 BLIND RUN — no Windows shell. Step 1 of the station contract fired STOP.

`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`. No `start_process`,
no `interact_with_process`, no PowerShell of any kind in this session.

**Absence after an honest load, not a cold-call validation error.** `ToolSearch` was run three times
*before* concluding anything, per the contract: keyword `desktop-commander` twice (the form the
contract prescribes), then `start_process powershell interact_with_process read_process_output`. The
first two returned *"Some MCP servers are still connecting: … plugin:desktop-commander"* — the server
had not resolved either way, so neither was treated as a verdict. The third returned a Microsoft Learn
tool and **no shell tool of any kind**, and the server then reported `CONNECT_TIMEOUT` explicitly.
Only then was blindness declared.

**A blind run and a healthy quiet run both produce "no news." This was the blind one.** Fourth blind
Station 04 slot out of the last six — see F1.

What that costs, named, so nobody reads this as coverage:

- **No PowerShell, so no `status-sweep.ps1`.** **No board verdict exists for this run.** Nothing here
  is a merge or arm clearance.
- **The GROUND SHAs are file reads, not `rev-parse`.** Corroborated in F1, but weaker than the
  contract asks for.
- **The binding documents were read from the WORKING COPY**, which the contract forbids.
  `station_doc_version` matching is explicitly **not** a freshness proof. Treat every reading below as
  taken against possibly-superseded instructions.
- 🔴 **`git` DID run against the mounted Windows `.git` this run — twice, and I did not intend either.**
  I drafted this report claiming trackedness was `[CANNOT MEASURE]` and that no `git` had touched the
  mount. **Both claims were false and are retracted.** See **F2**, which is why.

**Sweep this run: NONE.** `docs/pipeline/sweep-rotation.json` reads `last_index: 1`,
`last_run_utc: 2026-09-17T02:21:13Z`, `last_station: 04-scanner` — the 02:21Z run took
`instrument-honesty` (position 2 of 4) and advanced correctly. The sweep owed next is **`repo-hygiene`**
(position 3 of 4). It was **not run**: its brief prescribes orphaned-worktree locks, stash growth in
the watcher clone `C:\po-watcher`, and merged-but-undeleted branches — all of which need PowerShell or
the watcher clone, neither reachable here. Choosing a different sweep is forbidden by AUTHORITY
("Which one is NOT your choice"). **The rotation was NOT advanced** — `repo-hygiene` is still owed.
One item from that sweep *was* obtainable on the safe surface and is recorded below as a positive
control, but a single item is not the sweep.

---

## WHAT I MEASURED

**Device-bridge git guard** — installed before any other VM-side call, per preflight. Last line quoted
verbatim as the contract requires, pass or fail:

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd,
  allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Reported **PASS** (exit 0). **That PASS is misleading and I should not have trusted it** — see F2.
[MEASURED]

**Shell reachability.** Three `ToolSearch` loads, two answered *"still connecting"* rather than *"not
found"*, then `CONNECT_TIMEOUT` from the server itself. [MEASURED] → F1.

**The Linux mount and the native Windows file surface both survived.** [MEASURED]

```
$ ls -d /sessions/*/mnt/ProjectOperations2   -> /sessions/<id>/mnt/ProjectOperations2
$ node --version                             -> v22.23.2
```

The native file-read surface resolved `C:\ProjectOperations2` directly. **Desktop Commander was down
while both other surfaces were up**, as the 2026-09-16T22:11Z run recorded (its F2, still open — not
re-filed here).

**Refs and host-activity timestamps, read as files (no git binary invoked for these).** [MEASURED]

```
cat .git/HEAD                      -> ref: refs/heads/main
cat .git/refs/heads/main           -> ebe7a599d59e49769956c9739e951e0174a73b65
cat .git/refs/remotes/origin/main  -> ebe7a599d59e49769956c9739e951e0174a73b65

stat -c %Y .git/refs/heads/main          -> 1789624491 = 2026-09-17T05:54:51Z
stat -c %Y .git/refs/remotes/origin/main -> 1789624491 = 2026-09-17T05:54:51Z
stat -c %Y .git/index                    -> 1789624497 = 2026-09-17T05:54:57Z
stat -c %Y .git/FETCH_HEAD               -> 1789624511 = 2026-09-17T05:55:11Z
now                                      -> 1789625620 = 2026-09-17T06:13:40Z
```

`.git/packed-refs` disagrees — it still holds `4ea28d6d refs/heads/main` and
`66194af6 refs/remotes/origin/main`. Loose refs win in git, so the values above are operative, but
**a station that greps `packed-refs` gets a months-stale answer that looks perfectly well-formed.**
Same §9-class trap candidate the 22:11Z run flagged, reproduced at a new SHA; not re-filed.

**No lock and no in-progress merge state in the dev tree.** [MEASURED]

```
.git/index.lock  -> No such file or directory
MERGE_HEAD / REBASE_HEAD / CHERRY_PICK_HEAD / rebase-merge / rebase-apply / sequencer -> none
docs/qa/.qa-run.lock -> No such file or directory   (no concurrent QA run; nothing to stand down for)
```

**GitHub-side cross-check — labelled facts, corroboration only, NOT coverage.** [MEASURED]

```
list_commits(GH-Mantova/ProjectOperations, sha=main, perPage=4)
  ebe7a599  2026-09-17T05:54:17Z  feat(tendering): scopecards S2b-a - destination control on WBS items (SCOPE_QD_UI_ITEMS_V1) (#1990)
  5d074526  2026-09-17T03:57:39Z  docs(pr-prompts): stage scopecards S6 (HOLD) (#1989)
  71f5a06b  2026-09-17T03:52:52Z  docs(sot): reconcile sot/04 generated section, refresh sot/02 snapshot (#1987)
  5860687e  2026-09-17T03:43:15Z  feat(crm): register residual (CRM_REGISTER_RESIDUAL_V1) (#1986)
```

GitHub's `main` tip **equals** the dev tree's `origin/main` ref, and that merge landed at 05:54:17Z —
**34 seconds before** the dev tree's refs were rewritten at 05:54:51Z. → F1.

**BOARD TRAP — CLEAN, with a positive control.** [MEASURED] Read on the **safe surface**
(`get_file_contents`, GitHub API — no device bridge), after F2 made me stop using the local one:

```
get_file_contents(docs/pr-prompts/, ref=refs/heads/main)
  *-ready.md at depth 1 on origin/main  ->  0
  *-HOLD.md  at depth 1 on origin/main  ->  41   (positive control: the probe can see prompt files)
```

**Zero tracked `*-ready.md` at depth 1.** The board trap is not firing. The positive control matters:
a listing that returned nothing would look identical to a clean board.

**The one live arm, and why it is correct rather than drift.** [MEASURED]

```
dev tree, depth 1, *-ready.md  ->  exactly one:
  pr-scopecards-s2b-b-destination-sections-ready.md   10224 bytes, mtime 2026-09-17T04:02:46Z
    requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_QD_UI_ITEMS_V1'
origin/main tracks the pre-rename twin:  pr-scopecards-s2b-b-destination-sections-HOLD.md
dev tree has NO HOLD twin for that slice  ->  the arm is a clean untracked rename, not a duplicate
```

Its gate marker `SCOPE_QD_UI_ITEMS_V1` is exactly what PR #1990 landed at 05:54:17Z. So the prompt was
armed at 04:02Z while still gated, and **its gate released 1h52m later, 19 minutes before this run.**
Correct sequencing, not drift — live work waiting for the watcher.

**The obvious follow-on hazard was tested and does NOT fire.** [MEASURED] If the host's dev-tree sync
restored tracked files, the `-HOLD` twin would reappear beside the untracked `-ready`, handing the
watcher both. It does not: `pr-scopecards-s2b-a-destination-control-items-HOLD.md` is **tracked on
main and absent from the dev tree** — the consumed prompt the watcher retired locally survived the
05:54:51Z sync. **The observed sync is fetch + fast-forward of refs and preserves local prompt-queue
state; it is not a checkout or hard reset.** Recorded as a positive result so a later run does not
re-derive the fear. (A prompt for the durable version of this, `pr-devtree-sync-ff-only-guard-HOLD.md`,
is already tracked on main — nothing to stage.)

Two conditions other stations already own reproduced and are **not** re-filed: consumed prompts still
tracked on main while only the dev tree knows they are spent (Station 00, 2026-09-15-0209), and arms
existing only in the dev tree (Station 00, 2026-09-15-0308).

**`check-breadcrumb.mjs` — RAN, exit 0.** [MEASURED]

```
$ node scripts/pipeline/check-breadcrumb.mjs docs/pr-prompts/00-04-scanner-2026-09-17-0611-...md
NOTE    00-04-scanner-2026-09-17-0611-...md is UNTRACKED — it reaches nobody until a board PR commits it
ADMIT   00-04-scanner-2026-09-17-0611-...md
structure: 25 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)
CLEAN
exit=0
```

Structure is validated. **Nothing else in this report is** — and the manner in which this check
obtained its UNTRACKED verdict is itself F2.

**Scope of that verdict, stated precisely.** `check-breadcrumb.mjs` ran against an **earlier revision**
of this same path, before F2 was understood. It was **not re-run** on the final text, because doing so
would fire two more bridge `git` reads and falsify this report's own claim to have stopped. The final
revision was instead structurally verified without the bridge, and the result is quoted so the check is
re-doable: [MEASURED]

```
$ grep -n "^## " <this file>
3:## GROUND   58:## WHAT I MEASURED   200:## WHAT CHANGED   220:## FINDINGS   368:## WHAT I DID NOT DO
$ grep -n "DISPOSITION:" <this file>   -> 2 hits, both literal ESCALATED
$ ls -l .git/index.lock                -> No such file or directory   (clean after this run's two reads)
```

Five sections, fixed order, every finding dispositioned. **This is not a `check-breadcrumb.mjs` verdict
and must not be quoted as one** — the contract reserves the word `breadcrumb-clean` for that script's
own exit 0, and this run does not claim it for the final text.

---

## WHAT CHANGED

**Nothing on the board.** No prompt staged, armed, renamed, moved or deleted. No label touched. No
merge. No push. No commit. **No `git` command that WRITES** ran against any tree.

**Two unintended `git` READS against the mounted Windows `.git`** — `git ls-tree -r --name-only
origin/main -- docs/pr-prompts` and `git ls-files docs/pr-prompts`, once inside `check-breadcrumb.mjs`
and once in the probe that diagnosed it. Both exited 0 and neither left a lock
(`.git/index.lock` absent, re-checked after). Disclosed, not hidden — see F2.

**One file written:** this breadcrumb, at
`C:\ProjectOperations2\docs\pr-prompts\00-04-scanner-2026-09-17-0611-the-host-fetched-a-merge-34-seconds-before-desktop-commander-timed-out-on-me.md`.
It is **untracked** — Station 00 sweeps it up. A breadcrumb filename matches no watcher glob, so
leaving it in the queue root arms nothing.

**`docs/pipeline/sweep-rotation.json` was NOT touched.** Unchanged at `last_index: 1`,
`last_run_utc: 2026-09-17T02:21:13Z`. `repo-hygiene` remains owed.

---

## FINDINGS

### F1 — The host was alive and merging 34 seconds before Desktop Commander timed out on me

**New evidence on the OPEN escalation** filed by the 2026-09-16T22:11Z run (its F1), which asked Marco
to choose among three remedies for the intermittent Desktop Commander outage. That escalation recorded
the cause as unknown and could not distinguish *"the Windows host is down"* from *"the Desktop
Commander process is hung."* **This run separates them.**

[MEASURED] At 05:54:17Z PR #1990 merged to `main`. At **05:54:51Z** — 34 seconds later —
`C:\ProjectOperations2\.git\refs\heads\main` *and* `refs/remotes/origin/main` were both rewritten to
that commit; `.git/index` at 05:54:57Z; `.git/FETCH_HEAD` at 05:55:11Z. Something on the Windows host
fetched and fast-forwarded the dev tree within a minute of the merge landing.

[MEASURED] **Sixteen minutes later**, at 06:11Z, Desktop Commander failed its MCP handshake with
`CONNECT_TIMEOUT … after 30000ms`.

[INFERRED] The host was therefore **powered, logged in, and executing scheduled git work** inside the
same quarter-hour in which its Desktop Commander server would not answer a 30-second handshake. That
**eliminates "host down / logged off"** for this occurrence, and makes **"too loaded to respond"**
implausible for a box that completed a fetch and ref update in six seconds. It points at the Desktop
Commander server process itself — hung, or not listening — which is the one thing a blind run can
never restart.

[MEASURED] Blind rate across the last six Station 04 slots, from breadcrumb filenames in
`docs/pr-prompts/` (4-hourly cadence, all six slots present, none missed):

```
2026-09-16 10:11Z  BLIND
2026-09-16 14:10Z  BLIND
2026-09-16 18:10Z  sighted
2026-09-16 22:11Z  BLIND
2026-09-17 02:21Z  sighted
2026-09-17 06:11Z  BLIND   <- this run
```

**4 of 6**, against the "roughly 40%" the bootstrap records for Station 00. Three sweeps have been
owed and skipped in that window; `repo-hygiene` is now owed for a second consecutive attempt.

[CANNOT MEASURE] Whether a stale Desktop Commander process is currently resident on the host. That
needs the host. Two honest attempts (this run's three loads, the 22:11Z run's four) have failed.

**Question for Marco — not a status update.** The 22:11Z escalation offered three options without
knowing whether the server was *slow* or *hung*. This run says the host is healthy and the server
alone is not answering, which **retires option 2 and sharpens option 1**:

1. **Complete and additive (RULE 1 — passes both halves).** Have the scheduled task, before the
   station's own preflight, probe the Desktop Commander process and **restart it** when it does not
   answer, then proceed. The new measurement makes this targeted rather than a guess: the host is up,
   so a restart is available and cheap. Fixes the intermittency at source for every station, adds no
   new failure mode, touches no data. Needs your hand on the host **once** to establish the restart
   command; unattended thereafter.
2. ~~Raise the MCP connect timeout past 30s.~~ **Now weakly supported.** It helps only if the server is
   slow, and a host that fetched and updated refs in six seconds is not slow. Still fails the
   "solves it for the future" half, and this run removes most of its remaining rationale.
3. **Complete but not additive.** Have a blind station fail the scheduled run loudly rather than write
   a breadcrumb. Makes the outage impossible to miss, but destroys the only record a blind run
   produces — including this measurement, which existed *because* a blind run still reports. Fails the
   "without damaging existing entry" half.

**DISPOSITION: ESCALATED** — to the same open escalation as 2026-09-16T22:11Z F1, with the
host-is-alive discriminator attached. Not a new escalation; do not count it twice.

### F2 — The contract orders every station to run a script that drives `git` through the device bridge, and the guard that should stop it is bypassed in the shell stations actually use

[MEASURED] The guard installed and self-reported **PASS**, including the line *"persistence controls
passed: .bashrc byte-identical on re-run; **login shell** resolves shim"*. In the shell this station
actually runs in, it does not:

```
$ echo "$PATH"
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin      <- no $HOME/.local/bin
$ ls -l $HOME/.local/bin/git      -> -rwxr-xr-x 1149 bytes   (shim present on disk)
$ which git                       -> /usr/bin/git             (real git, shim bypassed)
$ grep -n local/bin ~/.bashrc ~/.profile
  .bashrc:118  export PATH="$HOME/.local/bin:$PATH"
  .profile:25  if [ -d "$HOME/.local/bin" ] ; then ...
```

The bash tool spawns a **non-interactive, non-login** shell, so neither file is sourced. The guard's
own self-test passes on a surface nobody uses and is silent about the one everybody does. **A PASS
that is true only in a shell the station never enters is a §7 instrument lie in the first command of
the preflight.**

[MEASURED] Real git therefore reaches the mounted Windows `.git`, and it works:

```
$ git ls-tree -r --name-only origin/main -- docs/pr-prompts
docs/pr-prompts/.arming-log.txt ...                                   exit=0
$ git ls-files docs/pr-prompts
docs/pr-prompts/.arming-log.txt ...                                   exit=0
```

[MEASURED] **The station contract mandates a script that does exactly this.** `check-breadcrumb.mjs` —
named in the REPORT CONTRACT as the breadcrumb's *one* validator, the check the 22:11Z run celebrated
as the only one that survives a blind run — shells out at line 98:

```js
const probes = [`git ls-tree -r --name-only origin/main -- ${DIR}`, `git ls-files ${DIR}`];
... execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })   // stderr discarded
```

So **every station that obeys the report contract from the sandbox fires two `git` invocations against
the Windows `.git` through the device bridge** — the hard stop's named prohibition — and, because
`stderr` is discarded and there is a silent fallback, it does so with no signal either way. Had the
guard been in force, both probes would have been refused, `tracked()` would have returned `null`, and
the UNTRACKED/tracked verdict would have degraded silently instead of erroring.

[INFERRED] This is why my own draft was wrong twice. I wrote trackedness `[CANNOT MEASURE]` and "no
`git` was run against any tree" while the validator I had just run was doing precisely that. **I was
reporting the guard's claim rather than the system's behaviour** — the failure DOCTRINE §7 exists to
catch, committed in a report about §7.

[MEASURED] Blast radius: no lock was left (`.git/index.lock` absent before and after), and both
commands are reads. The risk is not this run; it is that the prohibition DOCTRINE §9.2 records —
a cut-short bridge `git` leaving a 0-byte `index.lock` that never expires and freezes every station —
is **routinely exercised by contract-mandated tooling** on a surface where the guard is off. It has
been surviving on luck.

**Not re-filed:** the guard's non-interactive PATH failure is already owned by Station 05's
`00-05-sot-keeper-2026-09-16-1411-the-vm-git-guard-did-not-load-in-a-non-interactive-sandbox-shell-and-left-the-lock-it-exists-to-prevent.md`
(tracked on main). It **reproduces unfixed a day later**, and this run adds the part that breadcrumb
does not cover: the caller is not an errant station, it is the contract's own validator.

**Question for Marco — not a status update.** Two binding documents disagree: the REPORT CONTRACT says
run `check-breadcrumb.mjs`; the hard stops say never drive `git` through the bridge at the Windows
`.git`. Today the conflict is resolved by the guard silently not working.

1. **Complete and additive (RULE 1 — passes both halves).** Make the guard effective where it is
   actually used — install the shim ahead of `/usr/bin` for non-interactive shells too (a `BASH_ENV`
   or wrapper-level install, not `.bashrc`), **and** give `check-breadcrumb.mjs` a bridge-safe path to
   trackedness that does not shell out to the mounted `.git` — the GitHub API listing this run used
   returns the same answer and touches no lock. Both layers then hold: the guard stops the class, and
   the one mandated caller no longer needs the thing being stopped. Nothing is removed, no verdict is
   lost, no data is touched.
2. **Additive but incomplete.** Fix only the guard's PATH. The prohibition becomes real, but
   `check-breadcrumb.mjs` then starts hitting a refusal it discards to `stderr`, silently losing the
   tracked/UNTRACKED verdict on every blind run — trading a live hazard for a silent blind spot.
   Fails "solves it completely."
3. **Complete but not additive.** Drop `check-breadcrumb.mjs` from the blind-run path. Removes the
   bridge calls outright, but it is the only structural validation a blind run has, and blind runs are
   4 of the last 6. Fails "without damaging existing entry."

**DISPOSITION: ESCALATED** — the conflict is between two binding documents and the fix touches the
guard's design. Not mine to resolve, and not stageable from a blind run.

---

## WHAT I DID NOT DO

- **Did not run the owed `repo-hygiene` sweep, and did not advance the rotation.** Its probes need
  PowerShell or the watcher clone. Advancing without running would silently consume the slot — the
  exact failure the rotation exists to prevent. One of its items (the board trap) was obtainable on the
  safe surface and is reported above as a positive control; one item is not the sweep.
- **Did not substitute GitHub-side reads for the sweep.** The commit list and the directory listing are
  labelled corroboration. `origin/main` on GitHub is not the tree the watcher globs, and the contract
  forbids presenting it as coverage.
- **Did not run any further `git` against the mount once F2 was understood.** The board-trap answer was
  taken from the GitHub API instead, precisely to avoid the bridge. The two calls that did happen are
  disclosed under WHAT CHANGED rather than omitted.
- **Did not repair the guard, patch `check-breadcrumb.mjs`, or stage a prompt for either.** Both are
  pipeline-script changes; I am READ-ONLY on the board, blind, and cannot lint verifiably. Escalated
  with options instead.
- **Did not re-file findings other stations own** and which reproduced here: the 22:11Z F2 (step 1
  treats the shell and the mount as one surface), the `packed-refs` staleness trap, Station 05's guard
  PATH breadcrumb, and Station 00's two dev-tree-arm conditions.
- **Did not touch `sot/`, source, any prompt file, any label, or any branch.**
- **Did not mint a worktree** — forbidden by AUTHORITY, and impossible without a shell.
- **Did not run Part 0, Part 1 or Part 2.** Step 1 fired STOP. Part 2 needs the live site and Chrome;
  Part 0's greps would have run against a working copy the contract forbids trusting.
