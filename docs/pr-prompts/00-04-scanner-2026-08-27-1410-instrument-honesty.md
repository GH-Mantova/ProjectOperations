# Station 04 — Scanner | 2026-08-27 14:10Z–14:20Z

## GROUND

```
UTC            2026-08-27T14:10:18Z
origin/main    01ad020e            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ cb9fce55     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — this run was not restricted to read-only on that account.
Sweep assigned by `node scripts/pipeline/next-sweep.mjs`: **instrument-honesty** (rotation
position 2 of 4; previous run 2026-08-27T10:10:19Z). Not chosen by me.

Preflight lock check [MEASURED]: `.git\index.lock` **ABSENT**; `Get-Process git` = 0;
`MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` /
`sequencer` all False. `status-sweep.ps1` verdict at 14:10:58Z: **SAFE TO ACT**.
Trunk colour deliberately NOT taken from the sweep — read per-commit instead (T3 below).

---

## WHAT I MEASURED

Every line below is a probe run this run against origin/main `01ad020e`. Each negative
result carries a positive control, per DOCTRINE §7.

### DOCTRINE §9.1 — the shell

| Claim | Result |
|---|---|
| `$` is STRIPPED from any `-Command "..."` string | **REPRODUCED** [MEASURED] |
| Blocked commands: `net` `sc` `reg` `netsh` `takeown` `shutdown` | **TRUE but INCOMPLETE** [MEASURED] |
| Streamed output pauses on lines starting with `#` | [CANNOT MEASURE] — not exercised this run |

`powershell.exe -NoProfile -Command "... Write-Host ('EXITMARK=' + $LASTEXITCODE)"` →
`At line:1 char:87 + ... Write-Host ('EXITMARK=' + ) ... You must provide a value expression
following the '+' operator.` The `$LASTEXITCODE` token arrived as nothing. Exactly the
documented shape.

`get_config.blockedCommands` actually holds **33** entries, not 6: `mkfs format mount umount
fdisk dd parted diskpart sudo su passwd adduser useradd usermod groupadd chsh visudo shutdown
reboot halt poweroff init iptables firewall netsh sfc bcdedit reg net sc runas cipher takeown`.
`allowedDirectories` = `[]` (unrestricted) — confirms STATION-CAPABILITIES §3. DC v0.2.47,
node 24.14.1, python 3.14.4, PS 5.1.26100.9168, git 2.55.0.windows.3.

### DOCTRINE §9.2 — git

| Claim | Result |
|---|---|
| `ls-tree` without `-r` returns ONE line | **REPRODUCED** [MEASURED] |
| `git status` blind to gitignored files | **REPRODUCED** [MEASURED] |
| git 2.55 plain `fetch origin main` DOES update `refs/remotes/origin/main` | **REPRODUCED — doc is correct** [MEASURED] |
| dev-tree index is SHARED between chats | **REPRODUCED — live instance found** [MEASURED] |
| watcher-clone `git stash` is a closed loop | **REPRODUCED — 41 stashes** [MEASURED] |
| `checkout .` / `reset --hard` / `stash pop` / `clean` resurrect prompts | [CANNOT MEASURE] — destructive by definition, not attempted |

- **T1** `git ls-tree --name-only origin/main -- docs/pr-prompts` → **1** line, and that line is
  the directory itself (`docs/pr-prompts`). With `-r` → **456** lines. Positive control:
  `docs/pr-prompts/PROMPT-SCHEMA.md` present in the `-r` result = True.
- **T2** `git ls-files --others --ignored --exclude-standard -- docs` → **3990** files on disk.
  `git status --porcelain -- docs` → **65** lines, none of them those 3990. Positive control:
  status is not blind in general — it reported ` M docs/data-model/metadata-catalog.json`,
  ` M docs/pipeline/sweep-rotation.json` and 60+ ` D` consumed-HOLD deletions.
- **T5** Forced `refs/remotes/origin/main` back to `cb9fce55`, ran plain `git fetch origin main`,
  re-read: `01ad020e`. Ref restored to its original value; no damage. git 2.55.0.windows.3.
- **T6** `git diff --cached --name-status` in the dev tree carries **one staged entry that is not
  mine**: `R100 docs/pr-prompts/pr-guard-s1-verdict-file-list-HOLD.md →
  docs/pr-prompts/pr-guard-s1-verdict-file-list-ready.md`. See FINDING 2.
- **T7** `git -C C:\po-watcher\ProjectOperations stash list` → **41**.

### BOARD TRAP check (mandated by the station doc)

[MEASURED] Tracked depth-1 `*-ready.md` on `origin/main`: **0**. Query was
`git ls-tree -r --name-only origin/main -- docs/pr-prompts` filtered on
`^docs/pr-prompts/[^/]+-ready\.md$` — the same `-r` query that returned 456 rows, so the zero is
a real zero and not the §9.2 blindness. On-disk armed at depth 1: **0**.

### DOCTRINE §9.3 — files and encoding

| Claim | Result |
|---|---|
| `Get-Content` reports FALSE MOJIBAKE | **REPRODUCED, and worse than documented** [MEASURED] |
| Real double-encoding signature `U+00E2 U+20AC U+201D` | **CORPUS IS CLEAN — the 2026-08-24 repair has HELD** [MEASURED] |
| `Get-Content -Raw \| Set-Content` double-encodes and adds a BOM | **PARTLY REFUTED — see FINDING 3** [MEASURED] |

- **T13** `(Get-Content DOCTRINE.md)[363]` returned high chars `U+00C3 U+00A2 U+00E2 U+201A U+00AC`.
  Node read the same line as `U+00E2 U+20AC`. PS 5.1 mangles it a *second* time in the reader.
- **ENC scan** over all 11 `docs/pipeline/**/*.md` via node: `U+FFFD` = **0**, mojibake = **1**,
  and that single hit is DOCTRINE.md **line 364** — the doc's own worked example of the signature.
  Real damage = **0**. Positive controls: the detector fires on a synthetic CP1252→UTF-8 string
  (`mojibakeDetected=1`), and the corpus contains **437** em-dashes, i.e. the vulnerable character
  is abundantly present.

### DOCTRINE §9.4 — GitHub

| Claim | Result |
|---|---|
| `gh run list --branch main` can be DAYS stale | **REPRODUCED — 50 days stale right now** [MEASURED] |
| escaped double quotes die in a `--jq` through `-Command` | **REPRODUCED verbatim** [MEASURED] |
| a `--jq` expression otherwise survives, spaces included | **REPRODUCED** [MEASURED] |
| MCP token cannot merge / open PRs (403) | [CANNOT MEASURE] — that is a write; not attempted |
| `mergeStateStatus: CLEAN` can still be refused | [CANNOT MEASURE] — not attempted |

- **T3** `gh run list --branch main --limit 5` → top 5 runs all dated **2026-07-08**, sha
  `90ff89ea` / `5039b69a`. Head of main is `01ad020e`, today.
  Positive control: `gh api repos/GH-Mantova/ProjectOperations/commits/01ad020e/check-runs` →
  **13** check-runs, started `2026-08-27T11:24:12Z`, **12 success + 1 skipped, 0 failure**.
  So: trunk at `01ad020e` is GREEN [MEASURED, per-commit], and the branch listing is 50 days behind.
- **T4** `gh pr view 1350 --json labels --jq '[.labels[].name] | join(\",\")'` through `-Command` →
  `failed to parse jq expression (line 1, column 25) [.labels[].name] | join(,\) ^ unexpected
  token ","`. **Loud.** Positive controls, same `-Command` layer: `--jq '.labels[].name'` →
  `do-not-merge`; `--jq '.labels | length'` → `1` (note the space survived).
  Baseline via `--json labels | ConvertFrom-Json`: #1350 has 1 label, `do-not-merge`.
  Extra datum: wrapping a `[]`-containing jq in `\"...\"` kills PowerShell's parser outright
  (`Array index expression is missing or not valid`) before `gh` is ever invoked.

### DOCTRINE §9.5 — the pipeline's own instruments

| Claim | Result |
|---|---|
| `lint-prompt.mjs` silently waives file-gates when **`gh`** is missing | **REFUTED AS WRITTEN — see FINDING 1** [MEASURED] |
| the silent-waiver behaviour itself | **REPRODUCED — but the trigger is `git`, not `gh`** [MEASURED] |
| `STOP-WATCHER-LANE2` present by design | **TRUE but MISLOCATED — see FINDING 4** [MEASURED] |
| heartbeat only ticks MID-RUN; long-stale + open PR = merge-wait | **REPRODUCED** [MEASURED] |
| never count or kill by image name | **REPRODUCED — 17 `node.exe`, exactly 1 is the watcher** [MEASURED] |
| `rev-<n>-ready.md` have no front matter by design | [CANNOT MEASURE] — 0 present at depth 1 this run |
| a restart adopts nothing | [CANNOT MEASURE] — would require a restart; out of lane |

- **T8** `Get-Process node` = **17**. `Win32_Process` filtered on cmdline
  `pr-watcher[\\/]index\.mjs` → exactly **1**, **pid 28328**. Same PID as the 12:15Z reading,
  so the watcher process has **not** restarted.
- **T14** Clone heartbeat `C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log`
  mtime `2026-08-27T12:32:52Z`, age **104.2 min**, last two lines
  `rev-1353-ready.md elapsed=240s` / `elapsed=300s`. PR **#1353 is OPEN and BLOCKED**. That is
  precisely the documented merge-wait shape, not a hang — and the process is alive (T8).
  The dev-tree copy of the same file is frozen at **2026-07-08T05:50:11Z**; do not read it.

### Board state, incidentally measured

[MEASURED @14:10:58Z, decays — re-measure before acting] origin/main `01ad020e` GREEN
(12 success / 1 skipped / 0 fail, per-commit). Open PRs: **#1353 BLOCKED**
(`feat(pipeline): check-sot-refs + wire five sot/pipeline checkers into CI`).
`#1352` merged 11:23Z. Armed depth-1 `*-ready.md`: **0**. `blocked/`: 0. Watcher pid 28328 alive.
Watcher clone `branch=main dirty=36`. No index.lock anywhere. Verdict SAFE TO ACT.

---

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched.
No label changed. No merge. No push. No `/sot/` edit.

Three writes, all outside the board:

1. `docs/pr-prompts/00-04-scanner-2026-08-27-1410-instrument-honesty.md` — this breadcrumb
   (tracked path, currently **untracked on disk**; Station 00 must sweep it up).
2. `docs/pipeline/sweep-rotation.json` — advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-27T14:10:18Z`, per the station
   doc. **Left uncommitted** — see FINDING 5 for why I did not commit it.
3. Three scratch probes under `C:\po-sup-fix-scripts\` (`scan-encoding-2026-08-27.mjs`,
   `locate-moji-2026-08-27.mjs`, `enc-roundtrip*-2026-08-27.ps1`). Sanctioned scratch, not the repo.

One transient, fully reverted: T5 forced `refs/remotes/origin/main` to `cb9fce55` to test the
fetch claim, then read it back at `01ad020e` after a plain fetch. Read-back asserted (§1);
`restored=True`.

---

## FINDINGS

### FINDING 1 — DOCTRINE §9.5 names the WRONG BINARY, so its prescribed guard cannot catch the failure it exists for. S2.

**The claim.** §9.5, bullet 1: *"`lint-prompt.mjs` does NOT reject when **`gh`** is missing — it
WARNs `could not probe ... skipping` and ADMITs with exit 0, so every `origin/main:` file-gate is
silently waived. … **Confirm `gh` resolves before believing any ADMIT.**"*

**Measured.** The file-gate probe never touches `gh`. `checkFileGateDead()` calls
`readFromOriginMain()` (`scripts/pipeline/lint-prompt.mjs`), which is:

```js
const gitBin = process.env.LINT_GIT_BIN || "git";
return execFileSync(gitBin, ["show", "origin/main:" + path], { ... });
...
return null;   // git broken - skip check, fail SAFE
```

and it is that `null` that produces the WARN at `:495`. `gh` appears in this script in exactly one
place (`:953`, `LINT_GH_BIN`) and is used only for `gh pr view <n> --json state` — the `fixes_pr`
settle check. Three runs against
`docs/pr-prompts/pr-ew-s4-capacity-board-api-HOLD.md` (gate:
`apps/api/src/modules/tendering/allocation.controller.ts`):

| Run | Exit | File-gate WARN emitted? |
|---|---|---|
| A. control, both binaries present | 0 ADMIT | no |
| B. `LINT_GIT_BIN=C:\nope\definitely-not-git.exe` | **0 ADMIT** | **YES — `could not probe origin/main:… skipping`** |
| C. `LINT_GH_BIN=C:\nope\definitely-not-gh.exe` | 0 ADMIT | **no** |

**Why it matters.** The *behaviour* §9.5 warns about is real and dangerous — a broken git silently
waives every file gate, including on prompts that drop database tables. But the guard the doc tells
you to run ("confirm `gh` resolves") is measuring an unrelated binary. An agent can execute that
guard perfectly, get a clean answer, and still be holding a fully-waived ADMIT. The prescribed
check has a **0% detection rate** for the failure it was written for.

**Suggested correction** (I did not make it — §9 is a CANONICAL-BLOCK and editing it requires
re-recording the hash in `lint-station.mjs`; also out of my lane): replace `gh` with `git`, and
give the reader a probe that actually discriminates — an ADMIT is only trustworthy if
`git show origin/main:<the gated path>` succeeds from the same cwd. Keep the `gh` sentence as its
own bullet, scoped correctly to `fixes_pr`.

**DISPOSITION: ESCALATED** — Marco (or 00 acting for him) must decide, because it is a canonical-block
edit and it touches an instrument every station trusts. Options, RULE 1 applied:

- **(A) COMPLETE + ADDITIVE — recommended.** Correct §9.5 to say `git`, AND add a positive-control
  line to `lint-prompt.mjs` so the tool proves its own instrument: on a WARN, emit the binary name
  and the cwd, and make `--all` print a summary count of waived gates. Passes both halves — it fixes
  the doc now, and the tool stops being able to waive silently in future. Touches no prompt data.
- **(B) Doc-only correction.** Swap `gh`→`git` in §9.5, re-record the hash. Fixes *immediately*;
  fails the *future* half — the next broken-git run still waives every gate with only a stderr WARN
  that a scripted caller will not see.
- **(C) Make a broken git a hard FAIL (exit 1) instead of a WARN.** Fixes the future half; **fails
  the "without damaging existing/future data entry" half** — one flaky git call would then bin
  legitimate prompts, which is the §7 lie-#3 failure mode (a spawn failure read as a verdict) that
  cost this pipeline an entire backlog. Do not do this alone.
- **(D) Leave it.** Fails both halves. Listed only for completeness.

### FINDING 2 — a staged arming rename is sitting in the shared dev-tree index. S2, live landmine.

[MEASURED] `git diff --cached --name-status` in `C:\ProjectOperations2`:

```
R100    docs/pr-prompts/pr-guard-s1-verdict-file-list-HOLD.md → docs/pr-prompts/pr-guard-s1-verdict-file-list-ready.md
```

Neither file exists on disk (both `Test-Path` = False) and on-disk armed count is 0 — so this is
**residue of a completed arm**, not a live arm: the prompt shipped as **#1352**
(`feat(pipeline-guard): validate review verdicts against PR file list`, merged 11:23Z) and the
watcher retired the file into a gitignored folder.

It is still a landmine. Any `git commit` in this tree **without a pathspec** will carry that rename
and put a **tracked `*-ready.md` at depth 1 on `main`** — the exact BOARD TRAP the station doc says
to report, and `.gitignore:75` cannot stop it because `git mv` keeps a tracked file tracked. This is
the standing "every arm leaves an R100" hazard, observed live rather than remembered.

**DISPOSITION: DISPATCHED → Station 00.** 00 owns board mutations and is the station that commits
breadcrumbs. Recommended handling: `git restore --staged
docs/pr-prompts/pr-guard-s1-verdict-file-list-ready.md` (index-only, touches no file on disk — it
does not resurrect anything, because neither file exists in the worktree), and until then commit
**only** with an explicit pathspec. I did not run it: unstaging is a board-index mutation and I am
read-only.

### FINDING 3 — DOCTRINE §9.3's `Set-Content` warning is right about the danger and wrong about the trigger. S3.

**The claim.** *"`Get-Content -Raw` piped to `Set-Content` double-encodes UTF-8 and adds a BOM."*

**Measured**, on a synthetic BOM-less UTF-8 file whose em dash is `E2 80 94`:

| Command | Result bytes | BOM |
|---|---|---|
| `Get-Content -Raw \| Set-Content` (bare) | `… E2 80 94 …` + `0D 0A` | **no** |
| `Get-Content -Raw \| Set-Content -Encoding default` | `… E2 80 94 …` | no |
| `Get-Content -Raw \| Set-Content -Encoding utf8` | `… C3 A2 E2 82 AC E2 80 9D …` | **YES `EF BB BF`** |
| `Get-Content -Raw \| Set-Content -Encoding ascii` | `… 3F 3F 3F …` | no |
| `Get-Content -Raw \| Out-File` (default) | starts `FF FE` = **UTF-16LE** | — |
| `Get-Content -Raw \| Out-File -Encoding utf8` | `EF BB BF …` | **YES** |

The **bare** pipe round-trips byte-clean, because Get-Content's CP1252 mis-decode and
Set-Content's ANSI re-encode are the same wrong map and cancel. The corruption needs the two halves
to disagree — and `-Encoding utf8` is precisely the "fix" a reader reaches for. `C3 A2 E2 82 AC
E2 80 9D` is the documented `U+00E2 U+20AC U+201D` signature, reproduced end to end: this is the
mechanism that produced the 133 repaired sequences.

**Why it matters.** Stated unconditionally, the bullet is falsifiable in one command — and a reader
who falsifies it may then discount the whole bullet and reach for the variant that genuinely
corrupts. Same shape as §7 lie #2, where the *proposed fix* would have caused the corruption for
real (confirmed again here: `-Encoding ascii` destroyed the em dash to `3F 3F 3F`).

**DISPOSITION: ESCALATED** — same canonical-block constraint as FINDING 1; bundle the edits.
RULE 1: the complete-and-additive option is to restate the bullet by *mechanism* ("any PowerShell
read→write where the two encodings differ; `-Encoding utf8` and `Out-File` are the live footguns;
`Out-File` default writes UTF-16LE") and keep the existing "edit docs and prompts with node"
instruction, which remains correct and is the actual cure. No alternative fails a half here — this
is a precision fix, not a behaviour change.

### FINDING 4 — `STOP-WATCHER-LANE2` is documented without a path, and it is not where a reader will look. S3.

[MEASURED] `Test-Path C:\ProjectOperations2\STOP-WATCHER-LANE2` = **False**. `Get-ChildItem
C:\ProjectOperations2 -Filter 'STOP-WATCHER*' -Force` = **nothing**. Positive control: 75 files
enumerable at that root, so the query was not blind. Recursive search of `C:\ProjectOperations2`
and `C:\po-watcher` → exactly **1** hit: **`C:\po-watcher\STOP-WATCHER-LANE2`**, 1090 bytes,
mtime `2026-08-18T04:44:50Z`.

§9.5 says it "has been present BY DESIGN since 2026-08-15" but names no location. Checked in the
dev tree — the obvious place, and the tree every station is told the watcher globs — it reads as
**absent**, i.e. as drift, or as "someone deleted the sentinel". Both wrong conclusions are one
`Test-Path` away.

**DISPOSITION: ESCALATED** — bundle with FINDINGS 1 and 3 into one canonical-block correction.
Fix is one clause: name the path `C:\po-watcher\STOP-WATCHER-LANE2`, and state that the real
sentinel `STOP-WATCHER` is likewise clone-side (currently absent from both trees).

### FINDING 5 — the sweep rotation's state is uncommitted, so the rotation is one `clean` away from restarting forever. S3.

[MEASURED] `git diff -- docs/pipeline/sweep-rotation.json` shows the **10:10Z** run's advance
(`last_index -1→0`, `last_run_utc null→2026-08-27T10:10:19Z`, `last_station null→04-scanner`)
still sitting **unstaged in the working tree**. The station doc instructs each run to "commit that
file with your breadcrumb"; measurably, that has not been happening.

Consequence: the only record that gate-liveness was already swept lives in an uncommitted working
file, in a tree where `git checkout .` / `reset --hard` / `clean` are documented board traps and
therefore *will* eventually be reverted or reset by something. If it reverts to `last_index: -1`
the rotation restarts at gate-liveness and **instruction-drift and repo-hygiene never run again** —
which is the precise failure the rotation file was created to prevent.

Second, cosmetic [MEASURED]: `next-sweep.mjs --advance` rewrites those three keys at column 0
instead of preserving the two-space indent. Still valid JSON; nothing breaks; it just makes every
diff of this file noisier than the change it carries.

**Why I did not commit it myself.** Committing here would mean a commit in the shared dev tree
whose index carries FINDING 2's staged arming rename. A pathspec commit would be safe, but 04 is
read-only on the board and the tree is shared with concurrent chats; creating a commit that another
chat then pushes is exactly the LL-38 collision shape. I left both files on disk and am reporting
them instead.

**DISPOSITION: DISPATCHED → Station 00.** 00 sweeps breadcrumbs and commits them. Please commit
**both** `docs/pr-prompts/00-04-scanner-2026-08-27-1410-instrument-honesty.md` and
`docs/pipeline/sweep-rotation.json` in the next board PR, with an explicit pathspec, and do **not**
let the R100 rename ride along.

### FINDING 6 — §9.4's `gh run list --branch main` staleness is understated by an order of magnitude. S3.

[MEASURED] The doc says "can be DAYS stale". Today it is **50 days** stale: the top five entries
are all from **2026-07-08** while main's head `01ad020e` ran its checks at **2026-08-27T11:24:12Z**.
A reader calibrated on "days" may still sanity-check the dates and accept a week-old page as
plausibly current. It is not stale — it is **frozen**, and has been for seven weeks.

**DISPOSITION: DEFERRED.** Real, and the mitigation the doc already gives ("read CI per-commit") is
correct and sufficient, so nothing is currently at risk. It becomes urgent the moment any script or
station starts branching on `gh run list --branch main` output — worth a grep next repo-hygiene
sweep. Bundle the wording fix ("frozen since 2026-07-08 on this repo, not merely stale") with the
other canonical-block edits if they are made.

---

## WHAT I DID NOT DO

- **Did not arm, disarm, promote, rename, move or delete any prompt.** Read-only on the board.
- **Did not edit DOCTRINE.md.** §9 is a CANONICAL-BLOCK; `lint-station.mjs` fails on an edit without
  a re-recorded hash, and correcting a document binding on every station is not 04's call. All four
  doc findings are reported for one bundled correction.
- **Did not unstage the R100 rename** (FINDING 2), though it is index-only and would not touch disk.
  Board index mutation = 00's lane.
- **Did not commit or push anything**, including my own breadcrumb — see FINDING 5.
- **Did not mint a worktree.** Read `origin/main` with `git show` / `ls-tree` per the AUTHORITY
  section; no `/tmp/po-scan-*` orphan created.
- **Did not run Part 0 / Part 1 / Part 2** of the legacy station brief. `next-sweep.mjs` assigned
  **instrument-honesty** and the AUTHORITY section says one named sweep, covered completely. Part 2
  live-site work was not attempted at all this run.
- **Did not test four §9 claims**, all marked `[CANNOT MEASURE]` above rather than inferred:
  the destructive git family (destructive by definition); the `#`-pause streaming trap; MCP-token
  403 and `mergeStateStatus: CLEAN` refusal (both writes); `rev-<n>-ready.md` front matter (none
  present at depth 1); "a restart adopts nothing" (would require restarting the watcher — 03's lane).
- **Did not touch Azure / Entra / SharePoint.** Not approached in any form.
- **Did not act on `[STALE]` or `[FILE]` lines** from `status-sweep.ps1`, and did not quote its
  trunk colour — read `check-runs` per-commit instead.

---

## ADDENDUM — re-measured at 2026-08-27T14:21Z, after the body above was written

Kept as an addendum rather than folded in, so the 14:10Z readings above stay honest about when
they were taken. `[LIVE]` means true when measured (§7).

**1. One `[CANNOT MEASURE]` is now `[MEASURED]`.** At 14:17:14Z the watcher created
`docs/pr-prompts/rev-1354-ready.md` (1596 bytes) — the first depth-1 `*-ready.md` of this run, and
**not** an arming: it is an auto-generated review job. Read back: the file begins
`Use the pr-fix-reviewer agent to review PR #1354 …` with **no YAML front matter at all**.
DOCTRINE §9.5's *"`rev-<n>-ready.md` are auto-generated REVIEW JOBS, not prompts; they have no front
matter by design — exclude them from prompt audits"* is **CONFIRMED**. No finding.

**2. The board moved under me.** Armed depth-1 count went **0 → 1** between 14:10Z and 14:21Z, and
a new PR opened. Anyone reading the board block above must re-measure before acting — which is the
rule, restated here because this run produced a live example of it inside eleven minutes.

**3. A lead, not a finding — an unreproduced red on main.** PR **#1354** is titled
`fix(crm): pin the deriveGoingCold clock - required API check went red on main at 2026-08-27T12:00Z`.
I re-fetched and re-read the head commit's checks at 14:21Z:
`gh api repos/GH-Mantova/ProjectOperations/commits/01ad020e/check-runs` → **13 total, 12 success,
1 skipped, 0 failure**. So the failure #1354 exists to fix is **not visible on the head commit's
check-runs** — it may have been a scheduled/push-triggered run not attached to this commit, or it
may have been re-run green since. I did not chase it: diagnosing a red means reading the job log
(§3), and that is 02's lane on 00's dispatch, not mine. Recording it so 00 can close the loop rather
than assume the title is current.

**4. Open PRs at 14:21Z** [MEASURED]: **#1353** (`feat(pipeline): check-sot-refs + wire five
sot/pipeline checkers into CI`, BLOCKED as of the 14:10Z sweep) and **#1354** (above).
Watcher pid **28328** still alive, unchanged since 12:15Z. No `index.lock` in either tree.

**5. Instrument note on my own verification.** My first breadcrumb self-check reported
`findings=6 dispositions=3`, which looks like three findings lacking a disposition. It was the
checker that was wrong: the regex required `**` immediately after the disposition word and so
missed `**DISPOSITION: DISPATCHED → Station 00.**`. Re-run with a looser pattern plus a negative
control (`DISPOSITION: PONDERED` → 0 matches): **findings=6, dispositions=6**, one per finding.
Logged because it is the sweep's own subject matter — a check that has never been seen to pass is
not a check (§7).
