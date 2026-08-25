---
premise: '! test -f scripts/crm/backfill-accounts.mjs'
premise_means: No script exists to create an Account for every Client that appears in tender_clients, so nine accounts stand against a register of hundreds of tenders and most clients are invisible to the entire CRM.
scope:
  - scripts/crm/backfill-accounts.mjs
  - scripts/crm/__tests__/backfill-accounts.spec.mjs
done_when: pnpm lint && node scripts/crm/backfill-accounts.mjs --dry-run --help && test -f scripts/crm/__tests__/backfill-accounts.spec.mjs
size: 3
gate_allow: none
seed_only: false
escalates: true
---

# Most clients have no Account, so the CRM cannot see them

## The defect, measured

`Account` is a thin CRM wrapper over `Client` — `schema.prisma:7556`, `clientId String? @unique`.
It is only ever created by hand or, for inbound leads, by `lead-intake.service.ts:277`. There is no
create-account form in the web app at all (`POST /crm/accounts` exists at
`accounts.controller.ts:120` and nothing calls it). The result: nine `Account` rows against a
register of hundreds of tenders. Every client nobody typed in twice is invisible to the whole CRM.

## What to build

`scripts/crm/backfill-accounts.mjs` — an **idempotent script**, deliberately NOT a migration. It
inserts rows; it must never update or delete one.

### Behaviour

For each distinct `client_id` in `tender_clients` that has no `Account`:

```
Account {
  clientId,
  lifecycleStatus: <derived, see below>,
  accountType:     CLIENT,
  source:          OTHER,
  ownerId:         null,
  notes:           null
}
```

**`lifecycleStatus` is the field that matters and the only one worth being careful about.** It is
indexed (`schema.prisma:7583`), it filters the accounts list (`accounts.service.ts:112`), it drives
the going-cold rule (`accounts.service.ts:59-67` — a `PAST` account can never be flagged), and it
feeds the CRM dashboard buckets (`pipeline-dashboard.service.ts:334-336`). Derive it:

- **`ACTIVE`** — the client has a `TenderClient` row on a tender whose `updatedAt` is within the last
  **12 months**.
- **`PAST`** — the client has `TenderClient` rows, but none within 12 months.
- **`PROSPECT`** — the client has none. (In practice this set is empty, since the source is
  `tender_clients` itself; handle it rather than assume.)

Expose the 12-month window as a named constant at the top of the file with a comment saying it is a
judgement call, not a measurement, so the next reader can change it without archaeology.

**`accountType: CLIENT` and `source: OTHER` are deliberate.** Both are cosmetic — traced across the
whole repo, neither appears in any Prisma `where:` clause, any index, any chart, any aggregate, or
any branch; each is rendered as a label in one or two places and nothing else. `CLIENT` matches what
`lead-intake.service.ts:277` already produces, which keeps one uniform population rather than two
made by different rules. Do not try to infer a smarter value.

### `--dry-run` is the default

Running the script with no flags **must not write.** It prints, per client: name, derived
lifecycle, and the reason for that derivation; then a summary of `would create / already exists /
would fail`. Writing requires an explicit `--apply` flag. `--help` documents both.

### Tests — `scripts/crm/__tests__/backfill-accounts.spec.mjs`

Against a mocked Prisma client, not a live database:

- derivation returns `ACTIVE` / `PAST` / `PROSPECT` for the three input shapes, including a tender
  updated exactly at the window boundary
- a client that already has an `Account` is skipped, and no write is attempted for it
- `--dry-run` (and no-flag) performs zero writes
- running twice over the same input produces zero writes the second time

## Do NOT

- Do NOT write a Prisma migration. This is a script, run deliberately, not schema change.
- Do NOT modify, update or delete any existing `Account`, `Client` or `TenderClient` row. Insert only.
- Do NOT execute the script against any live database. Produce the script, the dry-run output format
  and the tests. **Marco runs it.**
- Do NOT set `ownerId`, or guess `notes`. A wrong guess there is a human's afternoon to unpick.
- Do NOT touch `accounts.service.ts`, `accounts.controller.ts`, or any web page.

## Guardrails

- One attempt. If `scripts/crm/backfill-accounts.mjs` already exists, say `NO-OP: <reason>`.
- `pnpm lint` must pass and the new spec must pass.
- **`escalates: true`** — this writes production data when Marco runs it. Open the PR and leave it
  unmerged.
- Never exit silently. Never ask a question or stand by for approval — there is no human in this run.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

