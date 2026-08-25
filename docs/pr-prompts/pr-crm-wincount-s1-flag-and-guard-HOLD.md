---
premise: '! grep -q "tenderWinCounted" apps/api/prisma/schema.prisma'
premise_means: Nothing records that a tender has already had its win counted, so the ordinary AWARDED to CONTRACT_ISSUED to CONVERTED lifecycle increments win_count once per transition against a single tender_count.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/master-data/__tests__/client-stats.concurrency.spec.ts
  - docs/data-model
done_when: pnpm lint && pnpm --filter api test -- client-stats && node scripts/data-model/build-relationship-map.mjs --check && grep -q "tenderWinCounted" apps/api/prisma/schema.prisma
size: 7
gate_allow: migrations
rollback_strategy: 'Additive only — one boolean column with a default. Safe to leave applied on main; the guard reads it defensively so code landing before or after the migration behaves identically. Re-running drops nothing.'
backfill: false
seed_only: false
escalates: true
cluster: crm-wincount
cluster_order: 1
---

# A won tender is counted as a win once per status transition

## The defect, measured — and it is the ordinary path, not an edge case

`tendering.service.ts:1043-1048`:

```ts
} else if (isWon && existing.tenderScoreCounted) {
  // Tender was previously submitted/lost (tenderCount incremented) and
  // is now being won — bump winCount without double-counting tenderCount.
  await this.clientStats.recordTenderOutcome(id, { isWin: true, mode: "win-flip" });
}
```

`isWon` is true for `AWARDED`, `CONTRACT_ISSUED` **and** `CONVERTED` (line 1035). The branch is
guarded only on `isWon && tenderScoreCounted` — **nothing records that a win has already been
counted.** So the normal lifecycle `AWARDED -> CONTRACT_ISSUED -> CONVERTED` takes this branch on
every transition after the first: `win_count += 1` three times against `tender_count += 1` once.

The same shape exists in `bulkUpdateStatus` at `tendering.service.ts:326-336`.

This is currently asserted as *intended* in
`apps/api/src/modules/master-data/__tests__/client-stats.concurrency.spec.ts:104-108`:

```ts
expect(client.tenderCount).toBe(2);
expect(client.winCount).toBe(3);
// winRate = round(3 * 100 / 2, 2) = 150.00 - kept even though > 100 since
```

That assertion encodes the defect. It is updated in this slice, with a comment saying why.

## What to build

### 1. `apps/api/prisma/schema.prisma` — one column on `Tender`

Mirror the existing `tenderScoreCounted` exactly in style:

```prisma
tenderWinCounted   Boolean  @default(false) @map("tender_win_counted")
```

Additive. Defaulted. Every existing row reads `false`, which is the correct starting state — the
correction of historical values is a later slice and is deliberately not attempted here.

### 2. The migration

`ADD COLUMN` with the default. Nothing else. No data transformation of any kind.

**Your PR body MUST contain this as a bare line at column 0:**

```
GATE-ALLOW: migrations
```

Not `## GATE-ALLOW: migrations`, and not with a trailing period — neither matches CP-11's regex, and
ten PRs have failed on exactly that.

### 3. Regenerate the data-model map — required, and CI hard-fails without it

Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
`docs/data-model/relationship-map.json`, `relationship-map.md` and `metadata-catalog.json`. The
data-model drift check (`--check`) fails a schema change that leaves the map stale; it sank #593.
The agent exits before CI runs, so this must be done up front, not fixed forward.

### 4. Guard the flip — `tendering.service.ts`

In **both** `updateStatus` (line 1032-1048) and `bulkUpdateStatus` (line 326-336):

- take the win branch only when `isWon && tenderScoreCounted && !tenderWinCounted`
- when it is taken, set `tenderWinCounted: true` in the same way `tenderScoreCounted` is already set
  at lines 1040-1043 and 319
- the `first-count` branch, when it fires with `isWon` true, must also set `tenderWinCounted: true` —
  otherwise a tender that goes straight to `AWARDED` gets its win counted, then counted again on the
  next transition

Read the flag defensively (`existing.tenderWinCounted === true`) so the code behaves identically
whether it lands before or after the migration is applied.

### 5. Update the spec that encodes the defect

Rewrite the `winCount` expectation in `client-stats.concurrency.spec.ts` to the corrected value and
replace the `// kept even though > 100` comment with one sentence explaining that a win is now
counted once per tender. Add a case walking `AWARDED -> CONTRACT_ISSUED -> CONVERTED` and asserting
`winCount` increments exactly once.

## Do NOT

- Do NOT change, recompute or correct any existing stored counter value. This slice stops the
  bleeding; a later slice in this cluster owns the correction.
- Do NOT touch `jobs.service.ts` or `projects.service.ts` — the six paths that bypass scoring belong
  to slice 2.
- Do NOT change the SQL in `client-stats.service.ts:54-67`.
- Do NOT touch the web app.

## Guardrails

- One attempt. If `tenderWinCounted` already exists, say `NO-OP: <reason>`.
- `pnpm lint`, the API tests, and `build-relationship-map.mjs --check` must all pass.
- **`escalates: true`** — this changes a data shape. Open the PR and leave it unmerged.
- Never exit silently. Never ask a question or stand by for approval — there is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

