---
premise: '! test -f docs/legacy-ai-providers-investigation.md'
premise_means: >-
  sot/05 has absorbed four standalone documents - an ADR, a system audit, a
  migration audit and an investigation - while still citing their original paths.
  913 of its 1340 lines are absorbed documents; only 149 lines are the incident
  ledger it is named for. The investigation is the one this premise tracks and it
  is absent from main, so the citation dangles.
scope:
  - sot/05-decisions-and-lessons.md
  - docs/adr/0001-unified-tender-comms-panel.md
  - docs/audits/2026-05-02-system-audit.md
  - docs/migration-history-audit.md
  - docs/legacy-ai-providers-investigation.md
done_when: >-
  test -f docs/adr/0001-unified-tender-comms-panel.md && test -f
  docs/audits/2026-05-02-system-audit.md && test -f
  docs/migration-history-audit.md && test -f
  docs/legacy-ai-providers-investigation.md && ! grep -q
  "user-ai-providers.service.ts" sot/05-decisions-and-lessons.md && [ "$(grep -c
  '^## ' sot/05-decisions-and-lessons.md)" -lt 18 ] && [ "$(grep -o 'LL-[0-9a-z]*'
  sot/05-decisions-and-lessons.md | sort -u | wc -l)" -ge 60 ]
size: 5
gate_allow: none
escalates: true
backfill: false
cluster: sot-reference-hygiene
cluster_order: 2
requires_file_on_main: docs/lessons-learned/README.md
rollback_strategy: >-
  One commit moving four sections out of one file into four new files, plus
  citation deletions. git revert restores sot/05 byte-for-byte and removes the
  four new files. No content exists only in this commit - every moved section is
  reproduced verbatim at its new path, which the done_when asserts. Detection is
  immediate: the SLICE 3 checker goes red if a reference is left dangling.
---

# SLICE 2 of 3 — move the absorbed documents out of `sot/05`

**`escalates: true`. This removes roughly 913 lines from a curated, append-only
governance record. Marco reviews the rendered diff and removes the
`do-not-merge` label himself — automation must never remove it.**

## The measurement, at `origin/main 1fc22a2e`

`sot/05-decisions-and-lessons.md` is 1340 lines across 18 top-level sections.

```
System Audit 2026-05-02                 286 lines
Migration History Audit                 181
Investigation - AI providers            180
Shared company infrastructure           157
Lessons LL-42..LL-56 (from chat memory) 109
------------------------------------------
absorbed documents                      913  of 1340 = 68%
the actual incident-ledger sections      149
```

LL entry sizes: median **407** characters, p90 **1390**, max **52449**. The max is
one of those absorbed blobs sitting in the file as though it were an entry.

**16 of 36 path-shaped references in the file do not resolve.** The pattern is not
random: a consolidation folded standalone documents in and never updated the
pointers. `sot/05` still cites the original paths.

## What to do — and why each move FIXES a reference rather than adding one

Move four sections out, verbatim, to the paths `sot/05` **already cites**:

| section in `sot/05` | destination (already cited) |
|---|---|
| `## Architecture Decision Records (ADRs)` / ADR-0001 | `docs/adr/0001-unified-tender-comms-panel.md` |
| `## System Audit — 2026-05-02` | `docs/audits/2026-05-02-system-audit.md` |
| `## Migration History Audit — 2026-06-19` | `docs/migration-history-audit.md` |
| `## Investigation — Legacy "My Account → AI providers" section` | `docs/legacy-ai-providers-investigation.md` |

**`docs/audits/` already exists (4 entries). `docs/adr/` does not — create it.**

Replace each removed section with a one-line pointer to its new path, so the
ledger still tells a reader the document exists and where it went.

Then delete the citations that have nothing to restore, after verifying each:

```
apps/api/src/modules/tendering/ai-providers/gemini.provider.ts
apps/api/src/modules/tendering/ai-providers/groq.provider.ts
apps/api/src/modules/tendering/tender-scope-drafting.service.ts
apps/api/src/modules/user-ai-providers/user-ai-providers.controller.ts
apps/api/src/modules/user-ai-providers/user-ai-providers.module.ts
apps/api/src/modules/user-ai-providers/user-ai-providers.service.ts
docs/pr-prompts/RECONCILIATION-2026-06-12.md
needs-marco/pr-164a-seed-safety-sequence-reset.md
scripts/branch-prune.ps1
scripts/pr-watcher/.watcher-children.json
```

The six `ai-providers` paths are source files removed from main; deleting the
citation is the whole fix. **Verify the other four individually — do not delete a
citation you have not confirmed dangles.**

## What must NOT change

**The incident ledger itself.** These sections stay byte-identical: Git / repo
integrity · Prisma / database · CI / gates / GitHub behaviours · Watcher /
automation pipeline · Prompt-writing lessons · Build / deploy · Open items. 149
lines. `sot/05` is **append-only for LL entries — never delete one.** The
`done_when` asserts the distinct `LL-nn` count is still **≥ 60**, which is what it
is today.

Also unresolved and **not** for you to decide alone: `sot/05` cites
`docs/lessons-learned/incident-ledger.md`, but `sot/05` itself is now the incident
ledger. Deleting that citation and keeping `sot/05` canonical is the recommended
reading, **but it was not verified against the file's history.** Either verify it
or leave the citation and say so — do not delete it on the strength of this
prompt.

## Prove nothing was lost

The `done_when` checks presence, which is necessary and not sufficient. In the PR
body also show, per moved section:

1. the line count at the source before and at the destination after;
2. a `sha256` of the moved body computed both ways, identical;
3. the `LL-nn` distinct count in `sot/05` before and after, unchanged;
4. `grep -c '^## '` on `sot/05` before and after, showing exactly four fewer.

**A move that is only observed to have created files has not been shown to have
preserved them.**

## What NOT to do

- Do **not** touch `scripts/` or `.github/`. CP-24 hard-fails `sot/` mixed with
  code and there is **no escape hatch** — `codeRe` at `scripts/pr-gates/pr-gates.mjs:327`
  is `/^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/`.
  `docs/` is deliberately absent from it, which is why `sot/` + `docs/` here is
  legal and `sot/` + the SLICE 3 checker would not be.
- Do **not** reflow, reformat or "tidy" the moved bodies. Verbatim.
- Do **not** renumber, merge or reword any `LL-nn` entry.
