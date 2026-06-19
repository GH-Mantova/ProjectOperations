# Lessons learned

Concrete incidents where a real issue surfaced — Codex review
finding, regression caught in smoke, near-miss in a destructive
operation — captured here so future work doesn't repeat them.

One markdown file per incident, named with the date and a short
slug. Each entry follows the structure:

1. **What happened** — concrete description, with PR / commit
   references where applicable.
2. **Why it matters** — what the realistic blast radius could
   have been.
3. **Lesson** — the rule to apply going forward.
4. **References** — links to PRs, Codex review URLs, commit
   SHAs, related files.

These are not architecture rules (those live in
project_instructions.md §6). These are war stories — pointed
enough to learn from, narrow enough not to over-generalise.

## Entries

The canonical, append-only record of every incident lives in
[incident-ledger.md](./incident-ledger.md) — start there. Standalone per-incident files are kept
only when their detail exceeds what fits a ledger row; right now the ledger absorbs everything,
including the 2026-05-17 migration date-filter precision case (see entry `LL-07a`).
