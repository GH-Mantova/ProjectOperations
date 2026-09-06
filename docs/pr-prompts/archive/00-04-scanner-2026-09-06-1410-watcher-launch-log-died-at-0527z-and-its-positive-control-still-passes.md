# Station 04 — Scanner | 2026-09-06T14:10Z–2026-09-06T14:35Z

## GROUND

```
UTC            2026-09-06T14:10:20Z
origin/main    d1467428   (fetched 14:10Z; moved to c2371a7d at 14:20Z when #1719 merged)
dev tree       main @ a65ab1d4 -> d1467428   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/04-scanner.md, contract station-contract v3)
bootstrap      1   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — full authority, not read-only-on-mismatch.

Sighted run. `start_process` shell `powershell.exe` succeeded after a keyword `ToolSearch` for
`desktop-commander` (the ids in this environment are `mcp__plugin_desktop-commander_desktop-commander__*`).

Device-bridge git guard, installed first per PREFLIGHT — last line quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`

Three binding docs read in full from the dev tree working copy, which was proved current:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` -> EMPTY. (Sound form per PREFLIGHT; no piped hash.)

Sweep this run, chosen by the rotation and not by me:
`node scripts/pipeline/next-sweep.mjs` -> **SWEEP: instrument-honesty** (position 2 of 4,
previous run 2026-09-06T10:10:36Z).

`status-sweep.ps1` (captured to a file, because it returns early) — §7 VERDICT:
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.` Section 0 positive controls both passed; no `[BROKEN]`.

## WHAT I MEASURED

Fresh negative-control needle minted for this run per §9.6: `zzQq04Needle20260906T1412`.
It returned **0** against every corpus it was used on, and it is spent the moment this file lands.

### DOCTRINE §9 traps — does each one still trap?

All rows `[MEASURED]` 2026-09-06T14:15:44Z at `d1467428`, from
`C:\po-sup-fix-scripts\probe-04-20260906-1412.ps1` run with `-File`, output in
`C:\po-sup-fix-scripts\probe-out-1412.txt`.

| §9 claim | probe | result | verdict |
|---|---|---|---|
| 9.1 `$` EXPANDED by the `-Command` layer | `-Command "$CTRL=42; ...$env:USERNAME...$true"` | assignment arrived as bare `=42` (ParserError), `$env:USERNAME` arrived as `Marco`, `$true` as `True` | **REPRODUCES** |
| 9.2 `ls-tree` no trailing slash returns ONE line | `-- docs/pr-prompts/superseded` | **1** (vs **111** with slash, **317** with slash + `-r`) | **REPRODUCES** |
| 9.2 `ls-tree` glob returns 0 silently, `-r` does not rescue | `-r -- 'docs/pr-prompts/*.md'` | **0**; sub-glob **0**; POS control `-- docs/pr-prompts/` (no `-r`) = **90** | **REPRODUCES** |
| 9.2 `check-ignore -v` on a DIR is byte-identical to a true negative | dir -> exit 1 empty; `CLAUDE.md` -> exit 1 empty; file inside -> exit 0 `.gitignore:76` | identical results for opposite truths | **REPRODUCES** |
| 9.2 `git status` blind to gitignored files | `git status --porcelain -- docs/pr-prompts/processed/<file>` -> **0** while `check-ignore` names `.gitignore:76` | | **REPRODUCES** |
| 9.2 `branch -r` over-reports vs the remote | `git branch -r` **21** vs `git ls-remote --heads origin` **12** | after `fetch --prune` | **REPRODUCES** |
| 9.3 `Measure-Object -Line` drops blank lines | `lint-prompt.mjs`: `-Line` = **1841**, `.Count` = **1973** | 132 blanks silently dropped, exit 0 | **REPRODUCES** |
| 9.3 PowerShell `>` writes UTF-16LE | `"hello" > f` -> **16 bytes**, first two `255,254` (BOM `FF FE`) | 7 bytes expected in UTF-8 | **REPRODUCES** |
| 9.4 `@(ConvertFrom-Json ...).Count` = 1 for empty AND for 4 | inline: **1 / 1**; assign-then-count: **0 / 4** | | **REPRODUCES** |
| 9.4 `gh run list --commit <SHORT>` answers empty at exit 0 | short `d1467428` -> **0 runs**; full 40-char -> **4 runs** | | **REPRODUCES** |
| 9.4 `merged` reads FALSE on every PULL-REQUEST LIST entry | MCP `list_pull_requests(state=closed, perPage=5)` -> **5 of 5** `"merged":false` with `merged_at` populated; `pull_request_read(get,1723)` -> `"merged":true` | the exact falsifying pair the bullet names | **REPRODUCES** |
| 9.4 `gh run list --branch main` can be DAYS stale | newest 4 runs created `2026-09-06T14:20:09Z` on `c2371a7d` | **did NOT reproduce today.** The claim is "can be", i.e. intermittent, so this is not a refutation and the bullet stands | not reproduced |
| 9.5 the linter sees THREE arming markers | `DO_NOT_ARM_COMMENT` (822), `DO_NOT_ARM_CAPS` (824), `ARM_ONLY` (828); NEG control 0 | all three present — but see **F3** for the literal | REPRODUCES, with a correction |
| 9.5 `.arming-log.txt` gap (the two-line-count falsifying probe) | `origin/main` **60** lines = working copy **60**, identical last row `2026-09-06T09:20:50Z ARMED pr-watcher-verdict-home-resolver`; tracked exit 0, NEG exit 1 | the gap is CLOSED right now; the "nothing commits it on purpose" defect is untouched | gap closed this run |
| 9.5 `STOP-WATCHER-LANE2` is present by design, `STOP-WATCHER` absent, PATH is load-bearing | LANE2 present **1090 bytes**, STOP-WATCHER **False**, NEG control False, 25 `STOP-WATCHER` hits across `C:\po-watcher\*.ps1` | | **REPRODUCES** |
| 9.6 negative-needle contamination is self-inflicted and monotonic | over 3354 `docs/pr-prompts/**/*.md`: burned needle 1 = **52** (was 40 on 09-05), burned needle 2 = **40** (was 36) | grew by 12 and 4 in one day, exactly as predicted | **REPRODUCES, WORSE** |
| 10.1 `NESTED_TEST_PATHS` still has THREE forms | `origin/main:scripts/pr-watcher/index.mjs` -> `/^(tests\|docs)\//`, `/(^\|\/)__tests__\//`, `/\.(test\|spec)\.[cm]?[jt]sx?$/`; POS `classifyPolicyFiles` = 2, NEG = 0 | §10.1's own falsifying probe | **holds** |
| 10.3 the `tests-docs` lane is alive | `merge result for PR #N: {"ok":true` -> **51** (48 on 09-04), NEG 0 | | **holds** |

### RULE 2 probe — calibrated, live tree pinned

`[MEASURED]` in `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone):
**2004** logs · POS `-Pattern 'marco.:true'` = **617** · NEG `zzQq04Needle20260906T1412.:true` = **0** ·
newest log `rev-1723-ready.md.log` @ `2026-09-06T13:36:55Z`, younger than every open PR. Probe SOUND.

🔧 **New, and it narrows a standing warning.** Run from **inside a `.ps1`**, the
`-SimpleMatch '"marco":true'` form returns **617 — identical to the regex form.** The project-memory
index states flatly that the `-SimpleMatch` form "returns 0 AND its negative control also returns 0".
That is true **through the `-Command` layer only**, which is what DOCTRINE §10.1's footnote already
says ("a SHELL fact"). The regex form stays the one to write because it is correct in both places;
but a run must not read a 0 from `-SimpleMatch` as evidence about the corpus.

### Open PRs at 14:16Z — lane classification

`[MEASURED]` `Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'`
(the `rev-*`-excluded discriminator), NEG control `PR #999999` -> 0:

| PR | prompt-log hits | head | classification |
|---|---|---|---|
| #1719 | 0 | `feat/ew-s2c-alloc-rejection-path` | `[NO LANE VERDICT — hand-classified]` -> **MARCO'S** (code, outside all three `NESTED_TEST_PATHS` forms). Merged at 14:20:06Z during this run. |
| #1713 | 0 | `feat/linefields-s1-model-and-validation` | `[NO LANE VERDICT — hand-classified]` -> **MARCO'S** |
| #1709 | 0 | `feat/tender-lifecycle-s2a-bidstatus` | `[NO LANE VERDICT — hand-classified]` -> **MARCO'S** |
| #1699 | 0 | `fix/rates-value-column-units` | `[NO LANE VERDICT — hand-classified]` -> **MARCO'S** |

**I did not merge, label, arm or touch any of them.** See F2 for why "no `opened PR #` line" could
not be used to prove these are second lane this run.

### Concurrency observed

The dev tree fast-forwarded **under me, mid-run**: `git rev-parse --short HEAD` = `a65ab1d4` at
14:10:20Z and `d1467428` at 14:15:44Z. I ran no merge. `origin/main` then moved again to `c2371a7d`
at 14:20Z. Recorded, not diagnosed — another actor was driving the board throughout.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — **advanced and LEFT DIRTY** in the dev tree
  (`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-06T14:10:20Z`, exit 0,
  `advanced: last_index=1 last_run_utc=2026-09-06T14:10:20Z`). Read back:
  `git status --porcelain -- docs/pipeline/sweep-rotation.json` -> ` M`. **Station 00 must commit
  this with the next board PR — 04 may not commit to the shared dev tree.**
- This breadcrumb, written to the tracked directory `docs/pr-prompts/`. It is **untracked** until a
  board PR sweeps it up. A breadcrumb filename matches no watcher glob, so it arms nothing.
- Scratch only, all OUTSIDE the repo, none of it tracked:
  `C:\po-sup-fix-scripts\sweep-04-20260906-1412.txt`, `probe-04-20260906-1412.ps1`,
  `probe-out-1412.txt`, `_redir-probe.txt`.
- The VM-side git guard was installed (idempotent, VM only; it touches no repo file).

**Nothing else.** No merge, no label, no arm, no disarm, no rename, no prompt staged, no `/sot/`
edit, no board mutation of any kind.

## FINDINGS

### F1 — [S2] `watcher-launch.log` has recorded nothing since 05:27:31Z, while the watcher runs and its positive control passes

`[MEASURED]` 2026-09-06T14:2xZ:

| | value |
|---|---|
| `C:\po-watcher\watcher-launch.log` mtime | **2026-09-06T05:27:31Z** (2,481,829 bytes) |
| its last line | `[2026-09-06T15:27:31.25+10:00] Watcher exited with code 1 (raw node exit: -1)` |
| its newest `opened PR #` line | `[2026-09-06T02:01:30.367Z] [merge] pr-tipid-s1-...-ready.md: opened PR #1685, policy=tests-docs, waiting…` |
| `opened PR #` POSITIVE control | **167** in that file, **575** across all four launch logs, NEG control **0** |
| watcher node pid 27236 | **RUNNING**, `StartTime` = **2026-09-06T11:49:57Z** — 6 h 22 m AFTER the log's last line |
| `C:\po-watcher\ensure-watcher.log` | mtime **14:15:03Z**, live, 10-minutely `watcher alive, pid(s) 27236` |
| `opened PR #` in `ensure-watcher.log` | **0** — POSITIVE CONTROL FAILS; it never carries that line type |
| processed logs | still being written (newest 13:36:55Z), so the watcher itself is working |

The writer is `Start-Transcript -Path "C:\po-watcher\watcher-launch.log" -Append -Force` in
`watcher-launcher.ps1:8` and `watcher-launcher-singlelane.ps1:27`. `ensure-watcher.ps1:10` launches
the singlelane wrapper, and `ensure-watcher.log` records `RELAUNCHED`/`VERIFIED` pairs at
**05:35:03Z, 09:25:04Z, 09:35:06Z and 09:49:32Z** — four relaunches through that wrapper, **none of
which appended a single byte to the transcript.** So the transcript is not merely behind a restart;
it is failing on every restart and failing silently.

**Why this is a §7 defect and not a housekeeping nit.** The instrument answers, exits 0, and passes
the exact positive control the pipeline prescribes for it (`opened PR #` > 0). It is simply blind to
everything after 02:01:30Z. Every question asked of it about a recent PR returns "the watcher did not
do this" — for a watcher-opened PR just as readily as for a second-lane one. `ensure-watcher.ps1`'s
own crash-loop guard also tells its reader to *"Read `C:\po-watcher\watcher-launch.log` and fix the
cause"*, which is now advice to read a frozen file.

🔧 **Falsifying probe for this finding:** `(Get-Item 'C:\po-watcher\watcher-launch.log').LastWriteTimeUtc`
against `(Get-Process -Id <watcher pid>).StartTime`. If the mtime is younger than the watcher's start,
the transcript has resumed and this finding is dead.

**DISPATCHED -> Station 03 (Machine-minder).** Handover: the transcript does not resume across an
`ensure-watcher.ps1` relaunch. Diagnose whether `Start-Transcript -Append -Force` is throwing (a prior
wrapper still holding the handle is the obvious candidate — its `| Out-Null` would swallow the error)
and give the wrapper a log path that cannot silently vanish. 03 owns watcher health; 04 is read-only
and does not restart or reconfigure the watcher.

### F2 — [S2] the lane discriminator built on that log is blind, and a MERGED board PR has already used it on seven PRs

DOCTRINE §10.1 step 2 and the project-memory standing block both send a run to the launch log's
`opened PR #<n>` line to tell "second lane" from "a watcher PR whose verdict was never written" from
"a watcher PR still inside its `policy=tests-docs, waiting…` window".

`[MEASURED]` — PR **#1723** (`docs(board): 00 collect 1308`, merged 2026-09-06T13:33:51Z) states in
its body: *"All seven open PRs were established as second lane by the watcher launch log carrying
`opened PR #<n>` for none of them, against a positive control of 915 such lines."* That classification
was drawn at 13:08Z from a log that had recorded nothing since **05:27:31Z** and no `opened PR #` line
since **02:01:30Z**. The positive control passed; the instrument was still blind to every PR it was
asked about. (I measure 575 such lines across the four launch logs rather than 915 — a different
corpus or pattern; both are >0, and both pass.)

The *conclusion* may still be right — I hand-classified the same PRs independently above, by
`classifyPolicyFiles`, and they are Marco's either way. What is void is the **evidence**, and the
method is written down as the discriminator for the next run.

🔧 **The correction, stated so it cannot rot:** the `opened PR #<n>` test is only valid for PRs opened
**before the launch log's last write**. Any run using it must first assert
`launch-log mtime > PR createdAt`, and report `[CANNOT MEASURE]` for anything after it — never
"no `opened PR #` line" -> "second lane". While F1 stands, that assertion fails for every PR opened
after 2026-09-06T02:01Z.

**DISPATCHED -> Station 00 (Supervisor).** Handover: (a) fold the mtime precondition into DOCTRINE
§10.1's `NO LOG` bullet, which currently lists three causes and no freshness test for the instrument
that separates them; (b) note against #1723's finding that its seven-PR lane classification rests on a
frozen instrument and needs re-establishing once F1 is fixed. This is a `docs/` edit inside 00's lane.

### F3 — [S3] `ARM_ONLY` has gained the `/i` flag; §9.5 and RULE 4's detector still quote `/Arm ONLY/`

`[MEASURED]` `scripts/pipeline/lint-prompt.mjs` (working copy proved identical to `origin/main`,
`git diff --numstat` EMPTY):

```
822: const DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i;
824: const DO_NOT_ARM_CAPS = /DO NOT ARM/;
828: const ARM_ONLY = /Arm ONLY/i;
```

DOCTRINE §9.5 and the project-memory RULE 4 detector both record `ARM_ONLY` = `/Arm ONLY/`, and the
memory index adds *"only `DO_NOT_ARM_CAPS` is case-sensitive, so a RULE 4 grep run `-CaseSensitive` on
all three markers UNDER-reports"*. The linter is now case-**insensitive** on `ARM_ONLY` as well, so a
detector built from the documented literal — a case-sensitive search for `Arm ONLY` — will miss
prompts the linter does gate (`ARM only`, `arm ONLY`, `Arm only`). **The error runs in the arming
direction**: it under-reports a human gate, and RULE 4's second instrument exists precisely to catch
what an `ADMIT` does not. `DO_NOT_ARM_CAPS` remains genuinely case-sensitive, so that half stands.

**DISPATCHED -> Station 00.** One-clause `docs/` edit in DOCTRINE §9.5: quote `/Arm ONLY/i` and say
the union grep must be case-INSENSITIVE for two of the three markers and case-SENSITIVE for
`DO_NOT_ARM_CAPS` only. The `ARM_ONLY =` anchor itself is still correct and did not rot.

### F4 — [S3] the watcher is being restarted by an actor that logs nothing

`[MEASURED]` from `C:\po-watcher\ensure-watcher.log`, which records a `RELAUNCHED` line for every
relaunch it performs:

```
11:35:03Z  watcher alive, pid(s) 15336
11:45:03Z  watcher alive, pid(s) 15336
11:55:03Z  watcher alive, pid(s) 27236     <-- pid changed, no RELAUNCHED line
12:05:03Z  watcher alive, pid(s) 27236
```

pid 27236's `StartTime` is **11:49:57Z**, inside that gap. The last `RELAUNCHED` from
`ensure-watcher.ps1` was **09:49:32Z** (node pid 19744), and the pid had already changed to 15336
before 11:35Z with no entry either. So at least **two** watcher restarts today were performed by
something other than the watchdog, and nothing anywhere records who.

This is the restart-side twin of the standing open item that a second actor arms concurrently with
nothing enforcing it, and it is why F1's transcript gap cannot be closed by reasoning from
`ensure-watcher.log` alone. It is also a live cost: the project-memory 11:16Z stanza already
attributed an unexplained `armed 2 -> 1` transition to "a NODE RESTART, not an arm", and this is that
restart with no author.

**DEFERRED.** Real, and not urgent while the board is quiet and the watcher is healthy. What would
make it urgent: a restart landing mid-build, or a second watcher process appearing. It is also
substantially subsumed by F1 — once the transcript resumes, a restart leaves a banner again — so
fixing F1 first is the cheaper order, and re-opening this separately before then would duplicate 03's
dispatch.

### F5 — [S3] `check-breadcrumb.mjs` still carries `CADENCE '00': 2` against a live hourly cron

`[MEASURED]` at `d1467428`, anchor `const CADENCE =`, NEG control 0:

```
36: const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };
```

`STATION-CAPABILITIES.md` §6 records this as filed-for-Marco and explicitly says *"do not read this
paragraph as the fix having landed — the falsifying probe is the `const CADENCE =` line itself."* I
ran that probe: **not landed.** `--freshness` will therefore not call `00` SILENT until 4 h, i.e.
after three consecutive missed hourly runs — escalation #23's exact direction.

**DEFERRED.** Confirming a filed item, not re-raising it; a one-character `scripts/` change already
queued for Marco. Re-filing it as a new escalation is how a disposition addressed to a future run
bills a later run to re-discover it.

### F6 — [S3] the §9.6 negative-needle corpus is degrading on schedule

`[MEASURED]` over 3354 `docs/pr-prompts/**/*.md`: the two burned needles now return **52** and **40**,
against **40** and **36** measured 2026-09-05T18:1xZ. Growth of 12 and 4 in under 24 hours, strictly
monotonic, exactly as §9.6 predicts. My own fresh needle returned 0 everywhere and is spent by this
file.

**DEFERRED.** The rule already in DOCTRINE (mint a fresh needle every run) is the correct and
sufficient cure, and this run followed it. What would make it urgent is a run quoting a burned needle
as a passing control — which is what the 52 and 40 above will silently produce. Worth a one-line
addition to §9.6 recording that the counts are now 52/40 **only if** a station is already editing
that block; the counts are STATE and the paragraph already says so.

### F7 — [S3, LEAD] Station 00 was BLIND at 14:08:15Z and Station 04 was SIGHTED at 14:10:20Z, on the same box, two minutes apart

`[MEASURED]` Station 00's own breadcrumb for this hour
(`00-00-supervisor-2026-09-06-1408-...md`, GROUND block) records
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`
after **two** `ToolSearch` calls and a 30 s wait, and correctly claims no liveness, smoke or merge
verdict. `[MEASURED]` this run started `start_process` shell `powershell.exe` successfully at
**14:10:20Z** — 125 seconds later, same machine, same MCP config.

`[INFERRED]` — and offered as a **lead, not a finding**, because I have one paired observation and
STATION-CAPABILITIES §2 says the cause of blindness is not known. My own session began with the MCP
layer reporting `desktop-commander` as *still connecting*; my first keyword `ToolSearch` for it
returned **no** desktop-commander tool, and only the second call — issued one tool round-trip later —
returned all 26. That is the shape of a **startup race between the client's connect window and the
server's connect time**, not a property of the host: the box was demonstrably reachable throughout
00's run, since I reached it two minutes after 00 gave up.

If that is right, "blind" is partly a function of **how long a run waits before deciding**, which
would explain both the intermittency and why no host-side cause has ever been found. It would also
mean the contract's current rule — load first, then one honest attempt — is doing what it was
designed to do and still losing the race.

🔧 **Falsifying probe, cheap and available to every run:** on a `CONNECT_TIMEOUT`, wait 60 s and issue
one further keyword `ToolSearch` before declaring blindness, and record in the breadcrumb whether the
second attempt succeeded. Two or three blind runs that stay blind after that wait kill this lead; one
that comes back sighted converts it into a finding with a one-line cure.

**DISPATCHED -> Station 00.** It owns the blindness escalation and the station-contract text, and it
is the station that actually experiences the failure. I am deliberately not proposing a contract edit
from a single observation — widening the preflight on a lead is how a stale instruction gets written
into the one block every station must obey.

## WHAT I DID NOT DO

- **Merged, labelled, armed, disarmed, renamed or moved nothing.** 04 is read-only on the board.
  All four open PRs at measurement time carry no watcher verdict and hand-classify as **Marco's**;
  RULE 2 and the hard stops both bind, and neither was tested.
- **Staged no prompt.** F1 and F2 are 03's and 00's respectively, and DOCTRINE §10.6 plus PR #1723's
  own finding say six armable prompts already duplicate open PRs — adding a seventh candidate to that
  pile without an owner is the failure mode, not the cure.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Left dirty by design; named above so 00
  sweeps it up. The dev tree is on `main` and nobody commits to `main` directly.
- **Did not fast-forward or otherwise touch the dev tree's git state**, although it was behind at run
  start. Another actor FF'd it mid-run; a second FF from a read-only station is exactly the
  two-actors-one-tree collision LL-38 records.
- **Did not run Part 0 (static cross-layer audit) or Part 2 (live-site visual patrol).** The rotation
  named `instrument-honesty` and the station doc is explicit that the sweep is not my choice and that
  a shallow pass over everything is why findings rot.
- **Did not investigate where the running watcher's stdout is going.** A recursive scan of
  `C:\po-watcher` for a replacement log timed out against the clone's tree and I stopped rather than
  loop; the four root-level `*.log` files were enumerated and only `ensure-watcher.log` is fresh. That
  is F1's question and it is 03's to answer with the process open-handle, not mine to guess.
- **Left `C:\po-vg` alone.** `status-sweep.ps1` §2 flags it as an orphaned worktree holding 1
  uncommitted file, age 3258 min. Pruning it is destructive and it is not my lane.
- **Touched no Azure / Entra / SharePoint anything**, and wrote no production data.

---

`[MEASURED]` unless tagged. True at `d1467428` (dev tree) / `c2371a7d` (`origin/main` by 14:20Z),
2026-09-06T14:35Z. Re-verify any claim here before acting on it.
