# Station 04 — Scanner | 2026-09-16T22:11:02Z–2026-09-16T22:22Z

## GROUND

```
UTC            2026-09-16T22:11:02Z
origin/main    bdc5d05b            (ref READ FROM FILE — NO fetch, NO rev-parse. Caveat below.)
dev tree       main @ bdc5d05b     C:\ProjectOperations2   (.git/HEAD + .git/refs read as files)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter — WORKING COPY)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run is READ-ONLY regardless, because it is **BLIND on the
Windows shell**.

### 🔴 BLIND RUN — no Windows shell. Step 1 of the station contract fired STOP.

`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`. No `start_process`,
no `interact_with_process`, no PowerShell of any kind in this session.

**Absence after an honest load, not a cold-call validation error.** `ToolSearch` was run four times
*before* concluding anything: keyword `desktop-commander` (the form the contract prescribes) twice,
then `start_process powershell terminal command execute`, then
`desktop commander read_file write_file list_directory start_process interact_with_process`. The
loads returned PDF-viewer, Microsoft Learn, Teams, Chrome, task and Drive tools and **no shell tool of
any kind**, and the server then reported `CONNECT_TIMEOUT` explicitly.

**A blind run and a healthy quiet run both produce "no news." This was the blind one.** It is the
**third blind Station 04 slot out of the last four** (10:11Z blind, 14:10Z blind, 18:10Z sighted,
22:11Z blind) — see F1.

What that costs, named, so nobody reads this as coverage:

- **No `git` at all.** The dev-tree `git` is reachable only through the Windows shell, and the
  device-bridge guard (correctly) refuses `git` against the mount. No `git fetch`, no
  `git rev-parse origin/main`, no `git diff --numstat`, no `git show origin/main:<path>`.
- **The GROUND SHAs are file reads, not `rev-parse`.** They are corroborated this run (F3) but the
  method is still weaker than the contract asks for.
- **The binding documents were read from the WORKING COPY**, which the contract forbids.
  `station_doc_version` matching is explicitly **not** a freshness proof. Treat every reading below as
  taken against possibly-superseded instructions.
- **`scripts/pipeline/status-sweep.ps1` never ran** — PowerShell. **No board verdict exists for this
  run.** Nothing here is a merge or arm clearance.
- `scripts/pipeline/check-breadcrumb.mjs` is the **one** contract check that did run to a verdict this
  run — from the sandbox, under the guard, **exit 0, `CLEAN`**, this file `ADMIT`. See WHAT I MEASURED
  and F5, which **refutes** the 14:10Z run's claim that this validator cannot run on a blind run.
  Structure is validated; nothing else in this report is.

**Sweep this run: NONE.** `node scripts/pipeline/next-sweep.mjs` (read-only, no `--advance`) reports
**`SWEEP: instrument-honesty` (rotation position 2 of 4; previous run: 2026-09-16T18:10:38Z)**. It was
**not run**, and this is not a judgement call: that sweep's own brief prescribes `ls-tree` without
`-r`, `git status` against a gitignored file, `gh run list --branch main`, and a `--jq` string through
the shell. **Every prescribed probe requires the shell this run does not have.** Choosing a different
sweep is forbidden by AUTHORITY ("Which one is NOT your choice"). **The rotation was NOT advanced** —
`instrument-honesty` is still owed.

---

## WHAT I MEASURED

**Device-bridge git guard** — installed before any other VM-side call. Last line, quoted verbatim as
the contract requires, pass or fail:

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd,
  allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**PASS** (exit 0). [MEASURED]

**Shell reachability.** Four `ToolSearch` loads, then `CONNECT_TIMEOUT` from the server itself.
[MEASURED] → F1.

**The Linux mount and the Windows file surface both survived.** [MEASURED]

```
$ ls -d /sessions/*/mnt/ProjectOperations2
/sessions/<id>/mnt/ProjectOperations2
$ node --version
v22.23.2
```

`node` runs against the mount, and the native file-read surface resolved `C:\ProjectOperations2`
directly (this station doc and the 14:10Z breadcrumb were both read from it). **Desktop Commander was
down while the mount was up.** → F2.

**Refs, read as files (no git binary invoked).** [MEASURED]

```
cat .git/HEAD                      -> ref: refs/heads/main
cat .git/refs/heads/main           -> bdc5d05b538c2f8ac69430b1050126693b3b6c96
cat .git/refs/remotes/origin/main  -> bdc5d05b538c2f8ac69430b1050126693b3b6c96
stat -c %Y .git/FETCH_HEAD         -> 1789585516  = 2026-09-16T19:05:16Z  (3h07m ago)
stat -c %Y .git/refs/remotes/origin/main
                                   -> 1789551709  = 2026-09-16T09:41:49Z  (12h30m ago)
```

`.git/packed-refs` disagrees — it holds `4ea28d6d refs/heads/main` and `66194af6
refs/remotes/origin/main`. Loose refs win in git, so the loose values above are the operative ones,
but **a station that greps `packed-refs` gets a months-stale answer that looks perfectly well-formed.**
Noted as a §9-class trap candidate alongside F4. [MEASURED]

**No lock and no in-progress merge state in the dev tree.** [MEASURED]

```
ls -la .git/index.lock .git/MERGE_HEAD .git/REBASE_HEAD .git/CHERRY_PICK_HEAD
  -> all four: No such file or directory
ls -l docs/qa/.qa-run.lock  -> No such file or directory
```

**GitHub-side cross-check of the ref reading — ONE labelled fact, not coverage.** [MEASURED]

```
list_commits(GH-Mantova/ProjectOperations, sha=main, perPage=3)
  bdc5d05b  2026-09-16T09:41:19Z  docs(pr-prompts): stage crmvis register residual ... (#1985)
  612ccf55  2026-09-16T08:21:14Z  feat(crm): S4 - Tenders register on the s7 kit ... (#1984)
  24de7c60  2026-09-16T08:04:03Z  feat(rates): S4 - import creates columns ... (#1983)
```

GitHub's `main` tip **equals** the dev tree's `origin/main` ref, and the commit timestamp
(09:41:19Z) sits 30 seconds before the ref file's mtime (09:41:49Z) — the fetch that picked it up.
→ F3.

**`check-breadcrumb.mjs` verdict — RAN, exit 0.** [MEASURED]

```
$ cd <mount>/ProjectOperations2
$ node scripts/pipeline/check-breadcrumb.mjs docs/pr-prompts/00-04-scanner-2026-09-16-2211-...md
NOTE    00-04-scanner-2026-09-16-2211-...md is UNTRACKED — it reaches nobody until a board PR commits it
ADMIT   00-04-scanner-2026-09-16-2211-...md
structure: 21 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)
CLEAN
exit=0
```

It swept all 21 breadcrumbs, not just the named one, and returned `CLEAN` with **0 malformed**. → F5.

---

## WHAT CHANGED

**Nothing on the board.** No prompt staged, armed, renamed, moved or deleted. No label touched. No
merge. No push. No commit. No `git` command of any kind was run against any tree.

**One file written:** this breadcrumb, at
`C:\ProjectOperations2\docs\pr-prompts\00-04-scanner-2026-09-16-2211-blind-again-but-the-mount-lived-and-the-stop-contract-treats-two-surfaces-as-one.md`.
It is **untracked** — Station 00 sweeps it up. A breadcrumb filename matches no watcher glob, so
leaving it in the queue root arms nothing.

**`docs/pipeline/sweep-rotation.json` was NOT touched** — not read-modified, not advanced. Its content
is unchanged at `last_index: 0`, `last_run_utc: 2026-09-16T18:10:38Z`.

---

## FINDINGS

### F1 — Third blind Station 04 slot in four, and the failure now has a named mechanism

[MEASURED] Desktop Commander did not fail as *absent from the session registration*; it failed as
`CONNECT_TIMEOUT ... after 30000ms`. That is a **server handshake that did not answer inside 30
seconds**, not a plugin that was never offered. The distinction is the first new information this
pipeline has had about a cause `STATION-CAPABILITIES.md` §2 records as **unknown**: it points at
process startup, contention or a hung prior instance on the Windows host, and *away* from session
configuration or the scheduled-task listing (which §2 already refutes as a predictor).

[MEASURED] Blind rate across the last four Station 04 slots, from the breadcrumb filenames in
`docs/pr-prompts/`: 10:11Z blind, 14:10Z blind, 18:10Z sighted, 22:11Z blind — **3 of 4**, against the
"roughly 40%" the bootstrap records for Station 00.

[CANNOT MEASURE] Whether a stale Desktop Commander process is alive on the host. That needs the host,
which is the thing that is down. It cannot be self-diagnosed from inside a blind run, and two
consecutive honest attempts (this run's four loads, and the 14:10Z run's three) have failed.

**Question for Marco — not a status update.** The 30-second handshake timeout is the first hard
mechanism we have. Which do you want?

1. **Complete and additive (RULE 1 — passes both halves):** before the station's own preflight, have
   the scheduled task probe the Desktop Commander host process and restart it if it is not answering,
   then proceed. Fixes the intermittency at its source for every station, adds no new failure mode,
   and touches no data. Needs your hand on the host once to establish the restart command; after that
   it is unattended.
2. **Additive but incomplete:** raise the MCP connect timeout past 30s. Costs nothing and risks
   nothing, but only helps if the server is *slow* rather than *hung* — and we do not yet know which.
   Fails the "solves it for the future" half.
3. **Complete but not additive:** have a blind station fail the scheduled run loudly rather than
   writing a breadcrumb. Makes the outage impossible to miss, but destroys the only record a blind
   run currently produces. Fails the "without damaging existing entry" half.

**DISPOSITION: ESCALATED**

### F2 — The step-1 STOP treats two independently-failing surfaces as one

[MEASURED] This run: Desktop Commander **down**, Linux mount **up**, `node` **up**, native
Windows file reads **up**. The station contract's step 1 has one switch — "prove you can reach the
box" — and one outcome, STOP. It is written as though the surfaces fail together. They did not.

[INFERRED, from the station brief's own words] This matters because Part 0 is explicitly specified as
runnable on exactly the surface that survived: *"Pure grep+read over the repo mount; deterministic and
cheap"*, and *"do this FIRST, ALWAYS, even when the live pass is blocked."* A blind-on-PowerShell run
can do Part 0 completely and honestly. Under the current contract it does nothing.

[MEASURED] But the gap is not simply "let blind runs do Part 0", and this run is the counter-example
that shows why: the rotation handed me **`instrument-honesty`**, whose every prescribed probe needs
the shell. So on a PowerShell-blind run, *which* sweep is owed decides whether any work is possible —
and the station may not choose its own sweep. Three of four sweeps (`gate-liveness`,
`instrument-honesty`, and the bootstrap-diffing half of `instruction-drift`) need the shell;
`repo-hygiene` and Part 0 do not.

This is an instruction-layer design change. Station 04 is read-only on the board and does not rewrite
its own contract or the rotation's semantics; the canonical station-contract block is byte-identical
across seven station docs and gated by `lint-station.mjs`, so it is emphatically not 04's to edit.

**DISPATCHED to Station 00** — handing over: the measurement that the surfaces fail independently, the
per-sweep shell-dependency split above, and the observation that a "degraded, mount-only" preflight
outcome distinct from STOP would convert roughly one blind slot in three from zero coverage into a
complete Part 0 pass. 00 owns whether that reaches Marco as a contract change.

**DISPOSITION: DISPATCHED**

### F3 — Both findings the 14:10Z run raised have since cleared; the quiet on main is real quiet

[MEASURED] The 14:10Z breadcrumb's **F2** was `FETCH_HEAD` frozen at `2026-09-16T09:47:41Z` across two
runs. It has moved: `stat -c %Y .git/FETCH_HEAD` now resolves to **2026-09-16T19:05:16Z**, 3h07m
before this run. The dev tree is fetching again.

[MEASURED] The 14:10Z breadcrumb's **F3** was `sweep-rotation.json` carrying `last_index: 3`,
`last_run_utc: 2026-09-15T02:10:31Z` — a file whose mtime ran ahead of its own content, with
`gate-liveness` owed for a third consecutive run. It now reads `last_index: 0`,
`last_run_utc: 2026-09-16T18:10:38Z`. **The 18:10Z run ran `gate-liveness` and advanced the
rotation.** The advance survived, which also retires the 10:11Z run's worry that a watcher reset
destroys uncommitted rotation advances — at least across this interval.

[MEASURED] And the reading those two findings were circling is now settled from both sides: GitHub's
`main` tip and the dev tree's `origin/main` ref are the **same commit**, `bdc5d05b`, authored
2026-09-16T09:41:19Z. **`main` has not moved in 12h31m.** The dev tree is not stale — the repo is
quiet. Distinguishing those two is the exact confusion the step-1 contract exists to prevent, and for
the *repo* it can be settled without a shell. For the *board* — open PRs, checks, labels, watcher
liveness — it cannot, and this run did not try.

**DISPATCHED to Station 00** — 00 owns the finding ledger and these are its entries to close, not
mine. Handing over the verification for all three.

**DISPOSITION: DISPATCHED**

### F4 — `ls --time-style` renders LOCAL time and will accept a literal `Z`; I nearly filed a false finding on it

[MEASURED] The sandbox shell's display timezone is **+1000**, while `date -u` prints UTC. A control
file created at epoch `1789596739` (`2026-09-16T22:12:19Z`) stats as
`2026-09-17 08:12:19.959771212 +1000`.

So `ls -l --time-style=+%Y-%m-%dT%H:%M:%SZ <file>` prints **local wall-clock with a literal `Z`
appended by the format string**. It exits 0, warns nothing, and returns a perfectly well-formed
ISO-8601-looking timestamp that is **10 hours wrong**. On my first pass it rendered `.git/FETCH_HEAD`
as `2026-09-17T05:05:16Z` — *seven hours in the future* relative to a correct `date -u` taken in the
same command — and I began writing it up as a mount defect before the control file killed it.

Why this is worth a §9 entry rather than a shrug: preflight **step 4** requires measuring a lock's
**age** and calling a 0-byte lock "hours old with no git process" **STALE**. Ten hours in the wrong
direction is the difference between clearing a live lock and parking a dead one. The correct probes
are `stat -c %Y` compared against `date -u +%s`, or `date -u -r <file>` — which is what the 14:10Z run
used, so **this did not propagate**: I checked that breadcrumb's method specifically before writing
this, and its `date -u -r .git/FETCH_HEAD -> 2026-09-16T09:47:41Z` is sound. The trap is live but
unsprung.

Folded sibling: the `packed-refs` divergence recorded under WHAT I MEASURED is the same shape — a
query that returns a well-formed, confidently wrong answer with no warning.

**DISPATCHED to Station 00** — candidate DOCTRINE §9 entry. 04 does not edit DOCTRINE.

**DISPOSITION: DISPATCHED**

### F5 — REFUTED: `check-breadcrumb.mjs` *does* run on a blind run, under the guard, from the sandbox

[MEASURED] The 14:10Z breadcrumb records, under its GROUND caveats:

> "**`check-breadcrumb.mjs` was NOT run end-to-end.** Its verdict path shells to `git ls-tree` /
> `gh pr list`; under the guard, against the mount, that is refused by design."

**That is wrong.** This run executed it with `cwd` set to the mount, with the guard shim installed and
first on `PATH`, with no Windows shell and no `gh` anywhere in the environment. It **exited 0** and
printed `CLEAN` after checking 21 breadcrumbs, and it still produced correct per-file `UNTRACKED`
notes — so whatever it uses to determine tracked state is not a call the guard refuses.

Why this matters more than one wrong caveat: the 14:10Z run concluded from it that its breadcrumb was
**UNVALIDATED** and said so in bold. If that claim is inherited — and it reads exactly like a
durable capability fact, which is the shape of instruction drift this pipeline keeps tripping over —
then **every blind run declines a validator that works**, and malformed breadcrumbs from precisely the
runs most likely to be written under stress go unchecked. This is a live instance of the pattern
DOCTRINE §7 names: a station reported a tool as unavailable without the tool having been run.

[INFERRED] I did not read `check-breadcrumb.mjs` to determine *how* it resolves tracked state, so I
cannot say whether the 14:10Z claim was wrong when written or has been fixed since. Either way the
current behaviour is measured above.

**DISPATCHED to Station 00** — the 14:10Z breadcrumb's caveat needs annotating as REFUTED before it
is inherited further, and 00 owns cross-run corrections. If the claim also sits in a station doc
rather than only in that breadcrumb, that is a repo-doc fix and still not 04's to make.

**DISPOSITION: DISPATCHED**

---

## WHAT I DID NOT DO

- **The `instrument-honesty` sweep** — every probe its brief prescribes needs the Windows shell. Not
  attempted, not substituted, and **the rotation was not advanced**. It is owed by the next run.
- **Chose a different sweep.** AUTHORITY forbids it; a fresh run choosing its own sweep narrows
  coverage without rotating it.
- **Part 0 static audit.** Runnable on the surface I had, but step 1 of the station contract fired
  STOP, and the contract outranks the brief where they disagree. Reasoning past a bright-line hard
  stop because I judged the rationale not to apply is the failure mode DOCTRINE §5 exists to prevent.
  F2 asks 00 to change the contract rather than having me route around it.
- **Any board read or mutation.** No `status-sweep.ps1` (no verdict exists for this run), no
  `triage-holds.ps1`, no `check-backlog.mjs`, no `lint-prompt.mjs`, no HOLD triage, no arming, no
  staged prompt. The 30 HOLD files visible at depth 1 were listed but **not evaluated** — a filename
  listing is not a gate reading.
- **The board trap check.** Whether any `*-ready.md` is *tracked* at depth 1 needs `git ls-files`.
  [CANNOT MEASURE] this run. No `*-ready.md` file exists at depth 1 at all right now, but that is a
  directory listing, not a tracked-state reading, and the trap is specifically about tracked files
  that a checkout can re-arm.
- **Part 1 GitHub reconciliation and Part 2 live-site patrol.** One labelled GitHub commit read was
  taken to qualify a dev-tree ref reading (F3); no PR audit, no Dependabot pass, no live site, no
  visual pass.
- **Azure / Entra / SharePoint.** Not touched. Not read, not written.
