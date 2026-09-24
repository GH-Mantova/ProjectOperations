# Station 04 — Scanner | 2026-09-24T14:10:25Z–2026-09-24T14:22Z

## GROUND

```
UTC            2026-09-24T14:10:25Z
origin/main    11c07025
dev tree       main @ 11c07025  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so this run was not read-only-by-mismatch.

Sweep taken: **`instrument-honesty`** (rotation position 2 of 4), assigned by
`node scripts/pipeline/next-sweep.mjs`, not chosen. Advanced to `last_index=1` at the end of the
run and **LEFT DIRTY** — see WHAT CHANGED.

Freshness of the three binding documents: read from the working copy, then proved current by
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md`
→ **EMPTY output** (§9.3's prescribed form; no piped hash was taken, per PREFLIGHT's `git show | hash-object`
warning). Tree is `0 0` on `git rev-list --left-right --count HEAD...origin/main`, so the §9.2
behind-HEAD caveat does not apply to any `git status` reading below.

## WHAT I MEASURED

Host reachable. `start_process` shell `powershell.exe` → `HOST-OK`, PS **5.1.26100.9444**. Not a
blind run.

**Device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
[MEASURED] last line verbatim:

```
   PATH="/sessions/compassionate-festive-bell/.local/bin:$PATH" git <args>
```

headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`,
**EXIT CODE 2**, read from the installer itself and not from a pipeline appended to it. This is the
station doc's expected middle outcome — a FINDING, not a STOP. See F4.

### The sweep: DOCTRINE §9, one probe per trap, positive and negative controls on every row

All probes run from `.ps1` files invoked with `-File` (§9.1's cure), `Set-Location` into the dev
tree, `-R GH-Mantova/ProjectOperations` on every `gh` call (§9.4's CWD bullet), `$LASTEXITCODE`
tested before every parse, and every count taken through the null guard
`@($x | Where-Object { $null -ne $_ }).Count` (§9.4's `NULL_COUNT_IS_IN_THE_COUNTER_V1`). Every
chain ends in a literal marker and every marker printed, so no reading below is an unrun statement
read as an empty one (§9.1's `EARLY_RETURN_REPORTED_AS_TERMINATION_V1`).

| # | §9 trap | probe | result | verdict |
|---|---|---|---|---|
| 1 | 9.2 `ls-tree` depth | `-- docs/pr-prompts/superseded` no slash/no `-r` · slash · `-r` | **1** · 240 · **446** | [MEASURED] **REPRODUCES** |
| 2 | 9.2 `ls-tree` glob pathspec | `-- 'docs/pr-prompts/*.md'` with and without `-r` | **0** · **0**; POSCTRL literal prefix **1394** | [MEASURED] **REPRODUCES** |
| 3 | 9.2 `check-ignore` on a directory | dir · tracked-file NEGCTRL · ignored-file POSCTRL | exit **1** empty · exit **1** empty · exit **0** `.gitignore:76` | [MEASURED] **REPRODUCES** — opposite truths, byte-identical |
| 4 | 9.2 `git status` blind to gitignored | `status --porcelain` vs `ls-files --others --ignored` over `docs/pr-prompts/` | **1** row vs **5614** files | [MEASURED] **REPRODUCES** |
| 5 | 9.3 `Measure-Object -Line` | `lint-prompt.mjs` | `-Line` **2282** · `.Count` **2444** · blanks **162** · sum exact | [MEASURED] **REPRODUCES** |
| 6 | 9.3 `-SimpleMatch` + `[regex]::Escape()` | needle `lint-prompt.mjs` over DOCTRINE | raw **14** · escaped **0** · NEGCTRL **0** | [MEASURED] **REPRODUCES** |
| 7 | 9.3 single-quoted doubled-backslash path | `'C:\\ProjectOperations2'` vs `"C:\ProjectOperations2"` | **0** vs **4** | [MEASURED] **REPRODUCES** |
| 8 | 9.1 automatic-variable binding | `foreach ($home in @(1,2,3))` via `-File` | `SessionStateUnauthorizedAccessException`, **0** rows; POSCTRL `$loopVar` **3** rows | [MEASURED] **REPRODUCES** |
| 9 | 9.1 `GCI` `\*` + `-Recurse` + type filter | fixtures A/B/C rebuilt to the 2026-09-11 spec | A `2/2`,`3/3` · B `2/2`,`3/3` · **C `2/`**`0`**, `2/`**`0` | [MEASURED] **REPRODUCES**, and only on C |
| 10 | 9.1 nested `-Command` expansion | Desktop Commander `powershell.exe -NoProfile -Command "…$CTRL…"` | **`The string is missing the terminator: ".`** | [MEASURED] **REPRODUCES** — the canonical row-B signature |
| 11 | 9.4 `@(ConvertFrom-Json …).Count` | inline `'[]'` · assign `'[]'` · assign 4 · assign `""` | **1** · 0 · 4 · **1** (null guard → 0) | [MEASURED] **REPRODUCES**, both halves |
| 12 | 9.4 `gh run list --commit <short>` | short `11c07025` vs full 40-char | exit 0 / **0 rows** vs exit 0 / **8 rows** | [MEASURED] **REPRODUCES** |
| 13 | 9.4 `gh pr view --json number` | PR 999999 | `--json number` exit **0** `{"number":999999}`; `--json number,state` exit **1** GraphQL | [MEASURED] **REPRODUCES** |
| 14 | 9.4 `gh` infers repo from CWD | non-repo CWD, `-R` absent/present; repo CWD; bad repo | exit **1**/**0 chars** · 0/81 · 0/81 · NEGCTRL exit 1 | [MEASURED] **REPRODUCES** |
| 15 | 9.4 `merged` on a LIST response | `gh api /pulls?state=closed&per_page=10` vs single GET | key **defined on 0 of 10**; `merged_at` on **9 of 10**; POSCTRL `/pulls/2165` → `merged=True` | [MEASURED] **REPRODUCES** (the 2026-09-07 `gh`-transport shape: absent, not `false`) |
| 16 | 9.4 `--jq` escaped double quotes | nested form vs plain single-quoted POSCTRL | fails **LOUDLY** exit 1; POSCTRL `--jq '.labels[].name'` → exit 0, `do-not-merge` | [MEASURED] **REPRODUCES** — new arrival shape, see F1 |
| 17 | 9.4 `gh run list --branch main` is days stale | newest 5 rows vs `origin/main` | newest **2026-09-24T14:00:43Z** on `11c07025` = `origin/main` | [MEASURED] **DID NOT FIRE TODAY** — see lead L1 |

**Nothing in §9 was found retired.** Sixteen of seventeen traps reproduced on their own falsifying
probes; the seventeenth did not fire, which is not the same thing (L1).

### Three numbers §9 quotes that have moved, and none of them is drift

Each is labelled STATE in the document itself (*"re-measure, never quote"*), so these are recorded
so the next run does not re-find them as defects:

- §9.2's `ls-tree` worked example cites `-- docs/pr-prompts/superseded` as **1** without `-r` and
  **252** with it at `b19f3db9`. [MEASURED] today at `11c07025`: **1** and **446**. The *contrast* —
  which is the rule — reproduces exactly.
- §9.3's `Measure-Object` bullet cites `lint-prompt.mjs` at **1827** LF lines / **1706** non-blank;
  §9.5 says *"(now 1824 lines)"*. [MEASURED]: **2444** / **2282**, delta **162** = the blank count,
  exactly as the mechanism predicts.
- §9.5's `.arming-log.txt` two-count comparison: not re-run this run (outside the sweep).

### L1 — `gh run list --branch main` returned fresh, and that does not retire the bullet

[MEASURED] all five newest rows carry `headSha 11c07025`, which is `origin/main`, newest
`2026-09-24T14:00:43Z` — about ten minutes before the reading. The bullet's claim is **conditional**
(*"CAN be DAYS stale"*), so one fresh sample cannot refute it, and the per-commit cure costs nothing
either way. Recorded as a lead, not a finding, per the contract's *"a finding you cannot disposition
is a lead"*. A run that reads this as *"§9.4 has been fixed upstream"* would be retiring a live trap
on a single non-firing sample — the failure this sweep exists to prevent.

### L2 — two open PRs name the same verdict-guard defect

[MEASURED] `gh pr list --state open`: **#2166** `fix(verdict-guard): recover paths whose top-level
dir contains a space` and **#2167** `fix(verdict-guard): rescue bare paths under spaced top-level
directories (SPACED_PATH_CANDIDATES_V1)`. Whether these are two genuinely distinct prompts or one
re-armed twice is **[CANNOT MEASURE]** from the board alone — it needs the two originating prompts
diffed, which is Station 00's collect. Recorded because F3's mechanism is one way a duplicate arises,
not as evidence that it did.

## WHAT CHANGED

**Nothing on the board. Nothing merged, nothing armed, nothing labelled, nothing renamed, nothing
deleted.** This station is read-only on the board and stayed there.

Two writes, both named here so Station 00 can sweep them:

1. **`docs/pipeline/sweep-rotation.json`** — advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-24T14:10:25Z` →
   `advanced: last_index=1 last_run_utc=2026-09-24T14:10:25Z`. Read back:
   `git status --porcelain -- docs/pipeline/sweep-rotation.json` → ` M`. **LEFT DIRTY BY DESIGN —
   Station 00 commits it, because Station 04 may not.** If this is not committed, the next run
   repeats `instrument-honesty` and the rotation silently stops.
2. **This breadcrumb**, at `docs/pr-prompts/` depth 1 in the dev tree. **Untracked until a board PR
   commits it** — Station 00 sweeps it up. It is not in any of the five gitignored `docs/qa/` sinks
   and not in the session `outputs` folder.

⚠️ Both of the above are now untracked/modified paths in the dev tree, so per the REPORT CONTRACT's
fast-forward warning they will block `git merge --ff-only` once a PR lands those paths on `main`.
Station 00's collect resolves both by committing them.

Three scratch `.ps1` probe scripts were written to the session `outputs` folder (disposable, outside
both repos) and three throwaway fixture directories under `$env:TEMP` were created and removed.

## FINDINGS

### F1 — §9.1's `-Command` trap and §9.4's `--jq` trap have a THIRD arrival shape, in which the failure never comes from `gh` at all

[MEASURED] 2026-09-24T14:1xZ at `11c07025`, PS 5.1.26100.9444. §9.1's 2026-09-14 correction gives a
two-row transport table — direct Desktop Commander shell (no expansion) vs a nested
`powershell.exe -Command "…"` (expansion). Both rows re-confirmed today (row 10 above). A **third**
transport, `& powershell.exe -NoProfile -Command $string` issued from inside a `.ps1`, fails by a
**different mechanism**: the quotes are stripped and the argument is re-parsed by the *caller's*
PowerShell.

| transport | what arrived | who raised the error |
|---|---|---|
| Desktop Commander nested `-Command` | `$CTRL` consumed before the child parsed | child PowerShell: `The string is missing the terminator: ".` |
| `& powershell.exe -Command $str` from a `.ps1`, jq payload | `--jq .labels[] \| join(",")` — quotes gone, `\|` read as a **PowerShell pipeline operator** | **caller** PowerShell: `CommandNotFoundException: The term 'join' is not recognized` |
| `& powershell.exe -Command $str` from a `.ps1`, `$CTRL` payload | `ROW_B_nested:$CTRL` as a bare token, `$` **intact, not expanded** | caller PowerShell: `CommandNotFoundException` |

POSITIVE control, same run, same PR: the plain single-quoted `--jq '.labels[].name'` against open
PR **#2167** returned exit **0** and `do-not-merge` — a correct label reading, which is §9.4's own
polarity warning working as written.

**Why it earns a finding rather than a note.** §9.4 already says the arrival string is
*ILLUSTRATION* and *"has drifted once — do not read a different mangling as a non-reproduction"*, and
that instruction is what saved this reading. But both recorded shapes attribute the error to `gh`
(`failed to parse jq expression`, `invalid escape sequence`). In this third shape **`gh` is never
invoked** — the jq expression is truncated at the pipe and its tail is executed as a caller-side
command. A run that greps for a `gh`-side signature as the trap's fingerprint finds nothing and has
the available conclusion *"the jq trap no longer reproduces"*. The headline rules are unchanged and
were re-confirmed: keep double quotes out of jq expressions, and every form measured today failed
**loudly** at exit 1, never silently.

⚠️ **Falsifying probe:** issue `--jq ".labels[] | join(\",\")"` through
`& powershell.exe -NoProfile -Command $str` from inside a `.ps1`. If `gh` itself ever raises the
error, this third row is wrong and must be re-measured.

**DISPATCHED** to Station 00 — the transport row and the "the error may be caller-side" clause belong
in DOCTRINE §9.1/§9.4, and Station 04 may not create a PR (STATION-CAPABILITIES §5).

### F2 — a consumed `-ready.md` is still armed on `origin/main` at depth 1: the BOARD TRAP, live

This is the defect Station 04's own AUTHORITY section names, and it is satisfied in every part.

[MEASURED] at `11c07025`:

| probe | result |
|---|---|
| tracked `*-ready.md` at depth 1 on `origin/main` | **1** — `docs/pr-prompts/pr-verdictguard-spaced-path-candidates-ready.md` |
| same file on disk at depth 1 | **0** — `Get-ChildItem docs/pr-prompts -File -Filter '*-ready.md'` returns nothing |
| `git diff --numstat origin/main -- <that path>` | **`0  99`** — a real 99-line deletion, **not** the §9.2 behind-HEAD artifact (tree is `0 0`) |
| where the file went | `docs/pr-prompts/processed/` holds both `pr-verdictguard-spaced-path-candidates-ready.md` and its `.log` |
| is `processed/` gitignored? | **yes** — `git check-ignore -v` on a file inside it → exit 0, `.gitignore:76` (probe 3 above) |
| the arm | `.arming-log.txt`: `2026-09-24T13:35:34Z ARMED pr-verdictguard-spaced-path-candidates escalates=true actor=station-00` |
| what committed it | PR **#2165**, merged `2026-09-24T13:43:34Z` |
| did the work run? | **yes** — PR **#2167** is OPEN on `fix/verdict-guard-spaced-path-candidates`, and the watcher log shows it live at `14:05:18Z [update] PR #2167 branch updated (was BEHIND)` |

**So the mechanism is exactly the documented one:** the prompt was armed and *committed to `main`* in
its armed state, the watcher then consumed it and retired it into a **gitignored** folder, and
because the destination is gitignored **nothing will ever commit the removal**. `origin/main` still
carries an armed prompt whose work is already an open PR. Any fresh clone, worktree or checkout off
`main` re-arms executed work.

Two costs, both real now rather than hypothetical:

1. **Re-arming.** The next actor to take a clean tree off `main` gets a live `-ready.md` for work
   that is already PR #2167. L2 above records two open verdict-guard PRs; whether that is this
   mechanism having already fired once is unmeasured, and Station 00 is the station that can tell.
2. **The fast-forward.** That ` D` is a tracked deletion in the dev tree. Per the REPORT CONTRACT,
   `git merge --ff-only` refuses while it stands, and the three usual read-backs
   (`rev-list --left-right --count` → `0 0`, `--numstat` EMPTY, `--cached` EMPTY) all read PASS —
   only `git status --porcelain` catches it, and it is what caught it here.

**RULE 1 on the repair, complete-and-additive first:**

- **(A) Complete + additive — commit the deletion AND stop arming into `main`.** Station 00's next
  board PR commits the removal of the `-ready.md` path (restoring the invariant that `origin/main`
  never carries an armed prompt), and the arming step stops committing `*-ready.md` in its armed
  state — arm in the dev tree, commit the `-HOLD`→consumed transition only. Solves it immediately
  and permanently; damages no data entry, because the work itself is already safe in PR #2167 and
  the prompt body survives in `processed/`. **Both halves of RULE 1 pass.**
- **(B) Commit the deletion only.** Immediate fix, no future protection — the next arm re-creates
  the identical trap. **Fails the "and future" half.**
- **(C) Leave it and rely on nobody taking a clean tree off `main`.** Fails the immediate half, and
  is the assumption the BOARD TRAP paragraph exists because it has already been violated.

I have repaired nothing: committing to the dev tree, creating a PR and mutating the board are all
❌ for Station 04 in the authority matrix, and the dev tree is on `main`, which nobody commits to
directly.

**DISPATCHED** to Station 00 — hand-over is the measured table above plus option (A); the deletion
of `docs/pr-prompts/pr-verdictguard-spaced-path-candidates-ready.md` rides in 00's next board PR
alongside this breadcrumb and the rotation advance.

### F3 — this breadcrumb validates clean, and the validator itself flags that it reaches nobody yet

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` run on the Windows host at
2026-09-24T14:2xZ — legitimate here because this run is **sighted**; STATION-CAPABILITIES §3 forbids
it only to a blind run, since it shells `git ls-tree` / `git ls-files` and `gh pr list`. Output
quoted verbatim:

```
NOTE    00-04-scanner-2026-09-24-1410-…-armed-on-main.md is UNTRACKED — it reaches nobody until a board PR commits it
ADMIT   00-04-scanner-2026-09-24-1410-…-armed-on-main.md

structure: 2 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)

CLEAN
```

So the five required sections are present in the fixed order, verified by the one validator that
owns that question — `breadcrumb-clean` is earned rather than asserted. No `lint-prompt.mjs` verdict
was taken on this file, and none would mean anything if it were: it gates `docs/pr-prompts/` as
*prompts* and rejects a breadcrumb for having no YAML front matter, in either direction.

The `NOTE` line is the finding: the report is untracked and reaches nobody until Station 00's board
PR commits it, which is the channel this station's output depends on and cannot itself open.

**DISPATCHED** to Station 00 — commit this file, `docs/pipeline/sweep-rotation.json`, and the F2
deletion in the next board PR. Until then this run's entire output is one untracked file.

### F4 — the device-bridge git guard is INERT, exit 2

Quoted in full under WHAT I MEASURED. This is the station doc's **expected** middle outcome for a
non-interactive non-login shell, not an anomaly: the installer writes its `PATH` export into
`~/.bashrc` and `~/.profile`, neither of which a station's shell sources. **The device-bridge git ban
was therefore remembered, not mechanical, for this entire run.** It was kept: every `git` call in
this run went through Desktop Commander on the Windows host, and no `git` was run against a mounted
folder from the VM.

**DEFERRED** — it becomes urgent if a run ever reports exit **non-zero** (shim not written at all),
or if a station is measured running `git` against the mount, which is the failure DOCTRINE §9.2
records seven times.

## WHAT I DID NOT DO

- **Did not arm, disarm, rename, move or delete any prompt**, and staged no `-HOLD`. The sweep
  produced no work that needed staging: F1 is a documentation correction to DOCTRINE (00's), and F2
  is a board repair that only 00 may perform. Staged-prompt budget used: **0 of 2**.
- **Did not repair F2 myself**, for the authority reason given above — and would not have even with
  the authority, because the deletion must land in the same PR as the arming-step change for option
  (A) to be complete.
- **Did not commit `sweep-rotation.json`.** Left dirty and named, per the station doc's explicit
  correction of the older "commit that file" instruction.
- **Did not run the other three sweeps** (`gate-liveness`, `repo-hygiene`, `instruction-drift`). One
  named sweep per run, covered completely, is the rule; F2 surfaced incidentally from the preflight
  `git status`, not from a shallow pass at `repo-hygiene`. `repo-hygiene` is due in two rotations and
  should re-check the depth-1 ready-file census then.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol)** beyond the board reads
  the sweep required. The turn budget went to the sweep, which is the station doc's stated priority
  over a shallow pass at everything.
- **Did not mint a throwaway worktree.** Everything was read from `origin/main` at the named SHA via
  `git show` / `ls-tree` / `diff --numstat`, per the 2026-08-24 supersession of the clean-worktree
  block.
- **Did not touch Azure, Entra or SharePoint**, and ran no `az` or `Connect-MgGraph`. No production
  data was read or written.
- **Did not clear or inspect any lock**, and ran no mutating script from the SCRIPT-REGISTRY's
  Station 00 or MARCO-ONLY sections.
