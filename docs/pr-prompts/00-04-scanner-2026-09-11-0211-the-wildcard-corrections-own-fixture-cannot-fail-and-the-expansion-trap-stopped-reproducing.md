# Station 04 — Scanner | 2026-09-11T02:11:09Z–2026-09-11T02:4xZ

Sweep this run: **instrument-honesty** (rotation position 2 of 4), assigned by
`node scripts/pipeline/next-sweep.mjs`. Advanced with
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-11T02:11:09Z` → `advanced: last_index=1`.
**`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN THE DEV TREE (`2 2` vs origin/main) — Station 00
must commit it; 04 may not.** This breadcrumb is likewise untracked until a board PR sweeps it up.

Fresh negative needle minted for this run: `zzQq04Needle20260911T0213` — **now spent, never reusable.**

## GROUND

```
UTC            2026-09-11T02:11:09Z
origin/main    ec7dd590            (fetched, then rev-parse; 922b0f2e at 02:11Z, main moved mid-run)
dev tree       main @ ec7dd590     C:\ProjectOperations2   (0 ahead, 0 behind at 02:13Z)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only-by-mismatch.
All three binding documents were read in full from `git show origin/main:<path>` **in the dev tree**,
dumped via `cmd /c` redirection (never PowerShell `>`, §9.3). `git diff --numstat 922b0f2e ec7dd590`
over the three returned EMPTY, so the readings stand at `ec7dd590`; the only files main gained in that
window were `docs/decisions/merge-approvals/1852.md` and `scripts/pipeline/status-sweep.ps1`.

⚠️ **The dev tree was fast-forwarded by another actor DURING this run.** At 02:11Z
`rev-parse --short HEAD` = `2d31827d` and `origin/main` = `922b0f2e`; at 02:13Z both read `ec7dd590`.
Station 00's hourly slot is `:05`. No conflict resulted — 04 mutates nothing — but every reading below
is stamped at `ec7dd590` for that reason.

**VM-git-guard: NOT INSTALLED — a FINDING, not a stop (F7).**

## WHAT I MEASURED

Platform: PowerShell `5.1.26100.9444`, node `v24.14.1`, `gh 2.90.0`, Desktop Commander shell reached
on the first `start_process` after one `ToolSearch` load. `status-sweep.ps1` captured to a file and
decoded `utf16le`; verdict **SAFE TO ACT**, section 0 controls both `[LIVE]` pass, no `[BROKEN]`.
Board at 02:12Z: 4 open (`#1870 #1868 #1865 #1823`), all CI-green, armed **0**.
`main CI on ec7dd590: 0 success / 0 failed / 4 running` → the sweep itself says `[CANNOT MEASURE]`,
**not** a green trunk.

### §9 traps re-run against the corpus each bullet names (never against §9 itself, §9.6 closing rule)

| § | trap | probe | result | verdict |
|---|---|---|---|---|
| 9.1 | `-Include` on a bare dir, no `-Recurse` | fixture A, truth 1 at depth 1 | bare **0** / star **1** | **REPRODUCES** |
| 9.1 | `\*` + `-Recurse` + type filter | fixture pair A/B *as prescribed* | B star = **2** and **3** | **DOES NOT REPRODUCE — F1** |
| 9.1 | same, fixture C (zero FILES at depth 1) | truth 2 `.log` / 3 files | bare 2/3, star **0/0**, star-no-type **3** | **REPRODUCES — F1** |
| 9.1 | `$` expanded by the `-Command` layer | `$CTRL=42` through `start_process` | `CTRL-literal-is:42` | **DOES NOT REPRODUCE — F2** |
| 9.1 | automatic-variable loop target | `-Command 'foreach ($home in @(1,2,3))'` | `Cannot overwrite variable HOME…`, 0 rows; POS `$loopVar` → 3 | **REPRODUCES** |
| 9.1 | single-quoted `\\` needle vs a Windows path | the 04-scanner bootstrap | broken **0** / working **3** | **REPRODUCES** |
| 9.1 | `gh run view --log` is 3 tab columns | 3 jobs of one real run | whole-line 196/2764/209 vs last-col **3/1/1**; col1 === job name on 196 of 196 | **REPRODUCES** |
| 9.2 | `ls-tree` depth without a trailing slash | `docs/pr-prompts` | no-slash **1**, slash **55**, slash+`-r` **1130** | **REPRODUCES** |
| 9.2 | `ls-tree` has no glob pathspec | `'docs/pr-prompts/*.md'` | **0** with and without `-r`; POS literal prefix + PS filter **1127**; `:(glob)` fails loudly | **REPRODUCES** |
| 9.2 | `check-ignore -v` on a directory | `docs/pr-prompts/processed` | DIR exit 1 empty · `CLAUDE.md` exit 1 empty · a file inside → exit 0 `.gitignore:76` | **REPRODUCES** |
| 9.2 | `branch -r` is not the remote | after `fetch --prune` | **38** vs `ls-remote --heads` **14**; 24 refs no refspec owns | **REPRODUCES — F5** |
| 9.3 | `>` / `*>` write UTF-16LE | `status-sweep.ps1 *> file` | 141,604 B opening `FF FE`, decoded `utf16le` → 413 lines | **REPRODUCES** |
| 9.3 | piped hash is unsound in PowerShell | `DOCTRINE.md` | PS pipe `29d0aed8` vs true blob `ff560824`; `cmd /c` pipe `ff560824` | **REPRODUCES** |
| 9.3 | `Measure-Object -Line` drops blanks | `lint-prompt.mjs` | `-Line` **2282** vs `.Count` **2444**; node LF 2445, blank 163 | **REPRODUCES** |
| 9.3 | `\s*\n` front-matter parser on CRLF | the 41 depth-1 `-HOLD.md` | 40 of 41 CRLF; broken regex **1**, CRLF-explicit **41** | **REPRODUCES** |
| 9.4 | `@($null).Count` is 1 | `ConvertFrom-Json ""` | `$null`, `@(…).Count` **1**, guarded **0**; `@('[]').Count` **1** | **REPRODUCES — F6** |
| 9.4 | `--json number` fabricates a row | `gh pr view 999999` | `--json number` exit **0** `{"number":999999}`; `number,state` exit 1 GraphQL; POS `1823` → OPEN | **REPRODUCES** |
| 9.4 | `gh` infers the repo from CWD | 4-row table | non-repo/no-`-R` exit **1**, **0** chars; other three exit 0, 65 chars | **REPRODUCES** |
| 9.4 | `merged` on a LIST response | `gh api /pulls?state=closed&per_page=10` | key **defined on 0 of 10**, `merged_at` on **9 of 10**; POS single GET `/pulls/1872` → `merged=true` | **REPRODUCES** (the 09-07 transport correction holds) |
| 9.5 | three arming markers, by anchor | `lint-prompt.mjs` @ origin/main | `ARM_ONLY := /Arm ONLY/i` · `DO_NOT_ARM_CAPS := /DO NOT ARM/` · `DO_NOT_ARM_COMMENT := /<!--\s*watcher:\s*do-not-arm\s*-->/i`; `checkHumanGate` 1, `stripCodeContext(bodyText)` 1, `HUMAN_GATE_PRESENT: line` 3; NEG 0 | **REPRODUCES** — two of three case-INSENSITIVE, as corrected 09-06 |
| 9.5 | anchor scoping across the ten docs | raw `file:NNN` extraction | **7** raw citations, all in `DOCTRINE.md`; 03 → 0, 05 → 0 | **CLAUSE HOLDS, PROBE MISLEADS — F4** |
| 10.1 | `NESTED_TEST_PATHS` is three forms | `index.mjs` @ origin/main | all three present verbatim; `classifyPolicyFiles` 2, NEG 0 | **REPRODUCES** — paragraph stands |
| 10.1 | `extractPrNumber` scrapes prose | `index.mjs` @ origin/main | both alternatives present verbatim, incl. `(?:PR\|pr\|pull request)\s*#(\d+)` | **TRAP LIVE** — the 09-11 bullet's probe passes |
| 9.5 | `STOP-WATCHER` path is load-bearing | the two repo roots + the parent | lane2 present **1090 B** in `C:\po-watcher`; `STOP-WATCHER` absent; `STOP-WATCHER*` at dev-tree root **0**, clone root **0**, parent **1** | **REPRODUCES** exactly |
| caps §6 | `check-breadcrumb.mjs` CADENCE | `const CADENCE =` | `{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }` at line 36 | **STILL WRONG — F3** |

Two further measurements, recorded because a later run will want them:
`MERGE_TIMEOUT_MS := Number(process.env.PR_WATCHER_MERGE_TIMEOUT_MIN ?? 90) * 60 * 1000` (the 90-min
window §10.3 turns on, still env-overridable), and `start-watcher.ps1:160` — §10.3's one surviving raw
line citation — **resolves correctly**: line 160 is
`if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs" }`.

⚠️ `[CANNOT MEASURE]` — §9.2's *"a ` M` / ` D` on a tree BEHIND origin/main is not uncommitted work"*
bullet. The tree was at `origin/main` for every measurement, so the behind-HEAD condition could not be
created without mutating a shared tree. What I could check is the prescribed CURE, and it discriminates
correctly: ` D docs/pr-prompts/pr-scopecards-s0-plan-HOLD.md` →
`git diff --numstat origin/main` = `0 159` (real), ` M .arming-log.txt` → `1 0` (real), `CLAUDE.md` →
EMPTY (clean). Both dirty entries are genuine work, not the behind-HEAD artefact.

## WHAT CHANGED

**Nothing on the board.** 04 is read-only: no arm, no merge, no label, no prompt renamed, moved or
staged, no `git` write, no worktree minted, no `/sot/` touch.

Two writes, both outside the repo except where noted:
- four probe scripts under `C:\po-sup-fix-scripts\` (`d04-probe-a.ps1`, `-b.ps1`, `-c.mjs`, `-d.mjs`,
  `-e.mjs`) and fixtures under `%TEMP%\d04fx*` — scratch, sanctioned by capabilities §4;
- `docs/pipeline/sweep-rotation.json` advanced and **LEFT DIRTY**, plus this breadcrumb. Both are
  Station 00's to commit.

## FINDINGS

### F1 — §9.1's wildcard correction names a falsifying probe THAT CANNOT FAIL, and the bullet tells the reader to retire the trap when it passes

`WILDCARD_RECURSE_FIXTURE_NEEDS_ZERO_FILES_V1`

The 2026-09-10 correction ends: *"The probe is a PAIR of fixtures differing only in what sits at depth
1 … if fixture B's star columns ever return 2 and 3, this correction is wrong and must be
re-measured."* Fixture B is specified as *"`.log` files only deeper, none at depth 1"*.

[MEASURED] 2026-09-11T02:2xZ at `ec7dd590`, PS `5.1.26100.9444`, three fixtures whose truth is known
by construction (each: 2 `.log`, 3 files, one subdirectory level):

| fixture | files at depth 1 | bare `-Recurse -Filter -File` | star `-Recurse -Filter -File` | bare `-Recurse -File` | star `-Recurse -File` | star `-Recurse` no type |
|---|---|---|---|---|---|---|
| A — a `.log` at depth 1 (the 09-07 fixture) | 1 | 2 | **2** | 3 | **3** | 4 |
| **B — `.log` only deeper, `top.txt` at depth 1 (the PRESCRIBED fixture)** | **1** | 2 | **2** | 3 | **3** | 4 |
| **C — `.log` only deeper, ZERO FILES at depth 1** | **0** | 2 | **0** | 3 | **0** | 3 |

**The correction's RULE is right and its PROBE is wrong.** The mechanism needs **zero files of any
kind** at depth 1, not zero *matching* files: one non-matching file is enough for the wildcard to
resolve a depth-1 set that the type filter can survive. The original 09-10 measurement was taken on a
real container directory holding *"7 subdirectories and **0 files**"* — fixture C's shape, stated in the
bullet's own worked table and then lost in the fixture spec.

**Why it costs something.** Fixture B's star columns return exactly the 2 and 3 the bullet nominates as
its own refutation. A run that rebuilds the prescribed pair — which is precisely what an
`instrument-honesty` sweep is told to do — reads *"this correction is wrong"* and retires a live trap
whose failure mode is a silent zero over container-shaped directories, the shape stations probe most.
This is the same structural blindness the correction correctly accuses the 09-07 fixture of, reproduced
one layer down in the cure written for it.

🔧 **The fix is one clause: fixture B must hold NO FILES AT ALL at depth 1.** Complete-and-additive —
it keeps every rule the bullet states (bare directory + `-Filter` with `-Recurse`; the
wildcard-in-path cure stays scoped to the depth-1 no-`-Recurse` form), changes no behaviour, and makes
the probe able to fail. `DOCTRINE §9.1` sits inside the `instruments v2` canonical block, so the edit
needs `lint-station.mjs --write-canonical`; per §9.5's `instruments v2` note a §9 edit costs ONE
document, not seven.

**DISPATCHED** → Station 00: land the fixture-B clause in `DOCTRINE §9.1` with the canonical hash
re-recorded. Falsifying probe for my own claim: rebuild A, B and C above and read the
`files at depth 1` column; if fixture C's star columns ever return 2 and 3, F1 is wrong.

### F2 — §9.1's `$`-expansion bullet DID NOT REPRODUCE through `start_process` today, measured with the control the bullet itself mandates

`COMMAND_LAYER_EXPANSION_NOT_REPRODUCED_V1`

The bullet requires its discriminating control to run through `-Command` and never `-File`, with
`$CTRL=42` — undefined at expansion time, so it **must** print empty if a pre-expansion layer exists.

[MEASURED] 2026-09-11T02:2xZ, `start_process` shell `powershell.exe`, two calls:

| probe | documented (09-04, re-measured 09-10) | today |
|---|---|---|
| `$CTRL=42; "CTRL-literal-is:$CTRL"` | assignment arrives as bare `=42`, `CommandNotFoundException` | **`CTRL-literal-is:42`** |
| `$true` | `True` | `True` (PowerShell's own behaviour — carries no information either way) |
| `$env:USERNAME` | already substituted as `Marco` | `Marco` (likewise ambiguous) |
| `foreach ($home in @(1,2,3))` | delivered as `foreach (C:\Users\Marco in @(1,2,3))`, ParserError | **`Cannot overwrite variable HOME because it is read-only or constant`**, 0 rows |

The second row is the decisive one and §9.1 says so: *"A ParserError naming a filesystem path instead
of `$home` means your argument was expanded before the child ever saw it."* Today there is no
ParserError and no path — `$home` reached PowerShell intact and hit the automatic-variable mechanism.
The `$CTRL` control agrees: `42` survived, so nothing substituted an undefined name.

🔴 **This is reported as a NON-REPRODUCTION, not as a retirement, and the cure must not be touched.**
§9.1 already warns that *"a station that follows the cure and then measures the cure reports 'the trap
does not reproduce'"* — but that warning is scoped to measuring through `-File`, and this measurement
went through the transport the bullet names. What I cannot establish is the CAUSE of the difference: a
Desktop Commander change between 2026-09-10T10:1xZ and now is the obvious candidate and I have not
proved it. Writing `$` into a `.ps1` and running it with `-File` costs nothing, so the cure stays
whatever the answer; what is expensive is leaving an UNQUALIFIED bullet whose own control now
contradicts it, because the next `instrument-honesty` sweep will re-measure exactly this and has no way
to tell a fixed trap from a mis-run probe.

🔧 Complete-and-additive: **qualify the bullet with a dated, transport-and-version-stamped
non-reproduction and keep the cure unconditional.** The alternative — retiring it — fails the
"without damaging future data entry" half outright: a silent wrong value at exit 0 is the worst shape
in §9, and one run's inability to reproduce it is not evidence it cannot happen.

**DISPATCHED** → Station 00, with the Desktop Commander version to be stamped when 00 reads it
(`get_config` → `version`); re-run both rows before editing anything.

### F3 — `check-breadcrumb.mjs`'s CADENCE map still records Station 00 at 2 hours, six days after the one-character fix was filed

[MEASURED] 2026-09-11T02:3xZ at `ec7dd590`, anchor `const CADENCE =` (and at line 36, so the
escalation's own `check-breadcrumb.mjs:36` citation has NOT rotted):
`const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };` with the comment above it
reading *"A station is SILENT past 2x its cadence."* NEG needle over the same file → 0.

00's live cron is `5 * * * *`. So `--freshness` — the probe the COLLECT step is told to START with —
will not call 00 SILENT until **4 h**, i.e. only after **three** consecutive missed hourly runs, which
is escalation #23's exact failure direction. `STATION-CAPABILITIES.md` §6 records this and says *"do
not read this paragraph as the fix having landed — the falsifying probe is the `const CADENCE =` line
itself."* I ran it. It has not landed.

The home is correct and live: `needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`
(POS control: 51 files in `needs-marco/`, 15 mention CADENCE, 6 mention CP-26; NEG needle 0). It is a
`scripts/` change and therefore outside Station 00's merge lane — this is **not** escalated to nobody.

**DEFERRED** — already filed with Marco, correctly, with options. What would make it urgent: a missed
00 occurrence that `--freshness` reports `ok`. My contribution is the re-run of its own falsifying
probe at a current SHA, so the next COLLECT does not re-derive it.

### F4 — §9.5's anchor-scoping clause HAS landed, but its prescribed probe returns 7 and reads as though it has not

[MEASURED] 2026-09-11T02:3xZ at `ec7dd590`. The clause's falsifying probe is *"extract every
`<file>:<NNN>` form from the ten binding documents at `origin/main` and resolve each against the line
it cites"*, and it predicts *"a re-run returns one citation and not five."*

Run literally, it returns **seven**: `DOCTRINE.md` 7, every other document **0**. Located by line:

| line | citation | what it is |
|---|---|---|
| 893 | `start-watcher.ps1:160` | the one legitimate survivor — **resolves correctly** |
| 894 | `ensure-watcher.ps1:10` | DOCTRINE quoting the citation it retired from `03-machine-minder.md` |
| 895 | `pr-gates.mjs:327`, `build-relationship-map.mjs:18-19` | ditto, retired from `05-sot-keeper.md` |
| 1937, 1996 | `start-watcher.ps1:160` ×2 | §10.3's own use of the same correct citation |

`CLAUDE.md:19` likewise survives only as DOCTRINE's quotation of it. So **03 and 05 are clean, the
clause landed, and four of the seven hits are the document describing its own repair** — §9.6's closing
rule, met from a new direction: the probe measures the documentation because the documentation names
the citations it removed. A reader who counts 7 against a predicted 1 concludes the clause never
shipped and re-opens four-sweeps-worth of closed work.

🔧 One clause on the probe: **exclude `DOCTRINE.md`'s own quotations — or state the prediction
per-document (`03` → 0, `05` → 0, `CLAUDE.md` → 0, `STATION-CAPABILITIES.md` → 0, `DOCTRINE.md` → its
`start-watcher.ps1:160` uses only)**, which is checkable and cannot be satisfied by prose.
Complete-and-additive; it removes nothing and makes the count falsifiable.

**DISPATCHED** → Station 00, same PR as F1 (both are `DOCTRINE §9` clauses inside the same canonical
block; one re-record serves both).

### F5 — 24 remote-tracking refs no refspec owns, and a NEW `staleprobe/*` family §9.2 does not name

[MEASURED] immediately after `git fetch origin --prune`: `git branch -r` = **38**,
`git ls-remote --heads origin` = **14**. All 14 real heads matched; the 24 extras are
`pr/1477 1478 1483 1487 1544 1571 1692 1699 1709 1713 1760 1824 1835`, `pr1273`, and **nine
`staleprobe/*` refs** (`staleprobe/main`, `staleprobe/fix1483`, four `*verdict-home-resolver*` variants,
`staleprobe/fix/classify-policy-nested-tests`, `staleprobe/feat/crm-account360-v2-s1`,
`staleprobe/chore/sweep-breadcrumbs-20260907-0934`).

§9.2's bullet names the `pr/*` and `pr1273` forms and its conclusion is untouched — `--prune` cannot
remove refs `remote.origin.fetch` does not cover, and a pruned cache is still not authoritative. What
is new is the `staleprobe/*` family, which looks like a station's own staleness probe that created
tracking refs and never removed them: it more than doubles the undercount, and every one of the four
`verdict-home-resolver` names belongs to the kill-loop episode §9.5 records.

**DISPATCHED** → Station 03 (clone/ref hygiene; 04 may not delete refs). It is cosmetic until someone
crosses `branch -r` against the API — which §9.2 records as having already happened once, 54 against
21. Suggest folding into the open 03 dispatch rather than a new one.

### F6 — §9.4's `@($null).Count` trap fired in MY OWN probe, in four places at once, and produced a uniform `1` that looked like a real count

[MEASURED] 2026-09-11T02:2xZ. My first probe wrapped every count in `@($items).Count`. Four independent
truths of **0** came back as **1**: the fresh negative needle, the spent `zzzNoSuchNeedleZzz` needle,
`STOP-WATCHER*` at the dev-tree root, and the `ls-tree` glob pathspec. It was caught only because one
of the affected rows was a fixture whose truth I knew by construction — every other row was plausible.
Had I stopped there I would have filed *"the fresh needle is already contaminated"* and *"the ls-tree
glob no longer returns zero"*: two confident wrong findings, one of them retiring a live §9.2 trap.

Controls after the repair, in the same session: `@($null).Count` → **1**;
`@($x | Where-Object { $null -ne $_ }).Count` → **0** on `$null` and **3** on `@(1,2,3)`;
`ConvertFrom-Json ""` → `$null`; `@(ConvertFrom-Json '[]').Count` → **1**.

**ACTIONED** — counter replaced with the null-guarded form and every affected row re-measured; the
table above is from the repaired instrument. Recorded here because §9.4's clause is usually read as a
`gh`-parsing rule, and this instance had nothing to do with `gh`: **the trap is in the counter, so it
reaches every `Select-String` and `Get-ChildItem` tally a station writes.** That generalisation is
worth a half-sentence in the bullet, which currently frames it entirely around failed `gh` calls.

**DISPATCHED** → Station 00 for that half-sentence, same PR as F1/F4.

### F7 — the device-bridge git guard could not be installed: the Cowork VM workspace is unreachable

[MEASURED] 2026-09-11T02:11Z. PREFLIGHT step 1 requires
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` and its last line quoted pass or
fail. The call never reached the script. Verbatim:

> `bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount … is under
> Plan9 share "c" which is not mounted … A Windows update released September 8 prevents Claude's
> workspace from reaching your files.`

So the guard is **NOT installed this run**, and the hazard it exists to remove — a cut-short VM-side
`git` against the Windows `.git` leaving a 0-byte `index.lock` — **could not occur**, because no VM-side
transport existed at all. `status-sweep.ps1` section 3 confirms: `index.lock interactive/clone:
False / False`, `git processes touching our trees: 0`. Desktop Commander was the only transport used
and it ran no `git` against a mount.

This is the same condition as `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`,
which the sweep lists and which carries no PR ref. It is now at least a second consecutive day, and it
is worth noting that `STATION-CAPABILITIES.md` §3's blind-run COLLECT path — *"the mount IS the live
dev tree"* — is unavailable for the duration: a run that loses Desktop Commander as well has only the
native file tools left (the `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1` paragraph), not the mount.

**DEFERRED** — already filed with Marco and outside this station's reach (a Windows/Plan9 platform
fault, not a repo defect). What would make it urgent: a run that is blind to Desktop Commander AND the
mount on the same day, which would cost that run its whole COLLECT.

## WHAT I DID NOT DO

- **Did not fast-forward, commit, or push anything.** The tree was already at `origin/main` by 02:13Z
  (another actor's FF, mid-run). The dirty `sweep-rotation.json`, the ` D` on
  `pr-scopecards-s0-plan-HOLD.md`, the ` M` on `.arming-log.txt`, the untracked
  `pr-scopecards-s0-plan-b-LOOPING.md`, `queue-watch-state.md`, `.queue-sync-ledger.txt`,
  `pr-1869-review.md` and `Claude Design/docs/index.html` are all left exactly as found — 00's and 03's.
- **Staged no prompt and armed nothing.** `armed: 0` at 02:12Z and still 0. I deliberately ran no
  arming triage at all this run: the sweep assigned was `instrument-honesty`, and `triage-holds.ps1`
  counts are state that expires before 00 could read them.
- **Did not edit `DOCTRINE.md`.** F1, F2, F4 and F6 are all clauses inside the `instruments v2`
  canonical block; editing it requires `lint-station.mjs --write-canonical`, and the edit plus the
  re-record is Station 00's lane, not 04's.
- **Did not delete or prune a single ref, worktree or lock** — including the `staleprobe/*` refs (F5),
  `C:\po-vg` (orphaned 9739 min, **holds 1 uncommitted file**), `C:\po-worktrees\pr1823`, and the
  registry escapee `C:\po-worktrees\v1823`. All 03's, and the sweep says so.
- **Did not touch the four open PRs**, their labels, or `needs-marco/`. `#1823` is open, green, and
  outside `tests|docs`; nothing about a green CI clears RULE 2.
- **Ran no Part 1 GitHub-reconciliation or Part 2 live-site pass.** One named sweep per run, covered
  completely, is the station contract; a shallow pass over everything is what the rotation exists to
  prevent. `github-projectops` MCP is also down this session (`Authorization header is badly
  formatted`) — already filed as
  `needs-marco/github-projectops-mcp-auth-header-rejected-2026-09-08.md`.
- **Left `/sot/`, Azure/Entra/SharePoint, and all production data untouched.**
- **Did not re-run the whole of §9.** Bullets not probed this run, and therefore carrying no verdict
  from me: the streamed-early-return bullet, the double-encoding signature, the `String.replace` `$`
  substitution trap, the `--jq` quoting bullet, `gh run list --branch main` staleness, the short-SHA
  `--commit` form, `mergeStateStatus CLEAN`, `list_sessions` state, the three-review-homes rule, the
  daily-clone-log name-shape selection, and the `status-sweep` clone-dirty and trunk-verdict bullets
  (the latter's fix, `#1852`, merged at some point before `ec7dd590`, so that row is expected to die and
  wants its own re-measurement next rotation).
