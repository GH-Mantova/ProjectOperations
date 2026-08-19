---
premise: '! grep -rq "assertRateParity" scripts/'
premise_means: >-
  Nothing outside the resolver's own unit spec calls assertRateParity. Its only
  callers today are three mocked-Prisma tests
  (apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts:373-439).
  The value-and-unit equality of legacy vs RateTable has never been checked
  against real data. The existing scripts/rates/fallback-audit.mjs proves
  RESOLVABILITY only (does RateTable answer at all) and re-implements the
  lookup itself; it does not compare values.
scope:
  - scripts/rates/**
  - package.json
  - docs/data-model/rates-migration/**
done_when: >-
  pnpm build && grep -q "assertRateParity" scripts/rates/parity-proof.mjs &&
  grep -q "enclosure" scripts/rates/parity-proof.mjs && grep -q "other-rates"
  scripts/rates/parity-proof.mjs && grep -q "rates:parity-proof" package.json &&
  grep -q "assertRateParity" docs/data-model/rates-migration/PARITY-PROOF-METHOD.md
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# SLICE 11b2-c — parity proof: does RateTable already answer identically?

Read `docs/plans/rates-migration-plan.md` section 11 first.

This slice **changes no behaviour and prices nothing differently.** It builds a
read-only instrument that answers one question: for every legacy rate key that
exists in the database, does the RateTable path return the **same value and the
same unit** as the legacy path?

That question is the real gate on 11c. 11c deletes `tryLegacy` — the fallback.
Once it is gone, any key RateTable cannot serve identically fails at runtime, in
pricing, silently. Nobody has proved it can.

## Why the existing audit is not enough

`scripts/rates/fallback-audit.mjs` (PR #747) exits 0 when every legacy key is
*resolvable* from RateTable. Resolvable is not identical. A RateTable row that
answers $95/t where legacy answers $85/t passes the fallback audit and is a
$10/t pricing error. The audit also **mirrors** the resolver's lookup logic
rather than calling it, so it can agree with itself while disagreeing with
production.

## Do

1. **Create `scripts/rates/parity-proof.mjs`** — read-only. It NEVER writes,
   updates or deletes. Model the DB-probe, `REPO_BASE` handling, report-writing
   and exit-code structure on `fallback-audit.mjs`; that file is the reference
   for shape, not for logic.

2. **Call the real `assertRateParity`. Do NOT re-implement it.**
   Import `RateResolverService` from the compiled API output (`pnpm build`
   first, then import from `apps/api/dist/...`) and call
   `assertRateParity(slug, keys)` on a real instance.
   **If it cannot be imported without changing `apps/api/src/`, STOP and
   report.** Do not copy the comparison logic into the script. A proof that
   mirrors the thing it is proving proves nothing — this is the whole point of
   the slice.

3. **Cover all eight slugs the legacy adapter handles**, not six.
   `tryLegacy` (`rate-resolver.service.ts:375`) covers: `labour`, `plant`,
   `waste`, `cutting`, `core-hole`, `fuel`, `enclosure`, `other-rates`.
   `docs/plans/rates-migration-plan.md:35` says "6 priced slugs" and the #747
   review says "6 legacy slug handlers" — **both undercount.** They predate
   SLICE 11a, which registered `enclosure` (-> `EstimateEnclosureRate`) and
   `other-rates` (-> `CuttingOtherRate`) in the resolver precisely so the audit
   could route them; see the comments at :425 and :437. Publish the counting
   rule in the report header: *slugs the legacy adapter answers*, which is 8.
   If your own read of `tryLegacy` yields a different number, report the
   discrepancy rather than silently adopting either figure.

4. **Discover keys from the database, not from a hardcoded list.** For each
   slug, enumerate the active legacy rows and derive the lookup keys the same
   way `fallback-audit.mjs` does. A slug with zero rows is reported as
   `NO DATA` — it is neither a pass nor a fail, and must not be silently
   counted as a pass.

5. **Report + exit codes.** Write a timestamped markdown report next to the
   fallback-audit reports. Header states: canonical source, masked DATABASE_URL,
   the counting rule, per-slug key counts. Body lists every divergence with slug,
   keys, legacy value/unit, ratetable value/unit, and the `divergence` string.
   Exit `0` = every key matched. Exit `1` = at least one divergence. Exit `2` =
   DB unreachable / import failed / infrastructure. **A `NO DATA` slug does not
   change the exit code but MUST be listed in the summary** so a slug with an
   empty table can never masquerade as proven.

6. **Add `"rates:parity-proof": "node scripts/rates/parity-proof.mjs"`** to the
   root `package.json` scripts block, beside `rates:fallback-audit`.

7. **Write `docs/data-model/rates-migration/PARITY-PROOF-METHOD.md`** — what the
   instrument checks, what it does not check, the counting rule and why it is 8,
   how to run it, and how to read each exit code. This is a method note, not a
   results file: it must NOT claim a result. (A content-free marker file is how
   `STEP-11B-DONE.md` became a gate that asserts nothing — do not repeat it.)

## Do NOT

- Do NOT change any rate value, seed, RateTable row, or resolver behaviour.
- Do NOT touch `apps/api/src/`. If the work seems to require it, STOP and report.
- Do NOT remove, weaken or "fix" `tryLegacy` or the fallback. That is 11c's job
  and it is gated on this proof.
- Do NOT run the script against production. The PR delivers the instrument; Marco
  runs it. Do NOT put any real `DATABASE_URL` in the repo.
- Do NOT create or update any `*-DONE.md` marker. This slice does not unlock 11c
  by existing — it unlocks it by being **run** and coming back clean.
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint` green.
- Run `pnpm rates:parity-proof` against the local seeded dev DB and paste the
  full summary block into the PR body — including any divergences and any
  `NO DATA` slugs. **A divergence is a finding, not a failure: report it, do not
  chase it.** The doc-comment on `assertRateParity` is explicit that a divergence
  is a real bug in the seed or the ratetable model.
- Positive control: temporarily point one key at a deliberately wrong value in a
  scratch copy and confirm the script exits 1 and names it. Do not commit the
  scratch change. State in the PR that you ran the control and what it printed.
  **If you skip the control, say so — do not imply you ran it.**

## Notes for the reviewer

`escalates: false` is deliberate and on the record. The PR adds a read-only
script, one `package.json` line, and a method note. It runs against no production
system, changes no pricing, and carries no migration. There is nothing here that
auto-merge can do damage with. The dangerous slice is 11c, which is
`escalates: true`, draft-only and backup-gated, and which this proof is a
precondition for.

## STANDING AUTHORITY

Read-only instrument only. Stop and report rather than widening scope.
