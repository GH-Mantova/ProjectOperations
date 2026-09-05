# Station 00 — Supervisor | 2026-09-04T20:08Z–2026-09-04T20:5xZ

## GROUND

```
UTC            2026-09-04T20:08:20Z
origin/main    fafd5057            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ fafd5057      C:\ProjectOperations2   (rev-list --left-right --count HEAD...origin/main = 0 0)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version: 1 in the scheduled-task file) — MATCH, full authority
```

NOT BLIND. `start_process` shell `powershell.exe` succeeded on the first call (pid 13896), after a
keyword `ToolSearch` for `desktop-commander` loaded the ids this environment actually offers.

All three binding documents were read from the dev tree, which is [MEASURED] byte-identical to
`origin/main` for each of them: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned EMPTY.
No piped hash was used (PREFLIGHT step 2).

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1` at 20:09:01Z. Section 0 controls both [LIVE] pass.
Verdict **CAUTION** on one "LIVE STATION WORKTREE", `C:/po-vg`.

- [MEASURED] `C:/po-vg` is **NOT live**. Newest file write anywhere under it is
  `2026-09-04T07:55:32Z` — 12.2 h before this run, against a station run that lasts 15–25 min. The
  sweep's own line agrees (`age=735 min`). Its liveness classifier keys on age-plus-dirty, not on
  write recency, so it re-raises this every hour. Same conclusion as the 19:2xZ run.

**Board — 4 open PRs, all CLEAN, all green (14 pass / 0 fail / 0 pending each), and ALL FOUR ARE
MARCO'S.** Trunk green on `fafd5057` (4 success / 0 failed).

| PR | opened | scope | lane | RULE 2 |
|---|---|---|---|---|
| #1606 | 19:55:08Z | `apps/web/…/ScopeQuantitiesTable.tsx` + its `__tests__` | **WATCHER** | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"}` — **BINDS** |
| #1589 | — | `scripts/pipeline/lint-prompt.mjs` | **WATCHER** | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}` — **BINDS** |
| #1594 | 12:27:33Z | `.github/workflows/…`, `docs/…`, `scripts/pipeline/__tests__/…`, `scripts/pipeline/check-pipeline-heartbeat.mjs` | **SECOND LANE** | `[NO LANE VERDICT — hand-classified]` → `.github/workflows/pipeline-heartbeat.yml` matches none of the three `NESTED_TEST_PATHS` forms ⇒ **MARCO'S** |
| #1593 | 12:24:54Z | `docs/pipeline/ARMING.md`, `scripts/pipeline/__tests__/…`, `scripts/pipeline/arm-prompt.ps1`, `scripts/pipeline/hooks/pre-commit` | **SECOND LANE** | `[NO LANE VERDICT — hand-classified]` → `arm-prompt.ps1` and `hooks/pre-commit` match none of the three forms ⇒ **MARCO'S** |

RULE-2 probe controls, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`
(never the clone, §9.5): POSITIVE `marco.:true` → **610**; NEGATIVE `zzzNoSuchTokenZzz` → **0**;
newest log `2026-09-04 20:04:44Z`, younger than the oldest open PR (12:24Z) — which is the control
that separates the live directory from the 17-day-stale decoy.

**Collect.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`;
structure 4 checked, 0 malformed. Crossed against `list_scheduled_tasks` (`lastRunAt`), as the
contract requires — all four aligned, none SILENT:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | 2026-09-04T20:07:56Z (this run) | 19:35Z | aligned |
| 03 | 2026-09-03T23:01:39Z | 2026-09-03T23:02Z | aligned (21.1 h, cadence 24 h; next 23:00Z) |
| 04 | 2026-09-04T18:09:34Z | 18:10Z | aligned |
| 05 | 2026-09-04T14:10:38Z | 14:11Z | aligned |

**NO NEW BREADCRUMBS since my 19:35Z run.** The four in the queue root are 00's own 1808/1908/1935
and 04's 1810 — all [MEASURED] already on `origin/main` (`git cat-file -e origin/main:<path>` exit 0
on each), and all dispositioned by the 18:0xZ/19:2xZ/19:3xZ runs. Nothing to collect.

**Queue.** armed (`*-ready.md`) = **0**. in-progress prompts 0 · `index.lock` False/False · git
processes 0 · no PR touched in the last 2 min. BOARD DRIVING condition 3 is satisfied on the sweep's
own instruments.

**The second-actor arm from 19:32Z has completed its journey.** [MEASURED] `.arming-log.txt` row
`2026-09-04T19:32:17Z ARMED pr-wbsshift-s1-web-rate-follows-shift by=Marco@ pid=35044
caller=powershell.exe:28352` (not me — I armed nothing last run and nothing this run). The watcher
consumed it, opened **#1606** at 19:55:08Z, and wrote its `marco:true` verdict. Elapsed arm→PR ≈ 23
minutes. Escalation #22 recurring, with a measured outcome this time.

**The `NO LOG` cure in DOCTRINE §9.5 is broken in both halves — [MEASURED] with controls.**
This is the run's substantive finding; the numbers are in F1 below.

**Dev tree working state** (nothing staged; `git diff --cached --name-status` EMPTY):

```
1  0   docs/pr-prompts/.arming-log.txt                              <- the 19:32Z arm, uncommitted
0  96  docs/pr-prompts/pr-wbsshift-s1-web-rate-follows-shift-HOLD.md <- consumed by the arm; still tracked on main
```

## WHAT CHANGED

- **DOCTRINE §9.5** — the `NO LOG HAS TWO CAUSES` bullet's cure replaced with the two measured
  refutations and the probe that actually discriminates. Edited with node by **concatenation**
  (`pre + NEW + suf`), never `String.replace` with a replacement string (§9.3, the trap #1605 landed
  90 minutes ago). Byte delta asserted: `70408 → 72106`, expected `72106`, **equal**.
- **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` re-recorded to
  `8d022f76dfffa664` via `node scripts/pipeline/lint-station.mjs --write-canonical`.
  `lint-station.mjs` then **ADMIT: all 8 docs clean**, exit 0 (it read `REJECT: 1 of 8` before the
  re-record, which is the expected shape for a DOCTRINE-only block).
- **`docs/pr-prompts/.arming-log.txt`** swept in: `origin/main` 50 lines → 51, byte-identical to the
  dev-tree copy (`Buffer.compare` = 0, 6721 bytes both sides). The gap §9.5 names is closed again.
- **This breadcrumb**, written **inside this PR's worktree** — not the dev tree — so it cannot become
  the untracked file that refused the next fast-forward four runs running.
- **Nothing merged. Nothing armed. Nothing disarmed. No label touched.**

## FINDINGS

### F1 — DOCTRINE §9.5's `NO LOG` cure prescribed two probes; one cannot pass its own control and the other answers for both lanes

§9.5 tells a station holding a `NO LOG` reading to "check whether any prompt in
`docs/pr-prompts/processed/` names that PR's branch or scope". Both readings of that fail.

**(a) The branch needle is guaranteed empty.** [MEASURED] `Select-String -Path
docs\pr-prompts\processed\* -Pattern 'wbs-shift-s1-web-rate-by-shift'` → **0** across the whole
directory, `.log` only → **0** — for **#1606, which the watcher unquestionably opened**, and whose
merge verdict is sitting in that same directory. The watcher writes the PR *number* and *URL* into
the prompt log and never the head branch name. A probe whose positive control cannot pass answers
"second lane" for every PR that has ever existed. §7's exact shape.

**(b) A bare `PR #<n>` match over `processed\*.log` hits second-lane PRs too.** [MEASURED] a
`rev-<n>-ready.md.log` — the auto-generated REVIEW JOB — exists for **all four** open PRs, #1589,
#1593, #1594 and #1606, i.e. for **both** lanes. #1594's *only* `PR #1594` hit anywhere in
`processed\*.log` is `rev-1594-ready.md.log`, a review whose verdict was `MERGE`. A station reading
that as "the watcher lane touched this PR" concludes the opposite of the truth.

**The discriminator that works — restrict to the prompt logs and exclude `rev-*`:**
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'`.
[MEASURED] at `fafd5057`: **#1606 → 2** · **#1589 → 1** (both also carry a real
`merge result for PR #N` verdict) · **#1593 → 0** · **#1594 → 0** · NEGATIVE control
`PR #999999` → **0**. Two lanes, two clean readings, in both directions.

Why it matters rather than being tidy: §10.1 step 2 is a **safety rule with a merge button attached**.
Probe (a) pushes every PR toward "second lane", where §10.1 then hand-classifies — which currently
fails SAFE, because hand-classification routes almost everything to Marco. Probe (b) pushes the other
way, toward "the watcher handled it", and that direction fails **OPEN**. This bullet has been in the
canonical block since 08:2xZ today and no station had run its controls.

**DISPOSITION: ACTIONED.** Corrected in this PR; canonical hash re-recorded; the replacement carries
its own falsifying probe (the four counts plus the negative control), which is what the bullet it
replaces did not.

### F2 — The arming-log gap re-opened and is closed again; the mechanism is untouched

[MEASURED] `origin/main` 50 lines vs disk **51**, the difference being the 19:32:17Z arm.
§9.5 records the cause exactly: nothing commits the log **on purpose** — it lands only when a board
PR happens to sweep it, so the gap closes and re-opens by luck. Second consecutive run to observe it
open. Swept in here.

**DISPOSITION: ACTIONED** (this run), and the underlying defect stays **DEFERRED** — it is already
written up in `needs-marco/arming-log-is-tracked-but-nothing-publishes-it-2026-09-04.md`. It becomes
urgent the first time an arm is made in an hour when no board PR ships.

### F3 — Escalation #22 recurred at 19:32:17Z, and this run measured what it cost

An actor that is not me armed `pr-wbsshift-s1-web-rate-follows-shift` 29 s before my #1605 merged.
I did not disarm it and I did not touch it: arming IS the decision to run (DOCTRINE §5b), and BOARD
DRIVING condition 3 forbids mutating the board while another actor is mid-mutation (LL-38).
[MEASURED] outcome: the watcher built it and opened **#1606** at 19:55:08Z, which the policy gate
then routed to Marco — taking the board from 3 Marco-blocked PRs to **4**.

That is the throughput constraint stated precisely: 00 can arm, the watcher can build, CI can green —
and every PR touching anything outside `tests/` or `docs/` stops at a human. Arming faster lengthens
the queue; it does not shorten it. `by=Marco@` still attributes nothing (the field is the OS user,
not the session), so *who* armed it remains the open question #22 asks.

**DISPOSITION: DEFERRED** — open with Marco as escalation #22
(`needs-marco/unattributed-arms-single-actor-2026-09-03.md`). Adding the measurement, not
re-escalating. Note for the next run: #22's option (A) is already built and merged (#1512) and
#1593 — open right now — is the follow-through (`arm-prompt requires -Actor, so the log can name the
session`). **Merging #1593 is what closes #22.** It is Marco's.

### F4 — `pr-wbsshift-s1-web-rate-follows-shift-HOLD.md` is still tracked on `origin/main` while #1606 is open

[MEASURED] `git diff --numstat` in the dev tree shows `0 96` for the HOLD — gone from the working
tree, still in the index and on `main`. #1606's file list is **two files, both under `apps/web/`**;
it does not delete its own prompt. This is the *stays-armable-forever* defect: any tree that has not
seen the local deletion can arm it again and open a second PR for work #1606 already carries.

I did **not** commit the deletion. Deleting the prompt from `main` while its PR is unmerged removes
the only re-runnable copy if #1606 is closed rather than merged, which fails RULE 1's second test.

**DISPOSITION: DEFERRED.** Trigger: **when #1606 merges**, the next board PR commits the deletion.
Until then: **do not arm `pr-wbsshift-s1-web-rate-follows-shift-HOLD.md`** — same standing hold as
`pr-cardui-s2-wbs-table-shell-HOLD.md` while #1483 is open.

### F5 — `C:/po-vg` is still classified LIVE by the sweep and still is not

[MEASURED] newest write under `C:/po-vg` is `2026-09-04T07:55:32Z`, 12.2 h old. The classifier's
`dirty>0 + age` heuristic cannot distinguish "a station is working here" from "a station died here
half a day ago", so it emits CAUTION every hour and a reader who obeys it stands down forever.
Write recency is the missing signal and it is one `Get-ChildItem -Recurse | Sort LastWriteTimeUtc`
away.

**DISPOSITION: DISPATCHED → 03 (machine-minder), next run 2026-09-04T23:00Z.** Fold into the
existing worktree-prune dispatch that 00 already authorised (five worktrees + the two
`C:\po-worktrees` registry escapees; `origin/fix1483` NOT cleared). `C:/po-vg` joins the reviewable
list. ⚠️ The authority matrix says 03 is `report-only` and 00 `dispatches 03`, so read literally
**nobody** may `git worktree remove` — if 03 stalls on that again, it is an ESCALATION, not a
re-dispatch.

### F6 — All four open PRs are Marco's; there is nothing this station may merge

Not a defect, but it is the answer to Q6 and it must not read as "quiet". #1606 and #1589 carry real
watcher `marco:true` verdicts. #1593 and #1594 are second-lane and hand-classify to Marco on
`.github/workflows/`, `arm-prompt.ps1` and `hooks/pre-commit`. Every one is CLEAN and green: they are
blocked on a human, not on CI, not on conflicts, not on anything a station can fix.

**DISPOSITION: DEFERRED** — waiting on Marco, correctly. The one that unblocks the most is **#1593**
(it closes escalation #22's attribution gap), then **#1594** (it makes a missed station run visible,
which is escalation #23's recovery half).

## WHAT I DID NOT DO

- **Merged nothing.** RULE 2 binds on #1606 and #1589 by verdict, and on #1593/#1594 by
  hand-classification under §10.1 step 2. No station may clear any of them.
- **Armed nothing**, and did not disarm the second actor's arm. Board was quiet on the sweep's
  instruments, but the queue's problem is not that too little is armed — F3 — and another actor was
  mutating 36 minutes before this run started.
- **Did not commit the `-HOLD.md` deletion** — F4, deliberately, with a named trigger.
- **Did not prune any worktree**, including the three orphans, the two registry escapees and
  `C:/po-vg`. Not 00's lane (authority matrix).
- **Did not touch `/sot/`**, Azure/Entra/SharePoint, production data, or any label.
- **Did not re-escalate #22 or #23**; added measurements to both instead.
- **Did not clear the 40+ `[STALE]` needs-marco cross-references** the sweep prints every run. Still
  03's dispatched clone-hygiene work; still not urgent enough to spend a board PR on alone.
