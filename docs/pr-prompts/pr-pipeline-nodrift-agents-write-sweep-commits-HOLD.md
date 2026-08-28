---
premise: '! grep -q "NO-DRIFT" docs/pipeline/stations/00-supervisor.md'
premise_means: >-
  Station agents commit breadcrumbs directly to main in C:\ProjectOperations2, a tree that cannot push
  to main (the ruleset requires a PR). Every such commit drifts local main ahead of origin/main
  permanently, and every route back is on Marco's forbidden list. 04-scanner.md actively tells agents
  "no git push creds in the sandbox either", which makes the drift structural rather than accidental.
scope:
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/02-board-driver.md
  - docs/pipeline/stations/04-scanner.md
  - docs/pipeline/stations/05-sot-keeper.md
  - docs/pipeline/stations/06-pr-master.md
  - scripts/pipeline/hooks/**
  - .githooks/**
  - scripts/pipeline/sweep-breadcrumbs.ps1
  - scripts/pipeline/__tests__/**
done_when: >-
  pnpm lint && node scripts/pipeline/lint-station.mjs && grep -q "NO-DRIFT" docs/pipeline/stations/00-supervisor.md
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-nodrift
cluster_order: 1
requires_merged: 1351
---

# NO-DRIFT — agents write, one job commits

## The measured defect

`C:\ProjectOperations2` cannot push to `main`: the ruleset requires a pull request and forbids merge
commits. Agents are nevertheless instructed they may commit — `04-scanner.md:181` says outright
"no git push creds in the sandbox either". So stations commit locally and nothing ever pushes.

Measured 2026-08-27T22:00Z, local `main` carried five commits absent from `origin/main`:

    5560fc24  docs(pipeline): station 04 addendum F6
    a1b9c651  docs(pipeline): station 04 repo-hygiene sweep + rotation advance
    cb9fce55  chore(queue): arm pr-lessons-folder-s3-ref-checker
    6283e12b  Merge branch 'main' (unpushable — ruleset forbids merge commits on main)
    1b83d45d  docs(crm): build-order plan (already on main as squash 22b2f529)

Four of the five held content that had already reached `main` by other routes. The drift bought
nothing and cost a reconciliation that needed `git reset` plus a path-scoped `git checkout` — both
adjacent to the forbidden list. Within twenty minutes of that cleanup a Station 04 run recreated the
drift with `5822eb4a`. It regenerates daily.

PR #1357 already demonstrated the correct shape: 29 untracked breadcrumbs batched into one PR.

## Do

**1. State the rule in `00-supervisor.md`.** Add a section carrying the literal `NO-DRIFT`:

- Agents MUST NOT run `git commit` in `C:\ProjectOperations2` on `main`.
- Breadcrumbs, station notes and scanner output are left **untracked**. The sweep job lands them.
- Work that must be committed goes on a branch (`git switch -c <type>/<desc>`) and through a PR.
- Note that the guard lives in the TRACKED hook at `.githooks/pre-commit` (this repo sets
  `core.hooksPath = .githooks`, so `.git/hooks/` is ignored entirely).

**2. Remove the instruction that causes it.** `04-scanner.md:181` and any sibling in
`02-board-driver.md`, `05-sot-keeper.md`, `06-pr-master.md` that implies "commit locally, cannot push"
must be replaced with the untracked-plus-sweep rule. Do not merely append — the contradictory sentence
has to go, or agents will keep following it.

**3. Add `scripts/pipeline/sweep-breadcrumbs.ps1`.** It must:

- create a branch, stage ONLY untracked files matching `docs/pr-prompts/00-*.md` and
  `docs/pipeline/**` breadcrumbs, commit, push the branch, and open a PR via `gh`;
- refuse to stage anything matching `*-ready.md` or `*-HOLD.md` — arming is never swept;
- refuse to stage deletions, so consumed-HOLD removals are not smuggled in;
- be a no-op with exit 0 when there is nothing to sweep;
- support `-WhatIf`, printing the exact file list it would commit and touching nothing.

**4. Merge the branch guard into the EXISTING tracked hook.** `core.hooksPath = .githooks`, so
`.git/hooks/` is ignored — measured 2026-08-27, copying a hook there had zero effect and an empty
test commit on `main` succeeded anyway. A doc-stamping hook already lives at `.githooks/pre-commit`
(it stamps "Last updated:" on progress.md / roadmap.md / project_instructions.md and ends `exit 0`).

Insert the branch guard at the TOP of that file, immediately after `set -e`, so a refused commit
short-circuits before any stamping. **Do not overwrite the file** — destroying the stamper would be
a silent regression. The guard's source and rationale are in `scripts/pipeline/hooks/pre-commit`;
copy the logic in, keep that file as the documented source, and note in the doc that the hook is
tracked and therefore needs no manual install step at all.

**5. Tests** in `scripts/pipeline/__tests__/`: sweep-breadcrumbs stages a breadcrumb; refuses a
`-ready.md`; refuses a deletion; no-ops cleanly on an empty sweep.

## Do NOT

- Do not touch `sot/` — Station 05 owns it.
- Do not add a hook that writes into `.git` automatically.
- Do not change `arm-prompt.ps1`; the unlogged-arming gate is a separate slice.
- Do not commit anything to `main` while implementing this.

## Verification

    node scripts/pipeline/lint-station.mjs
    pwsh -File scripts/pipeline/sweep-breadcrumbs.ps1 -WhatIf
    # end-to-end, not just "the file exists" - a copy into .git/hooks/ proves nothing here:
    git commit --allow-empty -m "hook test"   # on main: MUST be refused, no commit created
    git switch -c tmp/hook-test && git commit --allow-empty -m "hook test"   # MUST succeed

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and open the PR without asking for
confirmation. Do not stop to ask whether to proceed; the scope above is the approval. Work on a
branch — never commit on `main` in this tree, which is the very defect this slice removes.
