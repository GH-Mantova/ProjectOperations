---
premise: '! grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1'
premise_means: status-sweep.ps1 has no way to skip or shorten section 5, so its closing SAFE / CAUTION / DO-NOT-ACT verdict is unreachable inside a station run.
scope:
  - scripts/pipeline/status-sweep.ps1
  - scripts/pipeline/__tests__/status-sweep-section5.test.mjs
  - docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md
done_when: pnpm lint && node --test scripts/pipeline/__tests__/status-sweep-section5.test.mjs && grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1
size: 3
gate_allow: none
seed_only: false
escalates: false
module: pipeline
---

# status-sweep section 5 - dedupe the PR crawl and add a fast-exit switch

## The defect this removes

`scripts/pipeline/status-sweep.ps1` is the pipeline's safe-to-act gate. Its closing line is a
**SAFE / CAUTION / DO-NOT-ACT** verdict, and every station is told to obey it. That verdict sits
after section 5, and **section 5 does not finish inside a station run.**

Measured by Station 00 on four consecutive hourly occurrences (2026-10-09 at 14:27Z, 15:27Z, 16:14Z
and 17:14Z, breadcrumbs landed as #2286, #2287, #2289 and the 1714 report): each run was still
enumerating when its reading budget ran out, so **each one had to write "I quote no sweep verdict."**
A gate whose verdict no caller ever reaches is a gate that is not in force.

The cause is in section 5's shape, not its purpose. It re-checks every `#N` reference inside
`docs/pr-prompts/needs-marco/` against GitHub by calling `gh pr view <n> --json state,isDraft,mergedAt`
**once per occurrence of the number**, not once per number. Measured 2026-10-09T16:29Z by Station 00:
**383 occurrences, 153 distinct numbers, across 52 files** - so roughly 230 of those round trips ask
GitHub a question it has already answered in the same run.

## Build this

Three changes, all inside `scripts/pipeline/status-sweep.ps1`, plus one test file.

1. **Cache the per-PR answer.** Ask each DISTINCT PR number at most once per run. Key a hashtable on
   the number, populate it on first ask, and read every later reference out of the cache. The
   reported readings must be byte-identical to what section 5 reports today - this is a
   de-duplication, not a change of meaning. `[LIVE]` stays `[LIVE]`; a cached answer was still
   fetched live in this same run.
2. **Add a `-SkipSection5` switch parameter.** When passed, skip the crawl entirely and print one
   line naming the section as skipped and why, so a reader can never mistake a skipped section for
   an empty one. DOCTRINE section 9.6: an empty result is not an empty world, and a skipped section
   must not read as a clean one. **The default run is unchanged** - section 5 still runs when the
   switch is absent.
3. **Print a per-section elapsed line.** One line per section, so the next station can see where the
   time actually goes instead of inferring it.

Add `scripts/pipeline/__tests__/status-sweep-section5.test.mjs` asserting, at minimum:

- a repeated PR number produces exactly ONE lookup (the cache works);
- `-SkipSection5` suppresses the crawl AND still emits the skipped-section line;
- the closing verdict line is still produced in both modes.

## Do NOT

- Do NOT remove section 5 from the default run, or change what it reports when it does run.
- Do NOT change any other section's readings, tags or wording.
- Do NOT edit `scripts/pipeline/instrument-lane.json` - the allowlist is Marco's.
- Do NOT touch anything under `sot/`, `apps/`, `prisma/`, `.github/`, `scripts/pr-gates/` or
  `scripts/pr-watcher/`.
- Do NOT weaken, skip or quarantine any existing test to make the new one pass (DOCTRINE section 8.2:
  a quick fix is only ever a legitimate unblock, never a mask).

## VERIFY before opening the PR

```
pnpm lint
node --test scripts/pipeline/__tests__/status-sweep-section5.test.mjs
git diff --name-only origin/main    # must list exactly the three paths in scope
grep -n "SkipSection5" scripts/pipeline/status-sweep.ps1
```

Then run the script BOTH ways and confirm the closing verdict line appears in each:

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/status-sweep.ps1 -SkipSection5
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/status-sweep.ps1
```

**Title the PR** `fix(pipeline): <summary>` - `module: pipeline`, enforced by `check-pr-title.mjs`.

## Expect this PR to need Marco's release

`status-sweep.ps1` IS the first entry in `scripts/pipeline/instrument-lane.json`'s `files`
allowlist, so the script itself is in lane. But this prompt's `scope` also names its own retirement
path under `docs/pr-prompts/superseded/`, and `instrument-lane.json`'s `_readme` puts **everything
under `docs/`** on the never-list - and INSTRUMENT_LANE_V1 requires EVERY changed file to be in
lane. So the built PR is expected to report `OUT_OF_LANE` and to need Marco to release it.

That interaction is itself open with Marco as F77 of the Station 00 breadcrumb dated 2026-10-09
1714Z. **Do not try to work around it**: do not drop the retirement path from `scope` to buy
`IN_LANE`, because a prompt whose `scope` does not name its own file is never retired by the PR that
builds it and stays armable forever - the defect PROMPT-SCHEMA's self-retirement rule exists to stop,
re-found five times before it was fixed. Open the PR, report the lane verdict, and leave it for Marco.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
**Finishing the work and then asking for permission is indistinguishable from failing.**

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Read the job log before diagnosing any CI failure (DOCTRINE section 3: never diagnose from the diff).
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, production
  data, any irreversible action.
- **Budget.** One script, one test file, one retirement rename.
