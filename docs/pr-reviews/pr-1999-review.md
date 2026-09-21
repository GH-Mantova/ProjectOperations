VERDICT: MERGE

Scope compliance:
- In scope: All four required documents added/updated per prompt specification.
  - docs/pipeline/QUEUE-LAYOUT.md (new): carries QUEUE_LAYOUT_V1 marker, defines six states with correct table, explains fsWatch constraint on line 27, distinguishes merged from processed, names closed exceptions vocabulary, notes reports belong in reports/, affirms nothing is deleted.
  - docs/pipeline/DOCTRINE.md (modified): added "Queue layout" summary section (8.5) with complete table and reference to QUEUE-LAYOUT.md (3 citations total).
  - docs/pipeline/PR-MASTER.md (modified): drafts lifecycle section rewritten to show in-repo draft location (docs/pr-prompts/draft/), preserves old paragraph with explicit superseding notice dated 2026-09-17, explains why out-of-repo rule changed.
  - docs/pr-prompts/README.md (new): six states in one-line table, pointer to QUEUE-LAYOUT.md, note that root files matching *-HOLD.md and *-ready.md are state filenames.

- Out of scope (expected system artifact): docs/decisions/merge-approvals/1999.md
  This is an auto-generated approval receipt written by the gate system (CP-26), not part of the authored scope. It documents the approval metadata and verification performed by the approval system. Not a violation of the "four documents" constraint.

Self-verification claims (from done_when, line 9):
- [green] node scripts/pipeline/lint-station.mjs passes with "ADMIT: all 8 docs clean"
- [green] node scripts/pipeline/check-breadcrumb.mjs passes with "CLEAN"
- [green] test -f docs/pipeline/QUEUE-LAYOUT.md exists
- [green] grep -q "QUEUE_LAYOUT_V1" docs/pipeline/QUEUE-LAYOUT.md found (line 3, HTML comment)
- [green] grep -q "QUEUE-LAYOUT.md" docs/pipeline/DOCTRINE.md found (3 citations on lines 310, 330, 340)
- [green] grep -q "QUEUE-LAYOUT.md" docs/pipeline/PR-MASTER.md found (line 14 in superseding notice)
- [green] git diff HEAD~1..HEAD --name-only matches exactly the four prompt-scoped files plus the auto-generated approval receipt

Risks Marco should know:
- None. This is a documentation-only, non-enforcing standard. S4 will add the enforcement gate; S3 will migrate existing queue files. The PR correctly documents the intended standard without taking any mechanical action. Merge-approval receipt (CP-26) is an expected side effect of the approval system, not a deviation.

Recommendation: PR is complete, CI green, scope clean, self-verification passed. Safe to merge (already MERGED as of enqueue time, 2026-09-17T09:27 UTC).
