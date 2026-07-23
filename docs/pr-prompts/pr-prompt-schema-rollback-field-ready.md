---
premise: '! grep -q "rollback_strategy" docs/pr-prompts/PROMPT-SCHEMA.md'
premise_means: PROMPT-SCHEMA.md does not define a rollback_strategy field yet.
scope:
  - docs/pr-prompts/PROMPT-SCHEMA.md
  - scripts/pipeline/lint-prompt.mjs
done_when: 'grep -q "rollback_strategy" docs/pr-prompts/PROMPT-SCHEMA.md && grep -q "rollback_strategy" scripts/pipeline/lint-prompt.mjs'
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# SCHEMA+LINT: add a rollback_strategy field, required for migration-touching prompts

Touch ONLY `docs/pr-prompts/PROMPT-SCHEMA.md` and `scripts/pipeline/lint-prompt.mjs`. This is a
docs + scripts change; `sot/` is untouched, so it is NOT a CP-24 mix.

## Why
Prompts define scope and premise but not what to do when a change HALF-LANDS. LL-29: a turn-capped
agent left a migration applied with all code uncommitted, and nothing told the recovery path how to
revert or fix-forward. A `rollback_strategy` note, required whenever a prompt's scope touches
`prisma/migrations`, closes that gap.

## What to build
1. **PROMPT-SCHEMA.md:** document a new front-matter field `rollback_strategy`. It is OPTIONAL in
   general, but REQUIRED whenever `scope` includes a `prisma/migrations` path. It states, in one or
   two lines, how to revert or fix-forward if the run dies mid-flight (e.g. "migration is additive;
   safe to leave; re-run drops nothing" or "revert migration X, then re-apply"). Add it to the
   required-front-matter example and to the field descriptions.
2. **lint-prompt.mjs:** enforce it. When the prompt's `scope` matches `prisma/migrations` (the same
   scope string the GATE-ALLOW check already computes), a missing/empty `rollback_strategy` must
   REJECT with a clear `MISSING_FIELD`-class message. For non-migration prompts the field stays
   optional and its absence must NOT reject.

## Do NOT
- Do NOT make rollback_strategy required for ALL prompts - only migration-scoped ones. Breaking the
  40+ armed non-migration prompts is out of scope and would jam the queue.
- Do NOT touch any file outside the two in scope. No schema.prisma, no migrations, no sot/.
- Do NOT change the existing REQUIRED list semantics for non-migration prompts.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- if the field already exists say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass. Add/adjust any lint-prompt self-test if one exists.
