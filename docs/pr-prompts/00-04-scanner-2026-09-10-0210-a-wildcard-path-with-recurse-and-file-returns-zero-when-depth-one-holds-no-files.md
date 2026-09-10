# Station 04 — Scanner | 2026-09-10T02:10Z–2026-09-10T02:22Z

## GROUND

```
UTC            2026-09-10T02:10:54Z
origin/main    ed7dc38f            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ ed7dc38f     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (<!-- station_doc_version: 1 --> in the served SKILL.md)
```

Doc version and bootstrap AGREE — this run was not read-only-gated.

Sweep assigned by `node scripts/pipeline/next-sweep.mjs`: **instruction-drift** (rotation position
4 of 4; previous run 2026-09-09T22:02:58Z). Advanced with `--advance --utc 2026-09-10T02:10:54Z`
→ `last_index=3`. **`docs/pipeline/sweep-rotation.json` is LEFT DIRTY in the dev tree — Station 00
commits it; 04 may not.**

Read in full this run, all three from the dev tree where `HEAD == origin/main`:
`docs/pipeline/stations/04-scanner.md` (515 lines), `docs/pipeline/DOCTRINE.md` (1751 lines),
`docs/pipeline/STATION-CAPABILITIES.md` (485 lines). All three verified byte-identical to
`origin/main` by `git diff --numstat origin/main -- <the three paths>` → EMPTY output (the sound
form per §9.1; no piped hash was taken).

## WHAT I MEASURED

**Host reachable.** [MEASURED] `start_process` shell `powershell.exe` → PID 27696 live;
`$env:COMPUTERNAME` and `(Get-Date).ToUniversalTime()` answered. **This run was SIGHTED.** The first
`-Command` form of that probe lost `$env:COMPUTERNAME` to pre-expansion (§9.1) and was re-run through
`interact_with_process`, which does not expand.

**vm-git-guard NOT installed — [CANNOT MEASURE], and it is a finding not a stop (F4).** The station
contract requires quoting the installer's last line pass or fail. It produced none: two honest
attempts to reach the VM side returned an RPC mount failure before any command ran —
`source path ... is under Plan9 share "c" which is not mounted`, then the same on a second target
(`.auto-memory`). No `bash` ran at all this session, so no `git`-against-the-mount hazard could
arise; the guard's absence carries no risk *this* run.

**Board state.** `scripts/pipeline/status-sweep.ps1` captured to a FILE (it returns early and hides
its own §7 verdict): 388 lines, §7 reads
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
04 mutated nothing regardless.

**Station cadence collision, already on file — NOT re-raised.** scheduled-tasks MCP: `00-supervisor`
`lastRunAt 2026-09-10T02:08:50Z`, `04-scanner` `lastRunAt 2026-09-10T02:10:29Z` — **99 seconds
apart**, exactly as STATION-CAPABILITIES §6's 2026-09-07 correction predicts for every one of 04's
six daily runs. Landed already; recorded here only as a confirming sample.

**Corpus, taken the way the corrected rule requires** — every `SKILL.md` behind an ENABLED task in
the MCP, never "the five". Five enabled tasks: `00-supervisor`, `03-machine-minder`, `04-scanner`,
`05-sot-keeper`, `weekly-security-audit`.

`station_doc_version` parity, bootstrap vs the repo station doc it points at:

| task | bootstrap | station doc | verdict |
|---|---|---|---|
| `00-supervisor` | 1 | 1 | MATCH |
| `03-machine-minder` | 1 | 1 | MATCH |
| `04-scanner` | 1 | 1 | MATCH |
| `05-sot-keeper` | 1 | 1 | MATCH |
| `weekly-security-audit` | (none) | — | not a station, no doc — correct |

**No version drift on any layer.** Every repo-relative path named inside every one of the five
bootstraps resolves (6 · 6 · 6 · 6 · 1 paths, UNRESOLVABLE = 0).

**The bootstrap this run was SERVED is byte-identical to the governing on-disk file.** [MEASURED]
with node `Buffer.compare` (same side of the boundary, per §9.3): served
`…\local_3b81d66a…\uploads\SKILL.md` and `C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` are
both 5841 bytes, sha256/12 `20befa7d768f`, mtime `2026-09-01T00:07:44.740Z`, `Buffer.compare` → **0**.
The harness serves the true file; there is no serving-layer drift.

`node scripts/pipeline/lint-station.mjs` → **exit 0, `ADMIT: all 8 docs clean`**, plus
`ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`. Its `!` notes are all DOCTRINE's
own illustrative needles (`C:\\Foo\\Bar`, the doubled-backslash documentation instances, `r:\s`,
`C:\po-scan-`), not defects.

**Absolute-path resolution across DOCTRINE + STATION-CAPABILITIES + the four station docs**
(these are *not* gated by `lint-station.mjs`, which rejects untracked *repo* paths only): 28 distinct
`C:\…` paths, **25 resolve, 3 do not** — and all three are expected:
`C:\\Foo\\Bar` (§9.1's own broken-needle example), `C:\po-watcher\STOP-WATCHER` (§9.5 records it as
measured-absent), `C:\po-watcher\zzzNoSuchNeedleZzz` (a quoted negative control). **Zero real path
drift.** POSITIVE control: 25 paths resolved, including `C:\po-watcher\STOP-WATCHER-LANE2`, which
§9.5 says must be present — it is.

**A PowerShell mojibake reading was refused before it became a finding.** `Get-Content -Raw` on
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` rendered em-dashes as
`a-hat-euro`. Checked in node before believing it: **0** `U+FFFD`, **0** `\u00e2\u20ac` sequences,
**9** real `U+2014`. The file is clean UTF-8 and PowerShell was the liar — §9.3 / §7 trap #2,
firing live and caught by its own prescribed cure.

Fresh needle minted for this run: `zzQq04Needle20260910T0230` → 0 over every corpus searched.
It is spent the moment this file lands.

## WHAT CHANGED

**Nothing on the board.** 04 is read-only there: no prompt armed, disarmed, renamed or moved; no PR
merged, labelled or commented; no `sot/` edit; no tracked source file written.

Two writes, both permitted:

1. `docs/pipeline/sweep-rotation.json` — advanced by `next-sweep.mjs --advance`, **left dirty by
   design**. Station 00 commits it.
2. This breadcrumb, at a tracked path under `docs/pr-prompts/`. Untracked until 00 sweeps it up.

Scratch `.ps1`/`.mjs` probes were written to `C:\po-sup-fix-scripts\` and fixtures to
`C:\po-sup-fix-scripts\fx*-04-20260910\` — outside the repo, nothing tracked.

## FINDINGS

### F1 — `Get-ChildItem "<dir>\*" -Recurse -File` answers ZERO when depth 1 holds no files, and DOCTRINE §9.1 prescribes that form as a cure (S3)

**This bit this run, live, in its first probe.** Asking *"how many `SKILL.md` are under
`C:\Users\Marco\Claude\Scheduled`?"* the star form answered **0** where the truth is **11**. The
available conclusion was *"the bootstrap corpus shrank from 11 to 6"* — a confident, coherent, wrong
finding that would have retired a live escalation's own corpus. It was caught only because the
positive control (`allfiles`) also read 0 while node had just listed the files.

[MEASURED] 2026-09-10T02:2xZ at `ed7dc38f`, PS `5.1.26100.9444`, on `C:\Users\Marco\Claude\Scheduled`
(7 directories at depth 1, **0 files** at depth 1, 17 files and 11 `SKILL.md` in total):

| form | result | truth |
|---|---|---|
| `Get-ChildItem $sd -Recurse -File` | **17** | 17 |
| `Get-ChildItem "$sd\*" -Recurse -File` | **0** | 17 |
| `Get-ChildItem $sd -Recurse -Filter 'SKILL.md' -File` | **11** | 11 |
| `Get-ChildItem "$sd\*" -Recurse -Filter 'SKILL.md' -File` | **0** | 11 |
| `Get-ChildItem "$sd\*" -Recurse` (no `-File`) | **22** | — recursion itself works |
| `Get-ChildItem "$sd\*" -Directory` (no recurse) | **7** | 7 |

**Mechanism.** With a trailing `\*` the type filter is applied to the *wildcard-resolved depth-1 set*,
not to the recursed set. `Scheduled` has 7 directories and no files at depth 1, so `-File` empties the
set before recursion contributes anything — while the same command without `-File` recurses fine and
returns 22. No error, no warning, exit 0. There are no junctions or reparse points on the path
(checked: all three components read plain `Directory`).

**Why the existing falsifying probe cannot see it.** §9.1's 2026-09-07 correction names a fixture —
`top.log` + `sub\nested.log` + `sub\other.txt` — and a real directory, `scripts\pr-watcher`. I rebuilt
both. **The correction reproduces exactly as written and is not wrong**: on that fixture every form
agrees (bare and star both 2 of 2), and on `scripts\pr-watcher` bare and star both return **46**.
Both are blind to this case for the same structural reason — **each holds a matching file at depth 1**
(`pr-watcher` has 1 `.log` at depth 1). A second fixture identical except that its `.log` files live
only in `sub\` is the discriminator:

| fixture (truth: 2 `.log`) | bare `-Recurse -Filter -File` | star `-Recurse -Filter -File` | bare `-Recurse -File` | star `-Recurse -File` |
|---|---|---|---|---|
| A — `.log` present at depth 1 (the 09-07 fixture) | 2 | **2** | 3 | **3** |
| B — `.log` only deeper, no file at depth 1 | 2 | **0** | 3 | **0** |

**Blast radius, measured, and it is why this is S3 and not S2.** No shipped script uses the failing
form: `Select-String -Pattern '\\\*"?\s+-Recurse'` over all `.ps1` under `C:\ProjectOperations2\scripts`
→ **0 hits** (POSITIVE control `Get-ChildItem` → 24; NEGATIVE control, freshly minted needle → 0).
Nothing is broken in CI or in the watcher today. What is exposed is **every agent that follows the
prescribed cure by hand**, over exactly the container-shaped directories stations probe most —
`Scheduled\`, `docs/pr-prompts/<subdir>/`, `logs\` parents — and one of them was this run.
§9.5's log-selection cure is NOT affected: it is the depth-1 form with no `-Recurse`, which is correct.

**Suggested repair, RULE 1 both halves.** Complete-and-additive **first**: scope §9.1's "or put the
wildcard in the path" cure to the no-`-Recurse` form it was measured for, and state the `-Recurse`
rule positively — **use the bare directory with `-Recurse` and `-Filter`; never combine a trailing
`\*` with `-Recurse` and a type filter** — then replace the falsifying fixture with the two-fixture
pair above, since a single fixture holding a depth-1 match cannot fail. Nothing any run has already
measured is invalidated and no data entry is touched. The alternatives both fail a half: renumbering
or footnoting the existing fixture fails "solves it completely for the future" (the fixture stays
structurally blind, and the next reader rebuilds it and is reassured); deleting the wildcard cure
outright fails "without damaging", since it is correct and load-bearing for the depth-1 `-Include`
trap it was written for.

**DISPOSITION: DISPATCHED** — to Station 00, as a `docs/pipeline/DOCTRINE.md` §9.1 edit. It is a
docs-only change inside 00's recorded lane; 04 may not open a PR. The falsifying probe is the
two-fixture table above: rebuild both and run all four forms. If fixture B's star column ever returns
2 and 3, this finding is wrong and must be re-measured.

### F2 — the `.gitignore:107-111` escalation is STILL LIVE, four days on, numbers unchanged (S3)

Re-verified rather than re-filed. All **five** bootstraps (`00-supervisor`, `02-board-driver`,
`03-machine-minder`, `04-scanner`, `05-sot-keeper`) still cite `.gitignore:107-111` for the five
gitignored Overnight-QA sinks. [MEASURED] at `ed7dc38f`, `.gitignore` is 151 lines and `:107-111`
holds `!Claude Design/docs/`, `!Claude Design/assets/`, `Claude Design/assets/*`,
`!Claude Design/assets/routes.js`, `!Claude Design/proposed/`. The `# Overnight-QA scheduled task`
comment is at `:113` and the five sinks at **`:115-119`** — off by exactly 8, precisely as
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` records. Nothing has moved
since it was filed.

POSITIVE control that the instrument is sound, not merely pessimistic: the *other* citation in the
same bootstraps, `.gitignore:76-83`, is **correct** — those eight lines are exactly
`docs/pr-prompts/{processed,failed,paused,blocked,awaiting-review,reviewed,needs-marco,no-pr-opened}/`.
So the probe distinguishes a right citation from a wrong one.

The repo half is already fixed — my own station doc names the `# Overnight-QA scheduled task`
**comment** rather than a line number, which is the drift-proof form. Only the five pasted bootstraps
are stale, and that is the one layer no agent may edit.

**DISPOSITION: ESCALATED** — already open with Marco in the file named above, item 1, with the exact
replacement text ready to paste. **Do NOT re-raise it as a new finding**; this entry exists so the
next run can see it survived its own falsifying probe on 2026-09-10 rather than re-deriving it.

### F3 — STATION-CAPABILITIES §1's bootstrap-batch timestamp has gone stale a second time (S4)

The paragraph reads *"all five bootstraps were rewritten in ONE batch at `2026-08-24T22:54:22Z`"*.
[MEASURED] this run: all five station bootstraps carry mtime **`2026-09-01T00:07:44.73–.74Z`** (a
single batch, ~10 ms apart); `weekly-security-audit` is `2026-08-17T06:37:17Z`. The quoted figure is
nine days stale.

It is S4 and not higher because the same paragraph already tells the reader **"Measure a bootstrap's
currency — never quote this file for it"** and supplies the command, so the rule protects anyone who
follows it. The figure is offered as a dated worked example of staleness — and has now become a second
instance of itself.

**Suggested repair, RULE 1:** complete-and-additive is to **delete the timestamp** and keep the
worked example's *shape* plus the measuring command. Renumbering it fails the "future" half — it
restarts the same clock, and this is the second rotation.

**DISPOSITION: DEFERRED** — real, not urgent, and cheap to fold into any later
`STATION-CAPABILITIES.md` edit rather than spending a PR on it. It becomes urgent if any run is ever
found quoting the figure instead of measuring.

### F4 — the VM side was unreachable all run, so `vm-git-guard.sh` could not be installed (S3, environmental)

Two honest attempts, both failing before any command executed, with different mount targets and the
same root cause: `RPC error -1: failed to mount … under Plan9 share "c" which is not mounted`, plus
`ensure user: user nifty-epic-mendel already exists unexpectedly`. Per the station contract a failed
install is a FINDING and not a STOP, and the run continued on Desktop Commander, which is the
transport that matters.

**No hazard was created.** The guard exists to stop `git` running against a mounted folder; with no
VM side at all, no such call was possible this run. The cost is narrower and worth naming: the
mount is also the *blind-run* COLLECT path described in STATION-CAPABILITIES §3, so a run that lost
Desktop Commander **and** the mount in the same session would have no transport at all — and the
two failures are independent today, which is the only reason that is not already the case.

**DISPOSITION: DEFERRED** — it is a Cowork/VM infrastructure fault, not a repo defect, and there is
nothing in the repo to fix. It becomes a DISPATCH to 03 if it recurs on the next scanner run; one
occurrence is not yet a pattern, and 03 cannot repair the Plan9 share either.

## WHAT I DID NOT DO

- **Armed, disarmed, renamed or moved nothing.** 04 arms nothing, ever; and the board read
  SAFE TO ACT regardless, so no arming was blocked — it was simply not mine.
- **Staged no `-HOLD` prompt.** F1 is a DOCTRINE §9.1 edit inside Station 00's own docs lane, and
  §10.6 plus this station's own budget both argue against staging a prompt for work whose owner is
  already identified and can land it directly. F2 is Marco's paste. Neither wants a prompt.
- **Committed nothing**, including `sweep-rotation.json` — named above for 00. The dev tree's index
  is shared between chats and 04 has no commit authority on `main`.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station doc
  gives one named sweep per run and instructs covering it completely rather than making a shallow
  pass over everything; instruction-drift was the assigned sweep and F1 alone consumed most of the
  budget. The `github-projectops` MCP was also unavailable this session (`Authorization header is
  badly formatted`), so Part 1 would have been `[CANNOT MEASURE]` on its primary instrument.
- **Did not clear the `[STALE]` line or the orphaned worktree** `C:/po-worktrees/docs-verdict-anchor`
  that `status-sweep.ps1` reported. Both are 03's or 00's; 04 reports and does not repair machines.
- **Did not touch Azure, Entra or SharePoint**, and had no reason to go near them.
