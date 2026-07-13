# PR prompt — doc-reconcile: <one-line summary>

Branch: `docs/sot-<slug>`. New PR.

## Standing rule

A doc-reconcile PR touches **only** `sot/` and `docs/`. Nothing else.
No code, no scripts, no workflows, no package manifests. CP-24 (`sot-purity`)
enforces this at the CI layer — mixing code with `sot/` in the same PR is a
hard block with no escape hatch.

## Why this PR exists

<Short paragraph: what triggered the reconcile. Usually one of:
 - A code PR wanted to append a lesson to `sot/05` and CP-24 blocked it.
 - A governance/roadmap update was noted mid-work and parked here.
 - An incident retrospective needs to land in the ledger.
Name the originating PR / commit / incident so future readers can trace it.>

## Target SoT file(s)

<Name each SoT file this PR edits and the section within it. E.g.:
 - `sot/05-decisions-and-lessons.md` — new entry LL-nn at the tail of the
   "Lessons learned" section.
 - `sot/02-roadmap-and-status.md` — update CP-24 row in the "PR gates"
   table (status column).>

## Content to append / update

<Put the EXACT text to insert, in the exact place. If you are appending to
`sot/05`, include the LL-nn heading and body verbatim. If you are updating
a table row, include the full replacement row. The PR-watcher will land
this without paraphrasing.>

## Gates

`pnpm build`, `pnpm lint`. No schema, no migration, no seed, no app code.

CP-24 will PASS because only `sot/` (and optionally `docs/`) are touched.

## Do NOT auto-merge

SoT changes → Marco reviews.
