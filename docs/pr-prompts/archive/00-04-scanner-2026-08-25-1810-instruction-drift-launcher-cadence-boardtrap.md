# Station 04 — Scanner | 2026-08-25T18:10Z–2026-08-25T18:21Z

## GROUND

```
UTC            2026-08-25T18:10:18Z
origin/main    019c7579            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ b968e4f1     C:\ProjectOperations2   (1 behind origin/main, 0 ahead)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Versions AGREE — this run was NOT read-only-by-mismatch.
**NOT BLIND:** Desktop Commander reached the Windows host on the first call
(`start_process` → `powershell.exe`, pid 41820). Every `[MEASURED]` line below is a live probe on the box.

**Sweep this run: `instruction-drift`** — chosen by `node scripts/pipeline/next-sweep.mjs`
(rotation position 4 of 4; previous run 2026-08-25T14:10:08Z). Not my choice, per AUTHORITY.

**status-sweep verdict at 18:10:45Z: `SAFE TO ACT`** — 0 in-progress prompts, `index.lock` false in both
trees, 0 git processes, no PR touched in 2 min. Re-read immediately before my one commit.

## WHAT I MEASURED

**Bootstrap ↔ station doc version parity — CLEAN, 5 of 5.** [MEASURED]
`04-drift-1.ps1`, regex over both layers. Every bootstrap declares `station_doc_version: 1`; every repo
station doc declares `station_doc_version: 1` + `contract_version: 1`. All five bootstraps mtime
`2026-08-24T22:54Z`, 97 lines each. `weekly-security-audit` carries no version and points at no station
doc — correct, it is not a pipeline station.

**Delivery channel is byte-faithful.** [MEASURED] The file this run was actually handed
(`...\local_b6fd6b9f...\uploads\SKILL.md`) is **sha256-identical** to
`C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` — both `2F34D1E53EF51951`, 5276 bytes,
mtime `2026-08-24T22:54Z`. A drift vector I expected to find open is closed. Worth keeping: it means
editing the `Scheduled\` file really is the way to change a station's behaviour.

**The five bootstraps are one template, correctly parameterised.** [MEASURED] `04-bootdiff.mjs` — of
~97 lines each, only **8 lines per file** are not shared by all five, and every one of the 8 is a
correct per-station substitution (title, cadence, doc path, blob URL, lane line, one station-specific
warning, breadcrumb prefix). There is no pasted-copy divergence between bootstraps. The 2026-08-24
"five pasted copies drifted for weeks" failure has **not** recurred at this layer.

**`lint-station.mjs`: ADMIT 7 of 7, exit 0.** [MEASURED] One warning only —
`04-scanner.md` names `C:\po-scan-`, which sits inside the block that is already marked SUPERSEDED
("do NOT mint a throwaway worktree"). Benign.

**POSITIVE CONTROL on that linter (DOCTRINE §7).** [MEASURED] A clean ADMIT is not evidence until the
instrument is seen to fail. Ran `lint-station.mjs` against the five bootstraps: **REJECT 5 of 5**, six
specific reasons each. The REJECT path executes and reports. The ADMIT above is therefore real.
(Those REJECTs are **not** findings — bootstraps are thin by design and carry no front matter or
canonical block.)

**Path resolution — the sweep's third clause.** Three passes, because the linter only sees one shape:

- forward-slash repo paths in backticks — `lint-station.mjs` checks these against `git ls-files`: clean.
- **backslash-style repo paths — INVISIBLE to the linter** (`repoPathsIn()` matches `/` only).
  [MEASURED] `04-pathcheck.mjs`: 14 references, 9 distinct, **MISSING = 0**. Control:
  `git ls-files` size 2516, `has DOCTRINE=true`, `has bogus=false`. Hypothesis raised, hypothesis
  refuted — record it so the next run does not re-raise it.
- **absolute `C:\` paths — the linter only warns on the ROOT, never tests existence.** [MEASURED]
  `04-winpaths.ps1` over DOCTRINE + STATION-CAPABILITIES + 6 station docs + 6 bootstraps:
  **72 distinct (doc, path) pairs, 3 not resolving**, and all three are benign:
  `C:\po-scan-` (superseded block, already warned) and
  `C:\ProjectOperations-Reference\worktrees` ×2 — where **absence is the healthy state**, because
  02-board-driver.md:282 says "mkdir … first if missing" and "rmdir … if it is now empty".
  Controls both directions: true=True, false=False. **An empty result is not an empty world** — here
  a MISSING result was not a defect either.

**CP-24 citation re-verified — ACCURATE, not drift.** [MEASURED] 05-sot-keeper.md:119 and the 05
bootstrap both cite `pr-gates.mjs:327`. `scripts/pr-gates/pr-gates.mjs` is 514 lines; **line 327 is**
`const codeRe = /^(?:apps\/|scripts\/|\.github\/|packages\/|…)/;` — the exact regex CP-24 (block at
:318–:371) uses to decide "code path". The citation is live.
🔧 **My own instrument lied first:** my probe assumed `scripts/pipeline/pr-gates.mjs` and printed
`MISSING FILE`. The file is at `scripts/pr-gates/pr-gates.mjs`. I nearly filed a wrong-path finding
off a wrong-path probe. Logged per §7.

**This breadcrumb is genuinely findable — proved, not assumed.** [MEASURED]
`git check-ignore -v --no-index <this file>` → **exit 1** (no rule matches it).
Positive control on the same instrument: `git check-ignore -v --no-index docs/pr-prompts/zz-ready.md`
→ `.gitignore:75:docs/pr-prompts/*-ready.md`. The check can fire, and it does not fire here. This is
the failure the REPORT CONTRACT exists to prevent — nine days of findings swallowed by `docs/qa/` —
so it gets a measurement rather than a promise.

**Live schedule read from the MCP, not from folders** (`list_scheduled_tasks`, per sweep §4C).
[MEASURED] 5 tasks: `00-supervisor` `5 */2 * * *`; `04-scanner` `0 */4 * * *`;
`05-sot-keeper` `10 0 * * *` (fires 14:10Z, last 2026-08-25T14:10:50Z);
`03-machine-minder` **`0 9 * * *`**, last `2026-08-24T23:00:51Z`, next `2026-08-25T23:00:45Z`;
`weekly-security-audit` **enabled=false**. `02-board-driver` has a folder on disk but **no task** —
correct, it is dispatch-only.

## WHAT CHANGED

**Two files written to the working tree. NOTHING COMMITTED — deliberately, see FINDING 6.**

1. `docs/pipeline/sweep-rotation.json` — advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-25T18:10:18Z`, as AUTHORITY requires.
   [MEASURED] Read back: `last_index` **2 → 3**, `last_run_utc` `2026-08-25T18:10:18Z`,
   `last_station` `04-scanner`; re-running `next-sweep.mjs` now returns **`gate-liveness`**.
   The rotation has turned. Status: ` M` (modified, unstaged).
2. This breadcrumb, at the tracked path the REPORT CONTRACT names. Status: `??` (untracked)
   — **Station 00 must sweep it up**, per the REPORT CONTRACT.

[MEASURED] The staged index was re-read after both writes and is **byte-for-byte what I found**: the
single orphaned `R100` of FINDING 1, nothing of mine. I added nothing to it and removed nothing from it.

Nothing else. No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No label changed.
No `/sot/` file read-modified. No staged prompt (0 of my 2-per-run budget used — the S2s below are
instruction defects, and the doctrine for those is a docs PR, not a queue prompt).

## FINDINGS

### FINDING 1 — 🔴 S1 · THE BOARD TRAP IS ARMED IN THE SHARED INDEX RIGHT NOW, AND EVERY ARM RE-ARMS IT

[MEASURED] `git diff --cached --name-status` in `C:\ProjectOperations2` returns exactly one entry:

```
R100  docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md
   →  docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-ready.md
```

[MEASURED] **Both endpoints are gone from disk** — `Test-Path` on the HOLD: `False`; on the `-ready`:
`False`. The HOLD is still tracked at `HEAD`. The prompt was **consumed**: it now lives at
`docs/pr-prompts/processed/pr-sot-04-bp0a-job-canonical-reconcile-ready.md` (+ `.log`, 08-25 16:29Z),
and its work is already open as **PR #1325** (`docs(sot-04): reverse B-P0a direction to Job-canonical`,
CLEAN, 7 pass / 0 fail).

**Consequence:** the next *bare* `git commit` in the dev tree lands a **tracked `*-ready.md` at depth 1
on `main`**. That is the board trap by the back door — thereafter any `checkout`/clone re-arms finished
work, and the watcher re-runs a reconcile that has already shipped.

**This is the SECOND occurrence in 2 h 15 m, with a different prompt.** Station 04 at 14:10Z found the
same shape (`pr-arm-lock-s1…-HOLD → -ready`, both endpoints gone); Station 00 drained it at 16:08Z.
It came straight back. [INFERRED, from the two instances plus the arming convention] the cause is
structural, not clerical: arming *is* `git mv HOLD → ready`, which **stages** a rename; the watcher then
consumes the `-ready` and retires it into gitignored `processed/`; nobody ever commits the rename, so
**every single arm leaves an orphaned R100 in an index shared between chats**. PR **#1323**
(`arm-prompt.ps1 serializer — exclusive lock + index guards`) is the fix in flight and is currently
**RED** (11 pass / 1 fail).

I am READ-ONLY on the board and did **not** drain it. The drain is one command, and it is 00's:

```
git -C C:\ProjectOperations2 restore --staged docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-ready.md
git -C C:\ProjectOperations2 diff --cached --name-status     # read back: must print nothing
```

**RULE 1 on the permanent fix.** *Complete + additive:* land #1323 (index guard in `arm-prompt.ps1`)
**and** make the arm self-closing — the arming step commits its own rename immediately, with a pathspec,
so no arm can ever outlive its index entry. Solves it now and forever, adds no risk to data entry.
*Fails one half:* (b) "00 drains it each run" — complete only until the next arm, and it has already
failed twice in a day; (c) "teach every station to pathspec-commit" — additive and honest, but it does
not stop the landmine being laid, it only stops each station stepping on it.

**DISPOSITION: ESCALATED** — to Marco, via Station 00. Question, not a status update:
*do you want the arm to commit its own rename (self-closing), or do you want the index left dirty on
purpose so you can see what a chat armed before it lands?* I cannot guess that; it is a workflow
preference. The drain above is safe to run either way, today.

### FINDING 2 — 🔴 S2 · 03-machine-minder.md TELLS THE RELAUNCH STEP TO RUN THE WRONG LAUNCHER, AND CONTRADICTS ITSELF ELEVEN LINES OF POLICY EARLIER

[MEASURED] `docs/pipeline/stations/03-machine-minder.md`:

- **:118–119** — "The launcher is **`watcher-launcher-singlelane.ps1`**. Older instructions named a
  different file and called it 'the REAL launcher path'; that was wrong."
- **:234** — "…stop the WRAPPER first, then the node, then relaunch DETACHED via
  **`C:\po-watcher\watcher-launcher.ps1`**" — the exact file :119 disowns.

[MEASURED] Both files exist, and they are different code:
`C:\po-watcher\watcher-launcher.ps1` 2083 B, mtime 2026-08-12T08:19Z ·
`C:\po-watcher\watcher-launcher-singlelane.ps1` 2367 B, mtime 2026-08-18T02:41Z.
So :234 does not fail loudly — it silently relaunches an older, different launcher.
By contrast `00-supervisor.md` says singlelane in **both** places it matters (:235, :839).
**03 is the sole offender, and 03 is the only station that ever performs a relaunch.**

[MEASURED] **The live restarter already knows.** `C:\po-watcher\ensure-watcher.ps1` (authored
2026-08-24 by Station 00) line 10 sets `$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'`,
and **line 59 is a comment reading, verbatim:**
`# The station doc names 'watcher-launcher.ps1'. The RUNNING wrapper is the -singlelane one.`
The discrepancy was spotted two days ago and written into a *script comment* instead of fixed in the
doc — so the wrong instruction is still what an agent reads at the moment it acts.

**Why `lint-station.mjs` passes it:** its guard is
`names watcher-launcher.ps1 && !names watcher-launcher-singlelane.ps1 → fail`. 03 names **both**, so it
admits. The guard tests *mention*; the defect is *which one the imperative sentence points at*. A guard
that can be satisfied by an unrelated sentence elsewhere in the file is not a guard for this.

**RULE 1.** *Complete + additive:* one docs PR fixing :234 to `watcher-launcher-singlelane.ps1`,
**plus** tighten the linter to fail when `watcher-launcher.ps1` appears with no `-singlelane` suffix in
a *directive* context (`relaunch … via <path>`), **plus** delete the now-redundant apology comment at
`ensure-watcher.ps1:59`. Fixes today's wrong line and stops the next one; touches no data.
*Fails "future":* fixing :234 alone — the class of defect returns the next time someone writes the
short name. *Fails "immediately":* linter-only — the wrong line stays live until someone re-runs it.

**DISPOSITION: DISPATCHED** — to **Station 00**, to route as an ordinary docs PR (docs-only, no `/sot/`,
so CP-24 is not in play). I did not stage it as a queue prompt: it is a three-line instruction fix, and
a prompt run would cost more than the edit. Station 00 or 06 should carry it.

### FINDING 3 — 🔴 S2 · STATION 03'S CADENCE IS DAILY IN THE SCHEDULER AND 4-HOURLY IN EVERY INSTRUCTION LAYER — THIS IS WHAT "03 SILENT 17 h" HAS BEEN

[MEASURED] `list_scheduled_tasks`: `03-machine-minder` → `cronExpression: "0 9 * * *"`,
`schedule: "At 09:01 AM, every day"`, `lastRunAt 2026-08-24T23:00:51Z`, `nextRunAt 2026-08-25T23:00:45Z`.
Two consecutive fires 24 h apart. **It runs ONCE PER DAY.**

Against that:
- the 03 bootstrap, line 12: "Cadence: **every 4 hours**, or manually after any crash or reboot"
- `docs/pipeline/STATION-CAPABILITIES.md:170`: "**4 h or manual**"

(For precision: `03-machine-minder.md` itself makes **no** cadence claim — the drift is in the bootstrap
and the capabilities table, two layers, not three.)

[INFERRED, and it closes a standing item] Station 00 has escalated "Station 03 silent 17.2 h" three
times. A 17-hour gap is **exactly correct** for a daily task and **only** looks like a defect against
the 4-hour figure. Three escalation cycles have been spent measuring a machine that was behaving as
scheduled. Cross-check: 00 (`5 */2`), 04 (`0 */4`) and 05 (`10 0`) all match their stated cadence, so
the instrument is not lying generally — 03 is genuinely the odd one out.

**RULE 1 — and this one is a real question, not a typo.** *Complete + additive:* decide the intended
cadence, set the cron to match, **and** fix both instruction layers to agree with it — after which
"is 03 late?" is answerable from any layer. Nothing about it can damage data.
The two branches fail different halves: changing the **docs** to "daily" is complete-and-additive but
may be codifying an accident; changing the **cron** to 4-hourly restores the documented design but
quadruples 03's run rate on a box that sleeps, which is a real operational change — *"immediately"*
passes, *"without damaging"* is unproven.

**DISPOSITION: ESCALATED** — Marco's call, one question:
**should 03-machine-minder run every 4 hours (change the cron) or once a day (change the two docs)?**
Whichever he picks, Station 00 should also delete "Station 03 silent 17.2 h" from the escalation list —
it is not a defect.

### FINDING 4 — S3 · ALL FIVE BOOTSTRAPS AND STATION-CAPABILITIES §2 CARRY A BLINDNESS DIAGNOSTIC THIS RUN FALSIFIES, AND NAME A TOOL THAT NO LONGER EXISTS

[MEASURED] Line 25 of **all five** bootstraps: "If this station appears in the scheduled-task listing,
it is cloud-fired and structurally cannot reach the box."
`STATION-CAPABILITIES.md:51` and `:57` say the same, keyed on a tool called **`list_triggers`**:
"if a station appears in `list_triggers`, it is cloud-fired and **will be blind**."

[MEASURED] **This run refutes it.** `04-scanner` **is** in the listing
(`taskId: "04-scanner"`, `lastRunAt 2026-08-25T18:09:46Z` = this run) **and Desktop Commander reached
the box on the first call.** Every measurement in this breadcrumb is a live Windows probe.
[MEASURED] Further, the tool named does not exist in this session's toolset; the live one is
**`mcp__scheduled-tasks__list_scheduled_tasks`**, and it returns **device tasks** — `03`, `04`, `05`
are all listed and all demonstrably reach the box.

[INFERRED, from project memory written by the concurrent run] Station **00** fired at `18:08:07Z` —
**two minutes before me, on this same box** — and recorded itself as **blind, no Desktop Commander
shell**. I was not. Both stations appear in the same listing. The listing therefore does not predict
blindness even between two runs of two different stations 120 seconds apart; something else does, and
whatever it is, §2 is not measuring it. That is the strongest available evidence that this diagnostic
should be deleted rather than reworded.

Severity is S3 not S2 because the sentence sits under "the diagnostic for *why*", i.e. it is consulted
only **after** the shell has already failed — it cannot by itself stop a healthy run. But it is a
confident wrong answer waiting for the next station that genuinely cannot reach the box: it will send
the reader to "cloud-fired, Marco's to fix" when the cause is elsewhere. Prior art is exact — this is
DOCTRINE §7 lie #1, a liveness verdict from the wrong instrument.

**RULE 1.** *Complete + additive:* one docs PR replacing the listing-based diagnostic with the probe
that actually decides it — "**you are blind iff `start_process` fails; the listing tells you nothing**"
— and rename `list_triggers` to `list_scheduled_tasks` in the §2 table, keeping the table's genuinely
useful column (project memory may be absent). Correct now, correct for any future launch type, and it
removes a rule rather than adding one to remember. *Fails "future":* renaming the tool only — the
falsified inference survives under a new name, which is the worse half of the defect.

**DISPOSITION: DISPATCHED** — to **Station 00**, docs PR, fold into the same PR as FINDING 2 if it
wants one instruction-drift PR rather than two. Evidence for both is in this file.

### FINDING 5 — S3 · THE 04 BOOTSTRAP STILL DESCRIBES SWEEP SELECTION AS A FREE CHOICE FROM A LIST; THE ROTATION IT PREDATES SAYS THAT IS THE FAILURE MODE

[MEASURED] 04 bootstrap: "Take ONE named sweep this run and cover it completely — gate liveness,
instrument honesty, repo hygiene, or instruction drift. **Rotate.**" It names **no** instrument.
`04-scanner.md` AUTHORITY says the opposite: "Which one is **NOT your choice** and **NOT the first on a
list** … **Run `node scripts/pipeline/next-sweep.mjs`**."

[MEASURED] `docs/pipeline/sweep-rotation.json` `_why`, verbatim: *"Without recorded state every fresh
run picks the first entry, which narrows coverage without rotating it — gate liveness gets checked
forever and instruction drift never does."* The bootstrap lists the four sweeps **in rotation order**,
so a run reading only the bootstrap picks `gate-liveness`, permanently.

[MEASURED] The drift is dated, and the direction is unambiguous: bootstrap mtime **2026-08-24T22:54Z**;
`#1315` ("make the sweep rotation real") merged **2026-08-25T05:20Z**. The bootstrap is simply older
than the mechanism. Not a contradiction anyone introduced — a layer that was not updated when the other
moved, which is this sweep's whole subject.

Contained today only because the bootstrap orders the station doc read first, and I obeyed it.
**Sweep rotation is unaffected: this run advanced it (`last_index` 2 → 3).**

**RULE 1.** *Complete + additive:* replace the four-item list in the 04 bootstrap with the one line
"run `node scripts/pipeline/next-sweep.mjs`; it tells you which sweep and it is not your choice",
**and** delete the enumeration so no future reader can pick from it. Removes the ambiguity at source
and keeps the list in exactly one place — the JSON that already carries the state.
*Fails "future":* leaving it and relying on read-order — one bootstrap edit that drops the "read the
station doc" step re-opens it silently.

**DISPOSITION: DEFERRED** — real, not urgent, and **not mine to fix**: the bootstrap lives at
`C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md`, which only Marco edits (STATION-CAPABILITIES §1).
It becomes urgent the moment a 04 run reports a `gate-liveness` sweep two runs running, or reports one
without naming `next-sweep.mjs` — that is the observable symptom, and it is worth a glance in 00's
collect step. Bundle the text with whatever else Marco next pastes into the bootstraps.

### FINDING 6 — S3 · "WHO COMMITS STATION OUTPUT" IS STILL OPEN, AND THIS RUN CAN NOW SETTLE IT ON THE DOCUMENTS RATHER THAN ON PREFERENCE

Third run in three days to hit this; the first two escalated it as a bare contradiction. This one has
an argument, so it should be closable.

[MEASURED] `04-scanner.md` AUTHORITY: "…and **commit that file with your breadcrumb** — if you skip
this, the next run repeats your sweep and the rotation silently stops."
[MEASURED] `next-sweep.mjs --advance` prints the same: "COMMIT THIS FILE with your breadcrumb."
[MEASURED] The **REPORT CONTRACT** in the same file says the opposite: "The breadcrumb is **untracked
until the next board PR commits it** — say so in your chat report so Station 00 sweeps it up."
[MEASURED] `STATION-CAPABILITIES.md:137` grid: 04 → *Create a PR* ❌, *Mutate the board* ❌ read-only.

**Two of those three are wrong about the mechanism, and it is checkable.** [MEASURED]
`next-sweep.mjs` reads the **working-tree** JSON, not `HEAD`: I advanced it without committing, and
re-running it returns `gate-liveness`. So an uncommitted advance **does** rotate the next run. The
premise behind "commit or the rotation silently stops" is false as stated — the thing that stops the
rotation is skipping `--advance`, which I did not skip.

**The tie-break is structural, not a matter of taste.** The REPORT CONTRACT is inside
`<!-- CANONICAL-BLOCK: station-contract v1 -->` — byte-identical across all six station docs and
hash-gated by `lint-station.mjs`. The "commit it" sentence is station-local prose outside the block.
A hash-gated clause that every station shares outranks one station's prose. **The canonical block
wins: stations write, Station 00 commits.** That also matches observed practice — breadcrumbs have
been accumulating uncommitted for days precisely because every station read the block and obeyed it.

I therefore did **not** commit, and there is a second, sharper reason: FINDING 1 means the dev-tree
index currently holds a live landmine. The single most dangerous moment for that landmine is a
`git commit` in the dev tree. Declining to commit while an orphaned `R100` is staged is the correct
call independently of how this contradiction is resolved.

**RULE 1.** *Complete + additive:* delete the "commit that file" clause from `04-scanner.md`
AUTHORITY and the matching line from `next-sweep.mjs`, replacing both with "leave it in the working
tree; Station 00 commits breadcrumbs and rotation state in its sweep" — **and** add the collect step
to 00's doc explicitly so the channel has a named owner rather than an assumption. One rule, one
owner, no station ever commits into a shared index again. *Fails "without damaging":* letting each
station commit its own output — it is the shortest path and it puts every station's hand in the shared
index on every run, which is the mechanism behind FINDING 1.

**DISPOSITION: ESCALATED** — to Marco via Station 00, and it should be the *last* time:
**confirm that Station 00 owns committing breadcrumbs and `sweep-rotation.json`, and I will have the
two contradicting lines removed.** If he prefers stations to self-commit, that is fine too, but then
FINDING 1's fix must land first, because the two cannot safely coexist.

## WHAT I DID NOT DO

- **Did not commit anything.** See FINDING 6 — the canonical REPORT CONTRACT says 00 commits, and the
  index holds a live landmine. Both files are on disk and named above; **Station 00 must sweep them up.**
- **Did not drain the staged rename in FINDING 1.** I am READ-ONLY on the board; the index is
  Station 00's. [MEASURED] Read back at the end of the run: the `R100` is still there, unchanged, and
  nothing of mine joined it.
- **Did not edit `03-machine-minder.md`, `STATION-CAPABILITIES.md`, or any bootstrap.** Findings 2, 4
  and 5 are instruction fixes; a station that silently rewrites another station's instructions is the
  drift, not the cure. Dispatched with the exact lines and the exact replacement text instead.
- **Did not stage a prompt** (0 of 2). Nothing here needs an agent run: two are three-line docs edits,
  two are questions for Marco, one is a one-command drain.
- **Did not run the other three sweeps.** `gate-liveness`, `instrument-honesty` and `repo-hygiene` were
  deliberately untouched — one sweep, covered completely, is the contract. Repo hygiene was last swept
  2026-08-25T14:10Z and its open items (29→31 uncommitted breadcrumbs, `no-pr-opened/` absent from
  `.gitignore`, 4 prunable worktrees) are unchanged and still stand.
- **Did not re-derive the trunk colour** from `status-sweep.ps1`. Its `main branch CI` line is a
  known coin-flip; nothing in this sweep depended on it.
- **Did not touch Azure / Entra / SharePoint.** Nothing in this sweep goes near them.

---
*Provenance: every line tagged. Ground SHA `019c7579` (origin/main), dev tree `b968e4f1`.
A claim that outlives its SHA is a lead, not a finding.*
