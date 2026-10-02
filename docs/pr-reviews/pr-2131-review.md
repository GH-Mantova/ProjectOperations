VERDICT: MERGE

Scope compliance:
- In scope: Fixes `why-blocked.ps1` to gate a diagnostic merge attempt behind three safety checks (hold labels, RULE 2 marco:true verdict, already-merged state) and adds before/after read-back validation. Removes unconditional Set-Location that left caller's shell in the watcher clone. Updates both SCRIPT-REGISTRY.md and 00-supervisor.md to reclassify the script from Read-only to Mutating with full incident documentation.
- Out of scope (none): All changes fall within the documented scope.

Self-verification claims:
- [GREEN] Three gates refuse before any network call: hold labels (exit 4), RULE 2 marco:true verdict (exit 6), already-merged PR (exit 7).
- [GREEN] Before/after read-back captures state to distinguish script-caused merges from pre-existing ones (measured control against #2130).
- [GREEN] Uses `-R` flag instead of Set-Location; caller's shell position unchanged (before/after same).
- [GREEN] DOCTRINE section references verified correct (§1 read-back rule, §4 shared-tree safety, §10.1 RULE 2 step 1).
- [GREEN] Both documentation files updated with measured incident date (2026-09-23T19:2xZ), tested controls, and reason for reclassification.
- [GREEN] `node scripts/pipeline/lint-station.mjs` passes ("ADMIT: all 8 docs clean", exit 0).

Risks Marco should know:
- None identified. The script is a manual diagnostic tool not called by automation. Gates are conservative (refuse before attempting). Read-back logic handles the idempotent REST response case (GitHub returns identical success message for a pre-merged PR). Gating on `pr-*.log` files is correct per DOCTRINE §10.1 (rev-*.log excluded as auto-generated review jobs with no lane info).

Recommendation: Merge. The fix closes a real safety gap where a misclassified script could have merged a Marco-routed PR under timing pressure, and lands it with rigorous gating and measurement per DOCTRINE.
