# Station 00 — Supervisor | 2026-09-03T22:38:10Z–2026-09-03T23:0xZ

## GROUND

```
UTC            2026-09-03T22:38:10Z
origin/main    bfd2596b            (git fetch origin --prune, then rev-parse)
dev tree       main @ bfd2596b     C:\ProjectOperations2   (converged; 15 dirty lines)
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md) — MATCH, full authority
```

SIGHTED run. `start_process` shell `powershell.exe` answered on the first call —
`2026-09-04T08:38:10.5090898+10:00 / LAPTOP-E6NHU4E4`. Not blind.

`git diff --name-only origin/main -- docs/pipeline/` returned **only** `sweep-rotation.json`, so the
working copies of `00-supervisor.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md` I read ARE
`origin/main` at `bfd2596b`. All three read in full.

`status-sweep.ps1` 22:39:11Z: section 0 both positive controls LIVE; verdict **SAFE TO ACT**
(no board mutation in progress, no git lock, 0 git processes, no PR touched in the last 2 min).

## WHAT I MEASURED

**Board, `[LIVE]` from status-sweep 22:39Z + `gh`.** 5 open PRs, **all green**: #1554, #1544, #1543,
#1541, #1536. `main` CI on `bfd2596b` 4 success / 0 failed — trunk green. Real armed prompts **0**
(`rev-1554-ready.md` is an auto-generated REVIEW JOB, DOCTRINE §9.5, not a prompt).

**RULE 2, probe pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed`
[MEASURED]: **1865** logs, newest **2026-09-03T22:14:48Z** (younger than every open PR — the control
that separates it from the 17-day-dead decoy), `marco.:true` → **606**, NEG `zzzNoSuchTokenZzz` → **0**.

| PR | merge-result line | Verdict |
|---|---|---|
| #1536 | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | **MARCO'S** |
| #1543 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs"}` | **MARCO'S** |
| #1541 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/visual-smoke.mjs"}` | **MARCO'S** |
| #1544 | **NO MERGE-RESULT LINE** | `[NO LANE VERDICT — hand-classified]` → touches `.claude/agents/**` + `scripts/pipeline/{lint-station,next-sweep}.mjs` ⇒ outside `^(tests|docs)/` ⇒ **MARCO'S** |
| #1554 | **NO MERGE-RESULT LINE** | `[NO LANE VERDICT — hand-classified]` → see **F2**; classification is **DISPUTED BETWEEN TWO BINDING DOCS** |

⚠️ #1554 *does* appear once in the corpus — `rev-1554-ready.md.log`, a **review job**, not a merge
verdict. Searching for the PR number alone would have read that as "the watcher handled it". The
discriminator is the literal `merge result for PR #N` line, not the number.

**Freshness, and the three instruments crossed.** `node scripts/pipeline/check-breadcrumb.mjs --freshness`
→ exit **2**: `00 ok (1.5h)` · `03 47.6h ok` · `04 0.5h ok` · **`05 … 56.5h ago SILENT`**.
`list_scheduled_tasks` `lastRunAt`: 00 `22:37:53Z` · 03 `2026-09-01T23:01:43Z` · 04 `22:10:24Z` ·
05 `2026-09-03T14:11:26Z`. Session directory `CreationTimeUtc` for the "05 sot keeper" session
`local_57274869-…` = **`2026-09-03T14:11:26.744Z`**, matching `lastRunAt` to the millisecond.

**And 05 is not silent at all** [MEASURED]: `gh pr view 1554` → created **2026-09-03T22:05:16Z**,
branch `sot-refs-burndown-2026-09-03`, CLEAN, 9/9 checks green, labels **[]**, files
`docs/pr-prompts/00-05-sot-keeper-2026-09-03-2154-sot-refs-provenance-burndown.md` ·
`docs/qa/sot-refs-baseline.json` · `sot/01-charter-and-architecture.md` · `sot/03-progress-log.md` ·
`sot/04-data-model.md`. **05's breadcrumb exists, is 44 minutes old, and is inside its own PR.**

**Why every instrument missed it** [MEASURED]: `check-breadcrumb.mjs:98` builds its tracked set from
`git ls-tree -r --name-only origin/main -- docs/pr-prompts` (falling back to `git ls-files`), so it
sees **main plus this box's working tree and nothing else**.
`git ls-tree -r --name-only origin/main -- docs/pr-prompts | Select-String '00-05-sot-keeper-2026-09-03'`
→ **empty**; POSITIVE CONTROL, the 08-31 breadcrumb → `docs/pr-prompts/archive/00-05-sot-keeper-2026-08-31-1411-…md`.
The file is on a PR branch and in no other tree, so it is invisible to both passes.

**Watcher.** node RUNNING **pid 24744**, auto-restart wrapper alive (1), heartbeat 25 min (ticks only
mid-run; stale + empty queue = idle, not wedged). No ENSURE-UP action: wrapper present. Watcher clone
`branch=main dirty=3`. 3 orphaned worktrees (`C:/po-1483-fix`, `C:/po-sa-fix`, `C:/po-work/s2-e2e`,
all `dirty=0`) and 2 registry escapees under `C:\po-worktrees` — all read, none touched.

**Queue.** armed **0** · needs-marco 15 · no-pr-opened 109 · failed 41 · blocked 90. Newest `failed/`
entries are 2026-08-29 OAuth-401 quarantines; newest `no-pr-opened/` is 2026-09-02 and is a prompt
that correctly stopped on its own NO-OP condition. **No new silent no-op since the last run.**

## WHAT CHANGED

One board PR, docs-only, opened and driven by this run — **PR #1555** (branch
`board/00-collect-2026-09-03-2238`), built in a disposable worktree `C:\po-work\00-collect-2238`
created off `origin/main` at `bfd2596b`. Nothing was mutated in `C:\ProjectOperations2` or in
`C:\po-watcher`. It carries:

1. **Station 04's 22:10Z breadcrumb** and **Station 00's own 21:09Z breadcrumb**, both of which were
   UNTRACKED on this box and reached nobody. Swept, as the report contract requires.
2. **`docs/pipeline/sweep-rotation.json`** — advanced by 04 to `last_index: 1`, left dirty because 04
   may not commit. Without this the rotation silently stops turning and the next 04 run repeats
   instrument-honesty. Read back: `git diff --numstat` = `2 2` before commit.
3. **DOCTRINE §9.4 — a new bullet**, 04's F1 verbatim as it proposed it:
   `@(ConvertFrom-Json …).Count` answers **1** for an empty array and **1** for a populated one.
4. **DOCTRINE §9.2 — the `git branch -r` bullet amended**, 04's F2: `--prune` is not the cure,
   because `refs/remotes/` can hold refs no refspec owns.
5. **`docs/pipeline/stations/_canonical-blocks.json`** re-recorded, because 3 and 4 land inside the
   hash-gated `instruments v2` block. `node scripts/pipeline/lint-station.mjs` before the re-record:
   `REJECT docs/pipeline/DOCTRINE.md — canonical block instruments has been EDITED (sha
   6d570ab8d19a9d24, expected 91f565a0fa8fdeb8)`, `REJECT: 1 of 8`. After
   `--write-canonical` (`WROTE … instruments v2 6d570ab8d19a9d24`): **`ADMIT: all 8 docs clean`, exit 0.**
   Hand-landed rather than armed, per §10.3 — the content is a canonical block and must be exact.

**Nothing else.** No prompt armed, disarmed or renamed (armed count 0 before and after). No PR
merged, labelled or rebased. No `sot/` edit. No watcher restart. No lock cleared, no worktree pruned.

## FINDINGS

### F1 — 🔴 S2, NEW. All three freshness instruments misread Station 05 today, in the same direction, because the breadcrumb home the report contract calls **"best"** is the one home none of them can see.

The report contract says: *"Two homes are correct: **inside your own run's PR**, which is best … or
the dev tree."* Station 05 did exactly that at 21:54Z. The consequences, all [MEASURED] above:

| Instrument | Reading | Truth |
|---|---|---|
| `check-breadcrumb.mjs --freshness` | `05 … 56.5h ago **SILENT**`, exit 2 | 05 reported **44 minutes ago** |
| `lastRunAt` (scheduled-tasks MCP) | `2026-09-03T14:11:26Z`, fresh, **no breadcrumb** ⇒ the station doc's table says *"it started and died, or ran and did not report"* | it ran **and reported** |
| session directory `CreationTimeUtc` | one 05 session, `14:11:26.744Z` | agrees with `lastRunAt`, and is equally blind to the report |

This is not #23. #23 is cadence **arithmetic** (`2×cadence` hides a missed run). This is a **corpus**
defect: `:98` reads `origin/main` + this box's working tree, and a breadcrumb committed to a PR
branch is in neither. It will misfire for **every** station that follows the contract's preferred
advice, for as long as its PR is open — and #1554 is a PR that, per F2, may be parked on Marco.

Left alone, the standing instruction *"a silent station is not a quiet one — disposition it"* trains
00 to open an investigation into a station that is working correctly. §7: a false alarm licenses
destructive action.

Options for Marco, RULE 1 applied — **(a) is the complete-and-additive one:**

- **(a) Widen the corpus, don't move the report.** Add the heads of **open PRs** to
  `check-breadcrumb.mjs`'s tracked set (`gh pr list --json headRefName` → `git ls-tree -r` per head,
  or `gh pr view --json files`), and print such a breadcrumb as `IN-FLIGHT #<n>` rather than counting
  it absent. Complete: fixes today and every future run. Additive: no station changes behaviour, no
  existing reading is invalidated, and it composes with #23 option (a) rather than competing.
  Costs a network call the detector does not currently make — which is why it is Marco's call, not a
  station's.
- **(b) Change the contract: always drop a dev-tree copy as well.** Fails *complete-in-future* — it
  is discipline, not a mechanism, it double-writes every breadcrumb, and a cloud-fired or blind
  station has no dev tree to copy into.
- **(c) Have 00 cross `lastRunAt` before believing SILENT.** Fails *complete-immediately*: measured
  today, `lastRunAt` was **14:11:26Z** against a 21:54Z report, so the cross would have produced the
  *second* wrong answer ("ran and did not report"), not the right one.

**DISPOSITION: ESCALATED.** Folded as an amendment onto the existing open file
`docs/pr-prompts/needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`
rather than opened as a second escalation — one instrument, one decision, options together (04's F3
reasoning, and it applies here too). ⚠️ That folder is gitignored (`.gitignore:76-83`), so the
amendment lives only on this box: **this breadcrumb is the tracked copy.**

### F2 — 🔴 S2, NEW. Two binding documents give opposite answers on whether 00 may merge #1554, and one of them is a stated **safety** rule.

#1554 is Station 05's own doc-reconcile PR: green, unlabelled, `sot/` + `docs/` only, no watcher
merge verdict.

- **STATION-CAPABILITIES §5** (2026-08-24): *"00 may merge docs-only and `sot/`-only PRs, queue/staging
  PRs, **and anything not watcher-routed** — via `Assert-SmokedOrEscalate` then `Merge-Pr`."* That
  authorises this merge twice over.
- **DOCTRINE §10.1** (2026-08-31), tagged *"THIS IS A SAFETY RULE, NOT A CONVENTION"*: no log names
  the PR ⇒ *"Apply the policy gate BY HAND — `classifyPolicyFiles` … is the definition: any path
  outside `^(tests|docs)/` … means **it is Marco's**."* `sot/…` is outside `docs/`. That forbids it.

Precedent does not settle it: **#1453**, the equivalent 05 reconcile touching `sot/04` and
`sot/README.md`, merged **2026-08-31T14:33:03Z** — the same day §10.1 was written — with
`mergedBy` = `GH-Mantova`, the shared token, which attributes nothing.

Read literally, §10.1 makes **every** Station 05 doc-reconcile permanently human-gated, which would
retire 05's lane as an autonomous station; read literally, §5 lets 00 merge a class of PR that
§10.1's hand-classification calls Marco's. **I did not merge it.** A wrong merge here is exactly the
failure RULE 2 exists to prevent, and "two documents disagree" is not a clearance.

Options for Marco, RULE 1 — **(a) is the complete-and-additive one:**

- **(a) Classify a KNOWN STATION LANE by the authority matrix, not by `classifyPolicyFiles`.** Amend
  §10.1 to say: a PR opened by a station acting inside its own recorded authority — 05 → `sot/` +
  its own breadcrumb; 00 → `docs/`; 06 → staging — is classified by STATION-CAPABILITIES §5, and the
  PR body must **name its lane** so the claim is checkable. Everything else keeps
  `classifyPolicyFiles` unchanged. Complete: settles this PR and every future one, for all stations.
  Additive: removes no gate — the `do-not-merge` label and any real watcher `marco:true` still bind.
- **(b) Carve out `sot/`-only alone.** Fails *complete-in-future*: the identical collision returns the
  first time any other station opens a PR outside `tests|docs` inside its own lane.
- **(c) Leave it: every station PR outside `tests|docs` waits for Marco.** Fails *complete-immediately*
  — it also keeps F1's false SILENT alive for as long as #1554 sits, and it is the §10.3 complaint
  ("the lane built to remove work from Marco silently creates it") in a second costume.

**DISPOSITION: ESCALATED** →
`docs/pr-prompts/needs-marco/sot-only-pr-merge-authority-conflict-2026-09-03.md` (gitignored; this
breadcrumb is the tracked copy). **#1554 left open, untouched, unlabelled.**

### F3 — 🟢 04's F1: `@(ConvertFrom-Json …).Count` is a §9.6 instrument lie and was not in DOCTRINE.

Accepted as measured — four controls, deterministic, and 04 caught it refuting a *true* trap
(`gh run list --commit <short>` → `[]`) before it filed the refutation. Landed verbatim as a §9.4
bullet in the PR above, with the canonical hash re-recorded and `lint-station.mjs` read back at
`ADMIT: all 8 docs clean`, exit 0.

**DISPOSITION: ACTIONED.**

### F4 — 🟢 04's F2: §9.2's `git branch -r` bullet named a cause `--prune` cannot fix.

Doc half landed in the PR above. The other half is dev-tree litter with no owner: 5 orphan
`refs/remotes/pr/*` refs, plus the 3 orphaned worktrees, 2 registry escapees and `dirty=3` watcher
clone that the 22:39Z sweep flagged independently.

**DISPOSITION: ACTIONED** (doc) **+ DISPATCHED → Station 03** (hygiene: prune the 5 orphan
`refs/remotes/pr/*` refs, the 3 zero-dirty orphaned worktrees, the 2 registry escapees, and
reconcile the watcher clone's 3 dirty files). 00 does not delete refs or worktrees in shared trees.
⚠️ 03 has not run since 2026-09-01T23:01Z — see F5. This dispatch is addressed to its **next** run,
which is the parking mechanism already escalated; it is named here so it does not evaporate.

### F5 — 🟡 03 has definitively missed its 2026-09-02T23:00Z occurrence, and the detector still prints `ok`.

[MEASURED] `lastRunAt` = `2026-09-01T23:01:43Z`; `nextRunAt` = **`2026-09-03T23:00:45Z`** — 22 minutes
after this run's start. A daily station whose last run was two days ago has missed one occurrence
outright, and `--freshness` reads `47.6h ago (cadence 24h) **ok**` because `2×24h` hides exactly one
miss. This is #23's false-negative half, now confirmed on a second consecutive snapshot.

**Falsifier for the next run:** if no `00-03-machine-minder-2026-09-03-23xx-*.md` breadcrumb exists
after 23:05Z, 03 has missed **two consecutive** occurrences and is genuinely stopped — and the
detector will stay silent about it until 2026-09-05T23:02Z.

**DISPOSITION: DEFERRED** — already with Marco as #23
(`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`, options a/b/c). Not
re-raised; a second escalation on one open question competes with the first.

### F6 — 🟡 The board is 5 PRs and 5 of 5 are held from 00.

3 by a real watcher `marco:true` (#1536, #1543, #1541), 1 by hand-classification (#1544), 1 disputed
(#1554, F2). Armed prompts 0. All green, none merging. The throughput constraint recorded on
2026-08-31 is unchanged: 00 can arm, the watcher can build, CI can green — and everything outside
`tests/` or `docs/` then stops. **Arming faster makes the queue longer, not shorter.**

**DISPOSITION: DEFERRED.** Becomes urgent if the count grows without Marco merging; the decision it
waits on is §10.3's, already open.

## WHAT I DID NOT DO

- **Merged nothing.** #1536/#1543/#1541 are RULE 2 `marco:true` — barred. #1544 hand-classifies as
  Marco's. #1554 is F2's open question and I will not resolve a two-document conflict by merging.
- **Armed nothing.** Armed count 0 before and after. Per the arming standing block the first question
  is whether to arm at all, and this run's two actionable items were both DOCTRINE canonical-block
  edits, which §10.3 routes to hand-landing, not to a prompt.
- **Did not touch the watcher.** HEALTHY by the sweep's own signals (node pid 24744, wrapper alive,
  queue empty); `restart-watcher-if-wedged.ps1` was not run with `-Fix` and did not need to be.
  ENSURE-UP: wrapper present, no relaunch.
- **Did not prune the 3 orphaned worktrees, the 2 registry escapees or the 5 orphan `pr/*` refs**, and
  did not touch the watcher clone's 3 dirty files. Shared trees; 03's lane (F4).
- **Left `docs/data-model/metadata-catalog.json` and `docs/pr-prompts/.arming-log.txt` dirty** in the
  dev tree, as every prior run has. Untracked queue state (`.queue-sync-ledger.txt`,
  `queue-watch-state.md`, `archive/review-escalations-516-1346/`, the 5 `docs/pr-reviews/pr-15xx-review.md`
  files, `superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`) also left alone — none is a
  breadcrumb and none is mine to commit this run.
- **Did not verify whether 05's 14:11:26Z session genuinely ran for 7.9 hours or was resumed.**
  [INFERRED] only: the session directory was created at 14:11:26Z and the work landed at 21:54–22:05Z.
  Distinguishing the two needs the transcript, and it changes nothing about F1 — the report exists and
  the instruments cannot see it either way.
- **Did not clear the 8 dead `[STALE]` needs-marco files** the sweep tags every run. Already
  DISPATCHED → 03 on 2026-08-31 and still pending; re-doing another station's dispatched work is LL-38.

---

**Validator, command quoted as the contract requires:**
`node scripts/pipeline/check-breadcrumb.mjs` — result recorded in PR #1555's body after this file
was committed. `node scripts/pipeline/lint-station.mjs` → **`ADMIT: all 8 docs clean`, exit 0.**
