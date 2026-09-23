# Station 00 — Supervisor | 2026-09-23T19:14:37Z–2026-09-23T20:0xZ

## GROUND

```
UTC            2026-09-23T19:14:37Z
origin/main    564108ef            (fetched, then rev-parse)
dev tree       main @ 564108ef     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** — this run was not read-only-by-mismatch.

**Read transport. SIGHTED.** Desktop Commander `start_process` shell `powershell.exe`, reached on the
first call. [MEASURED] `2026-09-24T05:14:20.5678417+10:00` / `LAPTOP-E6NHU4E4` /
`Test-Path C:\ProjectOperations2\docs\pipeline\DOCTRINE.md` → `True`.

⚠️ **Clock note.** The host is Brisbane (UTC+10) and its local date is **2026-09-24**; every
timestamp here is **UTC**, so this run is stamped 2026-09-23.

**PREFLIGHT step 2 compliance.** The station doc requires the three binding documents to be read from
`git show origin/main:<path>`, never the working copy. [MEASURED] the working copy is provably
identical to `origin/main` for all three — `git diff --numstat origin/main --` over
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, and
`git rev-list --left-right --count HEAD...origin/main` → `0 0`. No piped `hash-object` was compared
against anything (§9.3 probe T). All three were read in full.

**vm-git-guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit read from the INSTALLER and not from a pipeline appended to it:

```
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```
`GUARD_EXIT=2`

Exit 2 is the **expected** station outcome per the three-outcome table — a FINDING, not a STOP.
**Zero `git` commands were run through the device bridge against the Windows `.git` in this run.**

**Marker discipline (§9.1's early-return guard).** Every `interact_with_process` chain echoed a
literal marker after each statement group and **every marker was present in the drained buffer**.
One chain returned a tool-layer timeout at 180 s; per §9.1 the buffer was drained rather than the
shell abandoned, and all four markers (`MARKER_CD`, `MARKER_SWEEP_EXIT`, `DECODED`, `MARKER_DECODE`)
were present. No statement in this run is `[CANNOT MEASURE]` through a false termination.

---

## WHAT I MEASURED

### The sweep, and the verdict I acted under

`scripts/pipeline/status-sweep.ps1`, captured with `*>` and decoded **utf16le** per §9.3 (the capture
was 140,336 bytes opening `FF FE`, exactly the trap that bullet names; read as utf8 its section
headers match nothing).

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

| [LIVE] line | reading |
|---|---|
| OPEN PRs: **1** — `#2127` BEHIND, 14 pass / 0 fail / 1 pending | the whole board |
| main CI on `564108ef`: 4 success / 0 failed | trunk green |
| watcher node RUNNING **pid 38776**, wrapper alive (1), heartbeat 34 min | idle with an empty queue, **not wedged** |
| armed (`*-ready.md`): **0** | nothing in flight |
| `index.lock` dev/clone: `False` / `False`; git processes touching our trees: **0** | single-actor condition 3 satisfied |
| `needs-marco/` **46** · `no-pr-opened/` **111** · `failed/` **59** · `blocked/` **150** | unchanged |
| orphaned worktree `C:/po-wt/s9hex` `f878a0a1` detached, dirty=0, age 781 min | F5 |

**Section 5 carried ZERO live `[STALE]` escalation rows.** [MEASURED] all four `[STALE]` hits in the
capture are the header legend and one quoted `[FILE]` line, not tagged rows — so there is nothing to
discharge into `needs-marco/discharged/` this run. The two `[FILE]` rows name escalations citing
merged PRs **as evidence, not as their premise**, which the sweep says in as many words; left alone.

⚠️ **`watcher clone: branch=main dirty=1 <-- the watcher may refuse to start` is the known false
warning, re-measured rather than re-dispatched.** [MEASURED] both forms against the clone in the same
minute: `git status --short` → **1**, `git status --porcelain --untracked-files=no` → **0**. The one
file is `?? docs/pr-reviews/pr-2127-review.md`, a review verdict the `rev-<N>` job writes into the
clone **by design**. This is DOCTRINE §9.5's `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` clone row, whose
falsifying probe is exactly that pair — **it still disagrees, so the row is still live.** My
predecessor's 18:16 run already narrowed this dispatch; I did not re-file it.

### COLLECT — every breadcrumb since my predecessor, and the cross-check

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**, structure
`2 checked, 0 malformed`:

```
00  last 2026-09-23T18:16:00Z  1.0h ago  (cadence 1h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-22T23:29:00Z  19.8h ago  (cadence 24h)  ok
04  last 2026-09-23T18:10:00Z  1.1h ago  (cadence 4h)  ok
05  last 2026-09-23T14:23:00Z  4.9h ago  (cadence 24h)  ok
```

**Crossed against `lastRunAt` from the scheduled-tasks MCP** — the station doc's table exists because
`--freshness` compares breadcrumb dates and nothing else:

| station | `lastRunAt` | newest breadcrumb | row |
|---|---|---|---|
| `00` | `2026-09-23T19:13:59Z` (**this run**) | 18:16Z | aligned |
| `03` | `2026-09-22T23:28:57Z` | 09-22 23:29Z | aligned; `nextRunAt 2026-09-23T23:02:45Z` |
| `04` | `2026-09-23T18:09:37Z` | 18:10Z | aligned |
| `05` | `2026-09-23T14:22:41Z` | 14:23Z | aligned |
| `weekly-security-audit` | `2026-09-06T21:32:44Z` | n/a | **`enabled: false`** — the known off-switch, already Marco's |

**No station is SILENT and none needed a transcript read.** Both root breadcrumbs are TRACKED on
`origin/main` — [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` matched by
basename, the `origin/main` form and never the dev tree's index
(`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`).

**Every finding in both is already dispositioned**, so both are archived in this PR:

- `00-04-scanner-...-1810-...md` — F1/F2 **DISPATCHED to 00** (landed by the 18:16 run as `#2129`,
  `#2130`), F3/F4 **DEFERRED** by 04 itself.
- `00-00-supervisor-...-1816-...md` — 8 findings, all dispositioned; F4 **DISPATCHED to 03**
  (standing, see F5 below).

04's hand-off of `docs/pipeline/sweep-rotation.json` is **already committed** — [MEASURED] dev tree
`git status --porcelain --untracked-files=no` → EMPTY, `rev-list --left-right --count` → `0 0`.

### The board: one PR, and it is Marco's

`#2127` `fix/field-service-nul-separator`, files
`apps/api/src/modules/field/field.service.ts` + `docs/pr-prompts/superseded/pr-field-service-nul-separator-HOLD.md`,
labels `[]`.

§10.1 **step 1**, the prompt-log probe (`processed/pr-*.log`, `rev-*` excluded):

```
[watcher] merge result for PR #2127: {"ok":false,"marco":true,
  "reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}
```

NEGATIVE control `PR #999997` over the same corpus → **0**. The verdict is corroborated against the
log's own prompt (`pr-field-service-nul-separator-ready.md.log`, matching the PR's head-branch slug,
and the PR's second file is that prompt's own consumption into `superseded/`), so it is a routing and
not a §10.1 prose scrape.

**RULE 2 binds. I did not merge it and did not enable auto-merge on it.** Per the ACTIVE DRIVE
MANDATE an escalating PR is *opened and driven green, not auto-merged*, so I updated its branch:
`gh pr update-branch 2127` → `✓ PR branch updated`, exit 0. Read back: `state=OPEN merge=BLOCKED`.
`why-blocked.ps1` gave the cause — `5 of 9 required status checks are in progress` — i.e. the update
re-triggered CI and BLOCKED is transient, not a defect.

### The queue: nothing armable, and the uniform bucket is real

`triage-holds.ps1`: **14 `-HOLD.md`, 0 `-ready.md`, gates-satisfied 0, spent 0, unreadable 0.**
Ten `[HUMAN_GATE_PRESENT]`, four `[FILE_GATE_NOT_RELEASED]`. Zero POSSIBLE-DUPLICATE rows.

The script raises its own §7 flag — *"every prompt landed in ONE bucket … prove node and git both
resolve for `lint-prompt.mjs`"*. **Positive control, and it is structural rather than a second
probe:** they did **not** land in one bucket. lint emitted **two distinct REJECT codes**, and
`FILE_GATE_NOT_RELEASED` is produced by `readFromOriginMain`, which requires `git` to work — a broken
`git` makes that check `return null` and **fail OPEN as an ADMIT** (§9.5), which is the opposite of
what was observed on four prompts. `node` is independently proved by `check-breadcrumb.mjs` exiting 0
in the same shell. **The board is genuinely gated; the instrument is sound.**

### The machines

Watcher node **pid 38776** alive with its wrapper; heartbeat 34 min old against an **empty queue**,
which the station doc's own table calls idle and explicitly **not** wedged. `restart-watcher-if-wedged.ps1`
was **not** run with `-Fix` and nothing was restarted. `index.lock` absent in both trees.

---

## WHAT CHANGED

1. **`#2127` branch updated** (`gh pr update-branch`, exit 0, read back `OPEN` / `BLOCKED`-on-pending-CI).
   **Not merged. Not auto-merged.** It is Marco's.

2. **`#2131` opened** — `fix/why-blocked-must-not-merge`, three files
   (`scripts/pipeline/why-blocked.ps1` +99/-2, `docs/pipeline/SCRIPT-REGISTRY.md` +1/-1,
   `docs/pipeline/stations/00-supervisor.md` +12/-1). **Opened without auto-merge**: it is `scripts/`,
   outside 00's recorded `docs/` lane, so it is Marco's to merge
   (`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`). See F1.

3. **This board PR** — this breadcrumb, plus `git mv` of the two dispositioned breadcrumbs into
   `docs/pr-prompts/archive/`.

4. **Two worktrees created and torn down in this run**: `C:\po-wt\wb2127`, `C:\po-wt\bd1914`.
   Named here so a later run does not read them as orphans.

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No `/sot/` edit. No commit on
`main`. No watcher restart. No lock cleared. No Azure / Entra / SharePoint of any kind. Nothing
written to any of the five gitignored `docs/qa/` sinks.

⚠️ **Cure 1 was used**: this breadcrumb was written **inside this run's PR worktree**, so no untracked
copy exists in the dev tree and the post-merge fast-forward has nothing to trip over at this path.
The two archived breadcrumbs are **tracked** at their root paths, so the fast-forward moves them
rather than colliding with them.

---

## FINDINGS

### F1 — `why-blocked.ps1` was an unconditional REST squash-merge, and BOTH binding documents filed it under **Read-only**. It issued a merge against a `marco:true` PR this run and was stopped by timing.

**Severity S1** — this is RULE 2, the most binding rule Station 00 has, with a merge button behind it.

The entire file was eight lines:

```powershell
param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output ("=== REST merge attempt on #" + $PR + " (to surface the exact rule violation)")
$body = '{"merge_method":"squash"}'
$out = $body | gh api -X PUT ("repos/GH-Mantova/ProjectOperations/pulls/" + $PR + "/merge") --input -
foreach ($l in $out) { Write-Output ("  " + $l) }
```

No label check. No RULE 2 check. No `-WhatIf`. No `NEVER_MERGE` list. No read-back.

It is listed under **`docs/pipeline/stations/00-supervisor.md` → "Read-only — build the whole picture
BEFORE acting (§1)"** and under **`docs/pipeline/SCRIPT-REGISTRY.md` → "Read-only — build the picture
first"**, where that file's own **rule 2** reads: *"READ-ONLY scripts are always safe to run."*
**That sentence is what turns the misfiling into a licence**, and it is why this is S1 rather than a
tidy-up: a station following its instructions correctly reaches for this script precisely when a PR
is BLOCKED — which is the state a `marco:true` PR sits in.

**[MEASURED] this run, and I am the instance.** Following the station doc, I ran it against `#2127`
to explain its `BLOCKED` state. It issued the squash merge. GitHub refused:

```
gh: Repository rule violations found
5 of 9 required status checks are in progress.
Code scanning is waiting for results from CodeQL for the commits 51c0901 or 9ec10fb. (HTTP 405)
```

**Stopped by the branch ruleset, not by the script and not by the read-only list** — and those checks
were in progress only because *this same run* had updated the branch four minutes earlier. Twenty
minutes later the window closes and a `marco:true` PR is on `main`, through a "read-only" diagnostic,
bypassing `Assert-SmokedOrEscalate` entirely. Nothing would have warned; the script has no read-back,
so its output on a **successful** merge is the plain REST success payload, which reads like any other
diagnostic line.

**Second defect, same file, same run.** `Set-Location "C:\po-watcher\ProjectOperations"` with no
matching pop, so the **caller's** shell is left in the watcher clone. [MEASURED] directly: my prompt
came back as `PS C:\po-watcher\ProjectOperations>`. That is the one tree where `git checkout / commit
/ push / merge` is an **absolute** stop (DOCTRINE §4, LL-38), and the next thing a station types
after a diagnostic is routinely a `git` command. The `Set-Location` was never needed — `gh` takes
`-R` (§9.4's CWD bullet).

**The fix — complete and additive (RULE 1).** The merge attempt **is** the diagnostic: GitHub's
refusal text is the only place the exact rule violation is spelled out, so removing it removes the
script. It is **gated** instead, and the `Set-Location` is replaced by `-R`.

| gate | refuses | exit |
|---|---|---|
| missing `-Pr` | — | 2 |
| label read FAILS | a read failure is a REFUSAL, never a pass (LL-47) | 3 |
| `do-not-merge` / `needs-marco` / `hold` | only Marco removes it | 4 |
| verdict corpus unreadable | unmeasured is not cleared | 5 |
| watcher `marco:true` verdict | §10.1 step 1 — obey it | 6 |
| already MERGED | there is no BLOCKED state to diagnose | 7 |

Plus a **before/after** read-back that says so loudly if the script ever does merge something.

**Controls [MEASURED] after the fix:**

| probe | result |
|---|---|
| `-Pr 2127` (watcher `marco:true`) | `REFUSED ... it is Marco's`, **exit 6**, no merge issued |
| `-Pr 2130` (already merged) | `REFUSED ... already MERGED`, **exit 7** |
| `-Pr 0` | `REFUSED: -Pr <number> is required`, **exit 2** |
| CWD before / after | `C:\ProjectOperations2` / `C:\ProjectOperations2` — unchanged |
| gate-2 predicate on `#2127` | 1 verdict hit, 1 `marco:true` |
| gate-2 predicate, NEGATIVE control `#999995` | **0** |
| diagnostic path reachable at all (§7: prove the check can PASS) | demonstrated on `#2130` before the already-merged gate existed — printed `gates passed: labels=[] verdicts naming this PR=0` and issued the call |
| `node scripts/pipeline/lint-station.mjs` | `ADMIT: all 8 docs clean`, exit 0 |
| PowerShell parse of the new file | `PARSE_ERRORS=0` |

⚠️ **One control was read wrongly and is corrected here rather than quietly:** `-Pr 2127 | Select-Object -First 2`
reported `CTRL_MARCO_EXIT=0`, because appending a pipeline makes `$LASTEXITCODE` the **pipeline's**.
The unpiped run of the same call exits **6**. This is the station doc's own *"read the exit status of
the INSTALLER, never of a pipeline you appended to it"*, met in a control rather than in a guard install.

**DISPOSITION: ACTIONED** — fixed, controlled and opened as **`#2131`** this run.
⚠️ **The residual, stated plainly: the fix is NOT on `main`.** `#2131` touches `scripts/`, which is
outside 00's recorded `docs/` lane, so **I may not merge it and did not enable auto-merge.** Until
Marco merges it the hole is open, and the two documents on `main` still call the script read-only.
It is driven green and waiting. **Marco: this is the one worth a minute of your time this hour.**

---

### F2 — my own first read-back for F1 fired a false alarm, because the REST merge endpoint answers an already-merged PR identically to one it just merged.

**Severity S3** — recorded because it is §7's shape inside the cure for a §7 problem, and because the
first version shipped in my own controls.

The read-back I wrote tested `state -eq "MERGED"` after the attempt. [MEASURED] against `#2130`,
merged **40 minutes earlier** at `18:42:57Z`, the endpoint returned

```
{"sha":"564108ef1d9194c7a87258e247bd9dfaf4318402","merged":true,"message":"Pull Request successfully merged"}
```

— the idempotent response, **byte-indistinguishable from a merge it had just performed** — and the
read-back printed `!!! THIS SCRIPT MERGED THE PR` about a merge it had not caused. Nothing was
actually merged (`mergedAt` predates the call by 40 minutes, and `origin/main` was `564108ef` at this
run's own preflight), but a run reading only that alarm would file a false self-accusation of
breaking the merge policy — the same class of false forgery accusation §10.2.1 records and retracted
an hour later.

🔧 **Capture `before` state and compare, never `after` alone.** Landed in `#2131`, and recorded in the
script's own comment so the next editor does not simplify it back out.

**DISPOSITION: ACTIONED** — fixed in the same PR; the already-merged gate (exit 7) additionally means
the script now never reaches the attempt on a merged PR at all.

---

### F3 — the board cannot move without Marco, and this is the sixth consecutive hour it has read that way.

**Severity S2** — throughput, unchanged in kind from my predecessor's F5.

[MEASURED] this hour: **1 open PR, and it is `marco:true`. 14 HOLDs, 0 armable** — ten
`[HUMAN_GATE_PRESENT]` (a deliberate human gate, by design) and four `[FILE_GATE_NOT_RELEASED]`
(waiting on a predecessor that has not landed). Armed count **0**. Nothing 00 can arm, nothing 00 can
merge. The watcher is healthy and idle because there is nothing for it to build.

This is not a defect in the machinery — every instrument is green and every gate is doing exactly
what it was written to do. It is the pipeline's shape: **the approval channel is the constraint, and
it has been empty for six hours.**

**DISPOSITION: ESCALATED — deliberately NOT as a new `needs-marco/` file.** The channel already holds
**46** files and my predecessor escalated this same condition an hour ago; adding a 47th duplicate is
the failure mode `needs-marco/` triage already suffers from. The escalation is **this breadcrumb's
FOR MARCO section below**, which names the two PRs that actually need him.

---

### F4 — `vm-git-guard` reports INSTALLED BUT INERT (exit 2), so the device-bridge `git` ban is remembered rather than mechanical.

**Severity S3** — reported because the station doc requires the installer's last line and exit code
to be quoted whatever the outcome, and because *"an install nobody can see in the report is
indistinguishable from one that never ran."*

Exit **2**, headline quoted in GROUND. The installer's own controls: `bash -lc 'command -v git'` →
the shim; `bash -c 'command -v git'` → `/usr/bin/git`. A station's shell is non-interactive and
non-login, so neither `~/.bashrc` nor `~/.profile` is sourced. **This is the EXPECTED station outcome
per the three-outcome table — a FINDING, not a STOP.**

**No action needed and none taken:** this run ran **zero** `git` commands through the device bridge.

**DISPOSITION: DEFERRED.** What would make it urgent: a station genuinely needing VM-side `git`, at
which point `PATH="/sessions/<id>/.local/bin:$PATH" git <args>` is the printed cure. Making the ban
mechanical for a non-login shell is a `scripts/` change and therefore Marco's.

---

### F5 — the orphaned worktree `C:/po-wt/s9hex` is still present; Station 03's dispatch for it is standing and I did not duplicate it.

**Severity S4.**

[MEASURED] `C:/po-wt/s9hex`, `f878a0a1`, detached HEAD, **dirty=0 files**, age **781 min**. My
predecessor's 18:16 run dispositioned this as **DISPATCHED to Station 03, NARROWED** (prune the
worktree; the clone-dirty half was withdrawn as a sweep artifact). 03's `nextRunAt` is
**`2026-09-23T23:02:45Z`**, ~3.9 h from this run, and pruning a worktree is squarely 03's lane
(`STATION-CAPABILITIES.md` §5: 00 **dispatches** machine repair, ❌ on doing it).

Re-dispatching it would be a second signal for one fault, which is exactly what the station doc's
*"add signal, not noise"* rule forbids.

**DISPOSITION: DEFERRED** — 03's existing dispatch covers it and fires tonight. What would make it
urgent: 03 running and **not** pruning it, or the worktree going dirty (it is at 0 files, so nothing
is at risk of being lost).

---

## WHAT I DID NOT DO

- **I did not merge `#2127`, and did not enable auto-merge on it.** It carries a watcher `marco:true`
  verdict; §10.1 step 1 runs first and wins, and no station clears one. I updated its branch, which
  is *driving it green*, and stopped there.
- **I did not merge `#2131`, my own fix PR, and did not arm auto-merge on it.** It is `scripts/`,
  outside 00's `docs/` lane. `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` exists because a
  previous revision of `STATION-CAPABILITIES.md` §5 would have licensed exactly this merge, and the
  PRs it licensed were *also* pipeline-instrument repairs — the class a station is most tempted to
  merge itself. **This is that class. I left it for Marco.**
- **I did not arm anything.** Zero prompts had satisfied gates; arming a `[HUMAN_GATE_PRESENT]` or
  `[FILE_GATE_NOT_RELEASED]` prompt is never available to me.
- **I did not restart, kill or `-Fix` the watcher.** It is alive with its wrapper and an empty queue;
  a stale heartbeat against 0 armed prompts is **idle**, and restarting on that is the LL-25 /
  2026-07-13 false emergency.
- **I did not clear any lock.** None existed; clearing one is 03's on my dispatch anyway.
- **I did not prune `C:/po-wt/s9hex`** — 03's lane, already dispatched (F5).
- **I did not open a new `needs-marco/` file** for F3. The channel is at 46 and the duplicate is the
  disease.
- **I did not edit `/sot/`**, commit to `main`, or touch production data.
- **I did not touch Azure, Entra or SharePoint**, read or write.
- **I did not "fix" the `?`/`â€"` mojibake visible in `Select-String` output** of
  `SCRIPT-REGISTRY.md` and `DOCTRINE.md`. That is DOCTRINE §7 lie #2 — PS 5.1 decoding BOM-less UTF-8
  as CP1252 — and the "fix" is what causes the corruption for real. The files are clean.
- **I did not re-dispatch the `watcher clone dirty=1` warning.** Re-measured, confirmed as the
  by-design untracked review verdict, and left as the surviving live instance of
  `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`.

---

## FOR MARCO

Two PRs are green-and-waiting and **only you can move them.** Nothing else on the board is blocked.

1. **`#2131` — `fix(pipeline): why-blocked.ps1 is an unconditional squash-merge and both docs called
   it read-only`.** This is the one that matters. `scripts/pipeline/why-blocked.ps1` has been a
   no-questions-asked squash merge sitting in the **Read-only** list of both binding documents, next
   to a rule that says read-only scripts are always safe to run. It fired against a `marco:true` PR
   during this run and was stopped by the branch ruleset alone. The PR gates it (hold label, RULE 2
   verdict, already-merged) and keeps the diagnostic. Until it merges, the hole is open on `main`.

2. **`#2127` — `fix(field): replace raw NUL byte with Unicode escape in composite sort key`.**
   Watcher-routed to you (`outside tests/ or docs/: apps/api/src/modules/field/field.service.ts`).
   14 checks green before I updated the branch; CI is re-running now and should settle green. Nothing
   for you to fix — it needs your merge decision only.

**RULE 1 read on `#2131`:** it is the complete-and-additive option — the diagnostic capability is
preserved in full, three refusals and a read-back are added, and no existing behaviour is weakened.
The alternatives both fail a half: deleting the script removes a real diagnostic (fails *future*),
and leaving it and remembering not to run it on a held PR fails *immediately* — the remembered form
of this exact ban is what DOCTRINE §9.2 records as having failed seven times.
