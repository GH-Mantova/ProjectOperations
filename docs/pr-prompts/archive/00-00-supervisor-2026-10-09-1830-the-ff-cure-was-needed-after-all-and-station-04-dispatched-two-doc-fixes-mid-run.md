# Station 00 — Supervisor | 2026-10-09T18:28Z–2026-10-09T18:5xZ (second board PR of the 1815Z run)

## GROUND

```
UTC            2026-10-09 18:28:00
origin/main    852c4984            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 852c4984      C:\ProjectOperations2
doc version    1
bootstrap      1
```

This is the SAME occurrence as `…-1815-station-04-advances-the-sweep-rotation-…` (merged as #2291),
continued after that PR landed. It is a second breadcrumb rather than an edit to the first, because
the first is already on `main` and history is not rewritten. The three binding documents were read in
full at the start of the occurrence from `git show origin/main:<path>` in the dev tree; they were not
re-read for this continuation, and `origin/main` moved only by my own merge (`661ecf89` → `852c4984`).

## WHAT I MEASURED

### The fast-forward my own F89 action was supposed to unblock was REFUSED

[MEASURED] After #2291 merged (`mergedAt 2026-10-09T18:25:26Z`, merge commit `852c4984`), the
fast-forward failed:

```
git merge --ff-only origin/main
  error: Your local changes to the following files would be overwritten by merge:
          docs/pipeline/sweep-rotation.json
  Aborting
FF_EXIT=1
```

[MEASURED] Why, in blobs:

```
git rev-parse HEAD:docs/pipeline/sweep-rotation.json        -> 0ec9e53d   (dev tree's HEAD, 661ecf89)
git hash-object docs/pipeline/sweep-rotation.json            -> 1c6c6f00   (the working copy)
git rev-parse origin/main:docs/pipeline/sweep-rotation.json  -> 1c6c6f00   (what I just merged)
```

The working copy and `origin/main` were already **byte-identical** — and git refused anyway, because
`--ff-only` compares the worktree against the tree's own `HEAD`, not against the incoming commit. The
content being identical to the destination is irrelevant to that check.

[MEASURED] The documented cure worked, and its PRIMARY branch worked, which is itself a reading worth
recording: `#2288` measured the raw-Buffer branch *silently not working in a CRLF checkout, only its
EOL fallback does*. Here the raw-Buffer write cleared it on the first branch:

```
after raw-Buffer write: ""  => PRIMARY WORKED
FINAL working blob:  0ec9e53d   (= HEAD's blob)
```

I wrote `fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))`, then
`git update-index --refresh -- <path>` and read `git diff --numstat -- <path>` PER PATH, never the
whole-index exit code. No `git checkout -- <path>`, no `git clean`, no `reset --hard`, no `stash`.

[MEASURED] The four read-backs the station doc requires, after the retry:

```
rev-list --left-right --count HEAD...origin/main  -> 0  0
diff --numstat                                     -> EMPTY
diff --cached --name-status                        -> EMPTY
status --porcelain --untracked-files=no            -> EMPTY
HEAD                                               -> 852c4984
```

[MEASURED] And 04's advance survived the round trip — the restore discarded it locally for one
moment, and the fast-forward brought it back from `main`:

```
"last_index": 1,  "last_run_utc": "2026-10-09T18:10:05Z",  "last_station": "04-scanner"
```

### A Station 04 breadcrumb landed DURING my run, after my COLLECT census had already been taken

[MEASURED] `check-breadcrumb.mjs --freshness`, run after the fast-forward, reported a third root
breadcrumb that my 18:15Z census did not see:

```
NOTE  00-04-scanner-2026-10-09-1810-two-section-9-traps-do-not-reproduce-as-written-and-the-scheduled-tree-holds-twenty-decoy-bootstraps.md is UNTRACKED
ADMIT 00-04-scanner-2026-10-09-1810-…
structure: 3 checked, 0 malformed
  04  last 2026-10-09T18:10:00Z  0.3h ago  (cadence 4h + grace 1h)  ok
```

My first breadcrumb says *"Exactly two breadcrumbs sat at depth 1"* and *"No 03/04/05 breadcrumb is
uncollected."* **Both were true when measured at 18:15Z and false by 18:28Z.** 04's occurrence fired
at `18:09Z` and wrote its report while I was building #2291. See F90.

### 04's three findings, read in full and dispositioned below

[MEASURED] I read the 1810 breadcrumb in full. It carries three findings, each already carrying 04's
own disposition: **F1 DISPATCHED to Station 00**, **F2 DEFERRED**, **F3 DISPATCHED to Station 00**.
Two of the three are dispatched to me, and both are docs-only edits to
`docs/pipeline/STATION-CAPABILITIES.md` — Station 00's own lane. They are actioned in this PR.

### The duplicate 1714 breadcrumb

[MEASURED] #2291 archived the 1714 report by writing it into `archive/`, because it was untracked and
there was no tracked path to `git mv`. That left the untracked original still at depth 1, so two
copies existed:

```
git hash-object docs/pr-prompts/<1714>.md                 -> 09879fb4   (root, untracked)
git rev-parse origin/main:docs/pr-prompts/archive/<1714>.md -> 09879fb4   (archived, tracked)
IDENTICAL = True
```

## WHAT CHANGED

One PR, docs-only:

1. **`docs/pipeline/STATION-CAPABILITIES.md`** — two corrections, actioning 04's F1 and F3 (F91, F92).
2. **`docs/pr-prompts/archive/00-04-scanner-2026-10-09-1810-….md`** — 04's breadcrumb, collected and
   archived. First time it exists on `main`.
3. **The untracked duplicate of the 1714 breadcrumb removed from depth 1** (F93).
4. **This breadcrumb**, at depth 1, as the current cycle.

No prompt armed, promoted or retired. No label added or removed. No scheduled task touched. `/sot/`
untouched. No Azure / Entra / SharePoint. No production data.

## FINDINGS

### F90 — S3 — A COLLECT census is a snapshot, and Station 04's cadence lands inside Station 00's hourly slot by construction

[MEASURED] My census at 18:15Z saw two breadcrumbs and wrote *"no 03/04/05 breadcrumb is
uncollected"* into a report that is now immutable on `main`. 04's 18:09Z occurrence wrote its
breadcrumb during my run, and `--freshness` saw three at 18:28Z.

[INFERRED] This is not bad luck, and `STATION-CAPABILITIES.md` §6 already measured the mechanism from
the other side: 00 is hourly at `:05` and 04 is `0 */4 * * *`, so *"an hourly `5 * * * *` lands inside
ten minutes of every one of [04's six daily runs] by construction"* — it recorded 99 seconds on
2026-09-07. What that correction framed as a collision risk has a second consequence nobody had
written down: **on six of 00's twenty-four daily occurrences, 04's breadcrumb arrives mid-COLLECT, so
00's census is stale before its own PR merges.**

The cost is bounded and was paid in full here — I caught it on the post-merge `--freshness` and
collected 04 in a second PR — but a run that does not re-check after merging will leave 04's findings
uncollected for up to four hours, and 00 is the only channel that closes.

🔧 **The rule: re-run `check-breadcrumb.mjs --freshness` AFTER the board PR merges, not only before
it, and treat any breadcrumb that appeared in between as this occurrence's to collect.** It is one
cheap call and it closes the window the cadence overlap opens.

**DISPOSITION: ACTIONED** — done this run: the post-merge `--freshness` is what surfaced 04's report,
and this second PR collects it. ⚠️ **Not actioned: the rule is not written into
`00-supervisor.md`'s COLLECT section**, so the next run depends on reading this breadcrumb rather than
its contract. That is a station-contract edit and it rides with F89's question to Marco, which is
about the same section.

### F91 — S3 — `STATION-CAPABILITIES.md` §3 stated a positive behavioural claim about `--jq` that 04 could not reproduce

04's F1, actioned. The sentence read *"Escaped double quotes fail **LOUDLY** (`unknown arguments`),
never silently."* 04 measured, with the escaping confirmed to survive into `gh`'s argv: exit 0 and the
correct output, at PS `5.1.26100.9444`. DOCTRINE §9.4's matching line is worded as a *precaution* and
needs no change, which keeps this out of the hash-gated canonical block.

I narrowed the sentence rather than deleting it, and said why in the file: it REPLACED an earlier
bullet whose polarity taught readers to distrust a *correct* `do-not-merge` reading, and
`do-not-merge` is the gate that stops an agent merging Marco's work. A reader who tests the
replacement, finds it also wrong and discards both is left trusting nothing about that gate. The
asymmetry is recorded too — one non-reproduction does not prove it never fails, and 04 measured one
combination of `gh`, PowerShell and escaping depth.

**DISPOSITION: ACTIONED** — in this PR, with 04's controls, the PS version, the falsifying probe and
the attribution to 04's breadcrumb. Read back below.

### F92 — S3 — The `Scheduled` bootstrap count has rotted a third time, and is replaced by the rule rather than a fourth number

04's F3, actioned. §1 recorded *"holds **11** `SKILL.md` files"*; 04 measured **26** recursively —
6 live at depth 1, 15 in three dated `_backup-` folders, 5 in `_retired-2026-08-18`. Run literally as
*"over every `SKILL.md`"*, §3's `BOOTSTRAP_CORE_REFERENCE_V1` probe now returns 20 zero-hit files
against 5 hits, so a careless reader reporting the zeroes would confirm a clause §3 explicitly
RETIRED on 2026-10-07.

I wrote the RULE, not a new count — *enumerate the ENABLED tasks in the scheduled-tasks MCP and use
the `path` each one reports; never walk the `Scheduled` root* — and labelled the figures as dated
evidence rather than a count to quote, because §1's own standing instruction is *instructions live
here, state does not* and a fourth number would be the fourth to rot. 04's point that the dated
backups are an orderly history of Marco's own layer and **not** a defect is carried over verbatim in
spirit, so nobody reads this as a licence to delete them.

**DISPOSITION: ACTIONED** — in this PR. Read back below.

### F93 — S4 — Archiving an UNTRACKED breadcrumb by copy leaves a duplicate at depth 1, which reads as uncollected forever

[MEASURED] Both copies hashed `09879fb4` — byte-identical. [INFERRED] Left in place, the untracked
root copy makes `--freshness` emit its UNTRACKED note every run and invites the next Station 00 to
collect an already-archived report; DOCTRINE §10.5 is explicit that an artifact carries ONE identity
and must never be duplicated.

Removing the untracked duplicate is not a retirement and not a deletion of information: the tracked
`archive/` copy is the move, it is on `main`, and `check-breadcrumb.mjs` matches by basename so
freshness still counts it from there. I removed only the byte-identical duplicate, and only after
hashing both.

🔧 **The rule: when the breadcrumb you are archiving is UNTRACKED, the move is a copy into `archive/`
PLUS removal of the depth-1 original in the same PR — otherwise the archive is an addition, not a
move.**

**DISPOSITION: ACTIONED** — removed in this PR after the hash comparison above. Read back below.

### F94 — S3 — F89's remedy is confirmed correct but INCOMPLETE as written, and the correction matters for whoever makes it contract

My own F89 (in #2291) said carrying 04's rotation advance into the board PR *"lands the state AND
unblocks the dev tree's next fast-forward in one move."* **The first half is right; the second half
is wrong**, measured above: merging identical content does not clear a local modification, because
`--ff-only` checks the worktree against its own `HEAD`. The remedy is **two** moves — carry the file
in the PR, then run the restore-from-`HEAD` cure before the fast-forward.

[MEASURED] 04's own 1810 breadcrumb says it *"Did not commit `docs/pipeline/sweep-rotation.json`.
Left dirty and named above, per the station doc's correction of the line that used to ask 04 to commit
it."* So 04 leaving it dirty is already contract on 04's side and is correct behaviour, not drift —
which strengthens F89's option 1 (00 carries it) and narrows the question to 00's side only.

**DISPOSITION: ESCALATED** — folded into F89's open question to Marco rather than raised as a new one.
If option 1 becomes a line in `00-supervisor.md`'s COLLECT section, **that line must say both halves**,
or the next run lands the file, hits the same refusal, and has nothing telling it the cure is still
required. Restated for him under FOR MARCO.

## WHAT I DID NOT DO

- **I did not rewrite or amend #2291's breadcrumb.** It is on `main`; F90 and F94 correct it here
  instead, which is what a second breadcrumb is for.
- **I did not re-read the three binding documents** for this continuation — same occurrence, and
  `origin/main` moved only by my own merge.
- **I did not action 04's F2.** 04 dispositioned it DEFERRED and gave the reason: §9.1 sits inside the
  hash-gated `CANONICAL-BLOCK: instruments v2`, so editing it means re-recording the block hash, and
  it is a wording-precision defect with a correct cure already attached. I accept that disposition and
  did not force the block open. **What would make it urgent is 04's own test and I repeat it rather
  than replace it:** a second independent non-reproduction, or any run reporting a confident wrong
  reading from a `$`-bearing probe.
- **I armed nothing.** 14 HOLDs after #2291, zero gates satisfied. The prompt staged in #2291 is now
  tracked on `main` and therefore armable next cycle — deliberately left for that cycle, because
  arming is a separate decision and its PR will need Marco's release (F83).
- **I did not call `list_scheduled_tasks`** in either half of this occurrence, so I hold no `lastRunAt`
  cross-check of my own. F90's mechanism is quoted from `STATION-CAPABILITIES.md` §6's 2026-09-07
  measurement, tagged `[INFERRED]`, not re-measured here.
- **I did not delete, prune or move anything except the one byte-identical duplicate in F93.**
- **I did not touch the dated `_backup-` or `_retired-` folders** under `C:\Users\Marco\Claude\Scheduled`,
  and wrote into the doc that they are not a defect.
- **I did not edit DOCTRINE.md**, and in particular did not open the hash-gated canonical block.
- **I did not edit `/sot/`,** did not touch any scheduled task, and did not remove any `do-not-merge`
  label. No Azure / Entra / SharePoint. No production data.

## FOR MARCO

**Still nothing broken.** Trunk green, board empty, all four stations fresh, watcher running, nothing
waiting on your label. Two PRs merged this occurrence: #2291 (collect + stage the sweep fix) and this
one (collect Station 04 + its two doc fixes).

**Two questions, and they are the same question about the same paragraph** of
`00-supervisor.md`'s COLLECT section, so one answer settles both:

1. **F89 — should Station 00 carry Station 04's `sweep-rotation.json` advance, as contract?** I
   recommend yes. 04 is required to advance it, may not open a PR, and its own station doc already
   tells it to leave the file dirty — so 00 is the only actor that can land it. **The correction F94
   adds: the line must say BOTH halves** — carry the file in the board PR *and* run the
   restore-from-`HEAD` cure before the fast-forward. Landing the content does **not** clear the local
   modification; I assumed it would, and the fast-forward refused.
2. **F90 — should that same section say to re-run `--freshness` AFTER the board PR merges?** I
   recommend yes. Station 04's cadence lands inside Station 00's hourly slot on six of my
   twenty-four daily occurrences by construction, so a pre-merge census can be stale before the PR
   lands. It cost nothing today because I re-checked; a run that does not will leave 04's findings
   uncollected for up to four hours, and 00 is the only channel that closes.

Both are additive, neither damages existing or future data entry, and both are one line each. I am
asking rather than writing them because they are station-contract edits.

**And F77 is unchanged and still the one that needs you** — the instrument lane cannot fire for any
PR the watcher builds. Full text in the archived 1714 breadcrumb, now on `main`; recommendation is
option 1, exempt only a prompt's own retirement path from the lane check.
