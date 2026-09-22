VERDICT: MERGE

Scope compliance:
- In scope: F7 appended to Station 00 breadcrumb, documenting measurement that #2071 has an auto-updater and Station 00 correctly did NOT push to that branch. Pure docs/pr-prompts addition, no code, schema, or migrations touched.
- Out of scope: None detected.

Self-verification claims:
- [green] check-breadcrumb.mjs validates: ADMIT, CLEAN, exit 0
- [green] Byte delta +35 lines (section F7) matches stated intent
- [green] Contract sections intact (F7 is new finding, not modification to existing contract)
- [green] Anchor still unique (title + contract_version remain unchanged in doc)

Risks Marco should know:
- None. Breadcrumb is operational documentation, gitignored by house rule. F7 documents a passive observation (auto-updater activity on #2071) that Station 00 measured and acted on correctly (by NOT pushing to that branch). The finding includes a falsifying probe for future runs (if auto-updater stops, the branch becomes 00's work).

Recommendation: Merge. Station 00 breadcrumb follows house format and validates cleanly. All CI green. Ready for main.
