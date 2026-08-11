---
premise: '! test -f apps/api/src/modules/contracts/claim-draft-reminder.service.ts'
premise_means: There is no month-end reminder that tells the responsible role draft progress claims are ready to review.
scope:
  - apps/api/src/modules/contracts/claim-draft-reminder.service.ts
  - apps/api/src/modules/contracts/contracts.module.ts
  - apps/api/prisma/seed-reference.ts
  - apps/api/src/modules/contracts/__tests__/claim-draft-reminder.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/contracts/claim-draft-reminder.service.ts && grep -q "claim-draft-reminder" apps/api/src/modules/contracts/contracts.module.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Month-end reminder: draft progress claims ready to review

`apps/api/src/modules/contracts/contracts.service.ts` already runs a daily `@Cron` job
(`runClaimCutoffReminders`, `name: "claim-cutoff-reminders"`) that reminds the responsible user a
claim is **due** soon, via `NotificationsService.create()` (in-app) plus a fire-and-forget
`EmailService.sendNotificationEmail({ trigger, subject, html, text })` call (email respects
`NotificationTriggerConfig` — see the doc-comment on `EmailService.sendNotificationEmail` in
`apps/api/src/modules/email/email.service.ts`). Separately, `apps/api/prisma/seed-reference.ts`
(`seedNotificationTriggerConfigs`) seeds the admin-configurable catalogue of trigger keys (e.g.
`tender.submitted`, `compliance.expiry_reminder`) that Admin Settings lets Marco enable/disable and
assign recipients to.

There is currently no reminder that a **draft** pro-forma claim exists and is ready for someone to
review/edit/issue (the PC-1 slice on this same branch added the "Generate this month's claim" action
and its editor — this slice reminds the responsible role that drafts are waiting).

## What to build

1. **`apps/api/src/modules/contracts/claim-draft-reminder.service.ts` (new)** — a small
   `@Injectable()` service, mirroring the shape and pattern of `checkClaimCutoffs` in
   `contracts.service.ts`:
   - A single `@Cron(...)` method (e.g. run monthly around the last few days of the month — reuse
     the same UTC/AEST offset convention already used by `runClaimCutoffReminders`,
     `timeZone: "UTC"`), wrapped in try/catch that logs a warning on failure (never throws out of the
     cron).
   - Finds `ACTIVE` contracts (same `ContractStatus.ACTIVE` filter as `checkClaimCutoffs`) that do
     **not yet** have a `ProgressClaim` (pro-forma or otherwise) for the current `claimMonth`.
   - For each, creates an in-app `Notification` via `NotificationsService.create()` (inject
     `NotificationsService` from `PlatformModule`, already imported by `ContractsModule`) addressed to
     the same responsible-user resolution `checkClaimCutoffs` uses (`client.claimReminderUserId`,
     falling back to the seeded Accounts owner `user-supervisor-002`), and a fire-and-forget
     `EmailService.sendNotificationEmail({ trigger: "claim.draft_ready_for_review", ... })` when that
     user has an email — same shape as the existing cutoff-reminder call.
   - Export a method equivalent to `checkClaimCutoffs` (e.g. `checkDraftsReadyForReview(today: Date)`)
     that the cron method calls, so it is unit-testable with an injected date exactly like
     `checkClaimCutoffs`.

2. **`apps/api/src/modules/contracts/contracts.module.ts`** — add
   `ClaimDraftReminderService` to `providers` (it needs `PrismaService`, `NotificationsService`,
   `EmailService` — all already reachable the same way `ContractsService` reaches them via
   `PlatformModule`).

3. **`apps/api/prisma/seed-reference.ts`** — add one entry to the `triggers` array in
   `seedNotificationTriggerConfigs` for `claim.draft_ready_for_review` (label + description),
   following the exact shape of the existing entries (e.g. `compliance.expiry_reminder`). Seed it
   **disabled** by default (no `isEnabled: true`) so Marco opts in via Admin Settings, matching the
   `waste_line.rate_variance_escalated` precedent in the same file.

4. **`apps/api/src/modules/contracts/__tests__/claim-draft-reminder.service.spec.ts` (new)** — mock-
   Prisma unit test mirroring the existing `contracts.service.spec.ts` house pattern: assert a
   contract with no claim for the current month gets a notification + email, and a contract that
   already has a claim for the month does not.

## Do NOT

- Do not touch `apps/api/prisma/schema.prisma` or add a migration — `NotificationTriggerConfig`,
  `Notification`, and `ProgressClaim` already have every field this needs.
- Do not invent a new notification/email mechanism — reuse `NotificationsService.create()` and
  `EmailService.sendNotificationEmail()` exactly as `checkClaimCutoffs` does.
- Do not change the existing `claim-cutoff-reminders` cron or its schedule.
- Do not touch Azure/Entra/SharePoint or any module outside `contracts` and the seed file listed.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If something is genuinely impossible given the stated scope, do not exit silently —
  say `NO-OP: <reason>` and explain what blocked it.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
