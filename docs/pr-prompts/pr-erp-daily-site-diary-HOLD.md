---
premise: '! grep -q "model DailyDiary" apps/api/prisma/schema.prisma'
premise_means: There is no daily site diary / daily log for jobs.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/projects/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model DailyDiary" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap A/commercial | daily site diary -->
# ERP gap — daily site diary / daily log

STATUS: DRAFTED, STAGED, arm-eligible. Highest value-to-effort gap from the competitor analysis
(`docs/architecture/drafts/erp-vs-competitors-gap-analysis.md`). The evidentiary spine for delay /
variation / dispute defence — Procore's most-copied module. New; nothing like it exists (`diary`=0).

## What to build
Branch: `feat/erp-daily-site-diary`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `DailyDiary` (jobId/projectId, siteId?, date, authorId, weather, temperature?, crew summary,
   plant on site, deliveries, visitors, delays/events, notes, submittedAt) + `DailyDiaryEntry` rows or a
   JSON block for line items; link photos via the existing form/attachment or documents pattern. One diary
   per job per day (unique).
2. API in `projects` — CRUD, list-by-job/date, guarded by the existing authority pattern; auto-populate
   crew/plant from that day's `Shift`/`ShiftWorkerAssignment`/`ShiftAssetAssignment` where possible.
3. Web — a Daily Diary tab on the job/project page: create/edit today, browse history, attach photos.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT build a full document-control system. Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
