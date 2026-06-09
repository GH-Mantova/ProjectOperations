# Finding — Job ID canonicalisation regression in seed

**Severity:** HIGH (data integrity, but contained to fresh-seed reproducible state)
**Discovered:** 2026-06-09 Phase 1E sanity check
**Module:** Jobs and Delivery (#8) + Seed script

## Symptom

The Jobs page (`/jobs`) lists three seeded jobs with **two different ID formats**:

| Job ID | Title | Format |
|---|---|---|
| **JOB-2026-001** | North precinct services package | Legacy `JOB-YYYY-NNN` |
| J-2025-002 | Sandgate Stormwater Upgrade — Stage 1 | Canonical `J-YYYY-NNN` ✓ |
| J-2025-001 | Ipswich Motorway Stage 4 — Earthworks | Canonical `J-YYYY-NNN` ✓ |

## Why this matters

Per the roadmap PHASE 6 → fix/B05 + B02.1 — Job ID canonicalisation (PR #210):

> "Three coexisting Job ID formats consolidated to canonical J-YYYY-NNN via new JobNumberService (per-year sequence, Brisbane TZ). Migration normalises 2 JOB-YYYY-NNN + 36 JOB-COMP-* rows in place; JOB-COMP-* renumbering starts at MAX(existing 2026)+1 to avoid collision with the JOB-2026-001 rewrite."

Per RESUME.md known starting state:

> "If reseeding to test from clean: the JOB-COMP-* compliance fixtures get regenerated and renumbered per PR #210 — do NOT pin tests to specific job IDs across reseeds."

> "Job ID canonicalisation — PR #210 normalised to J-YYYY-NNN. Re-seed should produce J-2026-NNN format only."

`JOB-2026-001` appearing on a fresh `prisma migrate reset --force` followed by `pnpm seed` means:
- Either the seed script still hard-codes the legacy `JOB-YYYY-NNN` format somewhere
- Or the JobNumberService isn't being used by the seed's job creation path
- Or PR #210's migration applied historical normalisation but the seed wasn't updated to align with the JobNumberService output format

Either way, anyone running `pnpm seed` on a fresh clone today will produce a non-canonical job, then any subsequent automated job creation through the JobNumberService will produce canonical `J-2026-NNN` jobs, and the two formats will continue to coexist.

## Verification steps

```powershell
# Confirm via DB or API
Invoke-RestMethod -Uri http://localhost:3000/api/v1/jobs -Headers @{Authorization="Bearer $TOKEN"} | ConvertTo-Json -Depth 5
```

Or check the seed source:

```powershell
Select-String -Path apps\api\prisma\seed.ts,apps\api\prisma\seed\*.ts -Pattern "JOB-[0-9]{4}-[0-9]{3}|jobNumber" -SimpleMatch:$false
```

## Recommended fix

A small PR that:
1. Audits the seed for hardcoded `JOB-YYYY-NNN` strings, replaces with `J-YYYY-NNN`
2. Or better — replace any hardcoded string with a call to `JobNumberService.allocateNext(...)` (or whatever the service method is) so future format changes only need to be made in one place
3. Add a unit test on the seed output asserting all job numbers match `/^J-\d{4}-\d{3}$/`
4. PR title: `[Test/§8] Job ID seed regenerates canonical format only`

## Related

- PR #210 — canonicalisation migration (closed)
- PR #289 — schema drift reconciliation (closed)
- This finding's reproduction depends on the Phase 0 schema-drift finding being resolved or worked around. After the workaround (`prisma migrate reset --force`), the seed runs and produces this inconsistent state.
