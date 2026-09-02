# Station 04 — Scanner | 2026-09-02T02:10:25Z–2026-09-02T02:20Z

## GROUND

```
UTC            2026-09-02T02:10:25Z
origin/main    70da03eb            (git fetch origin; git rev-parse --short origin/main)
dev tree       main @ 70da03eb     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Doc version and bootstrap AGREE (1 = 1) — full authority run, not read-only-by-mismatch.
Preflight step 1 **SIGHTED**: `start_process` shell `powershell.exe` returned PID 33240 on the
Windows host. This was **not** a blind run.

Binding docs read in full this run, from the working tree at `70da03eb` — which `git diff --stat
origin/main -- <the three paths>` returned **EMPTY** for, so the working copy IS `origin/main`
content and the "never read the working copy" trap does not apply here: `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`, `docs/pipeline/stations/04-scanner.md`.

**Assigned sweep: `instruction-drift`** (`node scripts/pipeline/next-sweep.mjs` → rotation position
4 of 4, previous run 2026-09-01T22:10:48Z). Not chosen; assigned.

## WHAT I MEASURED

### 1. Bootstrap ↔ station doc version parity — CLEAN [MEASURED]

`node C:\po-sup-fix-scripts\04-instruction-drift-2026-09-02.mjs`

| task | bootstrap | origin/main doc | worktree doc | match | points at |
|---|---|---|---|---|---|
| 00-supervisor | 1 | 1 | 1 | YES | `docs/pipeline/stations/00-supervisor.md` |
| 02-board-driver | 1 | 1 | 1 | YES | `docs/pipeline/stations/02-board-driver.md` |
| 03-machine-minder | 1 | 1 | 1 | YES | `docs/pipeline/stations/03-machine-minder.md` |
| 04-scanner | 1 | 1 | 1 | YES | `docs/pipeline/stations/04-scanner.md` |
| 05-sot-keeper | 1 | 1 | 1 | YES | `docs/pipeline/stations/05-sot-keeper.md` |

Each bootstrap points at exactly one station doc, and it is the right one.

### 2. The five bootstraps are BYTE-IDENTICAL except for 5 station-specific lines each [MEASURED]

`node C:\po-sup-fix-scripts\04-bootdiff-2026-09-02.mjs` — normalised station name/number, then
set-differenced every line against `04-scanner`'s bootstrap.

Result for **all four** other bootstraps: `lines_unique_to_it=5  lines_in_04_not_here=5`. The five
differing lines are, every time: the `# STATION NN — <name>` heading, the cadence line, the
one-line lane statement, one station-specific operational line, and the breadcrumb path template.
**Zero shared-text drift between the five copies.**

Encoding pass on the same five files (bytes read with `node`, not `Get-Content` — DOCTRINE §9.3):

```
00-supervisor     bytes=5905  U+FFFD=0  mojibake=0  BOM=false
02-board-driver   bytes=5902  U+FFFD=0  mojibake=0  BOM=false
03-machine-minder bytes=5880  U+FFFD=0  mojibake=0  BOM=false
04-scanner        bytes=5841  U+FFFD=0  mojibake=0  BOM=false
05-sot-keeper     bytes=5816  U+FFFD=0  mojibake=0  BOM=false
```

All five `LastWriteTimeUtc` = **2026-09-01T00:07:44Z**, one batch. (`STATION-CAPABILITIES.md` still
carries a `[MEASURED] 2026-08-31` line saying the batch was `2026-08-24T22:54:22Z`. That line is
dated and tagged, and the file explicitly says *"measure a bootstrap's currency — never quote this
file for it"* — so it is correctly-behaving stale state, **not** a defect.)

**This is the headline result of the sweep, and it is a PASS.** The rotation entry exists because
*"five pasted copies drifted for weeks and four carried advice this pipeline had already
disproved."* As of `70da03eb` that is cured: the five copies are one template, and none of the
disproved advice (`web_fetch the blob URL; the raw CDN lags`, the wrong watcher launcher, `$` is
STRIPPED, output pauses on `#`) appears in any of them.

### 3. Each bootstrap's station-specific lines check out against repo authority [MEASURED/INFERRED]

Cadence, lane statement and breadcrumb template cross-checked against `STATION-CAPABILITIES.md` §5
(authority matrix) and §6 (cadence table): 00 arm/dispatch/merge ✔ · 02 dispatch-only, merges via
`Assert-SmokedOrEscalate` then `Merge-Pr` ✔ · 03 report-only ✔ · 04 read-only, stages `-HOLD`,
arms nothing ✔ · 05 sole `/sot/` editor ✔. All five breadcrumb templates match the REPORT CONTRACT.

05's bootstrap cites CP-24 at `pr-gates.mjs:327`. **Verified [MEASURED]**: line 327 opens the CP-24
block (`320: // CP-24 - sot purity…`, `327: {`, `328: const sotRe = /^sot\//`). See finding F3 for
the one thing wrong with that citation.

### 4. `lint-station.mjs` — ADMIT, exit 0 [MEASURED]

```
ADMIT   docs/pipeline/DOCTRINE.md
ADMIT   docs/pipeline/stations/00-supervisor.md  (v1)
ADMIT   docs/pipeline/stations/02-board-driver.md  (v1)
ADMIT   docs/pipeline/stations/03-machine-minder.md  (v1)
ADMIT   docs/pipeline/stations/04-scanner.md  (v1)
          ! names a Windows path outside the known folder map: C:\po-scan-
ADMIT   docs/pipeline/stations/05-sot-keeper.md  (v1)
ADMIT   docs/pipeline/stations/06-pr-master.md  (v1)
ADMIT: all 7 docs clean            LINT_STATION_EXIT=0
```

The one advisory is the `C:\po-scan-<rand>` inside 04's own **commented-out SUPERSEDED** worktree
block. Not a defect; the surrounding comment already says do not do it.

### 5. Path resolution across DOCTRINE + all 7 station docs [MEASURED]

`node C:\po-sup-fix-scripts\04-pathres-2026-09-02.mjs` — every `docs|scripts|sot|apps|prisma`-rooted
path named in `DOCTRINE.md`, `STATION-CAPABILITIES.md` and the six station docs, resolved against
`git show origin/main:<path>` **and** disk.

```
paths_named=70  dangling_on_main=11
CONTROL_present docs/pipeline/DOCTRINE.md -> true
CONTROL_absent  docs/pipeline/ZZZ.md      -> false
```

Positive **and** negative control both correct, so the "0 dangling" half of this reading is
believable (DOCTRINE §9.6). Triage of the 11, each checked with `git check-ignore -v` on the **FILE**
form (§9.2 — the directory form is byte-identical to a true negative and carries no information;
controls: `docs/qa/qa-checklist.md` → exit 0 ignored, `CLAUDE.md` → exit 1 not ignored):

| path | verdict |
|---|---|
| `docs/qa/qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md` | gitignored `.gitignore:107-109`, **and every doc that names them already says so.** Expected. |
| `docs/data-model/relationship-map.json` / `.md` | gitignored `.gitignore:127-128`, generated artifacts. Expected. |
| `apps/api/scripts/xero-import-report.md` | gitignored `.gitignore:86`; `05-sot-keeper.md:177` already labels it *"all gitignored, all absent"*. Correct. |
| `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` | named by 04 **only** to record that it was deleted in the 2026-08-17 cleanup. Correct as written. |
| `docs/pr-prompts/AWAITING-MARCO-DECISION.md`, `triage-state.md`, `queue-watch-state.md` | annotated in-doc as **UNTRACKED and NOT gitignored**; `00-supervisor.md:388` even strikes `triage-state.md` out as REMOVED. Correct as written; see F4. |
| `apps/web/src/components/SettingsShell.ts` | **my regex's bug**, not the doc's — the doc says `.tsx`, my alternation matched `ts` first. `SettingsShell.tsx` is tracked (`100644 blob 72506af8…`). Discarded. |

**Zero un-annotated dangling paths.** Every one of the 11 is a file a document deliberately names
while telling you it is absent.

### 6. Bare script filenames named by the docs [MEASURED]

`node C:\po-sup-fix-scripts\04-barefile-2026-09-02.mjs` — bare `*.mjs` / `*.ps1` mentions (full-path
mentions stripped first) resolved by basename against `git ls-files`.

```
bare_script_names=42 resolve_uniquely=32 ambiguous=0 unresolved=10
CONTROL lint-prompt.mjs -> scripts/pipeline/lint-prompt.mjs      CONTROL zzz-nope.mjs -> 0
```

**8 of the 10 unresolved are a false alarm my first instrument would have filed as findings.** They
are `commit-pipeline-v2.ps1`, `dbg-538-validate.ps1`, `final-rebase.ps1`, `gate-fail-538.ps1`,
`merge-544.ps1`, `resolve-544.ps1`, `restore-538-body.ps1`, `restore-552-body.ps1` — and reading the
surrounding lines shows they sit under `SCRIPT-REGISTRY.md:125` **`## Archaeology — DO NOT CALL`**,
a section that exists precisely to name scripts that no longer exist. Correct as written.

⚠️ Worth recording: `Select-String` rendered that section's `·` separators as `?` replacement
characters, and reading the same bytes with `node` gave `U+FFFD=0, mojibake=0` on a 10376-byte file.
**DOCTRINE §7 lie #2, reproduced live this run.** Had I written it up from the PowerShell view I
would have filed a false encoding-corruption finding on `SCRIPT-REGISTRY.md`.

The remaining 2 are real and are F1/F2 below.

### 7. Registered schedules vs documented cadence [MEASURED]

`mcp__scheduled-tasks__list_scheduled_tasks`:

| taskId | cron | = | doc cadence | agrees? |
|---|---|---|---|---|
| 00-supervisor | `5 */2 * * *` | every 2 h | every 2 h | ✅ |
| 04-scanner | `0 */4 * * *` | every 4 h | every 4 h | ✅ |
| 05-sot-keeper | `10 0 * * *` | daily | daily | ✅ |
| **03-machine-minder** | **`0 9 * * *`** | **once a day** | **"every 4 hours, or manually"** | 🔴 **NO** |
| 02-board-driver | *(no task registered)* | — | "on dispatch only, no schedule of its own" | ✅ correct by design |
| weekly-security-audit | `30 7 * * 1` | **`enabled: false`** | not in §6 | ⚠️ see F5 |

03's `lastRunAt` 2026-09-01T23:01:43Z and `nextRunAt` 2026-09-02T23:00:45Z are **24 h apart** — an
independent confirmation of the cron, not a re-reading of it.

### 8. The watcher chain, as actually running [MEASURED]

`Get-CimInstance Win32_Process` filtered on command lines containing `watcher`:

```
PID 30600  powershell -File "C:\po-watcher\watcher-launcher-singlelane.ps1"
PID 34332  powershell -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1
PID 28400  node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

`C:\po-watcher\ensure-watcher.ps1` line 10: `$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'`.
Both `ensure-watcher.ps1` (5266 B, mtime 2026-08-24T00:01:25Z) and
`watcher-launcher-singlelane.ps1` (2367 B, mtime 2026-08-18T02:41:02Z) exist **only** at
`C:\po-watcher\` and are absent from `git ls-files` and from both `scripts\pr-watcher\` trees.

## WHAT CHANGED

1. `docs/pipeline/sweep-rotation.json` — `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-09-02T02:10:25Z`, exit 0, read back as `advanced: last_index=3
   last_run_utc=2026-09-02T02:10:25Z`. `git diff --numstat` = `2 2` (two lines), i.e. **one**
   uncommitted delta, not two — my advance overwrote the previous run's uncommitted advance in the
   same two lines, so committing mine carries both forward. See F6.
2. This breadcrumb, written to the dev tree at `docs/pr-prompts/`. **Untracked** — Station 00
   collects it.
3. Three throwaway `.mjs` probes written to `C:\po-sup-fix-scripts\` (the sanctioned scratch tree).

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No PR opened, merged or
labelled. No branch touched. No `/sot/` edit. No commit.

## FINDINGS

### F1 — `SCRIPT-REGISTRY.md` names a launcher that is NOT the one running, and omits the one that is [MEASURED]

Every station doc points at `docs/pipeline/SCRIPT-REGISTRY.md` as *"the source of truth"* for
scripts, telling the reader to *"read it rather than guessing from a filename."* Its only launcher
row is:

```
120: | `pr-watcher\watcher-launcher.ps1` | Must be detached via `Win32_Process.Create` … | Starts the watcher so it outlives Claude. |
 94: The watcher owns its own lifecycle. **`watcher-launcher.ps1` must be started detached via …
```

`scripts/pr-watcher/watcher-launcher.ps1` **is** tracked (1626 B, mtime 2026-08-17T21:30:58Z), but a
`Select-String` over it for `start-watcher|index\.mjs|singlelane` returned **no hits**, and it is not
in the live process chain. The process actually at the top of the chain is
`C:\po-watcher\watcher-launcher-singlelane.ps1` (§8 above), which `SCRIPT-REGISTRY.md` **never
mentions** — while 03's station doc *and* 03's bootstrap both call it *"the real launcher"*.

So a station that obeys the instruction to trust the registry over the filename gets the **wrong**
launcher. This is the same defect the registry exists to prevent, one layer up. It is also the
second half of what `STATION-CAPABILITIES.md` §1 already recorded once: *"the `machine-minder` skill
named the wrong watcher launcher and called it 'the REAL launcher path'."*

The fix is three lines of `docs/pipeline/SCRIPT-REGISTRY.md`: correct the launcher row to name
`watcher-launcher-singlelane.ps1`, mark it **UNTRACKED — lives at `C:\po-watcher\`, not in this
repo**, and mark `pr-watcher\watcher-launcher.ps1` as superseded. Pure docs, no code, no `sot/`.
I am read-only on the board and may not open a PR, and a three-line docs correction does not justify
burning an agent run as a staged prompt.

**DISPATCHED** → Station 00. Land the three-line `SCRIPT-REGISTRY.md` correction in your next board
PR (docs-only, so the `tests-docs` lane can carry it). Evidence is §8 above, re-runnable in one call.

### F2 — `ensure-watcher.ps1` is still not in the repo — second independent measurement [MEASURED]

`03-machine-minder.md` names `ensure-watcher.ps1`; `git ls-files` has no such path; it exists only at
`C:\po-watcher\ensure-watcher.ps1` (5266 B). This is **open escalation #19** and I am not re-opening
it — I am recording that an instrument aimed at something else (bare-filename resolution across all
station docs) hit it independently, which raises confidence that the file is genuinely un-versioned
rather than merely mis-pathed.

**DEFERRED** → to open escalation #19, which already carries Marco's A/B/C options. What would make
it urgent: another relaunch loop, or any change to the launcher chain, since the script that governs
relaunch is editable by anyone on the box with no review and no history.

### F3 — 05's bootstrap cites `pr-gates.mjs:327` with no directory, and the obvious directory is wrong [MEASURED]

The line number is **correct** (line 327 opens the CP-24 block). The file is at
`scripts/pr-gates/pr-gates.mjs`. Because every station doc's "YOUR SCRIPTS" section lists tooling
under `scripts/pipeline/`, the natural resolution is `scripts/pipeline/pr-gates.mjs` — which does
not exist. I made exactly that mistake this run and got
`Cannot find path … because it does not exist`, which for a moment read as *"the citation is dead."*

Secondary: the bootstrap says CP-24 blocks *"a PR mixing `sot/` with `scripts/` or `apps/`"*. The
actual `codeRe` at `:329` is `^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)`
— so `.github/`, `packages/`, `package.json` and `pnpm-lock.yaml` also trip it. A station that
believes the short list can split a PR wrongly and still fail CP-24.

Both halves are one-line edits, but the bootstrap is a **Marco-only layer** (§1 of
`STATION-CAPABILITIES.md`: an agent cannot edit `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`).
The durable cure is to put the full path and the full `codeRe` in `05-sot-keeper.md`, which an agent
*can* change, and let the bootstrap keep pointing there.

**DISPATCHED** → Station 05 (its own doc; a docs-only edit inside its lane). Add to
`docs/pipeline/stations/05-sot-keeper.md`: the full path `scripts/pr-gates/pr-gates.mjs`, and the
complete CP-24 `codeRe` prefix list quoted from `:329`.

### F4 — three station scratch-state files are UNTRACKED **and NOT gitignored** [MEASURED]

`docs/pr-prompts/queue-watch-state.md` (on disk, `git check-ignore -v` → exit 1, i.e. not ignored),
`docs/pr-prompts/AWAITING-MARCO-DECISION.md` and `docs/pr-prompts/triage-state.md` (neither on disk
nor on main). Named by `00-supervisor.md:389/429/549`, `02-board-driver.md:319` and
`03-machine-minder.md:175/184/185/188/192`.

Each naming site **already carries the correct warning** in-line, so the docs are honest. The defect
is the repo state, not the instruction: a file that is neither tracked nor ignored shows up as `??`
in every `git status` every station runs, and one of them will eventually `git add .` it.

This is **open escalation #18** and its options (A: track it and delete the dead refs · B: ignore it
· C: leave) are already with Marco. Recording that the population is **three** files, not one.

**DEFERRED** → to open escalation #18; amend it with the count. What would make it urgent: any
station staging a commit without a pathspec, which DOCTRINE §9.2 already warns is how the shared
index bites.

### F5 — the weekly security audit has been DISABLED for 15 days [MEASURED]

`weekly-security-audit`: `enabled: false`, `cronExpression: 30 7 * * 1`, `lastRunAt:
2026-08-18T08:18:52Z`. Its bootstrap exists (1982 B, 2026-08-17) and the script it calls,
`scripts/security-audit.ps1`, **is** tracked and present — so this is a healthy task that is simply
switched off, not a broken one. It appears in no cadence table, so nothing else in the pipeline
would ever notice.

Disabling may well be deliberate. Only Marco knows, and guessing at his intent is RULE 3.

**ESCALATED** → Marco. The question, with RULE 1 applied:

- **(A) Re-enable it and add a one-line row to `STATION-CAPABILITIES.md` §6** so a disabled or
  drifted schedule is visible to the next drift sweep instead of invisible. *Complete on both
  halves: fixes it now (audit resumes) and in future (the gap becomes measurable), and it writes no
  data and changes no permission, so it cannot damage current or future data entry.*
- (B) Re-enable it and change nothing else. Fails the **future** half — the next 15-day silence is
  just as invisible as this one was.
- (C) Leave it off and record in §6 that it is deliberately dormant. Fails the **immediate** half —
  no security baseline is being taken — but is correct if you turned it off on purpose.

Was it switched off deliberately, and if so should §6 record it as dormant?

### F6 — the rotation-advance step is documented but not actually landing [MEASURED]

`04-scanner.md` says: *"`--advance` … and commit that file with your breadcrumb — if you skip this,
the next run repeats your sweep and the rotation silently stops."* On arrival, `sweep-rotation.json`
was **dirty in the dev tree** carrying the 2026-09-01T22:10:48Z run's advance, never committed. Mine
is now dirty on top of it.

The mechanism is structural, not carelessness: **Station 04 cannot commit.** The authority matrix
gives 04 *Create a PR: ❌* and *Mutate the board: ❌ read-only*, and the dev tree is on `main`, which
nobody may commit to directly. So the instruction as written asks 04 to do something 04 is forbidden
to do, and the file survives only because the working copy happens to persist between runs — which
is exactly the *"it exists only on the box that wrote it"* fragility the docs flag elsewhere.

**DISPATCHED** → Station 00, two parts. (1) Commit `docs/pipeline/sweep-rotation.json` with this
breadcrumb — it is the only actor that can. (2) The durable fix is a one-line edit to
`04-scanner.md`: change *"commit that file with your breadcrumb"* to *"leave it dirty in the dev
tree and name it in your breadcrumb; **00 commits it**"* — which matches both the authority matrix
and what actually happens.

### F7 — the instruction-drift sweep's own premise is now SATISFIED [MEASURED]

The rotation entry justifies itself with *"five pasted copies drifted for weeks and four carried
advice this pipeline had already disproved."* Measured this run (§2): the five copies differ by
exactly their five station-specific lines and nothing else, carry no disproved advice, and were
written in one batch. The failure mode the sweep was built for is closed.

Not a reason to retire the sweep — it is the only instrument that would notice a re-drift, and its
value this run came from the *other* half of its brief (path and cadence resolution, F1/F5). But
the entry's `_why` text should say what it now watches for rather than describing a cured incident,
or a future run will read a solved problem as an open one.

**DEFERRED** → next `instruction-drift` rotation (position 4, ~4 runs out). What would make it
urgent: any bootstrap mtime diverging from the others, which is the one-call probe in §2.

## WHAT I DID NOT DO

- **Armed nothing, staged nothing.** Two prompts sat modified-but-uncommitted in the dev tree on
  arrival (`pr-cardui-s2-wbs-table-shell-HOLD.md` +57 lines, `pr-cardui-s8-waste-section-HOLD.md`
  +42). I did not read them into a judgement and did not touch them: 04 arms nothing, and
  `pr-cardui-s2` is specifically flagged must-not-be-armed while `#1483` is open.
- **Did not touch `#1483`.** It carries a live `marco:true` verdict; RULE 2 bars every station from
  clearing it and green does not clear it. Out of my lane entirely.
- **Did not open a PR or commit anything**, including the rotation file — see F6.
- **Did not run Part 0 / Part 1 / Part 2** of the older station brief (static cross-layer audit,
  GitHub reconciliation, live-site visual patrol). The contract above the brief says take **ONE**
  assigned sweep and cover it completely, and the assigned sweep was `instruction-drift`. Spreading
  into the QA brief is the shallow-pass failure the rotation exists to prevent.
- **Did not mint a worktree.** Read `origin/main` with `git show` throughout, per AUTHORITY.
- **Did not clear or investigate any lock** — none were found in my path, and clearing is 03's on
  00's dispatch regardless.
- **Did not re-litigate the `-singlelane` wrapper question**, which is settled. F1 is about the
  *registry* naming the wrong file, not about which wrapper is correct.
