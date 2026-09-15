# Station 00 — Supervisor | 2026-09-15T02:09:00Z–2026-09-15T02:34Z

## GROUND

```
UTC            2026-09-15T02:09:00Z
origin/main    25db3c36  (at start; f70f7c18 after #1947, 6a37f12a after #1949)
dev tree       main @ 0ad48855 -> fast-forwarded to 25db3c36  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only on that account. Sighted run:
`start_process` returned a live `powershell.exe` on the Windows host (PID 2652) and every
number below came from it.

## WHAT I MEASURED

**The dev tree was THREE commits behind and its station doc was stale.** [MEASURED]
`git rev-list --left-right --count origin/main...HEAD` -> `3  0`, and
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md` -> `0  14`:
the working copy was missing the fourteen-line **Compare / `render-artboards.mjs`** step that
`#1946` added to the VISION REVIEW block minutes earlier. `git hash-object` on the working copy
-> `fe577216`; `git rev-parse origin/main:<path>` -> `6900ff7c` (no piped hash, per PREFLIGHT).
`git merge --ff-only origin/main` then took the tree to `25db3c36`, and the three binding
documents were read from that tree. **This is PREFLIGHT step 2 earning its place** — one hour
after the previous run measured an EMPTY numstat on the same file, it was 14 lines behind.

⚠️ **And the first attempt to see that diff returned NOTHING.** `git diff origin/main -- <path>`
printed an empty result in the first read while `--numstat` on the identical pathspec printed
`0 14`. Re-reading the shell's buffer later returned the full 20-line diff. That is DOCTRINE
§9.1's *early return with output still pending* — the corrected form, `FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1`:
the statement ran, the reader drained too soon. **Had I trusted the empty diff I would have
concluded the two instruments disagreed and that the tree was current.**

**VM git guard could not be installed — same cause as 01:09Z, unchanged.** [MEASURED]
`bash .../scripts/pipeline/vm-git-guard.sh` never reached the script:
`failed to mount ... is under Plan9 share "c" which is not mounted`. A failed install is a
FINDING, not a STOP. No VM-side call was made this run, and none could be.

**Sweep.** [MEASURED] `status-sweep.ps1` captured to a FILE and decoded `utf16le` from node
(the `*>` redirect writes UTF-16LE — §9.3): 424 lines / 145,280 bytes, generated
`2026-09-15 02:11:06Z`. Section 0 positive controls both `[LIVE]`. Section 7: **`SAFE TO ACT`**.
Section 5 carried **zero genuine `[STALE]` rows** — every row is the *"cites #N (MERGED) as
evidence — not its premise"* form, which explicitly does not clear anything. Nothing to
discharge this run.

**Freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit 0,
`CLEAN`, 2 checked / 0 malformed. `00` 1.1h · `03` 3.2h · `04` 4.1h · `05` 12.1h, all `ok`.
The 01:09Z run crossed all four against `lastRunAt` from the scheduled-tasks MCP one hour ago
and found them aligned; no station has since gone silent and none shows the false-`ok` shape,
so no transcript read was needed.

**RULE 2 probe, live tree, both controls.** [MEASURED]
`C:\ProjectOperations2\docs\pr-prompts\processed` — **2232** logs, newest `02-09-15 01:59:35Z`,
which is younger than the oldest open PR (`#1947`, created 01:41:21Z) and therefore the LIVE
tree, not the `C:\po-watcher` decoy. `Select-String -Pattern 'marco.:true'` (regex form) ->
**POS 668**; a freshly minted needle -> **NEG 0**. Matched by `PR #<n>` in the log BODY over
`processed\pr-*.log` only, `rev-*` excluded:

```
#1948  hits=2  [watcher] merge result for PR #1948: {"ok":false,"marco":true,
                "reason":"outside tests/ or docs/: apps/api/.../inspection-builder.dto.ts"}
#1946  hits=2  {"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/render-artboards.mjs"}
#1947  hits=0  -> NO LOG  -> [NO LANE VERDICT — hand-classified]
#1949  hits=0  -> NO LOG  -> [NO LANE VERDICT — hand-classified]
```

`#1946` is the positive control that the probe answers on a real routing, and it is a PR the
watcher opened, so `NO LOG` on `#1947`/`#1949` means *not watcher-opened*, not *probe broken*.

**Hand-classification of the two second-lane PRs, by `classifyPolicyFiles`, per §10.1 step 2.**
[MEASURED] from `gh pr view --json files`: `#1947` = 1 file,
`docs/plans/scope-cards-reconciliation-plan.md`; `#1949` = 1 file,
`docs/pr-prompts/pr-scopecards-s1-operational-costs-priced-HOLD.md`. Both match
`^(tests|docs)/`, neither matches `(^|/)migrations/`, neither diff is empty — **tests-docs, not
Marco's**, and both fall inside Station 00's own recorded `docs/` lane
(`STATION-CAPABILITIES.md` §5). Labels `[]` on both; `autoMergeRequest` null on both.

**The arming log is a strict superset of `main` and nothing had published it.** [MEASURED]
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` -> **`4  0`** — four
insertions, zero deletions, which §9.5's own discriminator names as *"the working copy has not
landed yet"* and explicitly NOT the shape on which you restore to HEAD. The four rows are the
sibling lane's 01:03, 01:13, 01:20 (REFIRED) and 02:02 arms. This PR lands them.

## WHAT CHANGED

**Two PRs merged, both read back as MERGED from GitHub.** Sanctioned path only —
`Assert-SmokedOrEscalate` then `Merge-Pr` out of `pipeline-lib.ps1`; no raw `gh pr merge`, no
hand merge, nothing in the watcher repo.

| PR | files | gate | merge commit | mergedAt |
|---|---|---|---|---|
| `#1947` docs(plans): reconcile the Scope Cards plan chain | 1, `docs/plans/**` | `Assert-SmokedOrEscalate` -> True | `f70f7c18` | 2026-09-15T02:17:00Z |
| `#1949` docs(pr-prompts): stage scopecards S1 (HOLD) | 1, `docs/pr-prompts/**` | `Assert-SmokedOrEscalate` -> True | `6a37f12a` | 2026-09-15T02:22:47Z |

🔴 **The guard fired in between, and it was right.** `#1949` was `CLEAN` at 02:16Z; three
minutes after `#1947` merged it read `BLOCKED` and `Assert-SmokeGreen` threw
*"check 'Changed-path filter' is IN_PROGRESS — still in flight. WAIT. Do not rebase, do not
merge, do not 'retrigger'."* That is `pollForBehindPrs` updating the branch and restarting CI,
exactly as the standing escalation predicts. I waited 90 s, re-read `mergeStateStatus` -> `CLEAN`
with zero pending/failing rows, re-ran the full gate, and merged. **No rebase, no rerun, no
`--admin`.**

**One consumed prompt retired** — `git mv docs/pr-prompts/pr-crmvis-s0-visual-parity-tooling-HOLD.md
docs/pr-prompts/superseded/` in this PR. Evidence it is spent is in finding 1.

**This PR also lands:** the 01:09Z run's breadcrumb (it was UNTRACKED and reached nobody),
this breadcrumb, and `.arming-log.txt`.

**I made no other board mutation.** No arm, no label, no branch update, no watcher restart,
no `/sot/` edit, no production data.

## FINDINGS

### 1. THREE CONSUMED PROMPTS STILL READ `PROMOTE` ON `origin/main`, AND ONLY THE DEV TREE KNOWS THEY ARE SPENT

[MEASURED] at `f70f7c18`. The dev tree shows three unstaged ` D` rows in `docs/pr-prompts`.
Every one of those files is **still tracked on `origin/main`**:

```
git cat-file -e origin/main:docs/pr-prompts/<f>
  pr-crmvis-s0-visual-parity-tooling-HOLD.md   onMain=True
  pr-ea-s2b-dashboard-filter-surface-HOLD.md   onMain=True
  pr-fv2-import-s2-review-route-HOLD.md        onMain=True
  zzQq00Needle20260915T0220-HOLD.md            onMain=False   <- NEGATIVE control
```

Linted in a clean worktree off `origin/main` (`C:\po-wt\board-0209`), so the reading is what a
fresh clone, CI, or any second actor would get — not what the dev tree shows:

| prompt | `lint-prompt.mjs` | its work |
|---|---|---|
| `pr-crmvis-s0-visual-parity-tooling-HOLD.md` | **STALE, exit 3** — *"The work is ALREADY DONE. Binned before spawning an agent."* | `#1946`, **MERGED** 02:01Z |
| `pr-ea-s2b-dashboard-filter-surface-HOLD.md` | **PROMOTE, exit 0** — `GATE_RELEASED` | armed 02:02:13Z, **build in flight right now** |
| `pr-fv2-import-s2-review-route-HOLD.md` | **PROMOTE, exit 0** — `GATE_RELEASED` | `#1948`, **OPEN** |
| `pr-draftpanel-s3-carry-over-and-picker-HOLD.md` | PROMOTE, exit 0 — POSITIVE control, genuinely unbuilt | none |

🔴 **Two of the three are `ADMIT`-equivalent to any reader of `origin/main` while their work is
already open or already building.** This is the "stays-armable-forever" defect and §10.6's
second-lane case **reached from a third direction**: the deletion happens in the dev tree at
arming time, and only the PR that the build eventually opens carries it to `main`. Until that
PR merges, `main` and the dev tree disagree about what is armable — and the dev tree's `git
status` is the only place the disagreement is visible. A cloud lane, CI, or a fresh clone sees
none of it.

🔴 **The lint is not a defence here.** It caught the one whose PR had already merged (exit 3)
and passed the two whose PRs have not, because a premise dies on MERGE and not on OPEN
(§10.6's headline). The instrument is working; it is answering a different question.

🔧 **What I did.** Retired the one that is provably spent — `pr-crmvis-s0-visual-parity-tooling-HOLD.md`
-> `docs/pr-prompts/superseded/`, in this PR, on the strength of `lint-prompt.mjs` exit **3**
against a POSITIVE control that exits 0 on the same corpus. I deliberately left the other two:
one is mid-build and one has an open PR, and retiring a prompt whose build is in flight is how
you lose the record of what is running.

**DISPOSITION: ESCALATED** — the general defect is Marco's, because every complete fix is a
`scripts/pr-watcher/**` change and that is outside this station's lane to merge. The question is
**how should a prompt's retirement reach `main` when its build opens a PR, rather than when that
PR merges?** RULE 1 ordering:
**(a)** have the watcher stage the `-HOLD.md` deletion **into the PR it opens**, at open time
rather than at merge time, so `main` and the dev tree never disagree about what is armable
[complete-and-additive: closes it now and for every future build, deletes no data, and needs no
run to remember anything — **FIRST**];
**(b)** add a queue check that cross-references every `-HOLD.md` on `main` against the open
board and refuses to arm a match — fails the *completely* half: it catches the symptom on the
arming path only, and a second lane that does not run the check is unprotected;
**(c)** rely on each run measuring it, as this one did — fails the *future* half outright, since
it depends on every future run repeating a measurement the dev tree happens to make visible and
`main` does not.

### 2. A MERGE-APPROVAL RECEIPT IS STAGED ON A PR THAT CARRIES A LIVE WATCHER `marco:true`

[MEASURED] `#1948`'s own diff contains `docs/decisions/merge-approvals/1948.md` (33 lines,
ADDED) — the supervised cloud lane's signature, written into the PR branch ahead of a merge,
which is `bd-push-slice.ps1`'s documented behaviour. At the same moment
`processed\pr-fv2-import-s2-review-route-ready.md.log` carries
`[watcher] merge result for PR #1948: {"ok":false,"marco":true,"reason":"outside tests/ or
docs/: apps/api/src/modules/forms/dto/inspection-builder.dto.ts"}`.

DOCTRINE §10.2.1 is explicit that the supervised lane *"may still not clear a genuine watcher
`marco:true` verdict (§10.1 step 1 runs first and wins)"*. So the receipt and the verdict point
in opposite directions on one PR, and **nothing in CI compares them**: CP-26 is armed by
LABELLING, `#1948` carries no label, so the gate reads `NEVER_ESCALATED` and passes without ever
looking at the routing.

⚠️ **I am NOT claiming a merge happened or that the lane did anything wrong.** `#1948` is OPEN
and unmerged as I write; the receipt may well be pre-staged for a release Marco gives in chat,
which is precisely what the lane is authorised to do. What is measurable is that the artefact
that *records* human approval now exists on a PR the watcher has routed to a human, and no
instrument reconciles the two.

**DISPOSITION: ESCALATED** — it belongs to the standing file
`needs-marco/nothing-verifies-a-merge-approval-receipt-2026-09-07.md`, whose subject is exactly
this, so I appended today's `#1948` instance rather than opening a duplicate. ⚠️ That folder is
gitignored, which is why the measurement is written out in full here.

### 3. THE SIBLING STATION 00 IS STILL LIVE ON THIS BOARD, AND I ACTED ANYWAY — HERE IS WHY THAT WAS NOT THE 01:09Z RUN'S CALL INVERTED

[MEASURED] `.arming-log.txt` shows `actor=station-00.interactive-0003` arming at 01:03:10Z,
01:13:02Z, a REFIRE at 01:20:51Z and 02:02:13Z — the last of those **seven minutes before this
run started**. The sweep's section 3 at 02:11Z and a re-measure at 02:16:31Z both read: no
`index.lock` in either tree, **0** git processes touching our trees, no PR touched on GitHub in
the last two minutes, and the armed set unchanged at `pr-ea-s2b-dashboard-filter-surface-ready.md`
+ `rev-1949-ready.md` across both readings.

The 01:09Z run stood off completely and was right to: every merge on its board was Marco's, so
standing off cost nothing. **Mine was a different board.** Condition 3 asks whether something
else is *mid-mutation*, and the two acts I took — a `Merge-Pr` against GitHub and a commit in a
disposable worktree — touch neither the shared git index nor the queue, which is where LL-38
bites. The sibling's last act was an ARM, ten minutes cold, and arming is the one thing I did
**not** do.

**DISPOSITION: DEFERRED** — the underlying question (which actor owns the board when two are
live) is already ESCALATED with its three options in
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`,
re-stated by the 01:09Z run. Nothing here is new evidence about it; what is new is a worked case
of the boundary being drawn, and that belongs in a breadcrumb rather than a second filing. What
would make it urgent: a sibling arm or merge landing *between* my gate and my `Merge-Pr`, which
would show the two-minute window is not enough.

### 4. THREE ORPHANED WORKTREES, ONE HOLDING UNCOMMITTED WORK FOR ~10.8 DAYS — UNCHANGED SINCE 01:09Z

[MEASURED] sweep section 2, re-read this run:

```
C:/po-fix1891                          1dc31858 (detached)   dirty=0  age=1496 min
C:/PR-Master/worktrees/po-vg           23c91ba9              dirty=1  age=15498 min
C:/PR-Master/worktrees/pr1823          9664f95a              dirty=0  age=7439 min
```

Also `[LIVE] watcher clone: branch=main dirty=2`. Per DOCTRINE §9.5 that flag counts UNTRACKED
files and `start-watcher.ps1` does not — the two are review verdicts the `rev-` job writes into
the clone by design, and a tracked-dirty clone auto-stashes rather than refusing. **Not a
defect, and not a dispatch.**

**DISPOSITION: DISPATCHED -> Station 03**, re-stating the 01:09Z hand-over because it is still
undone and 03 wakes daily: prune `po-fix1891` and `pr1823` (both `dirty=0`), and for `po-vg`
**list the file before touching it** (`git -C C:/PR-Master/worktrees/po-vg status --porcelain`)
— `worktree remove` will refuse and `--force` would discard it. Preserve any untracked
`pr-*-review.md`. I did not do it myself: worktrees and clone hygiene are 03's lane (LL-38).

### 5. ONE GATE-RELEASED HOLD IS WAITING AND THE ARMING SLOT IS FULL

[MEASURED] `pr-draftpanel-s3-carry-over-and-picker-HOLD.md` (landed by `#1945`) lints
**PROMOTE / `GATE_RELEASED`**, exit 0, in the clean worktree. Two files are armed
(`pr-ea-s2b-dashboard-filter-surface-ready.md`, mid-build, plus the auto-generated review job
`rev-1949-ready.md` which is not a prompt), so RULE 4's one-at-a-time slot is occupied.

**DISPOSITION: DEFERRED** — it is real work, correctly gated, and it is simply not this run's
turn. What would make it urgent: the ea-s2b build finishing with the slot left empty and no
sibling arming, at which point it is the obvious next arm.

## WHAT I DID NOT DO

- **I did not arm.** The slot was full before I looked (finding 5), and a sibling supervisor has
  armed four times in the last ninety minutes. A second arm from me is the RULE 4 breach, not a
  race I lost.
- **I did not touch `#1948`.** It carries a live watcher `"marco":true`; RULE 2 is a human gate
  that green CI, empty labels, a clean diff and a staged receipt do not clear. I did not update
  its BEHIND branch either — `pollForBehindPrs` will, and a push from me while a sibling holds
  the board is the collision rather than the fix.
- **I did not rebase or rerun `#1949`** when it went BLOCKED mid-run; I waited and re-gated.
- **I did not retire `pr-ea-s2b-...-HOLD.md` or `pr-fv2-import-s2-...-HOLD.md`**, though both
  read PROMOTE on `main` — one is mid-build, one has an open PR (finding 1).
- **I did not clear any `needs-marco/` file.** Section 5 produced no genuine `[STALE]` row.
- **I did not archive the two dispositioned breadcrumbs in the queue root.** Root holds three
  files, not the 159 that made archiving urgent, and archiving leaves an untracked copy at the
  root path that the next run re-commits (the measured 09-07 duplicate). Cheap to do when the
  root grows; not worth the trap today.
- **I did not prune a worktree, touch the watcher clone, or restart anything** — 03's lane.
- **I did not run `git` against the VM mount** (there is no mount), and did not substitute
  GitHub-side reads for host reads anywhere.
- **I did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
- **I did not author a merge-approval receipt.** A scheduled run never does; CP-26 read
  `NEVER_ESCALATED` on both merged PRs, so none was required.

This breadcrumb is committed **inside this run's own PR**, which is the REPORT CONTRACT's
preferred home, so no loose untracked copy is left in the dev tree.
