# Station 04 — Scanner | 2026-08-25T22:10:16Z–2026-08-25T22:18:14Z

Sweep this run: **gate-liveness** (rotation position 1 of 4, assigned by `next-sweep.mjs`).
Advanced to **instrument-honesty** at the end of the run.

## GROUND

```
UTC            2026-08-25T22:10:16Z
origin/main    8f0377e5            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ b968e4f1     C:\ProjectOperations2   (5 behind origin/main, 62 dirty entries)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. Full write authority available (Desktop Commander + PowerShell on
`LAPTOP-E6NHU4E4` reached on the first call). **This was NOT a blind run.**

⚠️ **The Cowork env said "today is 2026-08-26". Real UTC was 2026-08-25T22:10Z** — the env clock is
local (AEST, UTC+10) and the board is UTC. Every timestamp in this file is `[DateTime]::UtcNow`.

## WHAT I MEASURED

**[MEASURED] Board, 22:10:41Z via `status-sweep.ps1` (instrument positive controls both PASS).**
**4 open PRs — `#1316 #1320` green, `#1323 #1325` red.** Down from 8 at the 20:10Z supervisor run:
**#1317, #1319, #1321, #1322 all merged between 21:18Z and 22:10Z.** ARMED = 0 (`*-ready.md` at
depth 1 = 0). `needs-marco/` 9 · `no-pr-opened/` 107 · `failed/` 20 · `blocked/` 0.

**[MEASURED] Watcher RUNNING pid 29024**, wrapper alive (1). Clone on
`docs/sot-04-bp0a-job-canonical`, dirty=39 — not clean-on-main. 4 orphaned worktrees. No
`index.lock` in either tree; 0 git processes.

**[MEASURED] The shared dev-tree index is CLEAN.** `git diff --cached --name-status` returned
empty on four separate calls across this run (22:12Z, 22:15Z, 22:17Z, 22:18Z). **No R100
`-HOLD → -ready` orphan this cycle** — the trap that has re-armed three times since 08-25 08:00Z is
currently drained. The 16 ` D docs/pr-prompts/pr-*-HOLD.md` lines in `git status --porcelain` are
**worktree** deletions of consumed prompts (column 2), not staged ones.

**[MEASURED] Gate inventory — 60 depth-1 `pr-*.md`, 59 with front matter.**
20 `requires_on_main` · 13 `requires_file_on_main` · 2 `requires_merged` · 24 with no gate at all ·
1 with no front matter (`pr-settings-home-slice0-DISARMED-…`, already named as disarmed).

**[MEASURED] Every gate evaluated against `origin/main` @ `8f0377e5`**, using the watcher's own
semantics copied from `scripts/pr-watcher/index.mjs` (`stripQuotes` on the inline value, split on
the first `" :: "`, fixed-string `String.includes`, never a RegExp). Instrument controls:
`git cat-file -e origin/main:package.json` → PASS; a known-absent path → FAIL as expected.

- **8 gates RELEASED** (every gate met on main)
- 27 still unmet
- 24 have no gate; the premise is their only liveness check

**[MEASURED] Every one of the 59 premises executed** through `gate-eval.mjs runGate` (self-test:
positive AND negative controls both behaved). Polarity per `lint-prompt.mjs:586` — **exit 0 = work
STILL NEEDED**, clean non-zero = already done, BROKEN = instrument.

- **58 LIVE · 1 dead · 0 BROKEN.**
- The single dead premise is `pr-user-default-dashboard-ui-RETIRED-premise-cannot-die-2026-08-18.md`,
  which already says so in its filename. **No hidden finished work is sitting on the board.**

**[MEASURED] Premise staleness calibration.** The dev tree is 5 commits behind `origin/main`, so a
premise reading a changed path could answer for a stale tree. `git diff --name-only HEAD origin/main`
lists 17 paths. Cross-referenced against the 8 released prompts' premises: only
`pr-fv2-maintenance-usage-intervals` reads a changed path (`schema.prisma`). Re-checked directly —
`git show origin/main:apps/api/prisma/schema.prisma` does **not** contain `intervalUsage`, so that
premise is LIVE on main too. The other 7 read paths untouched by those 5 commits.

**[MEASURED] `requires_merged` gates, live via `gh`:** #1257 MERGED 2026-08-20T09:07Z (5 days ago),
#1111 MERGED 2026-08-14T01:56Z (11 days ago). Both released.

**[MEASURED] `triage-holds.ps1` does not cover this gate family.** Its entire output was two
hard-coded shepherd-merge PR refs (#545, #548) plus the open-PR count. It reported **nothing** about
any of the 33 `requires_*` gates. It is not the instrument that would have caught this.

## WHAT CHANGED

1. **Staged one new prompt as `-HOLD`** (in lane; Station 04 stages, never arms):
   `docs/pr-prompts/pr-gate-release-is-not-a-reject-HOLD.md`.
   **[MEASURED] `lint-prompt.mjs` → exit 0 ADMIT (size 3).** Read back: file on disk, 121 lines.
   **Nothing was armed. Nothing was renamed, moved or deleted. No prompt under critique was edited.**
2. **Advanced the sweep rotation** — `next-sweep.mjs --advance --utc 2026-08-25T22:18:14Z`, exit 0.
   Read back: the next sweep now reports **instrument-honesty** (position 2 of 4).
3. **Nothing else.** No merge, no arm, no push, no `/sot/` edit, no board mutation.

⚠️ Both writes are **UNCOMMITTED** and on a tracked path. Per the 2026-08-25T18:10Z ruling that the
hash-gated REPORT CONTRACT beats station-local prose — **stations write, 00 commits** — Station 00
must sweep up this breadcrumb, the staged HOLD, and `docs/pipeline/sweep-rotation.json`. If
`sweep-rotation.json` is not committed the rotation still turns (it reads the working tree), but the
next run repeats this sweep after any checkout.

## FINDINGS

### F1 — 🔴🔴 A file-based gate RELEASING converts its prompt into a PERMANENT lint REJECT. 5 already; 28 queued behind it.

`checkFileGateDead()` (`lint-prompt.mjs:473`) and `checkDeadGate()` (`:518`) both reject on
*"is ALREADY on origin/main **at intake**"*. That framing is right for a freshly authored prompt — a
gate that can never fail is a hole. But the same two functions run on **every arming lint of a
`-HOLD.md` that has been waiting for precisely that event**, and for those, gate-released is the
SUCCESS condition. The linter turns it into `exit 1`.

**[MEASURED], both directions controlled:**

| set | n | lint result |
|---|---|---|
| file-based gate RELEASED on main | 5 | **5/5 REJECT** — 4 × `CLUSTER_DEAD_GATE`, 1 × `FILE_GATE_DEAD` |
| file-based gate still UNMET (**positive control**) | 4 | **4/4 ADMIT** |
| `requires_merged` RELEASED (#1257, #1111) | 2 | **2/2 ADMIT** |

The positive control matters (DOCTRINE §7): the linter is **not** blanket-rejecting file-gated
prompts. It rejects **exactly and only** the ones whose gate has released. Deterministic, and the
`requires_merged` row shows the PR-number form does not have the defect at all.

**The five, all with a LIVE premise, the exact STANDING AUTHORITY literal, and no `do-not-arm`
marker — un-armable purely because their predecessor landed:**

| prompt | gate that released | released by |
|---|---|---|
| `pr-crm-tender-count-truth-HOLD` | `AccountDetailPage.tsx :: formatWinRate` | #1322, 21:18Z **today** |
| `pr-crm-wincount-s2-close-bypasses-HOLD` | `schema.prisma :: tenderWinCounted` | #1321, 22:10Z **today** |
| `pr-e2e-container-s2-swap-required-job-HOLD` | `playwright-container-trial.yml :: mcr.microsoft.com/playwright` | #1317, 21:50Z **today** |
| `pr-lessons-folder-s2-unfold-sot05-HOLD` | file `docs/lessons-learned/README.md` | #1305 |
| `pr-pipeline-fold-s2-merged-page-HOLD` | `permissions.decorator.ts :: ANY_PERMISSIONS_KEY` | #1313 |

**Blast radius: 33 of 59 prompts carry a file-based gate.** Every one acquires this REJECT the
moment its predecessor lands. **5 have; 28 are queued to.** Three of the five were poisoned **in the
last hour** by the merge burst — this is not a slow rot, it fires on every merge.

This also inverts the sweep's own instruction. "A dead gate MASKS the premise behind it" assumes a
dead gate lets work through early. Here it does the opposite: **a released gate LOCKS the work out**,
and it looks exactly like a correctly-rejected malformed prompt in `--all` output.

**RULE 1.** The complete-and-additive fix is to teach both checks the difference between *intake*
and *arming*: a `-HOLD.md` whose gate is satisfied emits a new `GATE_RELEASED` state at **exit 0**
with a loud promote-me line; a non-HOLD prompt keeps today's hard reject, because that hole is real.
It fixes all 33 and every future one, edits no prompt, changes no gate needle and loses no ordering
record. Both alternatives fail the *future* half: *re-point each needle at something the predecessor
introduces later* — the new needle lands too, so it dies again, and it is 33 hand edits; *drop the
key once released* — same manual cost forever, and it destroys the record of what the slice was
ordered behind.

**DISPOSITION: DISPATCHED** — staged as `docs/pr-prompts/pr-gate-release-is-not-a-reject-HOLD.md`
(lint ADMIT, exit 0, size 3, `escalates: true`). **Station 00 to arm, on Marco's authority, one at a
time.** Station 04 arms nothing.

### F2 — 3 HOLDs are gate-released, lint-clean and armable RIGHT NOW; 2 have been for 5 and 11 days.

Of the 8 released gates, the 3 that lint ADMIT are ready work nobody promoted:

| prompt | gate | released | size | lint |
|---|---|---|---|---|
| `pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD` | `requires_merged: 1111` | **11 days ago** (08-14 01:56Z) | 6 | ADMIT |
| `pr-rates-consumers-s3-persona-export-HOLD` | `requires_merged: 1257` | **5 days ago** (08-20 09:07Z) | 4 | ADMIT |
| `pr-fv2-maintenance-usage-intervals-HOLD` | `schema.prisma :: model AssetUsageReading` | (on main) | 8 | ADMIT |

All three have a LIVE premise re-verified against `origin/main` @ `8f0377e5`, the exact STANDING
AUTHORITY literal, and no `do-not-arm` marker or `docs/approvals/` gate.

⚠️ For 00: `pr-fv2-maintenance-usage-intervals` is `gate_allow: migrations`, `size: 8`,
`escalates: true` — an additive migration with a stated rollback. Under DOCTRINE §8.3 that is
Marco's call before it merges, not before it runs. `slice4c` is UI-only. Nothing here overrides
RULE 2 for any PR they open.

**DISPOSITION: DISPATCHED** to Station 00 — three armable HOLDs, named, lint-verified at
`8f0377e5`. Re-lint immediately before arming; the verdict expires the moment it prints.

### F3 — No finished work is hiding on the board. 59/59 premises executed, 0 BROKEN.

The sweep's other half — "a premise that returns false is finished work still sitting on the board"
— comes back **clean**. 58 live, 1 dead, and that one already carries `RETIRED-premise-cannot-die`
in its filename. Zero BROKEN readings, with the evaluator's positive *and* negative controls proven
first, so this is a real negative and not a failed instrument wearing a finding's clothes.

Worth recording because it is the counter-evidence to a plausible worry: the board is not silently
full of completed work. **The queue's problem is not stale prompts — it is that released prompts
cannot get out (F1).**

**DISPOSITION: ACTIONED** — measured, controlled, recorded. Nothing to fix.

### F4 — `triage-holds.ps1` is blind to the entire `requires_*` gate family.

The SCRIPT-REGISTRY sells it as "read-only HOLD triage; proves which HOLDs are already satisfied.
Pairs with the backlog check." **[MEASURED]** its full output this run was two hard-coded
shepherd-merge PR refs (#545, #548) and the open-PR count. It said nothing about any of the 33
`requires_*` gates, and nothing about the 8 that had released.

So a station following the registry and running the sanctioned instrument would have concluded the
HOLDs were fine. This is a §7 shape — a tool whose name and description promise more coverage than
it has, and whose empty result reads as an empty world.

**DISPOSITION: DEFERRED** — real, not now. It becomes urgent the moment F1 lands, because
`GATE_RELEASED` will then be the signal a HOLD-triage tool exists to surface, and 00 will need
something better than a full board re-lint to find them. Fold it into the F1 follow-up rather than
spending a separate arm on it now.

### F5 — The two untracked HOLDs still block themselves. Third consecutive run.

`pr-hygiene-gitignore-no-pr-opened-HOLD.md` and `pr-watcher-idle-tick-liveness-HOLD.md` are still
`??` untracked **[MEASURED** in `git status --porcelain`**]**. `git mv` refuses an untracked path, so
the sanctioned arming move cannot be performed on either. Both have a live premise and no gate.

Unchanged since 2026-08-25T16:08Z. Re-stated, not re-diagnosed.

**DISPOSITION: ESCALATED** to Station 00 — `git add` them with the next board commit, which is 00's
lane, not 04's. Two files, one `git add`.

## WHAT I DID NOT DO

- **Armed nothing, promoted nothing, renamed nothing, merged nothing.** Station 04 is read-only on
  the board. The three armable HOLDs in F2 are named for 00, not touched.
- **Committed nothing.** Both of my writes sit uncommitted on tracked paths for 00 to sweep. The
  shared index was clean throughout and I did not want to be the run that changes that.
- **Did not edit any of the 5 poisoned prompts.** The report-not-run rule is explicit: fixing the
  prompt under critique poisons the design review. The fix belongs in `lint-prompt.mjs`, once.
- **Did not run `lint-prompt.mjs --dequeue` on anything.** That mode calls `renameSync` (`:989`) and
  would mutate the board. Single-file mode is read-only; that is the only mode I used.
- **Did not mint a worktree.** Every `origin/main` read went through `git show` / `git cat-file` at a
  named SHA, per the 2026-08-24 supersession.
- **Ran only the assigned sweep.** Part 0's static cross-layer audit, the live-site pass and the
  GitHub reconciliation audit were left alone — one sweep covered completely beats four covered
  shallowly, and the rotation is the thing that stops findings rotting.
- **Did not quote a trunk colour.** `status-sweep.ps1`'s trunk verdict was measured a coin flip on
  2026-08-25T14:10Z and I did not read it, let alone repeat it.
