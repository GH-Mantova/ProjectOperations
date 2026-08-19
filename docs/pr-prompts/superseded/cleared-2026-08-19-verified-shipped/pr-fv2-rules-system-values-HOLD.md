---
premise: "! test -f apps/api/src/modules/forms/system-context-resolver.service.ts"
premise_means: The fill-time system-context snapshot resolver (asset readings, competencies, site attributes, weather, timesheet hours, filler's role) does not exist on main yet.
scope:
  - apps/api/src/modules/forms/system-context-resolver.service.ts
  - apps/api/src/modules/forms/rules-engine.service.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/api/src/modules/forms/forms.module.ts
  - apps/api/src/modules/forms/__tests__/rules-engine.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/forms/system-context-resolver.service.ts && grep -q "SystemContextResolverService" apps/api/src/modules/forms/system-context-resolver.service.ts && grep -q "system-context" apps/api/src/modules/forms/forms-engine.controller.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# Rules engine — system-value conditions, alerts, approval-chain mutation, and push/deadline actions

`apps/api/src/modules/forms/rules-engine.service.ts` already evaluates form-value conditions
(the 11 operators an earlier slice landed) and `FormRule.definition` already carries a
condition/action grammar tree (an earlier slice extended `FormRule`, schema `model FormRule`
currently at `apps/api/prisma/schema.prisma`). What is still missing is everything that reads
data *outside* the submission: asset last-recorded readings, worker competency/licence expiry
(`WorkerCompetency.expiresAt`), site attributes, live weather, 7-day timesheet hours, and the
filler's role — plus the actions that fire off other subsystems: alert a person/role (in-app +
email, with answer tokens templated into the message), mutate the `FormApproval` chain the
existing chain-creator builds (`forms-engine.service.ts`, around the `requiresApproval` /
approval-chain-creation logic), route through the same push executor an earlier push-engine
slice built, and start a WorkSafe-clock deadline task in the compliance module
(`apps/api/src/modules/compliance/compliance.service.ts`, which already uses `@Cron` and owns
alerting).

## What to build

1. **`apps/api/src/modules/forms/system-context-resolver.service.ts`** (new) — one
   `SystemContextResolverService` with a single batched method, e.g.
   `resolveContext(templateId, actorId, siteId?)`, that returns one snapshot object covering:
   asset last-recorded readings for pickable assets (read `Asset.current*Reading` /
   `AssetUsageReading`, read-only), the caller's `WorkerCompetency` expiries, site attributes,
   weather for the site (reuse the site-weather service the widgets-batch-3 program introduces —
   locate it under the platform/dashboards modules; if it is not yet on `main`, stub the weather
   key to `null` and leave a `// TODO: wire site-weather service once it lands` comment rather
   than building a second fetcher), and aggregate 7-day `Timesheet` hours for the caller. This is
   the "one batched endpoint call, not N" snapshot section 5.3 of the design describes.
2. **`forms-engine.controller.ts`** — add a `GET` endpoint (e.g.
   `forms-engine/templates/:templateId/system-context`) that calls the new resolver and returns
   the snapshot for the fill page to cache at form-open.
3. **`rules-engine.service.ts`** — extend condition evaluation to accept system-value condition
   nodes (asset reading / competency / site attribute / weather / timesheet hours / role) sourced
   from the snapshot (or freshly resolved server-side at submit — the server must NOT trust a
   stale client snapshot for BLOCK decisions); extend action execution to add: alert (in-app via
   the existing `NotificationsService` + email via `EmailService`), approval-chain modification,
   a push-action passthrough into the existing push executor, and a deadline-task action that
   calls into `ComplianceService` (or a narrow new public method on it if none exists yet — do
   not reach into its Prisma models directly).
4. **`forms-engine.service.ts`** — wire the on-submit/on-approval rule pass to call the new
   action handlers where a `FormRule.definition` action node requires them.
5. **`forms.module.ts`** — register `SystemContextResolverService` and import whatever module
   exports `NotificationsService` / `EmailService` / `ComplianceService` if not already imported.
6. Update `rules-engine.service.spec.ts` fixtures/expectations for the new condition and action
   branches.

## Do NOT

- Do not touch `apps/api/prisma/schema.prisma` or add a migration — this slice is schema-free.
- Do not touch Azure/Entra/SharePoint config or the SharePoint adapter.
- Do not build the site-weather service yourself if it isn't on `main` yet — stub and leave a
  TODO; do not build a second weather fetcher.
- Do not let live (in-fill) system-value evaluation hit the API on every keystroke — evaluate
  against the cached snapshot client-side; only the server re-resolves fresh data at submit.
- Do not have the binding/action executor write directly into another module's Prisma tables —
  always call the owning module's service method.

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
