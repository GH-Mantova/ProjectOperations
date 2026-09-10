# Station 04 — Scanner | 2026-09-10T06:10:05Z–2026-09-10T06:22Z

Sweep this run: **gate-liveness** (rotation position 1 of 4, assigned by
`node scripts/pipeline/next-sweep.mjs`; previous run 2026-09-10T02:10:54Z). Advanced to
`last_index=0 last_run_utc=2026-09-10T06:10:05Z` at 06:19Z and **left dirty** —
`docs/pipeline/sweep-rotation.json` is modified in the dev tree and Station 00 must commit it,
because 04 may not commit to the shared tree.

## GROUND

```
UTC            2026-09-10T06:10:05Z
origin/main    eaf0bcd2            (git fetch origin --prune, then git rev-parse origin/main)
dev tree       main @ eaf0bcd2      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE, so this run was not restricted to read-only on that account.

`HEAD == origin/main == eaf0bcd2`. The three binding documents were read from the dev tree after
proving the dev tree is not behind on them:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
returned **EMPTY**, which is the real answer per DOCTRINE section 9.2. No piped `hash-object`
comparison was made (section 9.1 — that form is unsound in `powershell.exe`).

## WHAT I MEASURED

### Reachability, and the git guard

[MEASURED] `start_process` shell `powershell.exe` succeeded on the first call after loading the
Desktop Commander schemas with `ToolSearch`. This run was **SIGHTED**, not blind.

[MEASURED] **The device-bridge git guard could NOT be installed, and this is a finding, not a stop.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never reached the script: the
Linux workspace failed to start. Last line, quoted:
`bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount ... under Plan9 share "c" which is not mounted; create: RPC error -1: ensure user: user peaceful-dreamy-turing already exists unexpectedly`.
Blast radius this run is **nil by construction**: with no VM there were no VM-side calls to guard,
and every probe below ran through Desktop Commander against the Windows host. A guard that could
not be installed is still never a licence to run `git` against a mount, and none was run.

### The sweep: gate liveness over all 40 depth-1 HOLDs

[MEASURED] `scripts/pipeline/triage-holds.ps1`, exit 0, with both of its own controls passing —
`GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (141854 chars)` and
`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`:

```
TOTALS  spent=0 of 40 evaluated  gates-satisfied=9  still-gated=31  unreadable=0
        spent behind a REJECT: 0    UNMEASURABLE: 0
        verdicts observed this run: ADMIT, REJECT
```

**No prompt on this board is spent.** That covers both halves: lint ran the premise on the 9 it
ADMITted, and `triage-holds.ps1` re-probed the premise directly on all 31 it REJECTed — which is
the case the sweep description warns about, *a dead gate MASKS the premise behind it*. Zero spent
in either bucket, and the SPENT bucket was proved reachable by fixture, so that zero means none
rather than "this instrument cannot say".

[MEASURED] Every dependency gate on those 40 HOLDs, evaluated against `origin/main` at `eaf0bcd2`
by `C:\po-sup-fix-scripts\gate-liveness-04-20260910.mjs`. Controls on the `origin/main` reader:
POSITIVE `DOCTRINE.md` → 140008 chars; NEGATIVE, a path minted this run → `NULL`.

| gate state | count |
|---|---|
| RELEASED (satisfied on `origin/main`) | 10 |
| NEEDLE-ABSENT (file on main, needle not) | 6 |
| FILE-ABSENT (predecessor file not on main) | 9 |
| `requires_merged` PR gates | 3 |
| HOLDs carrying no dependency key at all | 14 |

**All three `requires_merged` gates are ALIVE — none names a closed-unmerged PR.**
`gh pr view <n> -R GH-Mantova/ProjectOperations --json state,mergedAt` (with `-R`, per section 9.4):
#1361 **MERGED** 2026-08-28, #1317 **MERGED** 2026-08-25, #1111 **MERGED** 2026-08-14, all exit 0.
The three prompts behind them are held by something else — `[HUMAN_GATE_PRESENT]`,
`[UI_PROMPT_NEEDS_DESIGN_REF]`, and one that correctly reads ADMIT.

**All six NEEDLE-ABSENT gates have a named producer on the board**, so none is dead
(`C:\po-sup-fix-scripts\needle-producer-04-20260910.mjs`; corpus 40 prompts, 2 open PRs; POSITIVE
control `premise` → 40 of 40, NEGATIVE control, a needle minted this run → 0):

| gated prompt | needle | producer |
|---|---|---|
| `pr-brandtheme-s4-named-presets-seed` | `schema.prisma :: sidebarBgHex` | `pr-brandtheme-s3-full-palette-columns` |
| `pr-company-manage-s2-retire-adminonly` | `permission-registry.ts :: company.manage` | `pr-company-manage-s1-permission-and-grant`, open PR #1823 |
| `pr-ea-s2a-dashboard-preset-seed` | `permission-registry.ts :: reporting.team` | `pr-ea-gate-report-self-filter`, open PR #1823 |
| `pr-ea-s2b-dashboard-filter-surface` | `seed.ts :: estimating-analytics` | three `pr-ea-*` siblings, open PR #1823 |
| `pr-qpdf-2-rate-basis-stamp` | `quote-html.builder.ts :: ESTIMATE_PREVIEW_MARK_V1` | `pr-qpdf-1-estimate-preview-mark` |
| `pr-transport-capacity-column-order` | `RatesListsAdminPage.tsx :: handleUpdateColumn` | `pr-rates-column-edit-ui` |

**Five of the nine FILE-ABSENT gates are the Marco-approval class, and that class is healthy.**
`git ls-tree -r --name-only origin/main -- docs/approvals/` returns two files —
`README.md` and `watcher-identity-approved-by-marco.md` — so the convention exists on `main` and
has been satisfied at least once, which is the positive control the class needs. The README
enumerates exactly five gated prompts and predicts, as of 2026-08-31, which reject on the human
gate and which on the file gate. Measured against `triage-holds.ps1` today, **5 of 5 still match**:
`pr-524-rates-b-slice2-canonical`, `pr-retire-tenderclientnote-s2` and `pr-siteid-notnull-backfill`
reject `[HUMAN_GATE_PRESENT]`; `pr-rates-s11c-drop-legacy-tables` and
`pr-tenant-mt4-s2-ownership-migration` reject `[FILE_GATE_NOT_RELEASED]`. A ten-day-old state claim
that is still exactly true is rare enough here to be worth recording.

The remaining four FILE-ABSENT gates are ordinary chain waits: two `pr-fv2-*` prompts on service
files their predecessors create, and `pr-tipid-s3-retire-the-name-guard-for-an-id-check`, which
carries three gates — one RELEASED, and two waiting behind `pr-rates-s11c-drop-legacy-tables`,
itself waiting on Marco's approval marker. That prompt is two deep behind a human.

### Calibrating this run's zero against the previous gate-liveness run's three

The 2026-09-09T02:20Z gate-liveness run found **three dead premises** and warned (its F2) that the
sweep's corpus is ambiguous — the brief says *"against `origin/main` at a named SHA"* while the
instruments glob **disk**, and the two corpora disagreed by eight files. `triage-holds.ps1` and my
own script both glob disk, so a zero from them could be a corpus artifact. Measured rather than
assumed (`C:\po-sup-fix-scripts\corpus-union-04-20260910.mjs`, using `ls-tree -r` with a trailing
slash and filtering the result rather than globbing the pathspec, per section 9.2; POSITIVE control
— 954 tracked entries under `docs/pr-prompts/`):

| depth-1 prompt files (`-HOLD` / `-ready` / `-LOOPING`) | count |
|---|---|
| on `origin/main` | 40 |
| on disk | 42 |
| **on `origin/main` but NOT on disk** | **0** |
| on disk but not on `origin/main` | 2 |

**The eight-file gap has closed in the direction that mattered.** Nothing tracked on `main` is
missing from disk, so this run's spent count is not hiding a `main`-only prompt. The two disk-only
files are my own HOLD, staged minutes earlier, and `pr-watcher-verdict-home-resolver-LOOPING.md`.

That second file is the previous run's own F1c, dispatched to Station 00 and **still not actioned a
day later** — and it is SPENT. [MEASURED] `node scripts/pipeline/lint-prompt.mjs` on it returns
**STALE, exit 3**; `VERDICT_HOME_RESOLVER_V1` occurs **6** times in
`origin/main:scripts/pr-watcher/index.mjs` (POSITIVE control `classifyPolicyFiles` → **2**,
NEGATIVE control, a needle minted this run → **0**). So the honest board-wide figure is
**spent = 1**, not 0 — see F4.

### The safe-to-act gate

[MEASURED] `scripts/pipeline/status-sweep.ps1` @ 06:11:04Z, captured to a file (it returns early
and hides its own verdict when not captured). Board otherwise quiet: 2 open PRs, both CLEAN and
15/15 green (#1832, #1823); `main` CI on `eaf0bcd2` 4 success / 0 failed; watcher node RUNNING pid
18228; heartbeat 105 min, no build in flight; armed `*-ready.md`: **0**; `index.lock` False in both
trees; no PR touched in the previous 2 minutes.

Its section 7 verdict was nevertheless **DO NOT ACT**, on the strength of one line in section 3 —
`git processes running: 1`. See finding F1.

## WHAT CHANGED

1. **Staged one new prompt as a HOLD**, armed by nobody:
   `docs/pr-prompts/pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md`.
   Read back: `node scripts/pipeline/lint-prompt.mjs <that file>` → `ADMIT (size 1)`, **exit 0**.
   The first attempt returned `REJECT [MISSING_STANDING_AUTHORITY]` (exit 1) and was corrected —
   quoted here because a lint verdict nobody can re-check is an assertion, not evidence.
   It is untracked in the dev tree and needs Station 00 to commit it.
2. **Advanced the sweep rotation.** `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-09-10T06:10:05Z` → `advanced: last_index=0 last_run_utc=2026-09-10T06:10:05Z`, exit 0.
   `docs/pipeline/sweep-rotation.json` is left ` M` in the dev tree **by instruction** — Station 00
   commits it. If it is not committed, the next run repeats this sweep and the rotation stops.
3. Nothing else. No prompt was armed, disarmed, renamed, moved or deleted; no PR was touched; no
   label was changed; no existing prompt was edited.

## FINDINGS

### F1 — `status-sweep.ps1`'s safe-to-act gate counts git BY IMAGE NAME, so any read-only git anywhere on the box says DO NOT ACT

`$gitProc = @(Get-Process -Name git -ErrorAction SilentlyContinue)` feeds
`$boardBusy = $lockInteractive -or $lockClone -or ($gitProc.Count -gt 0)`. There is no PID
resolution and no command-line test, which DOCTRINE section 9.5 forbids in as many words. The
comment three lines above shows the author already fixed this exact class for `claude.exe` —
*"counting those flags the user's own session and always says DO NOT ACT"* — and keyed that signal
on real mutation instead; the git counter kept the shape the `claude.exe` counter was fixed to
remove.

[MEASURED] on an idle board, PS 5.1, `C:\po-sup-fix-scripts\gitproc-selfcount-04-20260910.ps1`:

| probe | reading |
|---|---|
| sweep @ 06:11:04Z, section 3 | `index.lock False / False`, `git processes running: 1` → **DO NOT ACT** |
| `Win32_Process Name='git.exe'` minutes later | **0** |
| idle A / idle C / idle E | **0** / **0** / **0** |
| peak during a `gh pr list` child job | **0** |
| **peak during one plain `git log` child job** | **2** |

One ordinary git **read** takes the counter from 0 to 2, while `index.lock` stays False throughout
because nothing is being written. `status-sweep.ps1` itself shells git in four of its sections, and
the dev tree is read concurrently by other chats, by CI checkouts and by the watcher.

**Not claimed:** which process owned the git.exe at 06:11:04Z is `[CANNOT MEASURE]` — it had exited.
The measured defect is the counter's shape, not that instance. Prior art was searched over 589
files in `docs/pr-prompts` (depth 1, `needs-marco/`, `archive/`): `$gitProc` → **0**,
`Get-Process -Name git` → **0**, POSITIVE control `status-sweep` → **338**, NEGATIVE control (a
needle minted this run) → **0**. The one near-miss,
`archive/00-00-supervisor-2026-09-01-0810-the-safe-to-act-gate-was-right-and-the-orphan-probe-was-not.md`,
records a genuine DO NOT ACT caused by two stale `index.lock` files with `git processes running: 0`
— a positive control that the other two signals work, and silent on this one.

Severity: the verdict fails SAFE for writes, but a station is told to re-run this sweep immediately
before every board mutation, so a false DO NOT ACT costs a whole run and recurs whenever anything
on the box reads git. **DISPOSITION: ACTIONED** — staged as
`pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md`, lint ADMIT exit 0, with the
complete-and-additive change (scope the count to the two repositories by command line, keep
emitting the unscoped total as an informational line, mark it `GITPROC_SCOPED_V1` so the premise
dies on landing) and three required read-back controls including the positive one that a real git
write in the dev tree must still produce DO NOT ACT. **Station 00 must commit and decide whether to
arm it; 04 arms nothing.** The file is `scripts/`, so `classifyPolicyFiles` routes the resulting PR
to Marco at merge — expected and correct.

### F2 — no dead gate anywhere on the board, and no spent `-HOLD`

The sweep's own question, answered in the negative with controls on both instruments: 0 spent of the
40 `-HOLD.md`, 0 spent behind a REJECT, 0 dead `requires_merged` gates, 0 needle gates without a
producer, and the
`docs/approvals/` convention live on `main` with one satisfied instance. The 31 REJECTs are held by
human gates, design references and Marco approvals — every one of them a deliberate control rather
than a rotted one. **DISPOSITION: DEFERRED** — nothing to do. What would make it urgent: a
`requires_merged` gate naming a PR that closes unmerged, or a needle gate whose only producer is
retired to `superseded/`, either of which would strand its chain silently. Both are cheap to re-test
with the two scripts named above.

### F3 — the gate-liveness sweep instruction can be executed into removing a safety control

`docs/pipeline/sweep-rotation.json` tells this station to *"Repair dead requires_merged /
requires_file_on_main / requires_on_main gates"*. `docs/approvals/README.md` records the opposite
hazard from the other side: *"Until now the only thing actually stopping those prompts was that
their dependency gate happened to be dead, so lint rejected them for an unrelated reason. That is an
accident, not a control. **Repairing the dead gate would have silently removed the protection.**"*
Two of the prompts in that class drop database tables. Nothing in the sweep instruction says to
check whether a gate is load-bearing before repairing it. No gate needed repair this run, so nothing
was at risk today. **DISPOSITION: DISPATCHED → Station 00** — one clause in the `gate-liveness`
rotation entry, along the lines of *"before repairing a dead gate, check whether it is the only
thing holding the prompt; if the prompt is destructive, report it and repair nothing."* 04 is
read-only on the board and does not edit that file.

### F4 — the triage corpus is a filename suffix, so `spent=0 of 40` is true and the board is not

`triage-holds.ps1` reports `spent=0 of 40 evaluated` and adds *"every premise on this board was
evaluated"*. Both halves are honest about `*-HOLD.md` and neither is true of the board, because the
corpus is defined by a filename suffix. `pr-watcher-verdict-home-resolver-LOOPING.md` sits at depth
1 of `docs/pr-prompts/` and is **SPENT** — `lint-prompt.mjs` → **STALE, exit 3**, with
`VERDICT_HOME_RESOLVER_V1` occurring **6** times on `origin/main` (POSITIVE control
`classifyPolicyFiles` → 2, NEGATIVE control, a needle minted this run → 0). It is invisible to the
triage denominator, and it was invisible to my own first pass for the same reason, until the
previous run's F2 warning sent me to measure the union.

Two things follow, and only one of them is small. The small one: this specific file is spent and
should be retired. It arms nothing — the watcher globs `*-ready.md` — so the exposure is clutter,
not a duplicate build, and it is untracked so it reaches no clone. The larger one: **a station
reading `spent=0 of 40 evaluated` has been told the board is clean, and the sentence that says so is
the one that makes the corpus invisible.** Two consecutive gate-liveness runs have now had to
rediscover this file by hand; the 2026-09-09 run found it (its F1c), dispatched it to Station 00,
and a day later it is still here.

**DISPOSITION: DISPATCHED → Station 00.** Two items, and they are separable. (1) Retire
`pr-watcher-verdict-home-resolver-LOOPING.md` — it is untracked, so a delete needs no PR, but no
agent bulk-deletes queue files and 04 is read-only. (2) The durable half: make the triage corpus a
suffix UNION rather than `*-HOLD.md` alone, and have the totals line name its own corpus instead of
saying *"this board"*. **RULE 1, complete-and-additive first: (a)** widen the glob to
`-HOLD|-ready|-LOOPING` and print the corpus in the totals line — complete (no suffix can hide a
spent prompt again) and additive (nothing is removed; a wider denominator only ever reveals). **(b)**
delete this one file and change nothing — fails the *future* half of RULE 1: the next `-LOOPING` or
new suffix is invisible again, which is how this one survived two runs. **(c)** leave a prose warning
in the station doc — fails both halves; the 2026-09-09 run already wrote one and I still had to
measure it myself to believe it. I did not stage (a) as a prompt: my run's staging budget went to F1,
and F1 is the finding with a live board consequence.

## WHAT I DID NOT DO

- **Part 0 static cross-layer audit, Part 1 GitHub reconciliation, Part 2 live-site patrol.** The
  AUTHORITY section requires ONE named sweep per run, covered completely, and the rotation named
  `gate-liveness`. Choosing to add others would narrow the next rotation rather than widen this run.
- **Repaired no gate and edited no existing prompt.** None was dead (F2), and the adversarial-critique
  contract forbids the scanner editing a prompt under critique in any case.
- **Armed nothing, disarmed nothing, merged nothing, labelled nothing.** Both open PRs (#1832,
  #1823) were read and left alone; #1832's own log carries a `marco:true` verdict, so RULE 2 binds.
- **Committed nothing.** `sweep-rotation.json` and the staged HOLD are both left for Station 00.
  The other untracked paths in the dev tree (`queue-watch-state.md`, `.queue-sync-ledger.txt`, two
  `docs/pr-reviews/pr-18xx-review.md`, `pr-watcher-verdict-home-resolver-LOOPING.md`, the
  `Claude Design` index, the `archive/review-escalations-516-1346/` folder) are not mine and were
  not touched.
- **Did not clear, prune or investigate the two orphaned worktrees** the sweep reports —
  `C:/po-vg` (8537 min old, holding 1 uncommitted file) and `C:/po-worktrees/pr1823` (479 min).
  Worktree hygiene is Station 03's lane and `po-vg` is already escalated.
- **Did not act on the DO NOT ACT verdict as a blocker**, because this run mutates nothing on the
  board. Had it needed to, F1 is the reason it would have waited on a phantom.
- **Did not reach the Linux VM at all** — it failed to start (see WHAT I MEASURED). No probe in this
  report depends on it.
