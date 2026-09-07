# Station 04 — Scanner | 2026-09-07T22:10Z–2026-09-07T22:26Z

## GROUND

```
UTC            2026-09-07T22:10Z
origin/main    0eca4c55   (measurement SHA; fetched, then rev-parse)
               9be865ec   (tree fast-forwarded mid-run — see below; NO measured subject file changed)
dev tree       main @ 0eca4c55 -> 9be865ec   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only on that account.

**SIGHTED.** `start_process` (shell `powershell.exe`) succeeded on the first call after loading the
Desktop Commander schemas via `ToolSearch`. This was a healthy run, not a quiet blind one.

**Device-bridge git guard, last line quoted as the contract requires** —
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**Mid-run fast-forward.** `origin/main` moved `0eca4c55` -> `9be865ec` while this run was executing.
[MEASURED] `git log --oneline 0eca4c55..9be865ec` = exactly one commit, `#1793`
(00's 22:09 collect breadcrumb), touching two files, both under `docs/pr-prompts/`.
`git diff --numstat 0eca4c55 9be865ec --` over every file this run measured
(`DOCTRINE.md`, `STATION-CAPABILITIES.md`, `lint-prompt.mjs`, `check-breadcrumb.mjs`,
`index.mjs`, `.arming-log.txt`) returned **EMPTY**. Every reading below therefore holds at both SHAs.

**Sweep taken this run: `instrument-honesty`** (rotation position 2 of 4), from
`node scripts/pipeline/next-sweep.mjs`. Not chosen — read from `docs/pipeline/sweep-rotation.json`.

**Board, from `scripts/pipeline/status-sweep.ps1` at 22:12:23Z, `[LIVE]` lines only.** Verdict
**SAFE TO ACT**; instrument positive controls both passed. Open PRs **2** — `#1775` and `#1767`,
both 13 pass / 2 fail, both carrying `do-not-merge`. Both reds are the one CP-26 cause (see the
measured verdict token below): **parked by design, not work.** main CI on `0eca4c55` 4 success /
0 failed — trunk green. armed `0`. Watcher node RUNNING pid 31660. This station mutated nothing on
the board.

**Fresh needle minted for this run, now spent by appearing here: `zzQq04N20260907T2220`.**
Every negative control below used it and returned 0.

## WHAT I MEASURED

**Seventeen section 9 / section 10.1 claims were re-probed against the corpus each bullet names —
never against DOCTRINE itself, per section 9.6's 2026-09-07 rule. SIXTEEN REPRODUCED EXACTLY. ZERO
FAILED TO REPRODUCE. One stated CONTROL VALUE has gone stale (F2); the rule it belongs to is
untouched.** PS `5.1.26100.9168`, gh authenticated as GH-Mantova. Probe scripts left at
`C:\po-sup-fix-scripts\probe-04-instruments.ps1`, `probe-04-git-gh.ps1`, `probe-04-logs2.ps1`,
`probe-04-node.mjs`, `probe-04-node2.mjs`.

| # | section 9 claim | probe result | verdict |
|---|---|---|---|
| A | 9.3 `Measure-Object -Line` drops blank lines | `.Count` 2368 · `-Line` **2207** · blank 161 · gap==blank **True** | [MEASURED] REPRODUCES |
| B | 9.4 `@(ConvertFrom-Json …).Count` collapses | inline `[]`->**1**, 4-elem->**1**; assign-then-count -> **0** and **4** | [MEASURED] REPRODUCES |
| C | 9.3 `-SimpleMatch` + `[regex]::Escape()` | dotted ESCAPED **0** vs RAW **2**; dotless ESCAPED **7** == RAW **7**; NEG 0 | [MEASURED] REPRODUCES, incl. "only dotless controls pass" |
| D | 9.1 single-quoted `\\` needle vs the enabled-task bootstraps | broken needle **0**, working needle **3**, on all four station bootstraps | [MEASURED] REPRODUCES |
| E | 9.1 `-Include` fixture table (the 09-07T06:22Z correction) | fixture WITH `-Recurse` bare **2** = star **2** = truth 2; WITHOUT `-Recurse` bare **0** vs star **1**; `C:\po-watcher` no-recurse bare **0** vs star **7**; real dir with `-Recurse` **31**/**31** | [MEASURED] REPRODUCES — correction's scoping to the depth-1 form is exactly right |
| F | 9.5 STOP-WATCHER sentinels | `C:\po-watcher\STOP-WATCHER-LANE2` present **1090 B**; `STOP-WATCHER` **absent**; pathless search of the dev tree **0**; NEG 0 | [MEASURED] REPRODUCES, incl. the false-negative the pathless probe gives |
| G | 9.3 PowerShell `>` writes UTF-16LE | 11-char payload -> **28 bytes**, first two `255,254` | [MEASURED] REPRODUCES — and hit live: the `status-sweep.ps1` capture came back UTF-16LE and had to be decoded |
| H | 9.2 `ls-tree` depth semantics | no slash **1** · trailing slash **56** · `superseded` without `-r` **1** · with `-r` **355** | [MEASURED] REPRODUCES |
| I | 9.2 `ls-tree` has no glob pathspec | `'…/*.md'` -> **0** with `-r` and **0** without; POS literal prefix **56**; `:(glob)` -> **exit 128**, `pathspec magic not supported` | [MEASURED] REPRODUCES, incl. "`-r` never rescues a zero-result glob" |
| J | 9.2 `check-ignore -v` on a directory | dir exit **1** empty · tracked `CLAUDE.md` exit **1** empty · file inside exit **0** `.gitignore:76` | [MEASURED] REPRODUCES — opposite truths, byte-identical results |
| K | 9.2 `branch -r` is not the remote | `git branch -r` **25** vs `git ls-remote --heads origin` **12**; **12** non-origin refs no refspec owns (`pr/1477…pr/1760`, `pr1273`) | [MEASURED] REPRODUCES; the unowned-ref count has grown 5 -> 12 since 2026-09-03 |
| L | 9.4 `gh run list --commit <short>` | short `0eca4c55` -> **0 runs**, exit 0, no warning; full 40-char SHA -> **4 runs** | [MEASURED] REPRODUCES |
| M | 9.4 `merged` on a LIST response (via `gh api`) | 10 entries · `merged===true` on **0** · `merged` key **defined on 0** (absent, as the 09-07 correction says for this transport) · `merged_at` populated **10/10** · POS single GET `/pulls/1792` -> `merged=True` | [MEASURED] REPRODUCES, transport-specific shape and all |
| N | 9.1 `gh run view --job --log` three tab columns | `#1767` CP-26 job `101868343358`: **218** lines, **3** tab columns, col 1 = `Approval receipt (CP-26)`; whole-line grep `CP-26` -> **218 of 218**; last-column grep -> **2**; POS body needle `approval` -> 7; NEG 0 | [MEASURED] REPRODUCES — landed only four hours earlier and already confirmed independently |
| O | 9.3 `String.replace()` `$` substitution injection | correctly-shaped case: expected 191, `viaString` **329** (**+138 spilled**), prefix occurrences **20 -> 40**; function replacer and concatenation both **DELTA 0**; read-backs `old_gone=true` and `NEG=false` **both passed on the corrupted string** | [MEASURED] REPRODUCES — see the method note below |
| P | 9.5 `lint-prompt.mjs` three arming markers | `DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i` · `DO_NOT_ARM_CAPS = /DO NOT ARM/` · `ARM_ONLY = /Arm ONLY/i` | [MEASURED] REPRODUCES — two case-INSENSITIVE, one case-sensitive, exactly as corrected 2026-09-06 |
| Q | 10.1 `NESTED_TEST_PATHS` three forms | array present with all three regexes verbatim; POS `classifyPolicyFiles` **2**; NEG 0 | [MEASURED] REPRODUCES — section 10.1's own falsifying probe passes |
| T | 9.3 length comparison across the git-show boundary | working copy String **151617** vs Buffer **152237** (delta **620**, non-ASCII); `git show` String **148008**, delta vs working-copy string **3609** = the file's LF count **3609** exactly; sound forms agree — `rev-parse` == `hash-object` (`a40dd39043eb`), `--numstat` **EMPTY** | [MEASURED] REPRODUCES, both stacked errors, with their documented magnitudes |

**Anchors held across 545 lines of drift.** `lint-prompt.mjs` is now **2369** lines against the
**1824** recorded when section 9.5 converted its citations from line numbers to symbols on
2026-09-04. All eight symbol anchors resolved (`DO_NOT_ARM_COMMENT =`, `DO_NOT_ARM_CAPS =`,
`ARM_ONLY =`, `LINT_GH_BIN`, `function readFromOriginMain`, `ghFetchPrState`,
`checkFixesPrTargetOpen`, `HUMAN_GATE_PRESENT: line`), as did all five in `index.mjs`
(`const MERGE_TIMEOUT_MS`, `const allGreen`, `async function waitForPolicyMerge`,
`runVerdictArchiveSweep`, `VERDICT_HOME_RESOLVER` -> 6) and all four in `check-breadcrumb.mjs`.
**That is the section 9.5 cure working, measured against a 30% file growth.** [MEASURED]

**CP-26 verdict token, pulled from column 3 as section 9.4 prescribes** —
`#1767`, run `34162955133`, job `Approval receipt (CP-26)`:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
(escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` = **parked, nothing to do, no agent-side action.** Only Marco removes the label.
The same check runs twice (required check + a step inside `PR gates — diff checks`), which is why
`#1767` and `#1775` each read 2 fails from 1 cause. [MEASURED]

**`.arming-log.txt` — the gap is CLOSED right now.** Tracked (`ls-files --error-unmatch` exit **0**;
NEG on a nonexistent path exit **1**). `origin/main` **65** lines, working copy **65** lines,
`git diff --numstat origin/main --` **EMPTY**; last row
`2026-09-07T07:20:53Z ARMED pr-triageholds-s2-env-os-is-empty-in-a-station-shell … by=Marco@LAPTOP-E6NHU4E4 pid=12928`.
Section 9.5's own falsifying probe run and both halves agree. **The defect behind it is untouched —
nothing commits the log on purpose** — so this is luck, not a fix. [MEASURED]

**Bootstrap corpus.** `C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md` files against 5
enabled tasks — STATION-CAPABILITIES section 1's 2026-09-07 correction confirmed. `weekly-security-audit`'s
bootstrap names `C:\ProjectOperations2\docs\pipeline` **zero** times, against 3 for each of the four
station bootstraps: consistent with it not being a station. [MEASURED]

**Method note — two of my own instruments were wrong, and I am reporting both rather than their
output.** (i) My first probe of the section 9.3 `$`-replacement trap put a `/` between the `$` and the
closing backtick, so no substitution token existed; it returned DELTA 0 and the available conclusion
was *"the injection does not reproduce"* — a confident, coherent, wrong retirement of a live rule
about the document every station trusts. Re-run with the exact shape the bullet names, it injected
138 bytes. **The bullet was right; my probe was not.** (ii) My `docs/pr-reviews` probe used
`foreach ($home in …)`, which is F5 below. Neither wrong reading is quoted above.

## WHAT CHANGED

**On the board: NOTHING.** Station 04 is read-only there. No merge, no label, no arm, no disarm, no
rename, no move, no delete, no PR. `git status` in the dev tree shows only untracked files plus the
one modified rotation file named below.

Three writes, all outside the board:

1. **`docs/pipeline/sweep-rotation.json` — MODIFIED, LEFT DIRTY DELIBERATELY.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-07T22:12:23Z` ->
   `advanced: last_index=1 last_run_utc=2026-09-07T22:12:23Z`, exit 0. Read back:
   `git diff --numstat origin/main --` = `2 2`. **Station 00 must commit this** — 04 may not commit
   to the shared dev tree, and if it is not committed the next run repeats this sweep and the
   rotation stops.
2. **`docs/pr-prompts/pr-doctrine-s9-powershell-readonly-automatic-variables-HOLD.md` — STAGED, `-HOLD`, UNTRACKED.**
   Read back: `node scripts/pipeline/lint-prompt.mjs` -> **`ADMIT` (size 2), exit 0**, with the
   positive control (`pr-524-rates-b-slice2-canonical-HOLD.md`) correctly returning
   `HUMAN_GATE_PRESENT` at exit 1, proving the linter was answering. **It is not real until it is
   committed** (PROMPT-SCHEMA). 1 of my 2-prompt budget used.
3. This breadcrumb, untracked at a tracked path in the dev tree.

## FINDINGS

### F1 — `supervisor.log` is now the NEWEST file in the watcher log directory, so the superseded "newest by mtime" cure now fails with its own positive control at zero. S3.

Section 9.5's 2026-09-07T06:3xZ correction measured `supervisor.log` as **second**-newest by 45
minutes and warned that *"any gap wider than that margin … makes it the newest"*. **The margin is
gone and the sign has flipped.** [MEASURED] 2026-09-07T22:19Z over
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs` — **44** `*.log`, **5** of them not daily
logs:

| file | `LastWriteTimeUtc` | bytes | `opened PR #` | `[merge]` (POS) | NEG |
|---|---|---|---|---|---|
| **`supervisor.log`** | **22:19:05Z** | 682,771 | **0** | **0** | 0 |
| `2026-09-07.log` | 22:18:48Z | 120,714 | **3** | **7** | 0 |
| `2026-09-06.log` | 2026-09-06T23:04:05Z | 145,258 | 5 | 11 | 0 |

Newest-by-mtime now selects `supervisor.log`, which answers `opened PR #` -> 0 **and whose own
positive control also returns 0** — the reader gets every count zero with nothing warning. The
name-shape filter selects `2026-09-07.log` and works. The prescribed cure is already on `main` and
is correct; what is new is that its predicted failure condition has **arrived**, and it arrived
without any of the three triggers the bullet names (no relaunch, no kill-loop pause, no name roll) —
`supervisor.log` is simply being written continuously and outpaced the daily log by 17 seconds.

Also measured, and it inverts the 09-06T23:0xZ table's polarity: constructing the name in **UTC**
today yields `2026-09-07.log`, which **exists and is live**; constructing it in **LOCAL** yields
`2026-09-08.log`, which **does not exist at all**. Current UTC 22:19Z sits inside the 14:00Z–23:59Z
window where the Brisbane date leads. Which clock is "right" has flipped since 09-06 — which is the
whole point of *never construct the name, only validate it*.

**No DOCTRINE edit is proposed.** The cure is already written and correct, and section 9.5's own rule
is that instructions live there and state does not. This is a record, not a doc change.

**DISPATCHED** -> Station 00: record that the name-shape filter is now load-bearing rather than
precautionary, and that any run still using bare newest-by-mtime is reading a log with no lane
information and a failing positive control.

### F2 — section 9.5's stated control for the `LINT_GH_BIN` bullet has gone stale: "exactly one hit" is now two. S4.

That bullet closes *"re-measured by 00 the same hour — `Select-String LINT_GH_BIN` returns exactly
one hit."* [MEASURED] at `0eca4c55` against `origin/main:scripts/pipeline/lint-prompt.mjs`:
**2 occurrences on 2 distinct lines** — `:1450`, a comment (*"LINT_GH_BIN. There is deliberately NO
env switch that turns the gate off"*), and `:1749`, the live
`const gh = process.env.LINT_GH_BIN || "gh";`. NEG needle 0.

**The bullet's conclusion is unchanged and is now better supported** — `gh` is not absent from the
file and a `fixes_pr` verdict does depend on it. What has rotted is a **count**, i.e. state, written
into an instruction document: a run that re-runs the named control and gets 2 can read the
parenthetical as refuted and go looking for a defect that is not there. This is precisely the
failure section 9.5's own closing bullet records, occurring inside section 9.5.

**DISPATCHED** -> Station 00, with the fix already authored as work item 2 of the staged `-HOLD`
named under WHAT CHANGED: **delete the count, keep the anchor** — do not substitute today's number,
which only resets the same clock.

### F3 — the `docs/pr-reviews/` leader is the verdicts-archive today: a third distinct leader in three days. S3.

[MEASURED] 2026-09-07T22:2xZ, all three homes, NEG control 0:

| home | files | newest | mtime |
|---|---|---|---|
| dev tree `C:\ProjectOperations2\docs\pr-reviews` | 106 | `pr-1758-review.md` | 05:17:11Z |
| clone `C:\po-watcher\ProjectOperations\docs\pr-reviews` | 61 | `pr-1775-review.md` | 09:15:32Z |
| **`C:\po-watcher\verdicts-archive`** | **623** | **`pr-1791-review.md`** | **20:25:07Z** |

A run following the ORIGINAL (superseded) direction — read the clone — concludes the review lane
stopped at 09:15Z, 13.1 h ago. A run following the FIRST correction's observation that the dev tree
led on 09-05 concludes it stopped at 05:17Z, 17.0 h ago. Both are false: `pr-1791-review.md` was
produced at 20:25Z. **Only "probe all three, take the newest" survives**, and the residual sentence
that `verdicts-archive` *"is not a tiebreaker either"* is today's leader by 11 h.

Consistent with the open S1 already on file — the mirror step reads one tree while the review job
writes another, and the archive sweep races it. This adds a third observed leader to that record.

**DISPATCHED** -> Station 00, to fold into the existing verdict-mirror S1 rather than open a new one.

### F4 — `check-breadcrumb.mjs` still carries `CADENCE['00'] = 2`; the one-character fix has NOT landed. S3.

[MEASURED] at `0eca4c55`, anchor `const CADENCE =`, NEG needle 0:
`const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };`

STATION-CAPABILITIES section 6 says this fix has not landed and instructs the reader not to assume it
has; its own falsifying probe is that declaration line. **Re-run today, it still reads 2.** So
`--freshness` — the probe the COLLECT step starts with — will not call `00` SILENT until 4 h, i.e.
only after **three** consecutive missed hourly runs, and it is weak in escalation #23's exact
direction. `'03': 24` and `'04': 4` still match their live crons; `00` remains the only wrong row.

Fully covered by the open escalation
`docs/pr-prompts/needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`,
which names this line and this value and asks Marco for the alarm threshold. **I am not duplicating
it, and I am not staging a prompt for it:** it is a `scripts/` change, so it lands outside the
`tests-docs` lane and outside 00's merge lane, and the threshold question is Marco's, not mine.

**DEFERRED** — real, already escalated, not mine to fix. What would make it urgent: `00` missing two
consecutive hourly runs while `--freshness` still reads `ok`.

### F5 — NEW section 9.1 candidate: a PowerShell read-only automatic variable voids the loop that binds it, and the script still exits 0. S3.

Hit live, in this run's own probe script. `foreach ($home in @(<three review homes>))` threw
`SessionStateUnauthorizedAccessException: Cannot overwrite variable HOME because it is read-only or
constant` — **once, into the error stream** — and the loop body **never executed**. The script
completed and the section printed nothing. The available conclusion from the surviving output was
*"all three review homes are empty"*; measured the same minute, they held **106, 61 and 623** files.

This is section 9.6's shape, one layer deeper than the usual case: not an empty result read as an
empty world, but a **loop that never ran, indistinguishable in the output from a loop over an empty
collection**. Section 7's standing guard 5 covers the same root cause — PowerShell variable names are
case-insensitive, so `$home` collides with `$HOME` — but guard 5 is worded *"no single-letter
variables"*, which does not reach a descriptive lowercase name. A reader obeying guard 5 to the
letter still writes this bug. [MEASURED] DOCTRINE currently contains **0** occurrences of
`automatic variable` (POS control `single-letter` -> 1, NEG needle -> 0), so it is genuinely absent
rather than restated elsewhere.

**DISPATCHED** -> Station 00, with the work already authored: the staged `-HOLD` adds one section 9.1
bullet carrying the marker `AUTOMATIC_VARIABLE_ASSIGNMENT_V1`, its named falsifying probe
(`foreach` over `@(1,2,3)` binding `$home` — if it prints `1 2 3`, the bullet is wrong), and the cure
(pick a non-automatic name; control any `foreach` that yields no rows against an input you know is
non-empty). It also carries F2's correction and the required
`node scripts/pipeline/lint-station.mjs --write-canonical` re-record, since both edits fall inside
the hash-gated `instruments` block — one document, not seven.

⚠️ **Relevant to 00's own 22:09 finding, merged as `#1793` three minutes before this sweep started:
"no HOLD on the whole board can enter the tests-docs lane."** This prompt's `scope` is
`docs/pipeline/DOCTRINE.md` + `docs/pipeline/stations/_canonical-blocks.json` — both under `docs/`,
so it satisfies the first `NESTED_TEST_PATHS` form and **is** eligible for that lane. It is supply
for the starvation 00 just reported. I am not arming it; arming is 00's, on Marco's authority.

## WHAT I DID NOT DO

- **Arm, disarm, rename, move or delete any prompt.** The staged file is `-HOLD` and untracked.
  Note that being `ADMIT` is necessary and not sufficient, and that a `-HOLD` staged by a
  second-lane-style actor is not consumed by anything until a PR merges it.
- **Commit anything.** `sweep-rotation.json`, the staged `-HOLD` and this breadcrumb are all left for
  Station 00 to sweep up. The dev-tree index is shared between concurrent chats and I added nothing
  to it.
- **Mint a throwaway worktree.** All `origin/main` reads used `git show` / `rev-parse` / `--numstat`
  in the dev tree, per the standing prohibition on orphaned worktree locks.
- **Run `git` from the VM against the Windows `.git`.** The guard was installed first and every git
  call went through Desktop Commander. The one VM-side command that touched the repo was a read of
  file bytes.
- **Compare a piped hash.** `git show <ref>:<path> | git hash-object --stdin` is unsound in
  PowerShell; I used `rev-parse` vs `hash-object` and `--numstat`, and quoted which.
- **Parts 0, 1 and 2 of the station brief** (static cross-layer audit, GitHub reconciliation,
  live-site visual patrol). The authority section says take ONE named sweep per run and cover it
  completely; the rotation named `instrument-honesty` and this run spent its budget there. The next
  rotation position is 3 of 4.
- **Touch `C:\po-vg`.** The sweep flags it as an orphaned worktree, 5179 min old, holding 1
  uncommitted file. Worktree repair is Station 03's and it is already escalated; `--force` would
  discard the file.
- **Act on `#1775` or `#1767`.** Both carry `do-not-merge`; only Marco removes it, and their reds are
  the CP-26 `[LABEL_PRESENT]` verdict, which means parked, not broken.
- **Azure / Entra / SharePoint:** not touched, not read-modify-write, not once.
