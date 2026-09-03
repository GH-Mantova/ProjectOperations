---
premise: '! git ls-files --error-unmatch scripts/rates/backfill-waste-map-location-ids.mjs'
premise_means: >-
  Nothing writes a MapLocation id onto a waste rate row. TIP-ID-S1 added the mapLocationId cell and a
  resolver that prefers it, but ships every row null, so the link is expressible and empty. MEASURED
  2026-09-03 - the seed defines exactly EIGHT distinct facility strings (Alex Fraser, BMI Acacia
  Ridge, BMI Stapylton, BMI Hendra, Rowcon (Bells Creek), Cleanaway, Moreton Bay Recycling, Sunshine
  Coast Council) and Marco measured all eight matching a TIP exactly by name through the production
  code path, the Rates badge on Settings Map locations rendering from map-locations.service.ts:82.
  MapLocation is seeded nowhere, so this can only run against a real database.
requires_on_main: apps/api/src/modules/rates/waste-facility.ts :: resolveWasteFacility
scope:
  - scripts/rates/backfill-waste-map-location-ids.mjs
  - apps/api/src/modules/map-locations/map-locations.service.ts
  - apps/api/src/modules/map-locations/__tests__/map-locations.service.spec.ts
  - package.json
done_when: >-
  git ls-files --error-unmatch scripts/rates/backfill-waste-map-location-ids.mjs && grep -q backfill-waste-map-location-ids package.json && pnpm build && pnpm lint
size: 4
gate_allow: none
seed_only: false
escalates: true
---

# TIP-ID-S2: write the ids — a guarded backfill, and the admin screen keeps them current

**Grounded against `origin/main` = `50662fdc`, measured 2026-09-03.** Second slice of Marco's D3
ruling, option (d).

`escalates: true` — **this writes production data.** Open the PR and leave it unmerged.

## What this slice is actually for

S1 made the link expressible; every waste row currently carries `mapLocationId: null`. This slice
fills it in, in the only two ways it can be filled: a **one-off backfill** for rows that already
exist, and the **admin screen** so it stays true for rows created later. Without the second half the
backfill is a one-time tidy that rots the first time someone adds a facility.


## ⚠️ The module you are editing has no tests

[MEASURED 2026-09-03] `apps/api/src/modules/map-locations/` contains **no `__tests__` directory and
no spec file of any kind** — only the controller, module, service and the tip-recommendation pair.
So the rename guard that this whole D3 chain is about has **never had a test**, which is a large part
of why its behaviour had to be read out of the source this week rather than looked up. The spec path
in `scope` is therefore a **new file you create**, not one you edit.

## Do

1. **`scripts/rates/backfill-waste-map-location-ids.mjs` — dry-run by default.**
   - Read every row of the `waste-per-tonne` and `waste-per-m3` rate tables.
   - For each, match `cells.facility` against `MapLocation` where `kind = "TIP"`, on the **exact,
     trimmed** facility string. **No fuzzy matching.** The measurement is 8 of 8 exact; if a row
     does not match exactly, that is news and must be reported, not guessed at.
   - Print a table: row id · facility · matched MapLocation id or `NO MATCH` · would-write.
   - **`--apply` writes; without it nothing is written.** Follow the existing convention in
     `scripts/crm/recompute-client-stats.mjs`, which is dry-run by default and snapshot-guarded.
   - **Refuse to `--apply` if any row has no match**, unless `--allow-partial` is passed. A partial
     backfill leaves a mixed population that S3's integrity check cannot distinguish from a
     regression.
   - **Refuse to overwrite a non-null `mapLocationId` that differs**, unless `--force`. A second run
     must be a no-op, not a re-decision.
   - Print a JSON summary line at the end — `{ examined, matched, unmatched, written }` — so S3's
     precondition can be evidenced by pasting output rather than by assertion.
   - 🔴 **Report any facility string with NO TIP.** The residual unknown in the D3 register is exactly
     this: such a row renders nowhere on the Map locations screen, so the UI cannot rule it out. This
     script is the first instrument that can. Name them in the output.
2. **Add a `rates:backfill-tip-ids` script entry** to the root `package.json`, beside the existing
   `rates:fallback-audit` and `rates:parity-proof` entries.
3. **`map-locations.service.ts` — keep the link current.** When a TIP's `facility` is set or changed
   through the admin path, write that MapLocation's id into the matching waste rows' cells in the
   same transaction. **The rename guard at `:138-157` stays exactly as it is** — it still protects
   the legacy table, which is what prices jobs today.
4. **Tests** in `map-locations.service.spec.ts`: setting a TIP's facility writes the id onto matching
   waste rows; changing it while rates exist still throws the 409 (the guard is untouched); a
   non-TIP location writes nothing.

## Do NOT

- Do NOT run the backfill against production as part of this PR. The script ships; **Marco runs it**,
  reads the dry run, and then decides on `--apply`.
- Do NOT fuzzy-match, normalise case, or strip punctuation when matching facility to TIP. Exact and
  trimmed. A near-miss is a finding.
- Do NOT delete, weaken or "move" the rename guard. That is TIP-ID-S3, and it is bound to 11c.
- Do NOT add a Prisma migration. The id lives in the JSON cell.
- Do NOT touch `EstimateWasteRate` rows. This slice writes only to `RateRow.cells`.
- Do NOT touch `sot/`.

## Verify

- `node scripts/rates/backfill-waste-map-location-ids.mjs` with no flags writes **nothing** — prove it
  by re-reading a row's `cells.mapLocationId` after the run and showing it unchanged.
- On a scratch database seeded and then given TIP locations for all eight facilities: dry run reports
  `matched: 8, unmatched: 0`; `--apply` writes 8; a second `--apply` reports 0 written.
- With one TIP deliberately renamed so a row cannot match: the run reports it under `NO MATCH` and
  **refuses to apply** without `--allow-partial`.
- `pnpm --filter @project-ops/api test` passes with the three new cases.
- `pnpm build` and `pnpm lint` exit 0.
- **Paste the dry-run summary line into the PR body.** TIP-ID-S3's precondition is that every row
  resolves, and this output is the evidence for it.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
