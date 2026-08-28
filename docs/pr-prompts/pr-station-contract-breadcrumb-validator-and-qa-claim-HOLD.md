---
premise: '! grep -q "check-breadcrumb" docs/pipeline/stations/06-pr-master.md'
premise_means: >-
  The REPORT CONTRACT block that every station reads names no validator for breadcrumbs, and asserts
  that docs/qa/ is not tracked. The first gap let a station quote lint-prompt.mjs and report a pass it
  never received; the second is false - six files under docs/qa/ are tracked on origin/main.
scope:
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/02-board-driver.md
  - docs/pipeline/stations/03-machine-minder.md
  - docs/pipeline/stations/04-scanner.md
  - docs/pipeline/stations/05-sot-keeper.md
  - docs/pipeline/stations/06-pr-master.md
  - docs/pipeline/stations/_canonical-blocks.json
done_when: >-
  grep -q "check-breadcrumb" docs/pipeline/stations/06-pr-master.md && ! grep -q
  "docs/qa/\` is not" docs/pipeline/stations/06-pr-master.md && node
  scripts/pipeline/lint-station.mjs
size: 8
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# REPORT CONTRACT: name the breadcrumb validator, and stop asserting `docs/qa/` is untracked

`## REPORT CONTRACT` lives inside the `station-contract v1` CANONICAL BLOCK (`06-pr-master.md:15`
to `:110`), which is **byte-identical in every station doc** and hash-recorded in
`_canonical-blocks.json`. Both fixes below are edits to that block, so they must be made identically
in all of them and the hashes re-recorded.

## Fix 1 — the block names no validator for breadcrumbs

Station 00's 02:08Z run reported its breadcrumb as "ADMIT-clean". Its 04:08Z run retracted that: the
result had come from `lint-prompt.mjs`, which treats every file in `docs/pr-prompts/` as a prompt and
rejects a breadcrumb for having no YAML front matter. **The real validator is
`scripts/pipeline/check-breadcrumb.mjs`**, which enforces the five sections this very block
specifies, and which runs in CI inside "Pipeline — watcher + linter tests".

The block tells stations what shape to write and where to put it, but never tells them what checks
it. Add that: `check-breadcrumb.mjs` validates breadcrumbs; `lint-prompt.mjs` never does, in either
direction, and its verdict on a breadcrumb must not be quoted as evidence of anything. State plainly
that the claim is only made after the command has actually been run.

## Fix 2 — `docs/qa/` is not untracked, and the block says it is

Current text, verbatim:

> `docs/pr-prompts/` is tracked. `docs/qa/` is not, and neither is anything under
> `processed|failed|paused|blocked|awaiting-review|reviewed|needs-marco`

**Measured 2026-08-28 against `origin/main`:**

```
.gitignore:106  docs/qa/qa-checklist.md
.gitignore:107  docs/qa/qa-findings.md
.gitignore:108  docs/qa/qa-test-data-registry.md
.gitignore:109  docs/qa/.qa-run.lock
.gitignore:110  docs/qa/qa-run-*.md

git ls-tree origin/main docs/qa/  ->  6 tracked files, including
                                      docs/qa/sot-refs-baseline.json   (shipped in #1362,
                                      and CI runs a ratchet against it)
```

`.gitignore` names **five specific files**, not the directory. Correct the sentence to say so.

**Keep the warning that is true.** `docs/qa/qa-findings.md` really is gitignored, at `.gitignore:107`
exactly as cited, and the nine-day loss of five consecutive Station 04 findings really happened. That
paragraph stays; only the over-broad directory claim is wrong. The lesson is "these five files are a
sink", not "docs/qa/ is a sink".

## Do

1. Make both edits inside the `CANONICAL-BLOCK: station-contract v1` markers, **byte-identical in all
   seven station docs**. `lint-station.mjs` compares them and will reject any drift.
2. Re-record the block hash deliberately:
   `node scripts/pipeline/lint-station.mjs --write-canonical`, and commit the resulting
   `_canonical-blocks.json` in the same PR.
3. Finish with a clean `node scripts/pipeline/lint-station.mjs` — it must print `ADMIT: all 7 docs
   clean`.

## Do NOT

- **Do NOT bump `station_doc_version` or `contract_version`.** Both are `1`, and the scheduled-task
  bootstraps under `C:\Users\Marco\Claude\Scheduled\*\SKILL.md` also say `1`. A station whose doc
  version disagrees with its bootstrap goes **read-only for the whole run** — bumping here would
  silently freeze every station, and the bootstraps live outside this repo where no agent can reach
  them. If you believe a bump is genuinely required, say so in the PR body and leave the numbers
  alone.
- Do **not** edit anything else inside the canonical block. Two corrections, nothing more.
- Do **not** delete the `qa-findings.md` warning or the nine-days-unread story. The failure it
  records is real and is the reason the contract exists.
- Do **not** change `.gitignore`. The five entries are correct as they stand; the doc is what is
  wrong.

## Verification

- `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 7 docs clean`, exit 0.
- `grep -c "check-breadcrumb" docs/pipeline/stations/*.md` → 7, one per station doc.
- The over-broad `docs/qa/` clause is gone from all seven, and the `.gitignore:107` citation for
  `qa-findings.md` is still present.
- `git diff --stat` shows the same line counts for all seven docs — proof the block stayed identical.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
