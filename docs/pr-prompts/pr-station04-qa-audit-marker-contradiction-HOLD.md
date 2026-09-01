---
premise: grep -q "docs/qa/ state files (all gitignored)" docs/pipeline/stations/04-scanner.md
premise_means: 04-scanner.md still claims every docs/qa/ state file is gitignored, which is false for docs/qa/qa-github-audit.md.
scope:
  - docs/pipeline/stations/04-scanner.md
done_when: node scripts/pipeline/lint-station.mjs && ! grep -q "docs/qa/ state files (all gitignored)" docs/pipeline/stations/04-scanner.md
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# Station 04's own doc tells it to create a tracked file, then forbids tracked writes

## The defect

Two lines of `docs/pipeline/stations/04-scanner.md` contradict each other, and the contradiction
has silently disabled the Part 1 GitHub-reconciliation marker.

- **L209 (Part 1a)** — *"Recently merged PRs since the marker in `docs/qa/qa-github-audit.md`
  (create if absent, one dated block per run)"*.
- **L232 (HARD RULES)** — *"Tracked-file writes: NONE except staged prompt files and `docs/qa/`
  state files **(all gitignored)**."*

The parenthetical is false. `.gitignore:107-111` names exactly five `docs/qa/` paths
(`qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md`, `.qa-run.lock`, `qa-run-*.md`).
`docs/qa/qa-github-audit.md` is **not** one of them, so creating it is a tracked write — which L232
forbids. A station obeying both lines can only skip the marker.

## Evidence [MEASURED] 2026-09-01T10:2xZ @ origin/main 605aca10

```
git check-ignore -q -- docs/qa/qa-github-audit.md   -> exit 1  (NOT ignored)
git ls-files --error-unmatch docs/qa/qa-github-audit.md -> exit 1  (NOT tracked)
Test-Path docs/qa/qa-github-audit.md                -> False    (does not exist on disk)
```

Positive control, same probe, on a file the sentence IS true about:

```
git check-ignore -q -- docs/qa/qa-findings.md       -> exit 0  (ignored, as claimed)
```

So the sentence is true of four of the five and false of the file Part 1 actually depends on.
The marker file has never been created; every Part 1 run has re-scanned from no baseline.

## The work

1. In `docs/pipeline/stations/04-scanner.md` L232, replace
   `docs/qa/ state files (all gitignored)` with the accurate enumeration —
   `the five gitignored docs/qa/ state files named at .gitignore:107-111` — so the sentence stops
   asserting something false about the whole folder.
2. Decide L209's home in the same edit. Preferred (complete + additive, RULE 1): repoint the Part 1
   marker at the **tracked breadcrumb** the REPORT CONTRACT already mandates — the run's own
   `docs/pr-prompts/00-04-scanner-*.md` — and delete the `docs/qa/qa-github-audit.md` reference, so
   Part 1's baseline lives where every other Station 04 finding already lives and is visible to
   `origin/main` readers. The alternative — adding `docs/qa/qa-github-audit.md` to `.gitignore` —
   fixes the contradiction but fails the *future* half of RULE 1: the marker stays invisible to
   every station that reads `origin/main`, which is the exact failure mode
   `.gitignore:108` already caused for nine days.
3. Do **not** touch anything between `CANONICAL-BLOCK` (L15) and `END-CANONICAL-BLOCK` (L137) —
   `lint-station.mjs` hard-fails any edit there and the two lines above are both outside it.

## Not in scope

- `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` (L186) also does not resolve, but that line
  **says so itself** and cites the deleting commit. It is a correct historical note, not drift.
  Leave it.
- The dangling `docs/pr-prompts/triage-state.md`, `queue-watch-state.md` and
  `AWAITING-MARCO-DECISION.md` references in `00-supervisor.md` / `02-board-driver.md` /
  `03-machine-minder.md` are a separate finding with a different owner. Do not fold them in — this
  prompt stays docs-only and single-file so the `tests|docs` auto-merge lane can take it.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
