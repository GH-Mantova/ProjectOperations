# Station 04 — Scanner | 2026-09-06T02:10:22Z–2026-09-06T02:20Z

Sweep taken this run: **repo-hygiene** (`node scripts/pipeline/next-sweep.mjs` → `SWEEP: repo-hygiene`,
rotation position 3 of 4, previous run 2026-09-05T22:10:14Z). Covered completely: orphaned worktrees
and locks, stash growth in the clone, queue-root litter, tracked `*-ready.md` at depth 1, branches
that outlive their PRs, and HOLDs whose work has shipped.

## GROUND

```
UTC            2026-09-06T02:10:22Z
origin/main    90a32d95            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 90a32d95      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Version and bootstrap **AGREE** — this run was not restricted to read-only on that account.

Sighted: `start_process` shell `powershell.exe` → PID 14020. Desktop Commander loaded via keyword
`ToolSearch` first, per the PREFLIGHT.

All three binding documents were read **in full** this run, from the dev tree, after proving the dev
tree is not stale against `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY output** [MEASURED]. Empty numstat is the sound form (§9.1 forbids the piped-hash
comparison), so the working copies are byte-equal to `origin/main` and reading them is equivalent to
`git show origin/main:<path>`.

`scripts/pipeline/status-sweep.ps1` run at 02:11:04Z, captured to a file so its §7 verdict could not
be lost to an early return: **§7 SAFE TO ACT** — no board mutation in progress, no remote activity in
the last 2 min, no live station worktrees. Section 0 instrument controls both PASS.

## WHAT I MEASURED

- [MEASURED] **Board, 02:11:04Z.** 5 open PRs — #1685 (RED 12/1/1), #1682 (RED 13/1/0), #1680
  (green), #1675 (green), #1667 (green). `main` CI on `90a32d95`: 4 success / 0 failed. Watcher node
  RUNNING pid 20000, auto-restart wrapper alive, heartbeat 4 min. Armed `*-ready.md`: **0**.
- [MEASURED] **RULE 2 on #1685 — it is MARCO'S.**
  `Select-String -Path C:\ProjectOperations2\docs\pr-prompts\processed\pr-*.log -Pattern 'PR #1685\b'`
  → 2 hits, one of them
  `[watcher] merge result for PR #1685: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/prisma/seed-initial-services.ts"}`.
  Probed in the LIVE tree, never the clone (§9.5). POSITIVE control `marco.:true` over the same
  directory → **615**. NEGATIVE control, a needle minted this run, `zzQq04Needle20260906T0230` → **0**
  (that needle is now spent — §9.6).
- [MEASURED] **Worktrees.** Dev tree: `C:/ProjectOperations2 90a32d95 [main]` and
  `C:/po-vg 23c91ba9 [fix/no-rebase-while-checks-run]`. Clone: `main` only. **No `index.lock` in
  either `.git`.** `C:\po-vg` is the already-escalated orphan
  (`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`); its branch is
  still **absent from `git ls-remote --heads origin`**, i.e. still unpushed, now age 2538 min. Not
  re-raised — see WHAT I DID NOT DO.
- [MEASURED] **Stashes.** Watcher clone **66**; dev tree **0** (raw `git stash list` empty at rc=0,
  positive control being the clone's 66 through the identical expression). Clone newest
  `2026-09-03 18:55:05 +1000` (`watcher-preflight-autostash`), oldest `2026-07-14 08:44:31 +1000`.
  Growth has been **flat for ~3 days**, consistent with no watcher restart in that window.
- [MEASURED] **The board trap: 0 tracked `*-ready.md` at depth 1.**
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → 826 paths (trailing slash + `-r`,
  §9.2); depth-1 subset **90**; `*-ready.md` → **0**; `*-HOLD.md` → **82**. The 82 is the positive
  control that the filter form works, so the 0 is a real zero and not a broken query.
- [MEASURED] **Queue root is not littered.** 92 depth-1 files on disk: 81 `-HOLD.md`, 0 `-ready.md`,
  2 breadcrumbs, 9 registers/state (`.arming-log.txt`, `.queue-sync-ledger.txt`, `BACKLOG.yaml`,
  `BACKLOG-DECISIONS.md`, `ESCALATIONS.yaml`, `PROMPT-SCHEMA.md`, `queue-watch-state.md`,
  `shepherd-state.md`, `TEMPLATE-sot-reconcile.md`). Two of those nine — `queue-watch-state.md`
  (2026-08-31) and `.queue-sync-ledger.txt` (2026-08-19) — are **untracked**, so a clone cannot see
  them; noted, not filed.
- [MEASURED] **§9.5's arming-log falsifying probe, re-run.** `origin/main` **55** lines vs working
  copy **56** (counted with `@(...).Count`, never `Measure-Object -Line`). The one-line gap is this
  hour's own arm — `2026-09-06T01:52:59Z ARMED pr-tipid-s1-waste-rows-can-carry-a-map-location-id
  escalates=false actor=marco-delegated`. So the log is current to within one row; the standing
  defect (**nothing commits it on purpose**) is untouched but is not, right now, hiding a day of arms.
- [MEASURED] **`triage-holds.ps1`**, read-only, with its own two controls PASSing (git read of
  DOCTRINE 93204 chars; SPENT fixture reached exit 3): of 81 HOLDs at depth 1 —
  **spent=3, gates-satisfied=38, still-gated=40, unreadable=0.**
- [MEASURED] **A live instance of the §9.4 counting trap, in my own hands.** A `gh pr view` call
  that failed with `unknown flag: --limit` still produced `labels: 1` and `files: 1` from
  `@($pr.labels).Count` on a null — a failed call wearing an answer's clothes. Re-run correctly:
  #1685 created `2026-09-06T02:00:55Z`, head `feat/tip-id-s1-waste-facility-id`, **0 labels**,
  3 files. Recorded because it is §9.4 reproducing exactly as written, not as a new finding.
- [MEASURED] **A near-miss of my own, recorded so the next run does not repeat it.** I first measured
  branch content with `git diff --numstat origin/main...<branch>` (three dots). That reports only the
  **branch side** of the merge base and says nothing about what `main` has since done, and I nearly
  read it as "these files are missing from main". The sound forms used below are
  `git rev-parse origin/main:<path>` against `git rev-parse <branch>:<path>` per file, plus
  `git merge-base --is-ancestor` (positive control: `origin/main` is its own ancestor, rc=0).

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced with
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-06T02:17:55Z` (exit 0,
  `last_index=2 last_run_utc=2026-09-06T02:17:55Z`). **LEFT DIRTY in the dev tree on purpose** —
  Station 04 may not commit to the shared tree. `git status --porcelain` reads
  ` M docs/pipeline/sweep-rotation.json`. **Station 00: commit this with the next board PR, or the
  rotation stops turning.**
- This breadcrumb, written to the tracked path `docs/pr-prompts/`. **Untracked until a board PR
  commits it.**
- Three **local remote-tracking refs**, `refs/remotes/probe/{crm360,cpnt,fix1483}`, created with
  `git fetch origin refs/heads/<b>:refs/remotes/probe/<x>` to read the three branches in F2 without
  minting a worktree, then **deleted** with `git update-ref -d`. Read back:
  `git branch -r | Select-String 'probe/'` → **0**. Recorded because DOCTRINE §9.2 names exactly
  this kind of hand-made ref as the reason a pruned `git branch -r` is still not authoritative — I
  am not leaving five more behind.
- Nothing else. No arm, no rename, no move, no prompt deleted, no merge, no label, no push, no
  commit, and no PR (04 has *Create a PR: NO* in the authority matrix).

## FINDINGS

### F1 — `status-sweep.ps1` §5 treats CLOSED exactly like MERGED, and tells the reader to clear the two escalations whose whole subject is a closed-unmerged PR. **S2.**

[MEASURED] This run's sweep, §5, verbatim:

```
[STALE] pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md references #1612 which is CLOSED -- escalation is DEAD, clear it. Do NOT report it as pending.
[STALE] remote-branches-outlive-their-prs-2026-09-05.md references #1612 which is CLOSED -- escalation is DEAD, clear it. Do NOT report it as pending.
```

For a MERGED reference that verdict is right: the work landed, the escalation is spent. For a
**CLOSED-unmerged** reference it is exactly backwards — "#1612 is closed and its branch holds the
only copy" is the escalation's **premise**, and the sweep reads the premise coming true as proof the
escalation is over. The file is named for the condition the tool then calls dead.

The premise is still live [MEASURED]: `feat/crm-account360-v2-s1` is present in
`git ls-remote --heads origin` (9 heads total); `git merge-base --is-ancestor` → **False**, i.e. not
on `main`; 2 commits and 2 branch-side files (`apps/web/src/pages/crm/AccountDetailPage.tsx`,
`__tests__/crmui-account360-s1.test.ts`), both of which **DIFFER** from `origin/main` by blob hash.
#1612 is `CLOSED`, `mergedAt` empty.

Blast radius: §5 is the section the sweep's own header calls "the step that was being skipped", and
its instruction is imperative ("clear it"). A station obeying it deletes the only record pointing at
unmerged work. Two files are affected today; any future `pr-<N>-closed-...` escalation inherits it.

**DISPATCHED → Station 00.** One-line shape of the fix, for whoever writes the prompt: §5 already has
the state string in hand (it prints `CLOSED` vs `MERGED`), so it needs a third verdict rather than a
second — MERGED ⇒ `[STALE] … clear it`; **CLOSED-unmerged ⇒ `[LIVE]` and say the branch is the thing
to check**; OPEN ⇒ unchanged. RULE 1: that is the complete-and-additive option — it adds a verdict
and removes none, and it cannot damage an existing escalation file because the tool only ever
reported, never wrote. The alternative — teaching each escalation to name its own liveness probe —
fails the *immediate* half: it fixes nothing already on disk.

### F2 — three remote heads have no open PR, none is on `main`, and the one staged remedy is explicitly local-only, so nothing in the pipeline will ever retire them. **S3.**

[MEASURED] `git ls-remote --heads origin` (asked the remote, §9.2) → **9** heads. Five are the heads
of the five open PRs, plus `main`. The remaining three:

| branch | PR | state | commits not on main | branch-side files | ancestor of main |
|---|---|---|---|---|---|
| `feat/crm-account360-v2-s1` | #1612 | CLOSED, unmerged | 2 | 2 | False |
| `fix/classify-policy-nested-tests` | #1571 | CLOSED, unmerged | 1 | 2 | False |
| `fix1483` | **none — no PR has ever existed for it** | — | 28 | 8 | False |

Two of the three are **superseded, not stranded**, and that is measured rather than assumed:

- `fix/classify-policy-nested-tests` carries the three-form `NESTED_TEST_PATHS` widening. That work
  **is on `origin/main`**: the array reads `/^(tests|docs)\//`, `/(^|\/)__tests__\//`,
  `/\.(test|spec)\.[cm]?[jt]sx?$/`, and `scripts/pr-watcher/__tests__/classify-policy-files.test.mjs`
  resolves at `origin/main` (rc=0). It reached `main` by another route after #1571 was closed.
- `fix1483` is the rescue push described in `pr-hygiene-s1-guarded-branch-prune-HOLD.md`'s own
  `premise_means` ("fix1483 carried 28 commits that existed nowhere else and read `[gone]` until it
  was pushed that morning"). Of its 8 branch-side files, 4 are **byte-identical** to `origin/main`
  (including `docs/decisions/merge-approvals/1483.md`) and 4 differ — and for all four,
  `origin/main`'s version is **newer**, from merged #1646 (2026-09-05T08:50:15Z) and #1651
  (2026-09-05T09:23:40Z), against the branch's last touch of 2026-09-02T12:24:46+10:00. The rescue
  copy has served its purpose.

The gap is that **nothing retires any of them**. `pr-hygiene-s1-guarded-branch-prune-HOLD.md` is the
only queued hygiene work, it is in this run's ADMIT bucket, and it says in terms: *"Prunes **local**
branches only … It NEVER touches a remote ref — GitHub already deletes on merge"* and *"Do NOT delete
remote branches, ever."* That reasoning is sound **for merged PRs** and silent for these three, none
of which was merged. So the remote accumulates a head per closed-unmerged PR, forever, and the
existing escalation `remote-branches-outlive-their-prs-2026-09-05.md` is the one F1 tells its reader
to delete.

Not actionable by me on two counts: branch deletion is irreversible (DOCTRINE §5.4), and 04 is
read-only on the board. **DISPATCHED → Station 00**, with the note that the decision is *whether the
prune gains a remote arm at all*, which is Marco's — RULE 1's complete-and-additive reading is a
**dry-run-by-default report** of remote heads with no open PR and a named superseding commit, which
adds visibility and destroys nothing; deleting remote refs unattended fails the *without damaging*
half outright and should not be proposed.

### F3 — a live instance of THE BOARD TRAP: this hour's consumed prompt is deleted on disk, still tracked on `origin/main`, and the deletion is uncommitted. **S3.**

[MEASURED] `git status --porcelain` →
` D docs/pr-prompts/pr-tipid-s1-waste-rows-can-carry-a-map-location-id-HOLD.md`. The arming log
records `2026-09-06T01:52:59Z ARMED pr-tipid-s1-waste-rows-can-carry-a-map-location-id`; the watcher
opened **#1685** at `02:00:55Z` and routed it to Marco. `git ls-tree` still lists that HOLD among the
82 tracked at depth 1, while only 81 exist on disk — the whole of the 82-vs-81 discrepancy.

While that deletion is uncommitted, any `git checkout .` / `reset --hard` / `stash pop` / `git clean`
in the dev tree restores the HOLD, and it is then a lint-clean prompt describing work that is already
an open PR (§10.6's cousin, reached from the arming side). This is not a defect in anything — it is
the normal post-consumption state — but it is the state DOCTRINE §9.2 warns is one careless command
from re-arming executed work, and it stays that way until a board PR commits it.

**DISPATCHED → Station 00:** commit this deletion with the next board PR, alongside
`docs/pipeline/sweep-rotation.json` and this breadcrumb.

### F4 — three HOLDs are SPENT (lint exit 3) and still tracked at depth 1. **S3.**

[MEASURED] `triage-holds.ps1`, SPENT bucket, with the SPENT verdict proved reachable by its own
fixture control:

- `pr-cardui-s6-other-operational-costs-HOLD.md`
- `pr-plantdays-retire-and-drop-HOLD.md`
- `pr-scopecosts-s1-operational-cost-lines-api-HOLD.md`

All three are the §10.6 second-lane duplicates: the work reached `main` through a lane that does not
consume prompts (#1662, #1665, #1681 are all merged), so the premises died on merge and the linter
now says so. They are the three prompts standing rules have been telling every run **not to arm** —
that instruction can retire with them, and while they sit at depth 1 they will keep surfacing to
whatever reads the queue.

**DISPATCHED → Station 00:** retire to `docs/pr-prompts/superseded/` in a board PR. Not mine — 04
does not move, rename or delete a prompt.

### F5 — the watcher clone holds 66 stashes and nothing pops them; growth is flat. **S4.**

[MEASURED] clone 66 (oldest 2026-07-14, newest 2026-09-03T18:55:05+10:00, the newest 3 all
`watcher-preflight-autostash`), dev tree 0. This is DOCTRINE §9.2's closed loop behaving exactly as
documented: the launcher's preflight stashes on every start and nothing ever pops. The number is
worth recording because it is the only measure of restart churn there is — and its flatness for three
days is itself a reading: **the watcher has not been restarted since 2026-09-03**, consistent with
pid 20000 being long-lived. `git stash drop` is irreversible, so nothing here is for an agent.

**DEFERRED.** What would make it urgent: the count climbing again (a restart loop), or the clone's
`dirty=4` growing into something a preflight stash would swallow.

## WHAT I DID NOT DO

- **Did not re-raise `C:\po-vg`.** It is already escalated
  (`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`), the sweep still
  reports it [LIVE], and I confirmed the branch is still absent from the remote — but a second
  filing of a live escalation is noise, not coverage.
- **Did not touch the 30 untracked files in `docs/pr-reviews/`.** That is the three-homes verdict
  defect already landed on `main` in #1683 and dispositioned there; re-deriving it would be the
  fifth run to do so.
- **Did not delete, prune or drop anything** — no branch, no stash, no worktree, no prompt. The
  repo-hygiene sweep is REPORT ONLY by its own definition, and every deletion named above is
  irreversible.
- **Did not arm.** Armed count was 0 at 02:11:04Z and is 0 now; the 38-prompt ADMIT bucket is a list
  of candidates, not instructions, and arming is Station 00's on Marco's authority.
- **Did not commit anything to the dev tree**, including the sweep-rotation advance, which is left
  dirty by the station contract's explicit instruction.
- **Did not run Part 0 / Part 1 / Part 2** of the older station brief this run. The contract above it
  says take ONE named sweep and cover it completely; `next-sweep.mjs` named repo-hygiene, and a
  shallow pass over everything is the failure that rotation exists to prevent.
- **Did not read the 944-line `ScopeQuantitiesTable.tsx` diff** on `fix1483`. F2's supersession claim
  rests on commit dates and per-file blob hashes, which is enough to say "main is newer", and I have
  said no more than that.
