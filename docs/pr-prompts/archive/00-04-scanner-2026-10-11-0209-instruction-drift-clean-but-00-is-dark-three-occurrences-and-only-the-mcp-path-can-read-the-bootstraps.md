# Station 04 — Scanner | 2026-10-11T02:09Z–2026-10-11T02:2xZ

BLIND: `MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms` (CONNECT_TIMEOUT) — **and the VM sandbox is wedged too**, so there is NO execution transport this run. Native file tools (`Read`/`Glob`/`Grep`) still reach the tree, so this is a blind run that COLLECTED and swept, not a blind run that did nothing (`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`, STATION-CAPABILITIES §3).

Doc version and bootstrap AGREE (both `1`), so this run is not under the mismatch read-only rule — it is read-only because it is 04.

## GROUND

```
UTC            2026-10-11T02:09:31Z   [INFERRED] — scheduled-tasks MCP nextRunAt for THIS 04 occurrence.
                                      No clock probe exists on this transport: [CANNOT MEASURE] directly.
origin/main    eff8b4b5               raw read of .git/refs/remotes/origin/main (no git invoked)
dev tree       main @ eff8b4b5        C:\ProjectOperations2  (raw .git/HEAD -> refs/heads/main -> eff8b4b5)
doc version    1                      docs/pipeline/stations/04-scanner.md front matter (contract_version: 5)
bootstrap      1                      <!-- station_doc_version: 1 --> in the scheduled-task SKILL.md
```

**Freshness proof for every working-copy read in this report — git-free, and it holds.** PREFLIGHT step 2
says read the binding docs from `git show origin/main:<path>`, never the working copy. No git is available,
so that cannot be honoured literally. Instead, two independent instruments agree on the tip:

- [MEASURED] `Read .git/refs/remotes/origin/main` → `eff8b4b5342824f1b452fdea863f83350f0b71a2`
- [MEASURED] `Read .git/refs/heads/main` → `eff8b4b5342824f1b452fdea863f83350f0b71a2`
- [MEASURED] GitHub API `list_commits(sha=main, perPage=3)` → tip `eff8b4b5342824f1b452fdea863f83350f0b71a2`,
  `"docs(pipeline): sweep 3 breadcrumb(s) 20261010-2154 (#2309)"`, committed `2026-10-10T22:00:01Z`.

So the dev tree's **committed** tree is at `main`'s **live** tip, and the usual "the working copy is routinely
behind main" hazard does not apply to this run. ⚠️ **What remains unmeasurable is UNCOMMITTED working-tree
drift** — `git status` / `--numstat` cannot be run — so every file read below is `origin/main`'s content
*unless another actor has an uncommitted edit at that path*. Same technique and same caveat as
`00-05-sot-keeper-2026-10-11-1425-...`. ⚠️ **Falsifying probe:** compare the GitHub tip against the two loose
refs on any run. If they ever disagree, every working-copy read in this report is unproven.

## WHAT I MEASURED

**Transport.** [MEASURED] Keyword `ToolSearch` for `desktop-commander` run three times (not assumed ids,
per `BOOTSTRAP_PREFLIGHT_V1`); the server moved from "still connecting" to
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out after
30000ms"`. That is a failure AFTER a successful load attempt → blindness, not an unloaded schema. The
`BOOTSTRAP_CONNECT_RETRY_V1` retry was honoured (two further searches, minutes apart). No `start_process`
exists in this session's inventory to call.

**Git guard.** [CANNOT MEASURE] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
never ran: call 1 → `request timed out after 30s`; calls 2 and 3 →
`bash failed on resume, create, and re-resume. resume: RPC error -1: process with name
"ecstatic-optimistic-hopper" already running (id: oneshot-779aa0d4-3a3e-4d20-9c09-b0bc7e984622)`.
**So there is no last line and no exit code to quote, in either direction.** This is NOT exit 2 and NOT a
non-zero install failure — the installer did not execute. ⚠️ The guard's absence cost nothing this run
because **no `git` was invoked by any transport at all**; the two SHAs above came from raw ref file reads.

**Clock.** [CANNOT MEASURE] directly. The GROUND stamp is the scheduler's own `nextRunAt` for this firing,
which is an *external* instrument, not this run's local clock — the distinction matters, because
`next-sweep.mjs:66-71` refuses to invent a stamp precisely so that "a run that stamps its own clock" cannot
claim any time it likes. ⚠️ The breadcrumb-date defect this pipeline is still carrying is live in the corpus:
`00-05-sot-keeper-2026-10-11-1425-...` is stamped date **2026-10-11** while 05's MCP `lastRunAt` is
**2026-10-10T14:22:59Z** — time right, date one day ahead. 04's own `...-1810-...` breadcrumb flagged exactly
this. Any date-based reasoning below is weakened accordingly and is marked where it is used.

**Rotation — the sweep was not chosen, it was computed.** [MEASURED] `docs/pipeline/sweep-rotation.json`
read `last_index: 2`, `last_run_utc: "2026-10-10T18:09:55Z"`, `last_station: "04-scanner"`, 4 sweeps.
`next-sweep.mjs:45` is `(Number(state.last_index) + 1 + n * 2) % n` → `(2+1+8) % 4 = 3` → **index 3,
`instruction-drift`**. Independently corroborated by PR #2308's own commit message: *"Next sweep is index 3,
instruction-drift."* Two instruments, same answer. **And instruction-drift is the one sweep whose entire
corpus is documents** — which is the only thing this transport can reach — so this is genuine coverage of
the sweep the rotation named, not a substitution for a sweep I could not run.

**Bootstrap corpus — by the MCP path, never by walking the root** (`BOOTSTRAP_CORPUS_IS_THE_MCP_PATH_V1`).
[MEASURED] `list_scheduled_tasks` → **4 enabled**, 1 disabled:

| task | cron | enabled | lastRunAt | nextRunAt |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | true | 2026-10-10T22:08:59Z | 2026-10-10T23:13:52Z |
| `03-machine-minder` | `0 9 * * *` | true | 2026-10-09T23:02:54Z | 2026-10-10T23:02:45Z |
| `04-scanner` | `0 */4 * * *` | true | 2026-10-10T22:10:09Z | 2026-10-11T02:09:31Z |
| `05-sot-keeper` | `10 0 * * *` | true | 2026-10-10T14:22:59Z | 2026-10-11T14:22:37Z |
| `weekly-security-audit` | `30 7 * * 1` | **false** | 2026-09-06T21:32:44Z | — |

The enabled count is **FOUR**, matching STATION-CAPABILITIES §1's 2026-09-15 correction and §5's note.
`weekly-security-audit` is still `enabled: false`. No drift on either.

**Version parity — 4 bootstraps against 7 station docs.** [MEASURED] all four enabled bootstraps carry
`<!-- station_doc_version: 1 -->`; `Grep station_doc_version|contract_version` over
`docs/pipeline/stations/` returns `station_doc_version: 1` and `contract_version: 5` for **all seven**
docs (00, 01, 02, 03, 04, 05, 06). **No mismatch anywhere.**

**The split instruction.** [MEASURED] `BOOTSTRAP_CORE_REFERENCE_V1` present in all four enabled bootstraps
(1 hit each). The retired phrase `read these three in full` appears **0 times** in any of them. Both match
`BOOTSTRAPS_ARE_SPLIT_V1` (STATION-CAPABILITIES §3) and its falsifying probe still passes in the direction
the correction predicts. POSITIVE control: `station_doc_version` → present in all four. 00's bootstrap
correctly names `stations/00-supervisor-REFERENCE.md`; 03/04/05's say *"your station doc and
STATION-CAPABILITIES.md are unchanged"* — [MEASURED] true: `docs/pipeline/stations/` contains exactly one
REFERENCE file, `00-supervisor-REFERENCE.md`. No station-REFERENCE pointer is dangling.

**Every path the binding docs name resolves.** [MEASURED]
- `docs/pipeline/DOCTRINE-REFERENCE.md` exists; **every `Full detail:` anchor in DOCTRINE core resolves** —
  heading grep returns §7, 7.1, 8, 8.1, 8.2, 8.3, 8.3a, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.5.1, 9.6,
  10.1, 10.2, 10.2.1, 10.3, 10.4, 10.5, 10.6 and `§INSTRUMENT_LANE_V1`. Nothing DOCTRINE points at is missing.
- `04-scanner.md`'s cross-doc pointer `00-supervisor-REFERENCE.md §POST-MERGE-FF-CURE` → resolves
  (that file, line 661, plus its topic-index entry at line 21).
- `scripts/pipeline/` holds every script the docs name: `pipeline-lib.ps1`, `smoke-pr.ps1`,
  `status-sweep.ps1`, `bring-up-to-speed.ps1`, `arm-prompt.ps1`, `queue-sync.ps1`, `sweep-breadcrumbs.ps1`,
  `next-sweep.mjs`, `check-breadcrumb.mjs`, `lint-prompt.mjs`, `lint-station.mjs`,
  `check-instrument-lane.mjs`, `instrument-lane.json`, `check-queue-layout.mjs`, `vm-git-guard.sh`.
- `scripts/pr-gates/` holds `pr-gates.mjs` and `standing-lanes.json`.
- **The `.gitignore` anchor citation holds.** `# Overnight-QA scheduled task` is at line **113**, and the
  five sinks are at **115–119**: `docs/qa/qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md`,
  `.qa-run.lock`, `qa-run-*.md`. Anchoring on the comment rather than a line number was the right call and
  is still correct.

**A §9.6 near-miss, recorded because it nearly became a false finding.** `Glob **/watcher-launcher*.ps1`
over `C:\ProjectOperations2` returned **only** `scripts/pr-watcher/watcher-launcher.ps1` — no
`watcher-launcher-singlelane.ps1`, which 03's bootstrap calls "the real launcher". That reads as a dangling
citation, and STATION-CAPABILITIES §1 even primes a reader for it (*"the `machine-minder` skill named the
wrong watcher launcher"*). **It is not drift: the file is outside the repo.** `03-machine-minder.md:381`
gives the full path, `C:\po-watcher\watcher-launcher-singlelane.ps1`, with its source of truth
(`C:\po-watcher\ensure-watcher.ps1`, anchor `$Launcher =`). My glob's corpus was the wrong corpus — an
empty result was not an empty world. [CANNOT MEASURE] its existence: see F6.

**`lint-station.mjs`** — [CANNOT MEASURE], it needs node. The sweep brief names it; 3 of its 4 components
were covered, and this is the one that was not.

## WHAT CHANGED

**One file, and it is the one my station doc orders me to change and forbids me to commit.**
`docs/pipeline/sweep-rotation.json`, by a 2-line `Edit` (string replacement, so EOLs and every other byte
are untouched — `Write` was deliberately avoided because a whole-file rewrite risks the mixed-EOL
corruption 04's own station doc warns about):

- before: `"last_index": 2`, `"last_run_utc": "2026-10-10T18:09:55Z"`
- after:  `"last_index": 3`, `"last_run_utc": "2026-10-11T02:09:31Z"`
- read back (DOCTRINE §1): lines 3–5 now read `"last_index": 3`, `"last_run_utc": "2026-10-11T02:09:31Z"`,
  `"last_station": "04-scanner"`. ✅ verified, not assumed.

⚠️ **This was a HAND edit, not `next-sweep.mjs --advance`** — there is no shell to run the owning script
with. I reproduced exactly what `next-sweep.mjs:78-80` writes and nothing else. ⚠️ **And the stamp is the
scheduler's `nextRunAt`, not a measured clock** — the script refuses to invent one, so I used the most
trustworthy external value available rather than a local clock, and I am flagging it here rather than
letting it pass as measured. **LEFT DIRTY. Station 00 commits it; 04 may not.** If 00 judges the stamp
unacceptable, the correct repair is to re-run `node scripts/pipeline/next-sweep.mjs --advance --utc <a time
it actually measured>` from `last_index: 2` — not to leave the rotation unturned.

Nothing else. **No board mutation, no prompt armed, disarmed, renamed, moved or deleted, no PR, no merge,
no label, no `/sot/` edit, no `-HOLD` staged.**

## FINDINGS

**F1 — No execution transport at all: Desktop Commander CONNECT_TIMEOUT *and* the VM sandbox wedged.**
Two independent transports down in one run. Desktop Commander:
`CONNECT_TIMEOUT ... after 30000ms` after a successful load attempt. VM sandbox: wedged on a stuck
`oneshot-779aa0d4-3a3e-4d20-9c09-b0bc7e984622` process that `resume`, `create` and `re-resume` all refuse.
This is not new — the breadcrumb corpus for 2026-10-10 alone carries 00's `0000-blind-no-shell`,
`0716`, `0815`, `0915`, `1114`, `1514` and `1705-blind-and-the-sandbox-wedged-at-call-five`. The sandbox-wedge
half is the same failure 00 recorded at 1705. **Consequence for this run: no liveness verdict, no
safe-to-act verdict, no smoke, no `status-sweep.ps1`, no `lint-station.mjs`, no `check-breadcrumb.mjs`
(it shells `git` and `gh`, so a blind run claims no `--freshness` verdict and this report does not write
`breadcrumb-clean`).**
**DISPOSITION: ESCALATED.** Marco — the question is not "is it blind again" but **which of the two to
repair first, given they now fail together.** RULE 1, complete-and-additive first: (a) **fix the cause of
Desktop Commander's connect timeout** — it is the only transport that can RUN anything on the box, so
repairing it restores liveness, smoke, the sweep scripts and the board, and it damages no data; this
passes both halves. (b) Repair only the VM sandbox — fails the *completely* half: the mount can never run
`.ps1` or `git`, so even a perfect sandbox leaves every verdict unobtainable. (c) Accept blind runs and
widen what they may assert — fails the *without damaging* half outright, because it licenses verdicts from
instruments that cannot measure them, which is the §7 failure this pipeline has paid for six times.

**F2 — Station 00 has been dark for roughly three hours and three hourly occurrences, and 04's own
22:10Z occurrence produced nothing.** [MEASURED] 00's `lastRunAt 2026-10-10T22:08:59Z` with
`nextRunAt 2026-10-10T23:13:52Z` — a `nextRunAt` ~3h in the past against a `5 * * * *` cron, so the 23:13,
00:13 and 01:13 occurrences did not fire. [MEASURED] the newest 00 breadcrumb in the dev tree is
`00-00-supervisor-2026-10-10-2114-...`; there is none stamped 22xx or later, although every run writes one.
[MEASURED] `main`'s tip is #2309 at `2026-10-10T22:00:01Z` — no commit since. [MEASURED] 04's own
`lastRunAt 2026-10-10T22:10:09Z` left **no** breadcrumb either (the corpus jumps `...-1810-...` → this file).
03 is in the same shape: `nextRunAt 2026-10-10T23:02:45Z`, also ~3h past, `lastRunAt` still 2026-10-09.
[INFERRED] the pipeline's one closing channel is shut: **00 is the only actor that dispositions breadcrumbs
and the only one that commits them**, so this report, like 04's 22:10Z run, stays untracked until 00 returns.
⚠️ Weakened by the F-clock defect only where dates are used; the `nextRunAt`-in-the-past reading does not
depend on breadcrumb dates. ⚠️ **Falsifying probe:** re-read `nextRunAt` for `00-supervisor` from the MCP.
If it has advanced past 2026-10-10T23:13:52Z, 00 fired and this finding is wrong.
**DISPOSITION: ESCALATED.** Marco — the scheduler is your layer, not the repo's. Note this is the *second*
time this shape has been raised: `docs/pipeline/discharges/2026-10-10-0226Z-stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
discharged the previous instance as **false** on live MCP evidence, so the honest framing is *"it is back,
with a 3-hour gap rather than a 9-day one"* — and the discharge is exactly why I am quoting the raw
`nextRunAt`/`lastRunAt` pairs instead of asserting a day count.

**F3 — The instruction-drift sweep itself: CLEAN on everything measurable.** Version parity 4/4 bootstraps
against 7/7 station docs (all `1`/`5`); `BOOTSTRAP_CORE_REFERENCE_V1` 4/4; the retired `read these three in
full` 0/4; every `Full detail:` anchor in DOCTRINE resolves; `§POST-MERGE-FF-CURE` resolves; every pipeline
script and gate file the docs name exists; the `.gitignore` comment anchor and its five sinks are exactly
where every bootstrap says. Three of the brief's four components covered; `lint-station.mjs` is the fourth
and it needs a shell.
**DISPOSITION: ACTIONED** — the sweep ran and found no defect in these components; the rotation is advanced
(see WHAT CHANGED) so the next 04 run moves to index 0, `gate-liveness`, instead of repeating this one.

**F4 — 03's bootstrap still pastes a cadence its cron contradicts.** [MEASURED] 03's `SKILL.md:8`:
*"Cadence: every 4 hours, or manually after any crash or reboot"*; live cron `0 9 * * *` = **daily**. This
is the drift STATION-CAPABILITIES §5 and §6 already record as open with Marco. Contrast 00's bootstrap,
which handles it correctly — it defers to `list_scheduled_tasks` and explicitly says *"Never compute a
missed-occurrence verdict from a cadence pasted here."* 04's *"every 4 hours"* matches `0 */4 * * *` ✅ and
05's *"daily"* matches `10 0 * * *` ✅, so 03 is the only one wrong.
**DISPOSITION: DEFERRED** — real, already filed, not newly urgent. What would make it urgent: any run
computing a missed-occurrence verdict for 03 from the pasted figure, which would be wrong by 6x in the
direction of *not noticing a missed run* — the same shape as escalation #23. The complete fix is to give
03's bootstrap 00's wording verbatim; it is Marco's layer, so it rides with F5.

**F5 — 05's bootstrap cites `pr-gates.mjs:327` by LINE NUMBER, in the same breath as the rule against
exactly that.** [MEASURED] 05's `SKILL.md:87`: *"CP-24 is a hard block: a PR mixing `sot/` with `scripts/`
or `apps/` fails (`pr-gates.mjs:327`)"* — while the very same file (line 111) tells the station to cite the
`.gitignore` sink list *"by the comment, never a line number"*, because that citation had already rotted
twice. And it is already drifting: CP-24's block begins at **321**, the hard-block branch at **342**, and
**327 is a comment line**. [MEASURED] the substance is correct — `codeRe` at line 330 is
`/^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/`, so `docs/` is genuinely
excluded and *"`sot/` plus `docs/` is allowed"* holds. [MEASURED] **05's station doc already does this
right** — `05-sot-keeper.md:354` cites *anchor: `const sotRe = /^sot\//`*, which resolves at line 329. So
the repo layer is correct and only Marco's layer carries the inferior form.
**DISPOSITION: ESCALATED.** Marco — a two-word edit to a file only you can change, in the same batch as F4.
RULE 1, complete-and-additive first: (a) **replace `(pr-gates.mjs:327)` with the station doc's own anchor,
`(anchor: `const sotRe = /^sot\//` in `scripts/pr-gates/pr-gates.mjs`)`, and replace 03's cadence sentence
with 00's MCP-deferring wording** — both layers then agree, no line number can rot, and nothing else is
touched; passes both halves. (b) Fix only the line number to 321 — fails the *future* half: it is still a
line number and will rot on the next edit to that file. (c) Leave both — fails the *future* half; the
bootstraps exist to be thin pointers, and a pointer that rots is the exact failure the thinning was for.

**F6 — On the native-file-tools transport the MCP `path` is not merely the correct bootstrap selector, it
is the ONLY one that works — and §4's mount list does not hold here.** [MEASURED], three readings:
`Read C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md` → **succeeded** (outside the connected
folders); `Glob C:\Users\Marco\Claude\Scheduled\**\SKILL.md` → **refused**, *"outside this session's
connected folders"*; `Read C:\po-watcher\watcher-launcher-singlelane.ps1` → **refused**, same reason. So the
gate is per-tool and per-path, not a flat "outside connected folders" rule, and the `path` values the
scheduled-tasks MCP hands back are readable where the root is not walkable. This gives
`BOOTSTRAP_CORPUS_IS_THE_MCP_PATH_V1` a **second, independent justification**: it was adopted because a
count-defined corpus rots (26 files, 6 live), and it turns out that on this transport walking the root is
not even possible. ⚠️ **And the cost side:** STATION-CAPABILITIES §4 lists eleven-odd mapped folders and §3's
`BLIND_RUN_OTHER_MOUNTS_V1` tells a blind run to enumerate them; on *this* transport the reachable set is
**two** connected folders (`C:\ProjectOperations2`, `C:\PR-Master`), so `C:\po-watcher` — and with it the
clone's daily log, `verdicts-archive`, and `ensure-watcher.ps1` — is unreachable. A run following §3
literally here would conclude the verdict homes are empty rather than unreadable, which is §9.6 wearing a
mount for a hat. ⚠️ **Falsifying probe:** from any run with neither Desktop Commander nor a mount, `Read` an
MCP-reported bootstrap `path`, then `Glob` that same root, then `Read` anything under `C:\po-watcher`. If
all three behave the same way, this finding is wrong.
**DISPOSITION: DISPATCHED to Station 00** — one docs PR adding this to STATION-CAPABILITIES §3 beside
`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`, whose current wording says the native tools read
`C:\ProjectOperations2` and says nothing about either asymmetry. 04 may not open a PR.

**F7 — The rotation advance exists only as an uncommitted dev-tree edit, for the third consecutive time.**
`docs/pipeline/sweep-rotation.json` is modified and untracked-as-change in the shared dev tree. #2308's own
commit message records the previous occurrence (*"04's 0624 and 1410 advances were never committed"*, main
two positions stale), and it was fixed by 00 committing it. With 00 dark (F2) the same stall is already
reproducing. ⚠️ Also note the dev-tree hazard 04's own contract flags: an untracked or modified file in the
dev tree blocks the next `git merge --ff-only` while `--numstat` and `--cached` both read EMPTY. This file is
*tracked and modified*, which blocks a fast-forward identically — and this breadcrumb is a *new* untracked
path, which blocks it once a PR lands that exact path on main.
**DISPOSITION: DISPATCHED to Station 00** — commit `docs/pipeline/sweep-rotation.json` and this breadcrumb
with the next board PR, and read F7's stamp caveat in WHAT CHANGED before trusting `last_run_utc`.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for the sweep.** The two GitHub calls in this report are
  `list_commits` to prove the tip, used *only* to validate the GROUND block and the freshness proof. No
  board state, no PR census, no gate evaluation was taken from GitHub and presented as coverage.
- **Did not run the gate-liveness, instrument-honesty or repo-hygiene sweeps.** The rotation named
  instruction-drift and one sweep per run is the rule. Instrument-honesty in particular is unrunnable
  blind: every §9 trap it must reproduce is a shell, `git` or `gh` command.
- **Did not run `lint-station.mjs`, `check-breadcrumb.mjs`, `status-sweep.ps1`, `next-sweep.mjs`, or any
  `.ps1`.** No execution transport (F1). `check-breadcrumb.mjs` is additionally forbidden to a blind run
  because it shells `git` and `gh`; **this report therefore does not claim `breadcrumb-clean`**, and its
  five sections have been ordered by hand against the contract rather than validated.
- **Did not clear, inspect or reason about `.git/index.lock`.** That needs byte size and age crossed
  against running git processes, which is a shell reading, and clearing it is 03's on 00's dispatch.
- **Did not invoke `git` through any transport**, and did not install the git guard (it did not execute,
  F1) — so the device-bridge git ban was kept by not needing it, which is the only way a blind run can
  keep it honestly.
- **Did not mint a worktree** to get a clean read — explicitly forbidden to 04; the freshness proof above
  is what replaced it.
- **Did not stage a `-HOLD` prompt.** Nothing this sweep found is repairable by a prompt: F4 and F5 are
  edits to Marco's scheduled-task layer, F6 is a docs PR for 00, F1 and F2 are machine and scheduler
  faults.
- **Did not touch `C:\PR-Master`**, the session's other connected folder — outside this sweep's corpus.
- **Did not write to any gitignored sink.** This file is at the tracked path
  `docs/pr-prompts/00-04-scanner-2026-10-11-0209-...md`, not in `docs/qa/` and not in the session's
  `outputs` folder, which is where a blind run's whole report died on 2026-09-22.
