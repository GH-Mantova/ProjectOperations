---
premise: '! grep -q "CP-26" docs/plans/cluster-chaining-plan.md'
premise_means: Section 9 of the cluster-chaining plan states that escalates:true is enforced by nothing - that the watcher auto-merges every PR it opens, has no concept of escalates, and that CI has no do-not-merge gate. All three claims were true when written on 2026-08-17 and all three are false now. A plan doc that names a closed gap as open is how work gets re-done, and it is the reason a build was nearly commissioned for something that already ships.
scope:
  - docs/plans/cluster-chaining-plan.md
done_when: grep -q "CP-26" docs/plans/cluster-chaining-plan.md && grep -q "2057" docs/plans/cluster-chaining-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Doc reconcile: cluster-chaining plan section 9 says `escalates:true` is unenforced. It is enforced.

Documents only. **Write no code.** This corrects one section of one plan document.

## What section 9 currently claims

> "`escalates: true` is enforced by nothing. The watcher auto-merges every PR it opens, has no
> concept of `escalates`, and CI has no do-not-merge gate."

## What is actually true - measured, quote these in the correction

[MEASURED] against `origin/main` @ `e994080d`:

1. **The watcher has a concept of `escalates`.** `scripts/pr-watcher/index.mjs:888` parses
   `deps.escalates` from front-matter.
2. **It does NOT auto-merge those PRs.** `index.mjs:2057` short-circuits both merge paths on
   `deps.escalates`; it withholds auto-merge and applies the `do-not-merge` label instead
   (~`index.mjs:1256`), and posts a comment explaining why.
3. **CI DOES have a do-not-merge gate.** CP-26 in `scripts/pr-gates/pr-gates.mjs:472-510` fails on
   the `do-not-merge` label, and **fails closed** when labels cannot be read
   (`report("FAIL", "CP-26", ..., "could not read labels")`).
4. Since 2026-08-18 the watcher also **refuses to re-apply** the label once a human has removed it
   (`decideEscalationAction`, ~`index.mjs:1123`) - so Marco removing the label actually releases the
   PR instead of the watcher immediately re-blocking it.

The chain is complete: prompt flag -> watcher withholds auto-merge + labels -> CP-26 fails CI while
the label is present -> **only Marco removes it**.

This landed in PR #1142 (escalates enforcement) and #1182 (stop re-applying after removal), both
AFTER section 9 was written on 2026-08-17.

## What to write

Rewrite the section-9 bullet so it states the enforcement chain above with the file and line
references, and record the ONE residual gap honestly rather than declaring the matter closed:

> **Residual:** CP-26 keys on the **label**, not on the originating prompt's `escalates` flag. If the
> watcher fails to apply the label, `index.mjs` logs loudly and returns `marco: true` rather than
> merging - so nothing auto-merges - but the resulting PR carries no label, and CP-26 therefore
> passes. A PR in that state is green and unguarded, and only the watcher log says so. Closing this
> properly means CI deriving `escalates` from the originating prompt rather than trusting the label.
> Narrow, real, and not yet briefed.

Keep the section's existing structure and the other open questions in it unchanged. Do not delete
the history - say what was true, when, and what changed it, so the correction is auditable.

## Do not

- Do not touch `sot/`. CP-24 hard-fails a PR mixing code and `sot/`, and this is a `docs/plans/` file
  in any case.
- Do not change any code, gate, or workflow. If you find another stale claim in this document,
  report it in the PR body - do not fix it here.
- Do not remove the residual-gap paragraph in order to make the section read cleanly. An
  overstatedly-closed gap is the same failure as an overstatedly-open one.

## Verification

    grep -n "CP-26" docs/plans/cluster-chaining-plan.md
    grep -n "2057" docs/plans/cluster-chaining-plan.md

Both must hit. Paste the corrected section in the PR body.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
