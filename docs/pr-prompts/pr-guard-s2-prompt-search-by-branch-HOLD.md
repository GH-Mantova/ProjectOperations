---
premise: '! grep -q "headRefName" .claude/agents/pr-fix-reviewer.md'
premise_means: >-
  The reviewer looks for a PR's originating prompt by PR number, in a clone where the prompt directory is
  a gitignored skeleton. It cannot find one, applies the do-not-guess rule correctly to a broken search,
  and blocks clean work.
scope:
  - .claude/agents/pr-fix-reviewer.md
  - scripts/pr-watcher/review-prompt-template.md
  - scripts/pr-watcher/index.mjs
done_when: 'grep -q "headRefName" .claude/agents/pr-fix-reviewer.md'
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-guard
cluster_order: 3
requires_on_main: scripts/pr-watcher/index.mjs :: validateVerdict
---

# PIPELINE GUARD 2 — find the prompt by branch, in the queue that actually holds it

## The measured defect

`.claude/agents/pr-fix-reviewer.md:20-26` tells the reviewer to search `docs/pr-prompts/pr-{N}-*.md`.
**Prompts are never named after the PR they produce** — they are named after the slice. On #1347 it
searched `pr-1347-*.md` and `pr-pipeline-fold-s1-any-permission*.md` (s1, guessed from prose in a
breadcrumb) while the real prompt was `pr-pipeline-fold-s3-nav-any-permission-*`, and returned
NEEDS-MARCO-VERIFY on a clean PR.

It compounds: the agent's `cwd` is `REPO_ROOT` (the clone), `PROMPT_DIR` is a **separate** path
(`index.mjs:61-69`, `watcher-launcher.ps1:5`), and `*-ready.md` plus `processed/` are gitignored
(`.gitignore:75-82`) — so in the clone that directory is a git-tracked skeleton that structurally
cannot hold the answer. Measured: the dev tree's `needs-marco/` has 13 files, the clone's has 156.

## Do

1. In `.claude/agents/pr-fix-reviewer.md`, replace the `pr-{N}-*` globs with: derive the slice name from
   `gh pr view <n> --json headRefName`, then search **`{{PROMPT_DIR}}`** across `.`, `processed/`,
   `failed/`, `paused/` and `blocked/` by **filesystem glob, not git**.
2. Add `{{PROMPT_DIR}}` to `renderTemplate` (`index.mjs:1969-1973`) carrying the absolute `PROMPT_DIR`
   from `index.mjs:70`.
3. State in the agent file: *"`*-ready.md` and `processed/` are gitignored — a git-indexed search cannot
   see them."*
4. Add `{{PR_FILES}}` to `review-prompt-template.md`, populated from P0-a's `prFileList`, and an operating
   rule: *"The file list above is authoritative. Do NOT derive the PR's changes from a local `git diff` —
   this clone's `main` is not kept in sync."*

## Do NOT

- Do NOT weaken or remove the do-not-guess rule. It behaved correctly; the search it was fed did not.
- Do NOT touch `verdict-guard.mjs` — that is P0-a and already on main by the time this runs.
- Do NOT change the watcher's process management, launcher or keepalive.

## STOP AND REPORT

- `PROMPT_DIR` is not resolvable at `index.mjs:70` as described.
- `prFileList` from P0-a is not present — the gate should have prevented this; report it.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. **Finishing the work and then asking for
> permission is indistinguishable from failing** — the work is discarded either way.

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. The STOP
AND REPORT conditions mean **open the PR, put the problem in the body, leave it unmerged** — never exit
without opening a PR. Report measurements, not conclusions: if you assert a count or a line number,
show the command that produced it.
