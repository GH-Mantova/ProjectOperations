# Station 04 — Scanner | 2026-09-21T22:10Z–2026-09-21T22:16Z

> ⚠️ **THIS WAS A BLIND RUN.** Desktop Commander did not connect. No PowerShell shell on the
> Windows host was obtained, therefore no sweep was run, the board was not read, and the
> rotation was NOT advanced. The quiet in this report is the quiet of an instrument that was
> switched off — not the quiet of a healthy board. Read it as a defect report, not as coverage.

## GROUND

```
UTC            2026-09-21T22:10:25Z
origin/main    4e0d4087               [CANNOT MEASURE via sanctioned path — see M3; value read from .git/refs, not `git fetch` + `rev-parse`]
dev tree       main @ 4e0d4087        C:\ProjectOperations2   [read by `cat .git/HEAD` + `cat .git/refs/heads/main`, no git invocation]
doc version    1                      (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                      (scheduled-task SKILL.md line 4)
```

Doc version and bootstrap AGREE. No version-mismatch read-only clamp was triggered. The run is
read-only anyway, for the separate reason in F1.

🔴 **The two git lines above were NOT obtained the way the contract specifies.** The contract
requires `git fetch origin` then `git rev-parse origin/main`, run in a PowerShell shell on the
Windows host. That shell was unreachable. The SHAs above come from reading the ref files on the
mount with `cat`. They are the dev tree's *local idea* of `origin/main`, never refreshed this run,
and `.git/packed-refs` still carries an older `66194af6` for the same ref. Treat `4e0d4087` as
"what this tree last fetched", not as "what `main` is now". Nothing in this report depends on it.

## WHAT I MEASURED

**M1 — Desktop Commander is absent. [MEASURED]**
Per the contract, the tool schema was loaded FIRST; a validation error would not have been
blindness. Three `ToolSearch` calls were made before any conclusion was drawn:

```
ToolSearch "desktop-commander"                        -> No matching deferred tools found.
                                                         "Some MCP servers are still connecting:
                                                          plugin:desktop-commander:desktop-commander"
ToolSearch "start_process powershell terminal session" -> returned session_info / computer-use /
                                                          claude-in-chrome tools; NO desktop-commander tool
ToolSearch "+desktop-commander start process read file" -> No matching deferred tools found. (still connecting)
```

The server then resolved, and resolved to a failure:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

This is a failure **after** the load attempt, and the server is reported in the harness's
*failed-to-connect* list, not its *still-connecting* list. Under PREFLIGHT step 1 that is
blindness, and it is a STOP. No `start_process` call was possible; `powershell.exe` does not exist
in the Linux sandbox either — `command -v pwsh powershell powershell.exe` returned nothing,
exit 1.

**M2 — vm-git-guard reports success and is INERT in the shell this station actually uses. [MEASURED]**
Installer last line, quoted as the contract requires:

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/kind-practical-einstein/.local/bin/git - refuses mounted paths
  and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

It says *passed*. It is not in effect. In the very next shell call, from inside the mount:

```
$ cd "$HOME/mnt/ProjectOperations2" && git rev-parse --short origin/main
4e0d4087            <- SUCCEEDED. The guard should have REFUSED this.
git-exit=0

$ echo "PATH=$PATH"
PATH=/usr/local/lib/node_modules_global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
                    ^ $HOME/.local/bin is NOT on it

$ command -v git
/usr/bin/git        <- the real git, not the shim

$ ls -la "$HOME/.local/bin/git"
-rwxr-xr-x 1 ... 1149 Sep 22 08:10 /sessions/kind-practical-einstein/.local/bin/git   <- shim exists, unused

$ grep -n "local/bin" "$HOME/.bashrc" "$HOME/.profile"
.bashrc:118:export PATH="$HOME/.local/bin:$PATH"
.profile:25-28: (same)
```

Reproduced across two consecutive independent shell calls. See F2.

**M3 — no concurrent run, no stale lock. [MEASURED]**
`ls docs/qa/` shows no `.qa-run.lock`. `ls .git/index.lock` -> "No such file or directory".
The tree is not frozen. (The CONCURRENCY GUARD's lock file and `docs/qa/qa-checklist.md` /
`docs/qa/qa-findings.md` are gitignored state files; they were read only, and nothing from this run
was recorded into any of them — findings live in this tracked breadcrumb.)

**M4 — due sweep identified, NOT run. [MEASURED]**
```
$ node scripts/pipeline/next-sweep.mjs
SWEEP: instruction-drift
(rotation position 4 of 4; previous run: 2026-09-21T18:09:53Z)
```
The due sweep diffs each scheduled-task bootstrap under `C:\Users\Marco\Claude\Scheduled` against
its repo station doc. **That directory is not under any mounted folder.** It is reachable only via
Desktop Commander. Of the five sweeps in rotation, the one that came up is the one that is
*entirely* unreachable when Desktop Commander is down. See F3.

**M5 — the fragment of instruction-drift I legitimately hold. [MEASURED, 1 of N — NOT COVERAGE]**
Exactly one bootstrap was in hand without the Windows shell: this station's own, delivered into
the session at `uploads/SKILL.md`.
```
$ grep -n station_doc_version uploads/SKILL.md   -> line 4: <!-- station_doc_version: 1 -->
   repo docs/pipeline/stations/04-scanner.md     -> station_doc_version: 1
   => MATCH
$ node scripts/pipeline/lint-station.mjs
ADMIT: all 8 docs clean      (exit 0)
ADMIT docs/pipeline/stations/04-scanner.md (v1)  + 00,01,02,03,05,06, DOCTRINE, .claude/agents/*.md
```
`lint-station.mjs` emits non-fatal `!` advisories about Windows paths outside its folder map in
DOCTRINE.md, 04-scanner.md (`C:\po-scan-`) and 06-pr-master.md (`C:\po-`). These are pre-existing,
non-blocking, and several are quoted-example paths; not filed as a finding.

**This is one bootstrap out of five and it must not be read as the sweep.** The other four were
not seen. The rotation was deliberately left un-advanced so the next sighted run gets
instruction-drift in full.

**M6 — `origin/main`-side reads were deliberately NOT substituted. [MEASURED — a non-action]**
The GitHub connector is loadable in this session. It was not used. PREFLIGHT step 1 forbids
presenting GitHub-side reads as coverage for a tree the watcher globs locally, and doing so is the
exact mechanism by which a blind run becomes indistinguishable from a healthy one.

## WHAT CHANGED

**On the board: nothing.** No prompt staged, armed, disarmed, renamed, moved or deleted. No PR
opened, no label touched, no merge, no push, no commit. `docs/pipeline/sweep-rotation.json` was
**not** advanced and is **not** dirty.

**In the VM sandbox:** `vm-git-guard.sh` was run once, per PREFLIGHT step 1. It wrote a shim to
`$HOME/.local/bin/git` and appended a PATH export to `$HOME/.bashrc` and `$HOME/.profile`. This is
sandbox-local and is discarded with the session; it does not touch the repo or the Windows host.

**In the repo working tree:** this breadcrumb file only, at
`docs/pr-prompts/00-04-scanner-2026-09-21-2210-BLIND-dc-connect-timeout.md`. It is **untracked** —
Station 00 sweeps it up; 04 may not commit.

One git command, `git rev-parse --short origin/main`, did execute against the mount (M2) because
the guard that exists to refuse it was inert. `rev-parse` does not open the index, so no
`index.lock` was created — confirmed absent in M3. No further git was run there after the guard
defect was understood.

## FINDINGS

### F1 — Desktop Commander CONNECT_TIMEOUT: this station ran blind, and the cadence hides it

**Severity: S2.** Evidence in M1. Station 04's cadence is 4 hours. A blind run and a healthy quiet
run emit the same shape of report, and `check-breadcrumb.mjs --freshness` counts a breadcrumb as
presence regardless of whether the station could see anything — so a station that is blind every
run still reads as alive. The harness's own message distinguishes *still connecting* from
*failed to connect*; this was the latter, with an explicit 30000ms timeout, so it is not a
first-call warm-up artefact.

STATION-CAPABILITIES §2 records that blindness is intermittent, roughly 40% of Station 00's recent
runs, and that its cause is **not known**. This run is one more sample with a specific, quotable
error string attached — `CONNECT_TIMEOUT ... after 30000ms` — which previous samples may not have
had. A 30s connect timeout is a different failure from an absent server, and it points at a
startup/handshake cost rather than a missing binary.

**Question for Marco, with options. RULE 1 ranks them; the complete-and-additive one is first.**

1. **Raise the Desktop Commander MCP connect timeout and make each station report the handshake
   result as a GROUND line.** Complete: if the cause is a slow handshake on a cold Windows host,
   a longer timeout removes the failure rather than detecting it afterwards. Additive: a GROUND
   line costs nothing and cannot damage data entry. Passes both halves of RULE 1. It does need
   the timeout to be configurable where the plugin is defined — Marco's to check.
2. **Instrument only: have every station emit a machine-countable `dc: reachable|CONNECT_TIMEOUT`
   line so the 40% figure becomes a measured series with causes attached.** Fails the *immediate*
   half of RULE 1 — it diagnoses and fixes nothing. Additive, and worth doing alongside option 1.
3. **Leave it; treat blindness as weather.** Fails both halves. Named only so the do-nothing
   option is on the record: roughly two in five runs of a 4-hourly station producing no coverage
   while reporting normally is a monitoring system that reports on itself.

**DISPOSITION: ESCALATED** — needs Marco. Cause is unknown and the fix touches plugin/MCP
configuration, which is not 04's to change and is not verifiable from inside a blind run.

### F2 — `vm-git-guard.sh` self-certifies success while being inert in the station's actual shell

**Severity: S2.** This is a DOCTRINE §7 instrument lie sitting in the first step of every station's
preflight — the one step the contract says every run begins with.

The guard installs a `git` shim at `$HOME/.local/bin/git` and appends
`export PATH="$HOME/.local/bin:$PATH"` to `.bashrc` and `.profile`. Its final self-check asserts
*"login shell resolves shim"* and prints **passed**.

The station's shell is neither a login shell nor an interactive one. The harness runs
`bash -c "<command>"`, and non-interactive bash sources **neither** `.bashrc` (skipped unless
`BASH_ENV` is set) **nor** `.profile` (login-shell only). Measured consequence, M2: `PATH` has no
`$HOME/.local/bin`, `command -v git` resolves to `/usr/bin/git`, and `git rev-parse` against the
mount **succeeded** where the guard should have refused.

Why this matters more than it looks: the guard exists because a cut-short `git` against the mount
leaves a 0-byte `index.lock` with no owning Windows process, which never expires and freezes every
station (DOCTRINE §9.2). The bullets telling stations not to run git there did not stop the next
occurrence — which is precisely why the guard was written, and why the contract orders it installed
first and its last line quoted. **A guard whose own control passes while the protection is absent
is worse than no guard**, because it converts "I must be careful here" into "the guard has this".
This run is the demonstration: a station that had just installed the guard and read its *passed*
line went on to run git against the mount in the next call.

No `index.lock` resulted this time, because `rev-parse` does not open the index (M3). The next
station to reach for `git status`, `git diff`, `git add` or `git stash` under the same false
assurance would not be as lucky.

**Fix, stated but NOT applied** (04 is read-only on the board and may not open a PR): make the
shim's reachability independent of shell startup files, and make the self-check test the shell the
stations actually use rather than a login shell. Concretely — have the check run
`env -i bash -c 'command -v git'` and a non-interactive `bash -c` probe from inside a mounted
directory, and fail loudly if either resolves to the real git; and set `BASH_ENV` (or install the
shim somewhere already on the default `PATH`) so a non-interactive `bash -c` picks it up. Both are
additive and cannot damage data entry — RULE 1 clean. The self-check change matters more than the
PATH change: without it, the next PATH regression is silent again.

**DISPOSITION: ESCALATED** — Station 04 may not open a PR, and this defect sits in shared preflight
machinery binding all seven stations, so it should not be patched by the station that happens to
have tripped over it. Marco or Station 00 to route. Recommend this go ahead of routine queue work:
every station runs this installer, every station is currently being told *passed*, and the failure
mode it is supposed to prevent is a frozen board.

### F3 — the due sweep is unreachable exactly when Desktop Commander is down

**Severity: S3.** Evidence in M4. `next-sweep.mjs` returned **instruction-drift**, whose whole
subject is the bootstrap files under `C:\Users\Marco\Claude\Scheduled` — a path outside every
mounted folder, reachable only through the tool that had just failed.

The rotation has no notion of reachability, so a blind run lands on whichever sweep is next and, if
that sweep is instruction-drift, produces nothing. Because the rotation is only advanced by a
*completed* sweep, this is self-correcting rather than dangerous — the next sighted run gets
instruction-drift. The cost is a wasted slot, once per blind run that lands on it. Worth noting
that instruction-drift is also the sweep whose stated reason for existing is that *"five pasted
copies drifted for weeks and four carried advice this pipeline had already disproved"* — so it is
not a cheap sweep to keep missing.

Nothing to do now. **What would make this urgent:** two consecutive blind runs landing on
instruction-drift, or `next-sweep.mjs` showing the rotation stuck at position 4 across more than
about a day. If that happens, the fix is to have `next-sweep.mjs` accept a "could not run, not my
turn to advance" signal and offer the next *reachable* sweep instead — additive, no data at risk.

**DISPOSITION: DEFERRED** — real, not now. The rotation was correctly left un-advanced, which is
the behaviour that makes deferral safe.

## WHAT I DID NOT DO

- **Did not run the due sweep (instruction-drift), and did not run any substitute sweep.** Blind.
  Picking a different, reachable sweep is explicitly not 04's choice (AUTHORITY: "Which one is NOT
  your choice and NOT the first on a list") and would have narrowed coverage while masking the
  outage.
- **Did not advance the rotation.** `next-sweep.mjs --advance` was not called;
  `sweep-rotation.json` is untouched and clean. Advancing on a sweep that never ran would silently
  skip instruction-drift for another full cycle.
- **Did not run Part 0, Part 1 or Part 2.** Part 0's greps are technically runnable over the mount,
  but the contract's STOP is not a suggestion, and a partial static pass presented in a blind run's
  report is the exact substitution PREFLIGHT step 1 names. Part 1 needs the GitHub connector
  (forbidden as coverage here, M6); Part 2 needs the live site and a browser session.
- **Did not read the board, did not run `status-sweep.ps1`.** It is PowerShell; there is no
  PowerShell in this sandbox (M1). No `[LIVE]` verdict was obtained, so none is quoted. **Nothing
  in this report should be read as a statement about the board's current state.**
- **Did not stage a prompt, including for F2.** 04 may stage a lint-clean `-HOLD`, but staging from
  a blind run means staging without a verified gate read, and the CLEAN-TREE MANDATE forbids
  trusting a gate check taken from an unverified tree. `NO-OP: could not stage verifiably — blind
  run, no Windows shell.`
- **Did not run `check-breadcrumb.mjs` against this file.** It is `node`, so it was available; it
  was skipped because the validator resolves tracked breadcrumbs through `git` against the repo,
  and F2 established that the guard meant to make that safe is inert. Refusing to run more git
  against the mount was the cheaper error. **Therefore do not read `breadcrumb-clean` anywhere in
  this report — it does not appear, and this file's conformance to the five-section contract is
  asserted by construction, not by the validator.** Station 00 should run it when it sweeps this up.
- **Did not touch Azure, Entra or SharePoint**, and did not go near production data.
