# Station 00 — Supervisor | 2026-09-14T07:44Z–07:50Z

Tail of the 07:08Z run. Its main breadcrumb is
`00-00-supervisor-2026-09-14-0709-the-one-red-was-a-require-cycle-latent-on-main-and-a-stale-dev-tree-called-a-spent-prompt-admit.md`,
which is now tracked on `main`. This file carries only what happened **after** that breadcrumb was
committed, so no claim in it is repeated here.

## GROUND

```
UTC            2026-09-14T07:44Z
origin/main    6a3fb6c4              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 6a3fb6c4       C:\ProjectOperations2   (0 ahead, 0 behind — fast-forwarded this run)
doc version    1
bootstrap      1
```

## WHAT I MEASURED

- [MEASURED] **The require-cycle fix is green.** `#1920` head `869807f0`: `API — lint, test,
  compliance smoke` **SUCCESS**, `tendering-e2e` **SUCCESS**. The only remaining failures are
  `Approval receipt (CP-26)` and `PR gates — diff checks`, which are the one-cause `do-not-merge`
  pair DOCTRINE §9.4 calls parked by design and only Marco clears. **This closes F1 of the 0709
  breadcrumb on CI's exit code rather than on my reading of the diff.**
- [MEASURED] `#1921` (the 0709 board PR) — `Assert-SmokedOrEscalate -PR 1921` passed, `Merge-Pr -PR 1921`
  returned True, and the read-back is `state=MERGED mergedAt=2026-09-14T07:44:34Z mergeCommit=6a3fb6c4`.
  `status-sweep.ps1` was re-run immediately before, after both disposable worktrees were torn down,
  and §7 read `[LIVE] SAFE TO ACT`.
- [MEASURED] All three open PRs now read **BEHIND** (`#1918`, `#1919`, `#1920`) — the
  `pollForBehindPrs` consequence of any board PR merging, already on file as an open escalation. Not
  re-raised; recorded so the next run does not read it as new.
- [MEASURED] the fast-forward, and **both documented blockers fired in sequence, exactly as the
  station doc predicts.** First the untracked case: five loose breadcrumbs at paths `main` now
  tracks. Each was proved byte-identical before deletion — `git rev-parse origin/main:<path>` against
  `git hash-object <path>`, never a piped hash — 5 of 5 MATCH. Then the tracked-modified case:
  `docs/pipeline/sweep-rotation.json` refused the FF even after being restored to HEAD, because the
  restore re-introduces the LF/CRLF smudge. `git add --renormalize` cleared it — **and staged a
  phantom rewrite of `.arming-log.txt` at the same time**, which is the trap the doc names; the cure
  is `git restore --staged <path>`, index-only, and it worked.
- [MEASURED] read-backs after the FF, all three: `git rev-list --left-right --count HEAD...origin/main`
  → **`0 0`**; `git diff --cached --name-status` → **EMPTY**; `git diff --numstat` → one line,
  `0 137 docs/pr-prompts/pr-ea-s2a-dashboard-preset-seed-HOLD.md`. `.arming-log.txt` is **115 rows**,
  the same count saved before the restore, with **0** rows present before and absent after.
  `*-ready.md` → **0**.

## WHAT CHANGED

- `#1921` merged; `main` is `6a3fb6c4`. Six breadcrumbs, `sweep-rotation.json` and the two arm rows
  are now on `main`; two spent prompts are in `superseded/`; five 2026-09-11 breadcrumbs are archived.
- The dev tree is level with `origin/main` for the first time this run. A backup of the pre-FF
  `.arming-log.txt` is at `C:\po-sup-fix-scripts\arming-log.backup-0709.txt`.
- Both disposable worktrees (`C:\po-wt\ea2a-fix`, `C:\po-wt\board-0709`) removed, `git worktree prune`
  run; `git worktree list` is back to the dev tree plus the three pre-existing stale ones.
- **Nothing else.** No arm, no label, no merge other than `#1921`, no `/sot/`, no Azure.

## FINDINGS

### F1 — S4. The `0 137` left in `git diff --numstat` is deliberate, and restoring it would re-arm a duplicate

The one non-empty line in the post-FF read-back is the locally-deleted
`pr-ea-s2a-dashboard-preset-seed-HOLD.md`. That deletion is the arm's `git mv` leftover and predates
this run. `#1920`'s diff does not retire the prompt, so the file is still tracked on `main` — the
0709 breadcrumb's F3.

**Leaving the deletion in place is the safer state, not an untidy one:** while the file is absent
from disk nothing can arm it, and `lint-prompt.mjs` will read it ADMIT the moment it returns. A run
that "cleans up" the dev tree by restoring it puts an armable duplicate of an open PR back in the
queue.

DISPOSITION: **DEFERRED**, unchanged from F3 of the 0709 breadcrumb and with the same instruction:
retire it to `superseded/` — on `#1920`'s branch before it merges, or in a board PR immediately
after. What would make it urgent: anyone restoring that path, or `#1920` merging.

### F2 — S4. Both FF blockers fired in one run, in the order the station doc lists them, and the second one's cure staged a phantom rewrite

Recorded as a confirmation rather than a new defect: the untracked-breadcrumb blocker, the
`sweep-rotation.json` smudge blocker, and the `--renormalize`-stages-`.arming-log.txt` false alarm
all reproduced on this fast-forward, and the documented cures worked in the documented order with no
improvisation. **The falsifying probes stand.**

The one thing worth adding for the next reader: the byte-identity proof before deleting an untracked
breadcrumb is cheap and it is what makes the deletion safe. Five `rev-parse` / `hash-object` pairs
took seconds and turned an irreversible delete into a verified one.

DISPOSITION: **ACTIONED** — the fast-forward completed and all three read-backs pass.

## WHAT I DID NOT DO

- **Did not merge `#1918`, `#1919` or `#1920`.** All three are Marco's on the evidence in the 0709
  breadcrumb, and `#1920`'s remaining reds are the label pair only he clears.
- **Did not remove any label, did not author a receipt, did not arm anything.** `armed` is 0.
- **Did not restore `pr-ea-s2a-dashboard-preset-seed-HOLD.md`** — see F1.
- **Did not update the three BEHIND branches.** `pollForBehindPrs` owns that and re-running it by
  hand is the churn the open escalation is about.
- **This file is UNTRACKED** and reaches nobody until a board PR commits it. It is deliberately left
  for the next run's collect rather than spending a second CI cycle and another round of
  branch-rebasing on a five-minute tail.
