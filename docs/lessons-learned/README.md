# Lessons learned

This directory holds standalone per-incident files that capture concrete incidents where a real
issue surfaced — a review finding, a regression caught in smoke, a near-miss in a destructive
operation — so future work does not repeat them. Each file supplements the incident ledger in
`sot/05-decisions-and-lessons.md`, which is the canonical, append-only record. Start there.

## File conventions

One markdown file per incident, named with the date and a short slug:

    YYYY-MM-DD-short-slug.md

When a single day produces multiple related incidents, they may share one file (using sub-headings
for each incident) if grouping aids comprehension. The slug should be descriptive enough to
identify the incident at a glance.

## Structure

Each entry follows this four-part structure, in order:

1. **What happened** — concrete description, with PR / commit references where applicable.
2. **Why it matters** — what the realistic blast radius could have been.
3. **Lesson** — the rule to apply going forward.
4. **References** — links to PRs, review URLs, commit SHAs, related files.

Multi-incident files repeat the four-part block for each sub-incident and share a single
References section at the end.

## Not architecture rules

These files are war stories — pointed enough to learn from, narrow enough not to over-generalise.
Architecture rules — the durable, project-wide constraints — live in
`sot/01-charter-and-architecture.md` §6. If a lesson hardens into a policy that belongs
everywhere, it migrates there; it does not stay here.

## Relationship to the ledger

`sot/05-decisions-and-lessons.md` is the canonical, append-only ledger. A standalone file in this
directory is kept only when the detail of an incident exceeds what fits a ledger row. Every
standalone file must be cited by a ledger row so the two cannot drift apart silently. A file
that exists here without a corresponding ledger citation is orphaned and will not be found by
anyone starting with `sot/05` — which is where every reader starts.
