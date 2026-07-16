---
premise: '! grep -q "model FormContentSnippet" apps/api/prisma/schema.prisma'
premise_means: There is no reusable content-snippet library; long legal/HTML blocks are still pasted inline per form.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/forms/**
  - apps/web/src/pages/forms/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model FormContentSnippet" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | Forms engine gap 1/6 | reusable content library + template clone -->
# Forms engine — reusable content-snippet library + template clone

STATUS: DRAFTED, STAGED, arm-eligible. Extends the EXISTING forms engine (PR #97 — `FormTemplate`/
`FormSection`/`FormField` already exist). Fixes the forensic finding that the Guarantee/T&Cs/Privacy
text is pasted inline into every credit-form variant (the 14-Day Credit form is 246 questions, mostly
duplicated legal HTML) — one clause change means editing four near-identical monoliths.

## What to build
Branch: `feat/forms-content-library`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `FormContentSnippet` (id, code unique, name, category, bodyHtml, version, isActive). A form
   section or a `content`/`static` field references a snippet by code/id instead of embedding HTML, so the
   snippet is authored once and rendered by many templates.
2. API in the `forms` module — CRUD for snippets; resolve referenced snippets when a template version is
   fetched/rendered; guard via the existing super-user/authority pattern used elsewhere in the module.
3. Template **clone**: duplicate a `FormTemplate` (+ its latest version, sections, fields, rules) into a
   new DRAFT template — so the 7-day/14-day/prepaid credit variants derive from one master, not copies.
4. Web — in `FormDesignerPage`, a "content block" field/section type that picks a snippet; a "Clone
   template" action on `FormsListPage`.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).
Put a bare `GATE-ALLOW: migrations` line at column 0 of the PR body. If you change a service's Prisma
create/update payload, update that service's `*.spec.ts` `toHaveBeenCalledWith` expectations.

## Do NOT
- Do NOT rip out inline content from existing forms in this PR (data migration is separate). Do NOT
  touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
