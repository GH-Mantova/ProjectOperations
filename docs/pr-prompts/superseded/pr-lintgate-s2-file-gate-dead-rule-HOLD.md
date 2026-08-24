---
premise: '! grep -q "FILE_GATE_DEAD" scripts/pipeline/lint-prompt.mjs'
premise_means: The intake linter has no rule rejecting a requires_file_on_main whose path is already present on origin/main, so an already-satisfied dependency gate still passes intake and the slice dispatches ungated.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: node scripts/pipeline/test-lint-prompt.mjs && grep -q "FILE_GATE_DEAD" scripts/pipeline/lint-prompt.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: lint-file-gate-dead
cluster_order: 2
requires_merged: 1227
---

# SLICE 2 — `FILE_GATE_DEAD`: reject a `requires_file_on_main` that is already satisfied

## The hole

`CLUSTER_DEAD_GATE` (SLICE 3 of the cluster-chaining work) rejects a `requires_on_main` whose
NEEDLE is already on `origin/main`. Nothing checks the equivalent for `requires_file_on_main`,
whose value is a PATH. The linter verifies the key exists and is non-empty; it does not verify
that the gate discriminates. A path that already exists can never fail, so the prompt dispatches
alongside its predecessor rather than after it — ordered on paper, ungated in fact. This is the
same class of hole as `gate_allow` describing permission rather than likelihood.

Measured on `origin/main` `3bd53909` (2026-08-19): **8 of 18 `requires_file_on_main` declarations
in the queue were already satisfied**, four of them on ARMED `*-ready.md` prompts. SLICE 1 of this
cluster cleaned those up and left the marker doc named in this prompt's dependency gate. This
slice is the ratchet that stops the next one.

## What to build

In `scripts/pipeline/lint-prompt.mjs`, add a `FILE_GATE_DEAD` rejection:

- For every `requires_file_on_main` value (both inline-scalar and list forms), probe
  `git cat-file -e origin/main:<path>`.
- If the path **exists** on `origin/main` → **REJECT** with code `FILE_GATE_DEAD`. The message
  must name the prompt, the path, and say plainly that the gate can never fail, so the slice would
  dispatch with no ordering at all — and tell the author the two legal fixes: re-point at a
  content gate (`requires_on_main: <path> :: <fixed string the predecessor introduces>`) or drop
  the key because the dependency is genuinely satisfied.
- Apply the check to `requires_file_on_main` only. Leave `requires_on_main`'s bare-path form to
  the existing `CLUSTER_DEAD_GATE` path if it already covers it; if it does not, say so in the PR
  body rather than widening scope here.

### FAIL-SAFE, not fail-closed — this is the part that matters

Mirror `CLUSTER_DEAD_GATE` exactly (`lint-prompt.mjs` around lines 462-500 and 719 on
`3bd53909`): when `origin/main` **cannot be probed** — a shallow CI checkout with no `origin/main`
ref, a missing `git` binary, a detached environment — the rule must emit a **WARN to stderr and
SKIP**, never reject. One broken tool must not bin the whole queue. Reuse the existing helper if
`CLUSTER_DEAD_GATE` already has one rather than writing a second probe.

Unlike `CLUSTER_DEAD_GATE`, this rule is **NOT** limited to cluster prompts — a dead file gate is
just as dead on a non-cluster prompt.

### Keep CI able to see `origin/main`

Check `.github/workflows/ci.yml` (the job that runs `node scripts/pipeline/test-lint-prompt.mjs`,
around line 174 on `3bd53909`). If that job's checkout is shallow, the rule will WARN-and-skip on
every CI run and be worthless there. If `fetch-depth: 0` is already set, say so in the PR body. If
it is not, **do not change the workflow in this PR** — record it in the PR body as a follow-up, so
this stays a three-file change.

## Tests — required

Add cases to `scripts/pipeline/test-lint-prompt.mjs`:

1. `requires_file_on_main` pointing at a path that exists on `origin/main` → REJECT
   `FILE_GATE_DEAD`.
2. `requires_file_on_main` pointing at a path that does NOT exist → ADMIT.
3. List form with one dead entry among several live ones → REJECT.
4. Probe failure / `origin/main` unavailable → WARN + SKIP, prompt still ADMITs. Follow whatever
   stubbing pattern the existing `cluster-dead-gate` case uses; do not invent a new harness.

## Docs

In `docs/pr-prompts/PROMPT-SCHEMA.md`, add `FILE_GATE_DEAD` to the "Lint failures you will hit"
table and add one sentence under "The three dependency keys" explaining that a
`requires_file_on_main` path already on `origin/main` is rejected, with the two legal fixes.

## Do NOT

- Do NOT edit any `docs/pr-prompts/pr-*.md` prompt file. SLICE 1 already cleaned the queue. If your
  new rule rejects a prompt SLICE 1 left behind — SLICE 1's marker doc names one deliberately
  excluded (`pr-tfm-s9-backfill-and-cleanup-HOLD.md`) — **do not fix it here**. Record it in the
  PR body as a known follow-up.
- Do NOT change `.github/workflows/**`.
- Do NOT touch `/sot/`.
- Do NOT widen the rule to `requires_merged`.

## Guardrails

- One attempt. Run `node scripts/pipeline/test-lint-prompt.mjs` locally before opening the PR.
- Never exit silently. If the rule is already on `main`, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.
