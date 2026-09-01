# Station 04 — Scanner | 2026-09-01T18:10:46Z–2026-09-01T18:18Z

## GROUND

```
UTC            2026-09-01T18:10:46Z
origin/main    cdc78159            (fetched, then rev-parse)
dev tree       main @ cdc78159      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (1 = 1) — full authority, not read-only-by-mismatch.

SIGHTED RUN. `start_process` shell `powershell.exe` succeeded first call, PID 22744. This was
**not** a blind run; the quiet result below is a measured quiet, not an unreachable box.

Binding docs read in full this run: `docs/pipeline/stations/04-scanner.md`,
`docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md`.
[MEASURED] `git diff --stat origin/main -- <all three>` returned **empty** and dev tree HEAD ==
origin/main == `cdc78159`, so the working-copy read is byte-identical to `origin/main` and the
§PREFLIGHT-2 "never read from the working copy" hazard does not apply to this run.

Sweep verdict at 18:11:14Z: **SAFE TO ACT** — no board mutation in progress, no live station
worktrees. Section 0 positive controls both [LIVE]: gh reached GitHub, node runs.

## WHAT I MEASURED

Named sweep this run: **instrument-honesty** (rotation position 2 of 4), selected by
`node scripts/pipeline/next-sweep.mjs`, not by choice. Previous run 2026-09-01T14:10:52Z.

Remit: take DOCTRINE §9 and prove each trap is still trapped; a trap fixed upstream that still
reads as live is itself drift.

**Every §9 trap probed below REPRODUCED. Nothing in §9 that I could reach is stale.**

### §9.1 The shell — `$` expansion — TRAP INTACT
[MEASURED] Control through `interact_with_process`: `$CTRL=42; "SHELL-CONTROL=$CTRL"` →
`SHELL-CONTROL=42`. The variable survives. §9.1's exemption for this transport holds.
[MEASURED] Contrast through `start_process` with `-Command "..."`:
`powershell.exe -NoProfile -Command "$CTRL2='fortyseven'; ... $PSVersionTable.PSVersion..."` →
`The string is missing the terminator: ".  ParserError`. Exactly §9.1's documented "usually this
dies as a parser error that looks like a syntax mistake". The rule — anything containing `$` goes
in a `.ps1` run with `-File` — is still load-bearing.

### §9.2a `ls-tree` depth — TRAP INTACT
[MEASURED] against `origin/main`:
```
git ls-tree --name-only origin/main -- docs/pr-prompts       -> 1     (the tree entry itself)
git ls-tree --name-only origin/main -- docs/pr-prompts/      -> 85    (direct children)
git ls-tree -r --name-only origin/main -- docs/pr-prompts/    -> 636   (recursive)
git ls-tree --name-only origin/main -- docs/pr-prompts/superseded   -> 1
git ls-tree -r --name-only origin/main -- docs/pr-prompts/superseded -> 265
```
The no-slash form still returns ONE line, and any filter over it still reports zero — the exact
shape that produced the false "0 tracked ready-files against a truth of 9". DOCTRINE records
1 vs **252** for `superseded` at `b19f3db9`; it is now 1 vs **265**. The count is state and has
grown; the mechanism is identical. ⚠️ Do not quote 252 or 265 — re-measure.

### §9.2b `ls-tree` glob pathspec — TRAP INTACT, including the trap in the cure
[MEASURED]
```
-- 'docs/pr-prompts/superseded/*.md'  without -r -> 0
-- 'docs/pr-prompts/superseded/*.md'  with    -r -> 0
POSITIVE CONTROL -- 'docs/pr-prompts/*.md' with -r -> 0   <-- against a truth of 78
literal control: ls-tree -- docs/pr-prompts/ | Select-String '\.md$' -> 78
:(glob)docs/pr-prompts/superseded/**/*.md -> fatal: pathspec magic not supported ... 'glob'
```
Confirmed in both directions: `-r` does **not** rescue a zero-result glob, the positive control
returns the same silent zero at exit 0, and only the explicit `:(glob)` magic fails loudly.
🔧 One numeric nuance for whoever next edits this bullet: DOCTRINE says the glob control fails
"against a truth of 85 tracked files". 85 is the count of all depth-1 **entries** (dirs included);
the depth-1 **`.md`** truth is **78**. The mechanism is unaffected — flagging it only so a future
reader re-measuring does not think the trap has changed shape.

### §9.2c `check-ignore` on a directory — TRAP INTACT, and it carries zero information
[MEASURED] the three-way comparison DOCTRINE demands:
```
git check-ignore -v docs/pr-prompts/processed        -> exit 1, output []        (IS ignored)
git check-ignore -v CLAUDE.md                        -> exit 1, output []        (NOT ignored)
git check-ignore -v docs/pr-prompts/processed/<file> -> exit 0, .gitignore:76:...
```
Opposite truths, **byte-identical** results. Only the file form answers. Trap fully intact.

### §9.2d `git status` blind to gitignored files — TRAP INTACT
[MEASURED] `git status --porcelain` matching `ready.md` → **0**, while
`git ls-files --others --ignored --exclude-standard -- docs/pr-prompts` matching `-ready.md$` →
**1908** (all depths, dominated by `processed/`). `status` is structurally blind, as documented.

### §9.2e `git branch -r` reads the LOCAL cache — TRAP INTACT, and the drift has GROWN
[MEASURED] `git branch -r` (excluding HEAD) → **64**. `git ls-remote --heads origin` → **26**.
DOCTRINE records 54 vs 21 on 2026-08-29. Same mechanism, larger gap: **38 remote-tracking refs
now exist locally for branches GitHub no longer has.** Anything cross-referencing `branch -r`
against the API still inherits the error. ⚠️ Counts are state — re-measure, never quote.

### §9.2f git version — CONTEXT CONFIRMED
[MEASURED] `git version 2.55.0.windows.3`. The §9.2 note that a plain `git fetch origin main`
opportunistically updates `refs/remotes/origin/main` on 2.55 applies to this box.

### §9.3a PowerShell `>` writes UTF-16LE — TRAP INTACT
[MEASURED] on `docs/pipeline/stations/03-machine-minder.md`:
```
original                              20778 bytes
git show origin/main:<path> > file    41558 bytes, first two bytes FF FE
git diff --stat origin/main -- <path> []   (empty — reports NO difference)
Copy-Item control: git hash-object equal -> True
```
Byte-doubling and the UTF-16LE BOM both reproduce, while `git diff` correctly sees no difference.
DOCTRINE recorded 20489 → 40980 on 2026-08-30; the file has since grown to 20778 → 41558. The
`Copy-Item` positive control confirms `hash-object` is not the liar here — same finding as §9.3's
own `Compare-Object` control.

### §9.3c `Select-String -SimpleMatch` + `[regex]::Escape()` — TRAP INTACT
[MEASURED] needle `pipeline-lib.ps1` against `docs/pipeline/DOCTRINE.md`:
```
raw literal                       -> 2 hits
[regex]::Escape() = pipeline-lib\.ps1 -> 0 hits
dotless control 'DOCTRINE' raw    -> 2
dotless control 'DOCTRINE' escaped-> 2   <-- escaping is harmless only when there is no dot
```
The dotted needle silently dies; the dotless control passes either way — precisely the asymmetry
that produced six confident wrong findings on 2026-08-30.

### §9.4a `gh run list --commit <SHORT sha>` — TRAP INTACT
[MEASURED] on gh against `cdc78159904af96da433e0fec44d393853ade44d`:
```
--commit cdc78159 (short)  -> 0 rows, exit 0, no warning
--commit <full 40-char>    -> 4 rows
```
The short form still answers an empty list that reads as "no CI ran on this commit".

### §9.4b `gh pr list --limit N` truncates silently — TRAP INTACT
[MEASURED] `--state all --limit 3` → exactly 3; `--limit 100` → exactly 100. The limit is a hard
cut with no indication that more exist.

### §9.5a `lint-prompt.mjs` — THREE arm markers, and `gh` IS reachable from it — VERIFIED EXACT
[MEASURED] line numbers all match DOCTRINE character-for-character:
```
440 : const gitBin = process.env.LINT_GIT_BIN || "git";
728 : const DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i;
730 : const DO_NOT_ARM_CAPS = /DO NOT ARM/;
732 : const ARM_ONLY = /Arm ONLY/;
738 / 750 / 762 : the three .test(line) call sites
1164: const gh = process.env.LINT_GH_BIN || "gh";   <-- exactly ONE hit
```
RULE 4's union-of-three-markers detector and the "a `fixes_pr` verdict DOES depend on `gh`"
correction are both still accurate against the shipped file.

### §9.5b `check-breadcrumb.mjs` measures two different sets — VERIFIED EXACT
[MEASURED] `:98` = `git ls-tree -r --name-only origin/main -- ${DIR}` (recursive, with an inline
comment stating `-r` is mandatory for exactly the §9.2a reason); `:160` =
`readdirSync(DIR).filter(...)` — depth-1 only. The documented asymmetry (freshness recursive,
structure depth-1) is real in the current source.
[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` → **exit 0, CLEAN**,
`structure: 4 checked, 0 malformed, 0 skipped`.

### THE BOARD TRAP (standing check, every run) — CLEAN
[MEASURED] tracked `*-ready.md` at depth 1 on `origin/main` → **0**, via the trailing-slash form
whose positive control returns 85, so this zero is a real zero and not a §9.6 empty world.
On-disk depth-1: `*-ready.md` = **0** (armed: 0, agrees with the sweep), `*-HOLD.md` = **72**.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted; no PR merged,
labelled or touched; no `/sot/` file read-modify-written; no lock cleared; no worktree created or
pruned. I minted **no** throwaway worktree — every `origin/main` read was `git show` / `ls-tree`
against a named SHA, per the AUTHORITY section.

Two files written, both left **UNTRACKED / uncommitted in the dev tree for Station 00 to collect**:

1. this breadcrumb, `docs/pr-prompts/00-04-scanner-2026-09-01-1815-instrument-honesty-...md`
2. `docs/pipeline/sweep-rotation.json`, advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-01T18:10:46Z`

I did **not** commit either. The authority matrix gives Station 04 no PR-creation right, and
DOCTRINE §9.2 records that the dev tree's index is SHARED between concurrent chats — `git status`
already showed 12 entries I did not author when I arrived. Committing would have swept a
stranger's staged work into my change. Station 00 collects.

One scratch file outside the repo: `C:\po-sup-fix-scripts\scan-runs-2026-09-01.mjs` (a node
reader for `gh run list`, written because PowerShell mangled the JSON — see FINDING 2).

## FINDINGS

### FINDING 1 — DOCTRINE §9 is HONEST. Eleven traps probed, eleven still trapped. [S4/informational]
Every §9 mechanism I could reach reproduced with its documented signature, and each negative
result was paired with a positive control that returned non-zero. No §9 claim was refuted.
Three bullets carry **counts** that have since drifted (superseded 252→265, branch-r 54/21→64/26,
03-machine-minder 20489→20778 bytes). DOCTRINE already labels these as state and says re-measure;
none of them is a defect, and none changes a mechanism.
**DISPOSITION: ACTIONED** — this run's deliverable is the verification itself; §9 needs no edit
for any of the above.

### FINDING 2 — "TRUNK IS RED" was TRUE when printed and FALSE 42 seconds later. The sweep is not broken. [S3]
The 18:11:41Z sweep printed `main CI on cdc78159: 3 success / 1 failed / 0 running <-- TRUNK IS RED`.
That verdict is **already false** and `status-sweep.ps1` is **NOT** the liar. Chain of measurement:
- [MEASURED] I re-ran the sweep's *exact* query and *exact* parse by hand at ~18:13Z:
  `gh run list --commit <full> --limit 20 --json conclusion,name` → assign-then-foreach →
  **3 success / 0 failed / 1 running**. Same script logic, opposite verdict.
- [MEASURED] `gh run view 33520578163 --json attempt,status,startedAt` →
  `{"attempt":2, "status":"in_progress", "startedAt":"2026-09-01T18:12:23Z"}`.
- The sweep ran at **18:11:41Z**. Attempt 2 of `Tendering Browser Smoke` started at **18:12:23Z** —
  **42 seconds later.** At sweep time, attempt 1 had concluded not-success and the sweep counted it
  correctly. The re-run then blanked the conclusion.
I inspected `status-sweep.ps1:102-126` and the trunk logic is sound: `if (-not $r.conclusion)
{ $mpend++ }` treats an in-flight run as pending, `skipped` is excluded, and green requires a
success. I nearly filed this as a parse defect and the positive control is what stopped me.
This is the cleanest instance yet of the station doc's `[LIVE]` rule — *"true when measured, not
true now"* — with a **42-second** shelf life, and it is a rare case of an instrument being
**exonerated** by the same discipline that usually convicts one.
**DISPOSITION: ACTIONED** — no code change is warranted; the script did its job. Recorded here so
the next reader does not re-open `status-sweep.ps1` chasing a bug that is not there.

### FINDING 3 — trunk had a REAL failed `Tendering Browser Smoke` on cdc78159; attempt 2 was still in flight at run end. [S3]
Separable from FINDING 2 and it must not be lost inside it. Attempt 1 on `cdc78159` genuinely did
not succeed — that is why the sweep saw a failure. [MEASURED] `createdAt 14:36:55Z`,
`attempt 2 startedAt 18:12:23Z`, `status in_progress` as of 18:14:29Z; outcome UNKNOWN at run end.
Project memory records that `tendering-e2e` has flaked once on a no-app-code diff and then passed
clean, and that **a further red there is NEW news**. This is that further red. Nobody triggered
attempt 2 from this station — I mutated nothing — so a third actor re-ran it.
**DISPOSITION: DISPATCHED → Station 00.** Read attempt 2's conclusion on `cdc78159` before
treating trunk as green, and before merging anything that would sit on top of it. If attempt 2 is
also red, this is a genuine trunk regression on a docs-and-`sot/`-only merge and wants a root
cause, not a fourth re-run (DOCTRINE §2: never re-run hoping for green).

### FINDING 4 — §9.4 is INCOMPLETE: a single-quoted `--jq` containing `|` is re-split, even where `$` survives. [S3]
[MEASURED] Through `interact_with_process` — the transport §9.1 certifies as safe for `$` —
this call:
```
gh run list --commit $full --json databaseId,name,status,conclusion --jq '.[] | [.name, .status] | join(" | ")'
```
returned `unknown command "|" for "gh run list"` plus the usage block. PowerShell split the
**single-quoted** jq expression on its pipe characters and handed `gh` a `|` as a bare argument.
§9.4 currently documents only that *escaped double quotes* do not survive, and says a `--jq`
expression "survives the `-Command` layer intact — spaces included". **That is not the whole
failure set**: a pipe inside the expression breaks it here even without the `-Command` layer and
even without a double quote. This matters because jq expressions are pipes almost by definition,
so the documented cure ("keep double quotes out of jq expressions") is not sufficient.
Corroborating measurement from the same run: `@($raw | ConvertFrom-Json)` on this box collapsed a
4-element array into ONE object whose properties member-enumerated as `System.Object[]` — and it
did so **even with the assign-then-foreach form**, which is the cure §9.4 prescribes.
The working cure, used for the rest of this run: **read `gh --json` output in node**
(`JSON.parse`), never in PowerShell. Node also reads UTF-8 correctly (§9.3).
**DISPOSITION: DISPATCHED → Station 00 (routing to 05 or a docs prompt).** I did not edit
DOCTRINE: §9 lives inside the hash-gated `CANONICAL-BLOCK: instruments v2`, so an edit requires
`node scripts/pipeline/lint-station.mjs --write-canonical` and ships to every station at once.
That is deliberately not a read-only station's call. Proposed additive bullet, RULE 1 complete-
and-additive (it removes no existing advice and breaks no current reader):
> ⚠️ **A `--jq` expression is re-split by PowerShell on any `|` it contains, single quotes
> notwithstanding** — `gh` receives `|` as an argument and fails with `unknown command "|"`.
> Combined with the escaped-double-quote failure, this makes `--jq` unusable from PS for any
> non-trivial expression. **Take raw `--json` and parse it in node**, not in PowerShell:
> `ConvertFrom-Json` has been measured collapsing a 4-element array to one object even under the
> assign-then-foreach cure.

### FINDING 5 — a negative control drawn from the document you are searching is not a control. [S4, method]
[MEASURED] While controlling the §9.3c probe I used DOCTRINE's own suggested absent-needle,
`zzzNoSuchTokenZzz`, against `DOCTRINE.md` — and got **1 hit**, because §9.5 prints that token as
prose. A clean token (`qqWumpusFlange77`) correctly returned **0**. Harmless here because I
noticed, but the shape is exactly §7: a control that cannot fail is not a control, and this one
would have certified a broken search as working. **Never draw a negative-control needle from the
corpus under test** — least of all from the document that teaches controls.
**DISPOSITION: ACTIONED** — recorded; no document change proposed, as DOCTRINE names that token
in narrative prose about a *different* file and is not wrong to.

### FINDING 6 — 38 phantom remote-tracking refs, up from 33. [S4]
[MEASURED] `git branch -r` 64 vs `git ls-remote --heads origin` 26. Project memory carries an open
item about undeleted origin branches (escalation #14, recorded as 22); the live gap is now **38**
local tracking refs with no remote counterpart. Cured by `git fetch --prune`, which is a machine-
hygiene mutation and not mine.
**DISPOSITION: DISPATCHED → Station 03**, to fold into the clone-hygiene dispatch it already owns
(phantom refs, stashes, registry-escapee worktrees). Note the number is state: re-measure.

### FINDING 7 — two orphaned worktrees registered from a `/sessions/rcw-*` Linux mount — a SECOND LANE left them. [S3]
[MEASURED] from the sweep, section 2, both `[LIVE]`:
```
/sessions/rcw-019qxzb7xwsnipqvw9og12p9/mnt/po-worktrees/stage-brandtheme-083750  755255ab [stage/brandtheme-s1-s2]    locked  dirty=0  age=-1 min
/sessions/rcw-019qxzb7xwsnipqvw9og12p9/mnt/po-worktrees/stage-bt-084105          755255ab [stage/brandtheme-s1-s2-v2] locked  dirty=0  age=-1 min
```
Both are registered against **Linux mount paths**, not `C:\` paths, so they were created by a
remote/cloud session — a DOCTRINE §10 second lane — staging `brandtheme` work. Both are `locked`
with `age=-1 min`, a nonsense age that means the sweep could not stat them from Windows; per
§9.6's corollary, *"no process is holding it" is only evidence when you know where the process
would have run*, and a worktree registered from a destroyed Linux VM has no Windows process by
construction, forever. Separately the sweep lists **11 registry-escapee worktrees**, two of which
are the same `stage-brandtheme-083750` / `stage-bt-084105` pair seen from the Windows side.
**DISPOSITION: DISPATCHED → Station 03** (worktree/lock hygiene is its lane; 04 is read-only and
must not prune). ⚠️ For 00: `stage/brandtheme-s1-s2` and `...-v2` are branches this pipeline did
not arm. Under §10.1, any PR arriving from them carries **NO RULE-2 verdict** and must be
hand-classified by `classifyPolicyFiles`, not read as cleared.

### FINDING 8 — three breadcrumbs sit UNTRACKED; a fourth is tracked but its findings are uncollected. [S2]
[MEASURED] `git status --porcelain` and `check-breadcrumb.mjs`, which explicitly warns
`... is UNTRACKED — it reaches nobody until a board PR commits it`. **UNTRACKED (`??`):**
```
00-00-supervisor-2026-09-01-1609-blind-run-desktop-commander-never-connected.md
00-04-scanner-2026-09-01-1410-gate-liveness-two-shipped-holds-and-a-seven-deep-chain-behind-one-red-pr.md
00-04-scanner-2026-09-01-1815-instrument-honesty-...md   (this one)
```
🔧 **Correction to what project memory implies:** `00-05-sot-keeper-...-1411-...md` is **TRACKED** —
it landed on `main` inside `#1496`. It does **not** need committing; its **eight findings** still
need *collecting*. Those are two different failures and conflating them would send 00 to commit a
file that is already committed while the findings stay unread. [MEASURED] it appears in
`check-breadcrumb`'s ADMIT list with no UNTRACKED warning, and is absent from `git status`.
The 1410 (04) breadcrumb landed after the 14:12Z collect and was missed again by the 16:09Z run,
which was blind and could mutate nothing — so it is now two cycles deep. This is exactly the
failure the REPORT CONTRACT exists to prevent: a report nobody collects is a report that does not
exist.
**DISPOSITION: DISPATCHED → Station 00.** Commit the three untracked breadcrumbs and collect the
findings of all four, before any board work.

### FINDING 9 — a prior §9 correction DID land; its prompt is SPENT and correctly retired. [S4]
While auditing the tree I found `docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`
— a prompt written by this station's 2026-08-26 `instrument-honesty` sweep, asserting §9 carried
four measured-false claims, one of them **inverted in the dangerous direction** (§9.5 then said
`lint-prompt.mjs` REJECTs when `gh` is missing; the truth was a silent **ADMIT** with the file gate
skipped — a false-ADMIT on prompts that drop database tables).
[MEASURED] its premise is **DEAD**: `grep 'no inline .if. expression' docs/pipeline/DOCTRINE.md`
→ **0 hits**, with positive control `instrument` → **12 hits** on the same file, so the zero is a
real zero. And §9.5 on `origin/main` now reads correctly at `:461`/`:464`/`:473-474` —
*"does NOT reject"*, *"fail SAFE"*, and *"with respect to **arming** it fails **OPEN**"*.
**The correction shipped, and the prompt is properly in `superseded/`.** This is the reassuring
half of my sweep's own remit: §9 reads honest today partly *because* a previous run of this sweep
caught it lying, and that loop closed.
⚠️ Minor: the file is UNTRACKED in `superseded/` (`??`), so its retirement is not recorded on
`main`. Harmless — a file in `superseded/` matches no watcher glob and arms nothing.
**DISPOSITION: ACTIONED** — verified spent; no re-arm, no re-raise. Flagged for 00 only so the
untracked file is swept up with the rest rather than puzzled over later.

## WHAT I DID NOT DO

- **Did not run Part 0 (static cross-layer audit), Part 1 (GitHub reconciliation) or Part 2 (live
  site).** The station doc's AUTHORITY section is explicit that the sweep is chosen by
  `next-sweep.mjs`, not by me, and that ONE named sweep covered completely beats a shallow pass
  over everything. `next-sweep.mjs` returned `instrument-honesty`. Part 0's `(a)` is described as
  "ALWAYS" in the older brief; where that brief and the newer contract disagree, the contract
  wins by its own terms, and one complete sweep is what the contract asks for. Flagging the
  tension so it can be resolved in the doc rather than re-litigated every run.
- **Staged no prompt.** My budget is 2; I used 0. FINDING 4 is the only candidate and it targets a
  hash-gated canonical block, which is not a read-only station's to stage.
- **Did not clear, prune or touch any worktree or lock**, including the two second-lane orphans in
  FINDING 7 — Station 03's lane.
- **Did not re-run `Tendering Browser Smoke`.** DOCTRINE §2: never re-run hoping for green. The
  outcome of attempt 2 is 00's to read and root-cause.
- **Did not commit or push anything**, and did not `git add`. The shared index held 12 entries I
  did not author.
- **Did not probe §9.3's double-encoding signature** (`U+00E2 U+20AC U+201D`) — Station 05 measured
  the encoding gate at 14:11Z and that breadcrumb is still uncollected; re-measuring it now would
  duplicate uncollected work rather than extend coverage.
