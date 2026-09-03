---
premise: 'grep -q "Production runs" docs/plans/rates-migration-plan.md'
premise_means: >-
  Two tracked plan documents assert that production prices from RateTable. MEASURED 2026-09-03 at
  origin/main de811907 - RATES_CANONICAL_SOURCE is assigned in exactly one file in the repository,
  .env.example line 209, which is a template and is never loaded. It is absent from the live root
  .env, absent from apps/api/.env, and absent from .github/workflows/deploy.yml, which deploys with
  azure/webapps-deploy and a publish profile and sets no app settings at all. Marco read the Azure
  App Service configuration on 2026-09-02 and it is not there either. app.config.ts line 16 returns
  ratetable only on an exact match, so unset resolves to legacy. Production runs legacy. Two
  independent audits sequenced work off the opposite claim.
scope:
  - docs/plans/rates-migration-plan.md
  - docs/plans/settings-restructure-plan.md
done_when: >-
  ! grep -q "Production runs" docs/plans/rates-migration-plan.md && ! grep -q "Prod runs" docs/plans/settings-restructure-plan.md && grep -q "legacy" docs/plans/rates-migration-plan.md
size: 2
gate_allow: none
seed_only: false
escalates: false
cluster: plandocs-truth
cluster_order: 1
---

# PLANDOCS-S1: the two plan documents have the dead-edit trap pointing at the wrong screen

**Grounded against `origin/main` = `de811907`, measured 2026-09-03T05:2xZ.**

Docs-only. Two files, two paragraphs. No code, no `sot/`.

## Why this is not cosmetic

`docs/plans/rates-migration-plan.md` opens its **Problem** section with the claim, and then builds a
consequence on top of it:

> Production runs `RATES_CANONICAL_SOURCE=ratetable`, so the app prices jobs from the canonical
> `RateTable` model. But the legacy admin screen `EstimateRatesAdminPage` (`/admin/estimate-rates`)
> still reads and writes the eight legacy `Estimate*Rate` tables … The result is a **partial
> dead-edit trap**: edits to the six priced categories … never reach pricing, while enclosure,
> other-rates, and material-densities still resolve from legacy via the resolver's fallback and
> remain authoritative.

**Every clause after the first is inverted.** With the flag unset the resolver is legacy-first for
all eight slugs, so the legacy screen is the authoritative one and the *new* reference-data screen
(`RatesListsAdminPage`, `/settings/reference-data`) is where edits do not reach pricing. A reader
following this plan is told to trust the wrong surface.

The document also already states, at its 11c step, the precondition that has never been met: *"a full
real pricing cycle has run on `ratetable`"*. The plan contradicts itself — the Problem section says
prod is already on `ratetable`, the 11c step says running on `ratetable` is still a precondition.

## Do

1. **`docs/plans/rates-migration-plan.md` — rewrite the first paragraph of `## Problem`.** State the
   measured position: production runs `legacy` because the variable is set in no environment; the
   resolver is legacy-first for all eight priced slugs; **the dead-edit surface is
   `RatesListsAdminPage` / `/settings/reference-data`**, not `/admin/estimate-rates`. Keep the
   paragraph the same length and the same shape — this is a correction, not a rewrite of the plan.
   Cite the measurement inline so the next reader does not have to re-derive it:
   `app.config.ts:16` (unset resolves to `legacy`), `.env.example:209` (the only assignment in the
   repo, never loaded), and `deploy.yml` (sets no app settings).
2. **Add two sentences immediately after it** noting that the 11c precondition further down the same
   document — a full real pricing cycle on `ratetable` — is therefore **still unmet**, and that this
   is a second, independent bar on 11c alongside the map-locations decision.
3. **`docs/plans/settings-restructure-plan.md` — fix the SLICE 11 bullet.** Replace
   `Prod runs RATES_CANONICAL_SOURCE=ratetable.` with a statement that prod runs `legacy` because the
   variable is unset, and that flipping it is a deploy-time change only Marco can make on the App
   Service. Change that sentence and nothing else in the bullet.
4. **Add a one-line dated note** to each edited section — `Corrected 2026-09-03: measured, the
   variable is set in no environment.` — so the next reader can see when the claim was last checked
   rather than assuming it has always been true.

## Do NOT

- Do NOT change any slice ordering, gate, acceptance criterion or status in either plan. Only the
  factual claim about which store production reads.
- Do NOT touch `docs/plans/rate-hub-sor-integration-plan.md`. Its line 76 —
  *"Legacy-first by default; flips to RateTable-first when `RATES_CANONICAL_SOURCE=ratetable`"* — is a
  correct statement of the mechanism, not a claim about production. Leaving it is deliberate.
- Do NOT edit `.env.example`, `app.config.ts`, or any code. This slice changes prose.
- Do NOT touch `sot/`. CP-24 hard-fails a PR that mixes `sot/` with anything else.

## Verify

- `grep -n "Production runs" docs/plans/rates-migration-plan.md` returns nothing.
- `grep -n "Prod runs" docs/plans/settings-restructure-plan.md` returns nothing.
- `git diff --stat` lists exactly two files.
- `git diff` shows no change to any heading, list ordering or gate expression in either file.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run. Finishing the work and then asking for permission is
> indistinguishable from failing.
