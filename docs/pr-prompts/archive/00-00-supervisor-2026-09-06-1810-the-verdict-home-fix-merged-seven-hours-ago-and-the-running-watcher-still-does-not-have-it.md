# Station 00 — Supervisor | 2026-09-06T18:08Z–2026-09-06T18:55Z

## GROUND

```
UTC            2026-09-06T18:09:31Z
origin/main    414cac0d            (fetch first, then rev-parse)
dev tree       main @ 414cac0d     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE. Run was SIGHTED — `start_process` shell `powershell.exe` returned a live prompt
(pid 36184, later 32316 after the first shell died mid-call; see WHAT I MEASURED).

## WHAT I MEASURED

**Device-bridge git guard (PREFLIGHT step 1).** [MEASURED] `bash
"$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — last line:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`,
preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`. PASS. No `git` was run against the mount this run.

**The three binding documents were read from content byte-identical to `origin/main`.**
[MEASURED] `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → EMPTY, at
`HEAD == origin/main == 414cac0d` with `git rev-list --left-right --count HEAD...origin/main` = `0 0`
and both `git diff --numstat` / `git diff --cached --name-status` EMPTY. No piped hash was used
(PREFLIGHT step 2).

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, captured whole to a file because it
returns early and hides its own §7 verdict — 47,015 chars, generated `18:10:07Z`.
§0 both instrument positive controls PASS. §7: `[LIVE] SAFE TO ACT: no board mutation in progress,
no recent remote activity, no live station worktrees.` §3: in-progress prompts 0 · `index.lock`
interactive/clone False/False · git processes 0 · no PR touched in the last 2 min.

**COLLECT.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`,
`structure: 2 checked, 0 malformed`. Freshness: `00` 1.1h · `03` 19.2h (cadence 24h) · `04` 4.0h ·
`05` 4.0h — all `ok`. ⚠️ `00`'s row is the known-wrong one: `check-breadcrumb.mjs`'s `CADENCE` map
still holds `'00': 2` against a live cron of `5 * * * *`, so a green `ok` for 00 is weaker than for
any other station (STATION-CAPABILITIES §6).

**The COLLECT window is empty of other stations' work.** [MEASURED] the only breadcrumbs in
`docs/pr-prompts/` newer than my last run (17:08Z) are my own two — `…-1612-…` (16:26Z) and
`…-1708-…` (17:30Z). No 03/04/05 breadcrumb has been written since. Nothing new to disposition
from another station this run.

**`lastRunAt` cross-check (scheduled-tasks MCP), the second instrument the table requires.**
[MEASURED] `00-supervisor` `5 * * * *` lastRunAt `18:08:17Z` (this run) · `04-scanner` `0 */4 * * *`
lastRunAt **`18:09:56Z`** · `05-sot-keeper` `10 0 * * *` lastRunAt `14:11:01Z` ·
`03-machine-minder` `0 9 * * *` lastRunAt `2026-09-05T23:01:01Z`, **nextRunAt `2026-09-06T23:00:45Z`**.
Both fresh-and-aligned rows are healthy; `03`'s 19.2h gap is its cadence, not silence.
🔴 **04 fired 99 seconds after this run started and was executing concurrently with it.**

**Board.** [MEASURED] `gh pr list --state open` → **3**, unchanged in composition since 17:08Z:

| PR | state | CI | files |
|---|---|---|---|
| `#1713` | CLEAN | 15 pass / 0 fail | 12, incl. `apps/api/prisma/migrations/20260907000000_rate_line_fields/migration.sql` |
| `#1709` | CLEAN | 15 pass / 0 fail | 6, incl. `apps/api/prisma/migrations/20260906180000_tender_client_bid_status/migration.sql` |
| `#1699` | BLOCKED | 12 pass / **3 fail** | 3, incl. `apps/api/prisma/migrations/20260906120000_rates_value_columns_require_unit/migration.sql` |

`main` CI on `414cac0d`: 4 success / 0 failed — trunk green. Labels on all three: `[]`.

**Lane classification (DOCTRINE §10.1).** [MEASURED] RULE 2 probe, pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone): **2006** logs, newest
`2026-09-06T16:25Z`, POSITIVE `marco.:true` → **617**, NEGATIVE (freshly minted needle) → **0**.
Newest log is younger than every open PR's `createdAt` (08:44:40Z / 10:44:19Z / 11:46:21Z), so the
corpus is admissible. Per-PR discriminator over `pr-*.log` only, excluding `rev-*`:
`#1699` → 0 · `#1709` → 0 · `#1713` → 0 · NEGATIVE control `PR #999999` → 0.

Freshness precondition for the `opened PR #<n>` test, applied to the **daily clone log** and not to
the launcher transcript (the correction this pipeline landed in `#1727`): [MEASURED]
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\2026-09-06.log`, mtime **`18:10:02Z`**
(seconds old), 122,829 bytes, POSITIVE `[merge]` → 8, NEGATIVE (minted needle) → 0. Its four
`opened PR #` lines are `#1692` (06:20:13Z), `#1698` (08:34:54Z), `#1700` (08:56:57Z) and `#1707`
(10:33:20Z) — the log was actively recording that line on **both sides** of all three PRs' creation
times. Precondition SATISFIED, so the absence is admissible.

⇒ **All three open PRs are `[NO LANE VERDICT — hand-classified]`, and all three are MARCO'S** —
each carries `apps/api/prisma/migrations/`, which `classifyPolicyFiles` refuses on its own
`(^|/)migrations/` clause before any test-or-docs question is asked. None is labelled; none is
mergeable by this station.

**The watcher is alive and NOT wedged.** [MEASURED] sweep §2: `watcher node: RUNNING pid 27236`,
`auto-restart wrapper: alive (7)`, `heartbeat age: 105 min`. Heartbeat ticks only mid-run and the
queue is empty, so a stale heartbeat here is idle, not wedged — and the daily clone log confirms it
directly: its last four lines are `[review] verdict-archive sweep: archived=0 kept=2 skipped=0
tracked=59` at `17:55:01Z`, `18:00:02Z`, `18:05:01Z`, `18:10:02Z`. A process writing on a
five-minute tick is not hung. **Seven** watcher-family processes remain, unchanged from 17:08Z.

**The clone, measured directly.** [MEASURED] `C:\po-watcher\ProjectOperations`: HEAD `16ddb58b`,
branch `main`, stash **69**, dirty = 2 untracked files. Its OWN `origin/main` says it is `0 4`
behind — but that ref is fetched only at launcher start (DOCTRINE §9.2, the per-tree trap), so it
under-reports. Against the REAL `origin/main`: `git rev-list --count 16ddb58b..414cac0d` → **19**.

🔴 **The running watcher does not have `#1704`.** [MEASURED] in the clone's own working tree,
`Select-String -Path C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs -Pattern
'VERDICT_HOME_RESOLVER'` → **0**, with POSITIVE control `classifyPolicyFiles` → **2** and NEGATIVE
control (minted needle) → **0**. On `origin/main` the same token is **6** (measured by the 17:08Z
run at `eef272df`, and `#1704` merged `11:41:36Z`). The instrument is sound in both directions and
the answer is unambiguous: the fix is on `main` and is not in the code that is running.

**The stranded verdicts, live.** [MEASURED] the clone's two untracked dirty files are
`docs/pr-reviews/pr-1709-review.md` (10:57Z, `VERDICT: MERGE`) and `docs/pr-reviews/pr-1713-review.md`
(11:54Z, `VERDICT: MERGE`). The watcher's own archive sweep names them every five minutes as
`kept=2` and mirrors neither.

**`#1699`'s three reds, from the job logs — never from the diff or the PR page.**
[MEASURED] `PR gates — diff checks` (job `101529134106`):
`FAIL - CP-26 do-not-merge [PR #1699 was labelled do-not-merge and released, but
docs/decisions/merge-approvals/1699.md is not in this PR's diff against merge-base with
origin/main.]` → `##[error]Process completed with exit code 1.` The required check
`Approval receipt (CP-26)` (job `101529134075`) is the same cause, second red — the recorded
coupling, re-verified rather than inherited.

[MEASURED] The **third** red is new since 17:08Z. `tendering-e2e` (job `101529157144`), full log
413,952 bytes captured through `cmd /c` so the PS `>` UTF-16 trap is excluded; POSITIVE control
`##[group]` → 32, NEGATIVE (minted needle) → 0. **`4 failed`**, all in
`tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — SLICE 4 (:398), SLICE 5 (:262), SLICE 6 (:468),
SLICE 7 (:350). Three fail identically at `expect(nav.getByRole("link", { name: dashName }))
.toBeVisible({ timeout: 10_000 })` → `element(s) not found`; the fourth at
`expect(page.getByRole("dialog", { name: "Customise dashboard" })).not.toBeVisible()` →
`8 × locator resolved to <div role="dialog" … aria-label="Customise dashboard">`.

**The controlled comparison that decides whose defect it is.** [MEASURED] all three open PRs had
`main` merged into them by `GH-Mantova` within six seconds of each other
(`Merge branch 'main' into …`, `2026-09-06T17:34:0[6|9]`/`:12+10:00` = `17:34Z`), four minutes after
`#1727` put `414cac0d` on `main`; `git rev-list --count refs/remotes/pr/<n>..origin/main` → **0** for
all three, i.e. every branch contains the whole of current `main`. Their `tendering-e2e` runs then
started within **24 seconds** of one another — `#1709` `17:34:29Z` SUCCESS, `#1713` `17:34:33Z`
SUCCESS, `#1699` `17:34:53Z` **FAILURE**. Same base, same suite, same minute, same runner fleet, two
passes and one failure. **This is not a `main` regression and not an environment flake: it is
specific to `#1699`'s own three-file diff** (the migration, `seed-initial-services.ts`, and
`CP-08-seed-idempotency.spec.ts`).

⚠️ **What I did NOT measure is the mechanism.** That a seed-data change should break four dashboard
acceptance tests is plausible — the suite runs against a seeded database — but I did not read the
seed diff against the spec, so any causal claim would be `[INFERRED]` dressed as a measurement. The
named next probe is in F2.

**Shell note (§9.1).** The first PowerShell session (pid 36184) terminated mid-call while streaming
a large `gh run view --log` through a `Select-String` pipeline, reporting
`Process 36184 has finished execution` with no output and no error. Not blindness — a second shell
(pid 32316) started immediately and every subsequent probe ran in it. The cure that worked is the
one §9.3 already prescribes for a different reason: redirect the log to a file through `cmd /c` and
grep the file, rather than streaming it through the bridge.

## WHAT CHANGED

**Nothing on the board.** Armed: 0 before, 0 after. Merged: none. Labels: none touched. No prompt
renamed, no watcher process started or killed, no clone or dev-tree git write. One disposable
worktree created off `origin/main` at `414cac0d` (`C:\po-worktrees\board-1810`), this breadcrumb
written inside it — cure 1 of the post-merge fast-forward rule, so no loose untracked copy is left
in the shared dev tree — and this PR opened from it.

## FINDINGS

### F1 — The fix for the verdict-home defect merged seven hours ago and the running watcher still does not have it. This, not anything on the board, is what is stopping work.

`#1704` merged `2026-09-06T11:41:36Z`. `VERDICT_HOME_RESOLVER` is **6** on `origin/main` and **0**
in the clone's `index.mjs`, with both controls passing. The clone is **19** commits behind the real
`origin/main`, and its own `origin/main` ref says `4` because it was fetched at launcher start —
so the instrument that would flag this under-reports it by a factor of five.

**Why this outranks everything else this run.** The queue is empty and the board is three PRs that
are all Marco's, so the only move available to this station is to arm something — and the only kind
of prompt worth arming while Marco is the bottleneck is a `tests/`-or-`docs/`-only one, which the
`tests-docs` policy can land with no human at all. That lane's second conjunct is the MERGE verdict,
which `verdictApproves` looks for at `docs/pr-reviews/pr-<N>-review.md`, and mis-homing that file is
exactly the defect `#1704` fixes. **The mis-homing is happening right now, observably**: two MERGE
verdicts (`pr-1709-review.md` 10:57Z, `pr-1713-review.md` 11:54Z) sit untracked in the clone while
the watcher's own archive sweep logs `kept=2` every five minutes and mirrors neither. Arming a
docs prompt into that code does not just risk a timeout — it writes a `marco:true` that is
byte-identical to a genuine policy routing (DOCTRINE §10.3), which RULE 2 then forbids any station
from ever clearing. **Arming now would manufacture the human gate the lane exists to remove.**

A restart alone fixes nothing — the watcher runs `index.mjs` from the clone, so the clone must be
fast-forwarded first (§9.5). The clone is Station 03's, and this station may not run `git` in it.

**DISPATCHED** → Station 03. This does not replace the dispatch `#1727` already carries; it supplies
the measurement that dispatch lacked and raises its priority. 03's steps are unchanged: preserve the
two untracked review files and the 69 stashes (`stash drop`, never `pop`), fast-forward the clone,
and restart in an idle window — the window is open now and stays open while `armed = 0`. Then
read back `VERDICT_HOME_RESOLVER` in the clone's `index.mjs` as the proof, not the fast-forward
count. Next 03 occurrence: `2026-09-06T23:00:45Z`.

⚠️ **The standing cost this puts on an already-open escalation.** 03 fires once a day. Clone
fast-forward is 03's alone, and no station may arm safely until it happens, so between a
`scripts/pr-watcher/**` merge and 03's next run the board can be un-armable for up to 24 hours — and
five 00 runs will each pay to re-discover it before 23:00Z. That is a measured cost for the
already-open question of 03's cadence (its bootstrap says 4h, its cron says daily). **Not re-raised
here** — recorded against the existing item so it is not re-derived a sixth time.

### F2 — `#1699` has a SECOND, independent blocker, and clearing the receipt will not make it mergeable.

The receipt half is on file and is not re-raised: CP-26 `RELEASED_NO_RECEIPT` needs
`docs/decisions/merge-approvals/1699.md`, no agent may ever author an approval receipt, and it is
already open with Marco. What is **new since 17:08Z** is the third red: `tendering-e2e`, `4 failed`,
all four in `batch1-dashboards.spec.ts`, on a branch whose diff is a migration plus a seed file.

The controlled comparison under WHAT I MEASURED is what makes this worth his attention rather than
a re-run: `#1709` and `#1713` merged the same `main` within six seconds, started the same suite
within 24 seconds, and both passed. Re-running `#1699` hoping for green is the move DOCTRINE §2
forbids, and the comparison is the reason — there is no flake to blame.

**ESCALATED** → Marco. Not a re-raise of the receipt question; it is the fact that answering the
receipt question alone leaves `#1699` red. Two options, RULE 1 applied:

- **(a) Complete and additive — diagnose the seed→dashboard coupling and fix it on the branch
  before the receipt is written.** Passes both halves: it removes the failure permanently and
  touches no existing or future data entry, because the change is to seed content the acceptance
  suite reads, not to anything a user has entered. The named next probe, so nobody re-derives it:
  diff `apps/api/prisma/migrations/20260906120000_rates_value_columns_require_unit/migration.sql`
  and `seed-initial-services.ts` against what `batch1-dashboards.spec.ts` expects to exist after a
  dashboard is created — three of the four failures are one assertion,
  `nav.getByRole("link", { name: dashName })` not appearing, which points at dashboard creation
  rather than at rates at all. **Marco's call whether this is his branch's work or should be
  dispatched back to a code-writer.**
- **(b) Write the receipt first and let the e2e stand.** Fails the *completely* half: the PR is
  still red, still unmergeable, and the next station to look at it re-does this diagnosis. It fails
  no data-entry test. It is only worth taking if the four tests are already known-broken for an
  unrelated reason Marco holds and no run has recorded.

### F3 — Two stations ran concurrently again, 99 seconds apart.

[MEASURED] `00-supervisor` lastRunAt `18:08:17Z`, `04-scanner` lastRunAt `18:09:56Z`. 04 was
executing throughout this run. Nothing collided — the sweep read `SAFE TO ACT`, the dev tree stayed
clean (`--numstat` and `--cached` both EMPTY at `18:09:31Z` and again before the worktree was
created), and writing this breadcrumb inside a disposable worktree keeps this run off the shared
index entirely. But the cron-offset escalation is open precisely because nothing guards this, and
this is one more instance at a fresh time of day — the previously measured collisions clustered near
local midnight; `18:0xZ` is `04:0x` Brisbane, so the `00`-hourly / `04`-four-hourly pair collides at
every fourth hour, not only at midnight. **DEFERRED** — recorded against the open cron-offset item,
not re-raised. It becomes urgent the first time a collision lands while `armed > 0`, when 04's
`sweep-rotation.json` hand-off can meet a 00 fast-forward.

### F4 — The verdict-archive sweep names the stranded files every five minutes and mirrors neither.

`kept=2 skipped=0 tracked=59`, four times in the twenty minutes I watched, against exactly the two
untracked `VERDICT: MERGE` files in the clone. This is F1's defect observed from the other side and
is not a separate problem; it is listed because it is the cheapest live proof that the mis-homing is
current rather than historical, and because it gives 03 a read-back it can run in one line after the
fast-forward. **DISPATCHED** → Station 03, folded into F1's dispatch; no separate action.

## WHAT I DID NOT DO

- **Armed nothing** — for the reason in F1, which is a change from the 17:08Z run's three reasons:
  two of those are now measured to a single cause. `armed = 0` before and after.
- **Merged nothing.** All three open PRs carry `apps/api/prisma/migrations/` and are Marco's on
  `classifyPolicyFiles`'s own clause. `#1709` and `#1713` are CLEAN and green with `VERDICT: MERGE`
  reviews; that changes nothing, because a migration fails the classifier before the verdict is
  consulted.
- **Did not repair the e2e failure on `#1699`.** It is a second-lane PR that cannot go green without a
  receipt only Marco may author, so the fix would not unblock it, and the change is to seed data —
  adjacent enough to the production-data hard stop that guessing at it is worse than naming it.
- **Did not re-run `#1699`'s `tendering-e2e`.** Not a known flake, and the controlled comparison
  gives it a cause; §2 forbids re-running for green.
- **Did not touch the clone.** No `git` in `C:\po-watcher\ProjectOperations` — not the
  fast-forward, not the 69 stashes, not the two untracked review files. 03's, absolutely.
- **Did not restart or kill any watcher process.** The seven-process family is 03's dispatch from
  `#1727`, the node is alive and writing on a five-minute tick, and a restart before the clone
  fast-forward adopts nothing.
- **Did not re-raise `#1635`** (the receipt question) or the 03-cadence or cron-offset escalations.
  Each got a measurement added instead.
- **Left alone:** `/sot/`, Azure/Entra/SharePoint, `C:\po-vg` (1 uncommitted file, still deferred),
  the ~48 untracked `docs/pr-reviews/` files in the dev tree, and the backlog register's two
  `NEEDS MARCO` items, which are unchanged.
