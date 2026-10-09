---
premise: '! grep -q "ESCAPEE_OPEN_PR_CROSSCHECK_V1" scripts/pipeline/status-sweep.ps1'
premise_means: status-sweep.ps1 still calls a worktree-registry escapee prunable on age and emptiness alone, and still stamps its closing SWEEP COMPLETE line with the generation timestamp instead of a second clock read.
requires_merged: 2294
scope:
  - scripts/pipeline/status-sweep.ps1
  - scripts/pipeline/__tests__/status-sweep-escapee-crosscheck.test.mjs
  - docs/pr-prompts/superseded/pr-sweep-escapee-crosscheck-and-completion-stamp-HOLD.md
done_when: pnpm lint && node --test scripts/pipeline/__tests__/status-sweep-escapee-crosscheck.test.mjs && grep -q "ESCAPEE_OPEN_PR_CROSSCHECK_V1" scripts/pipeline/status-sweep.ps1
size: 3
gate_allow: none
seed_only: false
escalates: false
module: pipeline
---

# status-sweep - cross registry escapees against open PR heads, and stamp completion from a second clock read

## The two defects this removes

Both were measured by Station 03 on 2026-10-09T23:03Z (breadcrumb
`00-03-machine-minder-2026-10-09-2303-forty-eight-commits-of-clone-drift-carry-no-watcher-code-and-the-sweep-brands-a-live-worktree-an-escapee.md`,
F2 and F3) and collected by Station 00 at 23:15Z. Neither is an instrument lie about a value - both
are a true reading presented as a stronger claim than it supports.

**1. A live worktree is offered for pruning.** Section 2 prints
`REGISTRY-ESCAPEE: <path>  size=0KB  age=<n>min` and then the standing line
`worktree-registry-escapees: N found -- Station 03 should review and prune if confirmed dead`.
On that run one of the three was `C:\PR-Master\worktrees\sweep-section5`, `age=211min` - the working
directory of **open PR #2294**, whose head branch is `fix/sweep-section5-dedupe-and-fast-switch`.
The size and age readings were correct; the classification was not. Age plus emptiness does not
establish death, and a prune on the sweep's own prompt would have attacked the live fix to the sweep.

**2. The closing verdict carries the opening timestamp.** On the same board, Station 00's 23:15Z run
measured `STATUS SWEEP -- generated 2026-10-09 23:15:12Z` and `SWEEP COMPLETE 2026-10-09 23:15:12Z`
with a reported runtime of **191.41s**, and the shell clock read `2026-10-09T23:18:58Z` on the next
command. So section 7's SAFE-TO-ACT verdict was evaluated at least three minutes after the timestamp
printed beside it. The station contract's own rule is that `[LIVE]` means *true when measured*, and
the 2026-08-22 incident it cites had a whole chain disappear 161 seconds after a sweep said it was
running - the same order of magnitude as this understatement. A reader re-measuring "immediately
before acting" against the printed stamp believes the verdict is fresher than it is.

## Build this

Two changes inside `scripts/pipeline/status-sweep.ps1`, plus one test file.

1. **Cross every escapee candidate against open PR head branches before calling it dead.** Read the
   open PR heads once (`gh pr list --state open --json number,headRefName`, raw `--json` plus
   `ConvertFrom-Json` - never an escaped `--jq` string from PowerShell 5.1, DOCTRINE section 9.4).
   For each registry escapee, if its directory name or its recorded branch matches an open PR's head
   branch, print it as **IN USE BY OPEN PR #N - not prunable**, not as an escapee. Leave the
   genuinely unmatched ones reported exactly as they are today. Mark the new behaviour with the
   literal token `ESCAPEE_OPEN_PR_CROSSCHECK_V1` in a comment beside the cross-check so a future
   reader and the premise above can both find it.
   **Also reword the standing line** so it names Station 00 as the actor and Station 03 as the
   reporter: Station 03 is REPORT-ONLY by its own station doc and by
   `STATION-CAPABILITIES.md` section 5 (*Repair the machines* -> 03 is report-only), so a line
   instructing 03 to prune tells a station to break its lane, with the same authority as every
   `[LIVE]` fact above it.
2. **Stamp the closing line from a second clock read.** Print both, so the span is visible:
   `SWEEP COMPLETE <completed UTC> (generated <generated UTC>, elapsed <n>s)`. Do not change the
   opening line's wording.

Add `scripts/pipeline/__tests__/status-sweep-escapee-crosscheck.test.mjs` asserting, at minimum:

- an escapee whose name matches an open PR head branch is reported as in use and NOT offered for
  pruning, and the PR number appears in that line;
- an escapee matching no open PR head is still reported as an escapee;
- the closing line carries a completion timestamp distinct from the generation timestamp when the
  run takes measurable time, and both values are present.

## Do NOT

- Do NOT delete, prune or `git worktree remove` anything. This PR changes a report, not the disk.
- Do NOT change any other section's readings, tags or wording, and do NOT weaken the escapee report
  for the unmatched candidates.
- Do NOT edit `scripts/pipeline/instrument-lane.json` - the allowlist is Marco's.
- Do NOT touch anything under `sot/`, `apps/`, `prisma/`, `.github/`, `scripts/pr-gates/` or
  `scripts/pr-watcher/`.
- Do NOT weaken, skip or quarantine any existing test to make the new one pass (DOCTRINE section 8.2:
  a quick fix is only ever a legitimate unblock, never a mask).

## VERIFY before opening the PR

```
pnpm lint
node --test scripts/pipeline/__tests__/status-sweep-escapee-crosscheck.test.mjs
git diff --name-only origin/main    # must list exactly the three paths in scope
grep -n "ESCAPEE_OPEN_PR_CROSSCHECK_V1" scripts/pipeline/status-sweep.ps1
```

Then run the script and confirm the closing verdict line still appears and now carries two
timestamps:

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/status-sweep.ps1 -SkipSection5
```

**Title the PR** `fix(pipeline): <summary>` - `module: pipeline`, enforced by `check-pr-title.mjs`.

## Expect this PR to need Marco's release

`status-sweep.ps1` is the first entry in `scripts/pipeline/instrument-lane.json`'s `files` allowlist,
so the script itself is in lane. But this prompt's `scope` also names its own retirement path under
`docs/pr-prompts/superseded/`, and the allowlist's `_readme` puts **everything under `docs/`** on the
never-list - and INSTRUMENT_LANE_V1 requires EVERY changed file to be in lane. So the built PR is
expected to report `OUT_OF_LANE` and to need Marco to release it. **Do not work around it**: do not
drop the retirement path from `scope` to buy `IN_LANE`, because a prompt whose `scope` does not name
its own file is never retired by the PR that builds it and stays armable forever. Open the PR, report
the lane verdict, and leave it unmerged.

## Why this is gated on #2294

`requires_merged: 2294` is set deliberately. PR #2294 is the other open change to
`scripts/pipeline/status-sweep.ps1` (section 5 dedupe plus `-SkipSection5`). Two concurrent edits to
the same script is the collision LL-38 records, and the `-SkipSection5` switch this prompt's VERIFY
block uses only exists once #2294 lands. The gate releases itself the moment #2294 is MERGED.

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
