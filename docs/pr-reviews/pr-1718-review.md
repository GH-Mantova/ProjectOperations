VERDICT: MERGE

Scope compliance:
- In scope: Station 00 Supervisor COLLECT PR collecting five breadcrumbs (two previously untracked), rotating sweep state, and recording findings F1–F7 as additive operational docs. Edits to STATION-CAPABILITIES.md (one safety clause re: mount mtimes), sweep-rotation.json (state advanced by Station 04 per its instruction), and pr-rates-s11c-drop-legacy-tables-HOLD.md (one done_when clause, additive fix to address dead gate per F5). Docs-only; no code, migrations, or sot/ drift.
- Out of scope: None. All files in Station 00's lane (docs/pipeline/, docs/pr-prompts/), no over-reach detected.

Self-verification claims:
- check-breadcrumb.mjs → CLEAN, exit 0 ✓
- lint-station.mjs → ADMIT: all 8 docs clean, exit 0 ✓
- lint-prompt.mjs on rates-s11c → REJECT [FILE_GATE_NOT_RELEASED], exit 1 ✓ (pre-existing, correct)
- Byte deltas asserted on both doc edits (STATION-CAPABILITIES.md +1022 B vs +1008 B intended; pr-rates-s11c +1098 B vs +1094 B intended; CRLF conversions account for deltas) ✓
- No unauthorized mutations: no git writes in C:\po-watcher\ProjectOperations, no prompt arms, no labels, no approval files, no sot/ edits ✓

Risks Marco should know:
- None. This is a COLLECT PR recording measurements and findings; no irreversible actions taken. F1 and F2 are dispatched to Station 03 (clone fast-forward and wrapper leak cleanup), not acted in this PR. F3 hand-classifies four open PRs as Marco's; no merge attempted.

Recommendation: Safe to merge — scope clean, CI green, self-verification passed, no code risk.
