VERDICT: MERGE

## Scope compliance

**Scope: WBS-SHIFT-S2 (Slice 1 of 2) — fix Path B labour pricing to respect shift variants (Night/Weekend rates), aligning with Path A (already correct).**

In scope:
- `scope-item-pricing.ts`: widened `buildRateMaps` to accept all shift variants; new `labourRateByDisciplineShift` map keyed `${discipline}:${shift}`; exported pure resolver `labourRateForShift`; `computeScopeItemTotal` now calls `labourRateForShift` to select rate by shift; replaced stale caveat re: nightRate/weekendRate with WBS-SHIFT-S2 note.
- `scope-of-works.service.ts`: removed `.filter(r => r.keys["shift"] === "day")` at line 325 call site; adapted labour rates transform to pass all three shift rows to `buildRateMaps`.
- `scope-redesign.service.ts`: same filter removal at line 896 WBS totals call site; same labour rates transform.
- `scope/__tests__/scope-item-pricing.spec.ts`: 25 tests total; new cases cover Day (regression), Night, Weekend, null shift (fallback to Day), unrecognised shift (fallback), and the Path B == Path A equality assertion (acceptance criterion).

Out of scope: None detected. No migration, no sot/, no web files, no resolver changes, no Path A changes.

## Self-verification claims

- [PASS] `grep -n "we need only shift" apps/api/src/modules/tendering/scope-of-works.service.ts` → no match (caveat removed at line 325 filter removal)
- [PASS] `grep -n "ignored" apps/api/src/modules/tendering/scope-item-pricing.ts` → no match (old caveat re: nightRate/weekendRate replaced with WBS-SHIFT-S2 note at line 15)
- [PASS] `grep -n "labourRateForShift" apps/api/src/modules/tendering/scope-item-pricing.ts` → found at line 103 (declared as pure function), line 150 (exported), line 227 (called by computeScopeItemTotal)
- [PASS] 25 tests pass; verified locally on PR branch: 11 existing tests + 6 shift-aware computeScopeItemTotal tests + 8 labourRateForShift resolver tests
- [PASS] Path B == Path A equality test present (line 256-289 of spec file): simulates both paths with same input, asserts labour totals match
- [PASS] `pnpm lint` exit 0 (1 pre-existing warning in unrelated file, no new violations)
- [PASS] `git diff --stat` → 4 files, 240 insertions, 24 deletions, no migration

## CI status

All required checks passed (as of 17:42Z 2026-09-03):
- **PR gates (CP-09–13, CP-17, CP-22, CP-23)**: PASS (only CP-26 do-not-merge label failure, expected because escalates:true)
- **Approval receipt (CP-26)**: FAIL — label present, which is correct by design (escalates:true means Marco merges, not automation)
- **API — lint, test, compliance smoke**: SUCCESS (unit tests, build, lint all pass)
- **Web — lint, logic tests, vitest, build**: SUCCESS
- **Data model — generator sanity**: SUCCESS (schema.prisma parses cleanly)
- **CodeQL**: SUCCESS
- **Pipeline — watcher + linter tests**: SUCCESS
- **Pipeline — arm-prompt tests**: SUCCESS
- **Tendering Browser Smoke**: IN PROGRESS (changed-path filter runs but not relevant to API pricing change)

## Risks Marco should know

1. **Escalation by design**: PR has `escalates: true` in the prompt; watcher correctly applied do-not-merge label. CP-26 gate failure is expected and proper. Marco manually reviews and removes the label to release merge.

2. **Path B / Path A equality**: The acceptance criterion is that a Night line priced by computeScopeItemTotal (Path B) now equals the same line priced through resolveRate (Path A). Test at line 256 of spec file asserts this using seed-representative rates (DEM night: $160 in fixture = 2×5×$160 = $1,600). PR body cites seed data (night = $1,000): 2×5×$1,000 = $10,000 on both paths. This is the fix's core intent and is verified.

3. **Backward compatibility**: null/unset shift defaults to Day (legacy behaviour preserved). `labourRateForShift` is case-insensitive ("night" == "NIGHT") and rejects unrecognised strings by falling back to Day. No existing pricing changes unless shift is explicitly set to Night/Weekend.

4. **WBS-SHIFT-S1 gate**: This PR (S2, API pricing) is the first slice of the wbs-shift cluster. S1 (web display of shift-aware totals) is blocked on: (a) this PR merging, and (b) `labourRateForShift` exported symbol appearing on main. Both are satisfied by this commit.

## Recommendation

Merge. Scope clean, all substantive CI checks pass, self-verification checklist satisfied, Path B == Path A equality assertion present and passing (25/25 tests). The do-not-merge label is intentional per escalates:true design; removing it (via Marco's approval receipt) releases the merge.
