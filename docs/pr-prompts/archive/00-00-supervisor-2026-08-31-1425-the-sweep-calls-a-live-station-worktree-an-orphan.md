# Station 00 — Supervisor | 2026-08-31T14:22:36Z–2026-08-31T14:3xZ (SUPPLEMENT to the 1408 breadcrumb)

**Read `00-00-supervisor-2026-08-31-1408-doctrine-said-the-fix-was-pending-thirteen-hours-after-it-merged.md`
first — this is the same run.** It is a second file because the finding below was measured *after*
that breadcrumb had already merged as #1452, and because it **reverses that breadcrumb's stated final
action.** A correction that lives only in a chat log is not a correction.

## GROUND

```
UTC            2026-08-31T14:22:36Z
origin/main    ba1f705b   (#1452, merged 14:20:32Z this run)
dev tree       main @ ba1f705b   C:\ProjectOperations2   index clean, armed=0
doc version    1
bootstrap      1
```

## WHAT I MEASURED

- `[MEASURED]` `status-sweep.ps1` at **14:22:36Z** printed, in the same run:
  ```
  [LIVE] orphaned worktrees: 1 (aborted run leftovers -- investigate/prune):
  [LIVE]    C:/po-worktrees/sot-05-20260831 6e105076 (detached HEAD)
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity.
  ```
- `[MEASURED]` At that moment `git -C C:\po-worktrees\sot-05-20260831 status --porcelain` returned
  **six lines** — ` M docs/data-model/metadata-catalog.json`, ` M docs/pipeline/stations/05-sot-keeper.md`,
  ` M docs/qa/sot-refs-baseline.json`, ` M sot/04-data-model.md`, ` M sot/README.md`, and
  `?? docs/pr-prompts/00-05-sot-keeper-2026-08-31-1411-sot04-remerged-and-trap2-outlived-its-cause.md`.
- `[MEASURED]` Directory `LastWriteTimeUtc` = **2026-08-31T14:14:42Z**, i.e. ~8 minutes old, against
  a clock reading of 14:22Z. `.lint-probe-tmp/` in the dev tree was touched **14:20:04Z**.
- `[MEASURED]` `scripts/pipeline/status-sweep.ps1:116-121` — the classifier is
  `git worktree list | Where-Object { $_ -notmatch "\[main\]$" -and $_ -notmatch <repo> }` and every
  surviving line is printed under `aborted run leftovers -- investigate/prune`. **There is no
  liveness test in the source at all**, and §7's verdict never reads `$wt`.
- `[MEASURED]` `git ls-remote --heads origin` showed no `sot-*` branch pushed yet, so 05 had not
  reached its push when I measured — consistent with a run in progress, not a leftover.
- `[MEASURED]` The dev tree's ` M docs/data-model/metadata-catalog.json` is **not real drift**:
  `git diff --numstat` and `git diff -U0` on that path both return **empty** while `git status` shows
  `M`. It is the CRLF stat-dirty case git itself warns about (`LF will be replaced by CRLF`), the
  same family as DOCTRINE §9.3. No content changed; nothing to chase.
- `[MEASURED]` The 1408 breadcrumb's own change is live on main: `git grep -c foldBlockScalar
  origin/main -- docs/pipeline/DOCTRINE.md` → **2**, and the negative control
  `has NO block-scalar support` → **exit 1**, absent.

## WHAT CHANGED

1. **`docs/pr-prompts/pr-sweep-worktree-liveness-HOLD.md`** staged (this PR). `lint-prompt.mjs` →
   **`ADMIT (size 2)`, exit 0** at ba1f705b. Staged as HOLD, deliberately **not armed** — see F2.
2. **This breadcrumb.**
3. **Nothing was armed.** `pr-lint-not-a-prompt-HOLD.md` remains a HOLD; armed count 0 → 0.

## FINDINGS

### F1 — the sweep tells you to prune the worktree a station is working in, and then says SAFE TO ACT

`status-sweep.ps1` has no liveness test for worktrees. It labelled Station 05's live worktree an
"aborted run leftover" and invited a prune, eight minutes into 05's run, with four modified `sot/`
files and an unwritten breadcrumb inside it. `git worktree remove --force` on that path — the action
the line recommends — destroys all of it silently.

This is DOCTRINE §7 exactly: not a broken system, a broken *measurement* of a working one, handing
back a confident and coherent verdict. And it is the 2026-07-13 shape specifically — a check that
called a legitimately-working state BROKEN and thereby **licensed a destructive action**. The station
doc records that incident about `rescue-watcher-repo.ps1` and a live agent's branch; this is the same
sentence with a different script.

The second half is the one that bites this station: **§7 answered `SAFE TO ACT: no board mutation in
progress` while a station was mid-mutation**, because §7 never reads the worktree list. Station 00's
arming discipline is gated on that verdict, so the instrument that is supposed to prevent the LL-38
collision is blind to the commonest form of it.

**DISPOSITION: ACTIONED** — the cure is staged in this PR as `pr-sweep-worktree-liveness-HOLD.md`
(ADMIT, exit 0): classify each worktree LIVE vs orphaned by **dirtiness and mtime**, keep the prune
wording only for the clean-and-old case, and feed the LIVE count into §7 so it downgrades to CAUTION.
The prompt carries a positive control requiring the implementer to make the classifier print **both**
verdicts before trusting either, and forbids the `node.exe` process-table shortcut (§9.5: 21 node
processes were running, exactly one of them the watcher).

### F2 — the 1408 breadcrumb said this run would arm; it did not, and this is the retraction

`00-…-1408-….md` §WHAT CHANGED item 5 states that `pr-lint-not-a-prompt-HOLD.md` was armed as the
run's last action, with an explicit falsifier: *"if `armed` reads 0 … this step did not happen — re-arm
it."* **The falsifier fired. Armed is 0. The arm did not happen, and it was correct not to.**

Everything up to the decision stands and does not need redoing: the premise is alive
(`git grep -c NOT_A_PROMPT origin/main -- scripts/pipeline/lint-prompt.mjs` → 0, exit 1, positive
control `NO_FRONT_MATTER` → 1 hit), lint is ADMIT exit 0, the marker grep is 0 against a control of 1,
and the body carries no prose gate. **The only thing that changed is that a second actor turned out to
be mid-run.** DOCTRINE's dispatch-unavailable fallback, condition 3, is unambiguous: *"Single actor —
first confirm nothing else is mid-mutation … If something else is acting, STOP: that is the LL-38
collision."* I trusted the direct measurement of 05's dirty worktree over the sweep's SAFE TO ACT,
which F1 shows was wrong at that instant.

**DISPOSITION: DEFERRED** — arm `pr-lint-not-a-prompt-HOLD.md` at the next 00 run, once 05's PR has
landed and the worktree at `C:\po-worktrees\sot-05-20260831` is gone or clean. No re-derivation is
needed; the RULE 4 detector output is recorded in the 1408 breadcrumb and holds until
`scripts/pipeline/lint-prompt.mjs` changes on main. It becomes urgent immediately: the board's only
two open PRs are both routed to Marco, so with armed=0 there is nothing moving.

### F3 — a breadcrumb that names a future action can be wrong about it, and needs somewhere to be corrected

The 1408 breadcrumb was accurate when written and false forty minutes later, because it described an
action that had not happened yet. The falsifier saved it — a reader who checks `armed` learns the
truth — but a falsifier only works if someone runs it.

The generalisable rule, and the reason this supplement exists: **a report may describe the future only
if it names the probe that settles it, and the same run must come back and answer that probe.** The
one-breadcrumb-per-run contract is about not scattering findings, not about never issuing a
correction; a correction that lives only in a chat log reaches nobody, which is the exact failure the
report contract was written to stop.

**DISPOSITION: DEFERRED** — this is a candidate line for the station contract's report section, but
the contract is a hash-gated canonical block that is byte-identical across six station docs, and one
run's experience is not enough to justify editing all six. It becomes worth doing the second time a
station has to retract a stated future action. Recorded here so that second time has a first to cite.

## WHAT I DID NOT DO

- **Did not arm anything.** F2. Armed 0 → 0.
- **Did not touch, prune, or inspect-and-modify `C:\po-worktrees\sot-05-20260831`.** Read-only
  `git -C … status` and a directory mtime only. Station 05 owns it and is inside it.
- **Did not merge `#1443` or `#1450`** — both measured `"marco":true` (591-hit positive control,
  0-hit negative control, `#1451` as the unrouted control). RULE 2.
- **Did not fix `status-sweep.ps1` by hand.** It is a real code change with a classifier and a
  control to build; hand-landing it would produce no review, and the arming lane is alive. It is
  staged, not done.
- **Did not touch the dev tree's ` M metadata-catalog.json`.** Measured as a CRLF stat-dirty
  artefact with an empty content diff; it is not mine and it is not drift.
- **Did not leave a worktree behind** — `C:\po-worktrees\sweep-worktree-liveness` was removed with
  `git worktree remove --force` and `git worktree prune`.
