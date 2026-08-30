---
premise: '! grep -q "listTrackedVerdicts" scripts/pr-watcher/index.mjs'
premise_means: >-
  The verdict-archive sweep still moves TRACKED docs/pr-reviews/pr-N-review.md files out of the
  watcher clone. Git reports them as worktree deletions forever, every watcher start therefore hits
  the pre-flight autostash path, and the stash pile in C:\po-watcher\ProjectOperations now stands at
  54 entries, 19 of them watcher-preflight-autostash. Station 03 root-caused this on 2026-08-25
  (F1/F2) and dispatched it; no fix has landed in the five days since.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/verdict-archival.spec.mjs
done_when: >-
  grep -q "listTrackedVerdicts" scripts/pr-watcher/index.mjs && node --test
  scripts/pr-watcher/__tests__/verdict-archival.spec.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# The verdict-archive sweep must not move tracked files

## The defect

`archiveSettledVerdicts()` (`scripts/pr-watcher/index.mjs:661`) moves every
`docs/pr-reviews/pr-N-review.md` whose PR is MERGED or CLOSED out of the watcher clone and into the
sibling `verdicts-archive` directory. It does not ask whether the file is tracked by git. 35 of them
are.

Moving a tracked file out of a worktree leaves an unstaged deletion. So the clone is permanently
dirty, and `start-watcher.ps1:73` — which runs `git stash push --include-untracked` whenever the
tracked tree is dirty at startup — stashes those 35 deletions, **which restores the 35 files**. The
startup sweep then moves them out again. That is the loop:

```
sweep moves 35 tracked files  ->  tree shows 35 ` D` deletions
      ^                                        |
      |                                        v
startup sweep runs again      <-  pre-flight autostash RESTORES them
```

Measured in `C:\po-watcher\watcher-launch.log` on 2026-08-30 — `archived=35` appears only on the
three lines that follow a launch (20:55:33Z, 20:58:55Z, 21:25:31Z), while the 5-minutely rescan
sweeps in steady state report `archived=0 kept=1`. One cycle per watcher start, not per rescan.

Measured cost, `C:\po-watcher\ProjectOperations`: **54 stash entries, 19 of them
`watcher-preflight-autostash`**; 35 tracked deletions present in the tree again within two minutes
of the 21:25:31Z sweep; 408 files in `verdicts-archive`, 35 of them re-stamped 21:25:04Z by a move
over a copy that was already there.

## The sweep was never meant to touch them

This is not a judgement call about what belongs in the repo. The code states its own intent twice,
and both statements exclude tracked files:

- `index.mjs:602` — "the verdict file in `docs/pr-reviews/` is local-only."
- `index.mjs:2693-2694`, on the rescan call site — "so a long-running watcher doesn't accumulate
  **untracked** `pr-*-review.md` files in the clone tree."

The archive directory was likewise chosen as "a sibling of REPO_ROOT so git never sees it — no
gitignore needed, **no status noise**". The design set out to keep git out of this entirely. Sweeping
35 tracked files is the one thing that puts git back in, and it produces exactly the status noise the
comment says it avoided.

## The second hazard, which is the dangerous one

Station 03 recorded this on 2026-08-25 as F2 and it is still live: `start-watcher.ps1:73` stashes
with `--include-untracked`. The trigger is *tracked* dirt; the *effect* includes every untracked
file. So a live verdict for an OPEN PR — untracked, not archived, correctly `kept` by the sweep — is
swept into a stash entry it has no reason to be in, on a restart nobody thinks of as destructive.

The tracked deletions are what make the tree dirty at every single startup. Fixing the tracked half
removes the trigger, so this closes with it. That is why this prompt is worth more than tidiness.

## Do

1. Add an injected dependency `listTrackedVerdicts` to `archiveSettledVerdicts({...})`: an async
   function returning the basenames under `reviewsDir` that git tracks. Call it **once** per sweep,
   before the loop, and hold the result in a `Set`.

2. In the loop, for a file in that set: skip it entirely — **before** the `fetchPrState` call, so a
   tracked file costs no `gh pr view`. Count it in a new `tracked` stat. Do not move it, do not copy
   it, do not delete it, do not log per-file.

3. Report the new counter in the summary line alongside `archived / kept / skipped`.

4. In `runArchiveSettledVerdicts()` (`index.mjs:718`), wire the real implementation:
   `git -C REPO_ROOT ls-files docs/pr-reviews` (one process per sweep, no network, no gh quota).
   If that call fails, treat **every** file as tracked for that sweep — skip them all and log once.
   Failing closed leaves verdicts where they are, which is the direction this function already
   chooses everywhere else ("we would rather leak a verdict than silently delete one").

5. Make `listTrackedVerdicts` **required**: throw if it is absent. Update the seven existing tests in
   `verdict-archival.spec.mjs` to pass `async () => []`. Accept that test churn.

## Why required, and not a default

A default of "nothing is tracked" is the present bug spelled as a default: any future caller that
forgets the argument silently restores the loop, and it would take another five days and another
station to notice. The existing seven tests are explicit about their world already — they build a
sandbox and inject `fetchPrState` — so injecting one more dependency is in keeping with the file's
own contract, which is written as "pure over injected deps so the whole thing is unit-testable
without spawning gh or writing into REPO_ROOT".

## Where this deviates from Station 03, and why

Station 03's F1 (`00-03-machine-minder-2026-08-25-2301-clone-dirtied-by-verdict-archive.md`) offered
two RULE-1 options: `git rm` + commit, or copy-and-leave. This prompt does neither, and the reason is
evidence 03 did not have in front of it.

- **`git rm` + commit** cannot work from the clone. `main` takes no direct pushes, so the commit
  would be local-only, and a clone carrying local commits is the "16 behind / 2 ahead, `merge
  --ff-only` cannot succeed" pathology already reported on 2026-08-26 and 2026-08-28. It trades a
  dirty tree for a diverged one.
- **Copy-and-leave** keeps the tree clean but re-copies 35 files over identical archived copies on
  every sweep forever, and still spends 35 `gh pr view` calls per start on files it will never move.

Skipping tracked files is what the two intent comments quoted above already say the sweep does. It is
additive: nothing is moved, deleted, gitignored or committed that is not moved today.

## The 35 already-moved files need no action

Do not restore them by hand. `00-00-supervisor-2026-08-28-1009` records the standing instruction —
"Never `git checkout` the 35 unstaged ` D` paths under `docs/pr-reviews/`" — and with this fix the
instruction stops mattering: the next restart's pre-flight autostash restores the 35 files as it
always has, the sweep then leaves them alone, and the tree is clean from that point on. The loop
unwinds itself on the first start after the merge. Verify that it did; do not force it.

## Do NOT

- Do **not** gitignore `docs/pr-reviews/**`. Station 03 examined and refused it: it would hide
  genuine review work from the repo and strand the already-tracked files.
- Do **not** `git rm`, commit, push, or otherwise change what is tracked. This PR changes behaviour,
  not repo contents.
- Do **not** touch `start-watcher.ps1` or its `--include-untracked`. The stash is a reasonable
  last-resort safety net; the defect is that a broken sweep triggers it every single start. Removing
  the trigger is this prompt. Whether the net itself should narrow is a separate question and a
  separate prompt.
- Do **not** touch `verdict-guard.mjs`. Different subsystem, unrelated defect.
- Do **not** drop or pop any stash entry. The 19 accumulated `watcher-preflight-autostash` entries
  are Station 03's lane and its doctrine is drop, never pop. Say in the PR body that they remain.

## Verification

Extend `scripts/pr-watcher/__tests__/verdict-archival.spec.mjs`:

- **skips a tracked verdict** — a MERGED PR whose file is in the tracked set: file still present in
  `reviewsDir`, absent from `archiveDir`, `tracked: 1`, `archived: 0`, and `fetchPrState` **never
  called** for it (assert on a call counter — this is the gh-quota half of the fix).
- **still archives an untracked verdict** — MERGED, not in the tracked set: moved, `archived: 1`.
- **mixed sweep** — one tracked and one untracked MERGED verdict: exactly one moves.
- **tracked lookup throws** — every file is skipped, nothing moves, one log line, no throw into the
  caller.
- **missing dependency** — calling without `listTrackedVerdicts` throws.
- the seven existing tests, updated to inject `async () => []`, still pass unchanged in meaning.

Then confirm the real behaviour end to end: restart the watcher once after merge and check that
`git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no` is **empty**, that
the startup sweep line reads `archived=0 ... tracked=35`, and that a second restart adds **no** new
`watcher-preflight-autostash` entry to `git stash list`.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
