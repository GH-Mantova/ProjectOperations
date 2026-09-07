# Station 00 — Supervisor | 2026-09-07T17:08:54Z–2026-09-07T17:20Z

## GROUND

```
UTC            2026-09-07T17:08:54Z
origin/main    62eab8af            (fetch --prune, then rev-parse)
dev tree       main @ 62eab8af     C:\ProjectOperations2
doc version    1                   (station_doc_version in 00-supervisor.md)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Versions AGREE — this run was not read-only on that account.

SIGHTED. `start_process` (shell `powershell.exe`) returned a live shell on `LAPTOP-E6NHU4E4`,
pid 22004. This was **not** a blind run.

Device-bridge git guard installed at the top of the run, last line quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`.

All three binding documents were read from the working copy **after proving the working copy IS
`origin/main` for those paths**: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned EMPTY,
and `git rev-list --left-right --count origin/main...HEAD` returned `0	0`. Read in the DEV TREE,
never the watcher clone.

Minted needle this run: `zzQq00N20260907T1712` — NEG control 0 over
`docs\pr-prompts\processed\*.log`. **It is spent the moment this file is committed; mint a fresh
one next run.**

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1`, captured to a file because it returns early and
hides its own section 7 verdict. Generated `2026-09-07 17:10:20Z`, 326 lines, exit 0.
Section 0 controls both `[LIVE]` (gh reached GitHub; node runs) — no `[BROKEN]`.
Section 7 verdict: **`SAFE TO ACT`** — no board mutation in progress, no remote activity in the
last two minutes, no live station worktrees. [MEASURED]

**Board, 4 open, re-measured `17:16:36Z`.** [MEASURED]

| PR | state | checks | labels | files |
|---|---|---|---|---|
| `#1777` | **CLEAN** | **15 pass / 0 fail / 0 pending** | `[]` | `scripts/pipeline/sweep-breadcrumbs.ps1` |
| `#1775` | BLOCKED | 13 / 2 / 0 | `do-not-merge` | map-locations (TIP-ID-S2) |
| `#1774` | BLOCKED | 13 / 2 / 0 | `[]` | apps/web colour ratchet |
| `#1767` | BLOCKED | 13 / 2 / 0 | `do-not-merge` | crm reminder policy (TR-1) |

The two reds on each blocked PR are ONE gate, not two: `Approval receipt (CP-26)` fails, and CP-26
also runs as a step inside `PR gates — diff checks`, so one cause prints two failures. For `#1775`
and `#1767` the label is present, so CP-26 is `[LABEL_PRESENT]` and red **by design** — those PRs
are PARKED, not failing, and cannot be driven green by construction. `#1774` carries **no label**
and is one receipt short (`RELEASED_NO_RECEIPT`); that was escalated at 12:31Z and is not
re-raised here. [MEASURED]

**RULE 2 probe, tree PINNED to the dev tree.** `C:\ProjectOperations2\docs\pr-prompts\processed`
— **2057** logs, newest `2026-09-07T15:35:17Z`, which is younger than all four open PRs'
`createdAt`, so the freshness precondition holds. POSITIVE control `marco.:true` → **620**.
NEGATIVE controls: minted needle → **0**, `PR #999999\b` → **0**. Match over `pr-*.log` only
(excluding `rev-*`): `#1777` → 0 · `#1775` → 0 · `#1774` → 0 · `#1767` → 0. [MEASURED]

⇒ all four are `[NO LANE VERDICT — hand-classified]`. `#1777` touches
`scripts/pipeline/sweep-breadcrumbs.ps1`, which matches none of the three `NESTED_TEST_PATHS`
forms and is not a lane in the section 5 authority matrix (00's lane is `docs/`), so
`classifyPolicyFiles` refuses it ⇒ **Marco's**. The other three likewise. **MERGE NONE.**

**The `pollForBehindPrs` rebuild, measured end to end for the first time.** [MEASURED] from
`gh pr view 1777 --json commits,statusCheckRollup`:

| | UTC |
|---|---|
| `#1785` (00's own collect PR) merged | `16:21:39Z` |
| watcher pushed `main` onto `#1777` | `16:25:17Z` — **+3m38s** |
| all 15 checks re-started | `16:25:23Z` |
| last check (`tendering-e2e`) completed SUCCESS | **`16:39:11Z`** |
| still 15 / 0 / 0 CLEAN at | `17:16:36Z` |

**Push-to-green is 13m54s. The green window that followed is 37m25s and still open.**
Four such pushes onto `#1777` today: `14:09:16Z`, `15:23:16Z`, `15:47:16Z`, `16:25:17Z`.

**Freshness / COLLECT.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`,
exit 0. `00` last `16:08Z` 1.1h ago · `03` last `2026-09-06T23:02Z` 18.2h ago · `04` last
`14:10Z` 3.1h ago · `05` last `14:12Z` 3.0h ago — all `ok`. Note the `CADENCE` map still carries
`'00': 2` against a live cron of `5 * * * *`, so `00`'s `ok` is the weakest row in that table;
that defect is already on file and is not re-raised. [MEASURED]

**Collect is EMPTY this cycle.** `docs/pr-prompts/00-*.md` at depth 1 holds exactly one file, my
own `…-1608-…md`, and it is **tracked** (absent from `git status --porcelain`, which returned 53
entries, all `??`, none of them a breadcrumb). It landed in `#1785`. Nothing has merged since
`16:21:39Z`, so no breadcrumb from any station is newer than my last run. There is nothing to
disposition from 03, 04 or 05 this cycle. [MEASURED]

**Dev tree.** `git diff --numstat` EMPTY, `git diff --cached --name-status` EMPTY, `0	0` against
`origin/main`. The 53 untracked entries are 46 `docs/pr-reviews/pr-*-review.md`, the queue-sync
ledger, `queue-watch-state.md`, two `-LOOPING.md` files, an archive directory and one
`Claude Design/` file — none of them a prompt, none staged. [MEASURED]

**Machinery.** watcher node RUNNING pid `31660`; auto-restart wrapper alive (1); heartbeat 96 min
— which with `armed: 0` is IDLE, not wedged, and I did not run `-Fix`. Watcher clone
`branch=main dirty=5`. `C:\po-vg` orphaned worktree, age 4877 min, holding **1 uncommitted file**.
`index.lock` False in both trees, 0 git processes, no PR touched in the last 2 min. [MEASURED]

**Queue.** `armed (*-ready.md): 0` · needs-marco 39 · no-pr-opened 109 · failed 43 · blocked 123.
`triage-holds.ps1` over the **45** `-HOLD.md` at depth 1: **17 ADMIT · 28 REJECT · 0 SPENT**,
SPENT-fixture control PASS. [MEASURED]

**The arming question, answered by measurement rather than by habit.** Of the 17 ADMITs, three are
on the standing never-arm list (`pr-tr-s1-reminder-policy` — a migration, Marco's; and the two
`pr-sot-*` — Station 05's lane). I parsed the `scope:` block of the remaining **14** and tested
every entry against the three `NESTED_TEST_PATHS` forms. POSITIVE control: a scope block parsed on
**14 of 14** (my first attempt returned a uniform "NO scope BLOCK" — a CRLF bug in my own regex,
caught by the control before it became a finding). Result: **0 of 14 has an all-tests-or-docs
scope.** Every one touches `scripts/`, `.github/`, `apps/` or `package.json`. [MEASURED]

## WHAT CHANGED

**Nothing on the board, and nothing in git.** No arm, no merge, no label, no push, no PR. This is
a deliberate NO-OP, and F3 gives the reason and its read-back.

One file written: this breadcrumb, untracked, in the dev tree.

## FINDINGS

### F1 — My own previous breadcrumb called this a LIVELOCK. It is not one, and the wrong word points at the wrong fix.

The `…-1608-…` breadcrumb recorded that `pollForBehindPrs` voids the board's one green PR after
every collect merge, and concluded *"it can never stay green long enough to merge — a LIVELOCK ⇒
option (b)"*. **The premise is measurably false.** Push-to-green on `#1777` is **13m54s**
(`16:25:17Z` → `16:39:11Z`), against an hourly Station 00 cadence. `#1777` has been CLEAN and
15/0/0 for **37m25s** and counting. It spends the large majority of every hour green.

What is real is the **cost**, not a block: four pushes today, each burning a full 15-check rebuild
on a PR no automation may merge anyway. And the thing actually stopping `#1777` is RULE 2 —
`scripts/` is outside `tests|docs` and outside every station lane — which no change to 00's
cadence would touch.

This matters because "livelock" argues for option **(b)** or **(c)**, i.e. slowing Station 00.
RULE 1 says put the complete-and-additive option first: **(a) skip the behind-poll for PRs
`classifyPolicyFiles` refuses** solves it immediately and permanently, damages no data entry, and
costs 00 nothing — those PRs cannot be auto-merged, so keeping their branches current buys
nothing. **(b)** PR-only-when-something-to-land fails the *future* half: it hides collect evidence
on quiet runs. **(c)** slowing 00 fails the *complete* half: it reduces the frequency of the
symptom without removing the useless rebuild.

**DISPOSITION: ESCALATED** — the escalation already open with Marco is re-stated, not duplicated:
its premise word changes from "livelock" to "wasted rebuild", and option (a) is the
complete-and-additive one. The falsifying probe is the timing table above — re-run it after the
next collect merge; if push-to-green ever exceeds the gap to the next merge, "livelock" is right
after all.

### F2 — The `tests-docs` auto-merge lane has ZERO eligible supply on this board.

45 HOLDs, 17 ADMIT, and **0 of the 14 armable ones** carry an all-tests-or-docs scope. The lane
that exists to land work with no human is therefore not slow, not broken and not starved by
latency this cycle — it has **nothing it is allowed to take**. Every prompt 00 could arm today
necessarily produces a fifth PR that only Marco can merge, on a board where four such PRs are
already waiting on him.

This sharpens the standing "the board is Marco-constrained" line: it is Marco-constrained
*because the queue contains no automatic-lane work*, which is a supply property of what has been
staged, and staging is Station 06's lane.

**DISPOSITION: DISPATCHED → 06 (PR Master).** Stage at least one prompt whose entire `scope:` is
inside `tests/`, `docs/`, `__tests__/` or `*.test|*.spec` — so the `tests-docs` policy has
something to consume and the lane can be observed working end to end. Do not widen an existing
prompt's scope to fake this; a mixed scope routes to Marco exactly as before. The falsifying probe
is the scope test above: re-run it over the ADMIT bucket and count the all-tests-or-docs rows.

### F3 — I deliberately did NOT open a board PR this run, to leave the board's only green PR green.

Merging a collect PR now would push `main` onto `#1777` within ~3m38s and take it from 15/0/0 to
red for ~14 minutes. `#1777` is the one PR on this board that is green, unlabelled and mergeable —
by Marco, and only by Marco. A supervisor whose routine reporting repeatedly resets the clock on
the one thing the human is able to act on is subtracting throughput, not adding it.

Read-back, `17:16:36Z`: `origin/main` still `62eab8af`; `#1777` CLEAN, 15 pass / 0 fail / 0
pending; open PRs still 4; no arm, no merge, no label change. [MEASURED]

**DISPOSITION: ACTIONED.**

### F4 — This breadcrumb is UNTRACKED in the dev tree, and the ordinary sweep cannot land it.

The report contract's second sanctioned home is `C:\ProjectOperations2\docs\pr-prompts\`, which is
where this file is. It arms nothing — a breadcrumb filename matches no watcher glob. But
`scripts/pipeline/sweep-breadcrumbs.ps1` is the very file `#1777` repairs, so the sweep is not a
reliable route until `#1777` lands.

**DISPOSITION: DEFERRED.** The next Station 00 run commits it in its own board PR. Trigger to stop
deferring: `#1777` merges, **or** two consecutive runs have deferred, at which point the collect
evidence is worth more than one green window and the PR should be opened regardless.

### F5 — The session's "today's date" and the host clock disagree by one day. It is the Brisbane offset, not a fault.

The run environment reported `2026-09-08` while `(Get-Date).ToUniversalTime()` on the box returned
`2026-09-07T17:08:54Z`. Marco's host is Brisbane, UTC+10, so `17:08Z` is `03:08` local on the 8th:
the local date leads the UTC date from `14:00Z` every day. This is the same offset DOCTRINE
section 3 warns about for watcher logs, and the same window that makes the watcher's daily log
name unreliable.

Recorded so that a later run does not spend a cycle filing it as clock drift. **All timestamps in
this report are UTC, taken from the host.**

**DISPOSITION: ACTIONED.**

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs hand-classify as Marco's. `#1775` and `#1767` also carry
  `do-not-merge`, which only Marco removes.
- **Armed nothing — 9th consecutive run**, and this time with the measurement behind it (F2)
  rather than a judgement call. Neither documented trigger is met: open PRs are 4 (not ≤2) and no
  ADMIT has an all-tests-or-docs scope.
- **Did not run `restart-watcher-if-wedged.ps1 -Fix`.** Heartbeat 96 min with `armed: 0` is IDLE.
  A stale heartbeat on an empty queue is correct, not wedged.
- **Did not touch `C:\po-vg`** (orphaned worktree, 4877 min, 1 uncommitted file) or the watcher
  clone's `dirty=5`. Both are Station 03's lane and both are already dispatched; acting on them
  myself is the LL-38 incident.
- **Did not re-raise** `#1774`'s `RELEASED_NO_RECEIPT` (escalated 12:31Z), the
  `check-breadcrumb.mjs` `CADENCE` `'00': 2` defect, or the arming-throughput escalation.
- **Did not author any approval receipt.** A scheduled run may never write one, whatever CP-26
  says it is missing.
- **Left alone:** `/sot/`, Azure / Entra / SharePoint, production data, the 46 untracked
  `pr-*-review.md` mirrors, and the two `-LOOPING.md` files.
