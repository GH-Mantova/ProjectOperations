---
premise: '! grep -q "CRM_COLD_V3" apps/api/src/modules/crm/accounts/accounts.service.ts'
premise_means: >-
  Every one of the 175 accounts in the live system reads GOING COLD, and the Accounts tile reads
  "Going cold 175" out of 175. That is not a defect in the code - it is CRM_COLD_V2 working as
  written: NULL_IS_COLD is true, no contact has ever been logged, so every account has
  lastContactedAt = null and every account is cold. A number that is always the total is a number
  nobody reads. Marco ruled on 2026-09-04 that never-contacted becomes its own state and cold goes
  back to meaning "was warm, went quiet".
scope:
  - apps/api/src/modules/crm/accounts/accounts.service.ts
  - apps/api/src/modules/crm/relationships/relationships.service.ts
  - apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts
  - apps/api/src/modules/crm/relationships/__tests__/relationships.service.spec.ts
  - apps/web/src/pages/crm/crm-cold.ts
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/RelationshipsPage.tsx
  - apps/web/src/pages/crm/__tests__/AccountsListPage.test.ts
  - apps/web/src/pages/crm/__tests__/crm-uifix-s1.test.ts
  - apps/web/src/pages/crm/__tests__/crmui-accounts-list-s1.test.ts
  - apps/web/src/pages/crm/__tests__/crmui-accounts-list-s2.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_COLD_V3" apps/api/src/modules/crm/accounts/accounts.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-accounts-list
cluster_order: 2
requires_merged: 1609
rollback_strategy: >-
  One pure function, its two mirrors, one read-only Prisma WHERE clause, and the two places the
  result is rendered. No schema, no migration, no write path, no route, no new dependency. The
  summary DTO gains a field and keeps the one it had, so no consumer breaks either way. Revert and
  every account reads GOING COLD again, exactly as it does today.
---

# "Going cold" counts 175 of 175, so it tells nobody anything

Second slice of the Accounts-list cluster; SLICE 1 shipped as #1609. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` ("CRM Module Mock-up")

Measured 2026-09-04 against `origin/main`, and confirmed against the deployed screen: the tile row
reads `Accounts 175 | Open opportunities 0 | Going cold 175 | Unlinked clients 0`, every row's
Last-contact cell is blank, and every row carries the orange GOING COLD chip.

**Establish first that this is not a bug, and say so in the PR body.** `CRM_COLD_V2.NULL_IS_COLD`
is `true` with the comment "never-contacted is the coldest state in the system, not the warmest"
(`accounts.service.ts:81-104`, mirrored at `crm-cold.ts:23`). No contact has ever been logged, so
`lastContactedAt` is `null` for all 175 and the rule fires for all 175. The instrument is honest;
the definition is the thing being changed here.

**Marco's ruling, 2026-09-04:** never-contacted becomes its own state. Cold means *was warm, went
quiet*. A never-contacted account is not a relationship going cold - it is a relationship that has
not started, which is a different job for the estimator and belongs in a different number.

## What to build

**1. Retire `NULL_IS_COLD` and replace the boolean with a state, in one place.**

In `accounts.service.ts`, replace the `CRM_COLD_V2` constant and `deriveGoingCold` with:

    export const CRM_COLD_V3 = {
      THRESHOLD_DAYS: 60 as number
    } as const;

    export type ContactState = "PAST" | "NEVER_CONTACTED" | "COLD" | "IN_CONTACT";

    export function deriveContactState(
      lifecycle: string,
      lastContactedAt: Date | null,
      nowMs: number = Date.now()
    ): ContactState

with exactly these rules, in this order:

    lifecycle === "PAST"                        -> "PAST"
    lastContactedAt === null                    -> "NEVER_CONTACTED"
    older than CRM_COLD_V3.THRESHOLD_DAYS       -> "COLD"
    otherwise                                   -> "IN_CONTACT"

`THRESHOLD_DAYS` stays 60 and the strict `>` boundary stays exactly as it is: an account contacted
exactly 60 days ago is still `IN_CONTACT`, at 60 days plus one millisecond it is `COLD`. The
optional injected `nowMs` clock stays, and stays third, for the reason the current doc comment
gives - do not remove it.

Keep `deriveGoingCold(lifecycle, lastContactedAt, nowMs)` as a one-line wrapper returning
`deriveContactState(...) === "COLD"`, so callers that only want the boolean do not re-derive the
rule. It now returns `false` for a `null` date. That change of meaning is the whole slice; say so
in the PR body.

`NULL_IS_COLD` must not survive anywhere: grep the tree for it and report zero. `CRM_COLD_V2` must
not survive either - it is renamed, not duplicated. **Do not leave a compatibility alias.** Two
names for one contract is precisely the divergence `CRM_COLD_V2` was created to end (a 14-day tile
above a 30-day list); re-creating it here would be the same defect wearing a newer number.

**2. Mirror it in the web copy, and only there.**

`crm-cold.ts` is the web mirror and exists standalone to stay off the circular-import path between
`AccountsListPage` and `RelationshipsPage` (its header says why). Mirror `CRM_COLD_V3` and
`ContactState` there and update the header comment: the mirrored Marco decision is now the
2026-09-04 one, not the `NULL_IS_COLD` half of the 2026-09-01 one. The 60-day default and its
"user-selectable at the Relationships tab" note are unchanged and still Marco's.

`AccountsListPage.tsx` re-exports the constant at `:16` for its own suite; keep that re-export
working under the new name. Its local `computeGoingCold` mirror (`:44-69`) becomes a local
`computeContactState` with the identical four rules.

`RelationshipsPage.tsx` uses the constant only to seed `GOING_COLD_DEFAULT_THRESHOLD` (`:15`).
That is a one-token rename. **Do not otherwise touch that page** - its panels are a different
cluster.

**3. Carry the state on the summary row, without dropping the boolean.**

`AccountSummary` (`accounts.service.ts:48`) gains `contactState: ContactState` and **keeps**
`goingCold: boolean`. `listAccountSummaries` (`:628`) sets both from one `deriveContactState` call.
Mirror the added field on `AccountSummaryRow` in `AccountsListPage.tsx:29`. This is additive to a
read-only SELECT's mapped output - no new database field is read, no write path, no DTO route
change.

**4. Two numbers on the tile, not two tiles.**

The mock-up's tile row is four tiles and it shipped correctly in #1609. Do not add a fifth. The
`Going cold` tile keeps its slot and its accent, and changes what it counts:

- value = rows whose `contactState === "COLD"` - on today's data, `0`.
- sub-line = `no contact in {THRESHOLD_DAYS} days`, and, **only when the never-contacted count is
  above zero**, a second clause after a middle dot: `· {n} never contacted`.

Read `THRESHOLD_DAYS` from the constant. Do not write `60` anywhere in the diff.

The accent (the tile's attention colour) follows the cold count, not the never-contacted count. An
account nobody has contacted yet is a backlog, not an alarm.

**5. A second chip, deliberately quieter than the first.**

The Last-contact cell (`AccountsListPage.tsx:938-960`) renders the orange GOING COLD chip under the
relative date. Keep it exactly as it is for `COLD`. For `NEVER_CONTACTED`, render a chip in the
same position reading `Never contacted`, in the page's existing muted grey - the same grey already
used for the em-dash placeholder in the Owner cell at `:930`. It must not reuse the orange
`#fff7ed / #fed7aa / #ea580c` set, and it must not introduce a new colour literal that is not
already in this file. `PAST` and `IN_CONTACT` render no chip, as today.

Give the new chip an `aria-label` of `Never contacted`, matching how the cold chip is labelled.

**6. Make the Going-cold list agree with the tile.**

`relationships.service.ts:175` `getGoingColdAccounts` ORs `{ lastContactedAt: null }` into both its
account filter (`:185`) and its contact sub-select (`:199`). Left alone, the tab below would list
all 175 while the tile above reads 0 - the exact tile-versus-tab split that CRM_COLD_V2 was written
to close. Remove the two `{ lastContactedAt: null }` branches so both `OR`s collapse to the single
`{ lastContactedAt: { lt: cutoff } }` condition. Cold means went quiet on both surfaces.

`coldSince`, the `take: 50`, the `orderBy`, the `thresholdDays` echo and the endpoint's
`?thresholdDays=` contract are all unchanged.

## Do NOT

- **Do not change the 60-day threshold**, its strict `>` boundary, or the `[30, 60, 90]` selector
  on the Relationships tab. Only the null rule is in play.
- **Do not add a never-contacted list, route, tab or panel.** The count on the tile is this slice.
  A dedicated list is a follow-up and needs its own mock-up reading.
- **Do not touch any write path.** No POST, PATCH or DELETE may be added, changed or re-pointed.
- Do not touch the column sequence, the filter row, Export, or anything else #1609 landed.
- Do not touch `AccountDetailPage.tsx` or any other CRM page - separate clusters.
- Do not add a schema field, a migration, a DTO or a dependency.
- Do not touch `/sot/`, or any file outside `scope:`.

## Known and deliberately out of scope

`relationships.service.ts:102` stamps `Contact.lastContactedAt` **only** when the caller supplies a
`contactId`, and the Log-contact modal on the Accounts list has no contact picker, so per-contact
freshness never updates from that screen. The account-level figure still moves, because
`listAccountSummaries` takes `max(contact.lastContactedAt, latestNote.createdAt)` (`:606-615`), so
logging a note does un-cold an account. Do not fix the picker here - it is the relationships
cluster's, and this slice must not touch a write path.

## Verification

- [ ] `pnpm --filter @project-ops/api test` and `pnpm --filter @project-ops/web test` green. State
      the counts.
- [ ] Paste the four `deriveContactState` rules as implemented, in order.
- [ ] Assert and state all four boundary cases against a FIXED injected `nowMs`: `PAST` + any date,
      `null`, exactly 60 days, 60 days + 1 ms. Name the state returned for each.
- [ ] State that `deriveGoingCold(x, null)` returned `true` before and returns `false` after, and
      that this is the ruling, not a regression.
- [ ] `grep -rn "NULL_IS_COLD\|CRM_COLD_V2" apps/ --include=*.ts --include=*.tsx` - paste the
      output. It must be empty.
- [ ] Paste the `Going cold` tile as rendered for a seeded set with some cold, some never-contacted
      and some in-contact rows: label, value and full sub-line. Then paste it for a set with zero
      never-contacted rows and show the second clause is absent.
- [ ] Paste both chips as rendered, with their `aria-label`s, and state that the never-contacted
      chip introduces no colour literal that was not already in the file.
- [ ] Show the `getGoingColdAccounts` WHERE diff. It must remove exactly two
      `{ lastContactedAt: null }` branches and change nothing else.
- [ ] `grep` the diff for the literal `60` and report zero.
- [ ] State that `AccountSummary` still carries `goingCold` and now also carries `contactState`,
      and that no route, DTO, schema field or write path changed.
- [ ] `git diff --name-only` lists only files in `scope:`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
