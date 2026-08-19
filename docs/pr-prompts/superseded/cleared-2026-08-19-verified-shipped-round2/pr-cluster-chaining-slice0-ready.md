---
premise: '! test -f docs/plans/cluster-chaining-plan.md'
premise_means: There is no cluster-chaining plan; the queue has no cluster concept, the intake linter is blind to dependency keys, and the watcher cannot gate on a modified file.
scope:
  - docs/plans/**
done_when: pnpm lint && test -f docs/plans/cluster-chaining-plan.md && grep -q "SLICE 8" docs/plans/cluster-chaining-plan.md && grep -q "requires_on_main" docs/plans/cluster-chaining-plan.md && grep -q "SCOPE OVERLAP" docs/plans/cluster-chaining-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# SLICE 0 - Cluster chaining: write the slice plan

> Authored by PR Master with Marco 2026-08-17. DOCS-ONLY planning PR: write the plan, write no code.
> Marco's requirement: a whole multi-slice cluster is staged at once, and a slice cannot dispatch
> until the previous slice's work is verifiably on main, checked live against GitHub. Ordering must
> hold within a cluster AND across clusters. A broken chain must self-heal or escalate - never stall
> silently, and never leave PRs sitting idle.

## Verified current state (origin/main, all read-only, positive control passed)

WHAT ALREADY WORKS - do not rebuild:
- `scripts/pr-watcher/index.mjs` parses `requires_merged:` and `requires_file_on_main:` from
  front-matter (plus a legacy HTML-comment form; effective set is the de-duplicated union).
- `unmetDependencies()` runs `gh pr view <n> --json state` and requires state MERGED; and
  `git cat-file -e origin/main:<file>` for file deps. A gh/git error counts as UNMET - fail closed.
- An unmet dependency DEFERS the prompt: it is not consumed, it leaves `seen`, and the periodic
  rescan re-checks it. `syncMain()` pulls main so the next prompt sees the merged commit.
- `scripts/pr-watcher/merge-queue.mjs` already merges an ordered PR list sequentially, confirms
  `state == MERGED` before advancing, and re-runs failed jobs once to clear transient flakes.
  It is NOT wired to anything.
- A pause path exists: remaining `*-ready.md` move to `paused/` with a `PAUSED_SUMMARY.md`.
- A fix lane exists: `fixes_pr: <N>` front-inserts a fix-forward prompt ahead of ordinary work.

WHAT IS MISSING - the actual work:
1. `scripts/pipeline/lint-prompt.mjs` contains ZERO references to `requires_merged` or
   `requires_file_on_main`. A mistyped key (`requires-merged`, or the plural `requires_files_on_main`
   - note the real key is SINGULAR) passes lint and the prompt runs COMPLETELY UNGATED. This is the
   out-of-order mechanism, and it is silent.
2. No way to gate on a MODIFIED file. `requires_file_on_main` only expresses "a new file exists", so
   any slice that edits an existing file cannot be chained and cannot be pre-staged.
3. No cluster concept anywhere in the watcher, the pipeline scripts or PROMPT-SCHEMA.md. Ordering is
   emergent from declared dependencies only; two prompts with no declared dependency run in readdir
   order, and with multiple lanes they run CONCURRENTLY.
4. A `requires_merged` target that is CLOSED-not-merged defers forever, silently - violating
   DOCTRINE never-exit-silently.
5. QUEUE ROT, verified 2026-08-17: two prompts sit armed in `docs/pr-prompts/` that the CURRENT
   linter REJECTS, so neither can ever dispatch - they would be binned at dequeue and nobody would
   know. Both edit `scripts/pipeline/lint-prompt.mjs`, neither declares a dependency on the other,
   and both fail the OPS-6 escalation rule: `pr-pr-master-hardening-slice0-ready.md` trips it on its
   OWN prose describing the nullability signal it introduced, and the Gate-A intake lint-rule prompt
   trips it on a single ordinary word in its body. Neither prompt is hazardous. The rule matches its
   trigger words ANYWHERE in the body - inside a file NAME, or inside prose that merely EXPLAINS the
   rule - so it fires on prompts that carry no risk. Demonstrated live while authoring this very
   prompt: two successive drafts were rejected, the second purely for quoting the rule's own
   wording in a description of the problem. The plan must
   name this as the worked example: an armed prompt whose lint status nobody re-checks is exactly
   the "sitting idle" failure Marco is trying to eliminate, and an over-matching rule is how a
   safety gate loses its authority.

## Design decisions Marco approved (encode these; do not re-litigate)

- **Chaining primitive is the ARTIFACT, not the PR number** - so a cluster stages in one arming PR
  with no numbers to fill in later. `requires_merged` remains supported for after-the-fact chaining.
- **Extend the watcher with a CONTENT gate** so modified files can be chained. New key
  `requires_on_main:` accepting `<path>` or `<path> :: <fixed-string>`; the string form checks
  `git show origin/main:<path>` for FIXED-STRING containment - NOT a regex. index.mjs deliberately
  avoids regex quantifiers (CodeQL js/polynomial-redos); do not reintroduce them. A missing file
  returns UNMET, never throws.
- **A cluster is a DAG, not a line.** A slice waits ONLY on the slices it declares. Independent
  siblings run IN PARALLEL across both watcher lanes - that is what the two lanes exist for. In the
  theme cluster, for example, the token-cleanup slices are mutually independent once the foundation
  slice has landed, and forcing them through one lane would waste a lane on the largest phase of the
  work. Marco corrected an earlier "one cluster, one lane" proposal on exactly this ground.
- **SCOPE OVERLAP serialises, independently of dependencies.** Two prompts with no dependency
  between them can still edit the same file. Derive this from the `scope` globs already present in
  every prompt: if two ready prompts have overlapping scope, dispatch them one at a time even when
  neither declares a dependency, and DO THIS ACROSS CLUSTERS TOO. Dependencies express ORDER; scope
  overlap expresses COLLISION. Both are required; only the first exists today.
- **Ordering comes from DISPATCH gating, not from merge control.** A slice cannot start until its
  declared predecessor's artifact is on main, so a dependent pair can never have two PRs open at
  once - out-of-order merging inside a chain is impossible by construction rather than by policy.
- **merge-queue.mjs may be wired ONLY AFTER it is guarded.** Today it checks NOTHING - no
  NEVER_MERGE list, no `escalates`, no label - so wiring it as-is would build an unguarded automatic
  merger. With two lanes producing PRs concurrently the supervisor genuinely wants it, so the guards
  are a slice in this plan rather than a prohibition. Merge authority stays with the supervisor.
- **Broken chain**: pause the cluster (existing `paused/` machinery) with a summary naming the broken
  link, AND auto-author a fix-forward prompt (`fixes_pr:`) inside the same cluster so the chain can
  free itself once the fix is on main. After TWO failed fix attempts, escalate to Marco - the
  doctrine's two-honest-attempts rule.
- **Visibility ships with the gates, not later.** A deferred prompt must be answerable with one
  command: which cluster, which slice, what it waits on, since when.

## The plan file: docs/plans/cluster-chaining-plan.md

Sections: goal + non-goals; verified current state (above, with file paths); the slice list below,
each with id, goal, expected files, an executable premise and its predecessor; per-slice acceptance;
and an open-questions list.

- SLICE 1 - linter learns the dependency keys: recognise `requires_merged`, `requires_file_on_main`,
  `requires_on_main`; REJECT any unrecognised `requires*` key as a typo. Negative tests are the
  deliverable. NOTE the two rejected prompts above also edit this file - the plan must decide
  whether they are re-authored, retired, or chained ahead of SLICE 1, and record the decision.
- SLICE 2 - watcher: the `requires_on_main` content gate. Fixed-string only; missing file = unmet.
- SLICE 3 - cluster metadata: `cluster:` and `cluster_order:` in front-matter + PROMPT-SCHEMA.md;
  lint REJECTS `cluster_order > 1` with no declared dependency, a cycle, or a dead gate (a
  `requires_on_main` that is ALREADY satisfied on main).
- SLICE 4 - watcher dispatch: walk the cluster DAG, run independent siblings in parallel across
  lanes, and serialise any two ready prompts that share a declared dependency OR whose `scope` globs
  overlap (across clusters too). Ties break on `cluster_order` so dispatch is deterministic rather
  than filesystem-ordered.
- SLICE 5 - visibility: a cluster-status command + a per-defer log line naming cluster, slice, what
  is awaited and how long; escalate a defer that exceeds a threshold instead of looping.
- SLICE 6 - broken-chain handling: pause the cluster, auto-author the `fixes_pr:` prompt, escalate
  after two failed attempts.
- SLICE 7 - guard `merge-queue.mjs` BEFORE anything wires it: honour the NEVER_MERGE list, refuse a
  PR whose prompt carried `escalates: true`, and refuse a PR carrying a do-not-merge label. Only
  once these land may the supervisor drive it to keep two lanes flowing.
- SLICE 8 - `docs/pipeline/LESSONS.yaml` entry + PROMPT-SCHEMA.md worked example, so the lesson is
  mechanical rather than prose.

## DO NOT

- Do NOT write code or touch `scripts/**` in this PR - it is the plan only.
- Do NOT wire `merge-queue.mjs` into anything before SLICE 7 has landed its guards, and do NOT grant
  the watcher or the linter merge authority. Merge authority stays with the supervisor.
- Do NOT edit anything under `sot/` (CP-24 hard-fails a mixed PR).
- Do NOT arm SLICES 1-8. Arming is Marco's call.
- Do NOT attempt to fix the separate finding that `escalates: true` is enforced by nothing - the
  watcher auto-merges every PR it opens, has no concept of `escalates`, and no do-not-merge gate
  exists in CI. RECORD it in the plan's open-questions section as a SEPARATE brief for its own run.

## VERIFY

```
pnpm lint
test -f docs/plans/cluster-chaining-plan.md
grep -q "SLICE 8" docs/plans/cluster-chaining-plan.md
grep -q "requires_on_main" docs/plans/cluster-chaining-plan.md
grep -q "SCOPE OVERLAP" docs/plans/cluster-chaining-plan.md
```

## STANDING AUTHORITY

You may read any file in the repo, run read-only git and grep commands, and open the PR for this
docs-only change. You may NOT write code, edit `sot/`, merge, or arm any downstream prompt. If the
premise is already false when you boot - the plan file exists - exit with a NO-OP report saying so;
do not invent adjacent work.
