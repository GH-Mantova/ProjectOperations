---
premise: 'grep -qF "Math.round(val * 100)" apps/web/src/pages/crm/AccountsListPage.tsx'
premise_means: The accounts list still multiplies the stored win rate by 100 a second time, so the column renders an arithmetically impossible percentage.
scope:
  - apps/web/src/pages/crm/formatWinRate.ts
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/AccountDetailPage.tsx
  - apps/web/src/pages/crm/__tests__/formatWinRate.spec.ts
done_when: pnpm lint && pnpm --filter web test -- formatWinRate && ! grep -qF "Math.round(val * 100)" apps/web/src/pages/crm/AccountsListPage.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
cluster: crm-defects
cluster_order: 1
---

# The CRM win rate renders an impossible percentage

## The defect, measured

`clients.win_rate` is **stored as a percentage already**. `client-stats.service.ts:62` computes it in
SQL as `((win_count + delta)::numeric * 100) / (tender_count + delta)` and rounds to 2 places. The API
does no arithmetic on it at all — `accounts.service.ts:370-378` coerces the Prisma `Decimal` to a
number and passes it straight through.

Both web pages then multiply by 100 **again**:

```
apps/web/src/pages/crm/AccountsListPage.tsx:78
  return `${Math.round(val * 100)}%`;

apps/web/src/pages/crm/AccountDetailPage.tsx:134
  return Number.isFinite(num) ? `${(num * 100).toFixed(0)}%` : "—";
```

A stored `50.00` renders `5000%`. A stored `300.00` renders `30000%`. Marco has screenshots of both.

Note the two pages disagree on the wire type and **both are correct for their own endpoint**:
`GET /crm/accounts/summary` coerces server-side and sends a `number`; `GET /crm/accounts/:id/360`
spreads the account through untouched so the Prisma `Decimal` serialises as a **string**. Do not
"fix" that divergence by forcing one type — handle both in the shared helper.

## What to build

### `apps/web/src/pages/crm/formatWinRate.ts` — one helper, one behaviour

```ts
export function formatWinRate(val: number | string | null | undefined): string
```

- `null` / `undefined` / non-finite → `"—"` (em dash, matching the existing empty convention).
- Accepts a `number` (summary route) or a `string` (360 route). Parse with `Number(...)`; reject `NaN`.
- **Do NOT multiply by 100.** The value arriving is already a percentage.
- Render **one decimal place**: `23.5%`. A rounded whole number hides the difference between `0.4%`
  and `0%`, which on a win rate is the difference that matters.
- Values above 100 are possible today and are a separate defect being fixed in its own slice. Clamp
  the **displayed** figure at `100.0%` and append a marker — render `100.0%+` — so the page never
  shows an impossible number while the underlying data is still being corrected elsewhere. **Do not
  change, clamp, or write any stored value.**

### Use it in both pages

Replace the local `fmtPct` in `AccountsListPage.tsx` (line 76-79, used at line 297) and in
`AccountDetailPage.tsx` (line 131-135, used at line 359) with `formatWinRate`. Delete both local
helpers — leaving one behind is how the two pages diverged in the first place.

### While you are in `AccountDetailPage.tsx` — one line, same file

The page style object sets `fontFamily: "sans-serif"` on its page wrapper, which overrides the app's
`Outfit` across the entire page and is most of why the CRM looks like a different application.
**Delete that one property.** Change nothing else about the styling.

### Tests — `apps/web/src/pages/crm/__tests__/formatWinRate.spec.ts`

Cover: `null`, `undefined`, `0`, `23.5`, `"23.50"`, `100`, `150`, `NaN`, `"abc"`.
Assert `23.5` → `"23.5%"` and `150` → `"100.0%+"` and `null` → `"—"`.

## Do NOT

- Do NOT touch `apps/api/src/modules/master-data/client-stats.service.ts`. Two other consumers read
  `win_rate` correctly as a percentage — `client-quotes.service.ts:661` and
  `client-stats.concurrency.spec.ts:86` — and changing its unit breaks them.
- Do NOT recompute, migrate or write any stored value. This slice is display only.
- Do NOT change any API response shape.
- Do NOT restyle either page beyond deleting the single `fontFamily` property named above.

## Guardrails

- One attempt. If `formatWinRate.ts` already exists, say `NO-OP: <reason>`.
- `pnpm lint` must pass and the new spec must pass.
- Never exit silently. Never ask a question or stand by for approval — there is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

