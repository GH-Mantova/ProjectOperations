---
premise: 'grep -q "Cannot rename facility from" apps/api/src/modules/map-locations/map-locations.service.ts'
premise_means: >-
  The TIP rename guard is still a string-join guard. MEASURED 2026-09-03 at origin/main 50662fdc -
  map-locations.service.ts:138-157 throws a 409 when a TIP's facility is renamed and
  prisma.estimateWasteRate.count() finds rows referencing the old string. Marco decided 2026-09-03
  (D3, option d) that the link becomes an id, at which point the name guard is the wrong instrument.
  This slice retires it and replaces it with an integrity check on the id. It is deliberately the
  LAST slice - the guard protects the legacy table that still prices every job.
requires_on_main:
  - scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH
  - docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO
  - docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED
scope:
  - apps/api/src/modules/map-locations/map-locations.service.ts
  - apps/api/src/modules/map-locations/__tests__/map-locations.service.spec.ts
  - scripts/rates/check-waste-map-location-ids.mjs
  - .github/workflows/ci.yml
  - package.json
done_when: >-
  ! grep -q "Cannot rename facility from" apps/api/src/modules/map-locations/map-locations.service.ts && git ls-files --error-unmatch scripts/rates/check-waste-map-location-ids.mjs && grep -q check-waste-map-location-ids .github/workflows/ci.yml && pnpm build && pnpm lint
size: 5
gate_allow: none
seed_only: false
escalates: true
---

# TIP-ID-S3: retire the name guard, and replace it with a check that the id resolves

**Grounded against `origin/main` = `50662fdc`, measured 2026-09-03.** Final slice of Marco's D3
ruling, option (d).

`escalates: true` — this removes a live safety check. Open the PR and leave it unmerged.

## 🔴 HARD STOP — ENFORCED BY THREE MACHINE GATES, NOT BY THIS PARAGRAPH

<!-- watcher: do-not-arm -->

**This prompt cannot be armed while the marker above is present.** `lint-prompt.mjs:728` matches it
and returns `HUMAN_GATE_PRESENT`, and it fires **before** the premise is evaluated, so no amount of
"the work still looks needed" gets past it. `arm-prompt.ps1` runs the lint and refuses on a non-zero
exit. **Removing that one line is itself a reviewable PR** — which is the point: the decision to make
this slice armable becomes a diff with a name on it, instead of a judgement call at 2am.

Underneath the marker, three `requires_on_main` gates encode the preconditions. They are checked
**even after arming** — `lint-prompt.mjs:808`, `ARMED_GATE_STILL_CHECKED`: *"a gate check gated on
filename would strip the moment the prompt could actually run, which is precisely when the gate
matters most."* So this is a runtime block, not a triage hint.

| Gate | Releases when | Why it is the right probe |
|---|---|---|
| `backfill-waste-map-location-ids.mjs :: NO MATCH` | TIP-ID-S2 has landed | the predecessor exists at all |
| `waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` | a **real** `--apply` run wrote a receipt with **zero** unmatched rows | the token is written only on `unmatched === 0`; a partial backfill writes `BACKFILL_UNMATCHED_NONZERO` and this gate stays shut |
| `STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED` | 11c has actually dropped the legacy table | 🔴 the condition that cannot be inferred from this repo any other way |

⚠️ **Why each gate names a token and not just a file.** The `STEP-*-DONE.md` convention has already
failed once in this project: a **one-line stub** was enough to arm a destructive successor, because
the gate checked existence rather than content. Every gate here carries a `::` needle, so an empty or
placeholder marker releases nothing.

🔴 **The third gate is the one that matters and the one that was prose until now.** Today production
prices from `legacy` — `RATES_CANONICAL_SOURCE` is set in no environment, so `app.config.ts:16`
resolves unset to `legacy`. While that holds, `EstimateWasteRate` is the table that prices every job
and this guard is protecting the thing that matters. **Removing it before the flip is option (c),
"drop the guard and hope", wearing option (d)'s clothes.** 11c is itself barred twice over — by this
decision, and because its own precondition (a full real pricing cycle on `ratetable`) has never been
met.

**Marco, when you are ready to release this slice:** delete the `<!-- watcher: do-not-arm -->` line
above in a PR. The three gates will still hold it until the receipt and the 11c marker are genuinely
on `main`. Both layers have to clear — a human intent, and a measured reality.

## Why the guard cannot simply be deleted early

`map-locations.service.ts:149` calls `this.prisma.estimateWasteRate.count(...)`. When 11c drops that
model the file **stops compiling**, so the guard cannot vanish silently — 11c is forced to touch it.
This slice exists so that the decision about what replaces it is made deliberately, with a test, and
not at 2am inside a slice about dropping tables.


## ⚠️ The module you are editing has no tests

[MEASURED 2026-09-03] `apps/api/src/modules/map-locations/` contains **no `__tests__` directory and
no spec file of any kind** — only the controller, module, service and the tip-recommendation pair.
So the rename guard that this whole D3 chain is about has **never had a test**, which is a large part
of why its behaviour had to be read out of the source this week rather than looked up. The spec path
in `scope` is therefore a **new file you create**, not one you edit.

🔴 **Consequence for this slice specifically:** the *renaming now succeeds* case you are asked to write is the
first test this module will ever have, and it is asserting the removal of a safety check. Write the
negative half first — a dangling id makes the checker exit non-zero — and prove it fails before you
make it pass.

## Do

1. **Delete the rename guard at `map-locations.service.ts:138-157`**, in full, including its comment.
   Do not rewrite it to count `RateRow`s — that is option (b), which keeps the string join and the
   fragility forever, and it is not what was decided.
2. **Create `scripts/rates/check-waste-map-location-ids.mjs`** — read-only, exit non-zero on failure.
   It asserts, over both waste rate tables: every row has a non-null `cells.mapLocationId`; every one
   of those resolves to a live `MapLocation`; and every resolved location has `kind = "TIP"`. Report
   every violation with the row id and the dangling value — a count alone cannot be acted on.
3. **Wire it into `ci.yml` as its own job**, and add a `rates:check-tip-ids` entry to the root
   `package.json`. 🔴 **Its own job, not a step folded into an existing one.** Folding a new assertion
   into `pr-gates.mjs` is the measured mistake that makes one cause show as two reds, one of which
   lies.
4. **Tests**: renaming a TIP's facility now **succeeds** where it previously threw 409, and the waste
   rows still resolve to the same location afterwards — that pair is the proof the failure mode is
   gone rather than merely unguarded. Add the negative: a row whose `mapLocationId` does not resolve
   makes the check exit non-zero.
5. **Update the `Claude Design` reference.** The Discipline Cards mock-up (`1c1d373e`) joins TIPs to
   facilities by name in `wKm()` via `tipByName(w.facility)`, so it now disagrees with the shipped
   model. Note it in the PR body for the design lane — **do not edit `Claude Design/` here**, it is
   gitignored and its own chain's business.

## Do NOT

- Do NOT arm or land this while production still prices from `legacy`. See the hard stop.
- Do NOT replace the guard with a `RateRow` count. That is option (b) and it was not chosen.
- Do NOT add a Prisma migration or a foreign key. **A foreign key cannot point into a JSON cell** —
  that constraint is the whole reason option (a) was refuted and option (d) chosen.
- Do NOT fold the new assertion into `pr-gates.mjs`.
- Do NOT touch `Claude Design/`, `.gitignore`, or `sot/`.

## Verify

- `grep -n "Cannot rename facility from" apps/api/src/modules/map-locations/map-locations.service.ts`
  returns nothing.
- `node scripts/rates/check-waste-map-location-ids.mjs` exits **0** on a correctly backfilled
  database, and **non-zero** with a named row after one id is deliberately corrupted. **Run both** —
  a checker that has never failed has not been tested.
- `pnpm --filter @project-ops/api test` passes, including the rename-now-succeeds case.
- The new CI job appears on the PR's own check list and passes.
- `pnpm build` and `pnpm lint` exit 0.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
