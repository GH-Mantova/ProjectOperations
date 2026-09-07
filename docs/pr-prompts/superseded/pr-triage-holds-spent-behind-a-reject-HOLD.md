---
premise: '! grep -q "SPENT_BEHIND_A_REJECT_V1" scripts/pipeline/triage-holds.ps1'
premise_means: >-
  triage-holds.ps1 classifies every depth-1 -HOLD.md prompt by the EXIT CODE of
  scripts/pipeline/lint-prompt.mjs, and nothing else: exit 0 ADMIT, exit 3 SPENT, exit 1 REJECT.
  But lint-prompt.mjs evaluates the premise LAST. Four rejection paths fire BEFORE runPremise is
  ever called, so a prompt that hits any of them exits 1 with its premise never executed - and a
  prompt whose premise is never executed can never be reported SPENT, however completely its work
  has already shipped. The TOTALS line therefore prints spent=N of ALL prompts while only the
  ADMIT bucket was ever eligible to be counted spent. This is not the SPENT positive control the
  script already has: that control proves the SPENT branch is reachable on a fixture, which it is.
  What is unmeasured is the 41 real board prompts the linter rejected before it looked.
scope:
  - scripts/pipeline/triage-holds.ps1
done_when: >-
  pnpm lint && grep -q "SPENT_BEHIND_A_REJECT_V1" scripts/pipeline/triage-holds.ps1 && powershell
  -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/triage-holds.ps1
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
rollback_strategy: >-
  One new bucket and one corrected denominator in a single read-only PowerShell reporting script.
  No schema, no migration, no data, no watcher change, no change to lint-prompt.mjs and no change
  to any existing verdict or exit code. `git revert` restores the previous output exactly. The new
  code only ever ADDS a heading and re-words a totals line; it cannot cause a prompt to be armed,
  binned, renamed or skipped, because triage-holds.ps1 does not mutate anything.
---

# `spent=0 of 81` is really `spent=0 of 40`, and the script cannot say so

## What is wrong

`scripts/pipeline/triage-holds.ps1` is the instrument Station 00 reads before deciding what to
arm. It runs the real linter per file and files each prompt into one of four buckets **by exit
code alone** (its own header comment, anchor `# scripts/pipeline/lint-prompt.mjs. Re-implementing`
and the `switch ($exitCode)` block):

```
exit 0  ADMIT   -> gates satisfied. A CANDIDATE for arming.
exit 3  STALE   -> premise already satisfied: the work has SHIPPED. The prompt is spent.
exit 1  REJECT  -> still gated.
```

That mapping is sound **only if every prompt's premise was actually evaluated.** It is not.
`scripts/pipeline/lint-prompt.mjs` runs the premise **last**, and at least four rejection paths
return before it:

| Rejection path | anchor in `lint-prompt.mjs` | runs before `runPremise`? |
|---|---|---|
| `HUMAN_GATE_PRESENT` | the comment `// HUMAN_GATE_PRESENT - hard REJECT before the premise runs.` | yes — the comment says so |
| `GATE_NOT_RELEASED` / `FILE_GATE_NOT_RELEASED` | the `checkGateNotReleased(fm, repoRoot, name, isHold)` call site | yes |
| `UI_PROMPT_NEEDS_DESIGN_REF` | the `validateDesignRef(fm)` call site | yes |
| the premise itself | the `runPremise(String(fm.premise), repoRoot)` call site | — it is the last of the four |

**So `exit 1` carries no information about the premise at all**, and every prompt in the
STILL GATED bucket is un-measured with respect to SPENT rather than measured-and-not-spent.

## The measurement (2026-09-05T21:1xZ, `origin/main` `84cae7df`)

```
=== TOTALS  spent=0  gates-satisfied=40  still-gated=41  unreadable=0  of 81
    SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture
```

Reject-code histogram over that STILL GATED bucket:
`GATE_NOT_RELEASED` **13** · `UI_PROMPT_NEEDS_DESIGN_REF` **11** · `HUMAN_GATE_PRESENT` **9** ·
`FILE_GATE_NOT_RELEASED` **7** — **40 of the 41**, and all four are pre-premise paths per the table
above. **The honest reading of that TOTALS line is `spent=0 of 40`.**

⚠️ **Those four counts and the 81 are STATE.** Re-measure them when you build this; do not quote
them. The structural claim — *`exit 1` never ran the premise* — is what this prompt asserts, and its
falsifying probe is the call-site ordering in `lint-prompt.mjs`, not the numbers.

**The existing SPENT positive control does not cover this.** `spent-positive-control.md` proves the
exit-3 branch is *reachable*; it says nothing about the 41 board prompts whose premise was never
run. A control that passes on a fixture while the real corpus is unexamined is DOCTRINE §7's exact
shape: a check never seen to fail on the population it is quoted about.

## What to build

Add a **fifth bucket** to `triage-holds.ps1`, marked:

```powershell
# SPENT_BEHIND_A_REJECT_V1 - a REJECT does not mean the premise was evaluated.
```

1. **For every prompt that lint rejects (exit 1), run its premise separately** and report the
   result under a new heading `>>> SPENT BEHIND A REJECT -- still gated, but the work has ALREADY
   SHIPPED`. Parse the `premise:` value from the prompt's own front matter and execute it the same
   way `lint-prompt.mjs`'s `runPremise` does — same shell, same cwd (`$Repo`), same treatment of a
   non-zero exit. **Do not re-implement the linter**: this runs one command per rejected prompt and
   asks one question.
2. **Fail LOUD, never quiet, when a premise cannot run.** A spawn failure, a missing binary, or a
   premise that is absent or malformed goes into a `PREMISE UNMEASURABLE` line inside the same
   bucket — never into "not spent". DOCTRINE §7 guard 2: never let a failed call flow into a
   comparison. (This is trap #3 in §7's table: a premise that never ran, read as "premise false".)
3. **Correct the denominator on the TOTALS line.** Print the eligible count next to the raw one,
   e.g. `spent=0 (of 40 prompts whose premise was evaluated; 41 of 81 were rejected before it ran)`.
   The current line invites the reading it cannot support.
4. **Add the new bucket to the self-calibration block** at the bottom (anchor: the `$seen.Add(`
   lines). A fifth verdict that is never observed must not make the script print `calibrated`.
5. **Say what a hit MEANS in the heading text.** A prompt in this bucket is a prompt whose work has
   shipped and which is *also* still gated — it should be RETIRED to `superseded/`, and it is
   invisible to the `spent` count today, which is how a spent prompt survives a triage pass.

## What NOT to do

- **Do not touch `scripts/pipeline/lint-prompt.mjs`.** The ordering it uses is deliberate — the
  human gate and the dependency gates are before the premise on purpose, and moving the premise
  first would change what REJECT means for **every** caller of the linter, including the watcher.
  That alternative fails the *"without damaging existing"* half of RULE 1. This prompt adds a
  second reading in the reporting layer instead, which changes no existing verdict.
- **Do not make `triage-holds.ps1` mutate anything.** It is read-only by contract: it lists
  candidates, it never arms, retires or renames. A `SPENT BEHIND A REJECT` hit is a finding for a
  human, not an instruction.
- **Do not fold any assertion into `scripts/pr-gates/pr-gates.mjs`** — CP-26 failing there takes
  `PR gates — diff checks` down with it, one cause producing two reds.
- **Do not use `Set-Content -Encoding UTF8` or `Out-File -Encoding utf8`** anywhere in the edit
  (DOCTRINE §9.3, the double-encoder), and **no single-letter PowerShell variables** (§7 guard 5).

## Why it is `-HOLD` with no dependency key

It has no predecessor and nothing gates it. It is staged `-HOLD` because staging is not arming.
Arming it opens a `scripts/` PR, so `classifyPolicyFiles` routes it to Marco and RULE 2 applies to
the merge — which is the correct destination for a change to an instrument Station 00 reads before
arming.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build this in a disposable worktree off `origin/main`, run `pnpm build` and `pnpm lint`, open the
PR, and stop there. Do **not** merge it.
