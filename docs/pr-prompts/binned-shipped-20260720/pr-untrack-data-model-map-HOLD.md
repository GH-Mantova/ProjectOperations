---
premise: git ls-files docs/data-model/relationship-map.json | grep -q .
premise_means: The generated data-model map JSON is still committed to git - the source of the perpetual DIRTY-conflict treadmill on every open feature PR.
scope:
  - .gitignore
  - .github/workflows/ci.yml
  - scripts/data-model/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && ! git ls-files docs/data-model/relationship-map.json | grep -q .
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | stop committing the generated data-model map (Marco decision 2026-07-16) -->
# Stop committing the generated data-model map - kill the DIRTY treadmill

STATUS: DRAFTED, STAGED, arm-eligible. Decision record:
docs/pr-prompts/needs-marco/generated-map-conflict-treadmill-20260716.md (Marco chose Option 1).

## Why
The generated artifacts under docs/data-model/ (relationship-map.json ~1.3MB, metadata-catalog.json
~465KB, relationship-map.md ~107KB) are committed AND enforced by the CI gate "Data model - drift
check" (ci.yml job `data-model-drift`, which runs `scripts/data-model/build-relationship-map.mjs
--check`). Because they are committed, every merge triggers GitHub's auto "merge main into <branch>"
on the other open PRs and re-conflicts these files -> those PRs go DIRTY -> their CI freezes. This is
the single biggest recurring blocker on the board. relationship-graph.html is ALREADY gitignored for
exactly this reason; this extends that precedent to the remaining three files. Confirmed no app build
or runtime imports these files - only the doc toolchain (scripts/data-model/build-graph-html.mjs).

## What to build
Branch: `chore/untrack-data-model-map`. Reviewer: `GH-Mantova`. No migration.
1. Untrack the three generated files and ignore them:
   `git rm --cached docs/data-model/relationship-map.json docs/data-model/metadata-catalog.json docs/data-model/relationship-map.md`
   then add those three paths to .gitignore next to the already-ignored relationship-graph.html, and
   update the nearby comment to say the JSON/MD are derivable too (run `pnpm data-model:build`).
2. Rewrite the drift check so it no longer compares against a committed file. The gate's purpose
   becomes "the generator still runs cleanly against the current schema.prisma", not "the committed
   map matches". Change the `data-model-drift` job (ci.yml) and the `--check` path in
   build-relationship-map.mjs so CI runs the generator fresh and FAILS only if it errors or cannot
   resolve a model/relation present in schema.prisma. Remove the "run ... and commit the result"
   error message.
3. POSITIVE CONTROL (DOCTRINE section 7): before trusting the new check, prove it can PASS on the
   current schema AND FAIL on a deliberately broken schema. State both results in the PR body.

## Do NOT
- Do NOT touch apps/api/prisma/schema.prisma or any migration. Do NOT change app runtime/build code.
- Do NOT build the in-app browser view of the map here - that is a SEPARATE staged prompt
  (pr-data-model-map-browser-view). Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing any failure.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge - leave the PR for Marco to review the
  CI-gate change; never exit silently (say `NO-OP: <reason>`); never ask a question or stand by.
