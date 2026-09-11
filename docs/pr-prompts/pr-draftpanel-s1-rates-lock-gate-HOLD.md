---
premise: '! grep -q "rate-set" apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx'
premise_means: The Scope of Works tab does not read the tender's rate set, so discipline cards can be created and priced against rates that are still moving.
scope:
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardEmptyState.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/rates-gate.test.tsx
  - apps/web/src/pages/tendering/NewTenderWizard.tsx
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope/__tests__/scope-cards.service.spec.ts
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/tendering/__tests__/tendering-submit-locks-rates.spec.ts
done_when: pnpm build && grep -q "scope-cards-rates-gate" apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx && grep -q "Rates are not locked" apps/api/src/modules/tendering/scope-of-works.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
module: tendering
cluster: draftpanel
cluster_order: 1
design_ref: https://claude.ai/code/artifact/4b84db67-140c-41cc-a803-08851e77d246
---

# Rates lock is the gate on discipline cards

## Marco's rulings (Station 06 interview, 2026-09-11)

1. **Gate first.** Of the Draft Progress Panel mock-up, the rates-lock gate is the real ask; the
   completeness panel is S2 and chains behind this.
2. **On unlock, cards stay - read-only, with a banner.** Nothing is hidden. An unlocked tender
   never reprices live: the "live from Rates & Lists" state is retired.
3. **Tab only.** The wizard keeps Rates at step 5 and keeps it skippable. The gate lives where
   the cards live. The wizard's copy is corrected to say what actually happens.
4. **First SUBMITTED creates the snapshot if none exists.** Today it only stamps a date.

## What is true today [MEASURED on origin/main e6e11370]

- "Locked" is not a flag. It is whether a `TenderRateSet` row exists for the tender
  (`tenderId @unique`). `POST /tenders/:id/rate-set/lock` creates it and snapshots every
  resolved rate into `TenderRateEntry`; re-lock refreshes `originalValue` and keeps overrides.
  **`DELETE /tenders/:id/rate-set` deletes the row** and nulls `tender.ratesSnapshotAt`
  (`tender-rate-set.service.ts:138-160`). The Rates tab confirm dialog already says
  "the snapshot will be deleted and any overrides will be lost" (`RatesTab.tsx:111`).
- `tendering.service.ts:301-316` and `:1013-1026`: first SUBMITTED (or a win/loss with no prior
  submit) sets `ratesSnapshotAt = now` **and creates no snapshot**. A tender submitted without
  a manual lock keeps resolving from the live catalogue; `rate-resolver.service.ts:297-303`
  logs `snapshot-miss-fell-back-to-live` and carries on.
- `NewTenderWizard.tsx:1767` says "Not locked (will lock automatically on first status change)".
  Wrong on both counts: it is first SUBMITTED, and it is a date stamp, not a lock.
- Nothing under `apps/web/src/pages/tendering/scope-cards/` reads the rate set (grep for
  `rate-set`, `ratesLocked`, `lockedAt`, `ratesSnapshot`: zero hits).
- `ratesTabApi.getRateSet()` already exists and returns `null` when the tender has no set
  (`ratesTabApi.ts:16-19`). Reuse it; do not add an endpoint.
- Card creation is `ScopeOfWorksService.createCard` (spec at
  `scope/__tests__/scope-cards.service.spec.ts:155`).

## What to build

### Web - `ScopeCardsTab.tsx`

- On mount, fetch the rate set with `getRateSet(authFetch, tenderId)` alongside the existing
  loads. **Key the gate on the rate set being non-null - never on `tender.ratesSnapshotAt`**,
  which SUBMITTED stamps without a snapshot.
- **No rate set, no cards:** render the empty state in a new "rates required" variant
  (`ScopeCardEmptyState.tsx`) - heading *Lock rates before pricing*, one sentence saying why
  (rates would move under the estimate), and a primary **Lock rates** button that calls
  `lockRateSet` and re-fetches. The "New card" affordance is not rendered.
- **No rate set, cards exist** (the tender was unlocked after pricing): render the stack
  exactly as today inside a `<fieldset disabled>` so every input and button inside it is
  natively inert. `disabled` does not reach a `div` with an `onClick`, so the same wrapper
  also carries `aria-disabled="true"` and `pointer-events: none`; the test clicks a row
  action inside the stack and asserts no request is made. Hide the "New card" affordance,
  and show a banner above the stack:
  *Rates are unlocked - these cards are read-only until rates are locked again*, with the
  same **Lock rates** button. Money still displays; nothing is recomputed.
- Wrap the gate's root in `data-testid="scope-cards-rates-gate"` with
  `data-state="locked" | "unlocked-empty" | "unlocked-readonly"`. S2 chains on this string.
- Locking from the tab re-fetches the rate set and the cards, and the gate clears without a
  page reload.

### Web - `NewTenderWizard.tsx:1767`

Replace the string with the truth: *Not locked - lock on the Rates tab before pricing scope*.
Do not touch step order, `visited`, `skipped` or the rail. Do not touch `:989` (that copy is
S2's).

### API - `ScopeOfWorksService.createCard`

Refuse with `ConflictException("Rates are not locked for this tender.")` when no
`TenderRateSet` exists for the tender. One `findUnique` on `tenderId` before the create. Add
the spec: creating a card on a tender with no rate set throws; with one, it behaves as before.

### API - `TenderingService` status transitions

Both places that set `ratesSnapshotAt` on first SUBMITTED (`:303`, `:309`, `:316` in the bulk
path and `:1013`, `:1019`, `:1026` in the single path) instead call
`TenderRateSetService.lock(tenderId, actorId)` when the tender has no rate set. `lock()`
already stamps `ratesSnapshotAt` and writes the `tenders.rate-set.lock` audit row, so remove
the bare date stamp rather than doubling it. Inject `TenderRateSetService`; it is provided by
the same module (`tendering.module.ts`). New spec
`tendering-submit-locks-rates.spec.ts`: SUBMITTED with no set calls `lock` once; SUBMITTED
with an existing set does not; a second SUBMITTED never re-locks.

## Do NOT

- Do NOT hide cards. Ruling 2 - read-only with a banner, never absent.
- Do NOT change the wizard step order, make Rates unskippable, or seed `visited`. Ruling 3.
- Do NOT build the completeness panel, the Resume button, or the deep-link. That is S2.
- Do NOT key anything on `ratesSnapshotAt`. It is set without a snapshot today and this slice
  is what makes it honest going forward; the gate reads the rate set.
- Do NOT guard item, waste, cutting or operational-cost mutations server-side in this slice.
  The card-create refusal is the one server guard here; the rest are UI-inert via the
  fieldset and get their own guard slice. Say so in the PR body.
- Do NOT touch `sot/**`, `schema.prisma` or migrations. Nothing here needs a column.
- Do NOT add an unlock affordance to the Scope of Works tab. Unlocking stays on the Rates tab
  behind its existing confirm.

## Known consequence - say it in the PR body

Every tender that has cards and no rate set becomes read-only on Scope of Works the moment
this merges, until someone presses Lock rates. That is the intended behaviour, not a
regression; the banner tells them what to do. How many such tenders exist cannot be measured
from the pipeline (no production read path) - name that in the PR body rather than guessing.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- scope-cards.service tendering-submit-locks-rates
pnpm --filter @project-ops/web test -- rates-gate
pnpm build
grep -n "scope-cards-rates-gate" apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
grep -n "first status change" apps/web/src/pages/tendering/NewTenderWizard.tsx   # must be empty
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the
  absence of a human, not a stop signal. Proceed on best judgement and record the assumption in
  the PR body.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Head of the `draftpanel` cluster; S2 waits on
`ScopeCardsTab.tsx :: scope-cards-rates-gate`.
