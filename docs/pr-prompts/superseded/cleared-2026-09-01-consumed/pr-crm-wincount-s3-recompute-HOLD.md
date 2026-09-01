---
premise: '! test -f scripts/crm/recompute-client-stats.mjs'
premise_means: No script exists to restate the cached client counters from the tender graph, so every historical over-count and under-count stays on the record even after the two causes are fixed.
scope:
  - scripts/crm/recompute-client-stats.mjs
  - scripts/crm/__tests__/recompute-client-stats.spec.mjs
done_when: pnpm lint && node scripts/crm/recompute-client-stats.mjs --help && test -f scripts/crm/__tests__/recompute-client-stats.spec.mjs
size: 3
gate_allow: none
seed_only: false
escalates: true
cluster: crm-wincount
cluster_order: 3
requires_merged: 1350
---

# Restate the cached client counters from the tender graph

Slices 1 and 2 stopped the two causes. This slice corrects what they already produced. It runs
**last, deliberately** — recomputing while the system still leaks is a snapshot of a moving target.

## What can be restated, and what cannot

The counters do not depend on `TenderOutcome` and **must not** be derived from it: outcome capture is
optional and skippable by Marco's 2026-08-10 decision (`tendering.service.ts:1015-1018`), so a tender
can be closed WON with zero outcome rows. Nor from `TenderClient.isAwarded` — that is current state,
actively reset by `jobs.service.ts:1064` and `:1644-1646`.

Two set-once columns on `Tender` carry what is needed, and no code path anywhere clears either:
`tender_score_counted` and `won_at`.

```
tender_count = COUNT(tender_clients tc JOIN tenders t ON t.id = tc.tender_id
                     WHERE tc.client_id = :c AND t.tender_score_counted = true)
win_count    = COUNT(same join WHERE t.won_at IS NOT NULL
                     OR t.status IN ('AWARDED','CONTRACT_ISSUED','CONVERTED'))
win_rate     = ROUND(win_count * 100.0 / NULLIF(tender_count, 0), 2)
```

The `status IN (...)` disjunct is what recovers the tenders that took the six bypass paths. By
construction `win_count <= tender_count` and `win_rate <= 100`, so the impossible percentage cannot
recur.

**Three things are genuinely unrecoverable, and the script must say so in its own output rather than
pretend otherwise:**

1. Which clients were linked to a tender at the moment it was scored. `tendering.service.ts:1205`
   removes and recreates the whole link set on every tender edit.
2. Hard-deleted tenders. `tendering.service.ts:656` deletes the row and nothing ever decrements, so
   those increments are baked into today's numbers and simply disappear.
3. The sequence itself. There is no event log for these columns.

Numbers will therefore move in both directions and no per-client explanation exists. That is the
known price, and the snapshot below is what makes it reversible.

## What to build

`scripts/crm/recompute-client-stats.mjs`.

- **`--snapshot <path>` writes a CSV of `client_id, name, tender_count, win_count, win_rate` for
  every client, and runs before anything else. It is the undo.** Refuse to run `--apply` at all
  unless a snapshot path was given and the file was written successfully.
- **`--dry-run` is the default.** No flags means no writes. It prints per client: before, after, and
  the delta; then a summary of how many rows would change, how many move up, how many move down.
- `--apply` performs the restatement, in batches, inside a transaction per batch.
- `--help` documents all of it, including the three unrecoverable cases above in plain words, so
  whoever runs it a year from now understands what they are agreeing to.

### Tests — `scripts/crm/__tests__/recompute-client-stats.spec.mjs`

Against a mocked Prisma client, not a live database:

- a client with 3 linked scored tenders, 1 won, yields `3 / 1 / 33.33`
- a client whose cached values are already correct yields a zero delta and no write
- a client with an inflated `win_count` (the historical flip) is brought down, and one reached only
  through a bypass path is brought up
- `tender_count = 0` yields `win_rate = 0`, never a division error
- default and `--dry-run` perform zero writes
- `--apply` without a successful snapshot refuses and exits non-zero
- running twice changes nothing the second time

## Do NOT

- Do NOT execute this against any live database. Produce the script, its output format and its tests.
  **Marco runs it.**
- Do NOT derive anything from `TenderOutcome` or from `TenderClient.isAwarded`, for the reasons above.
- Do NOT modify any `Tender`, `TenderClient` or `Account` row. The only writes are the three cached
  columns on `clients`.
- Do NOT change `client-stats.service.ts`, `tendering.service.ts`, `jobs.service.ts` or
  `projects.service.ts` — slices 1 and 2 own those.
- Do NOT add a Prisma migration.

## Guardrails

- One attempt. If `scripts/crm/recompute-client-stats.mjs` already exists, say `NO-OP: <reason>`.
- `pnpm lint` must pass and the new spec must pass.
- **`escalates: true`** — this rewrites production values when Marco runs it. Open the PR and leave
  it unmerged.
- Never exit silently. Never ask a question or stand by for approval — there is no human in this run.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

