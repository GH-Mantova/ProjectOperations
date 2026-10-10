VERDICT: MERGE
REVIEWED-SHA: a03b2dd0fc806c30e42d20576d405f15c9f89612

## Scope Compliance

**In scope:**
- sot/04-data-model.md regenerated schema section re-merge (297→299 models, 498→501 FK edges)
- Station 05 breadcrumb documenting the run (docs/pr-prompts/00-05-sot-keeper-2026-10-08-2238-...)
- Both new models (ScopeItemEnclosureLine, UserAppearancePreference) have backing migrations on main
- CP-24 compliance verified: sot/ + docs/ only, no code/config/migrations/locks touched

**Out of scope (none):** Exactly 2 files staged; scope cap S5 satisfied.

## Self-Verification Claims from Originating Prompt

All 7 safeguards verified in the breadcrumb:
- S1 ✓ Disposable worktree from origin/main @ 375f4386, branch docs/sot-reconcile-2026-10-09, never merged to dev tree
- S2 ✓ Generator run twice, 169,581 = 169,581 bytes, `IDENTICAL(mod stamp): true`
- S3 ✓ Curated region byte-identical (END-marker→EOF sha256 d5f505615d88a806 before and after)
- S4 ✓ Curated line count 1596 → 1596
- S5 ✓ Exactly 2 files in diff (sot/04-data-model.md + breadcrumb)
- S6 ✓ Post-fix validation (--check exit 0, check-sot-refs exit 0 dangling=0, check-sot-bytes CLEAN UTF-8, lone LF=0, U+FFFD=0)
- S7 ✓ No competing sot/reconcile PR or branch open at time of measurement

## CI Status

- Changed-path filter: SUCCESS
- CodeQL: SUCCESS
- PR gates (CP-09–13, CP-17, CP-22, CP-23): SUCCESS
- Pipeline tests: SUCCESS
- E2E restoration markers: SUCCESS
- **Approval receipt (CP-26): FAILURE** — Intentional and working as designed (see below)
- Skipped checks (API, Web, Data model sanity, E2E): All SKIPPED — correct for docs-only PR

## Approval Receipt Gate (CP-26)

The gate correctly fires because sot/04-data-model.md sits outside `tests/` and `docs/`, triggering the need for `docs/decisions/merge-approvals/2265.md`.

**This is intentional and correctly handled by the originating prompt.** From the PR body and breadcrumb:

> "CP-26 is armed by the diff and sot/ sits outside tests/|docs/, so this PR needs an approval receipt — the *merging* station writes it (authority: standing, lane: sot, approved_by: station-00). Station 05 has not written one, because 05 is not the merging station."

Per the SoT governance contract documented in the prompt: Station 05 opens the PR but does not merge. Station 00 (or Marco) merges it and writes the approval receipt at that time with:
- `pr: 2265`
- `approved_by: station-00`
- `approved_at: <ISO-8601 timestamp>`
- `authority: standing`
- `lane: sot`
- Plus a one-line explanation

This is the designed workflow. The PR is deliberately left unlabeled and BLOCKED, waiting for that approval to be added by the merging authority.

## Risks Marco Should Know

1. **SoT infrastructure findings (F1–F8 in breadcrumb):** The run discovered that the pipeline was silent for 37.5 hours while all four enabled stations fell past cadence + grace (Station 05 at 344.3 hours, 14 missed days). The heartbeat alarm fired four times correctly but was unread. These findings are escalated to Marco but do NOT block this PR merge — they affect future pipeline configuration (heartbeat notification delivery) and scheduler uptime.

2. **New models have backing migrations:** Both ScopeItemEnclosureLine and UserAppearancePreference have migrations already merged to main (20261003120000_asb_enclosure_lines and 20261003024444_brandtheme_s7c_appearance_preferences). Schema is coherent.

3. **Encoding verified:** check-sot-bytes.mjs confirms CLEAN UTF-8 on disk, no BOM, no U+FFFD, em-dash and arrow counts equal main. No encoding surprises.

## Recommendation

**Merge once approval receipt is written.** The substantive work is complete, verified by all 7 safeguards, and CI gates green (except the intentional CP-26 gate). The CP-26 block is correct and by design. Marco (or Station 00) should write `docs/decisions/merge-approvals/2265.md` with the standing-authority template from the approval-receipt-check output, commit it to the PR branch, and push. CI will re-run and gate will turn green. Then merge.

This is the correct SoT-only PR workflow as documented in DOCTRINE and the station contract.
