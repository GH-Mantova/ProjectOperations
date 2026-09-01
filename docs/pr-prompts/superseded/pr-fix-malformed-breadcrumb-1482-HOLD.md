---
premise: '! grep -q "^## FINDINGS" docs/pr-prompts/00-06-pr-master-2026-09-01-0535-stale-escalations-carried-by-every-sweep.md'
premise_means: The breadcrumb merged by #1482 is still missing the mandatory contract sections, so check-breadcrumb.mjs still REJECTs and CI is still red on main.
scope:
  - docs/pr-prompts/00-06-pr-master-2026-09-01-0535-stale-escalations-carried-by-every-sweep.md
done_when: node scripts/pipeline/check-breadcrumb.mjs && grep -q "^## FINDINGS" docs/pr-prompts/00-06-pr-master-2026-09-01-0535-stale-escalations-carried-by-every-sweep.md
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# Repair the malformed breadcrumb that #1482 landed on main

## Why this is urgent

`scripts/pipeline/check-breadcrumb.mjs` REJECTs
`docs/pr-prompts/00-06-pr-master-2026-09-01-0535-stale-escalations-carried-by-every-sweep.md`
for four missing mandatory sections. That fails the CI job
**`Pipeline - watcher + linter tests`**, which runs on `main` AND on every open PR.

Measured 2026-09-01T06:2xZ at `origin/main` = `000de2d9`:

- `main` CI on `000de2d9`: CI **failure**, Deploy success, CodeQL success, Tendering Browser Smoke success.
- The three preceding main commits (`678c2473`, `b30e166a`, `fd1a8fb5`) each had **zero** failing runs.
  The regression is NEW and it arrived with `000de2d9` (= #1482).
- All 6 open PRs read RED. This one defect is the shared cause.

**A docs-only PR failing a code check means the regression is on MAIN. One fix, not six.**

## The defect, exactly

The breadcrumb carries `## GROUND` and then five headings of its own invention
(`## FOR 00 - the ask`, `## DEFECT 1 ...`, `## DEFECT 2 ...`, `## WHAT ELSE I MEASURED, for the register`,
`## WHAT I AM NOT ASKING FOR`). The contract requires exactly these five, spelled literally:

```
## GROUND
## WHAT I MEASURED
## WHAT CHANGED
## FINDINGS
## WHAT I DID NOT DO
```

`check-breadcrumb.mjs` reports:

```
REJECT  00-06-pr-master-2026-09-01-0535-stale-escalations-carried-by-every-sweep.md
          x missing section: ## WHAT I MEASURED
          x missing section: ## WHAT CHANGED
          x missing section: ## FINDINGS
          x missing section: ## WHAT I DID NOT DO
structure: 11 checked, 1 malformed, 0 skipped as pre-contract
REJECT: 1 malformed breadcrumb(s)
```

Reproduced twice locally, exit 1 both times, same verdict as the CI job log
(run `33474623827`, job `99751201985`).

## The work

Edit that ONE file so it carries all five contract sections, **preserving every existing sentence**.
Do not delete content and do not rewrite the author's findings. The existing headings map cleanly:

- Keep `## GROUND` as it is.
- Put the existing measurement prose (currently under `## WHAT ELSE I MEASURED, for the register`,
  and the measured lines inside the two DEFECT blocks) under `## WHAT I MEASURED`.
- Add `## WHAT CHANGED` - the author states it mutated the board before sweeping and created a
  0-byte `index.lock`; that is what changed. "nothing" is a valid answer only if nothing changed.
- Put the two `## DEFECT` blocks and `## FOR 00 - the ask` under `## FINDINGS`, and make sure each
  finding ends in exactly one literal disposition:
  **ACTIONED / DISPATCHED / ESCALATED / DEFERRED**.
- Rename `## WHAT I AM NOT ASKING FOR` to `## WHAT I DID NOT DO`.

The original `## DEFECT 1` / `## DEFECT 2` headings may remain as `###` subheadings under
`## FINDINGS` - the checker looks for the five `##` sections, not for the absence of others.

**Edit the file with node (`readFileSync` / `writeFileSync`, utf8), never PowerShell**
(DOCTRINE 9.3 - `Set-Content -Encoding UTF8` and `Out-File -Encoding utf8` double-encode; plain `>`
writes UTF-16LE).

## Verify before you open the PR

```
node scripts/pipeline/check-breadcrumb.mjs   # must exit 0
```

Quote the exit code in the PR body. Do not report your impression of it (DOCTRINE 2).

## Scope discipline

This prompt touches exactly ONE file. Do not fix other breadcrumbs, do not touch
`check-breadcrumb.mjs`, do not relax the checker. Blast radius was measured: across every depth-1
`00-*.md` breadcrumb, this is the **only** file missing any of the five sections.

## Note for the station that arms this

The diff is confined to `docs/`, so the watcher's `tests-docs` auto-merge policy can carry it with
no human (DOCTRINE 10.3 prefers arming a docs change over hand-landing it, because hand-landing
produces no review).

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing. In particular: one file, no checker changes, no other breadcrumbs.
