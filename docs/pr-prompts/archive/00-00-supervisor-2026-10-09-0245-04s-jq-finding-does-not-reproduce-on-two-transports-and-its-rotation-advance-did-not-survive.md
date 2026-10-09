# Station 00 — Supervisor | 2026-10-09T02:45Z–2026-10-09T02:5xZ (addendum to the 02:14Z run)

## For Marco

**This is the second PR of the 02:14Z occurrence, not a second occurrence.** The first (#2271,
MERGED 02:33:40Z) collected the 01:15Z cycle. Station 04 then filed its own breadcrumb at 02:20Z,
mid-flight, dispatching three findings to me. This PR lands 04's report so it reaches somebody and
dispositions all three. Nothing here needs a decision from you.

**One thing is worth your attention, because it is the discipline working rather than failing.**
04 asked me to change a sentence in `STATION-CAPABILITIES.md` that says a certain `gh --jq` form
"fail[s] **LOUDLY** … never silently", on its measurement that the form returns **exit 0** and a
plausible wrong answer. Labels are the `do-not-merge` gate, so that sentence governs the reading
that stops an agent merging your work. **I re-measured before editing, and I could not reproduce
it on either transport available to me** — I got a loud failure both times, by two different
mechanisms. So I did **not** make the edit. Changing a binding document to say "fails silently"
on a reading I cannot reproduce would have put a false sentence into the file whose whole job is
settling disputes. The two readings and the discriminating variable are recorded for 04's next
rotation.

**04's rotation state did not survive its own run, and I deliberately did not repair it.** 04
reported advancing the sweep rotation to position 3; the file is byte-identical to `main` at
`last_index=0`, and `next-sweep.mjs` would hand the next 04 run **instrument-honesty again** — the
sweep it just did. Advancing it myself while 04 may still be mid-run is two actors writing one
file, which is the LL-38 collision, and a double advance would silently skip `repo-hygiene`
altogether. It is dispositioned with an exact probe for the next run instead.

**Board unchanged:** one open PR, #2261, yours, `do-not-merge`, red. Nothing armable
(`gates-satisfied=0` of 14). No label touched, no escalation retired.

## GROUND

```
UTC            2026-10-09T02:45:00Z
origin/main    69e29b7d              (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 69e29b7d       C:\ProjectOperations2   (rev-list --left-right --count HEAD...origin/main -> 0 0)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree** (1 == 1). **SIGHTED run**, same session as the 02:14Z PR: the
three binding documents were read in full from `git show origin/main:<path>` in the dev tree at
`abbdc89c`, and `main` has advanced to `69e29b7d` by my own merge since — the only change between
the two is #2271, which is breadcrumbs only, so no binding text moved under me.

## WHAT I MEASURED

**#2271 MERGED, read back per-PR, not from a LIST response (§9.4).** [MEASURED]
`gh pr view 2271 --json number,state,mergedAt,mergeCommit,labels`:

```
{"labels":[],"mergeCommit":{"oid":"69e29b7d8973bbc2649b987cf1a55fbf9b163f9b"},
 "mergedAt":"2026-10-09T02:33:40Z","number":2271,"state":"MERGED"}
```

Merged through the sanctioned primitives, never by hand: `Assert-SmokedOrEscalate -PR 2271` →
`True`, then `Merge-Pr 2271` → `State = MERGED`. It was **CLEAN**, not BEHIND, so
UPDATE_AT_MERGE_TIME_V1's `QUEUED` path did not arise and nothing is left for the next run to
confirm. Checks at the merged head `debb6bd7`: **15 total — 10 SUCCESS, 5 SKIPPED, 0 failed, 0
pending**, `mergeStateStatus: CLEAN`, `labels: []`. Classified before merging, per §10.1: I opened
it, so it is not watcher-routed; it carries no `do-not-merge`; it is **docs-only**, which is Station
00's recorded lane in `STATION-CAPABILITIES.md` §5. No CP-26 receipt was required or written — the
gate is armed by the diff, and a docs-only diff with no migration does not arm it. CI agreed: the
`Approval receipt (CP-26)` check did not fail.

**The dev tree fast-forwarded and the worktree was torn down.** [MEASURED]
`git merge --ff-only origin/main` → `Updating abbdc89c..69e29b7d  Fast-forward`, `FF_EXIT=0`;
`git worktree remove` → exit 0, `WT_STILL_PRESENT=False`; branch deleted. The four read-backs the
station doc names, **re-taken with a sound probe** (see F12 — my first attempt lied):
`rev-list --left-right --count HEAD...origin/main` → `0 0`;
`git diff --numstat origin/main` → **prints nothing**;
`git diff --cached --name-status` → **empty**;
`git status --porcelain` filtered to tracked paths → **empty**, with **29 untracked** files
remaining, none of which I created. Cure 1 held: this run's breadcrumb was written inside the PR
worktree, so it never sat untracked in the dev tree and never threatened the fast-forward.

**04's F1 DOES NOT REPRODUCE, on either transport I have.** [MEASURED] This is the §7.1 re-read
rule applied before editing a binding document on another station's artifact. 04's claim: a
backslash-escaped `--jq` returns **exit 0** with stdout `.labels[].name`. My readings, all against
live PRs:

| probe | transport | exit | stdout |
|---|---|---|---|
| A `--jq '.labels[].name'` on #2261 (**has** the label) — POSITIVE control | `.ps1` via `-File` | 0 | `do-not-merge` ✅ correct |
| B same on #2271 (**has none**) — NEGATIVE control | `.ps1` via `-File` | 0 | *(empty)* ✅ correct |
| C `--jq \".labels[].name\"` — **the form under test** | `.ps1` via `-File` | **1** | `failed to parse jq expression … unexpected token "\"` |
| D escaped filter with an **inner** string literal — the dangerous shape | `.ps1` via `-File` | **1** | `failed to parse jq expression … unexpected token "\"` |
| C′ the same escaped form | `-Command` | **1** | PowerShell `ParserError: Array index expression is missing or not valid` |
| E the prescribed cure: raw `--json` + `ConvertFrom-Json` | `.ps1` via `-File` | 0 | `do-not-merge` ✅ correct |

`GH_VERSION=gh version 2.90.0 (2026-04-16)` — the same version 04 measured, so the gh build is not
the variable. **Three invocations, three different failures, every one LOUD.** A and B are the
positive and negative controls that prove my probe can produce both answers, so C's exit 1 is not
my instrument being broken (§7: positive control first).

[INFERRED] The discriminating variable is the **quoting layer the probe passes through**, not gh and
not the escaping itself: §9.1 records that the `-Command "..."` layer rewrites the string before
PowerShell parses it, and the two transports here fail at *different* parsers — jq's in C, and
PowerShell's own in C′. 04 reported reaching gh with a bare, syntactically valid filter; I cannot
reach that state from either transport, so I cannot say which nesting produces it. **Tagged
INFERRED, and it is the reason for the disposition on F1, not a counter-finding.**

**04's F2 reproduces exactly.** [MEASURED] `gh pr view 2271 --json number,merged` → **exit 1**,
`Unknown JSON field: "merged"`, followed by the full valid-field list, which contains `mergedAt`,
`mergedBy`, `mergeable`, `mergeStateStatus` and `state` — and **no** `merged`. Loud and unmissable,
on gh 2.90.0.

**04's F3 premise does NOT hold as measured now, and that is worse than F3 claimed, not better.**
[MEASURED] 04 reported `advanced: last_index=1 last_run_utc=2026-10-09T02:10:00Z` and
`M docs/pipeline/sweep-rotation.json`. At 02:4xZ:

```
git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json   -> [] (empty)
git status --porcelain       -- docs/pipeline/sweep-rotation.json   -> [] (empty)
dev-tree content == origin/main content, byte-compared in full:
   "last_index": 0,  "last_run_utc": "2026-10-08T22:38:44Z"
```

And the authoritative instrument, read-only, with no `--advance`:

```
node scripts/pipeline/next-sweep.mjs
  SWEEP: instrument-honesty
  (rotation position 2 of 4; previous run: 2026-10-08T22:38:44Z)
```

[MEASURED] `next-sweep.mjs` writes to exactly one path —
`Select-String … -Pattern 'writeFileSync|\.json'` shows `const FILE_REL =
'docs/pipeline/sweep-rotation.json'` and a single `writeFileSync(FILE, out, 'utf8')` — so there is
no second home the advance could be hiding in. **The rotation has not turned**: the next 04 run is
assigned the sweep 04 has just completed.

## WHAT CHANGED

**Two mutations, both inside this PR's own worktree, both read back.**

**1. Board lease taken before any mutation** (BOARD_LEASE_V1). [MEASURED]
`Enter-BoardLease -Actor 'station-00.sched0214b' -Reason 'collect: land 04s rotation advance and
breadcrumb'` → `LEASE_RESULT=True`. The 02:14Z lease (`station-00.sched0214`) was released before
`Merge-Pr` so the primitive could take its own, as it does internally; this is a fresh lease for
the second mutation, not a held one.

**2. An isolated worktree off `origin/main`** (condition 2). [MEASURED]
`git worktree add -b docs/collect-0214b C:\po-wt\sup00-0214b origin/main` → `WT_ADD_EXIT=0`,
`WT_HEAD=69e29b7d`, `WT_PORCELAIN_EMPTY=True`. Not the dev tree, not `C:\po-watcher`, not the
sandbox tree.

**3. 04's breadcrumb committed, so its three findings reach somebody.** It was an **untracked file
at a tracked path** in the dev tree — `check-breadcrumb.mjs` says of such a file *"it reaches nobody
until a board PR commits it"*, and 04 cannot open a PR. That is the one channel that closes, and it
is mine.

**Nothing else changed.** In particular: **`docs/pipeline/sweep-rotation.json` was NOT touched** —
not advanced, not committed, not reverted (F3). **`STATION-CAPABILITIES.md` was NOT edited** (F1).
**`DOCTRINE.md` was NOT edited and the `instruments v2` canonical hash was NOT re-recorded** (F2) —
`lint-station.mjs --write-canonical` was never run, deliberately: it re-records from whatever the
docs currently say, which would silently bless any drift in the block it exists to protect. No
prompt armed or disarmed, no label added or removed, no escalation retired, no scheduled task
touched, no `/sot/` file touched, nothing written in `C:\po-watcher`, no `git` against the sandbox
mount.

## FINDINGS

### F11 — dot-sourcing `pipeline-lib.ps1` silently reassigns a caller's `$workTree`, and it nearly committed into the wrong tree

[MEASURED] My first commit script set `$workTree = 'C:\po-wt\sup00-0214'` and *then* dot-sourced the
library. Every `git -C $workTree` call returned
`fatal: cannot change to 'C:\po-fix': No such file or directory`, exits `128`, and **nothing was
committed**. Cause, measured in the library source:

```
pipeline-lib.ps1:37   $script:WORKTREE  = "C:\po-fix"    # our isolated worktree - safe to git-write
```

[MEASURED] proved in the retry, which printed both values side by side:
`CRUMB_TREE=C:\po-wt\sup00-0214` and `LIB_WORKTREE_IS=C:\po-fix`.

**Why this is a §7 finding and not merely my own slip.** DOCTRINE §9.1 and §7 standing guard 5 warn
that **PowerShell variables are case-insensitive** and say *"never reuse single letters like
`$c`/`$C`"*. `$workTree` is not a single letter — it is the descriptive name the station doc's own
worked examples use for exactly this object, and it collides with `$script:WORKTREE` regardless.
The guard as written tells a reader that descriptive names are safe. 🔴 **It failed loud here only
because `C:\po-fix` does not exist on this machine.** Had that directory existed — and it is the
library's own default, so on some machine it does — the commit would have landed in a different tree
and read back clean, which is the silent-wrong-answer shape §7 exists for.

**DISPOSITION: ESCALATED — to Marco, as a question with options, because the complete fix touches a
hash-gated canonical block and I will not guess which option he wants.**

RULE 1 (complete-and-additive first, and I say which half each alternative fails):

1. **Complete and additive — make the collision mechanical rather than remembered.** Rename the
   library's module-scope defaults to an unmistakable prefix (`$script:PoWorkTree`,
   `$script:PoWatcher`, `$script:PoRepo`), keep the old names as read-only aliases for one release
   so no existing caller breaks, and have `Invoke-GitPush` and friends keep requiring `-WorkTree`
   explicitly. **Passes both halves**: it solves it now and in future, and it damages no existing
   caller or data.
2. **Generalise the §9.1 guard only** — widen "never reuse single letters" to "never name a local
   anything `pipeline-lib` declares at `$script:` scope, and list them". *Fails the future half*: it
   is a remembered protection, and §9.2 records that remembered protections in this pipeline have
   failed seven times.
3. **Do nothing; rely on `-WorkTree` being mandatory** once #2261 lands. *Fails the future half
   too*: #2261 makes the **parameter** mandatory, which does not stop a caller passing a variable
   the dot-source has already overwritten — which is precisely what happened here.

This is also the clearest practical argument yet for #2261, which is sitting red and labelled.

### F12 — `[string]::IsNullOrWhiteSpace()` on a captured git result returns False for an EMPTY result, and I published a wrong tree-state reading off it before catching it

[MEASURED] My teardown script captured `$numstat = (git -C $devTree diff --numstat origin/main)` and
reported `NUMSTAT_EMPTY=False`, `PORCELAIN_TRACKED_EMPTY=False` — i.e. a dirty dev tree. A direct
re-run of the identical commands prints **nothing at all** for both, and `git diff --cached` was
`True` from the same idiom in the same script. PowerShell hands a multi-line native result back as
an **array**, and `IsNullOrWhiteSpace` on an array is not a string test, so the answer is about the
object's type and not its content.

**This is §9.6 inverted and that is what makes it dangerous.** §9.6 warns *an empty result is not an
empty world*; here **a non-empty reading was an empty world.** Nothing errored, nothing was empty,
and both numbers were well-formed booleans — so §9.6 never fires. The false reading was in the
**alarming** direction (it said the dev tree was dirty when it was clean), so it would have cost a
future run a pointless restore of files that were never modified, using the raw-Buffer cure on a
tree that did not need it.

**DISPOSITION: ACTIONED** — the sound readings are published above under WHAT I MEASURED, taken by
printing the command output directly instead of testing a captured object, and the corrected set is
what this breadcrumb records. The cure for any station: `git diff --numstat` **EMPTY output** is the
real answer, exactly as §9.2 already prescribes — read the output, do not type-test a capture. I am
not proposing a doc edit for it: §9.2 already says the right thing and my script simply did not do
what §9.2 says.

### F13 — 04's F1 (the `--jq` "fails LOUDLY" clause) does not reproduce, so the doc edit it asked for is NOT made

Readings and controls are in the table under WHAT I MEASURED. 04 asked me to narrow
`STATION-CAPABILITIES.md:351` because the escaped form returns exit 0; I get **exit 1 on both
transports available to me**, by two different parsers, with the positive and negative controls both
correct. Making the edit would put *"it can fail silently"* into the file whose stated job is
settling capability disputes, on a reading nobody can currently reproduce — and §1 of that very file
says to **measure before believing either side, and fix the loser.**

**DISPOSITION: DISPATCHED → Station 04**, back to the station that holds the instrument-honesty
rotation, with the one thing needed to settle it. ⚠️ **What 04 must supply is the exact
invocation, not the conclusion**: the full command string as the tool received it, the transport
(`-File` vs `-Command` vs an MCP `start_process` command string), and the nesting depth, because
that is the only variable left once gh version is held equal at 2.90.0. **Falsifying probe for
whoever takes it next:** run the escaped form three ways — from a `.ps1` via `-File`, via
`-Command`, and directly as a `start_process` command string — and record the exit code of each. If
any one returns **exit 0** with stdout `.labels[].name`, 04 is right about that transport and the
sentence must be narrowed **to name that transport**, not globally.

⚠️ **The rule 04 wanted preserved is preserved either way and I am changing nothing about it**:
DOCTRINE §9.4's *"keep escaped double quotes out of `--jq`; take raw `--json` and
`ConvertFrom-Json`"* stands, and probe E above confirms the prescribed cure is sound. Three earlier
breadcrumbs (09-05, 09-17, 09-24) also point at this sentence; this run does not clear them, and it
now adds the reason none of them should have been landed blind.

### F14 — 04's F2 reproduces, but I did not edit the canonical block for it alone

`merged` is not a field on gh 2.90.0: exit 1, loud, full valid-field list printed. So DOCTRINE
§9.4's bullet does describe a silent misreading that cannot occur on this gh.

**DISPOSITION: DEFERRED** — and the reason is sequencing, not disagreement. 04 asked for F1 and F2
to land as **one** folded reconcile PR, explicitly so that three stale breadcrumbs stop
accumulating into a fourth. F1 is now blocked on a measurement (F13), so folding is impossible this
run; and editing `instruments v2` for F2 alone means re-recording the canonical hash — a deliberate
act that `lint-station.mjs` warns *"silently blesses any drift in the very blocks this gate exists
to protect"* — to retire one harmless bullet whose advice is still correct. That is a bad trade for
one hash re-record. **What would make it urgent:** F13 settling, at which point both edits ship
together in one reconcile PR with one re-record, which is what 04 asked for and the
complete-and-additive shape. [MEASURED] the scope is **one governance file, not seven**:
`CANONICAL-BLOCK: instruments` appears in `docs/pipeline/DOCTRINE.md` only — every other hit under
`docs/` is a breadcrumb or superseded prompt *quoting* it, and the block's own comment says
*"Stations POINT here; they do not copy it."* So whoever lands it should not budget for a
seven-doc ship.

### F15 — 04's rotation advance did not survive, so the next 04 run repeats the sweep it just did — and I deliberately did not repair it

Measurements under WHAT I MEASURED: the file is byte-identical to `main` at `last_index=0`,
`next-sweep.mjs` assigns `instrument-honesty` again, and the script writes to no other path. 04's
own F3 warned that an uncommitted advance means *"the rotation silently stops turning"* and that it
has happened before (2026-09-02, two consecutive advances). This run shows the stronger version:
the advance is not merely uncommitted, it is **not present in the working tree at all**.

**DISPOSITION: DISPATCHED → the next Station 00 run, with the probe and the reason for the delay.**
I did not advance it, on two grounds, and both matter:

1. **04 may still be mid-run.** Its breadcrumb header says the run spans to `02:4xZ` and I am
   writing at `02:4xZ`. Two actors writing one file is the LL-38 collision, and the file in question
   is the rotation's only state.
2. **A double advance is worse than a missed one.** If I advance to index 2 and 04 then advances
   again, the rotation lands on index 3 and **`repo-hygiene` is skipped entirely** — and a sweep
   that is skipped silently is the same class of failure as a rotation that never turns.

⚠️ **Exact probe for the next run, so it does not have to re-derive any of this:** read
`docs/pipeline/sweep-rotation.json` in the dev tree and compare against `origin/main`. **If it is
still `last_index=0` and 04's session is no longer running** (cross `list_scheduled_tasks`
`lastRunAt` against the session directory's `CreationTimeUtc`, per §9.5 — `list_sessions` reports
`running` long after a session stops and cannot answer this alone), then the advance is genuinely
lost: run `node scripts/pipeline/next-sweep.mjs --advance` **once**, confirm it prints
`last_index=1`, and commit the file in that run's board PR. **If it reads `last_index=1`, 04
finished the write after I looked and there is nothing to do** — do not advance it a second time.

## WHAT I DID NOT DO

- **I did not edit `STATION-CAPABILITIES.md`** on a reading I could not reproduce (F13). This is
  the finding I am most confident about in this report.
- **I did not edit `DOCTRINE.md`, and I did not run `lint-station.mjs --write-canonical`** (F14).
  It re-records from whatever the docs currently say, so running it to clear a complaint rather than
  to bless a deliberate edit is how drift gets certified.
- **I did not advance or commit `docs/pipeline/sweep-rotation.json`** (F15), for the two reasons
  above, and I did not revert it either — I only read it.
- **I did not re-run, re-queue or re-dispatch Station 04.** It is self-scheduled, it was possibly
  mid-run, and touching a scheduled task on a freshness reading is forbidden regardless.
- **I did not merge, update, label, unlabel or comment on #2261.** Marco's label, Marco's PR, and
  the never-list closes the receipt route anyway.
- **I did not arm anything.** `gates-satisfied=0` of 14, unchanged from the 02:14Z measurement.
- **I did not retire any escalation** and cleared no `[STALE]` row — the sweep produced none.
- **I did not prune a worktree.** Still 31 non-main, four holding work `--force` would destroy.
- **I did not touch `/sot/`**, Azure, Entra or SharePoint, and wrote no production data.
- **I did not fix the clone drift** dispatched to 03 in #2271, or the `triage-holds` SUSPECT banner.
  Both are `scripts/**`, outside this station's `docs/` lane.
- **I did not claim a smoke, liveness or safe-to-act verdict from anything but
  `status-sweep.ps1`**, and both of its runs this occurrence are quoted with their timestamps.
