# Station 00 — Supervisor | 2026-09-05T14:44Z–2026-09-05T14:5xZ

## GROUND

```
UTC            2026-09-05T14:44:00Z
origin/main    64b68897            (git fetch origin --prune, then git rev-parse)
dev tree       main @ 64b68897     C:\ProjectOperations2  (fast-forwarded after #1668 merged)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

**Addendum to `00-00-supervisor-2026-09-05-1408-*`, same SIGHTED run, PID 16568.** That report was
written and merged as `#1668` at 14:36:30Z. **Station 04 fired at 14:10Z — inside this run — and
wrote its breadcrumb at 14:20Z, eleven minutes after this run's `check-breadcrumb --freshness` had
already read the queue root as holding one file.** This addendum exists because a collect that
misses a breadcrumb that arrived mid-run is a collect that did not happen.

## WHAT I MEASURED

**[MEASURED] Station 04's run is real and its hand-off arrived the documented way.**
`docs/pr-prompts/00-04-scanner-2026-09-05-1410-every-bootstrap-tells-the-run-to-read-the-working-copy-its-own-station-doc-forbids.md`,
21 388 B, `LastWriteTimeUtc 2026-09-05T14:20:02Z`, untracked in the dev tree. Its sibling signal is
`docs/pipeline/sweep-rotation.json`, which 04 advanced and — per its own station doc — left **dirty
in the shared dev tree** for 00 to commit: `git diff --numstat` -> `2 2`, `last_index 2 -> 3`,
`last_run_utc 2026-09-05T10:10:07Z -> 2026-09-05T14:11:00Z`. Both are carried by this PR.

⚠️ **That dirty file is also the documented second cause of a refused post-merge fast-forward.**
It was **clean** at 14:08 and dirty at 14:37, which dates 04's write to inside this run and is why
the 14:08 report could not have seen it.

**[MEASURED] The `#1668` merge read back.** `state=MERGED mergedAt=2026-09-05T14:36:30Z
commit=64b68897d44ded2f3e4d24e7b37797e57ca75b3e`, via `Assert-SmokedOrEscalate -PR 1668` (True) then
`Merge-Pr -PR 1668` (True) — the sanctioned primitives, never a raw `gh pr merge`. Dev tree
fast-forwarded `2ba3a2b4..64b68897`; read-back `git rev-list --left-right --count HEAD...origin/main`
-> `0 0`, `git diff --cached --name-status` EMPTY, and `git diff --numstat` non-empty **for
`sweep-rotation.json` alone**, which is the hand-off above and not a defect.

**[MEASURED] The single-actor gate cleared before that merge, and it was not clear when first read.**
The 14:21:43Z sweep returned `CAUTION: 3 LIVE STATION WORKTREE(s)` naming
`C:/po-worktrees/sot05-20260905` alongside this run's own two. **That was Station 05 mid-run** — its
daily 00:10-local slot — so this run WAITED rather than racing it, re-polling until the worktree was
gone at 14:34:28Z and 05's PR `#1669` was open. The 14:34:44Z re-sweep then named **2** live
worktrees, both this run's own. Only then did the merge proceed. `in-progress prompts: 0`,
`index.lock interactive/clone: False / False`, `git processes running: 0`, `no PR touched in 2 min`
on both sweeps.

**[MEASURED] Anchor verification for the F2 fix below**, against
`scripts/pr-watcher/index.mjs` at `64b68897`: `const MERGE_TIMEOUT_MS` -> **1** hit (line 139),
`const allGreen` -> **1** (1837), `async function waitForPolicyMerge` -> **1** (1774),
`marco: true` -> **10** hits (which is why it is anchored by its enclosing function, not by itself),
NEGATIVE control `zzzNoSuchNeedleZzz` -> **0**. `lint-station.mjs` exit **0**, `ADMIT: all 8 docs
clean`, both **before** and **after** the edits — the two hash-gated canonical blocks
(`instruments v2` = §9, `station-contract v2` = the station docs) are untouched.

## WHAT CHANGED

**On the board:** `#1668` merged (above). `#1667` opened and driven, **not** merged — it is Marco's.
This addendum PR opened. Nothing else: no label applied or removed, no arm, no PR closed.

**In the dev tree:** fast-forwarded `2ba3a2b4 -> 64b68897`. Nothing else; `sweep-rotation.json`
remains as Station 04 left it and is restored to the new HEAD after this PR lands.

**In an isolated worktree off `origin/main`** (`C:\po-wt\board-1445`, branch
`board/00-addendum-2026-09-05-1445`): the two docs fixes below, 04's breadcrumb archived, the
advanced `sweep-rotation.json`, and this report.

## FINDINGS

Station 04's five findings, each given exactly one disposition. **Three were dispatched to this
station; a dispatch cannot be handed back, so each is either actioned here or deferred with the
condition that makes it urgent.**

### F1 (04) — `lint-station.mjs` compares two different version numbers and would put every scheduled station read-only

**DISPOSITION: DEFERRED.** It is a `scripts/` change, which is outside 00's recorded `docs/` lane
(`STATION-CAPABILITIES.md` §5) and outside `NESTED_TEST_PATHS`, so this station can open it but not
merge it — and it is already filed at
`needs-marco/lint-station-compares-the-wrong-version-field-2026-09-05.md`. **#1667**, opened by this
same run, is already one unmerged `scripts/` PR waiting on Marco; adding a second in the same hour
compounds the review queue without moving the board. **What makes it urgent:** the first time a
`station_doc_version` is bumped, or the moment `#1667` lands — whichever comes first, the next 00
run should carry it in the same lane.

### F2 (04) — DOCTRINE §10.3's four `index.mjs` line citations were all wrong, in the dangerous direction

**DISPOSITION: ACTIONED, option (a), in this PR.** All four are now symbol anchors —
`const MERGE_TIMEOUT_MS`, `const allGreen`, `async function waitForPolicyMerge`, and the
`marco: true` return named by its enclosing function — each verified to resolve to exactly one hit
with a negative control (above). A new ⚠️ paragraph in §10.3 records what the four numbers were,
what they actually pointed at, and that **§9.5's anchor rule applies document-wide**, not just to
"every citation below."

🔧 **One deliberate deviation from 04's option (a), and it matters.** 04 asked for that scoping line
to be added *to §9.5's anchor bullet*. **§9.5 is inside the `instruments v2` canonical block**, so
editing it requires re-recording the block hash and shipping all seven station docs in one PR —
which is exactly the change 04's own F2 note says this fix does not need. The scoping sentence is
therefore stated in **§10.3**, outside the block, where it is equally binding and costs no
re-record. `lint-station.mjs` exit 0 before and after confirms the block is untouched.

### F3 (04) — all five live bootstraps tell the run to read its binding documents from the working copy

**DISPOSITION: ESCALATED — unchanged, and correctly 04's call.** The five files live at
`C:\Users\Marco\Claude\Scheduled\*\SKILL.md`, which is the one layer **no agent can edit**
(`STATION-CAPABILITIES.md` §1). 04 wrote the exact insertion text; this station can only confirm the
defect reproduces and hand it over. ⚠️ **This run is itself an instance:** the bootstrap sent me to
the working copy, and it was only safe because PREFLIGHT step 2 was obeyed instead — `git diff
--numstat origin/main --` the three documents returned EMPTY with `HEAD == origin/main`. **A run
that follows the bootstrap and not the station doc gets no such proof.**

### F4 (04) — 00's documented cadence is wrong by 2x on both layers, and the collision is midnight Brisbane

**DISPOSITION: ACTIONED (the docs half) in this PR; the cron half stays with Marco.**
`STATION-CAPABILITIES.md` §6's `00` row now reads **hourly — read it from the MCP**, and a new
block under the table records: that a cadence in that table is **state** and must be read from the
scheduled-tasks MCP; that `00` is `5 * * * *` and `03` is `0 9 * * *`; and 04's cause for the
three-stations-in-165-seconds collision — cron evaluated in **Brisbane local time**, with 00 (`:05`
hourly), 04 (`:00`/4 h) and 05 (`00:10` daily) all landing within ten minutes of midnight local
every night. That gives the open cron-offset escalation the two things it lacked: a **minimum
offset** (ten minutes) and **which station must move** (05, whose slot is the fixed one).
**The cron edits themselves are Marco's** — scheduled-tasks layer, not this repo.

⚠️ The 2x error is not cosmetic: anything computing *"did 00 miss a run?"* from a documented 2 h
period against a 1 h cron errs **toward not noticing**, which is open escalation #23's failure mode.

### F5 (04) — `STATION-CAPABILITIES.md` §1's bootstrap-currency timestamp is stale for the second time

**DISPOSITION: DEFERRED, agreeing with 04's own reading.** Harmless while the `Get-Item …
LastWriteTimeUtc` probe sits directly above the stale figure. **What makes it urgent:** a third
rewrite of the bootstraps, or any run quoting the date instead of measuring it. I was in that file
this run and deliberately did **not** fold the fix in — §6 and §1 are separate claims, and mixing an
un-dispatched cleanup into a dispatched fix is how a reviewer loses the thread of what was asked
for.

## WHAT I DID NOT DO

- **Did not merge `#1667`, `#1662` or `#1665`.** `#1667` is this run's own `scripts/` fix and is
  outside 00's lane; `#1662` and `#1665` are `[NO LANE VERDICT — hand-classified]` and both carry a
  `migrations/` path ⇒ Marco's. All three are open, green or driving green, and left alone.
- ⚠️ **`#1669` — this line said "left for the next run" when written at 14:45Z, and that reason
  expired before this PR was merged. Corrected rather than left standing.** Station 05's reconcile
  was opened 14:33Z with its checks unsettled, which was the whole of my reason for standing off. At
  14:4xZ it read **9 SUCCESS / 5 SKIPPED / 0 failing**, so the reason was gone. **[MEASURED]** it
  carries `labels: []`, `author GH-Mantova`, `mergeStateStatus CLEAN`, and **0** hits in
  `docs/pr-prompts/processed/pr-*.log` (negative control `PR #999999` -> 0) ⇒
  `[NO LANE VERDICT — hand-classified]`, classified by the **authority matrix** under §10.1 step 3,
  not by `classifyPolicyFiles`: it is `sot/` + `docs/`, which is Station 05's recorded lane, and that
  lane's boundary is the one proved in CI by **CP-24** — green here. **Merged.** It carries 05's own
  breadcrumb (`00-05-sot-keeper-2026-09-05-1411-ten-breadcrumbs-have-filed-the-same-roadmap-finding.md`),
  which lands in the queue root on merge and is **the next run's first collect item** — it is not
  dispositioned here and must not be archived until it is.
- **Did not edit `§9.5`, any canonical block, or `sot/`.** F2's scoping line went into §10.3
  instead, for the reason stated there.
- **Did not touch the watcher clone (`dirty=4`) or `C:\po-vg` (`dirty=1`, one uncommitted file).**
  Both are 03's and both are already dispatched.
