---
premise: '! grep -q "no-history" apps/web/src/pages/crm/accountLinkPreview.helpers.ts'
premise_means: >-
  AccountLinkPreview proposes a lifecycle for every client from three cached Client counters, and
  cannot tell "PROSPECT because the history says so" from "PROSPECT because the counters are zero".
  On the dev database all 27 active clients carry tender_count=0, win_count=0, last_tender_at=NULL
  while tender_clients holds 201 links across 13 clients, 93 of them awarded. The screen therefore
  recommends Prospect for clients with real awarded work, against accounts stored Active.
scope:
  - apps/web/src/pages/crm/accountLinkPreview.helpers.ts
  - apps/web/src/pages/crm/AccountLinkPreview.tsx
  - apps/web/src/pages/crm/__tests__/**
done_when: >-
  pnpm lint && grep -q "no-history" apps/web/src/pages/crm/accountLinkPreview.helpers.ts
size: 3
gate_allow: none
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  UI-only. Changes what the preview screen displays and which rows it will commit. Writes nothing
  itself and no schema changes; revert the commit to restore the previous proposal behaviour.
requires_merged: 1412
requires_on_main: apps/web/src/pages/crm/accountLinkPreview.helpers.ts :: buildCommitAction
---

# S4: do not present an unmeasured default as a derived recommendation

## The defect

`proposeLifecycle` reads three cached `Client` columns:

```ts
if (row.lastTenderAt !== null) { ...if (months > 24) return "PAST"; }
if (row.wonCount > 0) return "ACTIVE";
return "PROSPECT";
```

With all three counters at their zero values the function returns `PROSPECT`, and the screen shows
that in the "proposed lifecycle" column beside a rule it states as fact — *won a tender -> Active;
tendered but never won, or never tendered -> Prospect*. A reviewer reads "Prospect" as a finding.
For a client whose counters were never populated it is the absence of a finding.

Measured on the dev database, 2026-08-31:

```
active clients                                        27
  ...with tender_count > 0                             0
  ...with win_count > 0                                0
  ...with last_tender_at set                           0
tender_clients rows                                  201   across 13 distinct clients
  ...is_awarded = true                                93
accounts, stored lifecycle                    ACTIVE | 27
proposal the screen would show              PROSPECT | 27
rows where proposal differs from stored               27
```

Every account is stored ACTIVE; the screen proposes PROSPECT for all of them; and thirteen of those
clients have awarded tender links that the proposal never saw. The header bulk-set control makes
accepting all 27 a two-click action.

## Why the counters are empty, and what is already being done about it

`ClientStatsService` maintains `tenderCount`, `winCount` and `lastTenderAt` **forward only** — every
increment routes through it as a tender is first counted or flipped to won. Nothing has ever restated
them from history, so any tender predating that path is invisible to them.

That half is already written and armable: **`pr-crm-wincount-s3-recompute-HOLD.md`** (`ADMIT`,
size 3, `cluster: crm-wincount`, `cluster_order: 3`, `requires_merged: 1350`) exists to add
`scripts/crm/recompute-client-stats.mjs` and restate the counters from the tender graph. Its own
premise says the same thing from the other side: *"No script exists to restate the cached client
counters from the tender graph, so every historical over-count and under-count stays on the record."*

**This prompt does not duplicate that work and must not attempt it.** The two are complementary:
the recompute makes the counters true; this change stops the screen speaking with confidence it has
not earned, which matters whether or not the recompute has run and continues to matter for any client
onboarded after it.

## Do

1. **Give the proposal a basis.** Have `proposeLifecycle` (or a sibling) return the lifecycle *and* a
   discriminant naming why: `"won"`, `"stale"`, `"tendered-no-win"`, and — for a row where
   `tenderCount === 0 && wonCount === 0 && lastTenderAt === null` — the literal `"no-history"`.
   `no-history` is the string the premise and `done_when` grep for.

2. **Show it.** A `no-history` row displays **"No history"** in the proposal column, not "Prospect",
   with the per-row select still available and unset. Add a count tile so the total is visible up
   front alongside the existing three.

3. **Keep it out of bulk-set.** The header bulk-set control must not assign a lifecycle to
   `no-history` rows. Provide a separate, clearly labelled control for them if the reviewer wants to
   sweep them deliberately — the point is that it takes its own decision, not that it is impossible.

4. **Unlinked `no-history` rows still create.** A client with no account and no history must still
   get one, as `PROSPECT`, exactly as the S3 backfill does. Creating the row is not the problem;
   presenting `PROSPECT` as a derived recommendation is. The create path is unchanged.

5. **Linked `no-history` rows stay skip.** Already true after `3a8fe008` — an already-linked row with
   `override === null` returns `{ kind: "skip" }`. Do not weaken that; add a test that pins it for
   the `no-history` case specifically.

## Do NOT

- Do **not** write, add or call a counter recompute, backfill or aggregation here. That is
  `pr-crm-wincount-s3-recompute`'s scope and it is deliberately sequenced after the leaks are fixed.
- Do **not** aggregate from `tender_clients` at query time in `listClientLinkPreview`. Its contract
  is explicit — *"All numeric values come from the Client cached columns — no aggregation at query
  time"* — and changing that is a performance decision nobody has taken.
- Do **not** touch the API, the schema, or any migration. This is a UI-truthfulness change.
- Do **not** change `ambiguousCount`. It is a hardcoded `0` justified by `Account.clientId @unique`;
  that is a separate question and a separate prompt.
- Do **not** derive a lifecycle from `TenderOutcome` or `TenderClient.isAwarded`. `wincount-s3`
  already records why both are wrong sources: outcome capture is optional and skippable by Marco's
  2026-08-10 decision, and `isAwarded` is current state rather than history.

## Verification

Extend `apps/web/src/pages/crm/__tests__/`:

- **basis: no-history** — zero counters and null `lastTenderAt` -> basis `"no-history"`; the row
  renders "No history" and no lifecycle is preselected.
- **basis: won** — `wonCount > 0`, recent -> `ACTIVE`, basis `"won"`. Unchanged behaviour.
- **basis: stale** — `lastTenderAt` older than 24 mean-months -> `PAST`, basis `"stale"`, and the
  24-month precedence over `won` still holds.
- **basis: tendered-no-win** — `tenderCount > 0`, `wonCount === 0` -> `PROSPECT`, and it is
  distinguishable from `no-history` in the returned basis. This is the pair the whole prompt exists
  for; assert they are not equal.
- **bulk-set** — a bulk-set leaves every `no-history` row's `override` null, while setting the
  others; a row with an existing manual override still survives it (the CRM-S4 test 6 guarantee).
- **commit** — a board of only untouched `no-history` linked rows produces zero write actions.
- **create still works** — an unlinked `no-history` row yields `{ kind: "create" }` with
  `lifecycleStatus: "PROSPECT"`.

Run a negative control and record it in the PR body: with the `no-history` branch removed, the
`tendered-no-win` vs `no-history` test must fail. A test that passes both ways is not a test.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
