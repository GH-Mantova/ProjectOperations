---
premise: '! ls apps/api/prisma/migrations | grep -q "drop_legacy_plant_days"'
premise_means: >-
  The five legacy plant-days columns are still on scope_of_works_items. Slice 1 stopped the server
  reading them; this slice removes them from the database. Irreversible.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && ! grep -q "hookTruckDays" apps/api/prisma/schema.prisma
size: 4
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
cluster: legacy-plant-days
cluster_order: 2
requires_on_main: 'apps/api/src/modules/tendering/scope-of-works.service.ts :: PLANT_DAYS_RETIRED_V1'
rollback_strategy: >-
  NONE. This is a DESTRUCTIVE, IRREVERSIBLE migration - five columns and every value in them are
  gone permanently and a git revert does not bring the data back. That is why it is a separate slice
  from the code retirement, why it carries a soak, and why it must not be armed without Marco saying
  so in the same breath.
---

# 🔴 DROP the five legacy plant-days columns — destructive and irreversible

<!-- watcher: do-not-arm -->

**This prompt is held by the canonical marker above — the same one
`pr-fv2-formrule-contract-HOLD.md` carries. Only a human removing that line clears it, and only
Marco should, saying so explicitly in the same conversation.**

This drops `excavator_days`, `bobcat_days`, `ewp_days`, `hook_truck_days` and `semi_tipper_days`
from `scope_of_works_items`. A revert restores the columns **empty**. Whatever they held is gone.

Marco decided on 2026-09-05 that the columns should go, having been told plainly that dropping is
irreversible while retiring the code path is not. This prompt exists so that decision is recorded and
executable — **not so it can be executed unattended.**

## The soak, and why this is two slices

`pr-plantdays-s1-retire-the-legacy-plant-days-path` removes every read and write of these columns
and changes nothing in the database. If it turns out a tender depended on that path, s1 is a
one-commit revert and the data is still there to restore. **That property is the entire reason the
column drop is not in the same PR.**

The repo already runs this pattern deliberately: `pr-fv2-formrule-contract-HOLD.md` is a destructive
FormRule column drop, held on HOLD since 2026-08-12 with a weekly reminder, to be armed only once
the replacement has soaked long enough. **Treat this the same way.** The gate below is the mechanism;
the judgement is Marco's.

## Preconditions — all four, verified and quoted in the PR body

1. `PLANT_DAYS_RETIRED_V1` is on `main` — s1 has merged. (The `requires_on_main` gate checks this,
   but say which commit.)
2. The five row counts from s1's PR body were **all zero**, or Marco has since ruled on the non-zero
   case. Quote the counts and the ruling.
3. A soak has actually elapsed since s1 merged. State the number of days. If it is less than a week,
   say so and ask rather than proceeding.
4. `grep -rn "hookTruckDays\|semiTipperDays\|excavatorDays\|bobcatDays\|ewpDays" apps/` returns
   nothing outside `dist/` and outside this prompt. Paste the output.

**If any of the four fails, open no PR. Report and stop.**

## What to build

One migration, `drop_legacy_plant_days`, dropping exactly the five columns and nothing else, plus
the matching removal from `schema.prisma`.

The migration must contain **no `UPDATE`**, no data movement, and no other DDL. Quote it in full in
the PR body — it should be five lines.

## Required by the schema rules — do these up front

1. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `relationship-map.md` and `metadata-catalog.json`.
2. Put a bare `GATE-ALLOW: migrations` line at **column 0** of the PR body.

## Do NOT

- **Do not touch any file outside `scope:`.** If s1 left a reference behind, that is a reason to stop
  and fix s1, not to widen this slice.
- Do not combine this with any other schema change. A destructive migration travels alone so that its
  blast radius is exactly readable from its own diff.
- Do not drop any other column, however dead it looks.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN — open the PR and leave it unmerged for Marco.
