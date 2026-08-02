---
premise: '! test -f docs/plans/settings-restructure-permission-map.md'
premise_means: The settings-restructure permission map (SLICE 1) does not exist on main yet.
scope:
  - docs/plans/settings-restructure-permission-map.md
done_when: pnpm lint && test -f docs/plans/settings-restructure-permission-map.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Settings restructure SLICE 1 — permission-code inventory (docs-only)

Per docs/plans/settings-restructure-plan.md §3 SLICE 1. Marco's 2026-08-03 decisions are now
IN (no PENDING-MARCO block needed):

- Missing codes are CREATED AS NAMED: `company.manage`, `automations.manage`, `audit.view`,
  `platform.manage`, `ai.manage` (wherever they don't already exist in the catalogue).
- Job roles' final home is `/workers/job-roles` (plan slice 15 variant chosen).

## What to build

Write `docs/plans/settings-restructure-permission-map.md`: every entry of the plan's §2
target IA mapped to its permission code, marked EXISTS (with the catalogue file:line) or
NEW (to be added by the slice that first gates on it — name that slice). Ground against the
real permission catalogue (find it: grep the API for the permission-code registry the
seeds/roles use; positive control with a code you know exists, e.g. masterdata.manage).
Include a short section listing which seeded roles should receive each NEW code (propose;
Marco confirms at the slice that adds them — adding codes to ROLES is an authorization grant
and stays with him).

## Do NOT
- Do NOT touch code, seeds, or sot/ — docs only.

## VERIFY
- `pnpm lint` and the file exists; every §2 IA entry appears exactly once.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
