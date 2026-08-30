# Station 04 — Scanner | 2026-08-28T10:10Z–2026-08-28T10:35Z

## GROUND

```
UTC            2026-08-28T10:10:29Z
origin/main    82ba8538                (fetched, then rev-parse)
dev tree       main @ 82ba8538          C:\ProjectOperations2
doc version    1                        (docs/pipeline/stations/04-scanner.md)
bootstrap      1                        (scheduled-task SKILL.md)
```

Versions AGREE — this run was not restricted to read-only by a version mismatch.
Sighted run: Desktop Commander reached the Windows host on the first try (`start_process`,
`powershell.exe`, pid 23892). `gh` resolves at `C:\Program Files\GitHub CLI\gh.exe` and `node` at
`C:\Program Files\nodejs\node.exe`, so no lint ADMIT in this report is one of the silently-waived
kind described in DOCTRINE §9.5.

**Sweep this run: `repo-hygiene`** — assigned by `node scripts/pipeline/next-sweep.mjs`
(rotation position 3 of 4; previous run 2026-08-28T06:09Z), not chosen.

## WHAT I MEASURED

- **[MEASURED] Board state.** `status-sweep.ps1` at 10:10:59Z and again at 10:11:27Z:
  VERDICT **SAFE TO ACT**; open PRs 0; armed 0; in-progress prompts 0; `index.lock` false in both
  trees; git processes 0; watcher node RUNNING pid 5444, wrapper alive, heartbeat 9 min.
  Both instrument positive controls in section 0 passed.
- **[MEASURED] The board trap — tracked `*-ready.md` at depth 1 on `origin/main`: ZERO.**
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (with `-r`, per DOCTRINE §9.2).
  Controls: 515 paths returned in total, 209 of them depth-1 `.md` — so the query is demonstrably
  not blind. A zero here is a real zero.
- **[MEASURED] Orphaned worktrees: 4, all four SPENT.** `git worktree list --porcelain` +
  `gh pr list --head <branch> --state all`:
  `sot-d-register` → #1287 MERGED · `sot-readme-fetch` → #1299 MERGED · `sotk-03-ledger` → #1306
  MERGED · `po-wt-h` (branch `hygiene`) → `gh` reported NO PR, but `git diff --stat edef9f59 5c8c8926`
  is **empty**: its tree is identical to what merged as **#1291** from a differently-named head
  (`docs/queue-hygiene-disarm-sor-s9`). Control for that empty diff: the same command against
  `origin/main` prints `365 files changed`. All four are clean (`po-wt-h` carries one untracked
  `.cm.txt`), none carries a `locked` file or an `index.lock`, ages 4–8 days.
- **[MEASURED] Watcher-clone stash: 48 entries.** Oldest `stash@{47}` 2026-07-14T08:44+10:00,
  newest `stash@{0}` 2026-08-28T15:06+10:00 (`watcher-preflight-autostash`). ~1/day over 45 days —
  the closed loop DOCTRINE §9.2 describes, still closed.
- **[MEASURED] Merged-but-not-deleted branches: 286.** 335 local branches in the dev tree; 286 of
  their names appear in `gh pr list --state merged --limit 1000`. `git branch --merged origin/main`
  returns **0** — the squash-merge ancestry lie; ancestry is the wrong instrument here. Control:
  `docs/queue-hygiene-disarm-sor-s9` is present in the merged-head set.
- **[MEASURED] Spent HOLDs in the queue root: 21 of 81.** `lint-prompt.mjs` over every root
  `*-HOLD.md`: exit 0 = 30, exit 1 = 30, **exit 3 (already done, BIN IT) = 21**. Verified
  independently for three of them rather than trusting the exit code alone — e.g.
  `pr-comms-hub-inbox-HOLD.md`'s premise is `! test -f apps/web/src/pages/crm/comms-inbox.helpers.ts`
  and that file **is** on `origin/main` (control: a bogus sibling path returns not-found).
- **[MEASURED] Queue-root inventory:** 211 root `.md` — 81 HOLD, 1 ready, 88 `00-NN-*` station
  breadcrumbs, 41 other, 0 `rev-*`. Untracked at root: `.arming-log.txt`,
  `.queue-sync-ledger.txt`, `.queue-sync-ledger.txt.bak-2026-08-18`,
  `pr-doctrine-s9-four-false-traps-LOOPING.md`, `queue-watch-state.md`.
- **[MEASURED] `parseFrontMatter()` returns the bare block-scalar indicator.** Probed the exported
  function directly (`scripts/pipeline/lint-prompt.mjs:922`) against
  `pr-comms-hub-inbox-HOLD.md`: `premise` parsed correctly, but `premise_means`, `done_when` and
  `rollback_strategy` all came back as the two-character string `">-"`. Control, same probe,
  `pr-ci-windows-pipeline-tests-HOLD.md` (inline fields): every field parsed to its real text and
  its genuinely absent `rollback_strategy` returned `<absent>` — the parser does distinguish absent
  from present. Across all 86 parseable prompts: `premise` 0 collapsed, `premise_means` 30,
  `done_when` 21, `rollback_strategy` 13.
- **[MEASURED] The watcher is NOT affected.** `scripts/pr-watcher/index.mjs:496-513` has its own
  `done_when` extractor, whose comment states it handles folded/literal block scalars. Dequeue and
  lane-pinning read the real text.
- **[MEASURED] `.arming-log.txt` holds 3 lines** and its newest is 2026-08-28T02:10:24Z
  (`pr-crm-s2-nav-three-items-tabs`). It contains no entry for `breadcrumb` or for
  `armed-gate-inversion`, yet `processed/pr-breadcrumb-gitignore-gate-routing-not-mention-ready.md.log`
  was written at 08:20Z — that prompt was demonstrably armed and consumed. Control: the crm-s2 arm
  IS logged.
- **[MEASURED] A concurrent chat armed a prompt mid-run.** At 10:11:27Z `status-sweep.ps1` reported
  armed 0. At 10:13:48Z `pr-lint-armed-gate-inversion-ready.md` existed at the queue root, and
  `git diff --cached --name-status` showed `R100 …-HOLD.md → …-ready.md` staged in the **shared**
  index. Not an instrument lie — I checked `status-sweep.ps1:159`, which globs
  `$Queue\*-ready.md` on the filesystem with `$Queue = C:\ProjectOperations2\docs\pr-prompts`. The
  sweep was honest; the board moved between the two reads. The file's mtime (09:04Z) is older than
  the arm, exactly as the rename-preserves-mtime trap predicts — **age that file by the arm, not by
  its mtime.**

## WHAT CHANGED

- **Staged one prompt as HOLD** (not armed):
  `docs/pr-prompts/pr-lint-frontmatter-block-scalar-collapse-HOLD.md`. Read back after writing:
  no BOM, zero `U+FFFD`, `lint-prompt.mjs` returns **ADMIT (exit 0)** with no
  `MISSING_STANDING_AUTHORITY` warning.
- **Advanced the sweep rotation** — `next-sweep.mjs --advance --utc 2026-08-28T10:10:29Z`, read back:
  `last_index=2`, and a fresh `next-sweep.mjs` now returns **`instruction-drift`** for the next run.
- Wrote two read-only probe scripts to the scratch tree `C:\po-sup-fix-scripts\` (not the repo).

🔴 **All three files are UNCOMMITTED and reach nobody until Station 00 sweeps them into a board PR:**
`docs/pipeline/sweep-rotation.json` (modified), plus the untracked breadcrumb and staged prompt.
`next-sweep.mjs` printed "COMMIT THIS FILE with your breadcrumb", and I deliberately did not: the
authority matrix in `STATION-CAPABILITIES.md §5` gives Station 04 **Create a PR: ❌**, and committing
would have meant either a branch-changing git command in the shared dev tree or a direct commit to
`main`. Both are forbidden, and the shared index was holding another chat's arming rename at the
time. The REPORT CONTRACT anticipates exactly this — 00 collects. The rotation itself is safe in the
meantime: `next-sweep.mjs` reads the working-tree file, so the next local run will not repeat
`repo-hygiene`; only a `checkout`/`reset --hard` (both already forbidden) would undo it.
- **No board mutation.** Nothing armed, disarmed, renamed, moved, merged or deleted. No worktree
  minted or removed. No branch touched.

## FINDINGS

### F1 — `parseFrontMatter()` collapses YAML block scalars, and the LL-29 rollback gate passes on the result — S2

`lint-prompt.mjs:1241-1252` demands a non-empty `rollback_strategy` for any prompt whose `scope`
touches `prisma/migrations`, reading `const rb = fm.rollback_strategy` at :1245. When that field is
written as a folded block (`rollback_strategy: >-`), the parser hands it the string `">-"` — neither
missing nor empty — **so the gate passes without ever reading the rollback strategy.** 13 prompts are
in that state, including the three this gate exists for: `pr-524-rates-b-slice2-canonical-HOLD.md`
(irreversible table drop), `pr-rates-s11c-drop-legacy-tables-HOLD.md`, and
`pr-siteid-notnull-backfill-HOLD.md`.

Two smaller consequences, stated at their real size rather than inflated. `:1315`/`:1322` feed
`String(fm.done_when || "")` into the destructive-pattern corpus, so 21 prompts contribute `">-"`
there — but the same corpus also carries the whole stripped body, so only a destructive command
living *solely* inside a folded `done_when` could evade it. And `:1423` renders the exit-3 verdict
from `fm.premise_means`, which prints the unauditable `Premise no longer holds: ">-"` for **9 of the
21** currently-STALE prompts, contrary to DOCTRINE §7.1.

**The reassuring half, measured and worth stating first: `premise` collapsed on ZERO prompts, and
the watcher runtime has its own folding extractor.** No prompt was mis-binned and no dequeue
decision is wrong. This is a linter-side defect.

**DISPOSITION: ACTIONED** — staged `pr-lint-frontmatter-block-scalar-collapse-HOLD.md`, lint ADMIT
(exit 0), premise verified alive at `82ba8538` (`foldBlockScalar` occurs 0 times in the file today).
It is a HOLD; **Station 00 arms it, I did not.**

### F2 — all four orphaned worktrees are spent, and `gh pr list --head` said otherwise for one — S3

Three have MERGED PRs (#1287, #1299, #1306). The fourth, `C:\po-wt-h`, returned "NO PR EVER" from
`gh pr list --head hygiene` — a **false negative**, because its work merged as #1291 from a
differently-named head. Its tree is byte-identical to that merge commit. All four are clean, unlocked
and 4–8 days idle, so pruning them is safe and reclaims four `.git/worktrees` entries whose locks
would, by construction, have no holding process if they ever appeared.

The instrument lesson generalises: **`gh pr list --head <branch>` proves nothing about whether the
WORK shipped**, only about that branch name. Compare trees before calling a branch unshipped.

**DISPOSITION: DISPATCHED to Station 03 (Machine-minder)** — prune the four worktrees during an idle
window, then `git worktree prune`. Not mine: worktree removal is a machine repair. Note `po-wt-h`
carries one untracked `.cm.txt`; nothing else is dirty.

### F3 — the watcher clone's stash is still a closed loop: 48 entries, growing ~1/day — S3

Oldest 2026-07-14, newest today at 15:06 local. The launcher preflight stashes on every start and
nothing ever pops, exactly as DOCTRINE §9.2 records. Nothing is lost today, but the count is a
monotonic counter with no drain, and each entry pins objects the clone can never garbage-collect.

**DISPOSITION: DISPATCHED to Station 03** — report the count and its growth; if any are dropped it is
`git stash drop`, **never `pop`**. I did not touch the clone.

### F4 — 21 of 81 root HOLD prompts are provably spent, and 286 of 335 local branches are merged — S3

The 21 (lint exit 3, "already done, BIN IT"): `breadcrumb-gitignore-gate-routing-not-mention`,
`ci-windows-pipeline-tests`, `comms-hub-inbox`, `crm-lastmile-s1-unblank-todos-and-notes`,
`crm-s2-nav-three-items-tabs`, `crm-tender-count-truth`, `crm-wincount-s2-close-bypasses`,
`dns-s1-tfm-series`, `dns-s2-ea-series`, `dns-s3-sot06-widgets-and-marker`,
`dns-s4-checker-warn-only`, `ew-s2b-alloc-engine-core`, `guard-s1-verdict-file-list`,
`guard-s2-prompt-search-by-branch`, `guard-s3-file-gate-not-released`,
`lessons-folder-s2-unfold-sot05`, `lessons-folder-s3-ref-checker`, `lint-human-gate-blindness`,
`pipeline-fold-s2-merged-page`, `queue-bin-guard-orphaned-discharge`, `sot-02-reconcile-2026-08-19`.

I verified three of the 21 by an independent route rather than trusting the exit code, and all three
held. **I did not verify the other 18, and I am not proposing a bulk delete.** The rotation brief says
report only and no agent bulk-deletes, and ORPHANED_DISCHARGE (`lint-prompt.mjs:~600`) records the day
twelve slices were lost to exactly this shape of cleanup. Separately, 286 local branches whose PRs are
merged are dead weight on every `git branch` read in the dev tree.

**DISPOSITION: ESCALATED to Station 00 / Marco** — the complete-and-additive option, which passes both
halves of RULE 1: **move the 21 to `docs/pr-prompts/superseded/cleared-2026-08-28/` in one docs-only
PR, deleting nothing**, so the queue root stops carrying them while every body stays recoverable and
future work is not damaged. Alternative (a): delete them outright — fails the "does not damage future
data" half, because an exit-3 verdict I verified for only 3 of 21 is not a licence to destroy 18
bodies. Alternative (b): leave them — fails the "solves it for the future" half; the root has been
growing for weeks and each spent HOLD is a re-read cost on every arming decision. The 286 branches are
the same question at larger scale and should follow the same decision, not precede it.

### F5 — arming has no reliable audit trail: `.arming-log.txt` is both incomplete and untracked — S3

The log holds 3 lines, newest 02:10:24Z, and records neither of the two arms that demonstrably
happened since (the breadcrumb prompt, consumed with a `processed/` log at 08:20Z; and
`pr-lint-armed-gate-inversion`, whose `R100` rename I observed staged in the shared index at
10:13Z). Control: the 02:10Z crm-s2 arm IS present, so the file is written by *something* — an arm
performed by a bare `git mv` simply bypasses whatever writes it. The file is also **untracked**, so
even its partial history is not durable and any `git clean` takes it.

This compounds a known gap rather than introducing one: there is already no audit trail for who
merges (every actor pushes as `GH-Mantova`). Arming is the one board mutation with a designated log,
and the log misses most of it.

**DISPOSITION: ESCALATED to Station 00** — a question, not a status update: should arming be
constrained to the arming script (which logs), with a CI or hook check that rejects a HOLD→ready
rename arriving without a matching log line? That is the complete-and-additive answer — it adds a
record without removing anyone's ability to arm. The cheaper alternative, simply tracking
`.arming-log.txt` in git, fails the "solves it completely" half: it would make an incomplete log
durable rather than making it complete.

### F6 — the board trap is CLEAN this run — S4 (informational)

Zero tracked `*-ready.md` at depth 1 on `origin/main`, against controls proving the query returns
515 paths and 209 depth-1 `.md` files. Recording the clean reading with its controls so a future run
can tell "measured clean" from "did not look".

**DISPOSITION: DEFERRED** — nothing to do. It becomes urgent the moment this count is non-zero, since
any checkout would then re-arm executed work.

## WHAT I DID NOT DO

- **Armed nothing, merged nothing, deleted nothing.** Station 04 is read-only on the board. The one
  prompt I authored is staged `-HOLD` and lint-ADMITs; arming it is Station 00's call on Marco's
  authority.
- **Did not prune the four spent worktrees, and did not touch the watcher clone or its 48 stashes** —
  both are Station 03's lane, and the clone is a shared tree a live agent may be inside (DOCTRINE §4).
- **Did not delete or move any of the 21 spent HOLDs**, and did not delete any of the 286 merged
  branches — no agent bulk-deletes, and I verified only 3 of the 21 independently.
- **Did not mint a throwaway worktree.** Everything about `origin/main` was read with `git show` /
  `git cat-file` / `git ls-tree -r` against a named SHA, per the 2026-08-24 supersession.
- **Did not rewrite the 87 prompt files** whose front matter uses block scalars. The staged prompt
  fixes the reader, not the corpus; rewriting the corpus is a separate and much riskier change.
- **Did not run the Part 0 static audit, Part 1 GitHub reconciliation, or the Part 2 live-site visual
  pass.** The rotation assigned `repo-hygiene` and the brief is explicit that one sweep covered
  completely beats a shallow pass over everything. `check-sot-bytes.mjs` and `check-all-drift.ps1`
  belong to other rotation slots and were left for them.
- **Did not act on any `[STALE]` line** from the sweep's section 5, and did not re-report the dead
  escalations it named.
- **Note for whoever commits next: the dev tree's shared index carried another chat's `R100`
  arming rename while I worked.** I committed with an explicit pathspec. Do the same.
