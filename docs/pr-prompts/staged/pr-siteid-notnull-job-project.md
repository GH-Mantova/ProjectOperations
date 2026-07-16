---
premise: '! ls apps/api/prisma/migrations | grep -qiE "site_id_not_null|siteid_notnull|siteid_backfill"'
premise_means: No migration enforcing siteId NOT NULL / backfilling site on Job or Project exists yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
done_when: pnpm build && pnpm lint
size: 4
gate_allow: migrations
seed_only: false
escalates: true
---

# Enforce siteId NOT NULL on Job + Project (Unassigned-site backfill first)

Marco's decision (2026-07-15): enforce NOT NULL on **Job and Project only**. (Tender is handled
separately in pr-tender-required-site; FormSubmission stays nullable at the DB level.)

## What to build (one migration, in this order)

1. Ensure an **"Unassigned"** Site exists -- create it if absent (stable known name/code so it is
   idempotent and reusable).
2. **Backfill** every Job.siteId and Project.siteId that is NULL to that Unassigned site.
3. In the SAME migration, set `site_id` **NOT NULL** on both tables, and make `Job.site` /
   `Project.site` required in schema.prisma.

Rows can be reassigned off "Unassigned" later; this only removes the null state.

## Do NOT

- Do NOT touch Tender or FormSubmission siteId here.
- Do NOT delete or merge any Site. Only create Unassigned if missing.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: true` (it changes PRODUCTION data): build it, open the PR, LEAVE IT UNMERGED
for Marco. Verify the backfill count on the dev DB and state it in the PR body.

## Guardrails

- One attempt. Never exit silently -- if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass. Follow Prisma migration-ordering rules (full timestamp folders).
