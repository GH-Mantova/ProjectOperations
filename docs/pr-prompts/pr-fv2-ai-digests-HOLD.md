---
premise: "! test -f apps/api/src/modules/forms/form-digests.service.ts"
premise_means: There is no submission-digest / cross-submission trend-rule / re-inspection-scheduling service on main yet.
scope:
  - apps/api/src/modules/forms/form-digests.service.ts
  - apps/api/src/modules/forms/rules-engine.service.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
  - apps/api/src/modules/forms/forms.module.ts
  - apps/api/src/modules/forms/__tests__/form-digests.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/forms/form-digests.service.ts && grep -q "FormDigestsService" apps/api/src/modules/forms/form-digests.service.ts && grep -q "prisma.formSchedule.create" apps/api/src/modules/forms/form-digests.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Submission digests/trends + V2 cross-submission trend rules + re-inspection scheduling

**`FormSchedule`** (`apps/api/prisma/schema.prisma`, `model FormSchedule`) is fully built in
schema — `scheduleType`, `cronExpression`, `eventTrigger`, `assignToRole`/`assignToUserId`,
`isActive`, `lastRunAt`, `nextRunAt` — but has **zero runner and zero web references** today; it
is only read once, defensively, by `apps/api/src/modules/platform/my-day.service.ts`'s "due
today" query. No new column is needed to make it a real re-inspection target: creating a row with
`scheduleType` set to a one-off kind, `templateId` pointing at the same template, `nextRunAt` set
to "now + N days", and `assignToRole`/`assignToUserId` set to the site supervisor is sufficient —
confirmed against the current model, **this slice needs no schema change**. AI order 4 of 4
(LOCKED): periodic submission digests, shipping together with the V2 cross-submission trend rules
(`sot/06-active-specs.md` section 5.4 — "same hazard 3×/30 days/site" style rules, evaluated by a
scheduled job, not the fill path).

## What to build

1. **`apps/api/src/modules/forms/form-digests.service.ts`** (new) — `FormDigestsService`, a
   `@nestjs/schedule` `@Cron`-driven job (mirror the pattern already used in
   `apps/api/src/modules/compliance/compliance.service.ts` / `prequal.service.ts`):
   - Produces periodic digest summaries across recent `FormSubmission` rows (counts, flagged
     items, trend deltas) and sends them via the existing notification/email machinery
     (`NotificationsService` / `EmailService`) — no new persistence table for the digest content
     itself; compute-and-send.
   - Evaluates V2 trend-rule condition nodes (a `FormRule.definition` action/condition kind
     scoped to "cross-submission", e.g. "same answer N times in M days at this site") against
     submission history.
   - When a trend rule's action is "schedule a re-inspection" (mockup: "Mark outcome FAILED +
     schedule re-inspection" — 7 days, notify the site supervisor), create a `FormSchedule` row
     (`prisma.formSchedule.create`) instead of hand-rolling a second scheduling mechanism — this
     is `FormSchedule`'s first real consumer.
2. **`rules-engine.service.ts`** — add the trend-rule condition/action node types the digest job
   consumes (evaluation lives in the scheduled job, not the live/on-submit/on-approval fill path
   — do not wire trend conditions into `FormFillPage.tsx`'s live evaluator).
3. **`forms-engine.controller.ts`** — add a read endpoint for the latest digest summary (for a
   future web surface — this slice is backend-only, no new page required).
4. **`forms.module.ts`** — register the new service; confirm `ScheduleModule` is already globally
   available (it is — `compliance.service.ts` already uses `@Cron` without a local import beyond
   `@nestjs/schedule`).
5. Add `form-digests.service.spec.ts` covering: digest send happens, a trend rule firing creates
   exactly one `FormSchedule` row, and a trend rule never touches the live fill path.

## Do NOT

- Do not touch `apps/api/prisma/schema.prisma` — `FormSchedule` already has every column needed;
  this is a schema-free slice.
- Do not build a second scheduling/runner mechanism — route re-inspection scheduling through
  `FormSchedule`.
- Do not evaluate trend rules inside `FormFillPage.tsx`'s live evaluator or the on-submit path —
  scheduled-job only, per the LOCKED design.
- Do not touch Azure/Entra/SharePoint, the push engine, or output channels.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if genuinely nothing to do, say `NO-OP: <reason>` and stop.
- Never ask for or wait on approval.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before opening the PR.
