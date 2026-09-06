---
premise: '! grep -q "OPEN_PR_DUPLICATE_V1" scripts/pipeline/triage-holds.ps1'
premise_means: >-
  triage-holds.ps1 is the instrument Station 00 reads before deciding what to arm, and it files a
  prompt into CANDIDATES on the linter exit code alone. The linter asks only whether the premise
  still holds. For work that reached the board through a SECOND LANE (DOCTRINE 10.2) the premise
  does still hold, because a second lane never consumes the queue file - so a prompt whose work is
  already OPEN as a PR is reported as a fresh candidate, and arming it opens a duplicate PR for
  work already on the board. DOCTRINE 10.6 records the defect and prescribes the cure as a manual
  step - cross the prompt's scope list against gh pr list --state open - which no instrument runs.
  MEASURED 2026-09-06T13:3xZ at a65ab1d4 by Station 00 - SIX of the seven open PRs were an exact
  scope-list match to a live queue prompt, and every one of those six prompts was armable - five
  ADMIT and one PROMOTE. On 2026-09-05 the same scan found two. The manual step is not being run
  because nothing prints it where the arming decision is made.
requires_on_main: 'scripts/pipeline/triage-holds.ps1 :: SPENT_BEHIND_A_REJECT_V1'
scope:
  - scripts/pipeline/triage-holds.ps1
done_when: >-
  pnpm lint && grep -q "OPEN_PR_DUPLICATE_V1" scripts/pipeline/triage-holds.ps1 && powershell
  -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/triage-holds.ps1
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
rollback_strategy: >-
  One additional read-only reporting bucket in a PowerShell script that mutates nothing. No schema,
  no migration, no data, no watcher change, no change to lint-prompt.mjs, and no change to any
  existing verdict or exit code. The new code only moves a prompt from the CANDIDATES heading to a
  new DUPLICATES heading in the printed report; it cannot cause a prompt to be armed, binned,
  renamed, skipped or deleted, because triage-holds.ps1 does not mutate anything. `git revert`
  restores the previous output exactly. If the gh call fails the bucket must report UNKNOWN and
  leave every prompt in its current bucket - a failed lookup must never silently empty CANDIDATES.
---

# A prompt whose work is already open as a PR is still reported as a CANDIDATE

## What is wrong

`scripts/pipeline/triage-holds.ps1` classifies every depth-1 `-HOLD.md` by the exit code of
`scripts/pipeline/lint-prompt.mjs`. That exit code answers exactly one question: **does the premise
still hold?** It cannot answer the different question an arming run actually needs: **has this work
already reached the board?**

For watcher-built work the two questions coincide, because the watcher DELETES the prompt when it
builds it. For a **second lane** (DOCTRINE 10.2 — a cloud session that clones, branches and opens a
PR without the watcher, the dev tree or the queue) they come apart: the prompt is never consumed,
its premise stays true for as long as the PR is unmerged, and the linter therefore keeps returning
ADMIT — or, worse, PROMOTE — on work that is already open.

DOCTRINE 10.6 records this and gives the cure as a manual step: cross the prompt's `scope:` entries
against `gh pr list --state open --json number,files`. **Nothing runs it.** It is prescribed in a
document, at the moment of the arming decision, in a run that is reading a different script's
output.

### The measurement this prompt exists for

[MEASURED] 2026-09-06T13:3xZ at `a65ab1d4`, Station 00, seven open PRs, all seven established as
second lane (the watcher's launch log had `opened PR #<n>` for none of them; POSITIVE control
`opened PR #` → 915 hits):

| open PR | queue prompt | scope match | linter verdict |
|---|---|---|---|
| #1722 | `pr-lint-requires-merged-gate-unevaluated-HOLD.md` | 3 of 3 | ADMIT |
| #1721 | `pr-ci-rerun-on-unlabel-HOLD.md` | 1 of 1 | ADMIT |
| #1719 | `pr-ew-s2c-alloc-rejection-path-HOLD.md` | 2 of 2 | ADMIT |
| #1717 | `pr-watchdog-dead-inprog-guard-HOLD.md` | 1 of 1 | ADMIT |
| #1713 | `pr-linefields-s1-model-and-validation-HOLD.md` | 9 of 9 | **PROMOTE** |
| #1699 | `pr-rates-value-column-units-HOLD.md` | 2 of 3 | ADMIT |

**`PROMOTE` is the strongest arm signal the linter emits** — it says the gate is released and the
HOLD is ready. It was pointing at work that had been open as #1713 since 11:46Z.

The count has gone **1 → 6 in four hours** (the 09:08Z run filed the #1699 instance alone), and it
grows with second-lane throughput, not with queue depth. A second actor arms this queue
concurrently, so this is not a hypothetical.

### Why the false-positive rate is acceptable HERE and not over merged PRs

The same run cross-checked the chain siblings and the discriminator held on its own:
`pr-linefields-s2-...-HOLD.md` and `pr-linefields-s3-...-HOLD.md` share files with #1713 and
scored 2 of 2 and 3 of 5, but both `REJECT [GATE_NOT_RELEASED]` — they are later slices, not
duplicates, and their own gates already withhold them. The bucket must therefore be computed
**only over prompts the linter already admits**, which is what keeps chain siblings out of it.

DOCTRINE 10.6 also records, with controls, that this same file-overlap test has a false-positive
rate that swamps it when run against **merged** PRs. **This bucket must query `--state open` only.**

## Do

1. In `scripts/pipeline/triage-holds.ps1`, after the existing per-prompt lint classification and
   **only for prompts already in the ADMIT/PROMOTE bucket**, read the open board once:
   `gh pr list --state open --json number,title,headRefName,files`. Assign the result to a
   variable and count it with `@($rows).Count` — never `@(ConvertFrom-Json ...).Count`, which
   answers `1` for an empty array and `1` for a forty-element one (DOCTRINE 9.4).
2. Parse each admitted prompt's `scope:` list from its front matter and mark the prompt
   **OPEN_PR_DUPLICATE** when every `scope:` entry is present in one open PR's file list. Report a
   partial match (at least two entries, and at least 60 percent) as **OPEN_PR_OVERLAP**, in the
   same bucket but named differently — an overlap is a question, a full match is an answer.
3. Print a new heading `DUPLICATES OF AN OPEN PR — DO NOT ARM`, one line per prompt naming the PR
   number and the match ratio, and **remove those prompts from the CANDIDATES heading** so the
   arming decision cannot read them as fresh work. Leave the file on disk untouched.
4. Carry the literal token `OPEN_PR_DUPLICATE_V1` in a comment beside the new block, so the
   premise above can die.
5. **Fail loud, never quiet.** If the `gh` call fails or returns nothing, print
   `OPEN_PR_DUPLICATE: UNKNOWN — could not read the open board` and leave every prompt in the
   bucket the linter put it in. A lookup failure must never silently empty CANDIDATES, and it must
   never silently pass a duplicate through as a candidate (DOCTRINE 7, and 9.6 — an empty result is
   not an empty world).
6. Include a POSITIVE control in the script's own output: print the number of open PRs read and the
   number of admitted prompts scanned. A bucket that reports zero duplicates while having read zero
   PRs is indistinguishable from a clean board, which is the failure this whole section exists for.

## Acceptance

- `pnpm build` and `pnpm lint` pass.
- `grep -q "OPEN_PR_DUPLICATE_V1" scripts/pipeline/triage-holds.ps1` succeeds.
- Running the script prints the new heading, the PR count and the admitted-prompt count, and the
  CANDIDATES total drops by exactly the number of prompts moved into the new bucket.
- Chain siblings whose own gate is unreleased are absent from the new bucket, because the bucket is
  computed only over prompts the linter admitted.
- With `gh` unavailable (simulate by pointing `PATH` away from it), the script prints the UNKNOWN
  line and every prompt stays in its linter bucket. The script still exits 0 — it is a report.

## STANDING AUTHORITY

Ordinary staged prompt. Not a never-arm prompt. It touches one read-only reporting script, mutates
nothing, and is chained on `SPENT_BEHIND_A_REJECT_V1` so that the two changes to
`triage-holds.ps1` cannot collide.
