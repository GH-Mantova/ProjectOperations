# Station 00 — Supervisor | 2026-08-29T22:09:27Z–2026-08-29T22:45Z

## GROUND

```
UTC            2026-08-29T22:09:27Z
origin/main    5017c6d1            (git fetch origin --prune, then rev-parse)
dev tree       main @ 5017c6d1     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

**Version check: MATCH.** This was a **SIGHTED** run — `start_process` on `powershell.exe` returned
PID 7680 on the first attempt. Blindness alternation now reads 14:09 blind · 16:09 sighted · 18:09
blind · 20:09 sighted · **22:09 sighted**.

## WHAT I MEASURED

**Board — empty.** `[MEASURED 22:10Z]`

```
gh pr list --state open --json number,title,mergeStateStatus,isDraft,labels
[]
```

Read as a raw JSON string, not a `.Count` — the literal output is `[]`. **Zero open PRs, therefore
zero DIRTY, therefore no conflicted branch is freezing anyone's CI.**

**Queue — nothing armed.** `[MEASURED 22:10Z]`
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0** files. An idle watcher with 0 armed
prompts is CORRECT, not wedged.

**Watcher — ALIVE, and properly supervised.** `[MEASURED 22:10Z]`
Resolved by COMMAND LINE, per the ENSURE-UP probe as corrected in #1396:

- `node.exe` PID **26364** — `C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`
- three wrappers, PIDs **10364 / 23100 / 2984**, all
  `-File "C:\po-watcher\watcher-launcher-singlelane.ps1"`

The #1396 fix is doing its job: the old probe matched only `supervise-watcher.ps1` and would have
reported this triple-supervised watcher as an ORPHANED NODE.

**Sweep — SAFE TO ACT.** `[MEASURED]` `scripts/pipeline/status-sweep.ps1` completed
2026-08-29 22:09:38Z: *"SAFE TO ACT: no board mutation in progress, no recent remote activity."*
Backlog gates unchanged: `ready=1 needs-marco=2 blocked=4 broken=0`.

**Dev tree — still converged.** `[MEASURED 22:09Z]` `git rev-list --left-right --count
origin/main...HEAD` → `0	0`; `git diff --cached --name-status` → empty. The 19 untracked twins
that blocked the ff at 20:09Z did not regrow this cycle, because no collecting PR has run since.

**OAuth — EXPIRED, ELEVENTH reading AT SOURCE, and the file has not moved in 30 hours.**
`[MEASURED 22:11Z]` `C:\Users\Marco\.claude\.credentials.json` — length **1649 B**, mtime
**2026-08-28 16:13:26Z**, `expiresAt` **1787933615984** = 2026-08-28T16:13:35Z. Unchanged byte-for-byte
since the 08-28 20:09Z reading. **Nothing is refreshing it, so the execution lane is still down and
ARM NOTHING still stands.** The stillness on this board is a correctly-held brake, not health and
not a stall.

**Collection — no new breadcrumbs since my 20:09Z run.** `[MEASURED]`
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0, 105 checked, 0
malformed, no station SILENT (00 2.0h · 03 23.1h · 04 4.0h · 05 8.0h, all inside 2× cadence).
`git ls-tree -r --name-only origin/main -- docs/pr-prompts` confirms my own 20:09Z breadcrumb
landed in #1396 — the freshest per station are 00 @2009Z, 04 @1810Z, 05 @1412Z, 03 @08-28 2302Z.
**There was nothing to collect. 04's 22:10Z run had not yet fired when I measured.**

**The collector's `NAME_RE` is case-sensitive, and it is the validator's only gate.** `[MEASURED]`

```
const NAME_RE = /^00-(\d\d)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([a-z0-9-]+)\.md$/;
```

A file this pattern does not match is not validated, not counted, and does not exist as far as
`--freshness` is concerned. Measured against `docs/pr-prompts`: **149 `00-*` files, 112 matched,
37 invisible.** Four of the 37 are post-contract, and every one of them is a report whose author
CAPITALISED because the news was bad:

```
00-00-supervisor-2026-08-25-0408-BLIND-no-dc-pr1314-marco-gated-watcher-live.md
00-00-supervisor-2026-08-25-1009-BLIND-no-dc-five-prs-all-marco-gated.md
00-00-supervisor-2026-08-25-1810-BLIND-no-windows-shell-all-8-marco-gated.md
00-00-supervisor-2026-08-26-0410-BLIND-no-dc-four-marco-gated-board-frozen-6h.md
```

**Simulation before the fix, and this is the part that matters.** `[MEASURED]` I copied the script
to `%TEMP%`, widened the two character classes to `[A-Za-z0-9-]`, and ran it against the untouched
tree:

```
structure: 109 checked, 3 malformed, 9 skipped as pre-contract
REJECT: 3 malformed breadcrumb(s)      EXIT=1
```

So the naive one-line fix turns a required CI check RED. Three of the four previously-invisible
reports are genuinely malformed — `0408` missing WHAT CHANGED and the did-not-do section; `1009`
missing **all five** (it used numbered headings); `0410` missing WHAT CHANGED and FINDINGS. They
were never well-formed, because nothing ever asked them to be.

*(Section names are written here without their `##` prefix deliberately: the validator locates each
section with `indexOf`, so quoting a later section's literal heading inside an earlier section makes
your own report fail `section out of order`. My first draft of this file did exactly that. Harmless,
self-correcting, and noted so the next station does not lose ten minutes to it.)*

**This is the third time this defect has been found.** `[MEASURED]` A breadcrumb already on main
is named `00-00-supervisor-2026-08-26-0610-blind-no-dc-collector-drops-uppercase-breadcrumbs.md`.
Station 04 re-found it on 2026-08-29 as F6 and I dispatched it to 06 at 20:09Z. **It has sat
unfixed for three days while being correctly reported twice.**

**Half of that same dispatch was already dead when I sent it.** `[MEASURED]` I dispatched
"swap `git ls-files` → `git ls-tree -r origin/main`" to 06 at 20:09Z. `check-breadcrumb.mjs:90`
already reads `git ls-tree -r --name-only origin/main -- ${DIR}` with an `ls-files` fallback — it
landed in **#1390, merged 2026-08-29T08:28:35Z**, twelve hours before I dispatched it. I dispatched
a finished job off a stale memory line instead of reading the file.

**No unit test constrains `NAME_RE`.** `[MEASURED]` `git grep -l check-breadcrumb` returns exactly
one test, `scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs`, which exercises
`checkGitignoredSink` only.

## WHAT CHANGED

**PR #1397** — branch `fix/breadcrumb-name-re-uppercase`, authored in a disposable worktree
`C:\po-worktrees\cb-name-re` off `origin/main`, never in the dev tree and never in the watcher
clone.

1. **`scripts/pipeline/check-breadcrumb.mjs`** — `NAME_RE`'s station segment and slug widened from
   `[a-z0-9-]+` to `[A-Za-z0-9-]+`, with a comment recording the measurement and the rule
   *widened, never narrowed*.
2. **Three historical breadcrumbs repaired** — `2026-08-25-0408`, `2026-08-25-1009`,
   `2026-08-26-0410`. Only the missing contract HEADINGS were inserted, each carrying an explicit
   italic provenance note saying the heading was added on 2026-08-29, why the file was never
   flagged, and that **nothing below it was rewritten or reconstructed**. No original sentence was
   deleted, reordered or paraphrased. The `1009` file kept its numbered headings; the canonical
   names were inserted alongside them.

**Read back, in the worktree, after the edits:** `[MEASURED]`

```
node scripts\pipeline\check-breadcrumb.mjs --freshness
structure: 109 checked, 0 malformed, 9 skipped as pre-contract
CLEAN      EXIT=0
```

**109 checked, up from 105 — the four shouting reports are now inside the validator's field of
view, and the check is green.**

## FINDINGS

**F1 — The breadcrumb validator was blind to exactly the reports it most needed to see.**
`NAME_RE` was case-sensitive; 37 of 149 `00-*` files fell straight through it, and all four
post-contract escapees were `-BLIND-` reports. Three of those four turned out to be structurally
malformed and nobody ever knew. A validator that skips the loud reports and then prints `CLEAN` is
worse than no validator, because `CLEAN` reads as coverage. **ACTIONED** — widened in #1397,
verified by re-running the check in the worktree: 109 checked / 0 malformed / exit 0, up from 105
checked.

**F2 — The naive form of this fix takes a required CI check red, and I only know that because I
simulated it first.** Widening the regex alone yields `3 malformed, EXIT=1`. Under RULE 1 the
complete-and-additive option is to widen the gate *and* repair what it newly sees; the alternative
— date-exempting the three files — fails the "future" half, because the exemption list becomes the
new hiding place. **ACTIONED** — both halves shipped in one PR; the exemption option was rejected,
not overlooked.

**F3 — A correctly-reported, correctly-dispositioned finding sat unfixed for three days.** The
uppercase-blindness defect was named in a breadcrumb filename on 2026-08-26, re-found by 04 on
2026-08-29, dispatched by me to 06 at 20:09Z, and was still live at 22:09Z. **06 has no schedule**
— recorded in `00-00-supervisor-2026-08-26-1609-armed-sot02-and-06-has-no-schedule.md` — so
"DISPATCHED → 06" is not a disposition that closes anything; it is a disposition that parks
something. **ESCALATED.** Marco, one question, RULE 1 applied:

> **06 has no cadence, so every item dispatched to it stops moving. Which?**
>
> **(A) Give 06 a schedule** (e.g. every 6h, like the other stations). *Complete and additive:*
> fixes it immediately AND for every future dispatch, and takes nothing away — 00/04/05 keep their
> lanes, the dispatch verb starts meaning something. Cost: one more scheduled task consuming the
> same OAuth token that is currently expired, so it would do nothing until that is refreshed.
>
> **(B) Retire "DISPATCHED → 06" and let 00 action those items itself**, as I did this run.
> *Fails the "future" half:* it works, but it re-concentrates board work in one station, which is
> the LL-38 collision shape the lanes exist to prevent.
>
> **(C) Leave it.** *Fails both halves:* items keep parking, and the word DISPATCHED keeps
> reading like a closure to whoever collects next.

**F4 — I dispatched a job that had already merged twelve hours earlier.** The `ls-files` →
`ls-tree` swap landed in #1390 at 08:28Z; I dispatched it at 20:09Z from a memory line instead of
reading `check-breadcrumb.mjs:90`. **ACTIONED** — the dispatch is withdrawn here in writing so 06
does not redo it, and the standing memory line has been corrected. The general lesson is the one
DOCTRINE §7 already states: a memory note describes the past, and re-reading the file costs one
command.

**F5 — Execution lane still down: OAuth expired 30 hours ago and nothing is refreshing it.**
Eleventh reading at source, byte-identical to the tenth. **ESCALATED** (already open, unanswered —
this is a re-statement, not a new question): only Marco can re-authenticate, and the separate
question of whether to build a pre-arm expiry guard is still unanswered.

## WHAT I DID NOT DO

- **Armed nothing.** The OAuth block stands: arming into a dead execution lane burns the prompt.
  0 armed at the start of this run, 0 at the end.
- **Merged no watcher-routed PR.** Vacuously true — the board is empty — but RULE 2 stands.
- **Did not touch `/sot/`.** #1397 carries no `sot/` path, so CP-24 has nothing to fail on.
- **Did not run `git` from the Linux mount** against the Windows `.git`. Every git command in this
  run went through PowerShell on the box.
- **Did not `git checkout .` / `reset --hard` / `stash pop` / `clean` anywhere.** The board trap is
  how dead prompts come back armed.
- **Did not repair the 33 pre-contract invisible files.** They sit before `CONTRACT_FROM`
  (2026-08-25T0000) and are skipped by design; repairing them would be fabricating compliance with
  a contract that did not exist when they were written. DEFERRED, and it becomes urgent only if
  `CONTRACT_FROM` is ever moved backwards.
- **Did not fast-forward the watcher clone.** Who may do that is still an open question to Marco;
  00 is barred and 03 is report-only.
