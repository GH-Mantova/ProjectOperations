---
premise: '! grep -q "ORPHANED_DISCHARGE" scripts/pipeline/lint-prompt.mjs'
premise_means: lint-prompt.mjs still reports a stale prompt as an ordinary STALE bin without checking whether BACKLOG.yaml discharged a backlog item into that prompt. When it did, binning the prompt deletes the last remaining record of the work.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
done_when: pnpm lint && node scripts/pipeline/test-lint-prompt.mjs && grep -q "ORPHANED_DISCHARGE" scripts/pipeline/lint-prompt.mjs
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Queue guard: a prompt must not be binned when it is a backlog item's only home

## The bug this closes — it already cost the repo a month

`docs/pr-prompts/BACKLOG.yaml` operates a rule: *"when an item IS staged, delete it here; one place,
never two."* `lint-prompt.mjs` operates another: *a prompt whose premise no longer holds is STALE and
gets binned before an agent is spawned* (exit 3).

Both rules are correct. **The seam between them is not specified, and work falls through it.**

What actually happened to the biggest workstream in the repo:

- **2026-07-17** — B-P0a (Job/Project) and B-P0b (Worker/WorkerProfile) were DISCHARGED from
  `BACKLOG.yaml`. Correct on the day: their SLICE-0 plan prompts were staged, so the register entry
  was the redundant second place.
- **2026-07-23** — both prompts were binned to `superseded/cleared-2026-07-23-premise-dead/`. Also
  correct: each premise was `! test -f <its plan doc>`, and the plan docs had just shipped.
- **Result** — the work lived in **no place at all**. The register pointed at the prompts; the
  prompts were gone. Twelve unbuilt slices (B-P0a-4 remainder, -5..-9, B-P0b-1..-7) had no home and
  nothing ever came back to ask. It was found by hand on 2026-08-20.

The generalisation worth encoding:

> **A prompt dying is not the same as the work being done.** A SLICE-0 plan prompt dies at the exact
> moment its plan ships — which is the moment the real work *begins*.

## Ground yourself first (read before writing code)

- `scripts/pipeline/lint-prompt.mjs` — the STALE path. Header comment at line 13 documents the exit
  codes (`0` admit, `1` reject, `3` stale/binned); the STALE result is printed around line 1029 and
  the process exit is line 1042. Line ~575 carries the existing comment about a prompt being
  "silently binned as STALE" — that word *silently* is the defect.
- `scripts/pipeline/test-lint-prompt.mjs` — the existing test harness. Follow its style exactly; do
  not introduce a new test framework.
- `docs/pr-prompts/BACKLOG.yaml` — the register. Discharge notes are **YAML comments**, not items.
  They look like:
  `# DISCHARGED 2026-07-17 (04-scanner): ... docs/pr-prompts/pr-job-project-merge-plan-ready.md ...`
  Note the file is not clean UTF-8 in places (mojibake in the header block). **Read it as bytes and
  match on the prompt filename only** — do not attempt to parse it as YAML for this check, and do
  not rewrite or "fix" the file.

## What to build

When a prompt resolves to **STALE**, before reporting it, scan `docs/pr-prompts/BACKLOG.yaml` for any
line containing that prompt's basename. If one is found:

1. Emit `ORPHANED_DISCHARGE` instead of a plain `STALE`, in the same loud style the linter already
   uses for `FILE_GATE_DEAD` — name the prompt, quote the matching discharge line, and state plainly
   that binning this prompt would delete the last record of that backlog item.
2. Tell the operator the two legal fixes, mirroring the `FILE_GATE_DEAD` message's shape:
   - re-open a `BACKLOG.yaml` item covering the work that remains, **or**
   - stage the successor prompt in the same PR that bins this one.
3. **Exit 1 (reject), not 3 (stale).** A reject stops the bin and demands a human decision. Exit 3
   means "binned, carry on" — which is the behaviour that caused the loss.

## Tests (required — add to `test-lint-prompt.mjs`)

1. **Orphan detected** — a stale prompt whose basename appears in a `BACKLOG.yaml` discharge line
   produces `ORPHANED_DISCHARGE` and exit **1**.
2. **Ordinary stale unaffected** — a stale prompt whose basename appears nowhere in `BACKLOG.yaml`
   still produces plain `STALE` and exit **3**. This is the important one: 34 historical agent runs
   were saved by the quiet-bin path and it must not regress.
3. **Admit unaffected** — a live prompt named in a discharge line is **not** flagged. The guard fires
   only on the stale path. A discharged item whose prompt is still live is the normal, healthy state.
4. **Substring safety** — `pr-foo-HOLD.md` must not match a discharge line that names
   `pr-foo-extended-HOLD.md`. Match on the full basename, not a bare substring.

## Do NOT

- Do NOT move, delete, or rewrite any prompt file. This changes the linter's **verdict**, nothing else.
- Do NOT edit `BACKLOG.yaml` — including its mojibake. Out of scope, and rewriting it would bury the
  discharge lines this guard reads.
- Do NOT change the exit code for ordinary STALE. Only the orphaned case escalates to 1.
- Do NOT add a dependency. Node built-ins only, matching the rest of the file.

## Guardrails

- One attempt. If `ORPHANED_DISCHARGE` already exists in the linter, say `NO-OP: <reason>` and exit.
- `pnpm lint` and `node scripts/pipeline/test-lint-prompt.mjs` must both pass.
- Two files. If it starts growing past that, stop and say so rather than widening scope.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
