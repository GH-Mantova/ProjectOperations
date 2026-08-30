# Station 04 — Scanner | 2026-08-26T14:10:41Z–2026-08-26T14:24Z

Sweep this run: **instruction-drift** (`next-sweep.mjs` rotation position 4 of 4; previous run
2026-08-26T10:10:52Z). Covered completely; rotation advanced at the end of this file.

## GROUND

```
UTC            2026-08-26T14:10:41Z
origin/main    cfc74982              (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 7ad50697       C:\ProjectOperations2   (5 behind origin/main, 0 ahead)
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (station_doc_version in the scheduled-task SKILL.md)
```

Versions AGREE — this run was NOT read-only-by-mismatch.

Desktop Commander reached the box first call at 14:10:41Z (`start_process`, `powershell.exe`).
**This was not a blind run.** Every line below tagged `[MEASURED]` was produced by a probe on the
Windows host; the commands are quoted so they can be re-run.

## WHAT I MEASURED

### A. Board state at 14:11:31Z, from `scripts/pipeline/status-sweep.ps1`

`[MEASURED]` Instrument positive controls both PASSED (`gh` saw merged PR #1339; `node` runs), so
the report is trustworthy per its own §0 rule.

- OPEN PRs: **2** — **#1340** (`feat(lint-prompt): guard stale prompts against deleting a
  BACKLOG.yaml pointer`) CLEAN, CI 13/0/0 green; **#1337** (`feat(rates-consumers): route persona
  lookup + rates export through RateResolverService — SLICE 3`) CLEAN, CI 13/0/0 green.
- **#1336 MERGED 2026-08-26 12:24Z** — the human-gate detector landed.
- armed (`*-ready.md` at depth 1): **0**. in-progress prompts: **0**. git `index.lock`: absent both
  trees. git processes: 0. Verdict: **SAFE TO ACT**.
- Watcher clone on `feat/orphaned-discharge-guard`, dirty=37 — that is #1340's branch, not drift.
- 🔴 **I did NOT read a trunk colour from this tool.** `status-sweep.ps1` says "trunk green"; per the
  standing trap that line is a coin flip. Not repeated as a finding either way.

### B. Instruction-drift sweep — the clean half, so a future run need not redo it

`[MEASURED]` `node scripts/pipeline/lint-station.mjs` → **ADMIT, all 7 docs clean, exit 0.** One
advisory only: `04-scanner.md` "names a Windows path outside the known folder map: `C:\po-scan-`" —
that is the deliberately commented-out superseded worktree block, not drift.

`[MEASURED]` **Version parity, all five scheduled bootstraps against the doc each points at:**

| task | bootstrap ver | doc | doc ver | verdict |
|---|---|---|---|---|
| 00-supervisor | 1 | 00-supervisor.md | 1 | MATCH |
| 02-board-driver | 1 | 02-board-driver.md | 1 | MATCH |
| 03-machine-minder | 1 | 03-machine-minder.md | 1 | MATCH |
| 04-scanner | 1 | 04-scanner.md | 1 | MATCH |
| 05-sot-keeper | 1 | 05-sot-keeper.md | 1 | MATCH |
| weekly-security-audit | none | — | — | points at no station doc; names only `scripts/security-audit.ps1`, which EXISTS |

All five bootstraps carry mtime `2026-08-24T22:54:22Z` and 5251–5340 bytes. The earlier standing
note that **02-board-driver's scheduled file had not been touched since 2026-07-14 is now STALE** —
it was rewritten with the others on 08-24. `06-pr-master.md` has no scheduled bootstrap, which is
correct: STATION-CAPABILITIES §6 lists 06 as on-demand only.

`[MEASURED]` **The bootstrap that actually governed this run is byte-identical to the one on disk.**
Uploaded `<scheduled-task>` file and `C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` both
5276 bytes, sha256(12) `2f34d1e53ef5`, `identical(raw)=true`. There is no third, drifted copy.

`[MEASURED]` **Encoding: zero damage anywhere.** All 6 station docs and all 6 bootstraps: `bom=false`,
`U+FFFD count = 0`, `U+00E2 U+20AC` double-encode signature count = 0. Read with node, not
`Get-Content` (DOCTRINE §9.3).

`[MEASURED]` **Windows paths named in the bootstraps: 22 of 22 resolve.** Including
`C:\ProjectOperations2\scripts\security-audit.ps1`.

`[MEASURED]` **Repo-relative paths named across DOCTRINE + STATION-CAPABILITIES + all 6 station
docs: 64 distinct, 60 resolve, 4 do not.** Controls run alongside:
`docs/pipeline/DOCTRINE.md` → true, `docs/pipeline/THIS-DOES-NOT-EXIST.md` → false.

🔬 **Instrument lie caught and corrected mid-sweep.** My first pass reported **8** missing paths. Four
of them — `SettingsShell.ts`, `metadata-catalog.js`, `relationship-map.js`, `sweep-rotation.js` —
were my own regex: the extension alternation had `ts` before `tsx` and `js` before `json`, and a
lazy quantifier took the first match, truncating `.tsx`/`.json` and inventing files that were never
named. Reordering the alternation dropped the count to 4. **Recording this because a station report
that quotes 8 here would have sent 06 to fix four phantom references.** (DOCTRINE §7, shape: a
broken measurement of a working system.)

### C. The four dead path references, cross-checked three ways each

`[MEASURED]` For each: `Test-Path`, `git check-ignore --no-index -v`, `git ls-tree -r origin/main`.

| path | on disk | gitignored | tracked on origin/main | named in |
|---|---|---|---|---|
| `docs/pr-prompts/AWAITING-MARCO-DECISION.md` | no | no | no | 02-board-driver.md:230, :292 |
| `docs/pr-prompts/triage-state.md` | no | no | no | 03-machine-minder.md:148, :157, :158, :161, :165 |
| `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` | no | no | no | 04-scanner.md:159 |
| `docs/qa/qa-github-audit.md` | no | no | no | 04-scanner.md:182 |
| **control** `docs/qa/qa-findings.md` | **yes** | **yes, `.gitignore:107`** | no | — |
| **control** `docs/pipeline/DOCTRINE.md` | **yes** | no | **yes** | — |

The two controls matter: they prove the probe distinguishes "absent", "present-and-ignored", and
"present-and-tracked". An empty `check-ignore` result here is a real negative, not a blind one.

### D. The launcher, measured to the source

`[MEASURED]` `Get-ScheduledTask` → `TASK=PO Watcher Keepalive STATE=Running EXEC=powershell.exe
ARGS=-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\ensure-watcher.ps1"`.

`[MEASURED]` `C:\po-watcher\ensure-watcher.ps1:10` → `$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'`.

`[MEASURED]` `C:\po-watcher\ensure-watcher.ps1:59` carries this comment **in the source**:
`# The station doc names 'watcher-launcher.ps1'. The RUNNING wrapper is the -singlelane one.`
Somebody already noticed and fixed the script instead of the doc.

`[MEASURED]` Existence: `C:\po-watcher\watcher-launcher.ps1` = **True**;
`C:\po-watcher\watcher-launcher-singlelane.ps1` = **True**. Only one `*singlelane*` file exists on
either tree (control: the same recursive search finds `ensure-watcher.ps1` where expected).

`[MEASURED]` The live watcher: node **PID 29024**, created 2026-08-24 15:35:04 local, cmdline
`"C:\Program Files\nodejs\node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`
— matched by exact cmdline regex `pr-watcher[\\/]index\.mjs`, never by image name.

### E. A near-miss on the board trap, observed and then gone

`[MEASURED]` At **14:11:10Z** the dev tree index carried a staged rename
`R100 docs/pr-prompts/pr-rates-consumers-s3-persona-export-HOLD.md -> ...-ready.md`, and at
**14:16Z neither endpoint existed in the working tree** (`Test-Path` false for `-HOLD.md`,
`-ready.md` and `-b-ready.md`; depth-1 `*-ready.md` count = 0). Committing that index would have
produced a **tracked depth-1 `*-ready.md`** — the exact board trap 04's authority section says to
report — because `.gitignore:75` cannot suppress a path already in the index, and PR #1337 for that
work is already open.

`[MEASURED]` At **14:17:45Z** the index was **empty** (`git diff --cached --name-status` returned
nothing). A concurrent Station 00 run landed at 14:09Z (breadcrumb
`00-00-supervisor-2026-08-26-1409-verdict-lane-refuted-06-arms-out-of-lane-both-prs-marco-gated.md`)
and cleared it. `[MEASURED]` Tracked depth-1 `*-ready.md` on `origin/main`: **0** — control: the
same `git ls-tree -r` query returns **440** entries for `docs/pr-prompts`, so it is not blind.

**The trap did not fire.** Reporting the mechanism, not an incident. This is the same "every arm
leaves an orphaned R100 in the shared index" already on record — folded, not re-filed.

### F. History check (five-angle, angle 4)

`[MEASURED]` No existing prompt in `docs/pr-prompts/pr-*.md` mentions `watcher-launcher`,
`singlelane`, `03-machine-minder`, `AWAITING-MARCO-DECISION`, `triage-state`, or "instruction
drift". Control: 54 of the same files match the string `premise`, so the grep is not blind.
Nothing here duplicates queued work.

## WHAT CHANGED

Two files written, **both untracked, neither committed, index untouched**:

1. `docs/pr-prompts/pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md` — staged fix
   prompt, `size: 2`, docs-only.
2. This breadcrumb.

`docs/pipeline/sweep-rotation.json` advanced (see the last section).

**I did not touch the git index, did not commit, did not push, did not arm, disarm, rename or move
any prompt, and did not run any mutating script.** `git add` was deliberately NOT run on the staged
prompt: the dev tree's index is shared with concurrent chats (DOCTRINE §9.2), and a concurrent 00
run was demonstrably active during this run.

**Verification of the staged prompt, before I called it staged:**

- `[MEASURED]` `node scripts/pipeline/lint-prompt.mjs <file>` → **ADMIT (size 2), exit 0.** `gh` is
  reachable (status-sweep §0 control), so this is not the "REJECT because `gh` is missing" instrument
  failure in reverse.
- `[MEASURED]` ADMIT is necessary, not sufficient — so I also read the body: no
  `<!-- watcher: do-not-arm -->`, no literal `DO NOT ARM`, no `docs/approvals/` gate. It is genuinely
  armable. **Arming is still 00's call on Marco's authority; I am not asking for it to be armed now.**
- `[MEASURED]` Premise executed for real: `grep -q "watcher-launcher\.ps1"
  docs/pipeline/stations/03-machine-minder.md` → **exit 0** (work still needed). Positive control
  (grep a string that IS present) → 0. Negative control (grep a string that is NOT) → 1. The premise
  ran; it did not spawn-fail into a misread (DOCTRINE §7 lie #3).
- `[MEASURED]` **Premise dies on landing (LL-54):** both grep-negation clauses of `done_when`
  currently exit 1, and the positive clause exits 0, so the pair inverts exactly when the fix lands.
  The prompt body explicitly forbids leaving the literal `watcher-launcher.ps1` in an explanatory
  aside, which is the only way this prompt could re-fire forever.
- `[MEASURED]` Encoding: `bom=false`, `U+FFFD`=0, double-encode signature=0, front matter on line 1,
  and the STANDING AUTHORITY literal `STANDING AUTHORITY to finish the work, commit, push` present
  (`String.includes`, the exact form the checker uses — not a paraphrase, not a heading).

## FINDINGS

### F1 — `03-machine-minder.md:234` tells Station 03 to relaunch the watcher through a wrapper the machine does not use. S2.

Line 234: *"relaunch DETACHED via `C:\po-watcher\watcher-launcher.ps1`"*. Lines 118–119 of the same
file already say the launcher is `watcher-launcher-singlelane.ps1` and that "older instructions
named a different file … that was wrong". `ensure-watcher.ps1:10` — the script the live
`PO Watcher Keepalive` task actually executes — sets the singlelane path, and its line 59 comment
names the station doc as the thing that is wrong.

**Why it has survived:** both files exist on disk, so a `Test-Path` sanity check passes on the wrong
one and nothing errors. This is an empty-result-is-not-an-empty-world failure wearing a different
hat — the guard that would have caught it cannot distinguish "the file I named" from "the file that
runs".

**Blast radius:** one station (03), one action (relaunch after a crash or reboot) — but that action
is the recovery path, so it fails at exactly the moment it is needed. First reported 2026-08-25
18:10Z as a report-only finding; **still unfixed 20 h later**, which is why this run converts it
into executable work rather than reporting it a third time.

**DISPOSITION: ACTIONED** — staged, lint-clean, at
`docs/pr-prompts/pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md`. Verified as
described under WHAT CHANGED. **It is on disk and UNTRACKED, therefore not yet real
(PROMPT-SCHEMA: "a prompt is not real until it is committed to origin/main"). Station 04 cannot open
a PR. Station 00 must sweep it into the next board commit, or it is invisible to every station.**

### F2 — `04-scanner.md` asserts all `docs/qa/` state files are gitignored; they are not, and the same doc then orders a write to a tracked path. S3.

The HARD RULES block says *"Tracked-file writes: NONE except staged prompt files and docs/qa/ state
files (all gitignored)"*. `.gitignore` ignores exactly five entries (lines 106–110), and
`git ls-tree -r origin/main -- docs/qa` returns **five tracked entries**. Line 182 then says
`docs/qa/qa-github-audit.md` — not ignored, not present — *"create if absent"*. **Obeying line 182
violates the HARD RULE in the same document.** Line 159 additionally points a recovery step at
`docs/qa/Master-QA-and-Consolidation-Program-Plan.md`, which exists nowhere; `.gitignore:105` even
carries a comment about "the Master Plan doc" that is not there.

**Why it matters beyond tidiness:** this is the same class as the nine-day `qa-findings.md` swallow.
A station told that its state directory is safely ignored will write there confidently, and either
dirty the tree for every other station or lose the finding entirely.

**DISPOSITION: ACTIONED** — folded into the same staged prompt as DEFECT 2, with the corrective
wording specified and a `done_when` clause that greps for the removal of the false parenthetical.
Same untracked caveat as F1.

### F3 — `03-machine-minder.md` reads decision history out of a file that has never existed, and would silently read "no" where the truth is "unknown". S3.

`triage-state.md` is named five times. Line 148 says *"create if absent"* — so 03 never crashes. But
line 161 gates a real decision on it: *"the same root cause already burned one failed fix attempt
per triage-state.md"*, and lines 157/158/165 read and append history. Against a file 03 just created
empty, that check **always answers "no prior attempt"** — a silent false negative on the exact
question the rule exists to answer (DOCTRINE §9.6: an empty result is not an empty world).
Compounding it: `docs/pr-prompts/triage-state.md` is **not** gitignored and Station 03 cannot open a
PR, so every copy 03 creates is a permanent untracked file that no run can inherit.

**00 has already adjudicated the file's existence and 03 did not follow.** `00-supervisor.md:352`
reads: *"~~docs/pr-prompts/triage-state.md~~ - REMOVED: this file does not exist on main (checked
2026-08-24)."* Two station docs in one repo disagree about the same path, and the one that checked
is the one that gave it up.

**DISPOSITION: ESCALATED** — deliberately NOT folded into the staged prompt, because the fix is a
design choice only Marco can make, and guessing it would bake a guess into a station doc.

**RULE 1 — complete-and-additive first, and which half each alternative fails:**

- **(a) Give 03 a durable, writable home: point `triage-state.md` at a path inside `.gitignore`'s
  existing `docs/qa/qa-run-*.md` family (or add one line to `.gitignore`), AND change lines
  157/161 so an absent or empty file reads as UNKNOWN, never as "no prior attempt".** Passes both
  halves: solves it now and in future (03 keeps its memory across runs), and damages no existing or
  future data — it adds a file class rather than changing one. **Recommended.**
- **(b) Have 03 write the triage state into its breadcrumb instead and delete the five
  `triage-state.md` references.** Fails the *complete* half: breadcrumbs are per-run, so 03 still
  cannot answer "did a previous run already burn a fix attempt on this cause?" without reading every
  prior breadcrumb — the exact history the rule needs.
- **(c) Leave it: 03 creates the file each run and the history check quietly answers "no".** Fails
  the *complete* half outright, and fails the *no-damage* half in a subtle way — it will re-stage a
  fix that already burned a run, which is a wasted agent run and a second bug on top of the first.

### F4 — `02-board-driver.md` orders an escalation index rewritten every run into a file that has never existed. S3.

Lines 230 and 292 tell 02 to *"Overwrite `docs/pr-prompts/AWAITING-MARCO-DECISION.md` each run"* with
the escalation table, and to write "None — all open PRs are flowing…" when it is empty. The path is
not on disk, not gitignored, and not on `origin/main`. 02 runs on dispatch only, so this has
plausibly never fired — but the consequence is that **rule 6c's escalation summary has no artifact
and never has had one.**

Lower severity than it looks: DOCTRINE §5b makes `needs-marco/` the only real stop, and 02 is also
told to write `needs-marco/pr-{n}-{reason}.md`, which IS gitignored and IS the binding mechanism.
`AWAITING-MARCO-DECISION.md` is a convenience index on top of a stop that works.

**DISPOSITION: ESCALATED**, bundled with F3 — same shape, same question, one decision should settle
both. **The question for Marco, in one line: do you want a single tracked, human-readable index of
what is waiting on you, or is `needs-marco/` plus the station breadcrumbs enough?** If yes to the
index, it wants a home a station can actually commit to (only 05 and 06 can open PRs). If no, both
references should be deleted rather than left pointing at nothing.

### F5 — The instruction layer is otherwise healthy, and this should be said out loud. No severity.

`lint-station.mjs` ADMIT 7/7. All five bootstrap/doc version pairs MATCH at v1. The bootstrap that
ran this turn is byte-identical to the one on disk. 22/22 Windows paths and 60/64 repo paths resolve
(the 4 are F2/F3/F4). Zero encoding damage across 12 files. No bootstrap carries the disproved
"the raw CDN lags" advice or the retired MAIN/OldMain/Chat routing model. The multi-copy drift that
motivated this sweep — five pasted files drifting independently for weeks — **is currently closed at
the bootstrap layer**; what remains is drift *inside* the repo docs, which is the layer an agent can
fix.

**DISPOSITION: DEFERRED** — nothing to do. Recorded so the next instruction-drift run can spend its
budget on the doc bodies rather than re-verifying the bootstraps. This becomes urgent again the
moment any file under `C:\Users\Marco\Claude\Scheduled\` changes mtime off `2026-08-24T22:54:22Z`.

### F6 — Station 06 has produced SEVEN consecutive malformed breadcrumbs today. Its report channel is closed. S2.

`[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs` → **REJECT, 7 malformed of 41 checked**,
and **all seven are Station 06, all from today**: `…-1133-…`, `…-1156-…`, `…-1226-…`, `…-1253-…`,
`…-1318-…`, `…-1345-…`, `…-1415-…`. Every one fails the same two checks — *"no `# Station <NN>`
heading"* and *"FINDINGS section carries no disposition"* — and `…-1415-…` additionally has
*"section out of order: ## FINDINGS"*. All seven are also UNTRACKED. Zero breadcrumbs from 00, 04
or 05 are malformed; this run's own breadcrumb ADMITs, which is the positive control that the
checker is not simply rejecting everything.

**This is not two stale files.** The prior record noted two (1133, 1156). It is now seven, arriving
roughly every 25–30 minutes through the day, so the rate is the finding: **06's output is being
generated and discarded, live, right now.** Station 00 collects findings by reading breadcrumbs; a
breadcrumb the checker rejects is a finding that never enters the one channel that closes.

**The doc is not the problem — the runs are.** `lint-station.mjs` ADMITs `06-pr-master.md` at v1
with the canonical contract intact, and 06 is the one station with no scheduled bootstrap, so
nothing is feeding it a drifted pasted copy. Whatever is invoking 06 on this cadence is not
following the contract in its own station doc.

**DISPOSITION: DISPATCHED to Station 06** — fix is mechanical and costs one line plus one word per
finding: open each breadcrumb with `# Station 06 — PR Master | <UTC start>–<UTC end>`, keep the
fixed section order (`GROUND` → `WHAT I MEASURED` → `WHAT CHANGED` → `FINDINGS` → `WHAT I DID NOT
DO`), and end every finding with one of ACTIONED / DISPATCHED / ESCALATED / DEFERRED spelled
literally — or state plainly that there were no findings. Re-run `check-breadcrumb.mjs` and require
exit 0 before considering a run finished. **Station 00: the content of those seven files has not
been collected by anyone; they are worth reading by hand before they are committed or lost.**

## WHAT I DID NOT DO

- **Did not run Part 0 (static cross-layer audit) or Part 1/2 (GitHub reconciliation, live-site
  visual patrol).** The station contract says take ONE named sweep and cover it completely, and
  `next-sweep.mjs` named instruction-drift. A shallow pass over everything is the failure mode that
  rotation exists to prevent. Part 0 sub-check (a) has not run this cycle — the next scanner run
  whose rotation lands on a Part 0-bearing sweep owns it.
- **Did not `git add` the staged prompt or this breadcrumb.** The index is shared and a Station 00
  run was concurrently active (14:09Z). Both files are untracked and I have said so plainly rather
  than letting "staged" imply "queued".
- **Did not commit or push anything.** 04 cannot open PRs (STATION-CAPABILITIES §5).
- **Did not arm, disarm, rename, move or delete any prompt.** The staged file is `-HOLD`, and
  `-HOLD` is where it stays until 00 decides otherwise.
- **Did not clear, touch or investigate any lock.** None existed (`index.lock` false in both trees,
  0 git processes at 14:11:31Z).
- **Did not act on the orphaned worktrees** (4 reported by status-sweep). Deletion is irreversible
  and it is 03's lane on 00's dispatch. The standing note that 3 of the 4 hold already-shipped work
  was not re-measured this run and should not be treated as current.
- **Did not quote a trunk colour**, and did not touch `.gitignore`, `ensure-watcher.ps1`, any script,
  anything under `sot/`, or anything Azure / Entra / SharePoint.
- **Did not mint a throwaway worktree.** All reads were against the dev tree, `origin/main` via
  `git show`/`ls-tree`, or the Windows filesystem directly.

## FOR STATION 00 — three asks, in order

1. **Commit the two untracked files** (`pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md`
   and this breadcrumb) plus the advanced `docs/pipeline/sweep-rotation.json` in the next board
   commit. Until then the prompt is a TODO, not a queue entry.
2. **Decide whether to arm the staged prompt.** It is ADMIT, body-clean, premise verified LIVE with
   controls, docs-only, `size: 2`. The lane was free at 14:11Z (armed=0) — **re-measure before
   arming; that reading is minutes old by the time you read this.**
3. **Put F3+F4 to Marco as one question** (durable home for station state files vs. delete the dead
   references). RULE 1 options are written out under F3.
