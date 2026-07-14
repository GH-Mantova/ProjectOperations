# Restore #552's PR body - I flattened it with the array-to-string bug (see restore-538-body.ps1).
# This is the PR Marco MUST read before merging (it writes production data), so its readability
# matters more than most. Content reconstructed verbatim from the flattened text.
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$body = @'
GATE-ALLOW: migrations

## Summary

Third occurrence of the LL-04 / LL-35 trap (prior: #504, #506/#551). `seedRateTableProjections` in `apps/api/prisma/seed-initial-services.ts` is the only thing that populates `rate_tables` / `rate_columns` / `rate_rows`, and `deploy.yml` runs `prisma migrate deploy` only - never the TS seed.

Prod therefore has **zero** rows in the flexible rate model, so `/admin/rates-lists` -> Rate tables tab renders empty, and `RateResolverService.enumerateRateSet()` snapshots an empty locked-rates set on tender lock.

This PR adds one new migration folder - `20260713140000_seed_baseline_rate_tables` - that mirrors the seed byte-for-byte (same slugs, IDs, column roles, cell contents) for all 9 projections: labour, plant, waste (per-tonne + per-m3), cutting, core-hole, fuel, enclosure, and the reference excavator-production table.

**9 tables - 35 columns - 132 rows.**

## Idempotency

Every INSERT is guarded by `ON CONFLICT DO NOTHING` against the existing unique keys:

- `rate_tables`  : `slug`
- `rate_columns` : `(rate_table_id, name)`
- `rate_rows`    : `id` (PK)

Rerunning is a no-op; an admin's edits to a row / column / table are never overwritten (S3-016 lesson). No DELETE is issued - the seed's `deleteMany` cleanup of orphan rows is deliberately omitted here.

## No invented values

All literals come from `seedEstimateRates` (labour, plant, waste, cutting, core-hole, fuel, enclosure) and the hard-coded `excavatorSizes` block in `seedRateTableProjections`. `pnpm seed` after this migration produces the same row set; running it twice remains byte-identical (CP-08).

## Reverse statement

Documented in the migration header:

```sql
DELETE FROM "rate_rows"    WHERE rate_table_id IN ('rt-lbr','rt-plt','rt-wst-t','rt-wst-m3','rt-cut','rt-ch','rt-fl','rt-en','rt-exc-prod');
DELETE FROM "rate_columns" WHERE rate_table_id IN (...same...);
DELETE FROM "rate_tables"  WHERE id            IN (...same...);
```

## Migration ordering

Timestamp `20260713140000` sorts after #546 (`20260713120000_editable_permissions_matrix`) and #551 (`20260713120000_grant_prod_superuser_flag`).

## Out of scope (per LL-30)

- `deploy.yml` - the strategic remedy (a reference-seed step so `seed-initial-services.ts`'s ~70 other seed-only models land like migrations) is deliberately deferred for Marco's decision.
- Rate-resolver, `FilterableRateGrid`, #540's `isReference` work, any rate **value** change, the legacy `Estimate*Rate` library (kept intact - "Legacy estimate rates" tab).

## DO NOT AUTO-MERGE - this PR writes production data

Production database writes are in the ESCALATE set. **Marco reviews the actual INSERT statements and merges himself. Please read the SQL, not just this summary.**

Context worth having: on 2026-07-13 the empty prod rate tables were briefly mistaken for **data loss**. They are not - the new RateTable system was never populated in prod, and the legacy rate library is intact under "Legacy estimate rates". This PR only delivers what the seed always intended.

## Test plan

- [x] `pnpm --filter @project-ops/api lint` - clean
- [x] `pnpm build` - clean (both apps)
- [x] `pnpm lint` - clean (workspace-wide)
- [x] `pnpm --filter @project-ops/web test` - 781 pass / 62 files
- [x] `pnpm --filter @project-ops/api test` - 2185 pass / 6 skipped; 1 unrelated PDF-renderer teardown timeout on `quote-html.builder.spec.ts` (pre-existing, unrelated to rate tables)
- [x] `pnpm compliance:smoke` - passed
- [ ] **Local (Marco):** on a fresh DB, reset + migrate -> `SELECT COUNT(*) FROM rate_tables;` returns **9**, `SELECT COUNT(*) FROM rate_rows;` returns **132**.
- [ ] **Local (Marco):** run the migration a second time (or `pnpm seed`) -> row counts unchanged, no duplicates.
- [ ] **Local (Marco):** manually edit a rate row's cells, rerun the migration -> the edit survives.
- [ ] **Post-deploy (Marco):** `/admin/rates-lists` -> Rate tables tab lists 8 priced tables (the 9th, excavator-production, is `is_reference=true` and appears in the reference tab); open one and confirm columns/rows; lock a tender and confirm the snapshot is no longer empty.
'@

if (-not $Execute) { Write-Output "DRY RUN"; exit 0 }

$tmp = Join-Path $env:TEMP "pr552-body.md"
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))
gh pr edit 552 --body-file $tmp 2>$null | Out-Null
Write-Output "#552 body restored with real newlines."

$check = (gh pr view 552 --json body -q .body) -join "`n"
$ok = $false
foreach ($l in ($check -split "`n")) { if ($l.TrimEnd() -ceq "GATE-ALLOW: migrations") { $ok = $true } }
if ($ok) { Write-Output "  OK   GATE-ALLOW: migrations is bare at column 0" } else { Write-Output "  FAIL" }
Write-Output ("  body line count: " + ($check -split "`n").Count)
