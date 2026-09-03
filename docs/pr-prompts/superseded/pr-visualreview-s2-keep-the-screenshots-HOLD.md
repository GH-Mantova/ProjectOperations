---
premise: '! grep -q -- "--out" scripts/pipeline/visual-smoke.mjs'
premise_means: >-
  visual-smoke.mjs resolves its output directory from its own location, so inside the smoke
  worktree it writes the PNGs to <worktree>/docs/pr-reviews/pr-N-smoke/. Teardown removes the
  worktree and the pictures go with it. Measured 2026-09-03 - git ls-tree origin/main --
  docs/pr-reviews returns ZERO *-smoke directories, and the path is not gitignored, so nothing
  has ever kept one. The vision review judges evidence that is destroyed minutes later.
scope:
  - scripts/pipeline/visual-smoke.mjs
  - docs/pipeline/stations/00-supervisor.md
done_when: >-
  grep -q -- "--out" scripts/pipeline/visual-smoke.mjs && grep -q "MAX_PNG_BYTES" scripts/pipeline/visual-smoke.mjs && node scripts/pipeline/lint-station.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: visual-review
cluster_order: 2
requires_on_main: docs/pipeline/stations/00-supervisor.md :: VISION REVIEW
---

# VS-S2: the screenshots must survive the worktree that made them

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

VS-S1 gave Station 00 back the vision review. This slice makes the thing it reviews durable, and
makes it reach the PR instead of dying in a temporary directory.

## Do

1. **`visual-smoke.mjs` - add an optional `--out <dir>` argument.**
   - Default **exactly** today's behaviour: `<REPO_ROOT>/docs/pr-reviews/pr-{n}-smoke`. Every
     existing caller must keep working with no change.
   - When `--out` is given, resolve it and `mkdirSync(..., { recursive: true })` as today.
   - Print the resolved output directory on the summary line so a run log says where the PNGs went.
2. **Add a size guard.** Declare `const MAX_PNG_BYTES = 2_000_000;`. After each capture, stat the
   file; if it exceeds the cap, delete it, log
   `OVERSIZE <name>: <bytes> > MAX_PNG_BYTES, not kept` and count it as a failure (the existing
   exit code 3 path). A full-page screenshot of an unbounded list can be enormous, and this repo
   should not acquire a 40 MB PNG because one screen rendered a thousand rows.
3. **In `00-supervisor.md`, in the VISION REVIEW section VS-S1 added, state how the PNGs are kept.**
   Capture into the smoke worktree as now, then **before teardown** commit them onto the PR's own
   branch:
   - `git -C <worktree> add -f docs/pr-reviews/pr-{n}-smoke/` (they are not gitignored, but `-f`
     is harmless and survives a future ignore rule);
   - commit with a fixed subject `chore(smoke): visual acceptance screens for #{n}`;
   - push to the PR branch.
   - **If the push fails, that is a smoke NOTE, not a smoke FAIL.** Say so explicitly. Losing the
     pictures must never turn a green PR red - the review already happened, and the agent's
     PASS/FAIL rows are in the comment either way.
4. **State the trade-off in the doc, in one sentence**, so the next reader does not have to
   rediscover it: the PNGs are committed because evidence a reviewer cannot re-open is not
   evidence, and the cost is repo size - which is why only the screens the PR **declares** are
   captured, and why the size cap exists.

## Do NOT

- Do NOT change the default output path, the login flow, the 1440x900 viewport, the deterministic
  `{name}.png` naming, or the exit codes 0/1/2/3. Anything that reads those is entitled to keep
  working.
- Do NOT make `visual-smoke.mjs` itself run `git`. It is a capture tool; the committing belongs to
  the smoke procedure that already has a worktree and a branch.
- Do NOT touch the `CANONICAL-BLOCK: station-contract` region of `00-supervisor.md`.
- Do NOT add a before/after comparison. That needs a main-branch capture run and is deliberately a
  later slice.
- Do NOT touch `sot/`.

## Verify

- `node scripts/pipeline/visual-smoke.mjs --help` lists `--out`.
- With no `--out`, a capture still lands in `docs/pr-reviews/pr-{n}-smoke/` - byte-identical
  behaviour to before. **Run this control first**; a regression here breaks every existing caller.
- With `--out <tmp>`, the PNGs land in `<tmp>` and the summary line names it.
- Oversize control: capture a screen with `MAX_PNG_BYTES` temporarily set to `1000`; the file is
  deleted, `OVERSIZE` is logged, and the exit code is 3. Restore the constant afterwards.
- `node scripts/pipeline/lint-station.mjs` exits 0.
- `git diff` shows no change inside the `CANONICAL-BLOCK: station-contract` markers.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
