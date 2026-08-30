# Station 00 — Supervisor | 2026-08-29T14:09Z–2026-08-29T14:30Z

## GROUND

```
UTC            2026-08-29T14:09Z
origin/main    fb3cc64b            (GitHub API list_commits main - NO local fetch: no shell on the box)
dev tree       main @ 1501d09c     C:\ProjectOperations2  (read from .git/refs/heads/main as a FILE)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE. This run is nonetheless READ-ONLY, for a different reason: see F1.

**This is a BLIND-ISH run and I am saying so as loudly as the contract demands.** Desktop Commander is
absent, so I have **no shell on the Windows host**: no `git`, no `gh`, no `node`, no PowerShell, no
`status-sweep.ps1`, no `check-breadcrumb.mjs`, no `lint-prompt.mjs`. What I do have is the real tree -
`C:\ProjectOperations2` is mounted into this sandbox and I read its files directly. So this is not
"GitHub-side reads presented as coverage": the file measurements below are the watcher's own tree. But
every claim that requires *executing* something is tagged `[CANNOT MEASURE]`, and there are more of
those than usual.

## WHAT I MEASURED

**Reachability.** `ToolSearch` for the Desktop Commander toolset, three separate queries across the
run: zero matches; the server reported "still connecting" and never connected. `[MEASURED]` - DC
absent, no shell on the box.

**Mount is the real tree, not a copy.** `cat .git/HEAD` -> `ref: refs/heads/main`;
`cat .git/refs/heads/main` -> `1501d09c61e483b0ef810bdfa240bb694cfc0236`;
`head -c 200 .git/FETCH_HEAD` -> `fb3cc64b...  branch 'main' of https://github.com/GH-Mantova/ProjectOperations`.
`[MEASURED]` - dev tree at `1501d09c`, last recorded fetch `fb3cc64b`, i.e. **no fetch since the 12:08Z
run**. No `git` command was run against this tree; every line above is a file read.

**origin/main.** GitHub API `list_commits(main, perPage 5)` -> head `fb3cc64b` "docs(board): retire 23
premise-dead HOLDs ... (#1392)", authored 2026-08-29T12:19:35Z. `[MEASURED]` - main has NOT moved since
my last run merged.

**Board.** GitHub API `list_pull_requests(state=open)` -> `[]`. `[MEASURED]` - **OPEN = 0.** No PR to
drive, none DIRTY, none to merge; Q1 and Q2 of the answer sheet are answered by the empty set.

**Armed.** `find docs/pr-prompts -maxdepth 1 -name '*-ready.md' -type f | wc -l` -> **0**. `[MEASURED]`
- ARMED = 0, counted myself in the tree the watcher globs, not quoted from a note (Q3).

**Queue, with the command beside every number** (dev tree at `1501d09c`):

| what | command | count |
|---|---|---|
| depth-1 `-HOLD.md` | `ls docs/pr-prompts/*-HOLD.md \| wc -l` | 84 |
| depth-1 `*.md`, all | `find docs/pr-prompts -maxdepth 1 -name '*.md' -type f \| wc -l` | 232 |
| `superseded/` top-level entries | `ls docs/pr-prompts/superseded/ \| wc -l` | 37 |
| `superseded/` files, recursive | `find docs/pr-prompts/superseded -type f \| wc -l` | 236 |
| `needs-marco/` entries | `ls docs/pr-prompts/needs-marco \| wc -l` | 23 |
| `no-pr-opened/` | `ls docs/pr-prompts/no-pr-opened \| wc -l` | 107 |
| `failed/` | `ls docs/pr-prompts/failed \| wc -l` | 41 |
| `processed/` | `ls docs/pr-prompts/processed \| wc -l` | 3580 |
| `paused/` and `blocked/` | `ls ... \| wc -l` | 14 and 1 |

`[MEASURED]`. **84 depth-1 HOLDs is not a regression** - it is 61 plus the 23 retired in #1392, which
is on `main` and not in this tree. It is the expected reading for a tree three commits behind, and the
cheapest available confirmation that the dev tree still has not fast-forwarded.

**The queue has not moved.** Newest entry in `failed/`: `pr-crm-s3-account-on-client-create-ready.md`,
mount mtime `Aug 29 07:03` -> **2026-08-28T21:03Z** after the ten-hour Brisbane-local correction.
Byte-identical to the reading in the last six runs. `[MEASURED]`.

**Watcher clone heartbeat - a second, independent instrument on the OAuth diagnosis.**
`tail -3 C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log` ->
`[2026-08-28T16:12:55.294Z] merge-wait-heartbeat elapsed=5401s last: waiting for merge of PR #1383`.
`[MEASURED]` - last heartbeat **21h 56m stale** at the top of this run. The prior at-source reading of
the token gave `expiresAt = 2026-08-28T16:13:35.984Z`. **The watcher's last heartbeat falls 40 seconds
before the token expiry.** `[INFERRED]` - two unrelated instruments landing inside the same minute is
strong corroboration that the token, not the queue, is what stopped the machine. It is a lead, not a
finding: heartbeats tick every 60s, so 40s is at the edge of this instrument's resolution, and the
21:03Z burn emitted no heartbeat at all because a 401 fails faster than one tick.

**Breadcrumbs to collect.** `find docs/pr-prompts -maxdepth 1 -type f -newer <04's 1010 breadcrumb>`
-> empty. `[MEASURED]` - **zero new station breadcrumbs since my 12:08Z run.** The newest is Station
04's 1010 gate-liveness sweep (mtime 10:19Z), whose four dispositions I collected last run and landed
in #1392. Nothing is waiting on me.

**`sweep-rotation.json`** -> `last_index: 0`, `last_run_utc: 2026-08-29T10:18:55Z`, `last_station:
04-scanner`. `[MEASURED]` - index 0 is `gate-liveness`, which 04 ran at 1010. **Next 04 sweep is index
1, `instrument-honesty`**, unchanged from what my last run recorded.

**`[CANNOT MEASURE]` this run, and each one matters:**

- `status-sweep.ps1` - no shell. No SAFE / CAUTION / DO-NOT-ACT verdict exists for this run.
- `git diff --cached --name-status` - the staged half-arm probe. **I cannot say the shared index is
  clean; I can only say I did not touch it.** Per the standing rule this reads `[CANNOT MEASURE]`,
  never "index clean".
- `check-breadcrumb.mjs --freshness` - cannot run. Silence checked by hand instead, below.
- `lint-prompt.mjs` and `lint-station.mjs` - cannot run, so nothing was armed and no ADMIT is quoted.
- The watcher process (pid, alive or wedged) - no `Get-CimInstance`, no `ps`. Unknown.
- **The OAuth token itself - see F3.**

**Silence check, hand-run** (cadences from `check-breadcrumb.mjs:35`; SILENT = past 2x cadence):

| station | cadence | last breadcrumb | age at 14:09Z | verdict |
|---|---|---|---|---|
| 00 | 2h | 2026-08-29 12:08Z | 2.0h | ok - this run |
| 04 | 4h | 2026-08-29 10:10Z | 4.0h | ok - next due ~14:10Z |
| 03 | 24h | 2026-08-28 23:02Z | 15.1h | ok |
| 05 | 24h | 2026-08-28 14:11Z | **24.0h** | ok, but at exactly 1x cadence - see F5 |

I have **not** written `breadcrumb-clean` anywhere in this report, because the validator has not run.
This is a hand-check against the rules I read out of the script, and I am labelling it as one.

## WHAT CHANGED

**On the board: nothing.** Nothing armed, nothing disarmed, nothing merged, no label added or removed,
no prompt renamed, no PR opened or closed. ARMED was 0 at the start of this run and 0 at the end.

**On disk: two files, both untracked, both in this directory.**

1. This breadcrumb. I have no `git` on the box, so I cannot commit it and cannot open its PR from a
   worktree. **The next run with a shell must sweep it up.** It is not a `*-ready.md` and matches no
   watcher glob at any point, so writing it arms nothing.
2. `.00-write-probe.txt`, containing the word `probe` - collateral from testing whether the mount was
   writable at all, after a first write attempt silently produced the wrong bytes (see below).
   **`rm` on this mount returns "Operation not permitted", so I could not remove it.** It is a
   dotfile, untracked, inert, and safe to delete by anyone with a shell. Reported rather than hidden.

**A mount-write trap, worth the next run's attention.** My first attempt wrote the breadcrumb via a
scratch file under `/tmp` and piped it through `sed` to add CRLF. `/tmp` was not writable in this
sandbox, and the redirect that followed **created the target file at the contract path with 5122 bytes
of a completely different, older breadcrumb's content** - not empty, not an error, plausible-looking
prose with the wrong date in its first line. A read-back of the first 400 bytes is what caught it. The
rule that generalises: on this mount, **read back the bytes you think you just wrote, and check the
first line, not just the size** - a size that looks reasonable is exactly how this one nearly passed.

## FINDINGS

**F1 - This run is DC-blind, and it breaks the alternating pattern the open escalation was built on.**
The unanswered escalation about Station 00's Desktop Commander blindness (~40% of runs) was last
supported by a tally of 3 blind in 8, *alternating*, which was used to argue the cause is not the
launch type. That reading no longer holds: runs 0208, 0408, 0608, 0808, 1008 and 1208 were all SIGHTED
- six consecutive - and 1409 is BLIND. Blindness is **bursty, not alternating**, so any hypothesis
depending on strict alternation is dead, and a fix validated by "the next run was sighted" proves
nothing. The escalation is unchanged in substance; this narrows it.
**DISPOSITION: ESCALATED -> Marco** - folded into the existing, still-unanswered DC-blindness question.
I am deliberately not opening a second channel for the same defect.

**F2 - The stillness is a correctly-held brake, now on its seventh identical reading.**
OPEN = 0, ARMED = 0, `failed/` newest 2026-08-28T21:03Z, heartbeat 21h56m stale, main unmoved since
12:19Z. Every one of those is byte-identical to the last run. Nothing is stuck; nothing may move while
the token is dead. There is no board work for this station to do, and manufacturing some would be the
failure mode, not the fix.
**DISPOSITION: DEFERRED** - becomes urgent the moment ARMED >= 1 or the token is refreshed, either of
which turns this from "held" into "running with a burn risk".

**F3 - A DC-blind run can NEVER measure the OAuth token, so a blind run must inherit the block and may
never clear it.** I searched every mounted path to depth 4 for `.credentials.json`: **zero hits.** The
token lives under `C:\Users\Marco\...`, which is not one of the twelve mounted folders. This is a
structural gap, not a bad search: the mount defeats blindness for the *repo* and does nothing for
anything outside it. The dangerous consequence is the practical one - a future blind run that sees a
quiet, green, empty board has **no instrument that can tell it the brake is still on**, and "no
evidence of expiry" would read exactly like "not expired". The standing OAuth block therefore rests on
the last at-source measurement (12:08Z, seventh reading, `expiresAt` 2026-08-28T16:13:35.984Z, unmoved
for 20h, so nothing is refreshing it), and this run neither confirms nor weakens it.
**DISPOSITION: DEFERRED** - the rule, "a blind run inherits the OAuth block and may not clear it", is
recorded here and costs nothing to hold. It becomes urgent, and worth widening the mounted paths, only
if a blind run is ever the one that would otherwise resume the board.

**F4 - A bare count is not a measurement, and this queue proves it three ways in one directory.**
`superseded/` reads **37**, **236** or **247** depending on the instrument: `ls` counts top-level
entries and the directory contains subdirectories; `find -type f` counts recursively and the directory
contains `.log` files as well as prompts; and the figure carried forward from earlier runs is a fourth
thing again. The same trap sits on `needs-marco/` - 23 entries here against the 14 carried forward.
None of these numbers is wrong; each is right *for its own command*, and comparing them across runs is
meaningless. This is DOCTRINE section 7 in miniature and it has been quietly costing reconciliation
effort every run.
**DISPOSITION: ACTIONED** - every count in this report is stated in a table beside the exact command
that produced it, and the three `superseded/` readings are shown side by side so the next run compares
like with like instead of chasing a phantom delta. Verified by re-running each command and pasting its
own output.

**F5 - Station 05 is at exactly 1x its cadence with no breadcrumb: the last quiet moment before it
counts as silent.** Last 05 breadcrumb 2026-08-28T14:11Z, now 24.0h old against a 24h cadence; the
SILENT threshold is 2x = 48h, so it is **not** a defect yet and I am not treating it as one. But 05
also still owns four ` M` working-tree files dispatched to it and open since yesterday (`sot/03`,
`sot/06`, `docs/qa/sot-refs-baseline.json`, `docs/data-model/metadata-catalog.json`), so a missed run
is not costless.
**DISPOSITION: DEFERRED** - with a dated trigger, so it cannot quietly become nobody's job: if there is
still no Station 05 breadcrumb at **2026-08-30T14:11Z**, it is SILENT by the contract's own definition
and the next run must disposition it as a defect rather than re-deferring it.

## WHAT I DID NOT DO

- **Armed nothing.** Two independent reasons, either sufficient: the standing OAuth block (an armed
  prompt 401s straight into `failed/`, which has already burned real prompts), and no `git` - arming is
  a `git mv` of a tracked `-HOLD.md` and cannot be faked by creating a file.
- **Merged nothing.** OPEN = 0. There was nothing to merge, and I have neither `gh` nor `pipeline-lib`.
- **Did not fast-forward the watcher clone.** Proven safe, still forbidden to Station 00 absolutely,
  and still owned by nobody. Unchanged and unactioned by design.
- **Did not run section 3b ENSURE-UP.** It is dead code - `status-sweep.ps1`'s "wrapper: alive (3)"
  counts launchers, and the real `supervise-watcher.ps1` count is zero - so running it would start a
  fourth launcher. Moot in any case: no shell.
- **Ran no `git` command against the mounted tree**, per the standing rule. Every git fact above is a
  file read of `.git/HEAD`, `.git/refs/heads/main` or `.git/FETCH_HEAD`.
- **Did not re-derive the board from `sot/02`**, and did not re-open any question the record marks
  "do not re-raise".
- **Did not do 02/03/04/05's work.** There was none I could do without a shell, and doing it anyway is
  the incident LL-38 records.
