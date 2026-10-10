VERDICT: MERGE
REVIEWED-SHA: 9b5c6b1091afd01ddf566e7edc88a65f047dbf4f

Scope compliance:

**In scope:**
- F49 citation fix in `docs/pipeline/SCRIPT-REGISTRY.md`: replaced pathful citation `C:\po-watcher\ensure-watcher.ps1:10` with anchor form `(anchor: $Launcher =)` exactly as promised. Verified independently: line 10 is `$LogPath` (the log), line 12 is `$Launcher`. Citation correctly points to the launcher now. Post-fix verification controls match spec: old citation 0 hits, anchor form 1 hit, U+FFFD 0 hits.
- `docs/pipeline/sweep-rotation.json`: advanced from `last_index: 2` to `last_index: 3`, with timestamp updated from 06:09:53Z to 10:09:53Z, reflecting Station 04's manual handover of state after running the `instruction-drift` sweep.
- Station 04's 10:10Z breadcrumb swept to `docs/pr-prompts/00-04-scanner-2026-10-09-1010-…md` at tracked path (328 additions).
- Station 00's 10:14Z breadcrumb archived via `git mv` to `docs/pr-prompts/archive/` (status shows RENAMED, not deleted — still counted for `--freshness` by basename).
- New breadcrumb from this 12:14Z run written and committed at tracked path (389 additions).

**Out of scope (none found):**
- No sot/ paths touched (CP-24 rule honored).
- No scheduled tasks enabled, disabled, run, or re-run.
- No labels added or removed.
- No other PRs armed, merged, or manipulated.
- No `gh pr update-branch` calls.
- Exactly 5 file changes: 4 tracked (docs/pipeline/ + docs/pr-prompts/), 1 RENAMED to archive/.

Self-verification claims:

- [green] Commit message matches house style (single line + hyphenated scope + detail in breadcrumb body).
- [green] Breadcrumb structure valid: `check-breadcrumb.mjs` reports `CLEAN`, exit 0, `structure: 2 checked, 0 malformed`.
- [green] Station doc lint clean: `lint-station.mjs` reports `ADMIT: all 10 docs clean` (validated on the "Pipeline — watcher + linter tests" CI job).
- [green] Citation fix verified: old pathful citation completely removed (0 hits), anchor form present (1 hit), surrogate encoding absent (0 U+FFFD).
- [green] Rotation state correctly advanced and timestamped.
- [green] Archive rename is syntax-correct (`git mv`, not manual split).
- [green] Board lease held throughout mutation; safe-to-act re-measured before commit (no index.lock, no MERGE_HEAD, 0 armed prompts).

Risks Marco should know:

- None identified. This is a docs-only COLLECT cycle with no code changes, migrations, schema drift, or auth surface modifications. The citation fix itself corrects a documentation drift hazard (the old pathful citation pointed to line 10 which is `$LogPath`, not the launcher). The rotation state advance is essential to prevent Station 04 from repeating the `instruction-drift` sweep on the next run.

CI status:

- All checks passed: "Changed-path filter", "PR gates", "Approval receipt", "Pipeline — watcher + linter tests", "Pipeline — arm-prompt tests", "E2E restoration markers", and CodeQL analysis all SUCCESS.
- Skipped checks are expected for docs-only PRs (API, Web, Data model jobs).

Recommendation: Safe to merge. The PR carries one corrected citation (F49), one advanced rotation state, and two properly formatted breadcrumbs. All self-verification checks pass, CI is green, scope is tight and clean, and it honors all house rules (no sot/, no label edits, no external mutations).
