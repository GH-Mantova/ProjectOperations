# Station 00 — Supervisor | 2026-09-21T19:14:29Z–2026-09-21T19:4xZ

## GROUND

```
UTC            2026-09-21T19:14:29Z
origin/main    1097be7d               (fetched, then rev-parse)
dev tree       main @ 1097be7d        C:\ProjectOperations2
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** — this run was not read-only-by-mismatch.

**This breadcrumb ships inside its own run's PR** (the preferred home per the report contract), so
nothing needs to sweep it up.

---

## WHAT I MEASURED

**PREFLIGHT — reached the box.** Desktop Commander tools loaded via keyword `ToolSearch` (ids are
environment-specific and were not assumed), then `start_process` shell `powershell.exe` → **PID
34980**. Not a blind run.

Device-bridge git guard installed, last line quoted verbatim, **PASS**:

> `vm-git-guard installed at /sessions/eloquent-amazing-hypatia/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)`
> `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`

**Binding documents proved current with the SOUND form** (§9.1 — no piped hash, which is unsound in
`powershell.exe`): `git diff --numstat origin/main -- <path>` over all three
(`stations/00-supervisor.md`, `DOCTRINE.md`, `STATION-CAPABILITIES.md`) → **EMPTY**, run in the DEV
TREE. `HEAD == origin/main`, so the working copies are the same bytes as `main`. [MEASURED]

**Every shell chain in this run carried a literal marker after each statement** (§9.1's
`EARLY_RETURN_REPORTED_AS_TERMINATION_V1` guard 1). `MARKER_A` … `MARKER_AR` all printed. One chain
did hit the early-return/false-termination shape — the in-situ sweep run returned
`timed out after 180s` — and guard (2) settled it: `read_process_output` on the same PID drained the
full buffer including the line being looked for. **No statement in this run is UNRUN-read-as-EMPTY.**
[MEASURED]

**SWEEP.** `scripts/pipeline/status-sweep.ps1`. Section 0 controls both `[LIVE]` PASS
(`gh CAN reach GitHub (saw merged PR #2058)`, `node runs`). Section 7 verdict: **`SAFE TO ACT`** —
no board mutation in progress, no recent remote activity, no live station worktrees. Section 3:
`git index.lock interactive/clone: False / False`, scoped git processes **0**. [MEASURED]

**⚠️ Section 5 printed ZERO `[STALE]` escalation rows this run.** The eleven PR-scoped dead rows
that the AUTHORITY block records as 00's to clear are **already discharged** by prior runs — grepped
for `[STALE]` across the whole 464-line sweep, the only three hits are the legend, a quoted line
inside an old state file, and the trailing reminder. Nothing to discharge. [MEASURED]

### The board — five PRs, and the diagnosis is the same for all five

`gh pr checks` per PR, then the **job log** for the reds (never the diff — YOUR LIMITS item 6):

| PR | CI | mergeState | labels | the watcher's own merge verdict |
|---|---|---|---|---|
| `#2042` | 15/0/0 green | **CLEAN** | none | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ClientQuotesPanel.tsx"}` |
| `#2044` | 13/2 | BLOCKED | `do-not-merge` | `escalates:true - held for Marco, labelled do-not-merge` |
| `#2047` | 13/2 | BLOCKED | `do-not-merge` | `escalates:true - PR already carries do-not-merge` |
| `#2049` | 15/0/0 green | UNKNOWN | none | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-station.mjs"}` |
| `#2051` | 13/2 | BLOCKED | `do-not-merge` | `escalates:true - held for Marco, labelled do-not-merge` |

🔴 **The three reds are red BY DESIGN, not by defect, and the job log says so in one line.** All
three fail the **same two** checks and nothing else, in 7–17 s:

```
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
        A human must review and REMOVE the label; removing it is what releases the merge.]
```

Everything else on those runs passes or legitimately skips — CP-11 ALLOWED, CP-12/13/17/23/24/25
PASS, CP-09/10/22/27 SKIP. **There is no code fault to fix on any of the three.** The second failing
check, `Approval receipt (CP-26)`, is the same gate's receipt half. Removing a `do-not-merge` label
is forbidden to me absolutely, so these are not "failed PRs I own" under the ACTIVE DRIVE MANDATE
rule 2 — they are the hard stop working. [MEASURED]

**So the board is five-for-five gated on Marco, by two different mechanisms** (three by
`escalates:true`+label, two by the watcher's `outside tests/ or docs/` policy path). This is the
standing throughput constraint, already escalated and carried by my own 18:14Z run as its F3; it is
**carried forward below, not re-filed as new**.

### Freshness, crossed against `lastRunAt` (the breadcrumb is one instrument and cannot name a cause)

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 0, `CLEAN`**, 2 checked, 0
malformed. Crossed against `list_scheduled_tasks` (scheduled-tasks MCP), per the AUTHORITY table:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-21T19:13:58Z` | 18:14Z | aligned; 19:13 is THIS run |
| 03 | `2026-09-21T00:20:35Z` | 00:21Z | aligned, healthy (cadence 24 h, next 23:02Z) |
| 04 | `2026-09-21T18:09:36Z` | 18:10Z | aligned, healthy |
| 05 | `2026-09-21T14:10:40Z` | 14:11Z | aligned, healthy |

**No station is SILENT and none shows the fresh-`lastRunAt`-no-breadcrumb shape.** `weekly-security-audit`
reads `enabled: false`, `lastRunAt 2026-09-06` — that is the **already-escalated**
`weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`, not a new
finding. [MEASURED]

### 04's dirty-file instruction was ALREADY DISCHARGED — re-read before acting (§7.1)

04's breadcrumb carries a red instruction: *"`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN
THE DEV TREE (` M`). STATION 00 MUST COMMIT IT."* **Acting on it would have been wrong.**
`git status --porcelain` in the dev tree does not list it, and
`git show origin/main:docs/pipeline/sweep-rotation.json` reads `"last_index": 2`,
`"last_run_utc": "2026-09-21T18:09:53Z"`, `"last_station": "04-scanner"` — 04's own advance, already
on `main` via **#2058**. The rotation is not stopped. [MEASURED]

### Queue

`armed (*-ready.md): 0` · `HOLD: 20` · needs-marco 63 · no-pr-opened 109 · failed 59 · blocked 150.
Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`. The one `READY TO STAGE` row is
`rates-11c-blocked-consumers`, which is on the **forbidden never-arm denylist** (`rates-s11c`,
DOCTRINE §8.4) — it is a register entry, not an armable prompt. **Nothing was armable this run.**
[MEASURED]

---

## WHAT CHANGED

1. **PR #2059 opened** — `fix(status-sweep): 4C refuses to quote a state summary older than 3 days`,
   branch `fix/sweep-4c-stale-state-summary`, one file, +30/−5. Authored in a disposable worktree off
   `origin/main`, **never in the dev tree**. Read back: `git diff --cached --name-status` staged
   exactly `M scripts/pipeline/status-sweep.ps1` and nothing else; PR body file verified
   `BOM= false` with `node` before `gh pr create` (§1's first row).
2. **This board PR** — commits 04's 18:10Z breadcrumb (which was UNTRACKED and reaching nobody),
   adds this breadcrumb, and `git mv`s the dispositioned 18:14Z supervisor breadcrumb to
   `docs/pr-prompts/archive/`.
3. **Both disposable worktrees torn down.** `git worktree list` read back → dev tree + the
   pre-existing `po-vg` only. This matters because my own 18:14Z run recorded that a live 00 worktree
   makes the sweep's single-actor gate refuse 00's own merge (its F7).
4. **Nothing else.** No board PR merged, no prompt armed, no label added or removed, no watcher
   restart, no branch or ref deleted, no stash dropped, no worktree pruned, no `/sot/` edit.

---

## FINDINGS

### F1 — COLLECTED: Station 04's 18:10Z breadcrumb, seven findings, all dispositioned

04's `repo-hygiene` sweep. Disposition of each, as the only channel that closes:

| 04's finding | 04's disposition | mine |
|---|---|---|
| **F1** 110 remote-tracking refs against a remote of 20; 66 prunable; **23 no `--prune` can reach** (`pr/*` 13, `pr1273` 1, **`staleprobe/*` 9**) | DISPATCHED → 03 (prune) + 00 (DOCTRINE §9.2 clause) | **Prune half DISPATCHED → 03** (next run 23:02Z). **Doc half DEFERRED** — see F3 below |
| **F2** 4 merged heads survive; **9 closed-unmerged must NOT be deleted with them**; `fix1483` has never had a PR | ESCALATED | **ALREADY ESCALATED, not re-filed** — `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` cites exactly those nine (`#1871 #1612 #1960 #1978 #1703 #1707 #1708 #1705 #1571`). Adding a second file would be noise |
| **F3** `po-vg` worktree holds a file that **diverges** from the shipped one (`9c4587fb` vs `84ec92d4`) — `--force` would discard it | DISPATCHED → 03 | **DISPATCHED → 03**, with both blob hashes. Do not `--force` before the diff is read |
| **F4** `po-fix-2005` is 6,079 dirs / **0 files**; `size=0KB` is true | DISPATCHED → 03 | **DISPATCHED → 03**. Zero files means nothing can be lost — re-measure immediately before removing |
| **F5** watcher-clone stash loop still closed, **77** (was 71 on 09-10) | DISPATCHED → 03 | **DISPATCHED → 03**. `git stash drop`, never `pop` (§9.2). Slow leak, not urgent |
| **F6** the sweep quotes a **21-day-old** untracked file into every station's preflight | DISPATCHED → 00 | **ACTIONED** — see F2 below |
| **F7** board trap 0/0 and spent HOLDs 0/20, both with positive controls | ACTIONED | **ACCEPTED.** Re-verified independently this run: `armed: 0` |

**DISPOSITION: ACTIONED** — every finding in 04's breadcrumb now carries a disposition, and the
breadcrumb itself is committed by this PR rather than left untracked. Four items (04's F1-prune, F3,
F4, F5) are named here for **Station 03**, which wakes at 23:02Z and reads this file.

### F2 — The sweep was reading three-week-old board state aloud at the top of every station's run. Gated, with controls, shipped as #2059

04's F6, actioned. `status-sweep.ps1` §4C selected `docs/pr-prompts/queue-watch-state.md` as
`[FILE] freshest station summary` and printed ~20 lines of its body into **every** run. That file is
**21 days old**, and untracked *and* unignored, so nothing will ever commit or remove it. The board
it describes is `#1443 #1450 #1457 #1460`. **The live board is `#2042 #2044 #2047 #2049 #2051`.**
Every quoted number is three weeks dead, and it printed **above** the `[LIVE]` section that
contradicts it.

The fix adds `$StateSummaryMaxAgeDays = 3` beside `$Queue` and gates the body-quoting on it. Past the
threshold the file is still **named and dated** — nothing is hidden — but the body is withheld and
the line is tagged `[STALE]`, which the sweep's own legend already defines as *"proven out of date,
NEVER repeat it as current."*

**Controls were run against the REAL BYTES**, not a retyped copy: the §4C block was sliced out of the
modified file by pattern (`BLOCK_LINES:493-525`) and executed against fixtures whose truth is known
by construction.

| fixture | age | result |
|---|---|---|
| positive — gate must fire | 21 d | `[STALE] no station summary younger than 3 days …` and **neither `FIXTURE_BODY_LINE_*` leaked** |
| **negative — gate must NOT fire** | ~1 h | `[FILE] freshest station summary: … (0d old)` **+ both body lines quoted** |
| empty dir | n/a | `[FILE] no station summary/state file found` — still speaks (§9.6) |

The negative fixture is the one that matters: it proves the gate is not blanket-refusing, so a
`[STALE]` reading is a real age verdict rather than a broken instrument. **In situ**, the modified
script against the real queue printed exactly one line in §4C:
`[STALE] no station summary younger than 3 days -- freshest is queue-watch-state.md (08-31 20:26Z, 21 days old); body deliberately NOT quoted.`

⚠️ **#2059 is a `scripts/` change, so it is `marco:true` and I cannot merge it** — it joins the five
already waiting. That cost is stated rather than hidden, and it does not change the judgement: an
instrument feeding every station three-week-old board state is the §7 failure shape this pipeline
exists to prevent, and the fix is 30 lines with three controls.

**DISPOSITION: ACTIONED** — verified by the three fixtures above plus the in-situ run, and shipped as
**#2059**. The half of 04's F6 that is a **design** question — whether `queue-watch-state.md` and
`.queue-sync-ledger.txt` should be tracked, ignored, or moved under `docs/pr-prompts/reports/` per
DOCTRINE §8.5 — was deliberately kept **out** of the PR and is DEFERRED below.

### F3 — DOCTRINE §9.2 names only `pr/*` as un-prunable; `staleprobe/*` has the same property

04's F1, doc half. §9.2 records that `--prune` cannot reach hand-made remote-ref namespaces and names
`refs/remotes/pr/*`. 04 measured a **second** such namespace, `refs/remotes/staleprobe/*` (9 refs),
with the identical property: invisible to `git remote -v`, counted by `git branch -r`, permanently
un-prunable. A reader who prunes, re-reads `branch -r`, and still sees a number far above the remote
concludes the prune failed.

**Not actioned this run, deliberately.** §9 is a `CANONICAL-BLOCK` whose hash `lint-station.mjs`
enforces, and **#2049 is an open PR that changes `lint-station.mjs`** (`fix(pipeline): lint-station
compares contract_version, not station_doc_version`). Editing the gated block and re-recording its
hash while the gate's own comparison semantics are in flight is how two half-landed changes produce a
wrong verdict nobody can attribute. The cost of waiting is one clause in a doc; the cost of racing it
is a broken lint on every station.

**DISPOSITION: DEFERRED** — until **#2049 is merged**. What would make it urgent: any station
reporting a prune as failed on the strength of `git branch -r`. Falsifying probe for whether the
clause is needed at all: `git for-each-ref --format='%(refname)' refs/remotes` in
`C:\ProjectOperations2`, bucketed by namespace — if `staleprobe/*` is ever 0 while `pr/*` is
non-zero, the addition is unnecessary.

### F4 — `queue-watch-state.md` and `.queue-sync-ledger.txt` are untracked AND unignored, so nothing will ever commit or remove them

04's F6(ii). `git check-ignore -v` returns **exit 1, empty** for both — untracked and unignored — so
they sit `??` in every `git status` forever, invisible to CI, to `origin/main`, and to any cloud lane.
#2059 stops the sweep *quoting* the stale one, which removes the harm; it does not decide where the
files belong. DOCTRINE §8.5 says reports go in `docs/pr-prompts/reports/`, but §8.5 is explicitly
*"written in S1 and enforced in S4"*, and these two are not obviously reports — `.queue-sync-ledger.txt`
reads like machine state.

**DISPOSITION: DEFERRED** — a queue-layout decision, and it is not urgent now that the misleading
quoting is gated. What would make it urgent: a station acting on either file's contents, or §8.5
reaching S4 enforcement.

### F5 — CARRIED FORWARD: the board is five-for-five gated on Marco, and arming faster makes the queue longer

Re-measured from scratch this run (the table under WHAT I MEASURED), not quoted from my predecessor.
Two mechanisms, both correct, neither mine to release: `#2044 #2047 #2051` carry `do-not-merge` from
`escalates:true` (and I may **never** remove that label); `#2042 #2049` are refused by the watcher's
`outside tests/ or docs/` policy path. **#2059 makes it six.** 00 can arm work, the watcher can build
it, CI can green it — and every PR touching anything outside `tests/` or `docs/` then stops.

This is not a new finding and it is **not re-escalated into a new file**; the standing escalation
stands and re-filing would be the noise the station brief forbids. Stated here so the count is
current: **six open PRs, six waiting only on Marco.**

**DISPOSITION: ESCALATED** (carried, unchanged). The question for Marco, complete-and-additive
option first per RULE 1:

- **(a) Keep the policy and triage the queue in batches — Marco merges the non-`escalates` ones
  (`#2042`, `#2049`, `#2059`) in one pass, and reviews the three `do-not-merge` ones separately.**
  Solves it completely and damages nothing: every gate stays exactly where it is, no label is
  weakened, no agent gains merge authority it should not have. Cost: Marco's time, in a batch rather
  than a trickle.
- **(b) Narrow the watcher's `outside tests/ or docs/` rule** — e.g. let `scripts/pipeline/**`
  self-merge when CI is green. Fails the second half of RULE 1: `scripts/pipeline/**` is the
  machinery every station's safety rests on, and a bad merge there is not a data-entry loss but a
  station-wide instrument fault. **#2059 is itself in that path** — I would be widening a gate that
  governs my own work.
- **(c) Leave it.** Fails the first half: the board grows monotonically, and arming faster makes the
  queue longer rather than shorter.

---

## WHAT I DID NOT DO

- **Did not remove a `do-not-merge` label from `#2044`, `#2047` or `#2051`.** Absolute, and the gate
  is not failing — it is working. The job log says in its own words that removing the label is a
  **human's** act.
- **Did not merge `#2042` or `#2049`** despite both being green with no labels. The watcher's own
  verdict is `marco:true` on the `outside tests/ or docs/` policy path for both, and my predecessor
  read `#2049` the same way. Merging on the absence of a *label* while the policy path says otherwise
  would be reading one instrument and ignoring the one that actually decides.
- **Did not arm anything.** `armed: 0` and the single `READY TO STAGE` backlog row
  (`rates-11c-blocked-consumers`) is on the forbidden never-arm denylist.
- **Did not prune, delete or force-remove anything** — not the 66 prunable refs, not the four merged
  heads, not `po-vg`, not the `po-fix-2005` skeleton, not one stash. All of that is 03's lane and
  branch deletion is irreversible (§5.4).
- **Did not edit DOCTRINE §9.2** — see F3; the canonical-block hash and `#2049` are in flight together.
- **Did not clear a section-5 `[STALE]` row** — there were none this run; grepped, not assumed.
- **Did not touch `/sot/`, the watcher clone, the watcher process, production data, or Azure / Entra /
  SharePoint.**
- **Did not run `git` from the VM against the Windows `.git`.** The guard was installed first and its
  last line is quoted under WHAT I MEASURED; every git call in this run went through the Windows shell.
