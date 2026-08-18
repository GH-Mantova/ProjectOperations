---
premise: '! grep -q cluster_order scripts/pipeline/lint-prompt.mjs'
premise_means: There is no cluster concept anywhere in the pipeline - not in the linter, not in the watcher, not in PROMPT-SCHEMA.md. Ordering today is emergent from declared dependencies only, so two prompts with no declared dependency run in readdir order. Without cluster metadata the linter cannot catch the three ways an arming PR silently ships a broken chain - a missing dependency, a cycle, or a gate that was already satisfied at intake.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: grep -q cluster_order scripts/pipeline/lint-prompt.mjs && node scripts/pipeline/test-lint-prompt.mjs && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Cluster chaining SLICE 3 - cluster metadata and the linter rules that police it

Implements **SLICE 3** of `docs/plans/cluster-chaining-plan.md` (PR #1161). Read §3 and §4 SLICE 3
before starting. Predecessor SLICE 1 is **already on `main`** - PR #1184, merged 2026-08-18,
`origin/main` @ `54559dad`. No dependency key is declared here because that gate is already
satisfied, which is precisely the `CLUSTER_DEAD_GATE` condition this slice teaches the linter to
reject.

SLICE 2 is armed in parallel. It edits `scripts/pr-watcher/index.mjs`; you edit
`scripts/pipeline/lint-prompt.mjs`. The only shared file is `docs/pr-prompts/PROMPT-SCHEMA.md`, and
the watcher runs one prompt at a time, so you will branch off a `main` that already contains
whichever of the two landed first. **Rebase, do not fight it.**

## The gap, measured

[MEASURED] against `origin/main` @ `54559dad`: `scripts/pipeline/lint-prompt.mjs` contains
`requires_merged`, `requires_on_main` and `UNKNOWN_KEY` (SLICE 1 landed all three) and **zero**
occurrences of `cluster_order`.

## What to build

**1. Two new optional front-matter keys:**

- `cluster: <slug>` - must match `^[a-z][a-z0-9-]{2,40}$`. Reject otherwise (`CLUSTER_BAD_SLUG`).
- `cluster_order: <n>` - a positive integer. Reject `0`, negatives, and non-numerics.

Both optional. A prompt with neither is unchanged - that is every prompt in the queue today and
none may start failing. `cluster_order` without `cluster` is a REJECT; `cluster` without
`cluster_order` is legal (a one-slice cluster).

**2. `CLUSTER_NO_DEP`** - `cluster_order > 1` with no `requires_merged`, `requires_file_on_main`, or
`requires_on_main` -> REJECT. A slice that claims to be second in line but declares nothing to wait
on is exactly the silently-ungated prompt this cluster exists to eliminate.

**3. `CLUSTER_CYCLE`** - compute each cluster's declared-dependency graph across the `*-ready.md`
AND `*-HOLD.md` prompts staged in `docs/pr-prompts/**`, and REJECT on a cycle. Report the cycle as
a path (`a -> b -> c -> a`), not a bare "cycle detected"; the author has to be able to find it.

This rule reads sibling files, which the linter may not do today. Two constraints:

- **Fail SAFE, not closed.** If the prompt directory is unreadable or a sibling is malformed, emit a
  warning and SKIP the cycle check for that run. Do not reject a well-formed prompt because an
  unrelated file in the directory is broken - that would let one bad prompt block the whole queue.
- **Do not let it cost O(n^2) `git`/`gh` calls.** Build the graph from front-matter text only. No
  network, no subprocess, in this rule.

**4. `CLUSTER_DEAD_GATE`** - a `requires_on_main` whose fixed string is **already present on
`origin/main` at intake time** -> REJECT. The arming PR would dispatch that slice instantly with no
gate at all, which reads as ordered and is not.

This one DOES need `git show origin/main:<path>`. Same fail-safe rule: if `git` is unavailable or
errors, warn and skip the check - never reject on a failed probe. And apply it only when `cluster`
is present, so ordinary non-cluster prompts do not acquire a new network dependency at lint time.

**5. Document in `docs/pr-prompts/PROMPT-SCHEMA.md`**: both keys, all four rejection codes with a
one-line "why this rule exists" each, and a worked two-slice cluster example.

## Do not break the linter's existing contract

`lint-prompt.mjs` is the ADMIT / BIN / REJECT gate for the whole queue and its exit codes are
consumed by `queue-sync.ps1` (0=ADMIT, 3=STALE, 1=MALFORMED). **Do not change any existing exit code
or verdict name.** New rejection reasons are fine; a renumbered exit code would silently reclassify
every prompt in the queue.

Run the linter across the whole live queue before and after and report any prompt whose verdict
CHANGES. A verdict change on an unrelated prompt is a regression, not a bonus catch - and note that
**the two prompts armed alongside this one deliberately carry no dependency key**, so they must
still ADMIT.

## Tests - `scripts/pipeline/test-lint-prompt.mjs`

Each negative test must be RED before the fix and GREEN after - demonstrate it, do not assert it.

- valid `cluster` + `cluster_order: 1`, no dependency -> ADMIT.
- `cluster_order: 2` with no dependency key -> REJECT `CLUSTER_NO_DEP`.
- `cluster_order: 2` with a `requires_on_main` -> ADMIT.
- `cluster_order: 0` / `-1` / `two` -> REJECT.
- `cluster: Bad_Slug` / `ab` (too short) / a 41-char slug -> REJECT `CLUSTER_BAD_SLUG`.
- `cluster_order` present, `cluster` absent -> REJECT.
- a two-prompt cycle in a synthetic temp directory -> REJECT `CLUSTER_CYCLE`, message names both.
- an unreadable / malformed sibling -> warning, no rejection of the good prompt.
- a `requires_on_main` needle already on `origin/main` -> REJECT `CLUSTER_DEAD_GATE`.
- `git` unavailable during the dead-gate probe -> warning, ADMIT.
- a prompt with none of these keys -> unchanged. **This matters most.**

Do not weaken an existing assertion to go green.

## Do not

- Do not touch `sot/`. CP-24 hard-fails a PR mixing code and `sot/`.
- Do not edit `scripts/pr-watcher/index.mjs` - that is SLICE 2, running in parallel. The linter does
  not need the watcher to change for any rule in this slice.
- Do not implement DAG traversal or scope-overlap dispatch. That is SLICE 4 and it gates on this
  slice plus SLICE 2. This slice only DESCRIBES and VALIDATES the graph; it does not walk it.

## Verification

    node scripts/pipeline/test-lint-prompt.mjs
    pnpm lint

Then `node scripts/pipeline/lint-prompt.mjs` over every file in `docs/pr-prompts/*.md`, verdict
counts before and after, pasted.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
