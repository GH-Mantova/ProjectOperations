---
premise: '! grep -q "ADVERSARIAL PROMPT CRITIQUE" docs/pipeline/stations/04-scanner.md'
premise_means: The 04-scanner brief has no ADVERSARIAL PROMPT CRITIQUE section yet.
scope:
  - docs/pipeline/stations/04-scanner.md
done_when: 'grep -q "ADVERSARIAL PROMPT CRITIQUE" docs/pipeline/stations/04-scanner.md'
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# DOC: add an "ADVERSARIAL PROMPT CRITIQUE" section to the 04-scanner brief

Touch ONLY `docs/pipeline/stations/04-scanner.md`. Docs-only.

## Why
Post-code review is strong (pr-reviews, Assert-BodyClaimsAreReal, smoke exit codes) but the PLAN is
only mechanically linted. Nobody attacks a staged/armed prompt's DESIGN - missed callers, edge
cases, perf, security - before the watcher spends a whole agent run on it. The scanner is already
read-only and already sweeps prompts, so it is the right station to add a design-critique pass.

## What to build
Add a section titled exactly **`ADVERSARIAL PROMPT CRITIQUE`** to `docs/pipeline/stations/04-scanner.md`.
It defines a checklist the scanner applies to each staged/armed prompt it encounters:

- Does the `scope` miss a call site the change must also touch? (grep for the symbol across the repo.)
- Does the `premise` DIE when the fix lands (LL-54)? A premise that stays true after the work ships
  will re-fire forever.
- What is the ROLLBACK if a migration-touching change half-lands (LL-29)?
- Which EXISTING guard/gate could this change trip (CP-11/CP-24, route-shadowing, permission
  registry, data-model drift)?
- Is `size` honest for the real blast radius, or is it a split waiting to happen?

**Critical constraint (report-not-run rule):** findings are filed as REPORT LINES in the scanner's
output, NEVER as edits to the prompt under critique. The scanner does not rewrite other stations'
prompts; it flags them. State this explicitly in the section.

## Do NOT
- Do NOT touch any file other than `docs/pipeline/stations/04-scanner.md`.
- Do NOT add a mechanism that edits or auto-fixes prompts - critique is report-only.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- if the section already exists say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
