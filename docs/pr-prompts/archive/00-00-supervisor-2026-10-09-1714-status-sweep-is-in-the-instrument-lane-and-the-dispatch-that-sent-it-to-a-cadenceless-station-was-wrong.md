# Station 00 — Supervisor | 2026-10-09T17:14Z–2026-10-09T17:5xZ

## GROUND

```
UTC            2026-10-09 17:14:18
origin/main    661ecf89            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 661ecf89      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so this run was not read-only.

DOCTRINE.md, 00-supervisor.md and STATION-CAPABILITIES.md were all read in full from
`git show origin/main:<path>` in the dev tree `C:\ProjectOperations2` — never from the working
copy, never in the watcher clone. No REFERENCE section was opened: no core line sent me to one.

## WHAT I MEASURED

### Preflight step 1 — NOT BLIND, on the first call after loading the schemas

[MEASURED] One keyword `ToolSearch` for `desktop-commander` returned the toolkit under the prefix
`mcp__plugin_desktop-commander_desktop-commander__`. `start_process` (shell `powershell.exe`) then
returned on the FIRST call with `main` and `2026-10-09T17:14:18Z`. No retry needed, so
BOOTSTRAP_CONNECT_RETRY_V1 did not fire.

### The device-bridge git guard — EXIT 2, INSTALLED BUT INERT (eighth consecutive report)

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read
from the INSTALLER itself with no appended pipeline stage:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
EXITCODE=2
```

Its own controls, quoted: `bash -lc 'command -v git'` →
`/sessions/optimistic-wizardly-einstein/.local/bin/git` (the shim); `bash -c 'command -v git'` →
`/usr/bin/git` (the real git). Exit 2 is the EXPECTED station outcome — a FINDING, not a STOP.
Every `git` call in this run went through Desktop Commander on the Windows host; I ran no `git`
through the device bridge against any mounted folder.

### Safe-to-act gate — `status-sweep.ps1`, generated 2026-10-09 17:14:55Z

[MEASURED] Section 0 positive controls both PASS (`gh CAN reach GitHub (saw merged PR #2290)`;
`node runs`). No `[BROKEN]` anywhere in section 0.

```
1. GITHUB    OPEN PRs: 0 | WAITING ON MARCO: 0 | ALL OPEN (non-draft): 0
             main CI on 661ecf89: 4 success / 0 failed / 0 running  (trunk green)
2. WATCHER   watcher node RUNNING pid 8848 | auto-restart wrapper alive (1)
             heartbeat age 48 min (ticks only mid-run; stale + empty queue = idle, NOT wedged)
             watcher clone: branch=main tracked-dirty=0 untracked=3
             non-main worktrees found: 33
```

**MARCO_QUEUE_LINE_V1:** `WAITING ON MARCO: 0 open PR(s) labelled do-not-merge`; armed `*-ready.md`
at depth 1: **0**. I armed nothing this run, so neither figure moved.

[MEASURED] The sweep again did not reach its own closing SAFE / CAUTION / DO-NOT-ACT verdict inside
this run — it was still enumerating the 33 worktrees in section 2 when I stopped reading its buffer
at 89 lines. **I therefore quote no sweep verdict.** This is F71 from my 16:14Z predecessor
recurring, not a new finding; see the re-disposition in F76 below.

### Missed-occurrence check — all four enabled stations fresh

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **0**, verdict `CLEAN`:

```
structure: 1 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-09T16:14:00Z  1.0h ago  (cadence 1h + grace 0.5h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-08T23:06:00Z 18.2h ago  (cadence 24h + grace 3h)   ok
  04  last 2026-10-09T14:12:00Z  3.1h ago  (cadence 4h + grace 1h)    ok
  05  last 2026-10-09T14:22:00Z  2.9h ago  (cadence 24h + grace 3h)   ok
```

[MEASURED] Crossed against `list_scheduled_tasks` (the MCP, never this file or a folder listing):

| task | cron | lastRunAt | nextRunAt |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-10-09T17:13:58Z | 2026-10-09T18:13:52Z |
| `03-machine-minder` | `0 9 * * *` | 2026-10-08T23:06:07Z | 2026-10-09T23:02:45Z |
| `04-scanner` | `0 */4 * * *` | 2026-10-09T14:09:36Z | 2026-10-09T18:09:31Z |
| `05-sot-keeper` | `10 0 * * *` | 2026-10-09T14:22:42Z | 2026-10-10T14:22:37Z |

`weekly-security-audit` `enabled: false`, `lastRunAt 2026-09-06T21:32:44Z` — the live enabled count
is still **FOUR**. My own cadence read from the MCP is **hourly** (`5 * * * *`); `lastRunAt
17:13:58Z` is this run. No station is MISSED, so no station needed the never-fired /
fired-and-died / reported-not-merged classification, and I disabled, enabled, re-ran and edited no
scheduled task.

### COLLECT — one breadcrumb since my last run, already fully dispositioned

[MEASURED] Exactly one breadcrumb sits at depth 1 in `docs/pr-prompts/`:
`00-00-supervisor-2026-10-09-1614-the-board-is-empty-a-fourth-cycle-and-the-sweeps-own-section-5-cannot-finish-inside-a-run.md`,
and `git ls-files --error-unmatch` on it exits **0** — it is TRACKED, landed by #2289 with its
post-merge appendix landed by #2290.

[MEASURED] I read it in full. Its findings and dispositions: F70 **DEFERRED**, F71 **DISPATCHED**
(Station 06), F72 **DEFERRED**, F73 **DEFERRED**, F74 **DEFERRED**, F75 **DISPATCHED**
(Station 06). Six findings, six dispositions, none left open. No 03/04/05 breadcrumb is
uncollected: `--freshness` read all four stations off breadcrumbs it found, and the two station
reports written since my predecessor's COLLECT were already archived by it.

**It is collected and due to be archived, and I did NOT archive it — see WHAT I DID NOT DO.**

### The instrument-lane allowlist, read directly — `status-sweep.ps1` is IN it

[MEASURED] `git show origin/main:scripts/pipeline/instrument-lane.json`. Its `files` array, which
is the **allowlist** INSTRUMENT_LANE_V1 keys on, begins:

```json
"files": [
    "scripts/pipeline/status-sweep.ps1",
    "scripts/pipeline/check-breadcrumb.mjs",
    "scripts/pipeline/lint-prompt.mjs",
    ...
],
"tests": [ "scripts/pipeline/__tests__/**" ]
```

`scripts/pipeline/status-sweep.ps1` is **entry number one**. The NEVER-LIST is a separate thing —
it lives in the file's `_readme` prose and names `pipeline-lib.ps1`, `arm-prompt.ps1`,
`new-worktree.ps1`, `retire-escalation.mjs`, `dispatch.mjs`, and everything under
`scripts/pr-watcher/`, `scripts/pr-gates/`, `.github/`, `docs/`, `sot/`, `apps/`, `prisma/`, plus
`instrument-lane.json` itself.

POSITIVE control that I am reading the two lists apart correctly: `pipeline-lib.ps1` appears in the
`_readme` never-list and is **absent** from the `files` array — which is the polarity my
predecessor's F75 relied on, and it holds. NEGATIVE control, a needle minted this run:
`zqx-1714-needle-lane` → 0 hits in the file.

### The board, and whether anything is armable

[MEASURED] `OPEN PRs: 0`, `ALL OPEN (non-draft): 0`, armed `*-ready.md` at depth 1: **0**. Nothing
to merge, nothing to drive, nothing to update. **Fifth consecutive cycle with an empty board**
(#2283, #2285, #2286, #2287, #2289 all record the same reading).

[MEASURED] `Get-ChildItem docs\pr-prompts\*-HOLD.md` → **13** HOLD prompts at depth 1. I did not
re-derive their gate readings: my own 13:13Z predecessor's `requires_on_main` probe returned a
confident wrong answer on exactly this question (#2285), and Station 04's 14:12Z breadcrumb
independently measured *thirteen premises alive, zero gates satisfied* over the same corpus. I
quote that as 04's measurement, not mine.

[MEASURED] `docs/pr-prompts/needs-marco/` holds **53** files. `draft/` and `brainstorm/` hold
**0** each.

### My own instrument broke mid-run, and it cut a script off in the dev tree

[MEASURED] I called `start_process` with `timeout_ms: 240000` on a setup script. The MCP server
answered `tool "start_process" timed out after 180s` — the server's own cap is 180 s and my
requested value exceeded it, so the script was cut off mid-flight rather than reporting anything.

[MEASURED] I then measured the state rather than assuming either outcome, because a cut-short
`git` call against the Windows `.git` is DOCTRINE §9.2's 0-byte-`index.lock` hazard:

```
C:\ProjectOperations2\.git\index.lock              ABSENT
C:\po-watcher\ProjectOperations\.git\index.lock    ABSENT
Get-Process git                                    0
MERGE_HEAD / REBASE_HEAD / CHERRY_PICK_HEAD        none present
git rev-parse HEAD                                 661ecf89…
git rev-list --left-right --count HEAD...origin/main   0   0
git diff --cached --name-status                    EMPTY
Test-Path C:\po-wt\brd-1714                        False
git worktree list | Select-String brd-1714         (no match)
git branch --list docs/board-1714-collect          (no match)
```

**No damage, and no lease taken.** A separate probe confirmed the instrument itself is sound and
fast: dot-sourcing `pipeline-lib.ps1` completed in `0s`, `Get-BoardLeasePath` returned
`C:\ProjectOperations2\.git\po-board-lease.json`, and `Get-BoardLease` returned **empty** — the
board lease is FREE, measured directly rather than inferred from a release call's boolean (my
predecessor's F75 lesson).

## WHAT CHANGED

**Nothing on the board.** No PR was opened, merged, queued, labelled or updated. No prompt was
armed, promoted, moved or retired. No lease was taken or released. No worktree was created or
pruned. No scheduled task was touched. `/sot/` was not opened.

The only write this run made anywhere is **this breadcrumb**, written to the dev tree at
`C:\ProjectOperations2\docs\pr-prompts\`, which the station contract names as a correct home —
"where Station 00 collects it". It is UNTRACKED until a future board PR commits it, so my successor
must sweep it up.

## FINDINGS

### F76 — S3 — `status-sweep.ps1` is the FIRST entry in the instrument-lane allowlist, so F71's dispatch to a cadence-less station rested on the opposite reading

My 16:14Z predecessor's F71 dispatched the `status-sweep.ps1` runtime fix to Station 06 on the
stated grounds that the script "is outside 00's recorded lane … and sits in the instrument-lane
file's neighbourhood, so it is not mine to change and merge." Measured above: it is not in the
neighbourhood of the lane, it is **entry number one inside it**, with both controls.

Why this matters more than one mis-citation: Station 06 has **no cadence**, which is itself an open
escalation (`needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`), and
five items are now queued to it. Dispatching work to a station that does not run is a channel that
looks closed and is not — the same shape as the gitignored `qa-findings.md` that swallowed a
released gate for nine days. **Of the five, this reading moves exactly one.** The others stand:
F65's fix is `.github/ci.yml` and F75's is `pipeline-lib.ps1`, both genuinely on the never-list.

🔧 **The rule, not the state: `instrument-lane.json` contains TWO lists with opposite meanings —
the `files` array is the allowlist, the `_readme` prose is the never-list. Read the array, not the
prose, before concluding a script is out of lane.**

⚠️ **Falsifying probe:** `git show origin/main:scripts/pipeline/instrument-lane.json` and look for
`status-sweep.ps1` in the `files` array. If it is ever absent, or moved into the `_readme`
never-list, this finding is wrong and the dispatch was right.

**DISPOSITION: ACTIONED** — the reading is corrected and recorded here with controls, and F71 is
re-dispositioned from **DISPATCHED (Station 06)** to **DEFERRED**, to be staged by 00 itself as the
prompt drafted in full under FOR MARCO below. I did not stage it this run (see F77 and WHAT I DID
NOT DO): there was not enough of my hourly slot left to carry a stage → CI → merge → fast-forward
cycle safely, and overrunning the slot eats the next occurrence
(`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`).

### F77 — S3 — PROMPT-SCHEMA's self-retirement rule and INSTRUMENT_LANE_V1 are mutually exclusive, so a watcher-built instrument PR can never be in lane

[MEASURED] `PROMPT-SCHEMA.md` makes it a hard rule, with a three-row measured table behind it, that
**every prompt's `scope` must name its own `-HOLD.md` path** so the building PR retires it:
"A prompt whose `scope` does not name its own file is never retired by the PR that builds it, and
it stays armable forever." That path is under `docs/pr-prompts/superseded/`.

[MEASURED] `instrument-lane.json`'s `_readme` puts **"Everything under `docs/`"** on the
never-list, and its condition 1 is that *every* changed file in the PR be in `files` or match
`tests`.

[INFERRED] Therefore any PR the watcher builds from an instrument-lane prompt contains at least one
`docs/` path by construction — the prompt's own retirement — and is out of lane. INSTRUMENT_LANE_V1
can only ever fire for a PR that a station hand-authors with no prompt behind it. The lane was
merged on 2026-10-03 to let 00 merge instrument fixes without Marco; as written it cannot do that
for anything that came through the queue.

This is the second structural trap on this lane in three days: #2261 reached 13/15 green before
anybody noticed its single file was never-listed (NEVER_LIST_BEFORE_ARMING_V1).

RULE 1 options, complete-and-additive first:

1. **Exempt the prompt's own retirement path from the lane check** — teach
   `check-instrument-lane.mjs` to ignore a single deletion/rename under
   `docs/pr-prompts/superseded/` matching the prompt that built the PR, **and** keep every other
   `docs/` path out of lane. Complete: queue-built instrument fixes become mergeable by 00
   immediately and in future, which is what the lane was merged for. Additive: no prompt changes
   shape, no other `docs/` path gains access, the never-list is otherwise untouched, and the
   self-retirement rule that fixed a five-times-refound defect keeps working. **Fails neither
   half.**
2. **Drop the self-retirement requirement for instrument-lane prompts only.** Fails the *without
   damaging* half: it re-opens the stays-armable-forever defect for exactly the prompts that touch
   this pipeline's own instruments.
3. **Accept it and route every queue-built instrument fix to Marco.** Additive and safe, but fails
   the *completely (immediately and future)* half — it is the status quo, and it means the lane
   delivers nothing it was merged to deliver.

Option 1 changes `scripts/pipeline/check-instrument-lane.mjs`, which is **not** in the `files`
allowlist, so it is not mine to change and merge either way.

⚠️ **Falsifying probe:** run `node scripts/pipeline/check-instrument-lane.mjs` against a PR diff
containing `scripts/pipeline/status-sweep.ps1` plus one renamed
`docs/pr-prompts/superseded/<slug>-HOLD.md`. If it reports `IN_LANE`, the inference above is wrong,
the exemption already exists, and F76's prompt can be armed as an ordinary in-lane fix.

**DISPOSITION: ESCALATED** — to Marco, with the three options above and option 1 first. This is a
design question about a lane he ruled on seven days ago, and §5.5 forbids me guessing his intent.
It is also the precondition that decides whether F76's prompt gets armed with a `do-not-merge`
label or without one, so it is worth one answer rather than five more hourly DEFERREDs.

### F78 — S4 — A `timeout_ms` above the MCP server's 180 s cap cuts the script off instead of waiting

Measured above. I asked for 240 s; the server answered `timed out after 180s` and the script was
killed mid-flight with none of its output returned. The failure is silent about what the script did
or did not do, which is DOCTRINE §7's shape exactly — and the script in question was about to take
the board lease and run `git worktree add` against the dev tree, so the two outcomes a station
most needs to distinguish (lease taken / not taken) were both consistent with the error text.

It cost nothing this time because the state reads came back clean, but the near-miss is the point:
had the cut landed inside the `git` call, §9.2's 0-byte `index.lock` would have frozen every
station, and the error message would have looked identical.

🔧 **The rule: keep `timeout_ms` at or below 170 s on this transport, and after ANY tool-level
timeout measure the state before forming either conclusion — never read "the tool timed out" as
"the work did not happen."**

**DISPOSITION: ACTIONED** — recorded here with the state reads that proved no damage, and every
subsequent call in this run used `timeout_ms: 170000` or less. No instrument needs changing; the
cap is the server's and the cure is in how a station calls it.

### F79 — S3 — The board is empty for a fifth consecutive cycle and nothing on it is armable

[MEASURED] `OPEN PRs: 0`, armed `0`, 13 HOLDs at depth 1, trunk green on `661ecf89`
(4 success / 0 failed / 0 running). [INFERRED] from Station 04's 14:12Z breadcrumb: thirteen HOLD
premises alive, **zero gates satisfied**.

This is still not idleness to be fixed by arming something — arming on an unmet gate is #2261's
wasted build. What has changed since my predecessor wrote the same finding is that there is now a
piece of work 00 can legitimately put on the board itself (F76), so the fifth empty cycle is the
last one that should be reported as purely structural.

**DISPOSITION: DEFERRED** — real, and not now. What would make it urgent: F77 answered, which
unblocks staging F76's prompt; or a HOLD whose named predecessor PRs are all confirmed merged on
`main`, which is a gate SATISFIED and an arm I would take the same cycle; or Marco releasing the
five HOLDs waiting on the approval channel
(`needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`).

### F80 — S4 — The device-bridge git guard reports INERT (exit 2) for the eighth consecutive report

Measured above with the installer's own two controls. The shim is byte-correct and not on the
`PATH` of the non-interactive, non-login shell a station is given, so the device-bridge `git` ban
is **remembered, not mechanical**.

**DISPOSITION: DEFERRED** — not re-escalated, for the reason six predecessors gave: the mechanism
is understood, the one-call `PATH=` form works, and the standing cure (every station's `git` goes
through Desktop Commander on the host) held again this run — including through a tool-level timeout
that cut a script off mid-run, which is the case most likely to have broken it. What would make it
urgent: any run that leaves a 0-byte `index.lock` in a mounted tree, or an exit code other than 0
or 2.

### F81 — S4 — 33 orphaned worktrees, unchanged, several holding unpushed commits

[MEASURED] `non-main worktrees found: 33`. The largest unpushed holdings are `C:/po-wt/fv2drop`
(21 commits, age 22115 min) and `C:/po-worktrees/sup-cwd-paths` (4 commits **and** 2 dirty files,
age 22180 min) — the latter is one `git worktree remove` would refuse and `--force` would discard.

**DISPOSITION: DEFERRED** — not re-dispatched. Station 03 holds the standing hand-over for
worktree hygiene, is report-only by the authority matrix, and its next occurrence is
`2026-10-09T23:02:45Z`. Re-dispatching the same census hourly is noise. What would make it urgent:
a prune proposed by anyone against a worktree holding unpushed commits or dirty files — that is
irreversible and becomes Marco's (DOCTRINE §5.4), not 03's and not mine.

## WHAT I DID NOT DO

- **I opened no board PR, so I archived nothing.** The 1614 breadcrumb is collected and
  dispositioned above and is due for `git mv` into `docs/pr-prompts/archive/`, but that move
  belongs in a board PR. Doing it in the dev tree would stage a rename in an index **shared with
  other chats** and leave it uncommitted for whoever committed next. My successor should archive it
  together with this breadcrumb.
- **I armed nothing.** 13 HOLDs, zero gates satisfied (04, 14:12Z). The one armable thing I
  identified is F76's own prompt, which does not exist yet.
- **I did not stage F76's prompt.** Not enough slot left to carry stage → CI → merge →
  fast-forward, and F77 changes whether the resulting PR needs a `do-not-merge` label. Its full
  text is below so the next cycle stages it in one move.
- **I merged nothing.** The board held 0 open PRs, so there was no PR to classify under DOCTRINE
  §10.1, no instrument-lane candidate, and no receipt to write.
- **I did not take the board lease.** Measured FREE via `Get-BoardLease` and left that way; no
  mutation needed it.
- **I did not quote a sweep verdict.** Section 5 never finished (F71). Nothing this run depended on
  one, because I mutated nothing.
- **I did not clear any `[STALE]` escalation row,** and did not run `retire-escalation.mjs`. The
  sweep's section 5 never completed, so I hold no stale-claim cross-check at all.
- **I did not prune a worktree or a registry-escapee.** Not my lane (03's, report-only), and the
  dirty ones are irreversible.
- **I did not fix `status-sweep.ps1` or `check-instrument-lane.mjs` myself,** and did not edit
  `instrument-lane.json` — changing the allowlist is always Marco's.
- **I did not touch `/sot/`.** Station 05's alone.
- **I did not disable, enable, re-run or edit any scheduled task.** No station was MISSED.
- **No Azure, Entra or SharePoint anything.** No portal, no app settings, no secrets, no `az`, no
  `Connect-MgGraph`. No production data was read or written.

## FOR MARCO

**Nothing is broken.** The board is empty, trunk is green on `661ecf89`, all four enabled stations
are fresh, the watcher is running, and no PR is waiting on your label.

**One question, and it is worth one answer rather than five more hourly DEFERREDs — F77.** The
instrument lane you ruled on 2026-10-03 cannot fire for any PR the watcher builds, because
`PROMPT-SCHEMA` requires every prompt to retire its own file under `docs/`, and `docs/` is on the
lane's never-list. So the lane currently delivers nothing for queue-built work. My recommendation
is option 1: exempt **only** a prompt's own retirement path from the lane check, leaving every
other `docs/` path out and the self-retirement rule intact. Option 2 (drop self-retirement for
instrument prompts) re-opens a defect this pipeline re-found five times; option 3 is the status quo.

**Second, smaller:** Station 06 still has no cadence and four items remain queued to it
(F65's `ci.yml` fix, F75's `pipeline-lib.ps1` fix, and the two in F67). F76 took the fifth item
back off that queue this cycle, because it turned out to be mine all along.

---

## The prompt F76 calls for, drafted in full so the next cycle stages it in one move

Staging this is a docs-only board PR — 00's own lane — and it does **not** arm anything. Arming is
a separate, deliberate `git mv` once F77 says whether the built PR needs a `do-not-merge` label.
File: `docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`

```yaml
---
premise: '! grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1'
premise_means: status-sweep.ps1 has no way to skip or shorten section 5, so its closing verdict is unreachable inside a station run.
scope:
  - scripts/pipeline/status-sweep.ps1
  - scripts/pipeline/__tests__/status-sweep-section5.test.mjs
  - docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md
done_when: pnpm lint && node --test scripts/pipeline/__tests__/status-sweep-section5.test.mjs && grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1
size: 3
gate_allow: none
seed_only: false
escalates: false
module: pipeline
---
```

Body, in brief — the full STANDING AUTHORITY block and guardrails to be written verbatim from
`PROMPT-SCHEMA.md` at staging time:

- **What to build.** In `scripts/pipeline/status-sweep.ps1`: (a) section 5 currently calls
  `gh pr view $n --json state,isDraft,mergedAt` once per `#N` **occurrence** — 383 occurrences,
  153 distinct, across 52 `needs-marco/` files (measured by Station 00, 2026-10-09T16:29Z).
  Ask each distinct PR number **once per run** and cache the answer in a hashtable keyed by
  number. (b) Add a `-SkipSection5` switch parameter that skips the crawl and prints one line
  saying it was skipped and why. (c) Print a per-section elapsed line so the next station can see
  where the time goes. Add `scripts/pipeline/__tests__/status-sweep-section5.test.mjs` asserting
  the cache asks a repeated number once and that the switch suppresses the crawl.
- **Do NOT** touch any other section's readings, remove section 5 from the default run, change
  what it reports, edit `instrument-lane.json`, or touch anything under `sot/`, `apps/`,
  `prisma/`, `.github/` or `scripts/pr-watcher/`.
- **Title the PR** `fix(pipeline): <summary>` — `module: pipeline`, enforced by
  `check-pr-title.mjs`.
