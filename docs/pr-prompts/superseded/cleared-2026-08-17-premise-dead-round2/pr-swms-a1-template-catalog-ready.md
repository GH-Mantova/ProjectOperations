---
premise: '! grep -q "model SwmsTemplate" apps/api/prisma/schema.prisma'
premise_means: The SWMS template catalog tables (SwmsTemplate / SwmsTemplateSection / SwmsTemplateControl / SwmsTemplateControlRow) do not exist on main yet — SLICE A1 of the Interactive SWMS build has not been built.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
done_when: pnpm build && pnpm lint && node scripts/data-model/build-relationship-map.mjs --check && grep -q "model SwmsTemplateControlRow" apps/api/prisma/schema.prisma
size: 3
gate_allow: migrations
seed_only: false
escalates: true
---

# SWMS build — SLICE A1: data model for the SWMS template catalog

This is the FIRST code slice of the Interactive SWMS module. The ordered build plan shipped as
SLICE 0 (`docs/architecture/drafts/swms-build-slice-plan.md`, PR #751). This slice implements **A1
exactly as written there** — Track A, the static SWMS wizard — and nothing beyond it. Slices are
armed one at a time under the size-10 cap; A2 (seed) and everything downstream are separate PRs.

Read `docs/architecture/drafts/swms-build-slice-plan.md` §3 "A1" and §2 "Source inventory / data
shape" before starting — the table shapes and natural keys are specified there, not to be guessed.

## What to build

1. Add four Prisma models to `apps/api/prisma/schema.prisma`, in this parent→child order:
   - `SwmsTemplate` — natural key `code` (unique). Holds template identity + revision label.
   - `SwmsTemplateSection` — FK to `SwmsTemplate`; natural key `(templateId, number)`; carries `order`, `title`.
   - `SwmsTemplateControl` — FK to `SwmsTemplateSection`; natural key `(sectionId, code)`; carries `order`, `headingLabel`, `subLabel`.
   - `SwmsTemplateControlRow` — FK to `SwmsTemplateControl`; natural key `(controlId, code)`; carries `order`, `hazard`, `riskBefore`, `controls`, `riskAfter`, `ppe`.
   Use **natural keys for idempotency** (the A2 seed upserts on them) — never rely on autoincrement ids for seed matching. Add the unique constraints/indexes that back those natural keys.
2. Generate the migration: a single new folder `apps/api/prisma/migrations/<full-timestamp>_swms_template_catalog/migration.sql`. The timestamp MUST be a full `YYYYMMDDHHMMSS_` prefix (bare `YYYYMMDD_` folders sort ahead of same-day timestamped migrations — see sot/05).
3. Run `node scripts/data-model/build-relationship-map.mjs` so the generated data-model artefacts stay in sync, and confirm `--check` passes. **The generated `docs/data-model/relationship-map.{md,json}`, `metadata-catalog.json`, and `relationship-graph.html` are gitignored — do NOT commit them** (the schema is the source of truth; they are derivable locally).

## PR body MUST include
- `GATE-ALLOW: migrations` as a **bare line at column 0** (a `## ` heading does NOT match CP-11's regex, and a trailing period breaks it too).
- One line confirming this is SLICE A1 only, per `docs/architecture/drafts/swms-build-slice-plan.md`.

## Do NOT
- Do NOT add triggers, the SOP-SWMS catalog, the document-instance tables, or the control↔trigger mapping — those are A3/A4/B1, separate slices.
- Do NOT add any API controller/service/module, any seed data, or any web/UI. A1 is schema + migration ONLY.
- Do NOT commit the generated `docs/data-model/**` artefacts (gitignored).
- Do NOT touch `sot/**` (CP-24 hard-fails any PR mixing code and sot/).
- Do NOT exceed the four models named above or edit unrelated schema sections.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: true` (schema migration, foundational to the whole SWMS build): open it and
LEAVE IT UNMERGED for Marco to review the table design before A2+ build on it.

## Guardrails
- One attempt. Never exit silently -- if `SwmsTemplate` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the CI job log before diagnosing any failure -- never from the diff.
- `pnpm build` + `pnpm lint` + the data-model drift check must pass before you open the PR.
