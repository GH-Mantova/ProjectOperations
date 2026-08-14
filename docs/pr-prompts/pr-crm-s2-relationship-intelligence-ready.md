---
premise: '! test -f apps/api/src/modules/crm/relationships/relationships.service.ts'
premise_means: The CRM relationship-intelligence layer (contacts under Account, relationship notes, going-cold nudge) does not exist on main.
requires_file_on_main: apps/api/src/modules/crm/accounts/accounts.service.ts
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/crm/relationships/**
  - apps/api/src/modules/crm/relationships/__tests__/relationships.service.spec.ts
  - apps/web/src/pages/crm/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/relationships/relationships.service.ts && test -f apps/api/src/modules/crm/relationships/__tests__/relationships.service.spec.ts
size: 8
gate_allow: migrations
seed_only: false
escalates: false
rollback_strategy: 'Additive only - new relationship_notes table + nullable Contact.accountId + Contact.lastContactedAt columns. Safe to leave on main, re-run drops nothing. If the run dies mid-flight, drop the new table/columns or re-apply after code lands; no existing row is destructively mutated.'
---

# CRM-2 (S2) - Relationship intelligence

> **RE-ARMED 2026-08-14 (PR Master + Marco).** CRM-1 (Account foundation, #1055) is on main, so this slice's
> `requires_file_on_main` precondition is now satisfied — it previously NO-OP'd on 2026-08-12 only because it
> lost a race and ran ~18 min before CRM-1 landed. Marco authorised auto-merge for the CRM chain, so this is
> now `escalates: false` (additive migration; rollback strategy above); it auto-merges when green.

PR title MUST start with `[CRM-PRIORITY]`. First line of the PR body MUST be:
`PRIORITY: CRM program (Marco 2026-08-12) - drive ahead of other open PRs.`

## What to build (see docs/plans/crm-module-plan.md)
- Link Contacts under Account: add nullable `accountId` FK on `Contact` (schema.prisma:755) and
  `lastContactedAt`; keep `role`, `isPrimary`. Add `model RelationshipNote` (account/contact link,
  author, body, timestamps) for relationship history.
- Additive migration under `apps/api/prisma/migrations/**`.
- New module `apps/api/src/modules/crm/relationships/`: `relationships.service.ts`,
  `relationships.controller.ts`, `relationships.module.ts`, plus
  `__tests__/relationships.service.spec.ts`. Derive a "going cold" nudge (from `lastContactedAt`)
  and repeat-business surfacing - derived reads only, no duplicated facts.
- Relationship surface under `apps/web/src/pages/crm/`.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated map
  (`relationship-map.json` + `relationship-map.md` + `metadata-catalog.json`).
- Declare `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body.
- Update any service `*.spec.ts` whose Prisma create/update payload you change.

## Do NOT
- Do NOT rebuild Contact - extend it and link under Account.
- Do NOT copy transactional facts. Do NOT create a second identity record.
- Do NOT edit `/sot/`. Do NOT exceed the scope above.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> This slice is `escalates: false`: once CI is green it AUTO-MERGES — do not leave it unmerged, do not wait
> for approval, and do not ask permission after doing the work.

## Guardrails
- One attempt. Never exit silently - if this is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for a go/no-go. The go was given when this prompt was armed.
- Read the CI job log before diagnosing a failure. `pnpm build` and `pnpm lint` must pass.
- `escalates: false` — auto-merges on green (Marco authorised CRM-chain auto-merge 2026-08-14). Additive migration only.
