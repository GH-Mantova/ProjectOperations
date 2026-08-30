# Station 00 — Supervisor | 2026-08-29T06:08:39Z–2026-08-29T06:25Z

## GROUND

```
UTC            2026-08-29T06:08:54Z
origin/main    8b608336            (git fetch origin +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 1501d09c     C:\ProjectOperations2   (2 behind origin/main)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE. SIGHTED run — Desktop Commander reached the box on the first call.

## WHAT I MEASURED

- **[MEASURED] The box is reachable, and this station IS in the scheduled-task listing.**
  `start_process` shell `powershell.exe` returned `2026-08-29T06:08:54.4155412Z` on the first attempt.
  `list_scheduled_tasks` returns `00-supervisor`, cron `5 */2 * * *`, `lastRunAt 2026-08-29T06:08:39Z`
  — this run. **Listing present AND sighted, in the same run.** That is the direct refutation of the
  line I am removing below, produced by the run that removes it.
- **[MEASURED] Board: OPEN PRs = 0.** `status-sweep.ps1` §1, `gh` positive control passed (saw merged
  #1388). Most recent merge #1388 at 02:18:34Z. **Nothing has merged in 4h07m.** main CI last 3 runs
  3/3 success.
- **[MEASURED] Queue: ARMED = 0** — `@(Get-ChildItem docs\pr-prompts -Filter *-ready.md -File).Count`
  = 0, control `*-HOLD.md` = 84. `needs-marco/` 14, `no-pr-opened/` 107, `failed/` 41.
- **[MEASURED] The shared dev-tree index is EMPTY.** `git diff --cached --name-status` printed
  nothing. The previous (blind) run could not run this probe and correctly filed it
  `[CANNOT MEASURE]`; it is now measured, and there is **no staged half-arm**. Worktree carries 5
  ` M` (`sot/03`, `sot/06`, `docs/qa/sot-refs-baseline.json`, `docs/data-model/metadata-catalog.json`,
  `docs/pipeline/sweep-rotation.json`) plus untracked scratch. I carried only `sweep-rotation.json`.
- 🔴 **[MEASURED] OAuth is still expired, measured at source, 13h57m dead.**
  `C:\Users\Marco\.claude\.credentials.json` → `expiresAt` = 1787933615984 =
  **2026-08-28T16:13:35.984Z**; now 2026-08-29T06:10:52Z; `EXPIRED True`. File mtime
  **2026-08-28T16:13:26.909Z** — unchanged for 14 hours, so **nothing is refreshing it.**
  The burn evidence is unchanged too: `failed/` newest are `pr-crm-s3-account-on-client-create`
  and `rev-1386` at 21:03Z / 20:52Z, both `401 OAuth access token has expired`.
- **[MEASURED] Nothing in the queue has moved since the 02:08Z run.** newest `failed/` 21:03Z,
  newest `no-pr-opened/` 2026-08-20 — byte-for-byte the same reading as two runs ago.
- **[MEASURED] The watcher chain is ALIVE, and `status-sweep`'s "auto-restart wrapper: alive (3)"
  is counting the wrong thing.** Direct `Win32_Process` query for `supervise-watcher.ps1` returns
  **ZERO**. The live chain is `watcher-launcher-singlelane.ps1` **2984** → `start-watcher.ps1`
  **30388** → `node ... pr-watcher\index.mjs` **26364**. The sweep's "(3)" is the three
  *launcher* processes. Heartbeat 837 min stale with 0 armed = **idle, not wedged** (station doc
  verdict table).
- **[MEASURED] The two orphan launchers are still there and still hold nothing.** 10364 (ppid 26276
  **GONE**) and 23100 (ppid 25072 **GONE**), 2 children each, and **neither is an ancestor of the
  only watcher node** (26364 → 30388 → 2984). Control: the live launcher 2984 has the same `-s`
  child shape, so "has children" is not the tell — the parent chain is.
- **[MEASURED] The watcher clone is BEHIND, not diverged, and `--ff-only` would still succeed.**
  In `C:\po-watcher\ProjectOperations`, read-only git only:
  `rev-list --left-right --count origin/main...HEAD` = **`11  0`**;
  `merge-base --is-ancestor HEAD origin/main` **exit 0**; 35 dirty of which
  **non-` D` = 0**; no `MERGE_HEAD`, no rebase, no `index.lock`; stashes **51**, flat.
- **[MEASURED] All six station docs still carry the refuted diagnostic on `origin/main`;
  `STATION-CAPABILITIES.md` does not.** `git show origin/main:<path>` grepped for
  `cloud-fired|structurally cannot reach|will be blind`: **line 28 hit in all six** station docs;
  `STATION-CAPABILITIES.md` line 58 hit is the *corrected* text ("That is REFUTED").
- **[MEASURED] `check-breadcrumb.mjs` is CLEAN and no station is SILENT.** Run inside the PR
  worktree at `origin/main`: `node scripts/pipeline/check-breadcrumb.mjs` → `92 checked, 0
  malformed`, **CLEAN, exit 0**; `--freshness` → 00 2.1h / 03 7.2h / 04 4.0h / 05 16.0h, all `ok`,
  **CLEAN, exit 0**.
- **[MEASURED] Station cadences, from the MCP, not from a folder.** 00 `5 */2 * * *` (2h) ·
  04 `0 */4 * * *` (4h) · 03 `0 9 * * *` (**daily**) · 05 `10 0 * * *` (**daily**) ·
  `weekly-security-audit` **enabled: false**, `lastRunAt 2026-08-18T08:18:52Z` (11 days).
  ⚠️ 04-scanner `lastRunAt 2026-08-29T06:10:18Z` — **it was running concurrently with this run.**
  That is why every write below went through an isolated worktree and a pathspec commit.

## WHAT CHANGED

**One PR, docs-only, opened and merged from an isolated worktree `C:\po-wt-sup0610` off
`origin/main` 8b608336. The shared dev tree was never written to.**

1. **Retired the refuted blindness diagnostic from the `station-contract v1` canonical block** in
   all six station docs — the fix my own 04:08Z run DISPATCHED to Station 06. Replaced the three
   lines at 28–30 with five lines that point at `STATION-CAPABILITIES.md` §2 and say plainly that
   the listing predicts nothing in either direction, that blindness is intermittent, and that its
   cause is unknown.
   - Edited with **node** (`readFileSync`/`writeFileSync`, utf8), CRLF preserved, behind an
     **ANCHOR-NOT-FOUND guard** requiring exactly one match per file. Read-back: `new=1 old=0` on
     all six. `git diff --numstat` = **`5 3`** on each of the six — no encoding blow-up.
   - **Negative control first:** `lint-station.mjs` REJECTed 6 of 7 with
     `canonical block station-contract has been EDITED (sha 05b2dbbf9cb314ba, expected
     3e913c93242cdcd0)` — and **all six reported the identical new sha**, which is the proof the
     edit is byte-identical across the six.
   - Re-recorded with `--write-canonical` → `station-contract v1 05b2dbbf9cb314ba`. Re-lint:
     **ADMIT all 7 docs clean, exit 0.**
   - 🔴 **`station_doc_version` was NOT bumped** and `contract_version` stays **v1**, deliberately:
     the scheduled-task bootstraps declare 1, and a bump would force every station to run READ-ONLY
     until Marco re-pasted all five.
2. **Swept up the two orphaned breadcrumbs** — my 04:08Z one and Station 04's 02:11Z one — plus
   `docs/pipeline/sweep-rotation.json` (`last_index: 2`, which must travel with 04's breadcrumb or
   the rotation stalls on `repo-hygiene`). Copies verified **byte-identical** to the dev-tree
   originals with a node `Buffer.equals` check, not a PowerShell pipe.
3. **Landed this breadcrumb in the same PR**, before opening it, so this run sweeps itself up.

## FINDINGS

### F1 — I stopped dispatching the refuted-diagnostic fix and landed it myself.
It had been DISPATCHED to Station 06 at 04:08Z. **Station 06 has no schedule** (measured: it is
absent from `list_scheduled_tasks`), and the execution lane is dead on expired OAuth, so neither
channel that could have delivered it will fire unattended. A docs-only, hash-gated, six-file
byte-identical edit in an isolated worktree is squarely inside 00's ACTIVE DRIVE MANDATE. Re-issuing
the dispatch would have been a status update wearing an action's clothes.

**DISPOSITION: ACTIONED** — verified by `lint-station.mjs` ADMIT (all 7, exit 0) after a REJECT
negative control, `5 3` numstat on each of six files, and the merge read back on `origin/main`.

### F2 — `status-sweep.ps1` reports "auto-restart wrapper: alive (3)" when there are zero `supervise-watcher.ps1` processes.
It is counting `watcher-launcher-singlelane.ps1`. The number is coincidentally reassuring and the
label is wrong, which is the §7 shape exactly: a healthy system, a lying instrument. It also means
the station doc's **§3b ENSURE-UP block is dead code** — it tests for a wrapper this machine no
longer uses, so it can only ever fire a false "wrapper ABSENT — relaunched". I did **not** run it.

**DISPOSITION: DISPATCHED** — to Station 06, as one docs PR, two edits: (a) `status-sweep.ps1`
relabel the count to `watcher launcher` (or count `supervise-watcher.ps1` and print 0 honestly);
(b) `docs/pipeline/stations/00-supervisor.md` §3b — replace the `supervise-watcher.ps1` regex with
`watcher-launcher-singlelane\.ps1`, or delete §3b and say the launcher owns the lifecycle.
⚠️ §3b is **outside** the canonical block, so this needs no hash re-record.

### F3 — The board is completely still, and that is still correct.
0 open, 0 armed, 4h07m since the last merge, queue byte-identical to two runs ago. With OAuth dead,
**stillness is the brake working.** It is not health and it is not a stall.

**DISPOSITION: DEFERRED** — becomes urgent the instant ARMED goes ≥ 1 while OAuth is still expired:
that prompt will burn to `failed/` exactly as `pr-crm-s3` and `rev-1386` did. **ARM NOTHING.**

### F4 — OAuth has been dead 14 hours and nothing is refreshing it.
Now measured at source, not inherited: `expiresAt` 2026-08-28T16:13:35Z, file mtime 16:13:26Z
unchanged. Every armed prompt burns. **This is the single most important thing blocking the board.**

**DISPOSITION: ESCALATED** — unchanged and unanswered since 18:09Z yesterday. Two questions:
1. **Re-authenticate.** Only Marco can; no agent has an identity.
2. **Do we build the guard?** RULE 1, complete-and-additive first:
   **(C)** watcher preflight refuses to consume a prompt when `.credentials.json` `expiresAt` is in
   the past, and files a one-line `blocked/` note instead of a `failed/` quarantine. *Solves it now
   and in future; touches no data; a burned prompt becomes a held prompt.* **Both halves pass.**
   **(A)** Re-auth and move on. *Fails the future half — this is the third occurrence.*
   **(B)** Add a token-expiry line to `status-sweep.ps1` only. *Fails the complete half — it warns
   a reader; it does not stop the burn.*

### F5 — Marco's bootstrap paste still has two items, and neither has moved.
(i) the `docs/qa`-is-gitignored false claim at line 84 of the five `Scheduled\*\SKILL.md`
bootstraps (repo half already landed in #1383); (ii) the same refuted blindness diagnostic in the
`00-supervisor` bootstrap's STEP 1 — **the repo half is now fixed by this PR**, so the bootstrap is
the last layer still asserting it. No agent may edit `C:\Users\Marco\Claude\Scheduled\**`.

**DISPOSITION: ESCALATED** — one paste, two edits. Exact before/after text is in my 04:08Z
breadcrumb, landed in this same PR.

### F6 — The watcher clone FF is still safe, still needed, and still nobody may do it.
Re-measured this run: `11 0`, `--is-ancestor` exit 0, non-` D` dirty = **0**. Consequence, restated
because it is easy to skip: `#1358`/`#1360`'s guards are **INERT** until the clone is fast-forwarded
— a restart adopts nothing (DOCTRINE §9.5). 00 is barred absolutely (DOCTRINE §4, station doc
"never merge in the watcher repo"); 03 is report-only.

**DISPOSITION: ESCALATED** — RULE 1: **(C)** a guarded `ff-watcher-clone.ps1` (stop watcher →
`git stash drop` loop → `merge --ff-only` → relaunch → read back) plus a narrow Station 03 authority
to run *only that script*. *Both halves pass.* **(A)** Marco by hand — *fails the future half.*
**(B)** Leave it — *fails both; the guards stay inert.*

### F7 — The two orphan launchers are inert, and no station may remove them.
10364 and 23100, dead parents, no watcher descendant. They are harmless — `start-watcher.ps1`'s
SINGLE-INSTANCE guard refuses a second node — so this is untidiness, not a fault. But "repair the
machines" is 03's lane and 03 is report-only, so the standing gap is the real finding: **nobody owns
machine repair.**

**DISPOSITION: DEFERRED** — folds into F6's ownership escalation. Becomes urgent if a third
watcher node ever appears, which would mean the single-instance guard has regressed.

### F8 — `weekly-security-audit` has been disabled 11 days.
`enabled: false`, `lastRunAt 2026-08-18T08:18:52Z`. Deliberate or forgotten is not derivable.

**DISPOSITION: DEFERRED** — one question for Marco when something else needs him anyway (it does:
F4 and F5).

## WHAT I DID NOT DO

- **Did not arm anything.** ARMED stays 0 while OAuth is dead. `-HOLD` count 84, untouched. The
  next-arm order is unchanged and every item on it stays parked.
- **Did not merge anything but my own docs PR**, and there was nothing else to merge — 0 open PRs.
- **Did not touch `C:\po-watcher\ProjectOperations`** beyond read-only `git`. No FF, no stash drop,
  no relaunch.
- **Did not kill 10364 or 23100.** Out of lane, and they are inert.
- **Did not run §3b ENSURE-UP** — it tests for a wrapper this machine does not run (F2); firing it
  would have started a second launcher on a false negative.
- **Did not write to the shared dev tree.** Station 04 was running concurrently
  (`lastRunAt 06:10:18Z`); everything went through `C:\po-wt-sup0610` and a pathspec commit.
- **Did not touch `/sot/`**, the four unrelated ` M` files in the dev tree, anything Azure / Entra /
  SharePoint, or any production data.
- **Did not re-raise** the `sot-refs` 23-vs-26-vs-28 mismatch, the `check-breadcrumb.mjs:82` fix, the
  `lint-prompt.mjs` block-scalar collapse, or `no-pr-opened/` still being unignored — all open, none
  new, all already dispatched.

---

**This breadcrumb was written BEFORE its PR was opened, so this run sweeps itself up.** Nothing is
left orphaned for the next run.
