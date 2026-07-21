---
premise: '! test -f scripts/data-model/siteid-null-audit.mjs'
premise_means: Nobody has measured how many FormSubmission rows lack a siteId or how many are derivable.
scope:
  - scripts/data-model/**
done_when: pnpm build && pnpm lint && test -f scripts/data-model/siteid-null-audit.mjs
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# siteId: audit FormSubmission nulls before any NOT NULL flip

STATUS: ARMED - RUN NOW. Read-only measurement, no schema change. Build it now.

## Why this exists

`pr-siteid-notnull-backfill` was written believing Tender / Job / Project / FormSubmission all had
a nullable `siteId`. Verified against origin/main 285e779: **Tender, Job and Project are ALREADY
NOT NULL** (#642 / #646 did that). The models still nullable are `AssetCheckout`, `FormSubmission`,
`FormPublicLink` and `DailyDiary` - three of which arguably SHOULD stay optional (a checkout, a
public link and a diary entry can legitimately have no site).

Marco's call (2026-07-20): narrow the intent to **FormSubmission only**. But flipping a column to
NOT NULL fails outright if existing rows hold nulls, and the backfill rule is a data decision. So
this PR only MEASURES. The flip is a separate, later PR gated on this evidence.

**READ-ONLY. Do not alter the schema, do not write a migration, do not update any row.**

## What to build

Branch: `chore/siteid-null-audit`. Reviewer: `GH-Mantova`. **No migration.**

1. `scripts/data-model/siteid-null-audit.mjs` reporting, for `FormSubmission`:
   - total rows, rows with `siteId` NULL,
   - of the NULL rows, how many are **derivable** (the submission's job/project has a `siteId`),
   - how many are **not derivable** by any route - these are the ones that need a human rule.
2. Same three counts for `AssetCheckout`, `FormPublicLink` and `DailyDiary`, reported separately
   and clearly marked **informational** - they are NOT in scope for a NOT NULL flip.
3. Write `docs/data-model/siteid-null-audit-<stamp>.md` and print the headline counts.
4. Exit 0 always - this is a report, not a gate. Say so in the script header.

## Do NOT
- Do NOT change `schema.prisma`. Do NOT create a migration. Do NOT backfill or write anything.
- Do NOT propose a default site - if rows are not derivable, that is exactly the finding to report
  to Marco. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". Finishing the work then asking permission is indistinguishable from
> failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge - open the PR and leave it for Marco.
