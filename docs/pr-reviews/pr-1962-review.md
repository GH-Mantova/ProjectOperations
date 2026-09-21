VERDICT: MERGE

Scope compliance:
- In scope: Docs-only PR. Stages one prompt file `pr-scopecards-s3-line-markup-all-types-HOLD.md` (226 lines) and one approval receipt. No code, no migrations, no schema. Prompt is in HOLD status (requires `SCOPE_QUOTE_DESTINATION_UI_V1` on main from S2b PR #1961). No files marked for build.
- Out of scope: None. Two files added, both docs/pr-prompts/** hierarchy.

Self-verification claims:
- [✓] Prompt file is valid YAML frontmatter + markdown
- [✓] Premise statement is correct: waste and cutting lines cannot yet carry per-line markup
- [✓] Scope list is precise and matches the build plan (API + web + tests, no sot/)
- [✓] Gate requirement documented: requires_on_main = S2b marker (S2b is PR #1961, already merged to main at df64f2e6)
- [✓] Marker defined: SCOPE_LINE_MARKUP_ALL_TYPES_V1 is referenced in done_when and BUILD THIS section
- [✓] done_when checklist is executable and comprehensive (pnpm tests, grep markers, file existence, data-model regen)
- [✓] Do-NOT list is clear and binds the agent
- [✓] Approval receipt documents Marco's release date, station, and session ID; mergedBy GH-Mantova at 2026-09-15T06:04:39Z

Risks Marco should know:
- Gate status: PR #1961 (S2b) already merged; its marker SCOPE_QUOTE_DESTINATION_UI_V1 is now on main (confirmed in df64f2e6's parent, commit c8f8c0a4). The lint gate GATE_NOT_RELEASED mentioned in the PR body is outdated — S2b is now live. Merging this prompt does not arm it (it stays HOLD per the filename); S4 will arm when S3 itself lands.
- Escalates: true — the prompt notes schema changes (two nullable markup_override columns) and visible UI changes (cutting header will start agreeing with server summary). This is intentional doc-stage work.
- CI: All checks passed (15/15 green), including PR gates (CP-09–13, CP-17, CP-22, CP-23), approval receipt (CP-26), pipeline tests, and arm-prompt tests.
- No live code risk: prompt is staged, not armed. No build will fire until Marco explicitly renames the file to `-ready.md`.

Recommendation: Merge approved. Docs-only staging PR with complete spec, passing CI, approval receipt on file, and correct gate dependencies. Ready for S3 build phase when Marco releases the prompt.
