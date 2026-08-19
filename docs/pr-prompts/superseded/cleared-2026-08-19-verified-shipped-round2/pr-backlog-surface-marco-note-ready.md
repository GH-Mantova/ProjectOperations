---
premise: '! grep -q "marco_note" scripts/pipeline/check-backlog.mjs'
premise_means: >
  check-backlog.mjs never reads or prints the marco_note field, so a routing/safety
  instruction stored on a BACKLOG.yaml item is invisible to the only station that
  reads the register.
scope:
  - scripts/pipeline/check-backlog.mjs
done_when: node scripts/pipeline/check-backlog.mjs; test $? -ne 2 && grep -q "marco_note" scripts/pipeline/check-backlog.mjs
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Surface `marco_note` in the backlog gate checker

## The defect

`docs/pr-prompts/BACKLOG.yaml` supports a `marco_note` field. All 3 current items carry one.
**No script anywhere reads it.** Confirmed 2026-08-19 at `848a6810`:

```
$ git grep -n marco_note -- scripts/ docs/pipeline/
(no matches)
$ grep -c "^  - id:" docs/pr-prompts/BACKLOG.yaml   ->  3
$ grep -c "^    marco_note:" docs/pr-prompts/BACKLOG.yaml -> 3
```

`check-backlog.mjs` prints `it.title`, `it.gate_means` and `it.marco_question`. It never prints
`it.marco_note`.

The live consequence: item `settings-restructure-sot-nav-reconcile` carries

> `marco_note: STATION 05 SoT-KEEPER ONLY. Do NOT stage this as an ordinary watcher prompt and`
> `do NOT let a non-sot-keeper agent touch /sot/.`

but has `needs_marco: false`, so the checker prints it under
**">>> READY TO STAGE — the blocker is GONE. Stage these."** — instructing 04-scanner to do the
exact thing the item's own note forbids. The safety instruction exists in the file and is
structurally unreachable by its only consumer. That is DOCTRINE §7: a confident, coherent,
wrong verdict from a broken instrument.

## What to build

In `scripts/pipeline/check-backlog.mjs`, print `it.marco_note` (when present and non-empty) for
every item, in **all three** output buckets — ready, needs-marco, and still-blocked — immediately
under the existing `title` / `gate_means` lines. Suggested rendering, matching the existing style:

```
console.log(DIM + "        NOTE: " + String(it.marco_note).trim().replace(/\s+/g, " ") + RESET);
```

Keep the exit codes exactly as they are (10 = ready, 2 = malformed register, 0 = nothing ready).
Do not change the routing logic, do not change `needs_marco` handling, do not edit `BACKLOG.yaml`.

## Do NOT

- Do NOT edit `docs/pr-prompts/BACKLOG.yaml` — the register content is not in scope. Whether
  `settings-restructure-sot-nav-reconcile` should flip to `needs_marco: true` is Marco's call
  and is reported separately.
- Do NOT touch `gate-eval.mjs`, `check-lessons.mjs`, or `check-escalations.mjs`.
- Do NOT touch anything under `sot/` (CP-24 hard-fails a PR mixing code and `sot/`).
- Do NOT change exit codes or the STRICT-STRUCTURE GUARD.

## Guardrails

- One attempt. Read the job log before diagnosing any CI failure — never reason it from the diff.
- Never exit silently. If the work is already on `main`, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Gates

`pnpm build`, `pnpm lint`. No schema, no migration, no seed, no app code.
