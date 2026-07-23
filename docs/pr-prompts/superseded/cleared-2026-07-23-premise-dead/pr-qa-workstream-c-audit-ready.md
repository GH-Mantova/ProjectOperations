---
premise: '! test -f docs/qa/workstream-c-coverage-audit.md'
premise_means: The Workstream-C compliance-coverage audit (re-review of the 2026-07-02 plan against today's suite) has not been produced yet.
scope:
  - apps/api/src/**
  - docs/qa/**
done_when: pnpm build && pnpm lint && test -f docs/qa/workstream-c-coverage-audit.md
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# QA Workstream C — re-review the plan FIRST, then fill only the genuine gaps

Marco's decision (BACKLOG-DECISIONS.md #5): still **full depth**, BUT the plan was locked 2026-07-02
and the world has changed completely since (the pipeline, stations, gates, intake lint, and the
acceptance suite all now exist). **Re-review the plan against today's reality before writing a single
test — much of what it assumed was missing may already be covered.**

## What to do (in this order)

1. **Locate the Workstream-C plan.** Check `sot/05-decisions-and-lessons.md`, `docs/qa/`, and the git
   log around 2026-07-02. If you cannot find a written plan, say so in the audit and reconstruct the
   intended scope from the compliance surfaces in the codebase (licences, insurance, expiry crons,
   prequal, auto-block, compliance dashboard).
2. **Assess current coverage.** Map each Workstream-C intent against what today's acceptance suite,
   pipeline gates, and existing `*.spec.ts` already exercise. Be evidence-based — grep the tests.
3. **Fill ONLY the genuine gaps.** Write real, full-depth compliance tests for the behaviours that are
   demonstrably NOT covered. Put them where they belong (alongside the module under test).
4. **Produce `docs/qa/workstream-c-coverage-audit.md`** — the required deliverable: what the plan
   asked for, what is already covered (with evidence), what you added, and what remains for a later
   slice. If most is already covered, that is a valid, honest outcome — the audit doc plus minimal or
   no new tests.

## Do NOT
- Do NOT blindly re-implement the 2026-07-02 plan. Cover only what today's suite genuinely misses.
- Do NOT delete or rewrite existing passing tests.
- Do NOT touch schema.prisma or add migrations — this is tests + an audit doc only.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- if the audit already exists, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
