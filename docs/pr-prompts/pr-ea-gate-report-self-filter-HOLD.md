---
premise: '! grep -q "reporting.team" apps/api/src/common/permissions/permission-registry.ts'
premise_means: >-
  There is no permission distinguishing "may see the team's numbers" from "may see only my own".
  The only reporting code is reporting.view. Consequently the self-filter on the estimating
  reports is keyed off the isSuperUser identity flag, which is wrong in both directions at once,
  and the one report that names individuals applies no filter at all.
scope:
  - apps/api/src/common/permissions/permission-registry.ts
  - apps/api/src/modules/reporting/report-self-filter.ts
  - apps/api/src/modules/reporting/report-self-filter.spec.ts
  - apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts
  - apps/api/src/modules/reporting/reporting.service.ts
done_when: >-
  pnpm build && pnpm lint && grep -q "reporting.team"
  apps/api/src/common/permissions/permission-registry.ts && grep -q "resolveSelfFilter"
  apps/api/src/modules/reporting/reporting.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: reporting
cluster: estimating-analytics-v2
cluster_order: 1
---

# EA-GATE — key the report self-filter to a permission, not to `isSuperUser`

> **CONSUMED — and AMENDED 2026-09-09 after the PR it produced was rejected.**
>
> This prompt was armed and produced **PR #1823**, which the watcher routed
> **REJECT-AND-REDO** for a defect this prompt *caused*: §4 as originally written
> demanded a production-required role grant delivered **only** through the TS seed,
> while the "Do NOT" list forbade a migration. Production runs
> `prisma migrate deploy` and never the TS seed, so the code would have shipped
> and the grant would not — every estimating manager silently dropping to
> self-view, the exact failure this slice exists to fix, re-introduced from the
> other side.
>
> §1, §4, §5 and the "Do NOT" list are **corrected below**. What actually shipped
> in #1823 (`5fa45ce8`) is the corrected §4: a `TEAM_VISIBILITY_CODES` list that
> also accepts `tenders.allocate`, and **no change to `seed.ts` at all**.
>
> This prompt is **not re-armable** — its `premise` (`! grep -q "reporting.team"
> permission-registry.ts`) is false once #1823 merges, so `lint-prompt.mjs` returns
> SPENT. The amendment exists so a future reader, or any slice re-derived from this
> text, does not repeat the mistake. Retirement to `superseded/` is Station 05's
> board-PR lane, not this file's business.
>
> The reusable lesson — *a prompt declaring `seed_only: false` while forbidding a
> migration is unsatisfiable under CP-23, and `lint-prompt.mjs` cannot detect it* —
> is filed at
> `docs/pr-prompts/needs-marco/prompt-declared-seed-only-false-while-forbidding-a-migration-2026-09-09.md`
> with a proposed linter rule for Marco to rule on.

**Prerequisite for `pr-ea-s2a-dashboard-preset-seed` and `pr-ea-s2b-dashboard-filter-surface`.**
Merge this first. EA-2a is what puts these numbers on one screen people will actually open; the
gate should be right before that happens.

Authored 2026-09-08 after Marco reviewed and approved the EA-2 mock-up,
`https://claude.ai/code/artifact/10c03a71-0346-4a9e-8b07-7974fd191544`. This slice, EA-2a and
EA-2b together **supersede
`pr-ea-s2-dashboard-preset-HOLD.md`**, which should be retired to `superseded/` in a board PR once
all three land. Do not delete it.

## The defect, measured on origin/main

`apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts:130`:

```ts
function selfFilterClause(params: ReportRunParams): { assignedEstimatorId?: string } {
  if (params.currentUser && !params.currentUser.isSuperUser) {
    return { assignedEstimatorId: params.currentUser.sub };
  }
  return {};
}
```

The gate is keyed off an **identity flag**, not a permission. That one choice makes it wrong in
both directions:

- **Over-restrictive.** Every non-super-user is self-filtered — including an estimating manager,
  who is the intended audience of these reports and who cannot see her own team.
- **Under-restrictive.** `grep -c currentUser tender-winloss-report.definitions.ts` returns **0**,
  and `tender-win-rate` (`reporting.service.ts:203`, *"Tender win rate by estimator"*) builds its
  `where` with no user clause at all. It buckets by estimator name and returns every individual's
  win rate to anyone holding `reporting.view`.

`selfFilterClause` has exactly two call sites, both in the EA-1 file (`:130`, `:155`).

**This exposure is live today on `/reports`**, independent of any dashboard. `tender-win-rate` is
in `REPORT_DEFS` and `listDefinitions` is gated only on `reporting.view`. The dashboard does not
open the hole; it puts it on a screen people will open.

## What to build

### 1. One new permission code

Add to `apps/api/src/common/permissions/permission-registry.ts`, in the `reporting` module block
beside `reporting.view`:

```ts
{ code: "reporting.team", module: "reporting", label: "View other people's numbers in reports",
  description: "See the team-wide rollup in estimating and win-rate reports. Without this code a user sees only tenders assigned to them." },
```

**No migration is needed _for the permission row itself_.** The registry header (`:2`) records
that each entry is upserted into the `permissions` table by the seed and re-synced on API startup,
and `:150-152` records that the Admin role receives every code automatically via the
all-permissions grant in `seed-reference.ts`. `gate_allow: none` is correct.

> **CORRECTION 2026-09-09.** As originally written this paragraph said "No migration is needed"
> flatly, and §4 then leaned on it to justify a seed-only **role grant**. That inference is wrong.
> The startup re-sync covers the `permissions` **registry row** — the definition of the code. It
> does **not** cover `rolePermission` links, which are ordinary seed data. Production runs
> `prisma migrate deploy` and never the TS seed, so a seed-only `rolePermission.createMany` reaches
> dev and CI and **never production**. Keep the two claims apart: the code's *existence* rides the
> startup sync; any *grant* of it does not.

### 2. One shared helper — `apps/api/src/modules/reporting/report-self-filter.ts` (new)

```ts
export function resolveSelfFilter(params: ReportRunParams): { assignedEstimatorId?: string }
```

Rule, in this order:

1. No `currentUser` (internal call, seed, test) → `{}`. Same as today.
2. `currentUser.isSuperUser` → `{}`.
3. `currentUser.permissions` includes **any** code in `TEAM_VISIBILITY_CODES` → `{}`.
4. Otherwise → `{ assignedEstimatorId: currentUser.sub }`.

where, **CORRECTED 2026-09-09** (step 3 originally read `includes "reporting.team"` alone):

```ts
export const TEAM_VISIBILITY_CODES = ["reporting.team", "tenders.allocate"] as const;
```

`tenders.allocate` is in that list so the first deploy is correct with **no data migration at
all** — see the corrected §4. `reporting.team` stays as the explicit forward-looking code.

`AuthenticatedUser` already carries `permissions: string[]`, and `currentUser` is already threaded
into every report's `run()` (`reporting.service.ts:50`, set by the controller at `:73` and on the
export path at `:88-94`). **No new plumbing.** Do not add a param, a service or a decorator.

### 3. Apply it to the reports that name a person

- `estimating-analytics-report.definitions.ts` — delete the local `selfFilterClause` and call
  `resolveSelfFilter` from `loadEstimatingTenders` (`:155`). Behaviour changes for exactly one
  class of user: a non-super-user holding `reporting.team` now sees the rollup.
- `reporting.service.ts` `tender-win-rate` (`:203`) — spread `resolveSelfFilter(params)` into its
  `where` (`:221`). This is the actual exposure fix.

**Leave the five `tender-winloss-*` definitions alone.** Correction to an earlier claim of mine,
made after reading them: they are aggregate — by client, by value band, by reason, over time,
coverage — and name no individual. Filtering them would be a business decision about whether an
estimator may see company-level win rates, not a privacy fix, and it is not this slice's to make.
Say so in the PR body and leave it for Marco.

### 4. Keep existing managers visible — WITHOUT touching `apps/api/prisma/seed.ts`

> **THIS SECTION WAS REWRITTEN 2026-09-09.** It is the section that caused #1823's rejection.
> The original text is preserved verbatim at the bottom of this section so the mistake stays
> legible; do not follow it.

The requirement is real: **nobody may lose access on deploy.** Without something, only Admin holds
the new code (via the all-permissions grant) and every estimating manager silently drops to
self-view — the exact failure this slice exists to fix, re-introduced from the other side.

The requirement is satisfied **in code, not in data**. `tenders.allocate` is the existing
manager-shaped permission — *"Allocate tenders to estimators; view and manage the estimator
capacity board"* (`permission-registry.ts:65`). It already exists in production and is already held
by exactly the roles this slice means. Putting it in `TEAM_VISIBILITY_CODES` (§2) makes the first
deploy correct with **no grant, no seed change and no migration**.

So:

- Do **not** modify `apps/api/prisma/seed.ts`. It must stay byte-identical to `origin/main`.
- Do **not** add anything under `apps/api/prisma/` at all. With no seed file touched, CP-23 reports
  `PASS ... [no seed files changed]` — the gate has no trigger rather than a suppressed one.
- State in the `permission-registry.ts` comment beside `reporting.team` that **no role is granted
  this code by this PR**, and why. A comment claiming the seed grants it would be false.

A later, separate PR may grant `reporting.team` to allocate-holding roles via a **real idempotent
migration**. When it lands nothing in §2 needs to change and no user's visibility moves — that is
the point of keying off a list.

<details>
<summary>Original §4, superseded — DO NOT FOLLOW (kept so the defect stays legible)</summary>

> ### 4. Grant it to existing managers — `apps/api/prisma/seed.ts`
>
> Follow the `rolePermission.createMany({ skipDuplicates: true, ... })` pattern at `:364`. Grant
> `reporting.team` to every role that already holds **`tenders.allocate`** — the existing
> manager-shaped code, *"Allocate tenders to estimators; view and manage the estimator capacity
> board"* (`permission-registry.ts:65`). Derive the role set by querying for that code; do not
> hardcode role names.
>
> Rationale to state in the PR body: it means **nobody loses access on deploy**. Without a grant,
> only Admin holds the new code and every estimating manager silently drops to self-view — the exact
> failure this slice exists to fix, re-introduced from the other side.

**Why it was unsatisfiable.** This asked for a *production-required* `rolePermission` insert
delivered *only* through the TS seed, while the "Do NOT" list forbade a migration. CP-23 offers
exactly two exits and this prompt closed both:

1. **add a migration alongside the seed change** — forbidden by the "Do NOT" list;
2. **put `SEED-ONLY: dev` in the PR body** — a declaration that *production does not need this
   data*, which is false here: §4's whole rationale was "nobody loses access **on deploy**".

`seed_only: false` in the front matter was the *correct* declaration (this was never dev-only),
which is precisely what made §4 impossible to satisfy as written.

</details>

### 5. Test — `report-self-filter.spec.ts` (new, co-located)

Match the idiom of `estimating-analytics-report.definitions.spec.ts` (co-located `.spec.ts`, not a
`__tests__` directory). Cover all four branches of the rule, and both regressions by name:

- no `currentUser` → `{}`
- super-user → `{}`
- holds `reporting.team` → `{}` — **this is the manager regression**; it must fail if the helper
  reverts to testing `isSuperUser`
- holds only `reporting.view` → `{ assignedEstimatorId: sub }`
- a `tender-win-rate` case asserting the clause reaches its `where` — **this is the exposure
  regression**; it must fail if the spread is removed
- **ADDED 2026-09-09** — holds `tenders.allocate` but **not** `reporting.team` → `{}` — this is the
  **delivery-mechanism guard**. It must fail if anyone narrows the helper back to `reporting.team`
  alone without first landing a real migration granting that code. Plus a loop over
  `TEAM_VISIBILITY_CODES` asserting each member is independently sufficient, so adding a code to the
  list cannot silently go untested.

> Note for whoever writes this: `SelfFilterParams.currentUser` is a
> `Pick<AuthenticatedUser, "sub" | "isSuperUser" | "permissions">`. An **inline** object literal
> carrying `email` fails TS2353 excess-property checking even though the named helper functions
> returning a full `AuthenticatedUser` are fine. Cost one CI-avoiding local jest run in #1823.

## Do NOT

- Do NOT widen `reporting.view` to mean "see the team". It is the only reporting code there is;
  overloading it would make the gate undeniable to an estimator who legitimately needs `/reports`.
- Do NOT add a `@RequirePermissions("reporting.team")` decorator anywhere. This is a row filter,
  not an endpoint gate — a decorator would lock estimators out of the reports entirely, and
  `permission-registry-coverage.guard.spec.ts` would then bind you to a contract you do not want.
- Do NOT filter the five `tender-winloss-*` definitions (see §3).
- **CORRECTED 2026-09-09** — Do NOT add a migration, touch `schema.prisma`, or regenerate the
  data-model map. This is still right, but only because the corrected §4 needs **no data change at
  all**. It is NOT a licence to deliver a production-required data change through the TS seed
  instead. The original pairing of this line with the original §4 is what made the prompt
  unsatisfiable. **If a future slice genuinely needs a row in production, it needs a migration, and
  this line must be lifted for it — not worked around.**
- **ADDED 2026-09-09** — Do NOT modify `apps/api/prisma/seed.ts`, and do NOT add a
  `SEED-ONLY: dev` line to the PR body. That marker asserts production does not need the data;
  asserting it here would be false, and passing a gate by telling it something untrue is worse than
  the failure it hides.
- Do NOT change `/reports` (`apps/web/src/pages/reports/ReportsPage.tsx`) — the fix is server-side
  and reaches both surfaces at once.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside `scope`.

## Why this is Marco's to merge

`escalates: true`, deliberately. This changes who can see whose performance numbers — that belongs
to a human.

> **CORRECTED 2026-09-09.** This section originally read "...and it seeds a role grant that runs on
> deploy." That was false twice over: the seed does not run on deploy, and after the §4 correction
> there is no role grant at all. The `escalates: true` still stands on the visibility change alone.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting". There is no human in this run. Finishing the work and then asking for
permission is indistinguishable from failing.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>`. Read the CI job log before diagnosing
any failure. `pnpm build` and `pnpm lint` must both pass.
